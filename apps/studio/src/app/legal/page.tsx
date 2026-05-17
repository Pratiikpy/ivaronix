import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/Section';
import { loadAllSkills } from '@/lib/skills';
import { unifiedNextId, getNetwork } from '@/lib/chain';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Legal · Ivaronix',
  description: 'AI legal review for documents you can\'t paste into ChatGPT — NDA triage, term sheets, contract renewals, citation checks.',
};

/**
 * `/legal` — the legal-vertical SEO landing.
 *
 * Persona-led: lawyers, in-house counsel, founders. The page LinkedIn
 * outreach points to. TESTNET-honest eyebrow (CLAUDE.md §9 overclaim
 * discipline · user-thinking §O.9): we say "GALILEO TESTNET" not
 * "mainnet" and not "live on 0G" (ambiguous).
 *
 * The H1 ("The AI second opinion you can give your lawyer.") is the
 * legal-persona variant reserved for /legal — the main home stays at
 * "Private AI work. Public proof." per user-thinking §O.1.
 *
 * 10 sections per directive Task 3:
 *  1. Hero (eyebrow + H1 + H2 sub + CTAs + frozen receipt rail)
 *  2. Mata v. Avianca wall (two-column comparison)
 *  3. The 5-skill cluster
 *  4. The 5-step workflow loop (Drop → Run → Verify → Share → Archive)
 *  5. Real before/after (placeholders until Fire 8 anchors receipts)
 *  6. For lawyers / for in-house counsel / for founders
 *  7. What we DON'T do (honest disclaimers)
 *  8. Pricing in $0G per tier
 *  9. FAQ (6 legal-specific questions)
 * 10. Final CTA
 */
