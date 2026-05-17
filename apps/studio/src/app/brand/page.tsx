/**
 * /brand — native React rebuild of the standalone Brand Kit (Vol. 01).
 *
 * Matches the standalone HTML's exact design language:
 *   --bg #fafaf7  --paper #f4f3ee  --bg-elev #ffffff
 *   --ink #0a0a0a  --muted #6b6b6b
 *   --live #16a34a (green)  --burn #7c3aed (violet)
 *   --warn #d97706 (amber)  --deny #dc2626 (red)
 *   --line rgba(10,10,10,.10)  --line-soft rgba(10,10,10,.06)
 *   --r-sm 10  --r-md 14  --r-lg 20
 *   sans Outfit  serif Instrument Serif italic  mono JetBrains Mono
 *
 * Single Studio header (from layout.tsx). Every visual surface here
 * uses the brand-kit tokens inline so /brand is the canonical render
 * regardless of whether globals.css drifts.
 *
 * Sections: Cover · Logo · Color · Type · Voice · Components · Tokens.
 */

const T = {
  bg: '#fafaf7',
  paper: '#f4f3ee',
  elev: '#ffffff',
  ink: '#0a0a0a',
  muted: '#6b6b6b',
  live: '#16a34a',
  burn: '#7c3aed',
  warn: '#d97706',
  deny: '#dc2626',
  line: 'rgba(10,10,10,.10)',
  lineSoft: 'rgba(10,10,10,.06)',
  rSm: 10,
  rMd: 14,
  rLg: 20,
  sans: "'Outfit', system-ui, sans-serif",
  serif: "'Instrument Serif', Times New Roman, serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

export const metadata = {
  title: 'Brand · Ivaronix',
  description: 'Ivaronix Brand Kit Vol. 01 — logo, palette, typography, voice, components, tokens.',
};

export default function BrandPage() {
  return (
    <main style={{ background: T.bg, color: T.ink, fontFamily: T.sans, minHeight: 'calc(100vh - 64px)' }}>
      <Cover />
      <LogoSection />
      <ColorSection />
      <TypeSection />
      <VoiceSection />
      <ComponentsSection />
      <TokensSection />
      <FooterNote />
    </main>
  );
}

/* ════════════════════════════════════════════════════════════ COVER ═════ */
function Cover() {
  return (
    <section style={wrap({ paddingTop: 96, paddingBottom: 96 })}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 48, alignItems: 'center' }} className="brand-cover-grid">
        <div>
          <Eyebrow>— Brand kit · Vol. 01</Eyebrow>
          <h1 style={{ fontSize: 'clamp(48px, 7vw, 88px)', lineHeight: 1.02, margin: '24px 0 0', letterSpacing: '-0.02em', fontWeight: 600 }}>
            A quiet operating system for <em style={italicAccent}>noisy</em> agents.
          </h1>
          <p style={{ fontSize: 18, color: T.muted, lineHeight: 1.55, marginTop: 28, maxWidth: 560 }}>
            Ivaronix is the 0G Agent Operating System — a calm, editorial surface wrapped around a chaotic substrate. This kit is the source of truth for everything you can see, read, or paste with the brand on it.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 20, marginTop: 48 }}>
            <MetaCell k="Brand" v="Ivaronix" />
            <MetaCell k="Tagline" v={<><em style={italicAccent}>0G</em> Agent OS</>} />
            <MetaCell k="System" v="Editorial · Off-white" />
            <MetaCell k="Status" v={<span style={{ color: T.live }}>● Live</span>} />
          </div>
        </div>

        {/* Premium logo plate — corner brackets, large mark, footline */}
        <div style={{
          background: T.elev,
          border: `1px solid ${T.line}`,
          borderRadius: T.rLg,
          padding: '64px 32px 24px',
          position: 'relative',
          minHeight: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <CornerBrackets />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <BigMark size={320} />
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 4, color: T.muted, marginTop: 24 }}>
            IVA·RO·NIX · 0G AGENT OS
          </div>
        </div>
      </div>
    </section>
  );
}

