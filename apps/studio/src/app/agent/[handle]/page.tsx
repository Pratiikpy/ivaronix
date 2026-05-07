import { Section } from '@/components/Section';
import { getPassportClient, explorerAddrUrl } from '@/lib/chain';

export const dynamic = 'force-dynamic';

function isAddress(input: string): input is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(input);
}

export default async function AgentProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);

  // Day 13 supports wallet-address handles only. Day 17 will add ENS-style handles.
  if (!isAddress(decoded)) {
    return (
      <Section
        label={`§ AGENT · ${decoded}`}
        title="Handles arrive Day 17."
        description="For Day 13, pass a wallet address (0x…). Vanity handles are anchored on the AgentPassport contract in the next sprint."
      />
    );
  }

  const passport = getPassportClient();
  const profile = passport ? await passport.getPassportByWallet(decoded) : null;

  if (!profile) {
    return (
      <Section
        label={`§ AGENT · ${decoded}`}
        title="No passport for that wallet yet."
        description={`The wallet has no AgentPassport on this network. Use 'ivaronix passport mint' to create one.`}
      />
    );
  }

  return (
    <Section
      label={`§ AGENT · #${profile.tokenId}`}
      title={`Trust score ${profile.trustScore}`}
      description={`${profile.receiptCount} action${profile.receiptCount === 1n ? '' : 's'} anchored. Owner ${decoded}.`}
    >
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '12px 24px',
          fontSize: 14,
        }}
      >
        <dt style={{ color: 'var(--color-muted)' }}>tokenId</dt>
        <dd style={{ margin: 0 }}>{profile.tokenId.toString()}</dd>
        <dt style={{ color: 'var(--color-muted)' }}>owner</dt>
        <dd className="mono" style={{ margin: 0 }}>
          <a href={explorerAddrUrl(decoded)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
            {decoded}
          </a>
        </dd>
        <dt style={{ color: 'var(--color-muted)' }}>receiptCount</dt>
        <dd style={{ margin: 0 }}>{profile.receiptCount.toString()}</dd>
        <dt style={{ color: 'var(--color-muted)' }}>trustScore</dt>
        <dd style={{ margin: 0 }}>{profile.trustScore.toString()}</dd>
        <dt style={{ color: 'var(--color-muted)' }}>violationCount</dt>
        <dd style={{ margin: 0 }}>{profile.violationCount.toString()}</dd>
      </dl>
    </Section>
  );
}
