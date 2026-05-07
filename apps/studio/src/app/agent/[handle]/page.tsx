import Link from 'next/link';
import { Section } from '@/components/Section';
import { getPassportClient, getReceiptRegistry, explorerAddrUrl } from '@/lib/chain';

export const dynamic = 'force-dynamic';

function isAddress(input: string): input is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(input);
}

interface BadgeTier {
  label: string;
  threshold: number;
}
const TIERS: BadgeTier[] = [
  { label: 'Newcomer', threshold: 0 },
  { label: 'Verified', threshold: 5 },
  { label: 'Trusted', threshold: 20 },
  { label: 'Veteran', threshold: 50 },
  { label: 'Council', threshold: 200 },
];

function tierFor(trustScore: number): BadgeTier {
  let pick = TIERS[0]!;
  for (const t of TIERS) if (trustScore >= t.threshold) pick = t;
  return pick;
}

export default async function AgentProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);

  if (!isAddress(decoded)) {
    return (
      <Section
        label={`§ AGENT · ${decoded}`}
        title="Handles arrive Day 17."
        description="For Day 13–16, pass a wallet address (0x…). Vanity handles are anchored on the AgentPassport contract in the next sprint."
      />
    );
  }

  const passport = getPassportClient();
  const reg = getReceiptRegistry();
  const profile = passport ? await passport.getPassportByWallet(decoded) : null;
  const recent = reg ? await reg.findByAgent(decoded, 5).catch(() => []) : [];

  if (!profile) {
    return (
      <Section
        label={`§ AGENT · ${decoded}`}
        title="No passport for that wallet yet."
        description="The wallet has no AgentPassport on this network. Use 'ivaronix passport mint' to create one."
      />
    );
  }

  const tier = tierFor(Number(profile.trustScore));

  return (
    <Section
      label={`§ AGENT · #${profile.tokenId}`}
      title={`Trust score ${profile.trustScore}`}
      description={`${profile.receiptCount} receipt${profile.receiptCount === 1n ? '' : 's'} anchored. Owner ${decoded.slice(0, 10)}…${decoded.slice(-4)}.`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, alignItems: 'start' }}>
        <div className="card">
          <div className="section-label" style={{ marginBottom: 16 }}>recent activity ({recent.length})</div>
          {recent.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              <span className="italic-display">No on-chain receipts found in the last 100k blocks.</span>
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {recent.map((r) => (
                <li key={r.id.toString()} style={{ borderBottom: '1px solid var(--color-hairline)', paddingBottom: 12 }}>
                  <Link href={`/r/${r.id.toString()}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', textDecoration: 'none', color: 'inherit', gap: 12 }}>
                    <span style={{ fontWeight: 500 }}>Receipt #{r.id.toString()}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                      {new Date(Number(r.timestamp) * 1000).toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  </Link>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                    type code {r.receiptType} ·{' '}
                    <span className="mono">{r.receiptRoot.slice(0, 12)}…{r.receiptRoot.slice(-8)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="card">
          <div className="section-label">tier</div>
          <p style={{ fontSize: 32, lineHeight: 1.1, marginTop: 12, marginBottom: 4 }} className="italic-display">
            {tier.label}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
            ≥ {tier.threshold} trust
          </p>

          <div style={{ marginTop: 24 }}>
            <div className="section-label">profile</div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12, marginTop: 8 }}>
              <dt style={{ color: 'var(--color-muted)' }}>tokenId</dt>
              <dd style={{ margin: 0 }}>{profile.tokenId.toString()}</dd>
              <dt style={{ color: 'var(--color-muted)' }}>trust</dt>
              <dd style={{ margin: 0 }}>{profile.trustScore.toString()}</dd>
              <dt style={{ color: 'var(--color-muted)' }}>receipts</dt>
              <dd style={{ margin: 0 }}>{profile.receiptCount.toString()}</dd>
              <dt style={{ color: 'var(--color-muted)' }}>violations</dt>
              <dd style={{ margin: 0 }}>{profile.violationCount.toString()}</dd>
            </dl>
          </div>

          <a
            href={explorerAddrUrl(decoded)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ marginTop: 16, paddingLeft: 0, display: 'inline-block', textDecoration: 'underline' }}
          >
            On chainscan →
          </a>
        </aside>
      </div>
    </Section>
  );
}
