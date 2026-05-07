import Link from 'next/link';
import { FourLightRow } from '@/components/FourLightRow';
import { Section } from '@/components/Section';
import { getReceiptRegistry } from '@/lib/chain';

export const dynamic = 'force-dynamic'; // always read live chain state

async function liveReceiptCount(): Promise<bigint | null> {
  const reg = getReceiptRegistry();
  if (!reg) return null;
  try {
    return await reg.nextId();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const totalReceipts = await liveReceiptCount();

  return (
    <>
      <section
        style={{
          minHeight: 'calc(100vh - 64px)',
          padding: '96px 32px',
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 48,
        }}
      >
        <h1 style={{ fontSize: 80, lineHeight: 1.0, margin: 0, letterSpacing: '-1px' }}>
          <span>Catch the risks.</span>
          <br />
          <span className="italic-display">Keep the receipts.</span>
        </h1>
        <p style={{ fontSize: 20, color: 'var(--color-muted)', maxWidth: 720, margin: 0 }}>
          AI agents that double-check themselves on 0G. Every action a verifiable receipt.
        </p>

        <div
          style={{
            background: 'var(--color-tonal)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            maxWidth: 720,
          }}
        >
          <p className="section-label">§ 01 · DROP A FILE OR ASK</p>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>
            <span className="italic-display">The Studio drop-zone arrives Day 14.</span> For now, run from the CLI:
          </p>
          <pre
            className="mono"
            style={{
              background: 'var(--color-fg)',
              color: 'var(--color-bg)',
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              overflowX: 'auto',
              margin: 0,
              fontSize: 13,
            }}
          >
            ivaronix doc ask contract.pdf "find risky clauses" --skill private-doc-review --consensus
          </pre>
          <FourLightRow layers={{ Storage: 'verified', Compute: 'verified', TEE: 'verified', Chain: 'verified' }} />
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/skills" className="btn-primary" style={{ textDecoration: 'none' }}>
            Browse skills
          </Link>
          <Link href="/global" className="btn-secondary" style={{ textDecoration: 'none' }}>
            Global stats
          </Link>
        </div>
      </section>

      <Section
        label="§ 02 · LIVE TESTNET"
        title="Real receipts, on chain."
        description="Every receipt is signed by an agent passport, anchored on 0G Galileo Testnet, and independently verifiable."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 24,
          }}
        >
          <div className="card">
            <div className="section-label">Total receipts</div>
            <div className="italic-display" style={{ fontSize: 48, lineHeight: 1, marginTop: 8 }}>
              {totalReceipts !== null ? Number(totalReceipts).toString() : '—'}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              On {process.env.NEXT_PUBLIC_OG_NETWORK ?? 'testnet'}.
            </div>
          </div>
          <div className="card">
            <div className="section-label">First-party skills</div>
            <div className="italic-display" style={{ fontSize: 48, lineHeight: 1, marginTop: 8 }}>
              5
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              Each anchored on the on-chain SkillRegistry.
            </div>
          </div>
          <div className="card">
            <div className="section-label">Consensus tiers</div>
            <div className="italic-display" style={{ fontSize: 48, lineHeight: 1, marginTop: 8 }}>
              3
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              Quick · Standard · High-stakes.
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
