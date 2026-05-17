import type { Metadata } from 'next';
import Link from 'next/link';
import { receiptTypeLabel } from '@/lib/receipt-labels';
import { loadDashboard, type DashboardData } from '@/lib/dashboard';
import { DashboardClient } from './DashboardClient';

export const dynamic = 'force-dynamic';

// Bug-56 (extension): user-facing pages declare their own metadata so
// browser tabs + share previews don't all inherit the homepage title.
export const metadata: Metadata = {
  title: 'Dashboard · Ivaronix',
  description: 'Your wallet, your passport, your receipts — read live from chain.',
};

/**
 * /dashboard — passport state + last 5 receipts + balance + schedules.
 *
 * Per planning-003 §A.5.16, this is a server component. When a valid
 * `?address=` query param is present, the data load happens on the
 * server and the page paints with content immediately (good for
 * search engines, slow networks, link-shared agent dashboards).
 *
 * When no `?address=` is set, the page renders the "connect wallet"
 * hero and mounts a small {@link DashboardClient} island that reads
 * the connected wallet via wagmi and pushes `?address=<addr>` into
 * the URL — which re-renders the server component with full data.
 *
 * One code path, two entry modes. No client-side fetch from the
 * page itself; the API at `/api/dashboard/<addr>` still exists for
 * external consumers and uses the same `loadDashboard()` shared lib.
 */

const TIERS: { label: string; threshold: number }[] = [
  { label: 'Newcomer', threshold: 0 },
  { label: 'Verified', threshold: 5 },
  { label: 'Trusted', threshold: 20 },
  { label: 'Veteran', threshold: 50 },
  { label: 'Council', threshold: 200 },
];
function tierFor(trust: number): { label: string; threshold: number } {
  let pick = TIERS[0]!;
  for (const t of TIERS) if (trust >= t.threshold) pick = t;
  return pick;
}

