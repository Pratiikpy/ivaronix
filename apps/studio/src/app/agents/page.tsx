import Link from 'next/link';
import { Section } from '@/components/Section';
import { getPassportClient, livePassportCount, getNetwork } from '@/lib/chain';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface AgentRow {
  tokenId: bigint;
  owner: `0x${string}`;
  trustScore: bigint;
  receiptCount: bigint;
  violationCount: bigint;
  mintedAt: bigint;
}

async function loadAgents(): Promise<AgentRow[]> {
  const passport = getPassportClient();
  if (!passport) return [];
  // Sweep 188: livePassportCount() returns the anchored-count (nextTokenId-1)
  // following the convention used by home/thesis/global. Iterating
  // tokenIds 1..total below is now driven by the same source-of-truth.
  const anchored = await livePassportCount();
  if (anchored === null) return [];
  const total = Number(anchored);
  if (total <= 0) return [];

  // Walk tokenIds 1..total in parallel — typically <20 mints, so the RPC
  // round-trip cost is negligible. Cap at 100 for safety.
  const cap = Math.min(total, 100);
  const rows = await Promise.all(
    Array.from({ length: cap }, (_, i) => i + 1).map(async (id) => {
      try {
        const p = await passport.getPassport(BigInt(id));
        return p
          ? {
              tokenId: p.tokenId,
              owner: p.owner,
              trustScore: p.trustScore,
              receiptCount: p.receiptCount,
              violationCount: p.violationCount,
              mintedAt: p.mintedAt,
            }
          : null;
      } catch {
        return null;
      }
    }),
  );
  const cleaned: AgentRow[] = [];
  for (const r of rows) if (r !== null) cleaned.push(r);
  cleaned.sort((a, b) => Number(b.trustScore) - Number(a.trustScore));
  return cleaned;
}

const TIERS: Array<{ label: string; threshold: number; bg: string; fg: string; border: string }> = [
  { label: 'Council', threshold: 200, bg: '#0a0a0a', fg: '#FAFAF7', border: '#0a0a0a' },
  { label: 'Veteran', threshold: 50, bg: '#dcfce7', fg: '#166534', border: '#16a34a' },
  { label: 'Trusted', threshold: 20, bg: '#fff7d6', fg: '#7a5d00', border: '#e8c800' },
  { label: 'Verified', threshold: 5, bg: '#e6e6e6', fg: '#444', border: '#bbb' },
  { label: 'Newcomer', threshold: 0, bg: 'var(--color-tonal)', fg: 'var(--color-muted)', border: 'var(--color-hairline)' },
];

function tierFor(trust: bigint) {
  const n = Number(trust);
  for (const t of TIERS) if (n >= t.threshold) return t;
  return TIERS[TIERS.length - 1]!;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function isoFromTimestamp(ts: bigint): string {
  if (ts === 0n) return 'unknown';
  return new Date(Number(ts) * 1000).toISOString().slice(0, 10);
}

export default async function AgentsPage() {
  const agents = await loadAgents();
  const network = getNetwork();

  return (
    <Section
      label="§ AGENTS"
      title="Every passport on this network"
      description={`Live read of AgentPassportINFT on 0G ${network}. Sorted by trust score. Each agent's trust grows by +1 per anchored receipt — the score reflects real on-chain activity, not endorsement.`}
    >
      {agents.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>
          <span className="italic-display">No passports minted on this network yet.</span> Run{' '}
          <code className="mono">ivaronix passport mint</code> to be the first.
        </p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 110px 110px 110px 110px',
              gap: 16,
              padding: '14px 24px',
              borderBottom: '1px solid var(--color-hairline)',
              background: 'var(--color-tonal)',
              fontSize: 11,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              fontWeight: 600,
            }}
          >
            <div>#</div>
            <div>agent</div>
            <div>tier</div>
            <div style={{ textAlign: 'right' }}>trust</div>
            <div style={{ textAlign: 'right' }}>receipts</div>
            <div style={{ textAlign: 'right' }}>minted</div>
          </div>
          {agents.map((a, i) => {
            const t = tierFor(a.trustScore);
            return (
              <Link
                key={a.tokenId.toString()}
                href={`/agent/${a.owner}`}
                role="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 110px 110px 110px 110px',
                  gap: 16,
                  padding: '14px 24px',
                  borderBottom: i === agents.length - 1 ? 'none' : '1px solid var(--color-hairline)',
                  textDecoration: 'none',
                  color: 'inherit',
                  fontSize: 13,
                  alignItems: 'center',
                  transition: 'background 120ms ease',
                }}
                className="leaderboard-row"
              >
                <div className="mono" style={{ color: 'var(--color-muted)' }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>tokenId {a.tokenId.toString()}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                    {shortAddr(a.owner)}
                  </div>
                </div>
                <div>
                  <span
                    className="mono"
                    style={{
                      padding: '2px 8px',
                      fontSize: 10,
                      borderRadius: 4,
                      border: `1px solid ${t.border}`,
                      background: t.bg,
                      color: t.fg,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {t.label}
                  </span>
                </div>
                <div className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{a.trustScore.toString()}</div>
                <div className="mono" style={{ textAlign: 'right', color: 'var(--color-muted)' }}>{a.receiptCount.toString()}</div>
                <div className="mono" style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-muted)' }}>{isoFromTimestamp(a.mintedAt)}</div>
              </Link>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 24, lineHeight: 1.5 }}>
        Trust scores are updated on chain via{' '}
        <code className="mono">AgentPassportINFT.recordReceipt</code>{' '}
        each time the agent anchors a receipt. The contract is at{' '}
        <code className="mono">0x08d2…563E</code> on testnet — every row above reflects real on-chain state at page-load
        time.
      </p>
    </Section>
  );
}