function CornerBrackets() {
  const c: React.CSSProperties = { position: 'absolute', fontSize: 18, color: T.muted, fontFamily: T.mono, lineHeight: 1 };
  return (
    <>
      <span style={{ ...c, top: 12, left: 16 }}>⌜</span>
      <span style={{ ...c, top: 12, right: 16 }}>⌝</span>
      <span style={{ ...c, bottom: 12, left: 16 }}>⌞</span>
      <span style={{ ...c, bottom: 12, right: 16 }}>⌟</span>
    </>
  );
}

/* ═════════════════════════════════════════════════════════════ LOGO ════ */
function LogoSection() {
  return (
    <SectionShell num="01" eyebrow="Logo · The Mark" title={<>A bracketed <em style={italicAccent}>i</em> with a heartbeat.</>}
      lead="The mark frames a single italic letter — the agent — between two structural brackets — the runtime that holds it. The tittle of the i is replaced by a green pulse: a live cursor, a heartbeat, a sign that something is currently thinking."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 28 }}>
        <LogoCell label="Primary mark" sub="SVG · 240×240" num="01" bg={T.elev}>
          <BigMark size={180} />
        </LogoCell>
        <LogoCell label="Wordmark · horizontal" sub="Outfit 600 · Mark + name" num="02" bg={T.paper}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
            <BigMark size={64} />
            <span style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-0.01em' }}>Ivaronix</span>
          </div>
        </LogoCell>
        <LogoCell label="Inverted · on ink" sub="Reverse · always-on green" num="03" bg={T.ink} dark>
          <BigMark size={180} ink="#fafaf7" />
        </LogoCell>
        <LogoCell label="Favicon · 16, 32, 56px" sub="Optical sizing" num="04" bg={T.elev}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
            <BigMark size={56} />
            <BigMark size={32} />
            <BigMark size={20} />
          </div>
        </LogoCell>
      </div>

      {/* Construction grid */}
      <div style={{ marginTop: 28, background: T.elev, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: 24 }}>
        <CardLabel left="Construction · 24 unit grid" right="x = bracket weight" />
        <svg viewBox="0 0 480 360" style={{ width: '100%', height: 'auto', maxWidth: 480, display: 'block', margin: '24px auto' }}>
          <g stroke="rgba(10,10,10,0.07)" strokeWidth={1}>
            <path d="M0 60 L480 60 M0 120 L480 120 M0 180 L480 180 M0 240 L480 240 M0 300 L480 300" />
            <path d="M60 0 L60 360 M120 0 L120 360 M180 0 L180 360 M240 0 L240 360 M300 0 L300 360 M360 0 L360 360 M420 0 L420 360" />
          </g>
          <path d="M 130 70 L 80 70 L 80 290 L 130 290" stroke={T.ink} strokeWidth={14} fill="none" strokeLinecap="square" />
          <path d="M 350 70 L 400 70 L 400 290 L 350 290" stroke={T.ink} strokeWidth={14} fill="none" strokeLinecap="square" />
          <text x={240} y={248} textAnchor="middle" fontFamily="Instrument Serif, serif" fontStyle="italic" fontSize={220} fill={T.ink}>i</text>
          <circle cx={252} cy={105} r={17} fill={T.live} />
          <g stroke="rgba(22,163,74,.6)" strokeWidth={1} strokeDasharray="3 3" fill="none">
            <line x1={240} y1={0} x2={240} y2={360} />
            <line x1={0} y1={180} x2={480} y2={180} />
            <circle cx={252} cy={105} r={34} />
          </g>
          <g fontFamily={T.mono} fontSize={11} fill={T.muted}>
            <text x={14} y={14}>x</text>
            <text x={14} y={350}>2x clear-space minimum</text>
            <text x={466} y={14} textAnchor="end">cap = 12x</text>
          </g>
        </svg>
      </div>
    </SectionShell>
  );
}

