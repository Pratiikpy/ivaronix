/**
 * FINAL_BUILD_PLAN.md Block I + Block C wiring · marketplace buy-and-run button.
 *
 * Walks the 402-style flow:
 *   1. POST /api/run/estimate with skillId + content + question
 *   2. If needsPayment=false → POST /api/run (legacy free path)
 *   3. If needsPayment=true → wagmi.writeContract(paySkillRun) → wait → POST /api/run/confirm
 *   4. Redirect to /r/<id> on success
 *
 * 5 distinct error states surfaced per FINAL_BUILD_PLAN.md Block C.
 */
'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbi } from 'viem';
import { useRouter } from 'next/navigation';

interface Props {
  skillId: string;
  priceWei: string;
  priceOg: number;
  isFree: boolean;
  creator: string;
  creatorBps: number;
  treasuryBps: number;
}

const SKILL_RUN_PAYMENT_ABI = parseAbi([
  'function paySkillRun(bytes32 receiptRoot, address creator, uint16 creatorBps, uint16 treasuryBps) payable',
]);

type FlowState =
  | { kind: 'idle' }
  | { kind: 'estimating' }
  | { kind: 'awaiting-payment'; estimate: EstimateData }
  | { kind: 'payment-pending'; estimate: EstimateData; txHash: string }
  | { kind: 'confirming'; estimate: EstimateData; txHash: string }
  | { kind: 'pipeline-running'; estimate: EstimateData; txHash: string }
  | { kind: 'success'; receiptId: string; txHash?: string }
  | { kind: 'error'; code: string; message: string };

interface EstimateData {
  needsPayment: boolean;
  amount?: string;
  paymentContract?: string;
  creator?: string;
  creatorBps?: number;
  treasuryBps?: number;
  draftReceiptRoot?: string;
  payer?: string;
  bucketSeconds?: number;
}

const SAMPLE_CONTENT = `[Marketplace test input — Hardhat Acquisition Term Sheet]\n\nThe Acquirer agrees to purchase 100% of the Target's equity for $2,000,000 (the "Purchase Price"), subject to a working capital adjustment.\n\nNon-Compete: The Founder agrees to a 5-year non-compete in any related field, globally.\n\nIndemnification: Founder indemnifies Acquirer for all known and unknown liabilities, with no cap and no time limit.\n\nGoverning Law: Cayman Islands.`;

const SAMPLE_QUESTION = 'Which clause is most concerning?';

