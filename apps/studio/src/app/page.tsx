import Link from 'next/link';
import { Section } from '@/components/Section';
import { RunPanel } from '@/components/RunPanel';
import { DemoPanel } from '@/components/DemoPanel';
import { unifiedNextId, livePassportCount, getNetwork } from '@/lib/chain';
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

// Sweep 187: livePassportCount moved to @/lib/chain so home, thesis,
// dashboard, and any future surface read the convention from a single
// source-of-truth helper instead of duplicating the `nextTokenId - 1`
// subtraction at each call site.

interface HomePageProps {
  searchParams?: Promise<{ demo?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // FINAL_BUILD_PLAN.md Block E · ?demo=true zero-friction onboarding.
  // When set, the home page renders DemoPanel (one-button operator-subsidised
  // run) instead of the full RunPanel. Falls back to the regular flow if the
  // demo wallet is out of funds (per D-6 demo-wallet-monitor).
  const params = await searchParams;
  const demoMode = params?.demo === 'true' || params?.demo === '1';
  const { isDemoModeActive } = await import('@/lib/demo-mode');
  const demoActive = demoMode && isDemoModeActive();

  const [totalReceipts, totalPassports] = await Promise.all([
    liveReceiptCount(),
    livePassportCount(),
  ]);
  const network = getNetwork();
  // First-party skill set — the 6 we signed and maintain. The 150+
  // vendored community skills under `seed-skills/imports/` are loadable
  // but NOT first-party — they ship as a discoverability bonus, not a
  // promise. The home stat row + live-testnet card both bind to the
  // first-party count so the labels match reality (P1 UI test caught
  // the prior "FIRST-PARTY SKILLS: 156" misleading-label drift).
  const { FIRST_PARTY_SLUGS } = await import('@/lib/first-party-skills');
  const FIRST_PARTY_SKILL_IDS = new Set<string>(FIRST_PARTY_SLUGS);
  const allSkills = loadAllSkills();
  const firstPartyCount = allSkills.filter((s) => FIRST_PARTY_SKILL_IDS.has(s.id)).length;
  const totalCatalogCount = allSkills.length;
  const runPanelSkills = allSkills
    .filter((s) => FIRST_PARTY_SKILL_IDS.has(s.id))
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
            {/* H1/H2 locked by final-plan.md §1.6 Day 5-9 (MUST-SHIP #2). The
                prior persona-led H1 ("A founder reviewing a term sheet…")
                read as doc-review-only — the plan's product-wide H1 is the
                external-reviewer fix per "not doc review only" acceptance. */}
            <h1
              style={{
                fontSize: 72,
                lineHeight: 1.0,
                margin: 0,
                letterSpacing: '-2px',
                fontWeight: 700,
              }}
            >
              <span>Private AI work.</span>{' '}
              <span className="italic-display" style={{ fontWeight: 400 }}>Public proof.</span>
            </h1>
            <h2
              style={{
                fontSize: 26,
                lineHeight: 1.25,
                margin: 0,
                fontWeight: 500,
                color: 'var(--color-fg)',
                maxWidth: 620,
              }}
            >
              Paid skills. Controlled memory. Verifiable end to end.
            </h2>
            <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--color-muted)', maxWidth: 580, margin: 0 }}>
              Run a private review of the document you can&apos;t paste into ChatGPT — a term sheet
              under NDA, an indemnity clause, a data room before signing. Every review leaves a{' '}
              <strong style={{ color: 'var(--color-fg)', fontWeight: 600 }}>cryptographic receipt</strong>{' '}
              anyone can re-verify on any machine in 10 seconds. Paid on chain. Creator credited 90%.
              Treasury 10%.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/?demo=true" className="btn-primary" style={{ textDecoration: 'none' }}>
                Try the demo →
              </Link>
              <Link href="/onboard" className="btn-secondary" style={{ textDecoration: 'none' }}>
                Run on my own doc
              </Link>
              <Link href="/thesis" className="btn-ghost" style={{ textDecoration: 'underline', alignSelf: 'center' }}>
                Why Ivaronix →
              </Link>
            </div>