/* ════════════════════════════════════════════════════════════ COLOR ═══ */
function ColorSection() {
  const palette: { hex: string; name: string; usage: string; dark?: boolean; border?: boolean }[] = [
    { hex: '#FAFAF7', name: 'paper', usage: 'Default page background', border: true },
    { hex: '#F4F3EE', name: 'paper-2', usage: 'Tonal cards · headers', border: true },
    { hex: '#FFFFFF', name: 'elev', usage: 'Elevated surfaces', border: true },
    { hex: '#0A0A0A', name: 'ink', usage: 'Body · primary buttons', dark: true },
    { hex: '#111111', name: 'ink-soft', usage: 'Headlines · code marks', dark: true },
    { hex: '#5A5A5A', name: 'graphite', usage: 'Captions · meta', dark: true },
    { hex: '#6B6B66', name: 'muted', usage: 'Subtitle · timestamp', dark: true },
    { hex: '#16A34A', name: 'live', usage: 'Verified · pulse · chip', dark: true },
    { hex: '#7C3AED', name: 'burn', usage: 'Burn mode · interactive', dark: true },
    { hex: '#D97706', name: 'warn', usage: 'In-flight · amber chip', dark: true },
    { hex: '#DC2626', name: 'deny', usage: 'Mismatch · refused · revoked', dark: true },
  ];
  return (
    <SectionShell num="02" eyebrow="Color · Editorial Palette" title={<>Off-white paper, deep ink, one <em style={italicAccent}>living</em> green.</>}
      lead="The system is calibrated for long reading sessions. Warm off-white paper carries the page; ink is near-black, not pure black, so the rendering reads as printed not screen-glare. The single accent is a saturated live green — used only for state. One accent, one job."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 28 }}>
        {palette.map((p) => <Swatch key={p.hex} {...p} />)}
      </div>
    </SectionShell>
  );
}

function Swatch({ hex, name, usage, dark, border }: { hex: string; name: string; usage: string; dark?: boolean; border?: boolean }) {
  return (
    <div style={{ borderRadius: T.rMd, overflow: 'hidden', border: `1px solid ${T.line}` }}>
      <div style={{ background: hex, height: 96, position: 'relative', borderBottom: border ? `1px solid ${T.line}` : 'none' }} />
      <div style={{ padding: '14px 16px', background: T.elev }}>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>{name}</div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 2 }}>{hex}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>{usage}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ TYPE ════ */
function TypeSection() {
  return (
    <SectionShell num="03" eyebrow="Type · The Voice in Print" title={<>Three faces. One <em style={italicAccent}>opinionated</em> ramp.</>}
      lead="Outfit carries every body and headline — geometric sans, weights 500/600/700. Instrument Serif italic provides editorial accent on emphasis words and numerals only. JetBrains Mono carries every hash, address, and address-shaped number. No fourth face."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 28 }}>
        <TypeRow face="Outfit · Sans" meta="Display · 72 / 600" family={T.sans} weight={600} size={72}>
          Display 72 · weight 600
        </TypeRow>
        <TypeRow face="Outfit · Sans" meta="Heading · 48 / 600" family={T.sans} weight={600} size={48}>
          Heading 48 · weight 600
        </TypeRow>
        <TypeRow face="Outfit · Sans" meta="Body · 18 / 500" family={T.sans} weight={500} size={18}>
          Body 18 · weight 500 · for long-form reading sessions where the line height does the heavy lifting.
        </TypeRow>
        <TypeRow face="Instrument Serif · Italic" meta="Accent · 64 / 400 italic" family={T.serif} weight={400} size={64} italic>
          accent on emphasis · italic only
        </TypeRow>
        <TypeRow face="JetBrains Mono" meta="Hash · 14 / 500" family={T.mono} weight={500} size={14}>
          0xaa954c33810029a3eFb0bf755FEF17863E8677Ce
        </TypeRow>
      </div>
    </SectionShell>
  );
}