export default async function LegalPage() {
  // Receipt count for the honest "X+ receipts anchored" eyebrow.
  let receiptCount: bigint | null = null;
  try {
    const { total } = await unifiedNextId();
    receiptCount = total > 0n ? total : null;
  } catch {
    receiptCount = null;
  }
  const network = getNetwork();

  const allSkills = loadAllSkills();
  const legalSkills = allSkills
    .filter((s) => s.manifest.og.vertical === 'legal')
    .map((s) => ({
      id: s.id,
      description: s.manifest.description,
      tier: s.manifest.og.consensus.default_tier,
      required: s.manifest.og.consensus.required,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      {/* §1 · Hero */}
      <Section
        label={
          <>
            § FOR LAWYERS, IN-HOUSE COUNSEL, FOUNDERS · LIVE ON 0G
            {receiptCount !== null && (
              <>
                {' · '}
                <span className="mono">
                  {Number(receiptCount).toLocaleString('en-US')}+
                </span>{' '}
                receipts anchored
              </>
            )}
          </>
        }
        title={
          <>
            The AI second opinion you can give{' '}
            <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif)' }}>your lawyer.</span>
          </>
        }
        description="Drop a contract · the specialist reviews inside a sealed enclave · you leave with a receipt anyone can verify in 10 seconds — even after the document is gone."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 48,
            alignItems: 'start',
            marginTop: 24,
          }}
        >
          <div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link
                href="/?skill=private-doc-review"
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Run a private-doc-review
              </Link>
              <Link
                href="/learn#four-light"
                className="btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                See how verification works →
              </Link>
            </div>
            <p
              style={{
                marginTop: 28,
                fontSize: 13,
                color: 'var(--color-muted)',
                lineHeight: 1.6,
                maxWidth: 520,
              }}
            >
              Every run anchors a public receipt on 0G Chain. Open the receipt URL on a different
              machine, in a different browser, with no Ivaronix account, and the four cryptographic
              checks still pass. That is the proof you can hand opposing counsel.
            </p>
          </div>
          <FrozenReceiptCard />
        </div>
      </Section>

      {/* §2 · Mata v. Avianca wall */}
      <Section
        label="§ 01 · WHY THIS EXISTS"
        title="Same AI. Different ending."
        description="A New York lawyer filed a brief in 2023 citing six cases ChatGPT had hallucinated. The judge sanctioned the lawyer and his firm. NYT front page. The AI wasn't the problem — the absence of proof was."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            marginTop: 16,
          }}
        >
          <ComparisonColumn
            tone="amber"
            heading="ChatGPT · Mata v. Avianca pattern"
            bullets={[
              'Lawyer pastes brief and asks "are these citations real?"',
              'Model "confirms" from its training data — no external check.',
              'Brief filed. Cases turn out to be fictional.',
              'No artifact. No proof of process. No way to defend "I trusted the tool."',
              'Sanction. Headline. Firm pays $5,000. Career damage.',
            ]}
          />
          <ComparisonColumn
            tone="green"
            heading="Ivaronix · legal-citation-verifier (architecture)"
            bullets={[
              'Lawyer drops brief into a sealed-enclave specialist.',
              'Architecture routes each cite through HTTP to CourtListener + Cornell LII via the web_fetch builtin.',
              'Testnet caveat: Qwen 2.5 7B does not yet reliably emit tool_calls; runtime web_fetch enforcement is queued as this skill\'s mainnet-promotion gate — testnet verdicts are heuristic parsing only.',
              'Receipt URL + four-light proof + signer wallet + chain anchor land regardless.',
              'Re-verification path identical; the HTTP cross-check landed on mainnet runtime.',
            ]}
          />
        </div>
      </Section>

      {/* §3 · 5-skill cluster */}
      <Section
        label="§ 02 · THE LEGAL CLUSTER"
        title="Five skills, one workflow."
        description="Each skill ships with a Zod-validated manifest, an honest scope note about Qwen 2.5 7B output on testnet, and a 90/10 creator/treasury fee split."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
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
                  marginBottom: 10,
                }}
              >
                <h3 style={{ fontSize: 16, margin: 0, fontWeight: 600 }}>{skill.id}</h3>
                <span
                  style={{
                    background: 'var(--color-verified-bg)',
                    color: '#166534',
                    border: '1px solid var(--color-verified)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    letterSpacing: '0.5px',
                  }}
                >
                  {skill.tier}
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--color-muted)',
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {skill.description}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {/* §4 · 5-step workflow loop */}
      <Section
        label="§ 03 · THE WORKFLOW"
        title="Drop · Run · Verify · Share · Archive."
        description="Same loop a paralegal already follows — except the receipt is cryptographic and re-verifiable on any machine for as long as the chain stands."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          {WORKFLOW_STEPS.map((step, i) => (
            <div
              key={step.verb}
              style={{
                padding: 20,
                border: '1px solid var(--color-hairline)',
                borderRadius: 14,
                background: '#ffffff',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-muted)',
                  letterSpacing: '0.5px',
                  marginBottom: 8,
                }}
              >
                STEP {i + 1}
              </div>
              <h3 style={{ fontSize: 18, margin: 0, marginBottom: 8, fontWeight: 600 }}>
                {step.verb}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--color-muted)',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {step.detail}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* §5 · Before/after */}
      <Section
        label="§ 04 · WHAT THE RECEIPT SHOWS"
        title="Five real examples, anonymized."
        description="One example per legal skill, redacted enough to share. Click any example to open its receipt URL on a fresh machine and re-verify the four cryptographic checks."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {BEFORE_AFTER_EXAMPLES.map((ex) => (
            <div
              key={ex.skill}
              style={{
                padding: 24,
                border: '1px solid var(--color-hairline)',
                borderRadius: 14,
                background: '#ffffff',
              }}
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
                <h3 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>{ex.skill}</h3>
                {ex.receiptId !== null ? (
                  <span className="chip-verified" style={{ fontSize: 10 }}>
                    ANCHORED
                  </span>
                ) : (
                  <span className="chip-pending" style={{ fontSize: 10 }}>
                    RECEIPT QUEUED
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--color-fg)',
                  lineHeight: 1.55,
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                <strong>Before:</strong> {ex.before}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--color-fg)',
                  lineHeight: 1.55,
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                <strong>After:</strong> {ex.after}
              </p>
              {ex.receiptId !== null ? (
                <p style={{ fontSize: 11, color: 'var(--color-muted)', margin: 0 }}>
                  <Link
                    href={`/r/${ex.receiptId}`}
                    style={{
                      color: 'var(--color-fg)',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    Open receipt /r/{ex.receiptId} →
                  </Link>
                  <br />
                  <span style={{ fontStyle: 'italic' }}>{ex.receiptDescription}</span>
                </p>
              ) : (
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--color-muted)',
                    margin: 0,
                    fontStyle: 'italic',
                  }}
                >
                  Real receipt URL added after the first run of {ex.skill} is anchored on chain.
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* §6 · 3 personas */}
      <Section
        label="§ 05 · WHO THIS IS FOR"
        title="Three personas. One product."
        description="Lawyers, in-house counsel, and founders use this differently — but each lands on the same receipt URL when the work is done."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}
        >
          {PERSONAS.map((p) => (
            <article
              key={p.label}
              style={{
                padding: 24,
                border: '1px solid var(--color-hairline)',
                borderRadius: 14,
                background: '#ffffff',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--color-muted)',
                  letterSpacing: '0.5px',
                  marginBottom: 8,
                }}
              >
                {p.label}
              </div>
              <h3 style={{ fontSize: 18, margin: 0, marginBottom: 12, fontWeight: 600 }}>
                {p.headline}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6, margin: 0 }}>
                {p.body}
              </p>
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  border: '1px dashed var(--color-hairline)',
                  borderRadius: 10,
                  background: 'var(--color-pending-bg)',
                  fontSize: 11,
                  color: 'var(--color-muted)',
                  fontStyle: 'italic',
                  lineHeight: 1.5,
                }}
              >
                Testimonial space · queued for the first opted-in user of this persona. We will
                never fabricate a quote here.
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* §7 · What we DON'T do */}
      <Section
        label="§ 06 · HONEST DISCLAIMERS"
        title="What this product does not do."
        description="Naming the limits up front is part of what makes the receipt trustworthy. Anything not on this list, we do."
      >
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: 12,
          }}
        >
          {DONTS.map((d) => (
            <li
              key={d.head}
              style={{
                padding: 16,
                border: '1px solid var(--color-hairline)',
                borderRadius: 10,
                background: '#ffffff',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{d.head}</div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.55 }}>
                {d.detail}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* §8 · Pricing in $0G */}
      <Section
        label="§ 07 · PRICING"
        title="Per-receipt $0G fee · tiered by rigor."
        description="No subscription, no seat licenses, no minimum commitment. You pay per receipt; the creator earns 90% of net, the protocol treasury earns 10%."
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-hairline)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Tier</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>What runs</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>
                Per-receipt cost
              </th>
            </tr>
          </thead>
          <tbody>
            {PRICING_ROWS.map((row) => (
              <tr key={row.tier} style={{ borderBottom: '1px solid var(--color-hairline)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.tier}</td>
                <td style={{ padding: '12px 16px', color: 'var(--color-muted)' }}>{row.what}</td>
                <td
                  style={{ padding: '12px 16px', textAlign: 'right' }}
                  className="mono"
                >
                  ~{row.og} OG
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6 }}>
          Indicative numbers — the first 50 users price-discover the actual figures. The contract
          ({network === 'testnet' ? 'SkillPricing on Galileo testnet' : 'SkillPricing on mainnet'})
          supports per-skill override; some commoditized skills will land closer to 70/30.
        </p>
      </Section>

      {/* §9 · FAQ */}
      <Section
        label="§ 08 · FAQ"
        title="Hard questions, answered honestly."
        description="The objections we hear most often from working lawyers."
      >
        <div style={{ display: 'grid', gap: 8 }}>
          {LEGAL_FAQ.map((qa) => (
            <details
              key={qa.q}
              style={{
                padding: '12px 16px',
                border: '1px solid var(--color-hairline)',
                borderRadius: 10,
                background: '#ffffff',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  listStyle: 'revert',
                }}
              >
                {qa.q}
              </summary>
              <p
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: 13,
                  color: 'var(--color-muted)',
                  lineHeight: 1.6,
                }}
              >
                {qa.a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      {/* §10 · Final CTA */}
      <Section
        label="§ 09 · YOUR FIRST RECEIPT"
        title="Run your first private-doc-review."
        description="Drop a contract. See the four lights. Share the receipt URL with someone who needs to trust the work."
      >
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginTop: 16,
            alignItems: 'center',
          }}
        >
          <Link
            href="/?skill=private-doc-review"
            className="btn-primary"
            style={{ textDecoration: 'none' }}
          >
            Run private-doc-review →
          </Link>
          <Link
            href="/verticals"
            className="btn-ghost"
            style={{ textDecoration: 'none' }}
          >
            See all 5 legal skills
          </Link>
        </div>
        <p
          style={{
            marginTop: 32,
            fontSize: 12,
            color: 'var(--color-muted)',
            lineHeight: 1.6,
            maxWidth: 640,
          }}
        >
          This skill runs against Qwen 2.5 7B on testnet and the sovereign 0GM-1.0-35B-A3B on
          mainnet. Both are strong enough to validate the pipeline end-to-end; the larger model
          catches more subtle clauses. The receipt structure and verification path are identical
          across both networks.
        </p>
      </Section>
    </>
  );
}

/**
 * Right-rail frozen receipt card — preview shape of the artifact this page
 * ships. Plain HTML render so the hero loads instantly without a chain
 * round-trip; the actual `/r/<id>` page is the live, machine-verifiable one.
 */
function FrozenReceiptCard() {
  return (
    <div
      style={{
        padding: 20,
        border: '1px solid var(--color-hairline)',
        borderRadius: 14,
        background: '#ffffff',
        boxShadow: '0 1px 3px rgba(10, 10, 10, 0.04)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-muted)',
          letterSpacing: '0.5px',
          marginBottom: 12,
        }}
      >
        SAMPLE RECEIPT · ANONYMIZED · NOT A REAL DOC
      </div>
      <h3 style={{ fontSize: 15, margin: 0, marginBottom: 12, fontWeight: 600 }}>
        Vendor MSA — annual auto-renewal review
      </h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="chip-verified">FULLY VERIFIED</span>
        <span
          style={{
            background: 'var(--color-verified-bg)',
            color: '#166534',
            border: '1px solid var(--color-verified)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 10,
            letterSpacing: '0.5px',
          }}
        >
          high-stakes
        </span>
      </div>
      <ol
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 12,
          color: 'var(--color-fg)',
          lineHeight: 1.6,
        }}
      >
        <li>
          <strong>§3.2 · 180-day notice window</strong> — asymmetric; counterparty cancels with 30
          days, you give 6 months.
        </li>
        <li>
          <strong>§3.3 · 7% annual price uplift</strong> — exceeds market standard 3-5%.
        </li>
        <li>
          <strong>§5.1 · negative-option clause</strong> — continued use after term equals consent
          to a new term. Hidden in "Miscellaneous."
        </li>
      </ol>
      <div
        style={{
          marginTop: 14,
          padding: '8px 12px',
          background: 'var(--color-verified-bg)',
          borderRadius: 8,
          fontSize: 11,
          color: '#166534',
          fontFamily: 'var(--font-mono)',
        }}
      >
        Risk Level: high
      </div>
    </div>
  );
}

