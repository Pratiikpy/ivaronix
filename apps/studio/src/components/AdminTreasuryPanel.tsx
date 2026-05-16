/**
 * FINAL_BUILD_PLAN.md Block I + D-5 · admin treasury withdraw panel.
 *
 * SIWE-gated at the env level: only the connected wallet matching
 * IVARONIX_ADMIN_WALLET sees the withdraw button. Non-admins get 403.
 */
'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseAbi, formatUnits } from 'viem';
import { GALILEO_GAS_PARAMS } from '@/lib/client-abis';
import { getNetwork, getChainId } from '@/lib/network';
import { NETWORKS } from '@ivaronix/core/types';

interface Props {
  paymentAddr: string;
  expectedAdmin: string;
}

const PAYMENT_ABI = parseAbi([
  'function treasuryBalance() view returns (uint256)',
  'function treasuryLifetimeEarned() view returns (uint256)',
  'function owner() view returns (address)',
  'function withdrawTreasury()',
]);

export function AdminTreasuryPanel({ paymentAddr, expectedAdmin }: Props) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [withdrawState, setWithdrawState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const balanceResult = useReadContract({
    address: paymentAddr as `0x${string}`,
    abi: PAYMENT_ABI,
    functionName: 'treasuryBalance',
  });

  const lifetimeResult = useReadContract({
    address: paymentAddr as `0x${string}`,
    abi: PAYMENT_ABI,
    functionName: 'treasuryLifetimeEarned',
  });

  const ownerResult = useReadContract({
    address: paymentAddr as `0x${string}`,
    abi: PAYMENT_ABI,
    functionName: 'owner',
  });

  const balance = balanceResult.data as bigint | undefined;
  const lifetime = lifetimeResult.data as bigint | undefined;
  const onChainOwner = (ownerResult.data as string | undefined)?.toLowerCase();
  const ownerReadFailed = ownerResult.status === 'error' || (ownerResult.isFetched && !onChainOwner);

  // Authorization gates:
  //   1. Connected wallet matches IVARONIX_ADMIN_WALLET env (operator-side claim)
  //   2. Connected wallet matches the contract's Ownable owner (chain-side proof)
  const envMatch = !!address && !!expectedAdmin && address.toLowerCase() === expectedAdmin;
  const chainMatch = !!address && !!onChainOwner && address.toLowerCase() === onChainOwner;
  const isAdmin = envMatch && chainMatch;

  if (!isConnected) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p>Connect your wallet (top right) to access the admin panel.</p>
      </div>
    );
  }

  if (!isAdmin) {
    // Bug-25 closure (session 41): distinguish the THREE failure modes so a
    // judge whose wallet IS the admin but is on the wrong network doesn't see
    // a misleading "does not match the admin address" message.
    let title: string;
    let body: string;
    if (envMatch && ownerReadFailed) {
      title = 'Network mismatch';
      body = 'Your connected wallet matches the env-declared admin, but the chain-side ownership check failed — usually because your wallet is on the wrong network. Switch to OG Mainnet (chainId 16661) to verify on-chain.';
    } else if (envMatch && !chainMatch) {
      title = 'Chain owner mismatch';
      body = 'Your connected wallet matches the env-declared admin, but the on-chain Ownable owner is a different address. The contract may have been transferred since the env was set, or the env is stale.';
    } else {
      title = '403 · Not authorised';
      body = 'This route is admin-only. Your connected wallet does not match the admin address.';
    }
    return (
      <div className="card" style={{ padding: 24, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)' }}>
        <h3 style={{ margin: '0 0 8px 0' }}>{title}</h3>
        <p style={{ fontSize: 14, marginBottom: 8 }}>{body}</p>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px', fontSize: 13 }}>
          <dt style={{ opacity: 0.6 }}>Connected wallet</dt>
          <dd><code style={{ fontSize: 11 }}>{address}</code></dd>
          <dt style={{ opacity: 0.6 }}>Expected admin (env)</dt>
          <dd><code style={{ fontSize: 11 }}>{expectedAdmin || '(not set)'}</code></dd>
          <dt style={{ opacity: 0.6 }}>On-chain owner</dt>
          <dd><code style={{ fontSize: 11 }}>{onChainOwner ?? '— (chain read failed)'}</code></dd>
        </dl>
      </div>
    );
  }

  const balanceOg = balance != null ? formatUnits(balance, 18) : '—';
  const lifetimeOg = lifetime != null ? formatUnits(lifetime, 18) : '—';
  const canWithdraw = balance != null && balance > 0n;

  const handleWithdraw = async () => {
    if (!canWithdraw) return;
    setWithdrawState('pending');
    setWithdrawError(null);
    try {
      const tx = await writeContractAsync({
        address: paymentAddr as `0x${string}`,
        abi: PAYMENT_ABI,
        functionName: 'withdrawTreasury',
        args: [],
        chainId: getChainId(),
        ...GALILEO_GAS_PARAMS,
      });
      setWithdrawTxHash(tx);
      if (!publicClient) {
        setWithdrawError('Public client unavailable. Refresh the page.');
        setWithdrawState('error');
        return;
      }
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx as `0x${string}`, timeout: 60_000 });
      if (receipt.status !== 'success') {
        setWithdrawError(`Treasury withdraw tx reverted on chain. Hash: ${tx}`);
        setWithdrawState('error');
        return;
      }
      await balanceResult.refetch();
      await lifetimeResult.refetch();
      setWithdrawState('success');
    } catch (err) {
      const msg = (err as Error).message;
      const lower = msg.toLowerCase();
      if (lower.includes('user rejected')) {
        setWithdrawError('Cancelled in MetaMask.');
      } else if (lower.includes('timeout') || lower.includes('timed out')) {
        const explorer = NETWORKS[getNetwork()].chainExplorer;
        setWithdrawError(`Tx not confirmed within 60s. Check ${explorer} — withdrawal may still settle.`);
      } else {
        setWithdrawError(msg);
      }
      setWithdrawState('error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Treasury balance</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px' }}>
          <dt style={{ opacity: 0.6 }}>Admin wallet</dt>
          <dd><code style={{ fontSize: 12 }}>{address}</code></dd>

          <dt style={{ opacity: 0.6 }}>Pending balance</dt>
          <dd>
            <strong style={{ fontSize: 18 }}>{balanceOg}</strong> OG
            {balanceResult.isLoading && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.5 }}>(loading…)</span>}
          </dd>

          <dt style={{ opacity: 0.6 }}>Lifetime treasury earnings</dt>
          <dd>
            <strong>{lifetimeOg}</strong> OG
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.5 }}>(monotonic)</span>
          </dd>
        </dl>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Withdraw treasury</h2>
        <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
          Calls <code>withdrawTreasury()</code> on SkillRunPayment. Drains the accumulated <code>treasuryBalance</code> to the contract owner ({address?.slice(0, 10)}…).
        </p>
        <button
          onClick={handleWithdraw}
          disabled={!canWithdraw || withdrawState === 'pending'}
          style={{
            padding: '12px 24px',
            fontSize: 15,
            fontWeight: 600,
            background: 'var(--color-ink, #0A0A0A)',
            color: 'var(--color-paper, #FAFAF7)',
            border: '1px solid var(--color-rule)',
            borderRadius: 6,
            cursor: !canWithdraw || withdrawState === 'pending' ? 'not-allowed' : 'pointer',
            opacity: !canWithdraw || withdrawState === 'pending' ? 0.5 : 1,
          }}
        >
          {withdrawState === 'idle' && `Withdraw treasury · ${balanceOg} OG →`}
          {withdrawState === 'pending' && 'Confirming in MetaMask…'}
          {withdrawState === 'success' && '✓ Withdrawn.'}
          {withdrawState === 'error' && 'Try again'}
        </button>

        {withdrawTxHash && (
          <p style={{ marginTop: 12, fontSize: 13 }}>
            tx:{' '}
            <a
              href={`${NETWORKS[getNetwork()].chainExplorer}/tx/${withdrawTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
            >
              {withdrawTxHash} ↗
            </a>
          </p>
        )}

        {withdrawError && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending)', borderRadius: 4, fontSize: 13 }}>
            <strong>Error</strong><br />
            {withdrawError}
          </div>
        )}
      </div>
    </div>
  );
}
