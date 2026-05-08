/**
 * /brand — native Ivaronix brand kit. Replaces the iframed standalone
 * HTML with a Studio-integrated page that:
 *   - shares one header (the Studio nav, no duplicate)
 *   - reuses Outfit + Instrument Serif + JetBrains Mono already loaded
 *     via next/font/google in layout.tsx
 *   - reads colors from globals.css custom properties (--color-cream,
 *     --color-ink, --color-accent, --color-muted, --color-hairline)
 *   - speaks the canonical brand voice ("Catch the risks. Keep the
 *     receipts.") aligned with the home page, not a second tagline
 *
 * Sections mirror the standalone artifact but rebuilt as React: Logo
 * (with construction grid SVG + clear space), Color palette swatches
 * with hex tokens, Type ramp, Voice rules, Components preview, Tokens
 * reference table.
 */

import Link from 'next/link';

export const metadata = {
  title: 'Brand · Ivaronix',
  description: 'Logo, palette, typography, voice. The canonical visual reference.',
};

export default function BrandPage() {
  return (
    <main style={{ background: 'var(--color-bg)', color: 'var(--color-fg)', minHeight: 'calc(100vh - 64px)' }}>
      {/* ───── HERO ───── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 32px' }}>
        <div className="section-label">— BRAND · v1.0 · MAY 2026</div>
        <h1 style={{ fontSize: 72, lineHeight: 1.05, margin: '24px 0', maxWidth: 900, letterSpacing: '-0.02em' }}>
          Catch the <em className="italic-display">risks</em>. Keep the receipts.
        </h1>
        <p style={{ fontSize: 18, color: 'var(--color-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          Ivaronix is the 0G Agent OS — a calm, editorial surface wrapped around a chaotic substrate. This page is the source of truth for everything you can see, read, or paste with the brand on it. Every Studio surface and CLI banner draws from these tokens.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, marginTop: 64 }}>
          <MetaCell k="Brand" v="Ivaronix" />
          <MetaCell k="Tagline" v={<><em className="italic-display">0G</em> Agent OS</>} />
          <MetaCell k="System" v="Editorial · Off-white" />
          <MetaCell k="Status" v={<span style={{ color: 'var(--color-accent)' }}>● Live</span>} />
        </div>
      </section>

      {/* ───── 01 LOGO ───── */}
      <Section num="01" eyebrow="Logo · The Mark" title={<>A bracketed <em className="italic-display">i</em> with a heartbeat.</>}>
        <p className="lead">
          The mark frames a single italic letter — the agent — between two structural brackets — the runtime that holds it. The tittle of the i is replaced by a green pulse: a live cursor, a heartbeat, a sign that something is currently thinking.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginTop: 32 }}>
          <LogoCell label="Primary mark" sub="SVG · 240×240" bg="var(--color-card)">
            <Logo size={180} ink="#0a0a0a" green="#16a34a" />
          </LogoCell>
          <LogoCell label="Inverted · on ink" sub="Reverse · always-on green" bg="#0a0a0a">
            <Logo size={180} ink="#fafaf7" green="#16a34a" />
          </LogoCell>
          <LogoCell label="Wordmark · horizontal" sub="Outfit 600 · Mark + name" bg="var(--color-card)">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
              <Logo size={56} ink="#0a0a0a" green="#16a34a" />
              <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.01em' }}>Ivaronix</span>
            </div>
          </LogoCell>
        </div>
      </Section>

      {/* ───── 02 COLOR ───── */}
      <Section num="02" eyebrow="Color · Editorial Palette" title={<>Off-white paper, deep ink, one <em className="italic-display">living</em> green.</>}>
        <p className="lead">
          The system is calibrated for long reading sessions. Warm off-white paper carries the page; ink is near-black, not pure black, so the rendering reads as printed not screen-glare. The single accent is a saturated live green — used only for state ("● Live", verified chips, the logo's tittle). One accent, one job.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 32 }}>
          <Swatch hex="#FAFAF7" name="paper" usage="Default page background" textColor="#0a0a0a" />
          <Swatch hex="#F4F3EE" name="paper-2" usage="Tonal cards · headers" textColor="#0a0a0a" />
          <Swatch hex="#FFFFFF" name="card" usage="Elevated surfaces" textColor="#0a0a0a" border />
          <Swatch hex="#0A0A0A" name="ink" usage="Body text · primary buttons" textColor="#fafaf7" />
          <Swatch hex="#111111" name="ink-soft" usage="Headlines · code marks" textColor="#fafaf7" />
          <Swatch hex="#5A5A5A" name="graphite" usage="Captions · meta" textColor="#fafaf7" />
          <Swatch hex="#6B6B66" name="muted" usage="Subtitle · timestamp" textColor="#fafaf7" />
          <Swatch hex="#16A34A" name="live · accent" usage="Verified · pulse · chip" textColor="#fafaf7" />
          <Swatch hex="#7C3AED" name="violet" usage="Active step · interactive border" textColor="#fafaf7" />
          <Swatch hex="#D97706" name="amber · pending" usage="In-flight · warning chip" textColor="#fafaf7" />
          <Swatch hex="#DC2626" name="alert" usage="Mismatch · refused · revoked" textColor="#fafaf7" />
        </div>
      </Section>

      {/* ───── 03 TYPE ───── */}
      <Section num="03" eyebrow="Type · The Voice in Print" title={<>Three faces. One <em className="italic-display">opinionated</em> ramp.</>}>
        <p className="lead">
          Outfit carries every body and headline — geometric sans, weights 500/600/700, generous tracking at small sizes. Instrument Serif italic provides editorial accent on emphasis words and numerals only. JetBrains Mono carries every hash, address, and address-shaped number. No fourth face.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 32 }}>
          <TypeSample face="Outfit · Sans" sample="Display 72 · weight 600" weight={600} family="var(--font-outfit), Outfit, system-ui, sans-serif" size={72} />
          <TypeSample face="Outfit · Sans" sample="Heading 48 · weight 600" weight={600} family="var(--font-outfit), Outfit, system-ui, sans-serif" size={48} />
          <TypeSample face="Outfit · Sans" sample="Body 18 · weight 500 · for long-form reading" weight={500} family="var(--font-outfit), Outfit, system-ui, sans-serif" size={18} />
          <TypeSample face="Instrument Serif · Italic" sample={<em className="italic-display">accent on emphasis · italic only</em>} weight={400} family="var(--font-instrument-serif), 'Instrument Serif', serif" size={64} italic />
          <TypeSample face="JetBrains Mono" sample="0xaa954c33810029a3eFb0bf755FEF17863E8677Ce" weight={500} family="var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace" size={14} />
        </div>
      </Section>

      {/* ───── 04 VOICE ───── */}
      <Section num="04" eyebrow="Voice · Receipts > Rhetoric" title={<>Show the number. Cut the <em className="italic-display">slurry</em>.</>}>
        <p className="lead">
          From CLAUDE.md §9 — the binding writing contract. One clause per sentence. No em-dash slurries. No three-adjective stacks. No banned words (delve, unlock, unleash, robust, leverage, empower, seamless, harness, streamline, cutting-edge, state-of-the-art, revolutionize). A real number is worth ten adjectives.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 32 }}>
          <VoiceRule
            kind="do"
            head="Show, don't adjective"
            body={<>"200ms p95" not "blazingly fast." "61/61 tests" not "extensively tested." "287 receipts on testnet" not "battle-tested at scale."</>}
          />
          <VoiceRule
            kind="dont"
            head="Three-adjective stacks"
            body={<>"powerful, scalable, secure" — pick the one that's true and prove it with a number.</>}
          />
          <VoiceRule
            kind="do"
            head="One clause per sentence"
            body={<>If you reach for an em-dash, rewrite. Cut every word the sentence still works without.</>}
          />
          <VoiceRule
            kind="dont"
            head="Marketing sandwich"
            body={<>Claim → flowery elaboration → restated claim. Make the claim once.</>}
          />
        </div>
      </Section>

      {/* ───── 05 COMPONENTS ───── */}
      <Section num="05" eyebrow="Components · The Vocabulary" title={<>Cards, chips, buttons, the <em className="italic-display">four-light</em> row.</>}>
        <p className="lead">
          Every Studio surface is built from this vocabulary. The four-light row (Storage / Compute / TEE / Chain) is the canonical "what was verified" indicator on every receipt page. Chips communicate state with hairline borders and tonal fills.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
          <span className="chip-verified">VERIFIED</span>
          <span className="chip-pending">PENDING</span>
          <span className="chip-mismatch">MISMATCH</span>
          <span className="chip-verified">TIER 1 · TEE</span>
          <span className="chip-verified">RISK: LOW</span>
          <span className="chip-verified">REGISTRY MATCH</span>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
          <button className="btn-primary">Run</button>
          <button className="btn-secondary">Browse skills</button>
          <button className="btn-ghost">Learn more</button>
        </div>

        <div className="card" style={{ marginTop: 32, maxWidth: 720 }}>
          <div className="section-label" style={{ marginBottom: 16 }}>§ FOUR-LIGHT ROW</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="chip-verified">● STORAGE</span>
            <span className="chip-verified">● COMPUTE</span>
            <span className="chip-pending">● TEE</span>
            <span className="chip-verified">● CHAIN</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 12 }}>
            Every receipt page renders this row. Lights flip green as each layer is independently verified. Amber means a verification is pending or skipped (e.g. TEE-independent re-check requires <code className="mono">ivaronix receipt verify --tee-independent</code>).
          </p>
        </div>
      </Section>

      {/* ───── 06 TOKENS ───── */}
      <Section num="06" eyebrow="Tokens · The Source of Truth" title="CSS custom properties.">
        <p className="lead">
          Every color, radius, shadow, and font reference resolves through these tokens in <code className="mono">apps/studio/src/app/globals.css</code>. Studio components never hardcode hex values; the CLI's banner colors mirror the same scale via picocolors mapping.
        </p>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <TokenCell name="--color-bg" value="#FAF9F6" purpose="Default page background" />
          <TokenCell name="--color-fg" value="#0A0A0A" purpose="Body text · primary buttons" />
          <TokenCell name="--color-card" value="#FFFFFF" purpose="Elevated surfaces" />
          <TokenCell name="--color-tonal" value="#F4F3EE" purpose="Subtle bands · headers" />
          <TokenCell name="--color-accent" value="#16A34A" purpose="Live · verified · pulse" />
          <TokenCell name="--color-pending" value="#D97706" purpose="In-flight · warning" />
          <TokenCell name="--color-mismatch" value="#DC2626" purpose="Refused · revoked · alert" />
          <TokenCell name="--color-muted" value="#6B6B66" purpose="Subtitle · timestamps" />
          <TokenCell name="--color-hairline" value="rgba(10,10,10,0.10)" purpose="Card + table borders" />
          <TokenCell name="--radius-sm / md / lg" value="10px / 14px / 20px" purpose="Card + button radii" />
        </div>
      </Section>

      {/* ───── FOOTER ───── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 32px 96px' }}>
        <hr style={{ border: 0, borderTop: '1px solid var(--color-hairline)', margin: '48px 0' }} />
        <p style={{ fontSize: 13, color: 'var(--color-muted)', maxWidth: 800 }}>
          The original standalone HTML lives at <code className="mono">/brand.html</code> for download. This native page is the source of truth for the brand on the live product. Voice contract: <Link href="https://github.com/Pratiikpy/ivaronix" style={{ color: 'inherit' }}><code className="mono">CLAUDE.md §9</code></Link>. Visual contract: <code className="mono">CLAUDE.md §10</code>.
        </p>
      </section>
    </main>
  );
}

/** Logomark SVG — bracketed italic i with a green pulse. */
function Logo({ size, ink, green }: { size: number; ink: string; green: string }) {
  return (
    <svg viewBox="0 0 240 240" width={size} height={size}>
      <path d="M 60 45 L 35 45 L 35 195 L 60 195" stroke={ink} strokeWidth={11} fill="none" strokeLinecap="square" />
      <path d="M 180 45 L 205 45 L 205 195 L 180 195" stroke={ink} strokeWidth={11} fill="none" strokeLinecap="square" />
      <text x={120} y={165} textAnchor="middle" fontFamily="Instrument Serif, Times New Roman, serif" fontStyle="italic" fontSize={140} fill={ink}>i</text>
      <circle cx={126} cy={65} r={11} fill={green} />
    </svg>
  );
}

function Section({ num, eyebrow, title, children }: { num: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: '1px solid var(--color-hairline)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px' }}>
        <div style={{ display: 'flex', gap: 32, marginBottom: 32, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div className="mono" style={{ fontSize: 13, color: 'var(--color-muted)' }}>§ {num}</div>
          <div className="section-label">{eyebrow}</div>
        </div>
        <h2 style={{ fontSize: 48, lineHeight: 1.1, margin: 0, marginBottom: 24, letterSpacing: '-0.02em', maxWidth: 900 }}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function MetaCell({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 4 }}>{k}</div>
      <div style={{ fontSize: 16 }}>{v}</div>
    </div>
  );
}

function LogoCell({ label, sub, bg, children }: { label: string; sub: string; bg: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ background: bg, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, fontSize: 11, color: bg === '#0a0a0a' ? '#8a8a8a' : 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', minHeight: 220 }}>{children}</div>
      <div style={{ padding: 16, fontSize: 11, color: bg === '#0a0a0a' ? '#8a8a8a' : 'var(--color-muted)' }} className="mono">{sub}</div>
    </div>
  );
}

function Swatch({ hex, name, usage, textColor, border }: { hex: string; name: string; usage: string; textColor: string; border?: boolean }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: border ? '1px solid var(--color-hairline)' : 'none' }}>
      <div style={{ background: hex, height: 96 }} />
      <div style={{ padding: 16, background: 'var(--color-card)', borderTop: '1px solid var(--color-hairline)' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{hex}</div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8 }}>{usage}</div>
      </div>
    </div>
  );
}

