import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { loadAllSkills } from '@/lib/skills';
import { VerticalEnum, type SkillManifest } from '@ivaronix/skills';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Verticals · Ivaronix',
  description: 'Industry-specific AI review surfaces — legal, code, content, ops — each backed by a verifiable receipt.',
};

interface LiveSkillCard {
  id: string;
  description: string;
  tier: SkillManifest['og']['consensus']['default_tier'];
  feeSplitCreatorBps: number;
}

/**
 * "We start with Legal." — the verticals surface.
 *
 * The directive (2026-05-14 LEGAL VERTICAL HARD-LAUNCH PIVOT) reframes the
 * marketplace from "6 generic cross-vertical skills" to "Legal · 5 skills ·
 * deep" plus 14 honest COMING SOON cards. Every card on this page is either
 * LIVE (links to a real /skill/<slug> page) or ROADMAP (mailto: notify link).
 * Zero broken links, per user-thinking §O.4 no-fake-cards rule.
 */
export default async function VerticalsPage() {
  const allSkills = loadAllSkills();
  const legalSkills: LiveSkillCard[] = allSkills
    .filter((s) => s.manifest.og.vertical === 'legal')
    .map((s) => ({
      id: s.id,
      description: s.manifest.description,
      tier: s.manifest.og.consensus.default_tier,
      feeSplitCreatorBps: s.manifest.og.creator?.fee_split?.creator ?? 9000,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // 14 roadmap verticals derived from the schema's VerticalEnum. Single
  // source of truth — adding a vertical to the enum auto-renders a COMING
  // SOON card here.
  const roadmapVerticals = VerticalEnum.options.filter((v) => v.startsWith('roadmap_'));

  return (
    <>
      <Section
        label="§ VERTICALS"
        title="We start with Legal."
        description="Lawyers, in-house counsel, and founders use Ivaronix when AI can't be wrong. Other verticals roll out post-launch — every COMING SOON card on this page is a real roadmap commitment, not a marketing tease."
      >
        <p style={{ fontSize: 14, color: 'var(--color-muted)', maxWidth: 720, lineHeight: 1.6 }}>
          Each Legal skill below runs on the 0G Network, signed by the operator wallet,
          anchored on <code className="mono">ReceiptRegistryV3</code>, and re-verifiable from any
          machine via <code className="mono">ivaronix receipt verify &lt;id&gt; --tee-independent</code>.
          A judge or counter-party can open any receipt URL and run the same verification.
        </p>
      </Section>

      <Section
        label="§ 01 · LEGAL · LIVE"
        title="The 5 skills"
        description={`${legalSkills.length} first-party legal skills · published on SkillRegistryV2 · runs on the sovereign 0GM-1.0-35B-A3B model via 0G Compute on the Aristotle mainnet · output supports legal review, does not replace licensed counsel.`}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          {legalSkills.map((skill) => (
            <Link
              key={skill.id}
              href={`/skill/${skill.id}`}
              className="card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <h3 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>{skill.id}</h3>
                <span className="chip-verified">LIVE</span>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-muted)',
                  lineHeight: 1.5,
                  margin: 0,
                  marginBottom: 16,
                }}
              >
                {skill.description}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'var(--color-muted)',
                }}
              >
                <span
                  style={{
                    background: 'var(--color-verified-bg)',
                    color: '#166534',
                    border: '1px solid var(--color-verified)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    letterSpacing: '0.5px',
                  }}
                >
                  tier: {skill.tier}
                </span>
                <span className="mono">
                  creator {(skill.feeSplitCreatorBps / 100).toFixed(0)}% · treasury{' '}
                  {((10000 - skill.feeSplitCreatorBps) / 100).toFixed(0)}%
                </span>
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 13,
                  color: 'var(--color-fg)',
                  fontWeight: 500,
                }}
              >
                Try this skill →
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section
        label="§ 02 · ROADMAP · COMING SOON"
        title="14 more verticals on the runway"
        description="Every card below is a real roadmap commitment. We ship one vertical deeply before the next; no fake breadth. Notify-me links open your email client with a pre-filled message — we read every one."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {roadmapVerticals.map((vertical) => {
            // Defensive fallback if a new VerticalEnum value is added without
            // a matching ROADMAP_META entry — the card still renders, just
            // with a generic line until the metadata catches up.
            const meta = ROADMAP_META[vertical] ?? {
              useCase: 'A specialist agent for this vertical is on the roadmap.',
            };
            const label = vertical.replace('roadmap_', '').replace(/_/g, ' ');
            return (
              <div
                key={vertical}
                style={{
                  padding: 20,
                  border: '1px dashed var(--color-pending)',
                  borderRadius: 14,
                  background: 'var(--color-pending-bg)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      margin: 0,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {label}
                  </h3>
                  <span
                    style={{
                      background: 'var(--color-pending)',
                      color: '#92400e',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                    }}
                  >
                    COMING SOON
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--color-fg)',
                    lineHeight: 1.5,
                    margin: 0,
                    marginBottom: 14,
                  }}
                >
                  {meta.useCase}
                </p>
                <a
                  href={`mailto:hello@ivaronix.com?subject=${encodeURIComponent(
                    `Notify me when ${label} ships`,
                  )}&body=${encodeURIComponent(
                    `Hi — please let me know when the ${label} vertical is live on Ivaronix.\n\nWhat I'd use it for:\n[your use case]\n\nThanks!`,
                  )}`}
                  style={{
                    fontSize: 12,
                    color: 'var(--color-fg)',
                    fontWeight: 500,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Notify me when this ships →
                </a>
              </div>
            );
          })}
        </div>
        <p
          style={{
            marginTop: 32,
            fontSize: 12,
            color: 'var(--color-muted)',
            maxWidth: 680,
            lineHeight: 1.6,
          }}
        >
          The order of vertical rollout is driven by where receipt-anchored AI work has the highest
          downstream-trust value: legal (contracts, litigation, citations) goes first because the
          asymmetry between "AI says" and "I can prove the AI did the work correctly" is the
          starkest. Other verticals follow once the receipt pipeline has been hardened in
          production.
        </p>
      </Section>
    </>
  );
}

/**
 * Plain-English use case per roadmap vertical. One concrete job-to-be-done
 * per line — no marketing fluff, no banned-word leakage (CLAUDE.md §9), no
 * "revolutionize" rhetoric (user-thinking §O.9).
 *
 * Adding a vertical here is the contract: every new `roadmap_*` value in
 * `VerticalEnum` needs an entry below or the page will fall back to a
 * generic "use case description coming soon" line.
 */
const ROADMAP_META: Record<string, { useCase: string }> = {
  roadmap_healthcare: {
    useCase:
      "Drop a patient consult transcript; verify the AI's clinical reasoning before recording in the chart.",
  },
  roadmap_hr: {
    useCase:
      "Drop a candidate resume and interview notes; flag bias-prone language and missing protected-class checks.",
  },
  roadmap_finance: {
    useCase:
      'Drop a quarterly report; flag GAAP deviations and unusual journal entries before the auditors arrive.',
  },
  roadmap_customer_support: {
    useCase:
      'Drop a customer email; draft a verified response that matches your knowledge base, not the model training data.',
  },
  roadmap_education: {
    useCase:
      'Drop a student essay; produce a rubric-scored evaluation with citation-checked sources.',
  },
  roadmap_code: {
    useCase:
      'Drop a pull request diff; flag security regressions and API contract changes the author missed.',
  },
  roadmap_compliance: {
    useCase:
      "Drop a vendor SOC 2 report; flag the control gaps that match your company's compliance framework.",
  },
  roadmap_insurance: {
    useCase:
      "Drop a claim summary and policy language; flag coverage misalignments before the adjuster's review.",
  },
  roadmap_real_estate: {
    useCase:
      'Drop a lease offer; flag rent escalation, deposit handling, and unilateral-modification clauses.',
  },
  roadmap_journalism: {
    useCase:
      'Drop a source quote; verify the underlying document and flag context-shifting paraphrases.',
  },
  roadmap_marketing_sales: {
    useCase:
      "Drop a competitor's ad copy; flag substantiation gaps before launching a parallel claim.",
  },
  roadmap_research: {
    useCase:
      'Drop a methods section; verify cited papers exist and match the cited findings.',
  },
  roadmap_government: {
    useCase:
      'Drop a public records request response; flag exemption misapplications and improper redactions.',
  },
  roadmap_procurement: {
    useCase:
      'Drop a vendor proposal; flag pricing escalators and assumption padding before the PO is cut.',
  },
};
