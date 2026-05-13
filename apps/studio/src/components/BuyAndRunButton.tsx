/**
 * FINAL_BUILD_PLAN.md Block I + Block C wiring · marketplace buy-and-run flow.
 *
 * Walks the 402-style flow:
 *   1. POST /api/run/estimate with skillId + content + question
 *   2. If needsPayment=false → POST /api/run (legacy free path)
 *   3. If needsPayment=true → wagmi.writeContract(paySkillRun) → waitForTransactionReceipt → POST /api/run/confirm
 *   4. Redirect to /r/<id> on success
 *
 * Real user input: file drop + textarea + question + Burn Mode toggle.
 * Replaces the v1 hardcoded sample-input path that shipped a fake "test"
 * term sheet on every click.
 */
'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, usePublicClient, useSignMessage } from 'wagmi';
import { parseAbi } from 'viem';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { ensureSiweSession } from '@/lib/siwe-client';

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
  | { kind: 'signing-in' }
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

const MAX_TEXT_BYTES = 256 * 1024;

export function BuyAndRunButton({ skillId, priceWei, priceOg, isFree, creator, creatorBps, treasuryBps }: Props) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [state, setState] = useState<FlowState>({ kind: 'idle' });
  const [contentText, setContentText] = useState('');
  const [question, setQuestion] = useState('');
  const [burnMode, setBurnMode] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_TEXT_BYTES) {
      setState({ kind: 'error', code: 'FILE_TOO_LARGE', message: `File over 256 KB (${(f.size / 1024).toFixed(0)} KB). Trim or paste excerpts.` });
      return;
    }
    const text = await f.text();
    setContentText(text);
    setFileName(f.name);
    setState({ kind: 'idle' });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/*': ['.txt', '.md', '.json', '.csv', '.tsv', '.log'] },
    multiple: false,
    noClick: false,
  });

  const inputsReady = contentText.trim().length > 0 && question.trim().length > 0;

  const handleClick = async () => {
    if (!isConnected || !address) {
      setState({ kind: 'error', code: 'WALLET_NOT_CONNECTED', message: 'Connect your wallet first (top right).' });
      return;
    }
    if (!inputsReady) {
      setState({ kind: 'error', code: 'INPUT_REQUIRED', message: 'Drop a file or paste text, then add your question.' });
      return;
    }

    // SIWE handshake first — /api/run requires an active session when userWallet is claimed.
    setState({ kind: 'signing-in' });
    const siwe = await ensureSiweSession(address, signMessageAsync);
    if (!siwe.ok) {
      setState({ kind: 'error', code: 'SIWE_FAILED', message: `Sign-in rejected: ${siwe.error ?? 'unknown'}` });
      return;
    }

    setState({ kind: 'estimating' });

    try {
      const estimateRes = await fetch('/api/run/estimate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          contentText,
          question,
          userWallet: address,
          burn: burnMode,
        }),
      });
      const rawText = await estimateRes.text();
      let estimate: EstimateData & { error?: string };
      try {
        estimate = JSON.parse(rawText) as EstimateData & { error?: string };
      } catch {
        setState({
          kind: 'error',
          code: 'ESTIMATE_NON_JSON',
          message: `Server returned non-JSON (HTTP ${estimateRes.status}). Try again or pick a smaller input. First bytes: ${rawText.slice(0, 120)}…`,
        });
        return;
      }
      if (!estimateRes.ok || estimate.error) {
        setState({ kind: 'error', code: 'ESTIMATE_FAILED', message: estimate.error ?? `Estimate failed (HTTP ${estimateRes.status})` });
        return;
      }

      // Free path
      if (!estimate.needsPayment) {
        setState({ kind: 'pipeline-running', estimate, txHash: '' });
        const runRes = await fetch('/api/run', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skillId,
            contentText,
            question,
            userWallet: address,
            burnMode,
            receipt: true,
          }),
        });
        const runRaw = await runRes.text();
        let runResult: { ok: boolean; error?: string; receiptOnchainId?: string; receiptId?: string };
        try {
          runResult = JSON.parse(runRaw);
        } catch {
          setState({
            kind: 'error',
            code: 'RUN_NON_JSON',
            message: `Pipeline returned non-JSON (HTTP ${runRes.status}). Try again. First bytes: ${runRaw.slice(0, 120)}…`,
          });
          return;
        }
        if (!runRes.ok || !runResult.ok) {
          setState({ kind: 'error', code: 'PIPELINE_FAILED', message: runResult.error ?? 'Pipeline failed' });
          return;
        }
        setState({ kind: 'success', receiptId: runResult.receiptOnchainId ?? runResult.receiptId ?? '' });
        setTimeout(() => router.push(`/r/${runResult.receiptOnchainId ?? runResult.receiptId}`), 1500);
        return;
      }

      // Paid path
      setState({ kind: 'awaiting-payment', estimate });
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

      // Real chain confirmation via viem (replaces the v1 setTimeout hack).
      // Galileo block-time ~3s; allow up to 60s for the receipt.
      if (!publicClient) {
        setState({ kind: 'error', code: 'NO_PUBLIC_CLIENT', message: 'Public client unavailable. Refresh and try again.' });
        return;
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 60_000 });
      if (receipt.status !== 'success') {
        setState({ kind: 'error', code: 'TX_REVERTED', message: `Payment tx reverted on-chain. Hash: ${txHash}` });
        return;
      }

      setState({ kind: 'confirming', estimate, txHash });

      const confirmRes = await fetch('/api/run/confirm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillId,
          contentText,
          question,
          userWallet: address,
          burn: burnMode,
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
      const confirmRaw = await confirmRes.text();
      let confirmResult: { ok: boolean; error?: string; code?: string; detail?: string; refundQueued?: boolean; receiptOnchainId?: string; receiptId?: string };
      try {
        confirmResult = JSON.parse(confirmRaw);
      } catch {
        setState({
          kind: 'error',
          code: 'CONFIRM_NON_JSON',
          message: `Confirm returned non-JSON (HTTP ${confirmRes.status}). The payment is on chain (tx ${txHash}); try refreshing /r/<id> shortly. First bytes: ${confirmRaw.slice(0, 120)}…`,
        });
        return;
      }
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

      setState({ kind: 'success', receiptId: confirmResult.receiptOnchainId ?? confirmResult.receiptId ?? '', txHash });
      setTimeout(() => router.push(`/r/${confirmResult.receiptOnchainId ?? confirmResult.receiptId}`), 1500);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('user rejected')) {
        setState({ kind: 'error', code: 'USER_REJECTED', message: 'Wallet popup rejected. No charge.' });
      } else if (msg.toLowerCase().includes('insufficient')) {
        setState({ kind: 'error', code: 'INSUFFICIENT_BALANCE', message: 'Insufficient OG balance. Top up at faucet.0g.ai (testnet).' });
      } else if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
        setState({ kind: 'error', code: 'CHAIN_TIMEOUT', message: `Tx not confirmed within 60s. Check chainscan; the receipt may finalize shortly.` });
      } else {
        setState({ kind: 'error', code: 'UNKNOWN', message: msg });
      }
    }
  };

  const ctaLabel = (() => {
    switch (state.kind) {
      case 'idle': return isFree ? 'Run skill (free) →' : `Run with payment · ${priceOg.toFixed(6)} OG →`;
      case 'signing-in': return 'Sign in with wallet…';
      case 'estimating': return 'Estimating cost…';
      case 'awaiting-payment': return 'Confirm payment in MetaMask…';
      case 'payment-pending': return `Payment submitted · waiting for confirmation…`;
      case 'confirming': return 'Verifying payment on chain…';
      case 'pipeline-running': return 'Pipeline running · inference + anchor…';
      case 'success': return '✓ Receipt anchored. Redirecting…';
      case 'error': return isFree ? 'Run skill (free) →' : `Run with payment · ${priceOg.toFixed(6)} OG →`;
    }
  })();

  const isDisabled = state.kind !== 'idle' && state.kind !== 'error';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        {...getRootProps()}
        style={{
          border: `1px dashed ${isDragActive ? 'var(--color-ink, #0A0A0A)' : 'var(--color-rule)'}`,
          padding: 16,
          borderRadius: 8,
          cursor: 'pointer',
          textAlign: 'center',
          fontSize: 13,
          background: isDragActive ? 'var(--color-verified-bg)' : 'transparent',
        }}
      >
        <input {...getInputProps()} />
        {fileName ? (
          <span><strong>{fileName}</strong> · {contentText.length} chars loaded. Click to replace.</span>
        ) : isDragActive ? (
          <span>Drop the file here…</span>
        ) : (
          <span>Drop a file or click to browse · or paste text below</span>
        )}
      </div>

      <textarea
        value={contentText}
        onChange={(e) => setContentText(e.target.value.slice(0, MAX_TEXT_BYTES))}
        placeholder="Paste contract, code, doc, or any text up to 256 KB…"
        rows={6}
        style={{
          width: '100%',
          fontFamily: 'inherit',
          fontSize: 13,
          padding: 10,
          border: '1px solid var(--color-rule)',
          borderRadius: 6,
          resize: 'vertical',
          background: 'var(--color-paper, #FAFAF7)',
          color: 'var(--color-ink, #0A0A0A)',
        }}
        disabled={isDisabled}
      />

      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder='Your question · e.g. "Which clause is most risky?"'
        style={{
          width: '100%',
          fontFamily: 'inherit',
          fontSize: 14,
          padding: 10,
          border: '1px solid var(--color-rule)',
          borderRadius: 6,
          background: 'var(--color-paper, #FAFAF7)',
          color: 'var(--color-ink, #0A0A0A)',
        }}
        disabled={isDisabled}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 0.85 }}>
        <input
          type="checkbox"
          checked={burnMode}
          onChange={(e) => setBurnMode(e.target.checked)}
          disabled={isDisabled}
        />
        <span><strong>Burn Mode</strong> — encrypt input with a session key the operator destroys after the run.</span>
      </label>

      <div style={{ fontSize: 11, opacity: 0.6 }}>
        {contentText.length.toLocaleString()} / 262,144 bytes · {inputsReady ? '✓ ready' : 'drop content + question to enable'}
      </div>

      <button
        onClick={handleClick}
        disabled={isDisabled || !isConnected || !inputsReady}
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
          cursor: (isDisabled || !inputsReady || !isConnected) ? 'not-allowed' : 'pointer',
          opacity: (!isConnected || !inputsReady) ? 0.5 : 1,
        }}
      >
        {ctaLabel}
      </button>

      {!isConnected && (
        <p style={{ marginTop: 0, fontSize: 13, opacity: 0.7 }}>
          Connect your wallet (top right) to enable.
        </p>
      )}

      {state.kind === 'error' && (
        <div style={{ padding: 12, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)', borderRadius: 4, fontSize: 13 }}>
          <strong>Error · {state.code}</strong><br />
          {state.message}
        </div>
      )}

      {state.kind === 'payment-pending' && (
        <p style={{ fontSize: 13 }}>
          Tx <code>{state.txHash}</code> submitted. Waiting for on-chain confirmation (Galileo block-time ~3s)…
        </p>
      )}

      {state.kind === 'success' && (
        <p style={{ fontSize: 14, color: '#166534' }}>
          ✓ Receipt #{state.receiptId} anchored. Opening proof page…
        </p>
      )}
    </div>
  );
}