function TypeRow({ face, meta, family, weight, size, italic, children }: { face: string; meta: string; family: string; weight: number; size: number; italic?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: T.mono, fontSize: 11, color: T.muted, marginBottom: 12 }}>
        <span>{face}</span><span>{meta}</span>
      </div>
      <div style={{ fontFamily: family, fontWeight: weight, fontSize: size, fontStyle: italic ? 'italic' : 'normal', lineHeight: 1.05, color: T.ink }}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ VOICE ═══ */
function VoiceSection() {
  return (
    <SectionShell num="04" eyebrow="Voice · Receipts > Rhetoric" title={<>Show the number. Cut the <em style={italicAccent}>slurry</em>.</>}
      lead='From CLAUDE.md §9 — the binding writing contract. One clause per sentence. No em-dash slurries. No three-adjective stacks. No banned words ("delve / unlock / unleash / robust / leverage / empower / seamless / harness / streamline / cutting-edge / state-of-the-art / revolutionize"). A real number is worth ten adjectives.'
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 28 }}>
        <VoiceRule kind="do" head="Show, don't adjective" body={<>"200ms p95" not "blazingly fast." "61/61 tests" not "extensively tested." "287 receipts on testnet" not "battle-tested at scale."</>} />
        <VoiceRule kind="dont" head="Three-adjective stacks" body={<>"powerful, scalable, secure" — pick the one that's true and prove it with a number.</>} />
        <VoiceRule kind="do" head="One clause per sentence" body={<>If you reach for an em-dash, rewrite. Cut every word the sentence still works without.</>} />
        <VoiceRule kind="dont" head="Marketing sandwich" body={<>Claim → flowery elaboration → restated claim. Make the claim once.</>} />
      </div>
    </SectionShell>
  );
}

function VoiceRule({ kind, head, body }: { kind: 'do' | 'dont'; head: string; body: React.ReactNode }) {
  const isDo = kind === 'do';
  return (
    <div style={{
      background: T.elev,
      border: `1px solid ${isDo ? T.live : T.deny}`,
      borderRadius: T.rMd,
      padding: 24,
    }}>
      <div style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: isDo ? T.live : T.deny }}>
        {isDo ? '✓ Do' : '✗ Don\'t'}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 8px', letterSpacing: '-0.01em' }}>{head}</div>
      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ COMPONENTS ═══ */
function ComponentsSection() {
  return (
    <SectionShell num="05" eyebrow="Components · The Vocabulary" title={<>Cards, chips, buttons, the <em style={italicAccent}>four-light</em> row.</>}
      lead="Every Studio surface is built from this vocabulary. The four-light row (Storage / Compute / TEE / Chain) is the canonical 'what was verified' indicator on every receipt page. Chips communicate state with hairline borders and tonal fills."
    >
      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Chips */}
        <div style={{ background: T.elev, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: 24 }}>
          <CardLabel left="State chips" right="Hairline border + tonal fill" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Chip color={T.live} bg="#dcfce7">VERIFIED</Chip>
            <Chip color={T.warn} bg="#fef3c7">PENDING</Chip>
            <Chip color={T.deny} bg="#fee2e2">MISMATCH</Chip>
            <Chip color={T.live} bg="#dcfce7">TIER 1 · TEE</Chip>
            <Chip color={T.live} bg="#dcfce7">RISK: LOW</Chip>
            <Chip color={T.live} bg="#dcfce7">REGISTRY MATCH</Chip>
            <Chip color={T.burn} bg="#ede9fe">🔒 BURN MODE</Chip>
          </div>
        </div>
        {/* Buttons */}
        <div style={{ background: T.elev, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: 24 }}>
          <CardLabel left="Buttons" right="Pill 999px · Outfit 600" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            <button style={btnPrimary}>Run</button>
            <button style={btnSecondary}>Browse skills</button>
            <button style={btnGhost}>Learn more</button>
          </div>
        </div>
        {/* Four-light row */}
        <div style={{ background: T.elev, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: 24 }}>
          <CardLabel left="Four-light row" right="The receipt-page verification indicator" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Chip color={T.live} bg="#dcfce7">● STORAGE</Chip>
            <Chip color={T.live} bg="#dcfce7">● COMPUTE</Chip>
            <Chip color={T.warn} bg="#fef3c7">● TEE</Chip>
            <Chip color={T.live} bg="#dcfce7">● CHAIN</Chip>
          </div>
          <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginTop: 16 }}>
            Every receipt page renders this row. Lights flip green as each layer is independently verified. Amber means a verification is pending or skipped — TEE-independent re-check requires <code style={inlineCode}>ivaronix receipt verify --tee-independent</code>.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