function TypeSample({ face, sample, weight, family, size, italic }: { face: string; sample: React.ReactNode; weight: number; family: string; size: number; italic?: boolean }) {
  return (
    <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 16 }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 8 }}>{face} · {size}px / {weight}{italic ? ' / italic' : ''}</div>
      <div style={{ fontFamily: family, fontWeight: weight, fontSize: size, fontStyle: italic ? 'italic' : 'normal', lineHeight: 1.05 }}>
        {sample}
      </div>
    </div>
  );
}

function VoiceRule({ kind, head, body }: { kind: 'do' | 'dont'; head: string; body: React.ReactNode }) {
  const isDo = kind === 'do';
  return (
    <div className="card" style={{ borderColor: isDo ? 'var(--color-accent)' : 'var(--color-mismatch)', borderStyle: 'solid', borderWidth: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: isDo ? 'var(--color-accent)' : 'var(--color-mismatch)' }}>
        {isDo ? '✓ Do' : '✗ Don\'t'}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 8px' }}>{head}</div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

function TokenCell({ name, value, purpose }: { name: string; value: string; purpose: string }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <code className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{name}</code>
      <code className="mono" style={{ fontSize: 12, color: 'var(--color-muted)', flexShrink: 0 }}>{value}</code>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', width: '100%', marginTop: 8 }}>{purpose}</div>
    </div>
  );
}
