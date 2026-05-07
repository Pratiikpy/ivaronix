'use client';

import { useState } from 'react';

/**
 * Share button — copy URL + Twitter/X intent. Client-only because navigator
 * APIs require a browser. Per UI_UX_GUIDE: ghost button, no flash.
 */
export function ShareButton({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: open the URL in a new tab so the user can copy manually
      window.open(url, '_blank', 'noopener');
    }
  };

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
      <button onClick={onCopy} className="btn-ghost" aria-live="polite">
        {copied ? 'Copied ✓' : 'Copy URL'}
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