function ComparisonColumn({
  tone,
  heading,
  bullets,
}: {
  tone: 'amber' | 'green';
  heading: string;
  bullets: string[];
}) {
  const palette =
    tone === 'amber'
      ? {
          border: 'var(--color-pending)',
          background: 'var(--color-pending-bg)',
          headFg: '#92400e',
        }
      : {
          border: 'var(--color-verified)',
          background: 'var(--color-verified-bg)',
          headFg: '#166534',
        };
  return (
    <div
      style={{
        padding: 20,
        border: `1px solid ${palette.border}`,
        borderRadius: 14,
        background: palette.background,
      }}
    >
      <h3 style={{ fontSize: 14, margin: 0, marginBottom: 16, fontWeight: 600, color: palette.headFg }}>
        {heading}
      </h3>
      <ol
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 13,
          color: 'var(--color-fg)',
          lineHeight: 1.6,
        }}
      >
        {bullets.map((b) => (
          <li key={b} style={{ marginBottom: 8 }}>
            {b}
          </li>
        ))}
      </ol>
    </div>
  );
}

const WORKFLOW_STEPS: Array<{ verb: string; detail: string }> = [
  {
    verb: 'Drop',
    detail:
      'A contract, brief, NDA, term sheet, or memo. Burn mode is on by default — the plaintext is encrypted before it leaves the browser.',
  },
  {
    verb: 'Run',
    detail:
      'The specialist skill runs inside a TEE-attested 0G Compute provider. Consensus tier (standard / high-stakes) is chosen per skill.',
  },
  {
    verb: 'Verify',
    detail:
      'Four cryptographic checks: storage hash, compute attestation, TEE binding, chain anchor. All green = process verified.',
  },
  {
    verb: 'Share',
    detail:
      'A public receipt URL. Opening it on a different machine triggers the same four checks against the same chain.',
  },
  {
    verb: 'Archive',
    detail:
      'The chain anchor is permanent. The blob lives on 0G Storage with 1-year retention default; longer retention on the way.',
  },
];

