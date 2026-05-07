'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, toBytes, type Hex } from 'viem';
import { CAPABILITY_REGISTRY_ABI } from '@/lib/client-abis';

/**
 * Memory Permission Center — wallet-aware grants admin per UI_UX_GUIDE §10.
 * Reads grants where the connected wallet is owner, lets the user revoke
 * existing grants, and issues new grants via wagmi useWriteContract.
 *
 * Day-17 scope: list + revoke + issue. Day 18 polish adds TTL slider and
 * the on-chain MemoryAccessLog audit feed for THIS owner.
 */

const ZERO = '0x0000000000000000000000000000000000000000' as const;
const MAX_READS = 4_294_967_295; // 0xFFFFFFFF

const SCOPE_PRESETS = [
  { label: 'project (default)', namespace: 'project' },
  { label: 'work', namespace: 'work' },
  { label: 'personal', namespace: 'personal' },
] as const;

const ACCESS_LABELS = ['read', 'write', 'delete', 'grant_used'];

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function scopeHashFor(namespace: string): Hex {
  return keccak256(toBytes(`namespace:${namespace}`));
}

interface Props {
  capabilityAddr: string;
  memoryLogAddr: string;
}

interface GrantTuple {
  owner: string;
  grantee: string;
  scopeHash: string;
  issuedAt: bigint;
  expiresAt: bigint;
  readsRemaining: number;
  revoked: boolean;
}