interface PageProps {
  searchParams: Promise<{ address?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { address: queryAddr } = await searchParams;
  const isValidQuery = queryAddr && /^0x[0-9a-fA-F]{40}$/.test(queryAddr);
  const address = isValidQuery ? (queryAddr as `0x${string}`) : null;

  let data: DashboardData | null = null;
  let loadError: string | null = null;
  if (address) {
    try {
      data = await loadDashboard(address);
    } catch (err) {
      loadError = (err as Error).message;
    }
  }

  return (
    <section style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Client island: when a wallet connects and ?address= is absent,
          push the connected address into the URL so the server re-renders
          with real data. */}
      <DashboardClient />

      <div className="section-label" style={{ marginBottom: 16 }}>§ DASHBOARD</div>
      <h1 style={{ fontSize: 48, lineHeight: 1.1, margin: 0 }}>
        {address ? (
          <>Agent <span className="italic-display">view</span>.</>
        ) : (
          <>Connect a wallet to begin.</>
        )}
      </h1>

      {!address && (
        <p style={{ fontSize: 16, color: 'var(--color-muted)', marginTop: 16, maxWidth: 600 }}>
          Once connected, this page shows your passport state, recent receipts, scheduled runs, and live OG balance.{' '}
          You can also share a dashboard URL with <code className="mono">?address=0x…</code> to view any agent without connecting — all data is public chain state.
        </p>
      )}

      {address && (
        <>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 16 }}>
            Wallet <code className="mono">{address}</code>
          </p>

          {loadError && <p style={{ marginTop: 32, color: 'var(--color-mismatch)' }}>Error: {loadError}</p>}

          {data && (
            <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
              <div className="card">
                <div className="section-label">your passport</div>
                {data.passport ? (
                  <>
                    <p className="italic-display" style={{ fontSize: 32, marginTop: 12, marginBottom: 4 }}>
                      {tierFor(Number(data.passport.trustScore)).label}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                      ≥ {tierFor(Number(data.passport.trustScore)).threshold} trust
                    </p>
                    <dl style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '6px 12px', fontSize: 12, marginTop: 16 }}>
                      <dt style={{ color: 'var(--color-muted)' }}>tokenId</dt>
                      <dd style={{ margin: 0 }}>{data.passport.tokenId}</dd>
                      <dt style={{ color: 'var(--color-muted)' }}>trust</dt>
                      <dd style={{ margin: 0 }}>{data.passport.trustScore}</dd>
                      <dt style={{ color: 'var(--color-muted)' }}>receipts</dt>
                      <dd style={{ margin: 0 }}>
                        {data.passport.receiptCount}
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--color-muted)' }}>
                          (passport-recorded · anchored runs not yet recorded here)
                        </span>
                      </dd>
                      <dt style={{ color: 'var(--color-muted)' }}>violations</dt>
                      <dd style={{ margin: 0 }}>{data.passport.violationCount}</dd>
                    </dl>
                    <Link href={`/agent/${address}`} className="btn-secondary" style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}>
                      Full profile →
                    </Link>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 12 }}>
                      <span className="italic-display">No passport yet.</span> Mint one to see the full dashboard.
                    </p>
                    <Link href="/onboard" className="btn-secondary" style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}>
                      Onboard →
                    </Link>
                  </>
                )}
              </div>

              <div className="card">
                <div className="section-label">balance</div>
                <p className="italic-display" style={{ fontSize: 32, marginTop: 12, marginBottom: 0 }}>
                  {Number(data.balanceOg).toFixed(4)}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  OG · {data.network}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 16 }}>
                  Each receipt anchor costs ≈0.0001 OG.
                </p>
              </div>

              {/* Scheduled runs (planning-01 §2C) — operator-machine schedules */}
              <div className="card" style={{ gridColumn: 'span 2' }}>
                <div className="section-label">scheduled runs ({data.schedules.length})</div>
                {data.schedules.length === 0 ? (
                  <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 12 }}>
                    <span className="italic-display">No schedules yet.</span> From your terminal:
                    <code className="mono" style={{ marginLeft: 6, fontSize: 12 }}>
                      ivaronix skill schedule create --skill private-doc-review --cron &quot;0 9 * * MON&quot; --input &lt;doc&gt;
                    </code>
                  </p>
                ) : (
                  <>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                      {data.schedules.map((s) => {
                        const last = s.lastRunAt ? new Date(s.lastRunAt).toISOString().slice(0, 16).replace('T', ' ') : 'never';
                        const cap = s.maxRuns !== null ? `${s.runCount}/${s.maxRuns}` : `${s.runCount}/∞`;
                        return (
                          <li key={s.scheduleId} style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>
                                <code className="mono">{s.skillId}</code>
                                <span style={{ color: 'var(--color-muted)', marginLeft: 12, fontSize: 12, fontWeight: 400 }}>
                                  cron <code className="mono">{s.cron}</code>
                                </span>
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--color-muted)' }} className="mono">
                                runs {cap} · last {last}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                              <span>
                                {s.inputKind === 'doc' ? 'doc input' : 'prompt input'}
                                <span style={{ color: 'var(--color-muted)', marginLeft: 6 }}>· (content not shown · run <code className="mono">ivaronix skill schedule list</code> for full text)</span>
                              </span>
                              {s.lastReceiptId ? (
                                <Link href={`/r/${s.lastReceiptId.replace(/^rcpt_/, '')}`} className="btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }}>
                                  last receipt ↗
                                </Link>
                              ) : (
                                <span className="italic-display" style={{ fontSize: 11 }}>not fired yet</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 12 }}>
                      Schedules fire only while <code className="mono">ivaronix skill schedule run</code> is up on your machine. There is no remote daemon — your terminal is the executor.
                    </p>
                  </>
                )}
              </div>

              <div className="card" style={{ gridColumn: 'span 2' }}>
                <div className="section-label">recent receipts ({data.recentReceipts.length})</div>
                {/* Bug-68: surface the 5k-block scan window so a user who anchored */}
                {/* 10 receipts yesterday doesn't see "recent receipts (0)" and think */}
                {/* their data was lost. The window is in dashboard.ts (perf trade-off */}
                {/* to keep TTFB under 5s); passport.receiptCount is the lifetime total. */}
                <p style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6, marginBottom: 0 }}>
                  scan window: ~5,000 recent blocks (~75 min on mainnet)
                  {data.passport ? <> · passport lifetime total: <span className="mono">{data.passport.receiptCount}</span></> : null}
                </p>
                {data.recentReceipts.length === 0 ? (
                  <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 12 }}>
                    <span className="italic-display">No receipts in the recent window.</span> Older receipts stay on chain at <code className="mono" style={{ marginLeft: 6, fontSize: 12 }}>/r/&lt;id&gt;</code> — paginated history is on the v1.1 roadmap.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {data.recentReceipts.map((r) => (
                      <li key={r.id} style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 10 }}>
                        <Link href={`/r/${r.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', textDecoration: 'none', color: 'inherit', gap: 12 }}>
                          <span style={{ fontWeight: 500 }}>Receipt #{r.id}</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                            {new Date(r.timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ')}
                          </span>
                        </Link>
                        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                          <span className="mono">{receiptTypeLabel(r.receiptType)}</span> · <span className="mono">{r.receiptRoot.slice(0, 12)}…{r.receiptRoot.slice(-8)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
