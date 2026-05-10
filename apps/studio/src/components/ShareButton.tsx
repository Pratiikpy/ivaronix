'use client';

import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'fallback' | 'error';

/**
 * Share button — copy URL + Twitter/X intent. Client-only because navigator
 * APIs require a browser. Per CLAUDE.md §9 voice rule (terse,
 * technical, no marketing sandwich) + the brand kit's `btn-ghost`
 * class.
 *
 * State machine (planning-003 §A.5.13 · WT 31):
 *   - idle     → "Copy URL"
 *   - copied   → "Copied ✓" (clipboard write succeeded)
 *   - fallback → "Tab opened — copy from URL bar →" (clipboard blocked,
 *                popup opened)
 *   - error    → "Couldn't copy — <truncated url>" (popup blocked too)
 *
 * Closes the silent-clipboard-failure dropoff on the receipt page's
 * viral-loop moment. Without this state machine, a clipboard failure
 * opened a tab silently while the button kept saying "Copy URL,"
 * leaving the user wondering whether anything happened.
 */
export function ShareButton({ url, text }: { url: string; text: string }) {
  const [state, setState] = useState<CopyState>('idle');

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), 1500);
      return;
    } catch {
      // Clipboard API blocked (HTTP origin, sandbox iframe, Safari ITP, etc.).
      // Fall through to the tab-open fallback.
    }

    try {
      const win = window.open(url, '_blank', 'noopener');
      if (win === null) throw new Error('popup blocked');
      setState('fallback');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const label =
    state === 'copied' ? 'Copied ✓'
    : state === 'fallback' ? 'Tab opened — copy from URL bar →'
    : state === 'error' ? `Couldn't copy — ${url.slice(0, 40)}…`
    : 'Copy URL';

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
      <button onClick={onCopy} className="btn-ghost" aria-live="polite">
        {label}
      </button>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost"
        aria-label="Share on X (Twitter)"
      >
        Share on X →
      </a>
    </span>
  );
}
