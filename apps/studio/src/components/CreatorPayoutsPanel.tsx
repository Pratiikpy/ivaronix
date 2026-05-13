/**
 * FINAL_BUILD_PLAN.md Block I · creator payouts client island.
 *
 * Reads creatorBalance + creatorLifetimeEarned for the connected wallet,
 * shows Withdraw button that fires withdrawCreator.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseAbi, formatUnits } from 'viem';

interface Props {
  paymentAddr: string;
}

const PAYMENT_ABI = parseAbi([
  'function creatorBalance(address) view returns (uint256)',
  'function creatorLifetimeEarned(address) view returns (uint256)',
  'function withdrawCreator()',
]);

export function CreatorPayoutsPanel({ paymentAddr }: Props) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [withdrawState, setWithdrawState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [withdrawTxHash, setWithdrawTxHash] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const balanceResult = useReadContract({
    address: paymentAddr as `0x${string}`,
    abi: PAYMENT_ABI,
    functionName: 'creatorBalance',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const lifetimeResult = useReadContract({
    address: paymentAddr as `0x${string}`,
    abi: PAYMENT_ABI,
    functionName: 'creatorLifetimeEarned',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const balance = balanceResult.data as bigint | undefined;
  const lifetime = lifetimeResult.data as bigint | undefined;
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
        functionName: 'withdrawCreator',
        args: [],
      });
      setWithdrawTxHash(tx);
      // Wait a few seconds then refetch
      setTimeout(() => {
        balanceResult.refetch();
        lifetimeResult.refetch();
        setWithdrawState('success');
      }, 6000);
    } catch (err) {
      const msg = (err as Error).message;
      setWithdrawError(msg.toLowerCase().includes('user rejected') ? 'Cancelled in MetaMask.' : msg);
      setWithdrawState('error');
    }
  };

  if (!isConnected) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <p>Connect your wallet (top right) to see your creator balance.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Your earnings</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px' }}>
          <dt style={{ opacity: 0.6 }}>Connected wallet</dt>
          <dd><code style={{ fontSize: 12 }}>{address}</code></dd>

          <dt style={{ opacity: 0.6 }}>Pending balance</dt>
          <dd>
            <strong style={{ fontSize: 18 }}>{balanceOg}</strong> OG
            {balanceResult.isLoading && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.5 }}>(loading…)</span>}
          </dd>

          <dt style={{ opacity: 0.6 }}>Lifetime earned</dt>
          <dd>
            <strong>{lifetimeOg}</strong> OG
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.5 }}>(monotonic — never decrements)</span>
          </dd>
        </dl>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Withdraw</h2>
        <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
          {canWithdraw ? (
            <>Calling <code>withdrawCreator()</code> on SkillRunPayment transfers your accumulated balance to your wallet. Gas ~0.0001 OG.</>
          ) : (
            <>No balance to withdraw. Earnings appear here after users run paid skills you've published.</>
          )}
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
          {withdrawState === 'idle' && `Withdraw ${balanceOg} OG →`}
          {withdrawState === 'pending' && 'Confirming in MetaMask…'}
          {withdrawState === 'success' && '✓ Withdrawn. Balance refreshed.'}
          {withdrawState === 'error' && 'Try again'}
        </button>

        {withdrawTxHash && (
          <p style={{ marginTop: 12, fontSize: 13 }}>
            tx: <code style={{ fontSize: 11 }}>{withdrawTxHash}</code>
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
