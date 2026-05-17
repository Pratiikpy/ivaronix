'use client';

import { useState } from 'react';

/**
 * Click-to-copy code snippet for /docs and other surfaces where judges
 * need to grab install / verify commands quickly. Same UX pattern as
 * ShareButton (terse · technical · aria-live for screen readers) but
 * tailored for monospace code blocks.
 *
 * State machine:
 *   - idle     → "Copy" button visible in top-right corner of the snippet
 *   - copied   → "Copied ✓" (clipboard write succeeded)
 *   - error    → "Couldn't copy — select manually" (clipboard blocked)
 *
 * Why this surface matters: pre-fix, /docs rendered 8 <pre> blocks with no
 * affordance to copy. Judges had to mouse-select the text. The `pnpm
 * ivaronix receipt verify 135 --network mainnet --tee-independent` command
 * is the load-bearing demo — a one-click copy makes it actually frictionless.
 */
export function CopyableSnippet({ code, label }: { code: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState('copied');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const btnLabel =
    state === 'copied' ? 'Copied ✓'
    : state === 'error' ? "Couldn't copy"
    : 'Copy';

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <div style={{ fontSize: 12, color: 'var(--color-muted)', letterSpacing: '0.5px', marginBottom: 6 }}>
          {label}
        </div>
      )}
      <pre
        style={{
          margin: 0,
          padding: '10px 44px 10px 12px', // right padding leaves room for the Copy button
          background: 'var(--color-tonal)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.55,
          overflowX: 'auto',
          whiteSpace: 'pre',
          color: 'var(--color-fg)',
        }}
      >
        {code}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-live="polite"
        aria-label={state === 'copied' ? 'Copied to clipboard' : `Copy snippet: ${code.slice(0, 40)}`}
        style={{
          position: 'absolute',
          top: label ? 22 : 4,
          right: 4,
          padding: '4px 10px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          background: state === 'copied' ? 'var(--color-verified-bg)' : 'var(--color-card)',
          color: state === 'copied' ? 'var(--color-verified)' : 'var(--color-fg)',
          border: `1px solid ${state === 'copied' ? 'var(--color-verified)' : 'var(--color-hairline)'}`,
          borderRadius: 4,
          cursor: 'pointer',
          letterSpacing: '0.5px',
          transition: 'background-color 160ms ease',
        }}
      >
        {btnLabel}
      </button>
    </div>
  );
}