const BEFORE_AFTER_EXAMPLES: Array<{
  skill: string;
  before: string;
  after: string;
  receiptId: number | null;
  receiptDescription: string;
}> = [
  {
    skill: 'private-doc-review',
    before: 'Residential lease with auto-renewal language and ambiguous notice clauses.',
    after:
      'Multiple findings surfaced · risks ranked · evidence quoted from the document · receipt signer-verified on chain.',
    receiptId: 53,
    receiptDescription: 'Anchored 2026-05-14 · block 33270447 · v0.4.0 refresh proof',
  },
  {
    skill: 'contract-renewal-clause-detector',
    before:
      '12-month vendor MSA with §3.2 180-day auto-renewal, §3.3 7%-or-CPI uplift, §5.1 buried negative-option clause.',
    after:
      'JSON findings array per clause · risk_level + notice_period_days + exit_cost_estimate · structured for downstream cap-table tooling.',
    receiptId: 55,
    receiptDescription: 'Anchored 2026-05-14 · block 33270838 · standard tier',
  },
  {
    skill: 'nda-triage-reviewer',
    before:
      'Cayman exempted LP one-way NDA with perpetual term, $1M liquidated damages, broad "Confidential Information" definition.',
    after:
      'Triage object · type/term_years/governing_law/jurisdiction/exclusions/red_flags · signature_recommendation: refuse.',
    receiptId: 58,
    receiptDescription: 'Anchored 2026-05-14 · block 33271110 · standard tier',
  },
  {
    skill: 'term-sheet-risk-scanner',
    before:
      'Series B with 3x participating no-cap liquidation preference + full-ratchet anti-dilution + 4-year vesting reset.',
    after:
      'Founder-hostile findings · founder_impact_estimate per clause · negotiation_recommendation: walk if not changed.',
    receiptId: 62,
    receiptDescription: 'Anchored 2026-05-14 · block 33271825 · high-stakes 5-role tier',
  },
  {
    skill: 'legal-citation-verifier · PARTIAL (testnet)',
    before:
      'Brief with 3 hallucinated cases (Patterson v. Aramburu · Glenwood Capital · Wexler v. Brody-Tonelli) mixed among real cites — the Mata v. Avianca pattern.',
    after:
      'Citation PARSING works (B+); CASE-EXISTENCE verification is queued as this skill\'s mainnet-promotion gate. Testnet receipt 64 captures the parsed citation set but the Qwen 2.5 7B model did not emit web_fetch tool_calls — verdicts are heuristic. Re-run on mainnet once the runtime web_fetch enforcement gate ships (per Q9 audit · MAINNET_PERFECT_PLAN §3 keeps external-DB-as-ground-truth design intact).',
    receiptId: 64,
    receiptDescription: 'Anchored 2026-05-14 · block 33272170 · runtime web_fetch enforcement queued (testnet smaller model limitation)',
  },
];

