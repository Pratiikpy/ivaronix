import { ImageResponse } from 'next/og';
import { getNetwork } from '@/lib/chain';
import { loadBrandFont } from '@/lib/og-font';

export const runtime = 'nodejs';
// Skip build-time prerender — see /0g/opengraph-image for rationale.
export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Default OG image — Studio's home page + every route without its own
 * `opengraph-image.tsx`. Editorial cream-on-black with the brackets-with-i
 * mark, the headline, and a four-light proof row that mirrors the chip
 * Studio renders inline. Per CLAUDE.md §10 — no AI gloss, no marketing
 * sandwich.
 *
 * Closes planning-003 §A.5.5: every shared `/`, `/skills`, `/onboard`,
 * `/agents` link previously rendered the default Vercel image. The
 * per-route OG images at `/r/[id]/` and `/0g/` ship separately.
 */
export default async function Image() {
  const fonts = await loadBrandFont();
  if (fonts.length === 0) return new Response('OG image unavailable', { status: 503 });
  const network = getNetwork();

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
          <svg width={48} height={32} viewBox="0 0 32 20" fill="none">
            <path d="M5 2 L1 2 L1 18 L5 18" stroke="#0a0a0a" strokeWidth={2.4} strokeLinejoin="miter" fill="none" />
            <text x={16} y={16} textAnchor="middle" fontFamily="'Instrument Serif', 'Times New Roman', serif" fontStyle="italic" fontSize={20} fill="#0a0a0a">i</text>
            <circle cx={16.6} cy={4.6} r={1.6} fill="#16a34a" />
            <path d="M27 2 L31 2 L31 18 L27 18" stroke="#0a0a0a" strokeWidth={2.4} strokeLinejoin="miter" fill="none" />
          </svg>
          <span style={{ fontSize: 28, letterSpacing: 6, fontWeight: 600 }}>IVARONIX</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 16, color: '#6b6b66', letterSpacing: 2, textTransform: 'uppercase' }}>
            § AI review · Verifiable receipts · 0G
          </span>
          <span style={{ fontSize: 76, lineHeight: 1.0, fontWeight: 600, letterSpacing: -2, maxWidth: 1040 }}>
            Catch the risks.
          </span>
          <span style={{ fontSize: 76, lineHeight: 1.0, fontWeight: 400, fontStyle: 'italic', color: '#6b6b66', letterSpacing: -1 }}>
            Keep the receipts.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Four-light row mirroring the Studio chip */}
            {(['Compute', 'Chain', 'Storage', 'Memory'] as const).map((label) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: 8,
                  background: '#ffffff',
                  fontSize: 13,
                  color: '#0a0a0a',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#16a34a', display: 'block' }} />
                {label}
              </div>
            ))}
          </div>
          <span style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 16, color: '#6b6b66' }}>
            on 0G {network}
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
