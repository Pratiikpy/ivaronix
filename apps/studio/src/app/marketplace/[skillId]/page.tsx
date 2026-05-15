/**
 * FINAL_BUILD_PLAN.md Block I · Skill detail page.
 *
 * Shows manifest + price + bps + recent receipts. The "Run with payment →"
 * button drops the user into a client island that walks the wagmi flow:
 * /api/run/estimate → paySkillRun tx → /api/run/confirm.
 */
import Link from 'next/link';
import { Section } from '@/components/Section';
import { skillsList, skillReceipts, subgraphAvailable } from '@/lib/subgraph';
import { BuyAndRunButton } from '@/components/BuyAndRunButton';
import { resolveSkillSlug, skillSlugToHex } from '@/lib/first-party-skills';
import { findSkillByIdServer } from '@/lib/skills';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PageProps {
  params: Promise<{ skillId: string }>;
}

export default async function SkillDetailPage({ params }: PageProps) {
  const { skillId: encodedSkillId } = await params;
  const skillIdRaw = decodeURIComponent(encodedSkillId);

  // Bug #22 (v33 UI sweep · 2026-05-16): the URL param may be either
  // the human slug ('private-doc-review') or the on-chain hex
  // manifestHash. The marketplace listing renders card links as
  // /marketplace/<slug> for the 5 first-party skills, but the
  // subgraph/chain stores skillId as keccak256("skill:"+slug). The
  // pre-fix code did a case-insensitive find with no slug-to-hex
  // conversion, so the slug routes 404'd while hex routes worked.
  // Now we resolve the slug to hex up-front and match in either form.
  const skillId = await skillSlugToHex(skillIdRaw);

  // Find the skill in the list (subgraph or chain-fallback)
  const all = await skillsList({ limit: 100 });
  const skill = all.find((s) => s.skillId.toLowerCase() === skillId.toLowerCase());

  if (!skill) {
    return (
      <Section label="§ MARKETPLACE" title="Skill not found">
        <div className="card" style={{ padding: 24 }}>
          <p>No skill matches id <code>{skillId.slice(0, 20)}…</code> on this network.</p>
          <p><Link href="/marketplace">← Back to marketplace</Link></p>
        </div>
      </Section>
    );
  }

  const recent = await skillReceipts(skillId, 10);
  const priceOg = parseFloat(skill.priceOg);
  const isFree = !skill.isPriced || skill.priceWei === '0';

  // Resolve the human-readable slug + load its manifest description, so
  // the detail page shows "private-doc-review" + the skill's description
  // instead of just the raw hex hash. Closes the "Skill detail"-only
  // landing-page UX gap that left users guessing what 0x0934cfc2… is.
  const slug = await resolveSkillSlug(skill.skillId);
  const knownSlug = slug !== skill.skillId; // not a pass-through
  const localSkill = knownSlug ? findSkillByIdServer(slug) : null;
  const skillTitle = knownSlug ? slug : 'Skill detail';
  const skillDescription = localSkill?.manifest.description
    ?? (knownSlug ? `First-party skill · run via paySkillRun → receipt anchored on chain.` : 'Run via paySkillRun → receipt anchored on chain.');

  return (
    <Section
      label={`§ SKILL · ${isFree ? 'FREE' : `${priceOg.toFixed(4)} OG`}`}
      title={skillTitle}
      description={skillDescription}
    >
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Pricing</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '8px 16px', fontSize: 14 }}>
          <dt style={{ opacity: 0.6 }}>Skill id</dt>
          <dd style={{ wordBreak: 'break-all' }}><code style={{ fontSize: 12 }}>{skill.skillId}</code></dd>

          <dt style={{ opacity: 0.6 }}>Creator</dt>
          <dd><code style={{ fontSize: 12 }}>{skill.owner}</code></dd>

          <dt style={{ opacity: 0.6 }}>Price</dt>
          <dd>
            {isFree ? (
              <span style={{ color: '#166534', fontWeight: 600 }}>FREE</span>
            ) : (
              <strong>{priceOg.toFixed(6)} OG</strong>
            )}
          </dd>

          {!isFree && (
            <>
              <dt style={{ opacity: 0.6 }}>Split</dt>
              <dd>{skill.creatorBps / 100}% creator · {skill.treasuryBps / 100}% treasury</dd>

              <dt style={{ opacity: 0.6 }}>Creator receives</dt>
              <dd>~{(priceOg * skill.creatorBps / 10000).toFixed(6)} OG per run</dd>
            </>
          )}

          {skill.totalReceipts > 0 && (
            <>
              <dt style={{ opacity: 0.6 }}>Total runs</dt>
              <dd>{skill.totalReceipts}</dd>

              <dt style={{ opacity: 0.6 }}>Total paid</dt>
              <dd>{(parseFloat(skill.totalPaidWei) / 1e18).toFixed(4)} OG</dd>
            </>
          )}
        </dl>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Run this skill</h2>
        <p style={{ fontSize: 14, marginBottom: 16, opacity: 0.7 }}>
          {isFree ? (
            'This skill is free — payment leg skipped. Connect your wallet to run it.'
          ) : (
            <>
              Cost: <strong>{priceOg.toFixed(6)} OG</strong>. Your wallet signs <code>paySkillRun</code>, the pipeline runs, the receipt anchors with payment metadata.
            </>
          )}
        </p>
        <BuyAndRunButton skillId={skill.skillId} priceWei={skill.priceWei} priceOg={priceOg} isFree={isFree} creator={skill.owner} creatorBps={skill.creatorBps} treasuryBps={skill.treasuryBps} />
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Recent runs</h2>
        {!subgraphAvailable() && (
          <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>
            Recent-runs feed requires the Goldsky subgraph (set <code>SUBGRAPH_URL</code> env). Showing chain-fallback (empty).
          </p>
        )}
        {recent.length === 0 ? (
          <p style={{ fontSize: 14, opacity: 0.6 }}>No runs yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
            {recent.map((r) => (
              <li key={r.receiptRoot} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-rule)' }}>
                <Link href={`/r/${r.onChainId}`} style={{ textDecoration: 'none' }}>
                  <code style={{ fontSize: 11 }}>{r.agent.slice(0, 12)}…</code>
                  &nbsp;·&nbsp;
                  receipt <strong>#{r.onChainId}</strong>
                  &nbsp;·&nbsp;
                  {new Date(r.anchoredAt * 1000).toLocaleString()}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: 13, opacity: 0.7, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/marketplace">← Back to marketplace</Link>
        {knownSlug && (
          <Link href={`/skill/${slug}`}>Full skill profile →</Link>
        )}
      </p>
    </Section>
  );
}