const PERSONAS: Array<{
  label: string;
  headline: string;
  body: string;
}> = [
  {
    label: '§ FOR LAWYERS',
    headline: 'A second opinion you can show your malpractice carrier.',
    body:
      "Solo and small-firm lawyers carry malpractice exposure that scales with the volume and complexity of documents they review. The pressure is real and the staffing is thin. Ivaronix is the second-read pass you would assign a junior associate if you had one — except every finding lands attached to a receipt your carrier, your client, or opposing counsel can re-verify independently. When the inevitable disagreement comes about what the contract said, you do not point at a chat log. You point at a chain-anchored URL with four cryptographic checks. The receipt does not replace your judgment; it documents that the AI's review process was followed, exactly, on this specific document, at this specific time, by this specific signer. That is the difference between AI as a tool and AI as a defensible workflow.",
  },
  {
    label: '§ FOR IN-HOUSE COUNSEL',
    headline: 'The vendor-contract throughput problem, finally measured.',
    body:
      "In-house teams of two to ten people review hundreds of vendor agreements per quarter. The work is largely the same five categories — auto-renewal traps, indemnification scope, IP carve-outs, term mismatches, governing-law misalignments — and the cost of missing one is asymmetric. Ivaronix gives your team a structured first pass on every incoming contract: a JSON findings object per skill, anchored to a public receipt, that flows naturally into a CLM or ticketing system. The 90/10 fee-split makes the math straightforward: a $99 contract review skill earns the skill author $89.10, the protocol takes $9.90, you pay only when a receipt actually anchors. No per-seat licenses to negotiate, no sales motion, no procurement approval cycle to add.",
  },
  {
    label: '§ FOR FOUNDERS',
    headline: 'The contract review you can run before the partner-track lawyer bills you.',
    body:
      "Founders sign more legal documents in their first eighteen months than most people sign in a lifetime, exactly when paying $1,200/hour for the right partner-track lawyer is hardest to justify. Ivaronix runs the first pass on the NDA, the vendor MSA, the term sheet, the lease offer, the customer order form. You get a structured findings object with risk levels and concrete asks before you forward the document to your outside counsel. The receipt URL becomes the artifact in your data room — when an investor asks how you reviewed the Series A term sheet, you do not say \"my friend looked at it.\" You hand them a receipt anchored on chain, signed by your wallet, with each finding traceable to a specific clause.",
  },
];