            <div
              style={{
                padding: '16px 18px',
                background: 'var(--color-tonal)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--color-fg)',
                lineHeight: 1.6,
                overflowX: 'auto',
              }}
            >
              <div style={{ color: 'var(--color-muted)', fontSize: 11, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>
                Independent re-verify · runs on any machine
              </div>
              <code>$ pnpm ivaronix receipt verify rec_1004 --tee-independent</code>
              <br />
              <code style={{ color: '#166534', fontWeight: 600 }}>→ FULLY VERIFIED ✓</code>{' '}
              <code style={{ color: 'var(--color-muted)' }}>schema · hash · signature · anchor · payment · TEE</code>
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
                <span style={{ fontWeight: 600, color: 'var(--color-fg)' }}>{firstPartyCount}</span>{' '}
                <span style={{ color: 'var(--color-muted)' }}>first-party skills</span>
                {totalCatalogCount > firstPartyCount && (
                  <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>
                    {' '}· +{totalCatalogCount - firstPartyCount} community
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: live RunPanel preview card. Skill list is loaded
              server-side per planning-003 §A.2.7 so the dropdown
              tracks `seed-skills/` reality + each skill's manifest
              default tier — no hardcoded list to drift.
              FINAL_BUILD_PLAN.md Block E: when ?demo=true and the
              demo wallet has funds, render DemoPanel for the one-
              click operator-subsidised flow instead. */}
          <div className="hero-runpanel">
            {demoActive ? <DemoPanel /> : <RunPanel skills={runPanelSkills} />}
          </div>
        </div>
      </section>

      {/* 5-step landing loop · final-plan.md §1.6 Day 5-9 acceptance.
          Run → Verify → Remember → Pay → Share. Each step links to a
          real shipped surface, no fake cards. */}
      <section
        style={{
          padding: '48px 32px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div
          className="section-label"
          style={{ marginBottom: 24, color: 'var(--color-muted)', fontSize: 12, letterSpacing: '1.5px' }}
        >
          THE LANDING LOOP
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {[
            { step: '01', name: 'Run', body: 'Drop a doc. Pick a skill. Inference happens in the 0G TEE.', href: '/onboard' },
            { step: '02', name: 'Verify', body: 'Schema + canonical hash + signature + chain anchor + TEE re-attestation. Five checks, one chip.', href: '/r/1004' },
            { step: '03', name: 'Remember', body: 'Grant memory access on chain. Revoke on chain. Every read leaves an access-log entry.', href: '/memory' },
            { step: '04', name: 'Pay', body: 'Per-run nano-payments. 90/10 creator/treasury split. Every run is a real on-chain tx.', href: '/marketplace' },
            { step: '05', name: 'Share', body: 'Public proof URL. Anyone re-verifies on any machine, no Ivaronix install required.', href: '/r/1004' },
          ].map(({ step, name, body, href }) => (
            <Link
              key={step}
              href={href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 18,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 120ms, transform 120ms',
              }}
              className="landing-loop-card"
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', letterSpacing: '1px' }}>
                § {step}
              </span>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-fg)' }}>{name}</span>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-muted)' }}>{body}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 12-module grid · final-plan.md §1.6 Day 5-9 acceptance.
          Every card LIVE (real shipped page) — zero fake cards, zero
          placeholder claims. This is the external-reviewer fix for
          "not doc review only". */}
      <section
        style={{
          padding: '48px 32px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div
          className="section-label"
          style={{ marginBottom: 8, color: 'var(--color-muted)', fontSize: 12, letterSpacing: '1.5px' }}
        >
          WHAT YOU CAN DO IN IVARONIX
        </div>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: 'var(--color-muted)', maxWidth: 720 }}>
          Twelve shipped surfaces. Click any card to land on a real page — no roadmap, no coming-soon.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          {[
            { name: 'Workroom', body: 'Drop a doc · run a private review · anchor a receipt.', href: '/onboard' },
            { name: 'Proof Explorer', body: 'Open any receipt — schema · hash · signature · anchor · TEE.', href: '/r/1004' },
            { name: 'Skills Marketplace', body: '6 first-party skills · per-skill price · 90/10 creator/treasury split.', href: '/marketplace' },
            { name: 'Memory Center', body: 'Grant + revoke on chain. Every read leaves an access-log entry.', href: '/memory' },
            { name: 'Agent Passports', body: 'ERC-7857 INFTs · trust score · receipt count · per-passport history.', href: '/agents' },
            { name: 'Dashboard', body: 'Your wallet · your receipts · your skills · your earnings.', href: '/dashboard' },
            { name: '0G Stack Proof', body: 'Compute · Chain · Storage · Agent ID · KV · honest DA status.', href: '/0g' },
            { name: 'Skill Library', body: '6 first-party + 150+ community catalog · manifest-hash gated.', href: '/skills' },
            { name: 'Global Activity', body: 'Live feed of receipts being anchored across the network.', href: '/global' },
            { name: 'Thesis', body: 'Why Ivaronix exists · the long-form product story.', href: '/thesis' },
            { name: 'Brand', body: 'Design contract · type · color · component primitives.', href: '/brand' },
            { name: 'Docs', body: 'CLI · MCP · SDK · embed widget · independent verify.', href: '/docs' },
          ].map(({ name, body, href }) => (
            <Link
              key={name}
              href={href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '14px 16px',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 120ms, transform 120ms',
              }}
              className="module-card"
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-fg)' }}>{name}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 999,
                  border: '1px solid var(--color-verified)',
                  background: 'var(--color-verified-bg)',
                  color: '#166534',
                  letterSpacing: '0.5px',
                }}>LIVE</span>
              </div>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-muted)' }}>{body}</span>
            </Link>
          ))}
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
            BUILT ON THE <span className="italic-display" style={{ textTransform: 'none', fontSize: 14, letterSpacing: 0 }}>0G</span> PROOF STACK
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
              {firstPartyCount}
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
          .hero-grid h1 { font-size: 48px !important; letter-spacing: -1px !important; }
          .stat-row { grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
        }
      `}</style>
    </>
  );
}
