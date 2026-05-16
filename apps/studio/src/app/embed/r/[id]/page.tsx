import type { Metadata } from 'next';
import { JsonRpcProvider } from 'ethers';
import {
  unifiedGetReceipt,
  unifiedFindByReceiptRoot,
  explorerTxUrl,
  getNetwork,
  receiptTypeLabel,
  type UnifiedReceipt,
} from '@/lib/chain';
import { findLocalReceiptByRoot } from '@/lib/local-receipt';
import { verifyClaimed } from '@ivaronix/receipts';

export const dynamic = 'force-dynamic';

// Bug-27 long-tail (2026-05-16): the embed layout sets a static
// `title: 'Ivaronix Receipt'` that applies even when the receipt
// doesn't exist. A judge pasting /embed/r/<bad> in an iframe-using
// site sees "Ivaronix Receipt" tab title even though the body says
// "RECEIPT · NOT FOUND". Per-page generateMetadata overrides the
// layout metadata so the title matches the actual state.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Receipt #${id} · Ivaronix embed`,
    description: 'Embeddable receipt verifier — anchored on 0G Chain.',
  };
}

/**
 * Iframe-friendly receipt summary (planning-01 §3D).
 *
 * No header, no footer, no nav. Light cream background that matches the
 * brand palette. Designed to be dropped on any third-party page via:
 *
 *   <iframe
 *     src="https://www.ivaronix.xyz/embed/r/1004"
 *     style="border:0;width:100%;height:320px"
 *   />
 *
 * Or via the `<script src="/embed.js" data-receipt-id="1004"></script>`
 * one-liner that auto-creates the iframe.
 *
 * Renders only on-chain-verifiable facts. No client connection, no
 * cookies, no analytics. The judge sees Ivaronix on a third-party site
 * exactly the way the third-party visitor sees it.
 */