export function MemoryPanel({ capabilityAddr, memoryLogAddr }: Props) {
  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isWaitingTx, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [grantee, setGrantee] = useState('0x');
  const [namespace, setNamespace] = useState<string>('project');
  const [ttlSeconds, setTtlSeconds] = useState<number>(7 * 24 * 60 * 60); // 7 days

  // Read grants where the connected wallet is the owner
  const { data: grantIds, refetch: refetchGrantIds } = useReadContract({
    address: capabilityAddr ? (capabilityAddr as Hex) : undefined,
    abi: CAPABILITY_REGISTRY_ABI,
    functionName: 'listGrantsByOwner',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!capabilityAddr },
  }) as { data: readonly Hex[] | undefined; refetch: () => void };

  // Refetch after a successful write
  if (isTxConfirmed) refetchGrantIds();

  if (!isConnected || !address) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>
          <span className="italic-display">Connect a wallet</span> to issue and revoke memory grants. The connected wallet becomes the grant owner; only it can revoke.
        </p>
      </div>
    );
  }

  if (!capabilityAddr) {
    return (
      <div role="alert" className="card" style={{ borderColor: 'var(--color-mismatch)' }}>
        CapabilityRegistry not deployed on this network.
      </div>
    );
  }

  const onIssue = () => {
    if (!grantee.startsWith('0x') || grantee.length !== 42) return;
    writeContract({
      address: capabilityAddr as Hex,
      abi: CAPABILITY_REGISTRY_ABI,
      functionName: 'issueGrant',
      args: [grantee as Hex, scopeHashFor(namespace), BigInt(ttlSeconds), MAX_READS],
    });
  };

  const onRevoke = (grantId: Hex) => {
    writeContract({
      address: capabilityAddr as Hex,
      abi: CAPABILITY_REGISTRY_ABI,
      functionName: 'revokeGrant',
      args: [grantId],
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="card">
          <div className="section-label">issue a grant</div>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}>
            Grant another wallet read access to a scope of your memory. TTL is the seconds-to-expiry; reads are unlimited.
          </p>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              grantee address
              <input
                type="text"
                value={grantee}
                onChange={(e) => setGrantee(e.target.value)}
                placeholder="0x…"
                style={{
                  marginTop: 4,
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 6,
                  background: 'var(--color-card)',
                }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              scope
              <select
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                style={{ marginTop: 4, marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-hairline)', fontSize: 13 }}
              >
                {SCOPE_PRESETS.map((s) => (
                  <option key={s.namespace} value={s.namespace}>{s.label}</option>
                ))}
              </select>
              <span className="mono" style={{ marginLeft: 12, fontSize: 11, color: 'var(--color-muted)' }}>
                {scopeHashFor(namespace).slice(0, 14)}…
              </span>
            </label>
            <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
              TTL: <strong style={{ color: 'var(--color-fg)' }}>{Math.floor(ttlSeconds / 86400)}d {Math.floor((ttlSeconds % 86400) / 3600)}h</strong>
              <input
                type="range"
                min={3600}
                max={30 * 86400}
                step={3600}
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(Number(e.target.value))}
                style={{ marginTop: 8, width: '100%' }}
              />
            </label>
          </div>
          <button
            onClick={onIssue}
            disabled={!grantee.startsWith('0x') || grantee.length !== 42 || isWriting || isWaitingTx}
            className="btn-primary"
            style={{ marginTop: 16 }}
          >
            {isWriting || isWaitingTx ? 'Submitting…' : 'Issue grant'}
          </button>
          {writeError && (
            <div role="alert" style={{ marginTop: 12, padding: 12, background: 'var(--color-mismatch-bg)', border: '1px solid var(--color-mismatch)', color: '#991b1b', borderRadius: 6, fontSize: 12 }}>
              {writeError.message}
            </div>
          )}
          {isTxConfirmed && (
            <p style={{ marginTop: 12, color: 'var(--color-verified)', fontSize: 12 }}>
              ✓ Grant transaction confirmed.
            </p>
          )}
        </div>

        <div className="card">
          <div className="section-label">your grants ({grantIds?.length ?? 0})</div>
          {!grantIds || grantIds.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              <span className="italic-display">No grants issued yet by this wallet.</span>
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {grantIds.map((id) => (
                <GrantRow key={id} capabilityAddr={capabilityAddr} grantId={id} onRevoke={onRevoke} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="card">
        <div className="section-label">profile</div>
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-muted)' }}>connected wallet</p>
        <p className="mono" style={{ fontSize: 12, marginTop: 4, wordBreak: 'break-all' }}>{address}</p>

        <div className="section-label" style={{ marginTop: 24 }}>contracts</div>
        <dl style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 11 }}>
          <dt style={{ color: 'var(--color-muted)' }}>capability</dt>
          <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{shortAddr(capabilityAddr)}</dd>
          <dt style={{ color: 'var(--color-muted)' }}>memory log</dt>
          <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{memoryLogAddr ? shortAddr(memoryLogAddr) : '—'}</dd>
        </dl>

        <p style={{ marginTop: 24, fontSize: 11, color: 'var(--color-muted)' }}>
          Each issue + revoke is a real on-chain tx. The connected wallet pays gas.
        </p>
      </aside>
    </div>
  );
}

function GrantRow({ capabilityAddr, grantId, onRevoke }: { capabilityAddr: string; grantId: Hex; onRevoke: (id: Hex) => void }) {
  const { data: grant } = useReadContract({
    address: capabilityAddr as Hex,
    abi: CAPABILITY_REGISTRY_ABI,
    functionName: 'grants',
    args: [grantId],
    query: { enabled: !!capabilityAddr },
  }) as { data: readonly [string, string, string, bigint, bigint, number, boolean] | undefined };

  if (!grant) {
    return (
      <li style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        <span className="mono">{grantId.slice(0, 14)}…</span> · loading…
      </li>
    );
  }

  const [, grantee, scopeHash, , expiresAt, readsRemaining, revoked] = grant;
  const expiresIso = expiresAt > 0n ? new Date(Number(expiresAt) * 1000).toISOString().slice(0, 16).replace('T', ' ') : 'never';

  return (
    <li style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <span className="mono" style={{ fontSize: 12 }}>{shortAddr(grantee)}</span>
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>expires {expiresIso}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-muted)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span>scope <span className="mono">{scopeHash.slice(0, 14)}…</span></span>
        <span>reads {readsRemaining === MAX_READS ? '∞' : readsRemaining.toLocaleString()}</span>
        {revoked ? (
          <span className="chip-mismatch" style={{ padding: '2px 6px', fontSize: 10 }}>REVOKED</span>
        ) : (
          <button
            onClick={() => onRevoke(grantId)}
            className="btn-ghost"
            style={{ fontSize: 11, padding: '2px 6px' }}
          >
            Revoke
          </button>
        )}
      </div>
    </li>
  );
}
