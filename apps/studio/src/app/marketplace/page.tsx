/**
 * FINAL_BUILD_PLAN.md Block I · Marketplace skill browser.
 *
 * Lists skills with on-chain prices, creator addresses, bps splits.
 * Subgraph-backed when SUBGRAPH_URL is set (Block O); falls back to
 * direct-chain reads of the 6 first-party skill slugs.
 *
 * Each card links to /marketplace/<skillId> for detail + buy flow.
 */
import Link from 'next/link';
import { Section } from '@/components/Section';
import { skillsList, subgraphAvailable, type SkillListing } from '@/lib/subgraph';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata = {
  title: 'Marketplace · Ivaronix',
  description: 'Run verified AI skills with on-chain settlement. Per-skill creator/treasury fee splits, paid in native OG.',
};

export default async function MarketplacePage() {
  const skills = await skillsList({ limit: 50, sortBy: 'recent' });
  const subgraph = subgraphAvailable();

  return (
    <Section
      label="§ MARKETPLACE"
      title="Verified skill economy"
      description="Every paid run anchors a receipt anyone can replay. Creator gets paid on chain. No subscriptions, no middleman."
    >
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', fontSize: 13 }}>
        <span className="card" style={{ padding: '8px 12px' }}>
          <strong>{skills.length}</strong> skills available
        </span>
        <span className="card" style={{ padding: '8px 12px' }}>
          Settlement: <strong>native 0G</strong>
        </span>
        <span className="card" style={{ padding: '8px 12px' }}>
          Data source: <strong>{subgraph ? 'Goldsky subgraph (live-indexed)' : 'direct chain reads (set SUBGRAPH_URL for faster queries)'}</strong>
        </span>
      </div>

      {skills.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p>No priced skills found.</p>
          <p style={{ fontSize: 13, opacity: 0.6 }}>
            Creators: visit <Link href="/marketplace/new">/marketplace/new</Link> to publish + price a skill.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {skills.map((s) => (
          <SkillCard key={s.skillId} skill={s} />
        ))}
      </div>

      <div style={{ marginTop: 32, padding: 24, borderTop: '1px solid var(--color-rule)', fontSize: 13, opacity: 0.7 }}>
        <p><strong>How it works:</strong></p>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          <li>Click a skill, review the manifest + price.</li>
          <li>Connect your wallet. The Studio shows the payment ask.</li>
          <li>Sign the <code>paySkillRun</code> transaction in MetaMask.</li>
          <li>The pipeline runs; the receipt anchors with your payment recorded.</li>
          <li>Creator receives their share immediately to <code>creatorBalance</code>. <Link href="/marketplace/payouts">Withdraw here</Link>.</li>
        </ol>
      </div>
    </Section>
  );
}

function SkillCard({ skill }: { skill: SkillListing }) {
  const priceOg = parseFloat(skill.priceOg).toFixed(4);
  const isFree = !skill.isPriced || skill.priceWei === '0';
  return (
    <Link
      href={`/marketplace/${encodeURIComponent(skill.skillId)}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <article className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <code style={{ fontSize: 11, opacity: 0.6, wordBreak: 'break-all' }}>
            {skill.skillId.slice(0, 18)}…
          </code>
          {isFree ? (
            <span style={{ padding: '4px 10px', background: 'var(--color-verified-bg)', color: '#166534', border: '1px solid var(--color-verified)', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>FREE</span>
          ) : (
            <span style={{ padding: '4px 10px', background: 'var(--color-page-bg)', border: '1px solid var(--color-rule)', borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
              {priceOg} OG
            </span>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>
            <code style={{ fontFamily: 'var(--font-mono, monospace)', wordBreak: 'break-all' }}>
              {skill.skillId.slice(2, 12)}…
            </code>
          </h3>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          Creator:&nbsp;<code style={{ fontSize: 11 }}>{skill.owner.slice(0, 10)}…{skill.owner.slice(-6)}</code>
          {!isFree && (
            <>
              <br />
              Split: <strong>{skill.creatorBps / 100}%</strong> creator · <strong>{skill.treasuryBps / 100}%</strong> treasury
            </>
          )}
          {skill.totalReceipts > 0 && (
            <>
              <br />
              <strong>{skill.totalReceipts}</strong> runs · <strong>{(parseFloat(skill.totalPaidWei) / 1e18).toFixed(4)}</strong> OG settled
            </>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--color-link, #2563eb)', fontWeight: 500 }}>
            {isFree ? 'Run for free →' : 'Run with payment →'}
          </span>
        </div>
      </article>
    </Link>
  );
}