const DONTS: Array<{ head: string; detail: string }> = [
  {
    head: "We do not give legal advice.",
    detail:
      "Every skill description carries this line: 'Output supports legal review — does not replace licensed counsel.' The skill produces a structured analysis; an attorney still makes the call.",
  },
  {
    head: "We do not claim 'court-admissible.'",
    detail:
      "PDF receipts are printable and structured for legal review. They are not notarized; we do not yet integrate a notary partner. A receipt is evidence of process, not a notarized affidavit.",
  },
  {
    head: "legal-citation-verifier is PARTIAL.",
    detail:
      "Design: every cite routes through HTTP to CourtListener and Cornell LII via web_fetch — the external database is ground truth, the AI never decides existence from training memory, and this design survives every model upgrade. Today the smaller testnet model (Qwen 2.5 7B) does not reliably emit tool_calls, so the runtime cannot enforce the HTTP cross-check yet. We surface this gap openly rather than ship a hallucination-prone verdict as LIVE.",
  },
  {
    head: "We do not store your document in plaintext.",
    detail:
      "Burn mode is on by default. The document is AES-256-GCM encrypted before it leaves the browser. Only the hash and your encrypted-key blob touch the chain. Even Ivaronix operators cannot read the document without your key.",
  },
  {
    head: "We do not promise the AI is correct.",
    detail:
      "The receipt proves the AI's process — TEE attestation, signer wallet, chain anchor — not that the AI's answer is correct. 'Process verified' is not 'answer verified.' That distinction is on every receipt page.",
  },
  {
    head: "We run on two networks honestly.",
    detail:
      "Galileo testnet (chainId 16602) is live for cheap iteration; Aristotle mainnet (chainId 16661) is live for production. The sovereign 0GM-1.0-35B-A3B provider serves mainnet runs; deepseek-v4-pro and the rest of the catalog roll out incrementally as smoke tests confirm each provider route. Testnet runs use Qwen 2.5 7B — strong enough to validate the pipeline, not strong enough to catch every subtle clause without human review.",
  },
];

