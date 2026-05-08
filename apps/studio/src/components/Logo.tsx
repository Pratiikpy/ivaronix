/**
 * Brackets-with-italic-i mark — canonical per /brand and the standalone
 * Brand Kit (Vol.01). Two structural brackets framing an italic
 * Instrument Serif "i" whose tittle is replaced by a #16a34a green
 * pulse. The green dot is load-bearing — it signals "live", "currently
 * thinking." A black dot defeats the mark's whole purpose.
 *
 * Color is the canonical `#0a0a0a` ink (not the warmer `#1a1a1a` we
 * shipped on Day 13 — superseded by Brand Kit v1.0).
 *
 * Sizes: header (22-24px tall), nav (18px), hero (96px+).
 */
export function Logo({ size = 22, label = 'Ivaronix' }: { size?: number; label?: string }) {
  // 32×20 viewbox stays so existing layout math (size × 1.6 width) is
  // unchanged. Glyph is rendered as Instrument Serif italic; the green
  // circle is drawn ON TOP of the natural tittle to replace it.
  const w = Math.round(size * 1.6);
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      aria-label={label}
    >
      <svg
        width={w}
        height={size}
        viewBox="0 0 32 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Left bracket */}
        <path d="M5 2 L1 2 L1 18 L5 18" stroke="#0a0a0a" strokeWidth="2.4" strokeLinejoin="miter" fill="none" />
        {/* Italic "i" glyph (Instrument Serif) — natural tittle is covered
            by the green circle below */}
        <text
          x="16"
          y="16"
          textAnchor="middle"
          fontFamily="'Instrument Serif', Times New Roman, serif"
          fontStyle="italic"
          fontSize="20"
          fill="#0a0a0a"
        >
          i
        </text>
        {/* Green tittle replacing the natural one — the live pulse */}
        <circle cx="16.6" cy="4.6" r="1.6" fill="#16a34a" />
        {/* Right bracket */}
        <path d="M27 2 L31 2 L31 18 L27 18" stroke="#0a0a0a" strokeWidth="2.4" strokeLinejoin="miter" fill="none" />
      </svg>
      <span className="wordmark" style={{ fontSize: Math.round(size * 0.6) }}>
        Ivaronix
      </span>
    </span>
  );
}
