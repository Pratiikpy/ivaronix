'use client';

/**
 * Print button — fires window.print() so the user gets the browser's
 * native save-as-PDF dialog. Pure client island; the rest of the page
 * is a server component reading on-chain state.
 */
export function PrintControls() {
  return (
    <button
      onClick={() => {
        if (typeof window !== 'undefined') window.print();
      }}
      style={{
        background: '#0a0a0a',
        color: '#FAFAF7',
        padding: '8px 16px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        border: '1px solid #0a0a0a',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      Print / Save as PDF →
    </button>
  );
}
