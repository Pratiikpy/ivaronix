import { ImageResponse } from 'next/og';
import { getReceiptRegistry, getNetwork } from '@/lib/chain';
import { findLocalReceiptByRoot } from '@/lib/local-receipt';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * OG image generator for /r/<id>. Editorial cream-on-black with the
 * brackets-with-i mark + headline + receipt id. Used for Twitter/X cards
 * and link unfurls. Per UI_UX_GUIDE — never AI-glossy.
 */
export default async function Image({ params }: { params: { id: string } }) {
  const reg = getReceiptRegistry();
  const network = getNetwork();
  let id = params.id;
  let headline = `Verified action receipt on 0G ${network}`;

  if (reg) {
    try {
      let onChain;
      if (/^\d+$/.test(params.id)) onChain = await reg.getReceipt(BigInt(params.id));
      else if (/^0x[0-9a-f]{64}$/i.test(params.id)) onChain = await reg.findByReceiptRoot(params.id as `0x${string}`, 200_000);
      if (onChain) {
        id = onChain.id.toString();
        const local = findLocalReceiptByRoot(onChain.receiptRoot);
        if (local?.body.outputs?.wording?.headline) headline = local.body.outputs.wording.headline;
      }
    } catch { /* fall through to default */ }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#faf9f6',
          color: '#1a1a1a',
          padding: '64px 80px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width={48} height={32} viewBox="0 0 32 20" fill="none">
            <path d="M4 2 H1 V18 H4" stroke="#1a1a1a" strokeWidth={3} fill="none" />
            <line x1={16} y1={6} x2={16} y2={17} stroke="#1a1a1a" strokeWidth={3} strokeLinecap="round" />
            <circle cx={16} cy={3} r={2} fill="#1a1a1a" />
            <path d="M28 2 H31 V18 H28" stroke="#1a1a1a" strokeWidth={3} fill="none" />
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
      // Skip the bundled @vercel/og font — Next 15.0.3 mangles its file URL
      // on Windows (".\\file:\\C:\\..."). System-stack fallback is fine for the
      // editorial design language and Vercel-side prod still uses bundled fonts.
      fonts: [],
    },
  );
}