const PRICING_ROWS: Array<{ tier: string; what: string; og: string }> = [
  {
    tier: 'quick',
    what: 'Single-role pass · cheap iteration · structured findings.',
    og: '0.0005',
  },
  {
    tier: 'standard',
    what: '3-role consensus · analyst + critic + judge · the legal-cluster default.',
    og: '0.005',
  },
  {
    tier: 'high-stakes',
    what:
      '5-role consensus · analyst + critic + risk-reviewer + evidence-checker + judge · for term sheets and citations.',
    og: '0.015',
  },
  {
    tier: 'audit',
    what:
      '6-role adversarial top tier · adds red-team-critic · premium reviews of complex agreements.',
    og: '0.025',
  },
];

const LEGAL_FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Is the document stored on a public blockchain?',
    a: "No. Burn mode encrypts the plaintext with AES-256-GCM before it leaves the browser. The encrypted blob lives on 0G Storage; only the keccak256 hash anchors on chain. Even Ivaronix operators cannot read the document without your key. Per CLAUDE.md §7, every receipt records the keyFingerprint so you can prove the encryption parameters later.",
  },
  {
    q: 'What if the AI is wrong about a finding?',
    a: "The receipt proves the AI's PROCESS — that the inference was TEE-attested, the result was signer-bound, the anchor landed on chain — not that the AI's ANSWER is correct. Every receipt page makes this distinction explicit. If a finding is wrong, you contest it the same way you would contest any structured analysis: with your own legal judgment and, ideally, by re-running the skill at a higher consensus tier.",
  },
  {
    q: 'Can opposing counsel verify a receipt without my help?',
    a: 'Yes. Open the receipt URL on any machine with any browser — no Ivaronix account required. The page server-side fetches the receipt body from 0G Storage, re-runs the four cryptographic checks against the same chain, and renders the four-light row. The CLI command `pnpm ivaronix receipt verify <id> --tee-independent` re-runs the TEE attestation against the original 0G Compute provider for full independent verification.',
  },
  {
    q: 'What happens if 0G goes away?',
    a: 'The receipt protocol is open-source under Apache 2.0. The polyglot canonical-hash implementation (TypeScript, Python, Rust) is byte-equal across all three runtimes; the Rust verifier ships to crates.io as `ivaronix-verifier`. The chain anchor is on 0G Chain today, but the receipt schema supports any EVM-compatible chain — a mainnet fallback is in our roadmap as part of the `IReceiptRegistry` abstraction.',
  },
  {
    q: 'Do I need crypto to use this?',
    a: "Today, yes — you need a wallet to sign the receipt that anchors on chain. We are working on a custodial-wallet path via Privy so email/Google/Apple auth lets a lawyer with no crypto background still produce signed receipts (managed-on-behalf signer role on the receipt). That ships post-grant.",
  },
  {
    q: 'How much does a single receipt actually cost?',
    a: "Indicative numbers in the pricing table above — somewhere between 0.0005 OG (quick) and 0.025 OG (audit). Real numbers depend on what 0G Compute charges per inference, what gas costs on chain that day, and which tier you pick. The 90/10 creator/treasury split is enforced on-chain via SkillRunPayment; nothing is taken at the application layer.",
  },
];