export function BuyAndRunButton({ skillId, priceWei, priceOg, isFree, creator, creatorBps, treasuryBps }: Props) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<FlowState>({ kind: 'idle' });

  const handleClick = async () => {
    if (!isConnected || !address) {
      setState({ kind: 'error', code: 'WALLET_NOT_CONNECTED', message: 'Connect your wallet first.' });
      return;
    }

    setState({ kind: 'estimating' });

    try {
      // 1. POST /api/run/estimate
      const estimateRes = await fetch('/api/run/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          contentText: SAMPLE_CONTENT,
          question: SAMPLE_QUESTION,
          userWallet: address,
        }),
      });
      const estimate = await estimateRes.json() as EstimateData & { error?: string };
      if (!estimateRes.ok || estimate.error) {
        setState({ kind: 'error', code: 'ESTIMATE_FAILED', message: estimate.error ?? 'Estimate failed' });
        return;
      }

      // 2a. Free path (no payment)
      if (!estimate.needsPayment) {
        setState({ kind: 'pipeline-running', estimate, txHash: '' });
        const runRes = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skillId,
            contentText: SAMPLE_CONTENT,
            question: SAMPLE_QUESTION,
            userWallet: address,
            receipt: true,
          }),
        });
        const runResult = await runRes.json();
        if (!runRes.ok || !runResult.ok) {
          setState({ kind: 'error', code: 'PIPELINE_FAILED', message: runResult.error ?? 'Pipeline failed' });
          return;
        }
        setState({ kind: 'success', receiptId: runResult.receiptOnchainId ?? runResult.receiptId });
        setTimeout(() => router.push(`/r/${runResult.receiptOnchainId ?? runResult.receiptId}`), 1500);
        return;
      }

      // 2b. Paid path: walk through wagmi tx
      setState({ kind: 'awaiting-payment', estimate });

      // 3. wagmi writeContract
      const txHash = await writeContractAsync({
        address: estimate.paymentContract as `0x${string}`,
        abi: SKILL_RUN_PAYMENT_ABI,
        functionName: 'paySkillRun',
        args: [
          estimate.draftReceiptRoot as `0x${string}`,
          estimate.creator as `0x${string}`,
          estimate.creatorBps!,
          estimate.treasuryBps!,
        ],
        value: BigInt(estimate.amount!),
      });

      setState({ kind: 'payment-pending', estimate, txHash });

      // Wait for confirmation (simple polling — wagmi useWaitForTransactionReceipt
      // is hook-based and would require restructuring; for v1 we just sleep + post).
      // Real production: use viem's publicClient.waitForTransactionReceipt({ hash: txHash })
      await new Promise((r) => setTimeout(r, 6000));

      setState({ kind: 'confirming', estimate, txHash });

      // 4. POST /api/run/confirm
      const confirmRes = await fetch('/api/run/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          contentText: SAMPLE_CONTENT,
          question: SAMPLE_QUESTION,
          userWallet: address,
          txHash,
          draftReceiptRoot: estimate.draftReceiptRoot,
          amount: estimate.amount,
          paymentContract: estimate.paymentContract,
          payer: address,
          creator: estimate.creator,
          creatorBps: estimate.creatorBps,
          treasuryBps: estimate.treasuryBps,
        }),
      });
      const confirmResult = await confirmRes.json();
      if (!confirmRes.ok || !confirmResult.ok) {
        const code = confirmResult.code ?? 'CONFIRM_FAILED';
        const message = confirmResult.detail ?? confirmResult.error ?? 'Payment confirmation failed';
        if (code === 'PIPELINE_FAILED_POST_PAYMENT') {
          setState({
            kind: 'error',
            code,
            message: `Payment confirmed (tx ${txHash}) but inference failed. ${confirmResult.refundQueued ? 'A refund can be claimed after 24h.' : ''}`,
          });
        } else {
          setState({ kind: 'error', code, message });
        }
        return;
      }

      setState({ kind: 'success', receiptId: confirmResult.receiptOnchainId ?? confirmResult.receiptId, txHash });
      setTimeout(() => router.push(`/r/${confirmResult.receiptOnchainId ?? confirmResult.receiptId}`), 1500);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('user rejected')) {
        setState({ kind: 'error', code: 'USER_REJECTED', message: 'Wallet popup rejected. No charge.' });
      } else if (msg.toLowerCase().includes('insufficient')) {
        setState({ kind: 'error', code: 'INSUFFICIENT_BALANCE', message: 'Insufficient OG balance. Top up at faucet.0g.ai (testnet).' });
      } else {
        setState({ kind: 'error', code: 'UNKNOWN', message: msg });
      }
    }
  };

  const ctaLabel = (() => {
    switch (state.kind) {
      case 'idle': return isFree ? 'Run skill (free) →' : `Run with payment · ${priceOg.toFixed(6)} OG →`;
      case 'estimating': return 'Estimating cost…';
      case 'awaiting-payment': return 'Confirm payment in MetaMask…';
      case 'payment-pending': return `Payment submitted · tx ${state.txHash.slice(0, 10)}…`;
      case 'confirming': return 'Verifying payment on chain…';
      case 'pipeline-running': return 'Pipeline running · inference + anchor…';
      case 'success': return '✓ Receipt anchored. Redirecting…';
      case 'error': return 'Try again';
    }
  })();

  const isDisabled = state.kind !== 'idle' && state.kind !== 'error';

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isDisabled || !isConnected}
        style={{
          padding: '12px 24px',
          fontSize: 15,
          fontWeight: 600,
          background: state.kind === 'success' ? 'var(--color-verified-bg)' :
                      state.kind === 'error' ? 'var(--color-pending-bg)' :
                      'var(--color-ink, #0A0A0A)',
          color: state.kind === 'success' ? '#166534' :
                 state.kind === 'error' ? '#92400e' :
                 'var(--color-paper, #FAFAF7)',
          border: '1px solid var(--color-rule)',
          borderRadius: 6,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: !isConnected ? 0.5 : 1,
        }}
      >
        {ctaLabel}
      </button>

      {!isConnected && (
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
          Connect your wallet (top right) to enable.
        </p>
      )}

      {state.kind === 'error' && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)', borderRadius: 4, fontSize: 13 }}>
          <strong>Error · {state.code}</strong><br />
          {state.message}
        </div>
      )}

      {state.kind === 'payment-pending' && (
        <p style={{ marginTop: 12, fontSize: 13 }}>
          Tx <code>{state.txHash}</code> submitted. Waiting for confirmation (~6s on Galileo)…
        </p>
      )}

      {state.kind === 'success' && (
        <p style={{ marginTop: 12, fontSize: 14, color: '#166534' }}>
          ✓ Receipt #{state.receiptId} anchored. Opening proof page…
        </p>
      )}
    </div>
  );
}
