import Link from 'next/link';
import type { Metadata } from 'next';
import { Section } from '@/components/Section';

export const metadata: Metadata = {
  title: 'FAQ · Ivaronix',
  description:
    'Honest answers to the questions a real user or judge would ask: trust, chain dependency, costs, tiers, verification, mainnet status.',
};

/**
 * Dedicated FAQ page · final-plan §1.6 day 19-22 content gap.
 *
 * Twelve hard objections answered honestly. Voice per CLAUDE.md §9
 * (terse, technical, blunt; no banned words; show specifics, not
 * adjectives). Receipts attest to the process, never to the verdict.
 *
 * Server component. Brand tokens only — no raw hex literals. Renders
 * cleanly at desktop and at 375×812 mobile.
 */

type Tone = 'green' | 'amber';

type Faq = {
  id: string;
  q: string;
  short: string;
  body: React.ReactNode;
  tone?: Tone;
  defaultOpen?: boolean;
};

// ──────────────────────────────────────────────────────────────────────
// Shared style objects (brand tokens only) — declared above FAQS so the
// module-level array can reference them without temporal-dead-zone hits.
// ──────────────────────────────────────────────────────────────────────

const pStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.65,
  color: 'var(--color-fg)',
  margin: '0 0 14px',
};

const ulStyle: React.CSSProperties = {
  margin: '0 0 14px',
  paddingLeft: 22,
};

const liStyle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.6,
  color: 'var(--color-fg)',
  marginBottom: 8,
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.9em',
  padding: '1px 6px',
  background: 'var(--color-tonal)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 4,
  margin: '0 2px',
};

const navLinkStyle: React.CSSProperties = {
  color: 'var(--color-fg)',
  textDecoration: 'none',
  borderBottom: '1px solid transparent',
};

const inlineLinkStyle: React.CSSProperties = {
  color: 'var(--color-fg)',
  textDecoration: 'underline',
  textDecorationColor: 'var(--color-hairline)',
  textUnderlineOffset: 2,
};

