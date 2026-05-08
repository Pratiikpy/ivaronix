import Link from 'next/link';
import { Section } from '@/components/Section';
import { RunPanel } from '@/components/RunPanel';
import { getReceiptRegistry, getPassportClient, getNetwork } from '@/lib/chain';

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

async function livePassportCount(): Promise<bigint | null> {
  const p = getPassportClient();
  if (!p) return null;
  try {
    return await p.nextTokenId();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [totalReceipts, totalPassports] = await Promise.all([
    liveReceiptCount(),
    livePassportCount(),
  ]);
  const network = getNetwork();

  return (
    <>
      {/* HERO — 2-column on desktop, stacked on mobile */}
      <section
        style={{
          padding: '64px 32px 48px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            color: 'var(--color-muted)',
            fontSize: 12,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            marginBottom: 32,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>IVARONIX</span>
          <span>·</span>
          <span>v0.4</span>
          <span>·</span>
          <span>{network === 'testnet' ? 'GALILEO TESTNET' : 'ARISTOTLE MAINNET'}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--color-verified)',
              background: 'var(--color-verified-bg)',
              color: '#166534',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.5px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: 'var(--color-verified)',
                animation: 'pulse 1.6s ease-in-out infinite',
              }}
            />
            Live
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr',
            gap: 64,
            alignItems: 'start',
          }}
          className="hero-grid"
        >
          {/* LEFT: copy + CTAs + stat row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <h1
              style={{
                fontSize: 88,
                lineHeight: 0.96,
                margin: 0,
                letterSpacing: '-2px',
                fontWeight: 700,
              }}
            >
              <span>Catch the risks.</span>
              <br />
              <span className="italic-display" style={{ fontWeight: 400 }}>Keep the receipts.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.5, color: 'var(--color-muted)', maxWidth: 540, margin: 0 }}>
              AI agents that double-check themselves on 0G. Private memory, permissioned skills,
              adjudicated consensus, action receipts — all anchored on chain.{' '}
              <strong style={{ color: 'var(--color-fg)', fontWeight: 600 }}>
                One demo proves the entire OS.
              </strong>
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/onboard" className="btn-primary" style={{ textDecoration: 'none' }}>
                Try the killer demo →
              </Link>
              <Link href="/skills" className="btn-secondary" style={{ textDecoration: 'none' }}>
                Browse skills
              </Link>
            </div>

            {/* Stat row — live numbers from chain */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, auto)',
                gap: 32,
                paddingTop: 24,
                borderTop: '1px solid var(--color-hairline)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}
              className="stat-row"
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
                  {totalReceipts !== null ? Number(totalReceipts).toLocaleString() : '—'}
                </span>{' '}
                <span style={{ color: 'var(--color-muted)' }}>receipts on-chain</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>
                  {totalPassports !== null ? Number(totalPassports).toLocaleString() : '—'}
                </span>{' '}
                <span style={{ color: 'var(--color-muted)' }}>passports minted</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>5</span>{' '}
                <span style={{ color: 'var(--color-muted)' }}>verified skills</span>
              </div>
            </div>
          </div>

          {/* RIGHT: live RunPanel preview card */}
          <div className="hero-runpanel">
            <RunPanel />
          </div>
        </div>
      </section>

      {/* "BUILT ON FULL OG STACK" band */}
      <section
        style={{
          borderTop: '1px solid var(--color-hairline)',
          borderBottom: '1px solid var(--color-hairline)',
          padding: '24px 32px',
          maxWidth: 1200,
          margin: '32px auto 0',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 32,
            flexWrap: 'wrap',
            fontSize: 13,
          }}
        >
          <span
            className="section-label"
            style={{ flexShrink: 0 }}
          >
            BUILT ON THE <span className="italic-display" style={{ textTransform: 'none', fontSize: 14, letterSpacing: 0 }}>full</span> OG STACK
          </span>
          <div
            style={{
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              color: 'var(--color-fg)',
              fontWeight: 500,
            }}
          >
            <span>0G Compute</span>
            <span>0G Storage</span>
            <span>0G Chain</span>
            <span>0G DA</span>
            <span>0G Router</span>
            <span>Sealed Inference</span>
          </div>
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
            <div className="italic-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 8 }}>
              {totalReceipts !== null ? Number(totalReceipts).toString() : '—'}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              On {network}.
            </div>
          </div>
          <div className="card">
            <div className="section-label">First-party skills</div>
            <div className="italic-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 8 }}>
              5
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              Each anchored on the on-chain SkillRegistry.
            </div>
          </div>
          <div className="card">
            <div className="section-label">Consensus tiers</div>
            <div className="italic-display" style={{ fontSize: 56, lineHeight: 1, marginTop: 8 }}>
              3
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted)' }}>
              Quick · Standard · High-stakes.
            </div>
          </div>
        </div>
      </Section>

      {/* Hero responsive overrides — kept here so the page is self-contained */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 1080px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
        @media (max-width: 640px) {
          .hero-grid h1 { font-size: 56px !important; letter-spacing: -1px !important; }
          .stat-row { grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
        }
      `}</style>
    </>
  );
}
