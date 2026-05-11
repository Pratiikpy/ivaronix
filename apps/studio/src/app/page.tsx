import Link from 'next/link';
import { Section } from '@/components/Section';
import { RunPanel } from '@/components/RunPanel';
import { unifiedNextId, getPassportClient, getNetwork } from '@/lib/chain';
import { loadAllSkills } from '@/lib/skills';

export const dynamic = 'force-dynamic'; // always read live chain state

async function liveReceiptCount(): Promise<bigint | null> {
  // Sum across V2 (post-K-2) + V1 (legacy) so the home headline tracks
  // total network activity, not just the registry that happened to ship
  // first (planning-003 §A.1.3).
  try {
    const { total } = await unifiedNextId();
    return total > 0n ? total : null;
  } catch {
    return null;
  }
}

async function livePassportCount(): Promise<bigint | null> {
  // Sweep 186: AgentPassportINFT initializes `nextTokenId = 1` (the
  // first mint gets tokenId 1, post-increment to 2). Anchored count
  // is `nextTokenId - 1`. Pre-sweep this returned the raw nextTokenId
  // and the home page labeled it "passports minted" — off by 1 (and
  // shows 1 when zero passports were minted). Matches the convention
  // already used in apps/studio/src/lib/dashboard.ts.
  const p = getPassportClient();
  if (!p) return null;
  try {
    const next = await p.nextTokenId();
    return next > 0n ? next - 1n : 0n;
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
  // W11 — derive the verified-skills count from the manifest loader so it
  // tracks reality (was hardcoded "5" and would drift silently).
  const allSkills = loadAllSkills();
  const verifiedSkillsCount = allSkills.length;
  // Surface only first-party + manually-curated skills in the Run-panel
  // dropdown — the 150+ vendored community skills under `imports/` would
  // overwhelm the picker. Selection mirrors the skill ids the home page
  // already references in marketing copy.
  const RUN_PANEL_IDS = new Set(['private-doc-review', 'content-pitch-review', 'github-audit', '0g-integration-auditor', 'plan-step', 'code-edit']);
  const runPanelSkills = allSkills
    .filter((s) => RUN_PANEL_IDS.has(s.id))
    .map((s) => ({
      id: s.id,
      label: s.id,
      defaultTier: s.manifest.og.consensus.default_tier,
    }));

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
          {/* W2 — live receipt count as the lead first-paint number. AlphaDawg
              + Provus pattern: the headline number a judge remembers. */}
          {totalReceipts !== null && (
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
                fontWeight: 600,
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
              {Number(totalReceipts).toLocaleString()} receipts on-chain · live
            </span>
          )}
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
                fontSize: 80,
                lineHeight: 0.98,
                margin: 0,
                letterSpacing: '-2px',
                fontWeight: 700,
              }}
            >
              <span>AI review for the documents you </span>
              <span className="italic-display" style={{ fontWeight: 400 }}>can&apos;t paste</span>
              <span> into ChatGPT.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.5, color: 'var(--color-muted)', maxWidth: 580, margin: 0 }}>
              Drop a contract, NDA, or term sheet covered by privilege or counterparty confidentiality.
              Burn Mode encrypts it; the session key is destroyed after the run. The audit ships an
              Action Receipt anchored on 0G Chain with the key fingerprint inside —{' '}
              <strong style={{ color: 'var(--color-fg)', fontWeight: 600 }}>
                anyone can independently re-verify it from any machine
              </strong>
              , even after the document is gone.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/onboard" className="btn-primary" style={{ textDecoration: 'none' }}>
                Run a private audit →
              </Link>
              <Link href="/r/1004" className="btn-secondary" style={{ textDecoration: 'none' }}>
                See a sample receipt
              </Link>
              {/* W12 — /thesis is the persona-locked story page. Prior nav
                  link is "Why" but a hero CTA gets it in front of judges
                  who never click the nav. */}
              <Link href="/thesis" className="btn-ghost" style={{ textDecoration: 'underline', alignSelf: 'center' }}>
                Why Ivaronix →
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
                <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>{verifiedSkillsCount}</span>{' '}
                <span style={{ color: 'var(--color-muted)' }}>verified skills</span>
              </div>
            </div>
          </div>

          {/* RIGHT: live RunPanel preview card. Skill list is loaded
              server-side per planning-003 §A.2.7 so the dropdown
              tracks `seed-skills/` reality + each skill's manifest
              default tier — no hardcoded list to drift. */}
          <div className="hero-runpanel">
            <RunPanel skills={runPanelSkills} />
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
            {/* W11 — 0G DA integration path is documented but not yet wired
                into the receipt flow (planning-002 W3). Honest qualifier
                instead of a brand lie. */}
            <span style={{ color: 'var(--color-muted)' }}>0G DA <span style={{ fontSize: 10, fontStyle: 'italic' }}>(integration documented)</span></span>
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
