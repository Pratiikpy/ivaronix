'use client';

import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();

  return (
    <section style={{ padding: '96px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div className="section-label" style={{ marginBottom: 16 }}>
        § DASHBOARD
      </div>
      <h1 style={{ fontSize: 48, lineHeight: 1.1, margin: 0 }}>
        {isConnected ? (
          <>
            Welcome back, <span className="italic-display">agent</span>.
          </>
        ) : (
          <>Connect a wallet to begin.</>
        )}
      </h1>

      {isConnected && address ? (
        <>
          <p style={{ fontSize: 16, color: 'var(--color-muted)', marginTop: 16 }}>
            Wallet <code className="mono">{address}</code>
          </p>
          <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            <div className="card">
              <div className="section-label">your passport</div>
              <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)' }}>
                <span className="italic-display">Live profile arrives Day 14.</span> For now, view your wallet's passport directly:
              </p>
              <Link href={`/agent/${address}`} className="btn-secondary" style={{ marginTop: 16, display: 'inline-block', textDecoration: 'none' }}>
                View profile →
              </Link>
            </div>
            <div className="card">
              <div className="section-label">recent receipts</div>
              <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)' }}>
                Receipt list lands Day 14 alongside the drop-zone hero. CLI today:
              </p>
              <pre className="mono" style={{ marginTop: 12, fontSize: 12, background: 'var(--color-tonal)', padding: 12, borderRadius: 4 }}>
                ivaronix receipt list --since 2026-05-01
              </pre>
            </div>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 16, color: 'var(--color-muted)', marginTop: 16, maxWidth: 600 }}>
          Once connected, this page shows your passport state, recent receipts, granted memory scopes, and live router balance.
        </p>
      )}
    </section>
  );
}