function Chip({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '5px 12px',
      borderRadius: 999,
      border: `1px solid ${color}`,
      background: bg,
      color,
      fontFamily: T.mono,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════ TOKENS ═══ */
function TokensSection() {
  const tokens: { k: string; v: string; purpose: string }[] = [
    { k: '--bg', v: '#fafaf7', purpose: 'Default page background (paper)' },
    { k: '--paper', v: '#f4f3ee', purpose: 'Tonal cards · headers' },
    { k: '--bg-elev', v: '#ffffff', purpose: 'Elevated surfaces' },
    { k: '--ink', v: '#0a0a0a', purpose: 'Body text · primary buttons' },
    { k: '--muted', v: '#6b6b6b', purpose: 'Subtitle · timestamps · meta' },
    { k: '--live', v: '#16a34a', purpose: 'Verified · pulse · the dot in the mark' },
    { k: '--burn', v: '#7c3aed', purpose: 'Burn mode · interactive accent' },
    { k: '--warn', v: '#d97706', purpose: 'In-flight · pending chips' },
    { k: '--deny', v: '#dc2626', purpose: 'Mismatch · refused · revoked' },
    { k: '--line', v: 'rgba(10,10,10,.10)', purpose: 'Card + table borders' },
    { k: '--r-sm / md / lg', v: '10 / 14 / 20px', purpose: 'Border-radius scale' },
    { k: '--sans / serif / mono', v: 'Outfit / Instrument Serif / JetBrains Mono', purpose: 'Font stack' },
  ];
  return (
    <SectionShell num="06" eyebrow="Tokens · The Source of Truth" title="CSS custom properties."
      lead="Every color, radius, shadow, and font reference resolves through these tokens. Studio components never hardcode hex values; the CLI's banner colors mirror the same scale via picocolors mapping."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginTop: 28 }}>
        {tokens.map((t) => (
          <div key={t.k} style={{ background: T.elev, border: `1px solid ${T.line}`, borderRadius: T.rMd, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <code style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink }}>{t.k}</code>
              <code style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{t.v}</code>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>{t.purpose}</div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ════════════════════════════════════════════════════════════ FOOTER ═══ */
function FooterNote() {
  return (
    <section style={wrap({ paddingTop: 64, paddingBottom: 96 })}>
      <hr style={{ border: 0, borderTop: `1px solid ${T.line}`, margin: '0 0 32px' }} />
      <p style={{ fontSize: 13, color: T.muted, maxWidth: 800, lineHeight: 1.6 }}>
        The original standalone HTML lives at <code style={inlineCode}>/brand.html</code> as a downloadable artifact. This native page is the source of truth for the brand on the live product. Voice contract: <code style={inlineCode}>CLAUDE.md §9</code>. Visual contract: <code style={inlineCode}>CLAUDE.md §10</code>.
      </p>
    </section>
  );
}

/* ════════════════════════════════════════════════════ helpers / shells ═ */

function SectionShell({ num, eyebrow, title, lead, children }: { num: string; eyebrow: string; title: React.ReactNode; lead: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: `1px solid ${T.line}`, background: T.bg }}>
      <div style={wrap({ paddingTop: 80, paddingBottom: 80 })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) minmax(0, 1fr)', gap: 32, alignItems: 'baseline' }} className="brand-sec-head">
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 56, fontWeight: 300, color: T.muted, lineHeight: 1, letterSpacing: '-0.02em' }}>{num}</div>
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
          {/* minWidth:0 lets this grid cell shrink below content width on mobile.
              Without it, the h2 clamp(36px) headline with an italic-accent <em>
              forces the cell to its content's intrinsic width and overflows the
              375px viewport by ~46px (Bug-74). overflowWrap+wordBreak handle
              the case where a single italic word ("opinionated") is itself
              wider than the column. */}
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', lineHeight: 1.05, margin: 0, letterSpacing: '-0.02em', fontWeight: 600, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              {title}
            </h2>
            <p style={{ fontSize: 17, color: T.muted, lineHeight: 1.55, marginTop: 18, maxWidth: 720 }}>{lead}</p>
          </div>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: 3, color: T.muted, textTransform: 'uppercase' }}>{children}</div>
  );
}

