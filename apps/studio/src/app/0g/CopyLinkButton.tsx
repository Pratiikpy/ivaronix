'use client';

import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'fallback' | 'error';

/**
 * Small client island for the /0g page. Copies the canonical /0g URL
 * to the clipboard so a reviewer can paste it into a chat / pitch deck
 * without selecting the address bar.
 *
 * Closes planning-003 §A.5.17 ("add a copy-link button" so the URL
 * becomes the canonical 0G primitive depth proof). Uses the same
 * four-state machine as `ShareButton` (planning-003 §A.5.13) — clipboard
 * failures don't fall silently.
 */
export function CopyLinkButton() {
  const [state, setState] = useState<CopyState>('idle');

  const onCopy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), 1500);
      return;
    } catch {
      // Clipboard API blocked. Fall through to selection-based fallback.
    }

    try {
      // Final fallback: select the URL bar instructionally.
      window.prompt('Copy this URL:', url);
      setState('fallback');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const label =
    state === 'copied' ? 'Copied ✓'
    : state === 'fallback' ? 'See prompt above'
    : state === 'error' ? "Couldn't copy — select URL bar"
    : 'Copy link →';

  return (
    <button
      onClick={onCopy}
      className="btn-ghost"
      aria-live="polite"
      style={{ fontSize: 13, padding: '6px 12px' }}
    >
      {label}
    </button>
  );
}
