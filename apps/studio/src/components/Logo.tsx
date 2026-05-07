/**
 * Brackets-with-i mark, per UI_UX_GUIDE §3.
 * Uses the strong near-black (#1a1a1a), not pure black — the warm tone
 * is part of the editorial feel.
 *
 * Sizes: header (compact, 22px tall), nav (compact, 18px), hero (large, 96px+).
 */
export function Logo({ size = 22, label = 'Ivaronix' }: { size?: number; label?: string }) {
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
        <path d="M4 2 H1 V18 H4" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="miter" fill="none" />
        {/* The 'i' — italic stroke + dot */}
        <line x1="16" y1="6" x2="16" y2="17" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="3" r="1.5" fill="#1a1a1a" />
        {/* Right bracket */}
        <path d="M28 2 H31 V18 H28" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="miter" fill="none" />
      </svg>
      <span className="wordmark" style={{ fontSize: Math.round(size * 0.6) }}>
        Ivaronix
      </span>
    </span>
  );
}
