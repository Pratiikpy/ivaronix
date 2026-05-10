import Link from 'next/link';
import {
  unifiedGetReceipt,
  unifiedFindByReceiptRoot,
  explorerTxUrl,
  explorerAddrUrl,
  getNetwork,
  receiptTypeLabel,
  type UnifiedReceipt,
} from '@/lib/chain';
import { findLocalReceiptByRoot } from '@/lib/local-receipt';
import { PrintControls } from './print-controls';

export const dynamic = 'force-dynamic';

/**
 * Printable receipt page (planning-01 §4A).
 *
 * Letterhead-style version of /r/[id] — clean title block, status bar,
 * audit-trail facts, headline summary, verify-from-any-machine footer.
 * Designed to be printed (Ctrl+P / save-as-PDF) and emailed to a
 * partner / regulator / counter-party as a paper-grade artefact.
 *
 * Persona-locked use case: deal lawyer ran a contract review and now
 * needs a one-page proof her partner can read tomorrow morning. The
 * Studio receipt page exists for verification clicking; this page
 * exists for printing.
 */
export default async function PrintableReceipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const network = getNetwork();
  let onChain: UnifiedReceipt | null = null;
  try {
    if (/^\d+$/.test(id)) {
      onChain = await unifiedGetReceipt(BigInt(id));
    } else if (/^0x[0-9a-f]{64}$/i.test(id)) {
      onChain = await unifiedFindByReceiptRoot(id as `0x${string}`);
    }
  } catch { /* fall through */ }

  if (!onChain) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Receipt not found</h1>
        <p style={pStyle}>No receipt with id <code>{id}</code> on {network}.</p>
      </main>
    );
  }

  const local = findLocalReceiptByRoot(onChain.receiptRoot)?.body ?? null;
  const headline = local?.outputs?.wording?.headline ?? '';
  const txHash = local?.chainAnchor?.anchorTxHash;
  const tee = local?.teeVerification;
  const isFullyVerified = tee?.routerVerified === true && tee?.independentVerified === true;
  const tierLabel = tee?.verificationMethod === 'router_flag' || tee?.verificationMethod === 'compute_sdk_process_response'
    ? 'TIER 1 · TEE-attested'
    : tee?.verificationMethod === 'external-signed'
    ? 'TIER 2 · External-signed'
    : 'Anchored';
  const status = isFullyVerified ? 'FULLY VERIFIED' : 'ANCHORED';
  const skillId = local?.request?.skillId ?? receiptTypeLabel(onChain.receiptType);
  const skillVersion = local?.request?.skillVersion;
  const issuedAt = local?.chainAnchor?.anchorTimestamp
    ? new Date(local.chainAnchor.anchorTimestamp * 1000).toISOString().replace('T', ' ').slice(0, 19) + 'Z'
    : 'n/a';
  const printUrl = `https://ivaronix.studio/r/${onChain.id}`;
  const studioOrigin = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ivaronix.studio';
  const verifyUrl = `${studioOrigin}/r/${onChain.id}`;

  return (
    <main style={pageStyle}>
      {/* Print/save controls — hidden when the page is actually being printed */}
      <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12 }}>
        <Link
          href={`/r/${onChain.id}`}
          style={{ fontSize: 12, color: '#444', textDecoration: 'underline' }}
        >
          ← Back to interactive receipt
        </Link>
        <PrintControls />
      </div>

      <div className="print-page">
        {/* Letterhead — div not header so the layout's `header { display:none }`
            (which strips the studio's chrome) doesn't also strip our own
            letterhead band. */}
        <div style={letterheadStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <p style={{ ...eyebrowStyle, marginBottom: 4 }}>IVARONIX · ACTION RECEIPT</p>
              <h1 style={titleStyle}>Receipt #{onChain.id.toString()}</h1>
              <p style={{ ...subTitleStyle, margin: '4px 0 0' }}>
                {skillId}{skillVersion ? ` v${skillVersion}` : ''} · {network} · {issuedAt}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono, ui-monospace)',
                  fontSize: 10,
                  padding: '4px 10px',
                  border: '2px solid #000',
                  borderRadius: 4,
                  background: '#fff',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                }}
              >
                {status}
              </span>
              <span style={{ fontSize: 10, color: '#444', letterSpacing: '0.5px' }}>{tierLabel}</span>
            </div>
          </div>
        </div>

        {/* Headline summary */}
        {headline && (
          <section style={sectionStyle}>
            <h2 style={h2Style}>Summary</h2>
            <p style={{ ...pStyle, fontSize: 13, lineHeight: 1.6 }}>{headline}</p>
          </section>
        )}

        {/* Audit trail */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Audit trail</h2>
          <dl style={dlStyle}>
            <dt style={dtStyle}>receipt root</dt>
            <dd style={ddMonoStyle}>{onChain.receiptRoot}</dd>
            <dt style={dtStyle}>agent wallet</dt>
            <dd style={ddMonoStyle}>{onChain.agentAddress}</dd>
            {txHash && (
              <>
                <dt style={dtStyle}>anchor tx</dt>
                <dd style={ddMonoStyle}>{txHash}</dd>
              </>
            )}
            {local?.chainAnchor?.anchorBlockNumber && (
              <>
                <dt style={dtStyle}>block</dt>
                <dd style={ddMonoStyle}>{local.chainAnchor.anchorBlockNumber}</dd>
              </>
            )}
            <dt style={dtStyle}>type</dt>
            <dd style={ddMonoStyle}>{local?.type ?? receiptTypeLabel(onChain.receiptType)}</dd>
            {local?.execution?.modelSelection?.final && (
              <>
                <dt style={dtStyle}>model</dt>
                <dd style={ddMonoStyle}>{local.execution.modelSelection.final}</dd>
              </>
            )}
            {local?.billing && (
              <>
                <dt style={dtStyle}>tokens · cost</dt>
                <dd style={ddMonoStyle}>{local.billing.inputTokens}+{local.billing.outputTokens} · {local.billing.totalCostOg} OG</dd>
              </>
            )}
            {local?.execution?.burnMode && (
              <>
                <dt style={dtStyle}>burn mode</dt>
                <dd style={ddMonoStyle}>
                  on · session key destroyed
                  {local?.storage?.encryption?.keyFingerprint && ` · ${local.storage.encryption.keyFingerprint.slice(0, 30)}…`}
                </dd>
              </>
            )}
            {local?.request?.priorReceiptIds && local.request.priorReceiptIds.length > 0 && (
              <>
                <dt style={dtStyle}>built on</dt>
                <dd style={{ ...ddMonoStyle, fontSize: 9 }}>
                  {local.request.priorReceiptIds.length} prior receipt{local.request.priorReceiptIds.length === 1 ? '' : 's'} ·{' '}
                  {local.request.priorReceiptIds.slice(0, 3).join(', ')}
                  {local.request.priorReceiptIds.length > 3 && '…'}
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* Verify-from-any-machine footer */}
        <section style={{ ...sectionStyle, marginTop: 32, borderTop: '2px solid #000', paddingTop: 16 }}>
          <h2 style={h2Style}>Verify this receipt from any machine</h2>
          <p style={pStyle}>
            Any reader of this document can re-verify the run independently — different machine, different network, no
            account needed. Three commands:
          </p>
          <pre style={preStyle}>
{`pnpm install -g @ivaronix/cli       # one-time
ivaronix receipt verify ${onChain.id} --tee-independent
# Expected: → FULLY VERIFIED ✓`}
          </pre>
          <p style={pStyle}>
            Or open the public proof URL: <strong style={{ fontFamily: 'var(--font-mono, ui-monospace)' }}>{verifyUrl}</strong>
          </p>
          {txHash && (
            <p style={{ ...pStyle, marginTop: 6 }}>
              On-chain inspection: <span style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 11 }}>{explorerTxUrl(txHash)}</span>
            </p>
          )}
        </section>

        {/* Footer signature — div not footer so the layout's
            `footer { display:none }` (used to strip studio chrome) doesn't
            also strip our printable signature. */}
        <div style={footerStyle}>
          <p style={{ margin: 0, fontSize: 9, color: '#666', letterSpacing: '0.5px' }}>
            Generated by Ivaronix · the receipt is the spine · {printUrl}
          </p>
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '32px 32px 48px',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  color: '#0a0a0a',
  background: 'white',
  minHeight: '100vh',
};

const letterheadStyle: React.CSSProperties = {
  borderBottom: '2px solid #000',
  paddingBottom: 16,
  marginBottom: 24,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '-0.5px',
  margin: 0,
  lineHeight: 1.2,
};

const subTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#444',
  fontFamily: 'var(--font-mono, ui-monospace)',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '2px',
  color: '#666',
  textTransform: 'uppercase',
  fontWeight: 600,
  margin: 0,
};

const h2Style: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  margin: '0 0 8px',
  color: '#0a0a0a',
};

const pStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.55,
  margin: 0,
  color: '#0a0a0a',
};

const dlStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: '4px 16px',
  margin: 0,
};

const dtStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#666',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
};

const ddMonoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace)',
  fontSize: 10,
  margin: 0,
  wordBreak: 'break-all',
};

const preStyle: React.CSSProperties = {
  background: '#f5f5f5',
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: 10,
  fontSize: 10,
  fontFamily: 'var(--font-mono, ui-monospace)',
  margin: '8px 0',
  whiteSpace: 'pre-wrap',
};

const footerStyle: React.CSSProperties = {
  marginTop: 32,
  paddingTop: 12,
  borderTop: '1px solid #ddd',
  textAlign: 'center',
};