export default async function EmbedReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const network = getNetwork();
  // Resolve the canonical full-receipt origin (matches layout.tsx
  // metadataBase fallback chain). Pre-iter-103 the "View full
  // receipt" button hardcoded 'https://ivaronix.studio/r/<id>' which
  // is a dead domain — the click landed on DNS NXDOMAIN.
  const studioOrigin =
    process.env.NEXT_PUBLIC_BASE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    ?? 'http://localhost:3300';

  let onChain: UnifiedReceipt | null = null;
  try {
    if (/^\d+$/.test(id)) {
      onChain = await unifiedGetReceipt(BigInt(id));
    } else if (/^0x[0-9a-f]{64}$/i.test(id)) {
      onChain = await unifiedFindByReceiptRoot(id as `0x${string}`);
    }
  } catch { /* fall through to not-found */ }

  if (!onChain) {
    return (
      <main style={containerStyle}>
        <div style={cardStyle}>
          <div style={eyebrowStyle}>RECEIPT · NOT FOUND</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
            No receipt with id <code>{id}</code> on {network}.
          </p>
        </div>
      </main>
    );
  }

  const local = findLocalReceiptByRoot(onChain.receiptRoot)?.body ?? null;
  const headline = local?.outputs?.wording?.headline ?? `Receipt #${onChain.id} on 0G ${network}`;
  const tee = local?.teeVerification;

  // Sweep 175: mirror /r/[id]'s I-1 gate on the embed surface. Pre-sweep,
  // the FULLY VERIFIED chip read tee.routerVerified + tee.independentVerified
  // straight off the local body — both flags are tamper-editable on a
  // local JSON file. A malicious operator could flip both to true and
  // the embed iframe would lie green to any third-party host page.
  //
  // The fix mirrors apps/studio/src/app/r/[id]/page.tsx:178-185: call
  // verifyClaimed() on the local body and require it returns CLAIMED
  // before honoring the tee flags. Tampered body → CLAIMED check fails
  // (signature mismatch or canonical-hash mismatch) → chip falls back
  // to ANCHORED (on-chain anchor still real) instead of FULLY VERIFIED.
  let localValid = false;
  if (local) {
    try {
      const r = verifyClaimed(local);
      localValid = r.state === 'CLAIMED';
    } catch { localValid = false; }
  }
  const isFullyVerified = localValid && tee?.routerVerified === true && tee?.independentVerified === true;
  const isAnchored = !!onChain;
  const tierLabel: 'TIER 1 · TEE' | 'TIER 2 · EXTERNAL' | 'ANCHORED' =
    tee?.verificationMethod === 'router_flag' || tee?.verificationMethod === 'compute_sdk_process_response'
      ? 'TIER 1 · TEE'
      : tee?.verificationMethod === 'external-signed'
      ? 'TIER 2 · EXTERNAL'
      : 'ANCHORED';
  const isExternal = tierLabel === 'TIER 2 · EXTERNAL';
  const txHash = local?.chainAnchor?.anchorTxHash;
  const skillLabel = local?.request?.skillId ?? receiptTypeLabel(onChain.receiptType);

  return (
    <main style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={eyebrowStyle}>IVARONIX RECEIPT</div>
          <span
            style={{
              fontFamily: 'var(--font-mono, ui-monospace)',
              fontSize: 10,
              padding: '2px 8px',
              border: '1px solid',
              borderRadius: 4,
              background: isFullyVerified ? '#e6f9ec' : isAnchored ? '#fff7d6' : '#f3eaea',
              borderColor: isFullyVerified ? '#26c050' : isAnchored ? '#e8c800' : '#b94a4a',
              color: isFullyVerified ? '#0e6428' : isAnchored ? '#7a5d00' : '#5d1a1a',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
            }}
          >
            {isFullyVerified ? 'FULLY VERIFIED ✓' : isAnchored ? 'ANCHORED' : 'CLAIMED'}
          </span>
        </div>

        <h1 style={titleStyle}>
          #{onChain.id} · {skillLabel}
        </h1>
        <p style={headlineStyle}>{headline.slice(0, 200)}{headline.length > 200 ? '…' : ''}</p>

        <div style={detailGridStyle}>
          <span style={detailLabelStyle}>Tier</span>
          <span style={{ ...detailValueStyle, color: isExternal ? '#7a5d00' : 'inherit' }}>{tierLabel}</span>
          <span style={detailLabelStyle}>Network</span>
          <span style={detailValueStyle}>{network}</span>
          {txHash && (
            <>
              <span style={detailLabelStyle}>Anchor tx</span>
              <a
                href={explorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...detailValueStyle, color: '#0a0a0a', textDecoration: 'underline' }}
              >
                {txHash.slice(0, 10)}…{txHash.slice(-8)} ↗
              </a>
            </>
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            href={`${studioOrigin}/r/${onChain.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={primaryButtonStyle}
          >
            View full receipt →
          </a>
          {txHash && (
            <a
              href={explorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              style={secondaryButtonStyle}
            >
              On chainscan ↗
            </a>
          )}
        </div>

        <p style={{ margin: '12px 0 0', fontSize: 10, color: '#888', textAlign: 'right' }}>
          Verified by Ivaronix · the receipt is the spine
        </p>
      </div>
    </main>
  );
}

const containerStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  background: 'transparent',
  fontFamily: 'var(--font-sans, "Outfit", -apple-system, BlinkMacSystemFont, system-ui, sans-serif)',
  color: '#0a0a0a',
};

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(10, 10, 10, 0.10)',
  borderRadius: 14,
  background: '#FAFAF7',
  padding: 20,
  boxShadow: '0 1px 3px rgba(10, 10, 10, 0.04)',
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace)',
  fontSize: 10,
  letterSpacing: '1.5px',
  color: '#6b6b6b',
  textTransform: 'uppercase',
  fontWeight: 600,
};

const titleStyle: React.CSSProperties = {
  margin: '12px 0 8px',
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '-0.4px',
  lineHeight: 1.2,
};

const headlineStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: 13,
  lineHeight: 1.5,
  color: '#444',
};

const detailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '6px 16px',
  fontSize: 12,
  paddingTop: 12,
  borderTop: '1px solid rgba(10, 10, 10, 0.06)',
};

const detailLabelStyle: React.CSSProperties = {
  color: '#6b6b6b',
};

const detailValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace)',
};

const primaryButtonStyle: React.CSSProperties = {
  background: '#0a0a0a',
  color: '#FAFAF7',
  padding: '6px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
  border: '1px solid #0a0a0a',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#0a0a0a',
  padding: '6px 14px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
  border: '1px solid rgba(10, 10, 10, 0.20)',
};
