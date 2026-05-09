import * as React from 'react';

/**
 * Embeddable Ivaronix receipt verifier (planning-01 §3D).
 *
 * Renders an iframe pointing at the public Studio's /embed/r/<id> route.
 * The iframe shows the receipt's tier badge, headline, anchor tx hash,
 * and a "view full receipt" CTA back to the canonical Studio surface.
 *
 * Usage:
 *   import { ReceiptVerifier } from '@ivaronix/widget';
 *   <ReceiptVerifier id="1004" />
 *
 * Vanilla HTML alternative:
 *   <script
 *     src="https://ivaronix.studio/embed.js"
 *     data-receipt-id="1004"
 *   ></script>
 *
 * Notes:
 * - Defaults to the public production origin. Override via `origin` prop
 *   for local Studio dev (`http://localhost:3300`) or a self-hosted
 *   Studio deployment.
 * - The iframe is sized to 100% × 420px by default with maxWidth 600px
 *   so it slots into a typical content column without overflowing.
 * - `referrerPolicy="no-referrer"` keeps the embedding page's URL out of
 *   the iframe's request log.
 */
export interface ReceiptVerifierProps {
  /** Receipt id (numeric) or receiptRoot (0x…64 hex). */
  id: string | number;
  /** Studio origin. Default: production. */
  origin?: string;
  /** Width — number → px, string → passed through. Default 100%. */
  width?: number | string;
  /** Height — number → px, string → passed through. Default 420. */
  height?: number | string;
  /** Optional title attribute (a11y). Default "Ivaronix receipt #<id>". */
  title?: string;
  /** Inline style escape hatch — merged into the iframe. */
  style?: React.CSSProperties;
}

const DEFAULT_ORIGIN = 'https://ivaronix.studio';

function dim(v: number | string | undefined, fallback: string): string {
  if (v === undefined) return fallback;
  if (typeof v === 'number') return `${v}px`;
  if (/^\d+$/.test(v)) return `${v}px`;
  return v;
}

export function ReceiptVerifier(props: ReceiptVerifierProps): React.ReactElement {
  const { id, origin = DEFAULT_ORIGIN, width, height, title, style } = props;
  const url = `${origin.replace(/\/$/, '')}/embed/r/${encodeURIComponent(String(id))}`;
  const titleText = title ?? `Ivaronix receipt #${id}`;
  const merged: React.CSSProperties = {
    border: 0,
    width: dim(width, '100%'),
    height: dim(height, '420px'),
    maxWidth: 600,
    display: 'block',
    ...style,
  };
  return (
    <iframe
      src={url}
      title={titleText}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={merged}
    />
  );
}

export default ReceiptVerifier;
