'use client';

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { keccak256, toBytes, parseAbiItem, type Hex, type Address } from 'viem';
import { CAPABILITY_REGISTRY_ABI } from '@/lib/client-abis';

/**
 * Memory Permission Center — wallet-aware grants admin.
 * Reads grants where the connected wallet is owner, lets the user revoke
 * existing grants, issue new grants, and (since 2A polish) renders an
 * on-chain MemoryAccessLog audit feed scoped to the *connected* owner's
 * grants — every read another agent has performed against this owner's
 * scope, in chronological order, sourced from chain events directly.
 */

const ZERO = '0x0000000000000000000000000000000000000000' as const;
const MAX_READS = 4_294_967_295; // 0xFFFFFFFF

const SCOPE_PRESETS = [
  { label: 'project (default)', namespace: 'project' },
  { label: 'work', namespace: 'work' },
  { label: 'personal', namespace: 'personal' },
] as const;

/**
 * Skill-scoped grants — mirror the manifest ids on disk so users can
 * authorise a single skill rather than a whole namespace. Scope hash
 * is `keccak256("skill:" + id)`. Adding a skill to this list is the
 * only change needed for it to appear in the grant form.
 */
const SKILL_SCOPES = [
  'private-doc-review',
  'github-audit',
  '0g-integration-auditor',
  'plan-step',
  'code-edit',
] as const;
type SkillId = (typeof SKILL_SCOPES)[number];

type ScopeKind = 'namespace' | 'skill';

const ACCESS_LABELS = ['read', 'write', 'delete', 'grant_used'];

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function scopeHashFor(namespace: string): Hex {
  return keccak256(toBytes(`namespace:${namespace}`));
}

function skillScopeHashFor(skillId: string): Hex {
  return keccak256(toBytes(`skill:${skillId}`));
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
  const [scopeKind, setScopeKind] = useState<ScopeKind>('namespace');
  const [namespace, setNamespace] = useState<string>('project');
  const [skillId, setSkillId] = useState<SkillId>('private-doc-review');
  const [ttlSeconds, setTtlSeconds] = useState<number>(7 * 24 * 60 * 60); // 7 days

  const activeScopeHash: Hex = scopeKind === 'skill'
    ? skillScopeHashFor(skillId)
    : scopeHashFor(namespace);

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
      args: [grantee as Hex, activeScopeHash, BigInt(ttlSeconds), MAX_READS],
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
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--color-muted)' }}>scope kind</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="scopeKind" value="namespace" checked={scopeKind === 'namespace'} onChange={() => setScopeKind('namespace')} />
                namespace
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="scopeKind" value="skill" checked={scopeKind === 'skill'} onChange={() => setScopeKind('skill')} />
                skill
              </label>
            </div>
            {scopeKind === 'namespace' ? (
              <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                namespace
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
                  {activeScopeHash.slice(0, 14)}…
                </span>
              </label>
            ) : (
              <label style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                skill
                <select
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value as SkillId)}
                  style={{ marginTop: 4, marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-hairline)', fontSize: 13 }}
                >
                  {SKILL_SCOPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="mono" style={{ marginLeft: 12, fontSize: 11, color: 'var(--color-muted)' }}>
                  {activeScopeHash.slice(0, 14)}…
                </span>
                <p style={{ margin: '8px 0 0 0', fontSize: 11, color: 'var(--color-muted)' }}>
                  Skill-scoped grants only let runs of <span className="mono">{skillId}</span> read this slice — useful for sharing with a creator without exposing every namespace.
                </p>
              </label>
            )}
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

        {/* On-chain audit feed: every access another agent made under THIS owner's grants. */}
        <AuditFeed memoryLogAddr={memoryLogAddr} grantIds={grantIds ?? []} />
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

/**
 * AuditFeed — on-chain MemoryAccessLog events filtered by the user's grant ids.
 *
 * Reads `MemoryAccessed(address agent, bytes32 grantId, bytes32 memoryRoot,
 * uint8 accessType, uint64 timestamp, bytes32 scopeHash)` events directly
 * from chain via viem's `getLogs`. Filter is the indexed `grantId` topic
 * intersected with the owner's listGrantsByOwner result, so no event from
 * another owner's grants leaks in.
 *
 * Empty state is meaningful: "no access events" means either no agent has
 * exercised any grant under this wallet yet, or all reads are still in
 * recently-issued grants that haven't been used. Either way the truth is
 * shown without speculation.
 */
function AuditFeed({ memoryLogAddr, grantIds }: { memoryLogAddr: string; grantIds: readonly Hex[] }) {
  const client = usePublicClient();
  const [events, setEvents] = useState<Array<{
    grantId: Hex;
    agent: Address;
    accessType: string;
    timestamp: number;
    txHash: Hex;
    blockNumber: bigint;
  }>>([]);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (!client || !memoryLogAddr || grantIds.length === 0) {
      setEvents([]);
      setLoadState('done');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadState('loading');
        const latest = await client.getBlockNumber();
        const fromBlock = latest > 200_000n ? latest - 200_000n : 0n;
        const event = parseAbiItem(
          'event MemoryAccessed(address indexed agent, bytes32 indexed grantId, bytes32 indexed memoryRoot, uint8 accessType, uint64 timestamp, bytes32 scopeHash)'
        );
        // viem allows passing an indexed-arg array; a list of grantIds becomes an OR filter.
        const grantIdSet = new Set(grantIds.map((g) => g.toLowerCase()));
        const logs = await client.getLogs({
          address: memoryLogAddr as Address,
          event,
          args: { grantId: grantIds as readonly Hex[] },
          fromBlock,
          toBlock: latest,
        });
        if (cancelled) return;
        const mapped = logs
          .filter((l) => l.args.grantId && grantIdSet.has((l.args.grantId as string).toLowerCase()))
          .map((l) => ({
            grantId: l.args.grantId as Hex,
            agent: l.args.agent as Address,
            accessType: ACCESS_LABELS[Number(l.args.accessType ?? 0)] ?? `code ${l.args.accessType}`,
            timestamp: Number(l.args.timestamp ?? 0n),
            txHash: l.transactionHash as Hex,
            blockNumber: l.blockNumber as bigint,
          }))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 12);
        setEvents(mapped);
        setLoadState('done');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [client, memoryLogAddr, grantIds]);

  return (
    <div className="card">
      <div className="section-label">audit feed · accesses against your grants ({events.length})</div>
      {loadState === 'loading' && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
          <span className="italic-display">Reading MemoryAccessed events from chain…</span>
        </p>
      )}
      {loadState === 'error' && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-mismatch)' }}>
          Could not read on-chain events. Network or RPC may be unreachable.
        </p>
      )}
      {loadState === 'done' && events.length === 0 && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
          <span className="italic-display">No agent has exercised one of your grants yet.</span> When one does, every read shows up here with its tx hash.
        </p>
      )}
      {loadState === 'done' && events.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((ev, i) => {
            const iso = new Date(ev.timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ');
            return (
              <li
                key={`${ev.txHash}-${i}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-hairline)',
                  fontSize: 12,
                }}
              >
                <span
                  className="mono"
                  style={{
                    padding: '2px 6px',
                    background: 'var(--color-tonal)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 4,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {ev.accessType}
                </span>
                <span className="mono" style={{ fontSize: 11 }}>
                  {shortAddr(ev.agent)}{' '}
                  <span style={{ color: 'var(--color-muted)' }}>under grant {ev.grantId.slice(0, 10)}…</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{iso}Z</span>
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${ev.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: '2px 6px' }}
                >
                  tx ↗
                </a>
              </li>
            );
          })}
        </ul>
      )}
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