const FAQS: ReadonlyArray<Faq> = [
  {
    id: 'trust',
    q: 'Why should I trust an AI to review my contract?',
    short: 'You do not have to. The receipt attests to the process, not the verdict.',
    defaultOpen: true,
    body: (
      <>
        <p style={pStyle}>
          The receipt does not claim the answer is correct. It claims four
          things about the run that produced the answer:
        </p>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <Mono>storage</Mono> — the document body hashes to the recorded
            <Mono>receiptRoot</Mono>.
          </li>
          <li style={liStyle}>
            <Mono>compute</Mono> — the inference ran on a recorded provider.
          </li>
          <li style={liStyle}>
            <Mono>tee</Mono> — the provider attestation re-checks from a second
            machine.
          </li>
          <li style={liStyle}>
            <Mono>chain</Mono> — the anchor row matches the off-chain JSON.
          </li>
        </ul>
        <p style={pStyle}>
          You judge the answer the same way you would judge any second
          opinion. We give you a tamper-evident transcript so the opinion
          cannot be quietly rewritten later.
        </p>
      </>
    ),
  },
  {
    id: 'chatgpt',
    q: 'How is this different from ChatGPT?',
    short:
      'ChatGPT does not sign its outputs. Ivaronix produces a signed receipt for every run.',
    defaultOpen: true,
    body: (
      <>
        <p style={pStyle}>
          A ChatGPT screenshot proves nothing. There is no way to show a
          specific answer came from a specific model on a specific day, and
          there is no way to point a third party at an independent record
          that they could re-check on their own.
        </p>
        <p style={pStyle}>
          Every Ivaronix run produces a JSON receipt. The receipt is signed
          by the wallet that owns the agent passport, anchored on chain, and
          tied to the inference provider that ran it. A stranger who has
          never used Ivaronix can re-verify it from the CLI on their own
          machine.
        </p>
      </>
    ),
  },
  {
    id: 'down',
    q: 'What if 0G goes down? Are my receipts still verifiable?',
    short:
      'Yes. Receipts are content-addressed and chain-anchored; any archive node can serve them.',
    defaultOpen: true,
    body: (
      <>
        <p style={pStyle}>
          The receipt body is canonicalised with RFC-8785 JCS and hashed
          with keccak256. The hash is what the signature signs and what the
          anchor row stores. None of those steps need our infrastructure.
        </p>
        <p style={pStyle}>
          If the indexer disappears, the four-light row would render
          <Mono>storage</Mono> amber and the remaining three green. The
          receipt still proves who signed what and when. Anyone with an
          archive node for the 0G chain can pull the anchor row; anyone
          with the receipt JSON can re-hash it and recover the signer.
        </p>
      </>
    ),
  },
  {
    id: 'why-chain',
    q: 'Why does this need a blockchain at all?',
    short:
      'The chain is the cheapest tamper-evident timestamp and signature target we can lean on.',
    body: (
      <>
        <p style={pStyle}>
          We do not put the document on chain. We do not put the answer on
          chain. The chain stores a 32-byte root, the agent address, the
          receipt type, and the block timestamp. That is enough to prove
          the receipt existed at a given moment and was signed by a given
          identity.
        </p>
        <p style={pStyle}>
          A centralised database could do the same thing on paper, but the
          database operator can rewrite history. A public chain cannot,
          unless you trust 51% of validators to collude against a single
          row. That trade is worth the gas cost on a per-run basis.
        </p>
      </>
    ),
  },
  {
    id: 'operator-read',
    q: 'Can the operator read my document?',
    short: 'Not in burn mode. Plaintext only lives inside a 0G Compute TEE.',
    body: (
      <>
        <p style={pStyle}>
          With burn mode on, the document is encrypted with a 256-bit
          AES-GCM session key that is generated fresh per run. The
          ciphertext goes to 0G Storage. The session key only exists
          inside the 0G Compute TEE for the duration of the inference.
          The key buffer is zeroed after; we record a SHA-256 fingerprint
          of the key in the receipt so the use is auditable without
          rebuilding the key.
        </p>
        <p style={pStyle}>
          Threat model is explicit:{' '}
          <Link href="/privacy" style={inlineLinkStyle}>
            /privacy
          </Link>{' '}
          lists what burn mode defends and what it does not. Local-machine
          compromise on your side is out of scope. A subpoena to the
          operator returns ciphertext.
        </p>
      </>
    ),
  },
  {
    id: 'tiers',
    q: 'What does TIER 1 vs TIER 2 mean on a receipt?',
    short:
      'TIER 1 ran inside a 0G Compute TEE with attestation. TIER 2 ran on an external provider that signed but did not attest.',
    tone: 'amber',
    body: (
      <>
        <p style={pStyle}>
          The single field that decides this is{' '}
          <Mono>teeVerification.verificationMethod</Mono>:
        </p>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <Mono>router_flag</Mono> or{' '}
            <Mono>compute_sdk_process_response</Mono> → TIER 1. The TEE
            attestation re-checks from a second machine. The pill is
            green.
          </li>
          <li style={liStyle}>
            <Mono>external-signed</Mono> → TIER 2. The inference ran on
            NVIDIA NIM, OpenAI, or a local model. The signature and the
            chain anchor still verify, but the plaintext was visible to
            the external operator for the duration of the call. The pill
            is amber. We render the amber on purpose.
          </li>
        </ul>
        <p style={pStyle}>
          Both tiers are real. The amber is honest, not a downgrade — the
          receipt does not lie about which provider ran it.
        </p>
      </>
    ),
  },
  {
    id: 'cost',
    q: 'How much does a run cost?',
    short:
      'A small per-run payment in OG. Each skill sets its own price; the default split is 90 / 10 creator / treasury.',
    body: (
      <>
        <p style={pStyle}>
          Price is set per skill, in OG, and is visible before you run
          anything. The split is encoded in the skill manifest under{' '}
          <Mono>og.creator.fee_split</Mono> as a basis-points pair that
          sums to 10000. The default is 9000 / 1000 (creator 90% /
          treasury 10%). Commoditised skill categories default to 7000 /
          3000.
        </p>
        <p style={pStyle}>
          Payment happens on chain. The receipt anchors after the
          payment clears, so a run that did not pay never produces a
          receipt that looks paid.
        </p>
      </>
    ),
  },
  {
    id: 'own-provider',
    q: 'Can I bring my own AI provider?',
    short:
      'Yes. Point at a NVIDIA NIM endpoint or any OpenAI-compatible API. The receipt marks it TIER 2 honestly.',
    body: (
      <>
        <p style={pStyle}>
          The router accepts a credential of kind <Mono>nim</Mono> or
          <Mono>openai-compatible</Mono> alongside the default 0G Compute
          route. The pipeline is identical: the same canonical hash, the
          same signature, the same chain anchor.
        </p>
        <p style={pStyle}>
          The only difference is the <Mono>verificationMethod</Mono>{' '}
          field, which captures the truth about where the inference ran.
          A TIER 2 receipt is still a real receipt; it is just amber on
          the TEE pill and we say so to anyone who opens the proof page.
        </p>
      </>
    ),
  },
  {
    id: 'independent',
    q: 'What does "independent verification" actually mean?',
    short:
      'A stranger runs the verifier on their own machine and reaches the same answer without trusting us.',
    body: (
      <>
        <p style={pStyle}>
          Two replay paths exist today, both runnable without our
          servers:
        </p>
        <ul style={ulStyle}>
          <li style={liStyle}>
            <Mono>ivaronix receipt verify &lt;id&gt; --tee-independent</Mono>{' '}
            — re-runs <Mono>broker.processResponse</Mono> against the
            recorded 0G Compute provider, re-hashes the canonical body,
            recovers the signer, and cross-checks the anchor row. Returns{' '}
            <Mono>FULLY VERIFIED</Mono> or a precise failure mode.
          </li>
          <li style={liStyle}>
            A custom verifier in any language. The canonical hash is
            RFC-8785 JCS over the receipt body minus three fields
            (<Mono>signature</Mono>, <Mono>id</Mono>,{' '}
            <Mono>chainAnchor</Mono>). A third-party auditor can write
            their own and reach the same root.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'pending',
    q: 'Why does the receipt page sometimes show PENDING?',
    short:
      'The chain anchor exists but the local body cache is empty. Re-fetch the body and the receipt verifies normally.',
    body: (
      <>
        <p style={pStyle}>
          The proof page hydrates the receipt body from 0G Storage and
          falls back to a local cache when the indexer is slow. While
          neither has returned yet, the page renders{' '}
          <Mono>PENDING</Mono> on the body pill. The chain anchor is
          already confirmed at that point — that is why the four-light
          row still has its other pills green.
        </p>
        <p style={pStyle}>
          Reload, or run{' '}
          <Mono>ivaronix receipt show &lt;id&gt;</Mono> from the CLI; the
          body comes back, the hash is re-verified, the pill turns green.
          No receipt has been lost.
        </p>
      </>
    ),
  },
  {
    id: 'mainnet',
    q: 'Is this on mainnet?',
    short:
      'Yes — Aristotle mainnet (chainId 16661) shipped 2026-05-15. 10 contracts, 13 receipt-type slots, real on-chain anchors today. Galileo testnet stays live for the larger receipt history.',
    body: (
      <>
        <p style={pStyle}>
          Mainnet is live. Aristotle (chainId 16661) carries 10 deployed
          contracts and the full set of 13 receipt-type slots. Chainscan
          links resolve to <Mono>chainscan.0g.ai</Mono> for mainnet
          addresses. The verifier returns <Mono>FULLY VERIFIED</Mono> on
          mainnet receipts via{' '}
          <Mono>broker.processResponse</Mono> attestation, and the
          marketplace pays in real OG with the same 90/10 creator/
          treasury split as the testnet build.
        </p>
        <p style={pStyle}>
          Galileo testnet (chainId 16602) stays live. It carries the
          larger receipt history (1,737+ anchored across V1+V2+V3),
          serves the JUDGE_GUIDE walkthrough, and is the default for{' '}
          <Mono>ivaronix demo</Mono>. The studio reads whichever network{' '}
          <Mono>IVARONIX_NETWORK</Mono> points at; the build serving
          this UI right now is whichever one the deployment env says.
          On-chain history never migrates — each network keeps its own
          ledger.
        </p>
      </>
    ),
  },
  {
    id: 'source',
    q: 'Where is the source code?',
    short:
      'Open on GitHub. CLI, studio, contracts, and verifiers in three languages are all public.',
    body: (
      <>
        <p style={pStyle}>
          The monorepo holds the studio (Next.js), the CLI (Node.js),
          the Solidity contracts and Foundry tests, and three
          independent verifiers (TypeScript, Python, Rust) that agree
          byte-for-byte on the canonical hash.
        </p>
        <p style={pStyle}>
          A reviewer can clone, install, and run a verifiable demo with
          a public testnet wallet in under five minutes. The README
          carries the exact commands; the JUDGE_GUIDE walks the same
          path with screenshots.
        </p>
      </>
    ),
  },
  {
    id: 'what-is-tee',
    q: 'What is a TEE, and why does it matter here?',
    short:
      'A Trusted Execution Environment is a hardware-isolated region where the operator cannot read the data being processed.',
    body: (
      <>
        <p style={pStyle}>
          A TEE is a CPU feature (Intel TDX, AMD SEV, NVIDIA H100 with confidential
          compute) that runs your code in an isolated memory region. The host
          operating system and the operator of the machine see encrypted memory
          pages only. The TEE produces an attestation — a signed quote that proves
          which code ran on which hardware.
        </p>
        <p style={pStyle}>
          On 0G Compute, inference for TIER 1 receipts runs inside a TEE. The receipt
          records the provider address and an attestation hash; any reviewer can
          re-run <Mono>broker.processResponse</Mono> against the recorded provider
          and confirm the attestation. The provider cannot read your prompt; the
          operator cannot read it either. That is the trust improvement over
          standard API inference.
        </p>
        <p style={pStyle}>
          The TEE does not promise the answer is correct. It promises the run
          happened on the model and provider it claims, with no operator-side
          interception. The four-light row on the receipt page shows this status
          as the TEE light: green when re-attestation passes, grey when the
          channel is transiently unreachable.
        </p>
      </>
    ),
  },
  {
    id: 'creator-earnings',
    q: 'How does a skill creator actually get paid?',
    short:
      'Every paid run anchors a SkillRunPayment tx. 90% of the price accrues to the creator wallet; 10% to treasury. Withdraw on demand.',
    body: (
      <>
        <p style={pStyle}>
          Publishing a skill sets a price in <Mono>SkillPricing</Mono> and a fee-split
          (default 90% creator / 10% treasury; commoditised categories use 70/30).
          When a buyer runs the skill, the studio calls{' '}
          <Mono>SkillRunPayment.paySkillRun</Mono> with the receipt root, creator
          address, and bps split. The contract holds the OG and credits the
          creator + treasury balances atomically.
        </p>
        <p style={pStyle}>
          The creator opens <Link href="/marketplace/payouts" style={{ color: 'var(--color-fg)' }}>/marketplace/payouts</Link>{' '}
          and clicks Withdraw. The contract pays the full earned balance back to
          the creator wallet in one tx. Every paid run + every withdraw is a real
          on-chain event; nothing accrues off chain.
        </p>
        <p style={pStyle}>
          The 90/10 split is settable per skill at publish time. Treasury share
          funds infrastructure (RPC + indexer + KV sidecar). The contract emits
          a <Mono>SkillRunPaid</Mono> event with creatorShare + treasuryShare so
          subgraphs and dashboards can reconcile without rescanning every receipt.
        </p>
      </>
    ),
  },
  {
    id: 'provider-compromise',
    q: 'What if the 0G Compute provider itself is compromised?',
    short:
      'The receipt records which provider ran the inference. A reviewer can re-attest against that provider, or refuse to trust it.',
    body: (
      <>
        <p style={pStyle}>
          A compromised provider could serve a different model than the receipt
          claims. The TEE attestation is the defence: a fake provider cannot
          produce a valid attestation that names the real provider's hardware
          identity. The reviewer re-runs <Mono>broker.processResponse</Mono>{' '}
          against the recorded provider address; if the attestation does not match,
          the verify chip stays grey.
        </p>
        <p style={pStyle}>
          A compromised provider that controls a real TEE could still serve a
          quantised or fine-tuned version of the advertised model. The receipt
          does not promise model fidelity at that level; it promises the inference
          ran on the named hardware with the named model identifier. Higher-stakes
          settings should run the same prompt across multiple providers and compare —
          the consensus tier (analyst + critic + judge) is the in-product answer
          for that, but a buyer can also run the same skill on a different operator
          and diff the receipts.
        </p>
        <p style={pStyle}>
          What the receipt absolutely defends against: a relay (the OpenAI-compatible
          Router that fronts the 0G Compute network) silently swapping providers.
          The Router cannot forge an attestation for a provider it does not
          control. If the Router returns a different model than the receipt claims,
          the TEE re-attestation fails and the receipt is honest about it.
        </p>
      </>
    ),
  },
];

export default async function FaqPage(): Promise<React.JSX.Element> {
  return (
    <article>
      <header
        style={{
          padding: '96px 24px 0',
          maxWidth: 920,
          margin: '0 auto',
        }}
      >
        <div className="section-label" style={{ marginBottom: 16 }}>
          Frequently asked
        </div>
        <h1
          style={{
            fontSize: 48,
            lineHeight: 1.05,
            letterSpacing: '-1.2px',
            fontWeight: 700,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Hard questions,{' '}
          <span className="italic-display" style={{ fontWeight: 400 }}>
            answered honestly.
          </span>
        </h1>
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: 'var(--color-muted)',
            margin: 0,
            maxWidth: 720,
          }}
        >
          Real objections, not marketing softballs. If an answer is
          uncomfortable, that is the answer. The receipt does not flatter
          us — we do not flatter the FAQ either.
        </p>

        <nav
          aria-label="Question index"
          style={{
            marginTop: 40,
            padding: 24,
            background: 'var(--color-tonal)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            lineHeight: 1.8,
          }}
        >
          <ol
            style={{
              margin: 0,
              paddingLeft: 20,
              color: 'var(--color-fg)',
              columnCount: 1,
              columnGap: 32,
            }}
            className="faq-index-list"
          >
            {FAQS.map((f) => (
              <li key={f.id}>
                <Link href={`#${f.id}`} style={navLinkStyle}>
                  {f.q}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <Section
        label="The list"
        title="Answers."
        description="The first three open by default; the rest expand on click. Mono accents point at the exact field, file, or CLI command that backs the claim."
      >
        <div>
          {FAQS.map((f, idx) => (
            <details
              key={f.id}
              id={f.id}
              open={f.defaultOpen}
              style={{
                padding: '24px 0',
                borderTop: '1px solid var(--color-hairline)',
                borderBottom:
                  idx === FAQS.length - 1 ? '1px solid var(--color-hairline)' : undefined,
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 16,
                }}
              >
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'baseline',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--color-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3
                      style={{
                        fontSize: 19,
                        lineHeight: 1.35,
                        fontWeight: 600,
                        color: 'var(--color-fg)',
                        margin: 0,
                      }}
                    >
                      {f.q}
                    </h3>
                    {f.tone === 'amber' && <AmberTag />}
                  </div>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.55,
                      color: 'var(--color-muted)',
                      margin: '8px 0 0',
                    }}
                  >
                    {f.short}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 16,
                    color: 'var(--color-muted)',
                    flexShrink: 0,
                  }}
                >
                  +
                </span>
              </summary>
              <div style={{ marginTop: 20, maxWidth: 720 }}>{f.body}</div>
            </details>
          ))}
        </div>
      </Section>

      <Section
        label="Still curious"
        title="Pick the next step."
        description="The FAQ covers objections. The proof pages and the CLI carry the actual evidence; the privacy doc carries the threat model."
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          <NextStepCard
            label="Sample receipt"
            title="Open one end-to-end"
            description="Receipt #1004 with full body, four-light row, and the signer chain."
            href="/r/1004"
          />
          <NextStepCard
            label="Privacy"
            title="What we cannot see"
            description="The explicit threat model — what burn mode defends and what it does not."
            href="/privacy"
          />
          <NextStepCard
            label="Learn"
            title="How the four lights work"
            description="One explainer per moving part: storage, compute, TEE, chain, consensus, burn."
            href="/learn"
          />
          <NextStepCard
            label="Try it"
            title="Run your own"
            description="Drop a document, run a skill, anchor a receipt. Real network, no fixtures."
            href="/onboard"
          />
        </div>
      </Section>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Small leaf components
// ──────────────────────────────────────────────────────────────────────

function Mono({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <code style={codeStyle}>{children}</code>;
}

function AmberTag(): React.JSX.Element {
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 999,
        color: 'var(--color-warning)',
        background: 'var(--color-warning-bg)',
        border: '1px solid var(--color-warning-accent)',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      Honest amber
    </span>
  );
}

function NextStepCard({
  label,
  title,
  description,
  href,
}: {
  label: string;
  title: string;
  description: string;
  href: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: 20,
        background: 'var(--color-card)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: 'var(--color-fg)',
          marginBottom: 8,
        }}
      >
        {title} →
      </div>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--color-muted)',
          margin: 0,
        }}
      >
        {description}
      </p>
    </Link>
  );
}

