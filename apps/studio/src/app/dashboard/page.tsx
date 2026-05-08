'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';

interface DashboardData {
  network: string;
  address: string;
  balanceOg: string;
  passport: {
    tokenId: string;
    metadataRoot: string;
    memoryRoot: string;
    trustScore: string;
    receiptCount: string;
    violationCount: string;
    mintedAt: number;
    lastEvolutionAt: number;
  } | null;
  recentReceipts: { id: string; receiptRoot: string; receiptType: number; timestamp: number }[];
}

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

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) { setData(null); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/${address}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: DashboardData) => setData(json))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [isConnected, address]);

  return (
    <section style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div className="section-label" style={{ marginBottom: 16 }}>§ DASHBOARD</div>
      <h1 style={{ fontSize: 48, lineHeight: 1.1, margin: 0 }}>
        {isConnected ? (
          <>Welcome back, <span className="italic-display">agent</span>.</>
        ) : (
          <>Connect a wallet to begin.</>
        )}
      </h1>

      {!isConnected && (
        <p style={{ fontSize: 16, color: 'var(--color-muted)', marginTop: 16, maxWidth: 600 }}>
          Once connected, this page shows your passport state, recent receipts, and live OG balance.
        </p>
      )}

      {isConnected && address && (
        <>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 16 }}>
            Wallet <code className="mono">{address}</code>
          </p>

          {loading && <p style={{ marginTop: 32, color: 'var(--color-muted)' }}>Loading from chain…</p>}
          {error && <p style={{ marginTop: 32, color: 'var(--color-mismatch)' }}>Error: {error}</p>}

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
                    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 12, marginTop: 16 }}>
                      <dt style={{ color: 'var(--color-muted)' }}>tokenId</dt>
                      <dd style={{ margin: 0 }}>{data.passport.tokenId}</dd>
                      <dt style={{ color: 'var(--color-muted)' }}>trust</dt>
                      <dd style={{ margin: 0 }}>{data.passport.trustScore}</dd>
                      <dt style={{ color: 'var(--color-muted)' }}>receipts</dt>
                      <dd style={{ margin: 0 }}>{data.passport.receiptCount}</dd>
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
                      <span className="italic-display">No passport yet.</span> Mint one to unlock the full dashboard.
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

              <div className="card" style={{ gridColumn: 'span 2' }}>
                <div className="section-label">recent receipts ({data.recentReceipts.length})</div>
                {data.recentReceipts.length === 0 ? (
                  <p style={{ fontSize: 14, color: 'var(--color-muted)', marginTop: 12 }}>
                    <span className="italic-display">No receipts yet.</span> Run something —
                    <code className="mono" style={{ marginLeft: 6, fontSize: 12 }}>ivaronix doc ask &lt;file&gt; "..."</code>
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
                          type code {r.receiptType} · <span className="mono">{r.receiptRoot.slice(0, 12)}…{r.receiptRoot.slice(-8)}</span>
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