function MetaCell({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: 2, color: T.muted, textTransform: 'uppercase', marginBottom: 6 }}>{k}</div>
      <div style={{ fontSize: 16, color: T.ink }}>{v}</div>
    </div>
  );
}

function LogoCell({ label, sub, num, bg, dark, children }: { label: string; sub: string; num: string; bg: string; dark?: boolean; children: React.ReactNode }) {
  const labelColor = dark ? '#8a8a8a' : T.muted;
  return (
    <div style={{ background: bg, border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : T.line}`, borderRadius: T.rMd, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', fontFamily: T.mono, fontSize: 11, letterSpacing: 2, color: labelColor, textTransform: 'uppercase' }}>
        <span>{label}</span>
        <span style={{ opacity: 0.7 }}>{num}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', minHeight: 240 }}>{children}</div>
      <div style={{ padding: '12px 16px', fontFamily: T.mono, fontSize: 11, color: labelColor, borderTop: `1px solid ${dark ? 'rgba(255,255,255,.08)' : T.line}` }}>{sub}</div>
    </div>
  );
}

function CardLabel({ left, right }: { left: string; right: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono, fontSize: 11, letterSpacing: 2, color: T.muted, textTransform: 'uppercase' }}>
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

/** Big logomark — the canonical 240×240 SVG straight from the standalone HTML. */
function BigMark({ size, ink = '#0a0a0a' }: { size: number; ink?: string }) {
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} aria-label="Ivaronix mark">
      <path d="M 60 45 L 35 45 L 35 195 L 60 195" stroke={ink} strokeWidth={11} fill="none" strokeLinecap="square" />
      <path d="M 180 45 L 205 45 L 205 195 L 180 195" stroke={ink} strokeWidth={11} fill="none" strokeLinecap="square" />
      <text x={120} y={165} textAnchor="middle" fontFamily="Instrument Serif, Times New Roman, serif" fontStyle="italic" fontSize={140} fill={ink}>i</text>
      <circle cx={126} cy={65} r={11} fill="#16a34a" />
    </svg>
  );
}

/* ─── shared style objects ─────────────────────────────────────────── */
const italicAccent: React.CSSProperties = {
  fontFamily: T.serif,
  fontStyle: 'italic',
  fontWeight: 400,
};
const wrap = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  maxWidth: 1200,
  margin: '0 auto',
  padding: '0 clamp(20px, 4vw, 40px)',
  ...extra,
});
const inlineCode: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: '0.92em',
  background: T.paper,
  border: `1px solid ${T.line}`,
  borderRadius: 4,
  padding: '0 6px',
};
const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 40,
  padding: '0 20px',
  borderRadius: 999,
  fontFamily: T.sans,
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  border: '1px solid transparent',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: T.ink, color: '#fafaf7' };
const btnSecondary: React.CSSProperties = { ...btnBase, background: 'transparent', color: T.ink, borderColor: T.ink };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'transparent', color: T.muted, borderColor: 'transparent' };
