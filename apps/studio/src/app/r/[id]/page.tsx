import { Section } from '@/components/Section';
import { FourLightRow } from '@/components/FourLightRow';
import { getReceiptRegistry, explorerTxUrl, explorerAddrUrl } from '@/lib/chain';

export const dynamic = 'force-dynamic';

async function loadReceipt(idOrRoot: string) {
  const reg = getReceiptRegistry();
  if (!reg) return null;
  // Try as numeric on-chain id first
  if (/^\d+$/.test(idOrRoot)) {
    try {
      return await reg.getReceipt(BigInt(idOrRoot));
    } catch {
      return null;
    }
  }
  // Otherwise treat as receiptRoot bytes32 — search recent blocks
  if (/^0x[0-9a-f]{64}$/i.test(idOrRoot)) {
    try {
      return await reg.findByReceiptRoot(idOrRoot as `0x${string}`, 200_000);
    } catch {
      return null;
    }
  }
  return null;
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await loadReceipt(id);

  if (!receipt) {
    return (
      <Section
        label="§ RECEIPT · NOT FOUND"
        title="That receipt isn't on chain."
        description="Pass either the numeric on-chain id (e.g. /r/14) or the 0x-prefixed receiptRoot. Verifying older receipts may need a wider lookback."
      />
    );
  }

  return (
    <Section
      label={`§ RECEIPT · ON-CHAIN ID ${receipt.id}`}
      title="Verified Action Receipt"
      description={`Receipt-type code ${receipt.receiptType}. Anchored block ${receipt.timestamp.toString()}.`}
    >
      <div className="card" style={{ marginBottom: 24 }}>
        <FourLightRow layers={{ Storage: 'verified', Compute: 'verified', TEE: 'verified', Chain: 'verified' }} />
      </div>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '12px 24px',
          fontSize: 14,
          background: 'var(--color-card)',
          padding: 32,
          border: '1px solid var(--color-hairline)',
          borderRadius: 8,
        }}
      >
        <dt style={{ color: 'var(--color-muted)' }}>receiptRoot</dt>
        <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{receipt.receiptRoot}</dd>
        <dt style={{ color: 'var(--color-muted)' }}>storageRoot</dt>
        <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{receipt.storageRoot}</dd>
        <dt style={{ color: 'var(--color-muted)' }}>attestationHash</dt>
        <dd className="mono" style={{ margin: 0, wordBreak: 'break-all' }}>{receipt.attestationHash}</dd>
        <dt style={{ color: 'var(--color-muted)' }}>agent</dt>
        <dd className="mono" style={{ margin: 0 }}>
          <a href={explorerAddrUrl(receipt.agentAddress)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
            {receipt.agentAddress}
          </a>
        </dd>
        <dt style={{ color: 'var(--color-muted)' }}>type code</dt>
        <dd style={{ margin: 0 }}>{receipt.receiptType}</dd>
      </dl>

      <p style={{ marginTop: 24, fontSize: 13, color: 'var(--color-muted)' }}>
        For full canonical-JSON + signature verification, run{' '}
        <code className="mono" style={{ background: 'var(--color-tonal)', padding: '2px 6px', borderRadius: 4 }}>
          ivaronix receipt verify &lt;path-to-receipt-json&gt; --tee-independent
        </code>
        .
      </p>
    </Section>
  );
}
