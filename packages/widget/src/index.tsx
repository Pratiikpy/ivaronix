import * as React from 'react';

/**
 * Embeddable Ivaronix receipt verifier (planning-01 §3D · planning-003 §A.5.22).
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
 *     src="https://www.ivaronix.xyz/embed.js"
 *     data-receipt-id="1004"
 *   ></script>
 *
 * Origin resolution (planning-003 §A.5.22):
 *   1. Explicit `origin` prop — wins. Used by self-hosters and local dev.
 *   2. `process.env.IVARONIX_STUDIO_BASE` (build-time) — set on the
 *      embedding host to point all widgets at a custom Studio deploy.
 *   3. `DEFAULT_ORIGIN` — Vercel preview URL until the custom domain
 *      lands per USER_TODO §C-3. Switch to `https://ivaronix.app` in
 *      the same commit that flips the DNS.
 *
 * Notes:
 * - The iframe is sized to 100% × 420px by default with maxWidth 600px
 *   so it slots into a typical content column without overflowing.
 * - `referrerPolicy="no-referrer"` keeps the embedding page's URL out
 *   of the iframe's request log.
 * - On iframe-load failure (network, CORS, NXDOMAIN) the widget falls
 *   back to a plain `<a>` link to the same /r/<id> URL so a broken
 *   embed still gets the user to the canonical proof page.
 */
export interface ReceiptVerifierProps {
  /** Receipt id (numeric) or receiptRoot (0x…64 hex). */
  id: string | number;
  /** Studio origin. Default: build-time env override or Vercel preview URL. */
  origin?: string;
  /** Width — number → px, string → passed through. Default 100%. */
  width?: number | string;
  /** Height — number → px, string → passed through. Default 420. */
  height?: number | string;
  /** Optional title attribute (a11y). Default "Ivaronix receipt #<id>". */
  title?: string;
  /** Inline style escape hatch — merged into the iframe. */
  style?: React.CSSProperties;
  /**
   * Custom error fallback. Receives the resolved canonical /r/<id>
   * URL. Default: a small inline card with a "View receipt" link.
   */
  fallback?: (canonicalUrl: string) => React.ReactNode;
}

/**
 * Read the build-time env override safely. `process.env` access is
 * stripped from browser bundlers like esbuild/webpack via DefinePlugin
 * when the embedding app sets IVARONIX_STUDIO_BASE; otherwise this
 * returns undefined and we fall through to DEFAULT_ORIGIN.
 */
function envOrigin(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (globalThis as any)?.process?.env;
    const v = env?.IVARONIX_STUDIO_BASE;
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

const DEFAULT_ORIGIN = 'https://www.ivaronix.xyz';

function resolveOrigin(explicit?: string): string {
  return explicit ?? envOrigin() ?? DEFAULT_ORIGIN;
}

function dim(v: number | string | undefined, fallback: string): string {
  if (v === undefined) return fallback;
  if (typeof v === 'number') return `${v}px`;
  if (/^\d+$/.test(v)) return `${v}px`;
  return v;
}

function defaultFallback(canonicalUrl: string): React.ReactElement {
  return (
    <a
      href={canonicalUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-block',
        padding: '12px 16px',
        border: '1px solid #d4d4d4',
        borderRadius: 10,
        background: '#FAFAF7',
        color: '#0A0A0A',
        textDecoration: 'none',
        fontFamily: 'Outfit, system-ui, sans-serif',
        fontSize: 14,
      }}
    >
      View Ivaronix receipt →
    </a>
  );
}

export function ReceiptVerifier(props: ReceiptVerifierProps): React.ReactElement {
  const { id, origin, width, height, title, style, fallback } = props;
  const resolvedOrigin = resolveOrigin(origin);
  const base = resolvedOrigin.replace(/\/$/, '');
  const embedUrl = `${base}/embed/r/${encodeURIComponent(String(id))}`;
  const canonicalUrl = `${base}/r/${encodeURIComponent(String(id))}`;
  const titleText = title ?? `Ivaronix receipt #${id}`;

  const [errored, setErrored] = React.useState(false);

  if (errored) {
    return <>{(fallback ?? defaultFallback)(canonicalUrl)}</>;
  }

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
      src={embedUrl}
      title={titleText}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      style={merged}
    />
  );
}

export default ReceiptVerifier;
