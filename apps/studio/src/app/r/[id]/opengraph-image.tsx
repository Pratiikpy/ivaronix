import { ImageResponse } from 'next/og';
import { unifiedGetReceipt, unifiedFindByReceiptRoot, getNetwork } from '@/lib/chain';
import { findLocalReceiptByRoot } from '@/lib/local-receipt';
import { loadBrandFont } from '@/lib/og-font';

export const runtime = 'nodejs';
// Stays on the Node runtime (not edge): the headline lookup imports ethers
// via @/lib/chain, which can't run on edge. A known Windows dev-server quirk
// mangles @vercel/og's bundled font URL ("file:\\C:\\…", ERR_INVALID_URL) on
// every request; production on Vercel (Linux) is unaffected, and unfurls work
// post-deploy. Also skips build-time prerender (font fetch + chain RPC at
// build time can fail in CI sandboxes; this route generates per-request).
export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * OG image generator for /r/<id>. Editorial cream-on-black with the
 * brackets-with-i mark + headline + receipt id. Used for Twitter/X cards
 * and link unfurls. Per CLAUDE.md §9 — never AI-glossy.
 */
export default async function Image({ params }: { params: { id: string } }) {
  const fonts = await loadBrandFont();
  if (fonts.length === 0) return new Response('OG image unavailable', { status: 503 });
  const network = getNetwork();
  let id = params.id;
  let headline = `Verified action receipt on 0G ${network}`;

  try {
    let onChain;
    if (/^\d+$/.test(params.id)) onChain = await unifiedGetReceipt(BigInt(params.id));
    else if (/^0x[0-9a-f]{64}$/i.test(params.id)) onChain = await unifiedFindByReceiptRoot(params.id as `0x${string}`);
    if (onChain) {
      id = onChain.id.toString();
      const local = findLocalReceiptByRoot(onChain.receiptRoot);
      if (local?.body.outputs?.wording?.headline) headline = local.body.outputs.wording.headline;
    }
  } catch { /* fall through to default */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fafaf7',
          color: '#0a0a0a',
          padding: '64px 80px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Canonical mark per CLAUDE.md §10 + brand/Ivaronix.html:
              brackets framing italic Instrument Serif "i" with green
              tittle (#16a34a). Replaces the prior vertical-line+black-dot
              variant that diverged from the brand kit. */}
          <svg width={48} height={32} viewBox="0 0 32 20" fill="none">
            <path d="M5 2 L1 2 L1 18 L5 18" stroke="#0a0a0a" strokeWidth={2.4} strokeLinejoin="miter" fill="none" />
            {/* italic-i stem · path-only (satori does not support <text> in SVG · B-V2-2 closure) */}
            <path d="M17 8 L15 16" stroke="#0a0a0a" strokeWidth={1.6} strokeLinecap="round" fill="none" />
            <circle cx={16.6} cy={4.6} r={1.6} fill="#16a34a" />
            <path d="M27 2 L31 2 L31 18 L27 18" stroke="#0a0a0a" strokeWidth={2.4} strokeLinejoin="miter" fill="none" />
          </svg>
          <span style={{ fontSize: 28, letterSpacing: 6, fontWeight: 600 }}>IVARONIX</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <span style={{ fontSize: 18, color: '#6b6b66', letterSpacing: 2, textTransform: 'uppercase' }}>
            § Receipt · #{id}
          </span>
          <span style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 600, maxWidth: 1000 }}>
            {headline.slice(0, 140)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24 }}>
          <span
            style={{
              padding: '8px 16px',
              border: '2px solid #16a34a',
              color: '#166534',
              background: '#dcfce7',
              fontSize: 16,
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontWeight: 600,
              borderRadius: 6,
            }}
          >
            VERIFIED ON 0G {network.toUpperCase()}
          </span>
          <span style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 16, color: '#6b6b66' }}>
            ivaronix.app
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts.length > 0 ? fonts : undefined,
    },
  );
}
