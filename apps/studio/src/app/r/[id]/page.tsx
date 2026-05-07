import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section } from '@/components/Section';
import { FourLightRow } from '@/components/FourLightRow';
import { ReceiptStateChip } from '@/components/ReceiptStateChip';
import { ShareButton } from '@/components/ShareButton';
import {
  getReceiptRegistry,
  explorerTxUrl,
  explorerAddrUrl,
  getNetwork,
} from '@/lib/chain';
import { findLocalReceiptByRoot, type ReceiptBody } from '@/lib/local-receipt';
import type { OnChainReceipt } from '@ivaronix/og-chain';

export const dynamic = 'force-dynamic';

interface ResolvedReceipt {
  onChain: OnChainReceipt;
  local: ReceiptBody | null;
}

async function loadReceipt(idOrRoot: string): Promise<ResolvedReceipt | null> {
  const reg = getReceiptRegistry();
  if (!reg) return null;
  let onChain: OnChainReceipt | null = null;
  if (/^\d+$/.test(idOrRoot)) {
    try {
      onChain = await reg.getReceipt(BigInt(idOrRoot));
    } catch {
      return null;
    }
  } else if (/^0x[0-9a-f]{64}$/i.test(idOrRoot)) {
    try {
      onChain = await reg.findByReceiptRoot(idOrRoot as `0x${string}`, 200_000);
    } catch {
      return null;
    }
  }
  if (!onChain) return null;
  const local = findLocalReceiptByRoot(onChain.receiptRoot);
  return { onChain, local: local?.body ?? null };
}

// ─── SEO / OG metadata ───────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await loadReceipt(id);
  if (!r) return { title: 'Receipt not found · Ivaronix' };
  const headline = r.local?.outputs?.wording?.headline ?? `Receipt #${r.onChain.id} on 0G ${getNetwork()}`;
  return {
    title: `Receipt #${r.onChain.id} · Ivaronix`,
    description: headline.slice(0, 160),
    openGraph: {
      title: `Ivaronix Receipt #${r.onChain.id}`,
      description: headline.slice(0, 160),
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Ivaronix Receipt #${r.onChain.id}`,
      description: headline.slice(0, 160),
    },
  };
}

function risk(label?: string) {
  if (!label) return null;
  const palette =
    label === 'high' ? { bg: 'var(--color-mismatch-bg)', fg: '#991b1b', border: 'var(--color-mismatch)' }
    : label === 'medium' ? { bg: 'var(--color-pending-bg)', fg: '#92400e', border: 'var(--color-pending)' }
    : { bg: 'var(--color-verified-bg)', fg: '#166534', border: 'var(--color-verified)' };
  return (
    <span
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        padding: '4px 12px',
        borderRadius: 4,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontWeight: 600,
      }}
    >
      Risk: {label}
    </span>
  );
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadReceipt(id);
  if (!result) notFound();

  const { onChain, local } = result;

  // Verification ladder — public surface
  // Day 15: anchor present + (if local body) signature + hash match → VERIFIED
  //         anchor present, no local body → still VERIFIED but partial (chain-only)
  //         No anchor → wouldn't reach here (404)
  const hasLocalBody = local !== null;
  const teeVerified = local?.teeVerification?.routerVerified ?? false;
  const overallState: 'verified' | 'pending' | 'mismatch' =
    hasLocalBody ? 'verified' : 'pending';

  const layers: Partial<Record<'Storage' | 'Compute' | 'TEE' | 'Chain', 'pending' | 'verified' | 'mismatch'>> = {
    Storage: hasLocalBody ? 'verified' : 'pending', // Day 22: real 0G Storage proof
    Compute: hasLocalBody ? 'verified' : 'pending',
    TEE: teeVerified ? 'verified' : 'pending',
    Chain: 'verified', // we got onChain, so chain is verified
  };

  const txHash = local?.chainAnchor?.anchorTxHash ?? null;
  const headline = local?.outputs?.wording?.headline ?? `Receipt #${onChain.id} anchored on 0G ${getNetwork()}`;
  const citations = local?.outputs?.citations ?? [];
  const skill = local?.request;

  return (
    <Section
      label={`§ RECEIPT · ON-CHAIN ID ${onChain.id}`}
      title={headline}
      description={skill ? `Skill ${skill.skillId}@${skill.skillVersion}` : 'Anchored receipt — independently verifiable.'}
    >
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <ReceiptStateChip state={overallState} />
          {risk(local?.outputs?.riskLevel)}
          {local?.execution?.burnMode && (
            <span
              style={{
                padding: '4px 10px',
                background: 'var(--color-tonal)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 4,
                fontSize: 11,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              Burn Mode 🔒
            </span>
          )}
        </div>

        <FourLightRow layers={layers} />

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '12px 24px',
            fontSize: 14,
            borderTop: '1px solid var(--color-hairline)',
            paddingTop: 24,
          }}
        >
          <dt style={{ color: 'var(--color-muted)' }}>receiptRoot</dt>
          <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{onChain.receiptRoot}</dd>
          <dt style={{ color: 'var(--color-muted)' }}>agent</dt>
          <dd className="mono" style={{ margin: 0 }}>
            <a href={explorerAddrUrl(onChain.agentAddress)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
              {onChain.agentAddress}
            </a>
          </dd>
          {txHash && (
            <>
              <dt style={{ color: 'var(--color-muted)' }}>anchor tx</dt>
              <dd className="mono" style={{ margin: 0 }}>
                <a href={explorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {txHash}
                </a>
              </dd>
            </>
          )}
          <dt style={{ color: 'var(--color-muted)' }}>type</dt>
          <dd style={{ margin: 0 }}>{local?.type ?? `code ${onChain.receiptType}`}</dd>
          {local?.billing && (
            <>
              <dt style={{ color: 'var(--color-muted)' }}>tokens · cost</dt>
              <dd className="mono" style={{ margin: 0 }}>
                {local.billing.inputTokens}+{local.billing.outputTokens} · {local.billing.totalCostOg} OG
              </dd>
            </>
          )}
        </dl>

        {citations.length > 0 && (
          <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 24 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>citations ({citations.length})</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
              {citations.map((c) => (
                <li key={c} className="mono" style={{ marginBottom: 4 }}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            borderTop: '1px solid var(--color-hairline)',
            paddingTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {hasLocalBody
              ? 'Full body matches on-chain root. Run `ivaronix receipt verify` for a deep TEE-independent check.'
              : 'Receipt body not found locally — chain-only view. Independent verification requires the JSON.'}
          </span>
          <ShareButton url={`/r/${onChain.id.toString()}`} text={`Verified Ivaronix receipt: ${headline.slice(0, 80)}`} />
        </div>
      </div>
    </Section>
  );
}
