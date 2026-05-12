import { ImageResponse } from 'next/og';
import { getNetwork } from '@/lib/chain';
import { loadBrandFont } from '@/lib/og-font';

export const runtime = 'nodejs';
// Skip static prerender at build time — the loadFonts() helper does
// runtime fetches against fonts.googleapis.com that can fail in CI
// sandboxes without network. OG images are short-lived and re-rendered
// on every request anyway when a social-card unfurl hits this route.
// Sweep 67 fix · was failing `next build` with TypeError: Invalid URL.
export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * OG image for /0g (the 0G primitive depth-proof page · planning-003 §A.5.17).
 *
 * Renders a 6-cell module grid (Chain · Compute · Storage · DA · Router ·
 * Agent ID) on the cream-on-black brand surface so a Twitter / Slack /
 * Telegram share unfurls into a "we use these 0G modules · here are the
 * contract addresses" preview rather than the default Vercel image.
 *
 * Closes planning-003 §A.5.5 partial scope — the per-receipt image was
 * already shipped under /r/[id]; this one extends OG-image coverage to
 * the most-shared page in Studio.
 */
export default async function Image() {
  const fonts = await loadBrandFont();
  if (fonts.length === 0) return new Response('OG image unavailable', { status: 503 });
  const network = getNetwork();

  const modules: Array<{ name: string; status: 'live' | 'partial' | 'roadmap'; tagline: string }> = [
    { name: '0G Chain', status: 'live', tagline: 'Receipts anchor here' },
    { name: '0G Compute', status: 'live', tagline: 'TEE-attested inference' },
    { name: '0G Storage', status: 'live', tagline: 'Burn-mode encrypted blobs' },
    { name: '0G Router', status: 'live', tagline: 'OpenAI-compat front for Compute' },
    { name: '0G Agent ID', status: 'live', tagline: 'ERC-7857 Agent Passport' },
    { name: '0G DA', status: 'roadmap', tagline: 'Receipt batching · queued' },
  ];
  const liveCount = modules.filter((m) => m.status === 'live').length;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#fafaf7',
          color: '#0a0a0a',
          padding: '56px 72px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width={48} height={32} viewBox="0 0 32 20" fill="none">
              <path d="M5 2 L1 2 L1 18 L5 18" stroke="#0a0a0a" strokeWidth={2.4} strokeLinejoin="miter" fill="none" />
              {/* italic-i stem · path-only (satori does not support <text> in SVG · B-V2-2 closure) */}
              <path d="M17 8 L15 16" stroke="#0a0a0a" strokeWidth={1.6} strokeLinecap="round" fill="none" />
              <circle cx={16.6} cy={4.6} r={1.6} fill="#16a34a" />
              <path d="M27 2 L31 2 L31 18 L27 18" stroke="#0a0a0a" strokeWidth={2.4} strokeLinejoin="miter" fill="none" />
            </svg>
            <span style={{ fontSize: 26, letterSpacing: 6, fontWeight: 600 }}>IVARONIX</span>
          </div>
          <span style={{ fontSize: 14, color: '#6b6b66', letterSpacing: 2, textTransform: 'uppercase' }}>
            § Built on 0G · {network}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
          <span style={{ fontSize: 52, lineHeight: 1.05, fontWeight: 600, letterSpacing: -1 }}>
            The 0G modules we use,
          </span>
          <span style={{ fontSize: 36, lineHeight: 1.1, fontWeight: 400, color: '#6b6b66', fontStyle: 'italic' }}>
            and what each one carries.
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: 14,
            flex: 1,
          }}
        >
          {modules.map((m) => (
            <div
              key={m.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: 20,
                background: '#ffffff',
                border: '1px solid #d4d4d4',
                borderRadius: 14,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 600 }}>{m.name}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 14, color: '#6b6b66' }}>{m.tagline}</span>
                <span
                  style={{
                    alignSelf: 'flex-start',
                    padding: '2px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    borderRadius: 4,
                    border: m.status === 'live' ? '1px solid #26c050' : '1px solid #d4d4d4',
                    background: m.status === 'live' ? '#e6f9ec' : '#f5f5f0', // brand-check:allow:OG status-pill tints — satori SVG can't reference CSS vars
                    color: m.status === 'live' ? '#0e6428' : '#6b6b66',
                  }}
                >
                  {m.status === 'live' ? 'INTEGRATED' : 'ROADMAP'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24 }}>
          <span style={{ fontSize: 16, color: '#6b6b66' }}>
            {liveCount}/6 modules integrated · contract addresses + chainscan links on /0g
          </span>
          <span style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 16, color: '#6b6b66' }}>
            ivaronix.app/0g
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
