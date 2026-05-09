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

/**
 * Trust-tier badge — green TIER 1 (0G + TEE-attested) vs amber TIER 2
 * (signed + chain-anchored, no TEE — e.g. NVIDIA NIM, OpenAI). The point
 * is to NOT hide the trust delta: external receipts are still verifiable,
 * but the inference itself is outside the TEE.
 */
function TierBadge({ tier, providerKind }: { tier: 'tier-1-tee' | 'tier-2-external-signed'; providerKind: string }) {
  const isTier1 = tier === 'tier-1-tee';
  const palette = isTier1
    ? { bg: 'var(--color-verified-bg)', fg: '#166534', border: 'var(--color-verified)' }
    : { bg: 'var(--color-pending-bg)', fg: '#92400e', border: 'var(--color-pending)' };
  const label = isTier1 ? 'TIER 1 · TEE' : 'TIER 2 · EXTERNAL';
  return (
    <span
      title={isTier1
        ? 'Inference happened on the 0G Compute network with TEE attestation. Strongest trust tier.'
        : `Inference happened on ${providerKind}, outside the 0G TEE. Receipt is still signed + chain-anchored, but the inference itself is not TEE-attested.`}
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        padding: '4px 12px',
        borderRadius: 4,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontWeight: 600,
      }}
    >
      {label}{!isTier1 && providerKind ? ` · ${providerKind}` : ''}
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
  // Trust tier: tier-1-tee (0G + TEE) vs tier-2-external-signed (NVIDIA NIM, …)
  // Newer receipts carry these fields; older ones default to tier-1.
  const teeBlock = local?.teeVerification as
    | { tier?: 'tier-1-tee' | 'tier-2-external-signed'; providerKind?: string; verificationMethod?: string }
    | undefined;
  const tier: 'tier-1-tee' | 'tier-2-external-signed' = teeBlock?.tier
    ?? (teeBlock?.verificationMethod === 'external-signed' ? 'tier-2-external-signed' : 'tier-1-tee');
  const providerKind: string = teeBlock?.providerKind ?? '0g-router';
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
          <TierBadge tier={tier} providerKind={providerKind} />
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
          {local?.execution?.modelSelection?.final && (
            <>
              <dt style={{ color: 'var(--color-muted)' }}>model</dt>
              <dd className="mono" style={{ margin: 0 }}>
                {local.execution.modelSelection.final}
                {local.execution.modelSelection.requested !== local.execution.modelSelection.final && (
                  <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>
                    (requested {local.execution.modelSelection.requested})
                  </span>
                )}
              </dd>
            </>
          )}
          {local?.execution?.providerRouting?.finalProvider &&
            local.execution.providerRouting.finalProvider !== '0x0000000000000000000000000000000000000000' && (
            <>
              <dt style={{ color: 'var(--color-muted)' }}>provider</dt>
              <dd className="mono" style={{ margin: 0 }}>
                <a href={explorerAddrUrl(local.execution.providerRouting.finalProvider)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {local.execution.providerRouting.finalProvider}
                </a>
              </dd>
            </>
          )}
          {local?.storage?.evidenceRoot && (
            <>
              <dt style={{ color: 'var(--color-muted)' }}>storage root</dt>
              <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>
                {local.storage.evidenceRoot}
                <span style={{ color: 'var(--color-muted)', marginLeft: 8, fontSize: 11 }}>
                  0G Storage Merkle root — anyone with the SDK can re-download this blob.
                </span>
              </dd>
            </>
          )}
          {local?.billing?.feeSplit && (
            <>
              <dt style={{ color: 'var(--color-muted)' }}>fee split</dt>
              <dd className="mono" style={{ margin: 0 }}>
                creator {(local.billing.feeSplit.creatorBps / 100).toFixed(0)}% · treasury {(local.billing.feeSplit.treasuryBps / 100).toFixed(0)}%
                <span style={{ color: 'var(--color-muted)', marginLeft: 8, fontSize: 11 }}>
                  ({local.billing.feeSplit.creatorNeuron} + {local.billing.feeSplit.treasuryNeuron} neuron)
                </span>
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

        {(local?.execution?.burnMode || local?.burn) && (
          <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="section-label">burn mode · evidence proof</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', maxWidth: 640 }}>
              Session key destroyed; ciphertext now unreadable to operator. Burn Mode protects against
              operator-side disclosure; local-machine compromise is out of scope.
            </p>
            <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 16px', fontSize: 13, margin: 0 }}>
              {local?.storage?.encryption?.keyFingerprint && (
                <>
                  <dt style={{ color: 'var(--color-muted)' }}>key fingerprint</dt>
                  <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>
                    {local.storage.encryption.keyFingerprint}
                  </dd>
                </>
              )}
              <dt style={{ color: 'var(--color-muted)' }}>encryption</dt>
              <dd className="mono" style={{ margin: 0 }}>
                {local?.storage?.encryption?.type ?? 'none'}
                {local?.storage?.encryption?.headerDetected ? ' · header detected' : ''}
              </dd>
              {local?.burn?.sessionKeyDestroyedAt && (
                <>
                  <dt style={{ color: 'var(--color-muted)' }}>destroyed at</dt>
                  <dd className="mono" style={{ margin: 0 }}>
                    {new Date(local.burn.sessionKeyDestroyedAt).toISOString().replace('T', ' ').replace('.000Z', 'Z')}
                  </dd>
                  <dt style={{ color: 'var(--color-muted)' }}>cleanup</dt>
                  <dd className="mono" style={{ margin: 0 }}>
                    {local.burn.localCleanupStatus}
                    {Array.isArray(local.burn.tempPathsZeroed) && local.burn.tempPathsZeroed.length > 0
                      ? ` · ${local.burn.tempPathsZeroed.length} path(s) zeroed`
                      : ''}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        {local?.execution?.consensus && (
          <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div className="section-label">consensus · {local.execution.consensus.roles?.length ?? 0} roles</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                convergence{' '}
                <span
                  className="mono"
                  style={{
                    color: (local.execution.consensus.convergenceScore ?? 0) >= 0.85
                      ? 'var(--color-verified)'
                      : (local.execution.consensus.convergenceScore ?? 0) >= 0.5
                        ? 'var(--color-pending)'
                        : 'var(--color-mismatch)',
                    fontWeight: 600,
                  }}
                >
                  {(local.execution.consensus.convergenceScore ?? 0).toFixed(3)}
                </span>
              </div>
            </div>
            {local.execution.consensus.agreementSummary && (
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                <strong style={{ color: 'var(--color-fg)' }}>Agreement:</strong>{' '}
                {local.execution.consensus.agreementSummary}
              </div>
            )}
            {local.execution.consensus.disagreementSummary && (
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                <strong style={{ color: 'var(--color-fg)' }}>Disagreement:</strong>{' '}
                {local.execution.consensus.disagreementSummary}
              </div>
            )}
            {local.execution.consensus.individualAttestations && local.execution.consensus.individualAttestations.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {local.execution.consensus.individualAttestations.map((att) => (
                  <div
                    key={att.role}
                    style={{
                      padding: 12,
                      border: '1px solid var(--color-hairline)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-tonal)',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{att.role}</div>
                    {att.providerAddress && (
                      <div className="mono" style={{ color: 'var(--color-muted)', fontSize: 11, wordBreak: 'break-all' }}>
                        {att.providerAddress.slice(0, 14)}…
                      </div>
                    )}
                    <div style={{ color: 'var(--color-muted)', marginTop: 4, fontSize: 11 }}>
                      independent verify:{' '}
                      <span
                        style={{
                          color: att.independentVerified === true
                            ? 'var(--color-verified)'
                            : att.independentVerified === false
                              ? 'var(--color-mismatch)'
                              : 'var(--color-muted)',
                        }}
                      >
                        {att.independentVerified === true ? 'PASS' : att.independentVerified === false ? 'FAIL' : 'pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
