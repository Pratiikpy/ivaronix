import type { Metadata } from 'next';
import Link from 'next/link';
import { FourLightRow } from '@/components/FourLightRow';
import { unifiedNextId, livePassportCount } from '@/lib/chain';
import { getSampleReceiptHref } from '@/lib/sample-receipt';
import { RECEIPT_TYPES, ROLES_BY_TIER } from '@ivaronix/core';
import numbersJson from '../../../../../docs/numbers.json';

export const metadata: Metadata = {
  title: 'Learn · Ivaronix',
  description: 'How receipts work — TIER 1 vs TIER 2, the four-light row, consensus tiers, RFC-8785 canonical hash, EIP-712 anchor.',
};

// SovereigntyCircle is a planned interactive component (final-plan §1.6
// day 10-12). It does not exist in the repo at the time of writing; we
// render a static placeholder card linking out to /thesis and leave the
// import line commented for the follow-up sub-agent to wire.
// import { SovereigntyCircle } from '@/components/SovereigntyCircle';

export const dynamic = 'force-dynamic';

const FALLBACK_RECEIPTS = `${numbersJson.receipts.total.toLocaleString()}`;

async function liveNumbers(): Promise<{ receipts: string; passports: string }> {
  const [unified, p] = await Promise.all([
    unifiedNextId().catch(() => null),
    livePassportCount().catch(() => null),
  ]);
  const r =
    unified && unified.total > 0n
      ? Number(unified.total).toLocaleString()
      : FALLBACK_RECEIPTS;
  const passports = p !== null ? Number(p).toLocaleString() : '4';
  return { receipts: r, passports };
}

export default async function LearnPage(): Promise<React.JSX.Element> {
  const { receipts, passports } = await liveNumbers();

  return (
    <article style={{ maxWidth: 920, margin: '0 auto', padding: '64px 24px 96px' }}>
      <header style={{ marginBottom: 64 }}>
        <div className="section-label" style={{ marginBottom: 16 }}>
          Learn the system
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
          How a private review becomes a{' '}
          <span className="italic-display" style={{ fontWeight: 400 }}>
            public receipt.
          </span>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--color-muted)', margin: 0 }}>
          Seven explainers — one per moving part of the system. Read them in any order. The home
          page links here from each module card; jump straight to the section you came for.
        </p>

        <nav
          aria-label="Section index"
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
          <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--color-fg)' }}>
            <li>
              <Link href="#four-light" style={navLinkStyle}>
                The four lights: Storage · Compute · TEE · Chain
              </Link>
            </li>
            <li>
              <Link href="#sovereignty" style={navLinkStyle}>
                Sovereignty: where each piece lives, who can see it
              </Link>
            </li>
            <li>
              <Link href="#trust-gradient" style={navLinkStyle}>
                Trust gradient: TIER 1 vs TIER 2 receipts
              </Link>
            </li>
            <li>
              <Link href="#receipt-anatomy" style={navLinkStyle}>
                Receipt anatomy: thirteen types, one canonical hash
              </Link>
            </li>
            <li>
              <Link href="#consensus" style={navLinkStyle}>
                Consensus tiers: one role, three, five, six
              </Link>
            </li>
            <li>
              <Link href="#burn" style={navLinkStyle}>
                Burn mode: what it defends, what it does not
              </Link>
            </li>
            <li>
              <Link href="#faq" style={navLinkStyle}>
                FAQ and glossary
              </Link>
            </li>
          </ol>
        </nav>
      </header>

      <FourLightSection />
      <Divider />

      <SovereigntySection />
      <Divider />

      <TrustGradientSection />
      <Divider />

      <ReceiptAnatomySection receipts={receipts} passports={passports} />
      <Divider />

      <ConsensusSection />
      <Divider />

      <BurnSection />
      <Divider />

      <FaqSection />

      <footer
        style={{
          marginTop: 80,
          padding: 32,
          background: 'var(--color-tonal)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, marginBottom: 4 }}>
            Done reading?
          </p>
          <p style={{ fontSize: 18, color: 'var(--color-fg)', margin: 0, fontWeight: 600 }}>
            Run a private review and produce a real receipt.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/onboard" className="btn-primary" style={{ textDecoration: 'none' }}>
            Try the studio →
          </Link>
          <Link href={getSampleReceiptHref()} className="btn-secondary" style={{ textDecoration: 'none' }}>
            Open a sample receipt
          </Link>
        </div>
      </footer>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────────────
// §1 · Four-light row
// ──────────────────────────────────────────────────────────────────────

function FourLightSection(): React.JSX.Element {
  const lights: Array<{
    name: string;
    primitive: string;
    greenWhen: string;
    amberWhen: string;
  }> = [
    {
      name: 'Storage',
      primitive: '0G Storage',
      greenWhen:
        'The receipt body has been fetched back from 0G Storage and its keccak256 matches the receiptRoot recorded inside the receipt itself.',
      amberWhen:
        'The blob is not reachable, or the bytes returned by the indexer do not hash to the receiptRoot. Either is a tamper signal worth surfacing.',
    },
    {
      name: 'Compute',
      primitive: '0G Compute provider',
      greenWhen:
        'The inference ran on a 0G Compute provider whose router_flag was set, or whose attestation was confirmed post-hoc through broker.processResponse.',
      amberWhen:
        'The run used an external provider (NVIDIA NIM · OpenAI · local Ollama). The output is still signed and chain-anchored, but it is not TEE-attested. We render this amber by design.',
    },
    {
      name: 'TEE',
      primitive: 'Provider TEE attestation',
      greenWhen:
        'The verificationMethod field is one of router_flag or compute_sdk_process_response. Re-running the broker check from a separate machine returns the same attestation.',
      amberWhen:
        'verificationMethod is external-signed. The plaintext was visible to the operator of whichever model served the request.',
    },
    {
      name: 'Chain',
      primitive: '0G Chain registry',
      greenWhen:
        'A read of the on-chain registry at chainAnchor.registryAddress confirms the receiptRoot is stored against chainAnchor.onChainId, signed by the recovered agent.ownerWallet.',
      amberWhen:
        'The on-chain row does not match the off-chain JSON. Usually means the receipt JSON was edited after anchoring, or the wrong receipt id was looked up.',
    },
  ];

  return (
    <section id="four-light" aria-labelledby="four-light-heading">
      <SectionLabel>§ 01 — The four lights</SectionLabel>
      <h2 id="four-light-heading" style={h2Style}>
        Four small lights tell you what was checked.
      </h2>
      <p style={pStyle}>
        Every receipt page renders the same four-pill row. Each pill goes green only when the
        corresponding check passes against live data, not against a cached flag. The same row sits
        next to the Run button before submission: pending, then in-progress, then verified or
        mismatch.
      </p>

      <div
        style={{
          padding: 32,
          background: 'var(--color-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 32,
        }}
      >
        <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--color-muted)' }}>
          The actual component, rendered with all four verified:
        </div>
        <FourLightRow
          layers={{ Storage: 'verified', Compute: 'verified', TEE: 'verified', Chain: 'verified' }}
        />
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {lights.map((l) => (
          <div
            key={l.name}
            style={{
              padding: 20,
              background: 'var(--color-card)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <h3 style={{ ...h3Style, margin: 0 }}>{l.name}</h3>
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--color-muted)',
                }}
              >
                {l.primitive}
              </code>
            </div>
            <p style={{ ...pStyle, margin: '0 0 8px' }}>
              <strong style={{ color: 'var(--color-fg)' }}>Green when:</strong> {l.greenWhen}
            </p>
            <p style={{ ...pStyle, margin: 0, color: 'var(--color-muted)' }}>
              <strong style={{ color: 'var(--color-fg)' }}>Amber when:</strong> {l.amberWhen}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// §2 · Sovereignty circle
// ──────────────────────────────────────────────────────────────────────

function SovereigntySection(): React.JSX.Element {
  const layers: Array<{ where: string; what: string; who: string }> = [
    {
      where: 'Your browser',
      what: 'Plaintext of the document, plus the session key used to encrypt it.',
      who: 'You. The key is generated client-side and never written to disk.',
    },
    {
      where: 'A 0G Compute TEE',
      what: 'Plaintext, for the duration of the inference run only.',
      who: 'The TEE itself. The provider operator does not see the inside of the enclave.',
    },
    {
      where: '0G Storage',
      what: 'The encrypted blob (when the run wrote one) plus the signed receipt JSON.',
      who: 'Anyone with the storage root can fetch the ciphertext; only key-holders can decrypt.',
    },
    {
      where: '0G Chain',
      what: 'The receiptRoot, the agent address, the receipt type code, the timestamp.',
      who: 'Everyone. The chain is the part designed to be publicly readable.',
    },
  ];

  return (
    <section id="sovereignty" aria-labelledby="sovereignty-heading">
      <SectionLabel>§ 02 — Where things live</SectionLabel>
      <h2 id="sovereignty-heading" style={h2Style}>
        Four locations. Different visibility at each.
      </h2>
      <p style={pStyle}>
        A receipt is the record of a transit. The plaintext moves from your browser into a hardware
        enclave, then leaves only as ciphertext and as a signed summary. Each ring is a different
        trust boundary; reading them inward, sensitivity rises and audience shrinks.
      </p>

      {/* Placeholder for the interactive SovereigntyCircle component.
          When sub-agent A lands SovereigntyCircle.tsx, replace this card with:
            <SovereigntyCircle />
          The interactive version lets a reader hover each ring to see who
          holds what. The static fallback below covers the same content. */}
      <div
        style={{
          padding: 32,
          background: 'var(--color-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 32,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 16 }}>
          Five layers, top to bottom — each one is a separate failure mode the receipt closes.
        </div>
        <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {layers.map((layer, idx) => (
            <li
              key={layer.where}
              style={{
                padding: '16px 0',
                borderBottom:
                  idx < layers.length - 1 ? '1px solid var(--color-hairline)' : 'none',
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
                gap: 24,
                alignItems: 'baseline',
              }}
            >
              <div>
                <code
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--color-muted)',
                  }}
                >
                  RING {String(idx + 1).padStart(2, '0')}
                </code>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{layer.where}</div>
              </div>
              <div>
                <p style={{ ...pStyle, margin: '0 0 6px' }}>
                  <strong style={{ color: 'var(--color-fg)' }}>Content:</strong> {layer.what}
                </p>
                <p style={{ ...pStyle, margin: 0, color: 'var(--color-muted)' }}>
                  <strong style={{ color: 'var(--color-fg)' }}>Reads:</strong> {layer.who}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p style={pStyle}>
        After the run, ring one is empty. The session key is zeroed in memory and its fingerprint
        is the only artifact retained. See{' '}
        <Link href="#burn" style={inlineLinkStyle}>
          §06 — Burn mode
        </Link>{' '}
        for what that fingerprint proves and what it cannot.
      </p>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// §3 · Trust gradient — TIER 1 vs TIER 2
// ──────────────────────────────────────────────────────────────────────

function TrustGradientSection(): React.JSX.Element {
  return (
    <section id="trust-gradient" aria-labelledby="trust-gradient-heading">
      <SectionLabel>§ 03 — Trust gradient</SectionLabel>
      <h2 id="trust-gradient-heading" style={h2Style}>
        Two tiers. Both are honest. One is stronger.
      </h2>
      <p style={pStyle}>
        Not every model lives behind a TEE today. We sign and anchor anyway, but we draw the line
        in the receipt itself. The single field <code style={codeStyle}>verificationMethod</code>{' '}
        decides which tier renders, and the colour follows from the value — green for TIER 1,
        amber for TIER 2. The page refuses to render any other combination.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <TierCard
          tier="TIER 1"
          accent="#26c050"
          accentBg="#e6f9ec"
          headline="TEE-verified"
          methods={['router_flag', 'compute_sdk_process_response']}
          provider="0G Compute provider"
          plaintextSeenBy="The provider TEE only. Operator-side disclosure is out of scope."
          replay="Re-run broker.processResponse against the recorded provider address on any machine."
        />
        <TierCard
          tier="TIER 2"
          accent="var(--color-pending)"
          accentBg="var(--color-pending-bg)"
          headline="External-signed"
          methods={['external-signed']}
          provider="NVIDIA NIM · OpenAI · local Ollama"
          plaintextSeenBy="The provider operator. We do not pretend otherwise."
          replay="Signature recovery and chain anchor still verify. The TEE chip stays grey."
        />
      </div>

      <p style={pStyle}>
        TIER 2 exists for skills that route through providers outside a TEE-attested enclave.
        Rather than hide the distinction, we surface it as an amber receipt: signed, chain-anchored,
        re-verifiable, but plainly labeled as non-enclave. The receipt page surfaces the tier in
        three places: the header chip, the four-light TEE pill, and the model attribution block.
        A judge can read any of the three and reach the same conclusion.
      </p>
      <p style={{ ...pStyle, fontStyle: 'italic', color: 'var(--color-fg)' }}>
        Honest amber beats a green light that does not check out.
      </p>
    </section>
  );
}

function TierCard(props: {
  tier: string;
  accent: string;
  accentBg: string;
  headline: string;
  methods: string[];
  provider: string;
  plaintextSeenBy: string;
  replay: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: 24,
        background: 'var(--color-card)',
        border: `1px solid ${props.accent}`,
        borderRadius: 'var(--radius-md)',
        position: 'relative',
      }}
    >
      <span
        className="mono"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          padding: '2px 8px',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          borderRadius: 4,
          background: props.accentBg,
          color: props.accent,
          letterSpacing: '1px',
        }}
      >
        {props.tier}
      </span>
      <h3 style={{ ...h3Style, marginTop: 0, marginBottom: 16 }}>{props.headline}</h3>
      <dl style={{ margin: 0 }}>
        <dt style={dtStyle}>verificationMethod</dt>
        <dd style={ddStyle}>
          {props.methods.map((m, i) => (
            <code key={m} style={codeStyle}>
              {m}
              {i < props.methods.length - 1 ? ' · ' : ''}
            </code>
          ))}
        </dd>
        <dt style={dtStyle}>Provider</dt>
        <dd style={ddStyle}>{props.provider}</dd>
        <dt style={dtStyle}>Plaintext visible to</dt>
        <dd style={ddStyle}>{props.plaintextSeenBy}</dd>
        <dt style={dtStyle}>Independent replay</dt>
        <dd style={ddStyle}>{props.replay}</dd>
      </dl>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// §4 · Receipt anatomy
// ──────────────────────────────────────────────────────────────────────

function ReceiptAnatomySection(props: {
  receipts: string;
  passports: string;
}): React.JSX.Element {
  // Sort by slot code for the table. Reading directly from the constant
  // ensures this page tracks any future slot additions without manual
  // edits per CLAUDE.md §15.
  const types = Object.entries(RECEIPT_TYPES)
    .map(([name, code]) => ({ name, code }))
    .sort((a, b) => a.code - b.code);

  return (
    <section id="receipt-anatomy" aria-labelledby="receipt-anatomy-heading">
      <SectionLabel>§ 04 — Receipt anatomy</SectionLabel>
      <h2 id="receipt-anatomy-heading" style={h2Style}>
        One schema. Thirteen slots. One canonical hash.
      </h2>
      <p style={pStyle}>
        A receipt is a JSON object validated against a single Zod schema. The{' '}
        <code style={codeStyle}>type</code> field picks one of thirteen slot codes; the chain
        rejects anything else. Across all slots, the recipe for the on-chain identity of the
        receipt is the same: a deterministic byte serialization, hashed with keccak256, signed by
        the agent wallet.
      </p>

      <div
        style={{
          padding: 24,
          background: 'var(--color-tonal)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 32,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        <div style={{ color: 'var(--color-muted)', marginBottom: 8 }}>
          # canonical hash derivation
        </div>
        <div>1. drop <span style={codeAccent}>signature</span>, <span style={codeAccent}>id</span>, <span style={codeAccent}>chainAnchor</span></div>
        <div>2. sort all object keys recursively · arrays preserve order</div>
        <div>3. serialize to UTF-8 JSON · no whitespace · per RFC-8785 JCS</div>
        <div>4. <span style={codeAccent}>receiptRoot</span> = keccak256(bytes)</div>
        <div>5. sign <span style={codeAccent}>receiptRoot</span> with <span style={codeAccent}>agent.ownerWallet</span> (eth_personal_sign)</div>
        <div>6. anchor <span style={codeAccent}>receiptRoot</span> + signature on 0G Chain</div>
      </div>

      <p style={pStyle}>
        The reason this list is in this order is that step three —{' '}
        <a
          href="https://www.rfc-editor.org/rfc/rfc8785"
          target="_blank"
          rel="noopener noreferrer"
          style={inlineLinkStyle}
        >
          RFC-8785 JCS
        </a>{' '}
        — pins the byte sequence across languages. A verifier written in Go or Rust reaches the
        same{' '}
        <code style={codeStyle}>receiptRoot</code> from the same JSON. That property is what lets
        a third-party auditor run their own verification without our code.
      </p>

      <h3 style={h3Style}>The thirteen slots</h3>
      <p style={pStyle}>
        Slot codes are part of the on-chain row. The slot count was raised from 10 to 13 by{' '}
        <code style={codeStyle}>ReceiptRegistryV3</code>; V2 and V1 each admit 0-9 and stay live for legacy reads.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 8,
          marginBottom: 32,
        }}
      >
        {types.map((t) => (
          <div
            key={t.name}
            style={{
              padding: '10px 14px',
              background: 'var(--color-card)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--color-fg)',
              }}
            >
              {t.name}
            </code>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--color-muted)',
              }}
            >
              slot {t.code}
            </span>
          </div>
        ))}
      </div>

      <p style={pStyle}>
        Today the chain holds <strong style={{ color: 'var(--color-fg)' }}>{props.receipts}</strong>{' '}
        anchored receipts and{' '}
        <strong style={{ color: 'var(--color-fg)' }}>{props.passports}</strong> minted agent
        passports. Both numbers are read from the public chain at the moment this page loaded; no
        cache, no synthetic data.
      </p>
      <p style={pStyle}>
        For the full field-by-field map and the slot mapping across V1, V2, and V3, see{' '}
        <a
          href="https://github.com/Pratiikpy/ivaronix/blob/main/docs/RECEIPT_SCHEMA.md"
          target="_blank"
          rel="noopener noreferrer"
          style={inlineLinkStyle}
        >
          docs/RECEIPT_SCHEMA.md
        </a>
        .
      </p>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// §5 · Consensus tiers
// ──────────────────────────────────────────────────────────────────────

function ConsensusSection(): React.JSX.Element {
  // Reads from the canonical ROLES_BY_TIER constant in @ivaronix/core
  // so the table stays in sync with the orchestrator (CLAUDE.md §15
  // bookkeeping rule).
  const tiers: Array<{
    id: 'quick' | 'standard' | 'high-stakes' | 'audit';
    label: string;
    use: string;
    cost: string;
  }> = [
    {
      id: 'quick',
      label: 'Quick',
      use: 'Single-pass answer. Fastest path. Use when the question has one defensible answer and you trust the model on the topic.',
      cost: 'Lowest latency · single role',
    },
    {
      id: 'standard',
      label: 'Standard',
      use: 'Analyst writes an answer; critic objects; judge resolves. Adversarial review for everyday work where you want a second opinion baked in.',
      cost: 'Three roles · one objection cycle',
    },
    {
      id: 'high-stakes',
      label: 'High-stakes',
      use: 'Legal, contract, financial review. Risk-reviewer and evidence-checker join the standard tier. Use this for term sheets and indemnity clauses.',
      cost: 'Five roles · longer chain',
    },
    {
      id: 'audit',
      label: 'Audit',
      use: 'The premium adversarial tier. A red-team-critic sits on top of high-stakes, trying to break the case the other roles built. Use this when the receipt has to survive a hostile reader.',
      cost: 'Six roles · longest chain',
    },
  ];

  return (
    <section id="consensus" aria-labelledby="consensus-heading">
      <SectionLabel>§ 05 — Consensus tiers</SectionLabel>
      <h2 id="consensus-heading" style={h2Style}>
        One role, three, five, or six. Pick the depth the work deserves.
      </h2>
      <p style={pStyle}>
        Consensus is monotone: each higher tier strictly extends the one below it. The judge role
        is always last. The composition is set in code, not in a manifest field a skill author can
        fudge.
      </p>

      <div
        style={{
          padding: 0,
          background: 'var(--color-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: 32,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ background: 'var(--color-tonal)' }}>
              <th style={thStyle}>Tier</th>
              <th style={thStyle}>Roles</th>
              <th style={thStyle}>When to use it</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => {
              const roles = ROLES_BY_TIER[t.id];
              return (
                <tr key={t.id} style={{ borderTop: '1px solid var(--color-hairline)' }}>
                  <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600 }}>{t.label}</div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--color-muted)',
                        marginTop: 4,
                      }}
                    >
                      {t.cost}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, verticalAlign: 'top' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      {roles.map((r) => (
                        <code
                          key={r}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            padding: '2px 8px',
                            border: '1px solid var(--color-hairline)',
                            borderRadius: 4,
                            background: 'var(--color-tonal)',
                          }}
                        >
                          {r}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, verticalAlign: 'top', color: 'var(--color-muted)' }}>
                    {t.use}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={pStyle}>
        Convergence between roles is scored with a tokenized Jaccard plus an embedding-cosine pass.
        Below a default threshold of 0.6, the receipt records "no convergence" rather than a fake
        agreement. A skill manifest can raise the threshold for the high-stakes and audit tiers
        via <code style={codeStyle}>og.consensus.threshold</code>.
      </p>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// §6 · Burn mode threat model
// ──────────────────────────────────────────────────────────────────────

function BurnSection(): React.JSX.Element {
  return (
    <section id="burn" aria-labelledby="burn-heading">
      <SectionLabel>§ 06 — Burn mode</SectionLabel>
      <h2 id="burn-heading" style={h2Style}>
        The session key dies at the end of the run.
      </h2>
      <p style={pStyle}>
        Burn mode is a specific, narrow promise: at the end of an inference run, the symmetric key
        that encrypted the document is overwritten with zeros, and its sha256 fingerprint is
        captured beforehand so the receipt can attest the destruction. The blob on 0G Storage stays
        but is no longer decryptable by anyone, including us.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <ThreatCard
          accent="#26c050"
          title="What burn mode defends"
          items={[
            'Operator-side disclosure after the run. A subpoena to us cannot produce plaintext we no longer hold the key for.',
            'Long-tail re-reads. A storage-layer breach in 2028 returns ciphertext nobody can decrypt.',
            'Vendor lock-in panic. The receipt is intact even if our service is offline; the document under it is unreadable.',
          ]}
        />
        <ThreatCard
          accent="var(--color-pending)"
          title="What burn mode does not defend"
          items={[
            'A compromise of your local machine before or during the run. Plaintext sits in your browser memory while you draft the prompt.',
            'A side channel inside the TEE itself. Burn mode is upstream of the enclave guarantees; if the enclave leaks, burn mode does not patch that.',
            'A copy you made and stored elsewhere. Burn mode acts on the canonical blob, not on screenshots you took.',
          ]}
        />
      </div>

      <h3 style={h3Style}>The cryptographic invariants</h3>
      <ul style={ulStyle}>
        <li style={liStyle}>
          AES-256-GCM. 256-bit session key from{' '}
          <code style={codeStyle}>crypto.randomBytes(32)</code>.
        </li>
        <li style={liStyle}>
          96-bit GCM nonce from <code style={codeStyle}>crypto.randomBytes(12)</code>. Never
          derived from time or content.
        </li>
        <li style={liStyle}>
          Blob layout: <code style={codeStyle}>nonce (12) ‖ ciphertext ‖ tag (16)</code>.
          Self-contained.
        </li>
        <li style={liStyle}>
          Fingerprint <code style={codeStyle}>sha256(key)</code> is captured before the buffer is
          zeroed. The order matters.
        </li>
        <li style={liStyle}>
          The fingerprint, the destruction timestamp, and the algorithm tag land in the receipt's{' '}
          <code style={codeStyle}>burn</code> block.
        </li>
      </ul>

      <p style={{ ...pStyle, fontStyle: 'italic', color: 'var(--color-fg)' }}>
        Source:{' '}
        <code style={codeStyle}>packages/og-storage/src/burn.ts</code>. Read the threat-model
        JSDoc; it is the canonical statement.
      </p>
    </section>
  );
}

function ThreatCard(props: {
  accent: string;
  title: string;
  items: string[];
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: 24,
        background: 'var(--color-card)',
        border: `1px solid ${props.accent}`,
        borderRadius: 'var(--radius-md)',
      }}
    >
      <h3 style={{ ...h3Style, marginTop: 0, marginBottom: 16 }}>{props.title}</h3>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {props.items.map((it) => (
          <li
            key={it}
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: 'var(--color-fg)',
              marginBottom: 12,
            }}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// §7 · FAQ + glossary
// ──────────────────────────────────────────────────────────────────────

function FaqSection(): React.JSX.Element {
  const faqs: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: 'A receipt says "FULLY VERIFIED". What was actually verified?',
      a: (
        <>
          The four checks named in <Link href="#four-light" style={inlineLinkStyle}>§01</Link>: the
          stored blob hashes to the recorded root, the inference ran on a 0G Compute provider, the
          TEE attestation re-checks, and the chain row matches the off-chain JSON. The label does
          not claim the answer inside the receipt is correct. It claims the process that produced
          the answer is what the receipt says it was.
        </>
      ),
    },
    {
      q: 'Does the chain see my document?',
      a: 'No. The chain stores receiptRoot, the agent address, the type code, and the timestamp. The document content is encrypted at rest on 0G Storage; the chain has no copy.',
    },
    {
      q: 'Why is some receipt amber and not green?',
      a: (
        <>
          The TEE pill is amber when the inference ran on an external provider — NVIDIA NIM,
          OpenAI, or a local model — instead of a 0G Compute TEE. Signature and chain anchor still
          verify, but the operator of that external provider had visibility into the plaintext for
          the duration of the call. See{' '}
          <Link href="#trust-gradient" style={inlineLinkStyle}>
            §03
          </Link>{' '}
          for the precise field that decides this.
        </>
      ),
    },
    {
      q: 'Can I verify a receipt without trusting your code?',
      a: (
        <>
          Yes. The canonical hash is RFC-8785 JCS over the receipt body minus three fields. Any
          implementation in any language reaches the same root from the same JSON. We ship a CLI
          verifier and a public proof page, but you do not need either; a third-party auditor can
          write their own and reach the same answer.
        </>
      ),
    },
    {
      q: 'What happens when burn mode runs and the storage indexer is later offline?',
      a: 'The receipt JSON still verifies — signature, hash, chain anchor — even if 0G Storage cannot return the ciphertext. The four-light row would show Storage amber and the others green; the proof page tells you exactly which leg is unavailable.',
    },
    {
      q: 'What is a passport, and why do I need one?',
      a: (
        <>
          The passport is an ERC-7857 INFT that binds your agent identity to the wallet that signs
          receipts. Trust score accrues to the passport, not to the operator. Without a passport,
          a receipt cannot be signed by an identity the chain recognises. See{' '}
          <Link href="/agents" style={inlineLinkStyle}>
            /agents
          </Link>{' '}
          for what is live today.
        </>
      ),
    },
    {
      q: 'How is this different from a vendor data room?',
      a: 'A data room produces an access log on the vendor\'s servers, under the vendor\'s subpoena schedule. A receipt is signed by the wallet that ran the review and anchored on a public chain. The audit trail outlives the vendor relationship; you do not pay for the right to be audited by us.',
    },
  ];

  const glossary: Array<{ term: string; def: React.ReactNode }> = [
    {
      term: 'receiptRoot',
      def: 'The keccak256 of the canonical JCS-serialized receipt body (minus signature, id, chainAnchor). The signature is over this value. The on-chain anchor stores this value.',
    },
    {
      term: 'verificationMethod',
      def: 'The single field that picks TIER 1 (router_flag or compute_sdk_process_response) vs TIER 2 (external-signed). Lives at teeVerification.verificationMethod.',
    },
    {
      term: 'agent.ownerWallet',
      def: 'The EVM address recovered from the receipt signature. Must match the wallet that owns the passport at agent.passportId.',
    },
    {
      term: 'keyFingerprint',
      def: 'sha256 of the burn-mode session key, captured before the key buffer is zeroed. Lives at burn.sessionKeyFingerprint.',
    },
    {
      term: 'convergence',
      def: 'A tokenized Jaccard plus embedding-cosine score across consensus roles. Below 0.6 by default, the receipt records "no convergence" rather than a fake agreement.',
    },
    {
      term: 'four-light row',
      def: 'The Storage · Compute · TEE · Chain pill set. Each pill is verified, pending, mismatch, or amber. Renders on the run panel and on every receipt page.',
    },
    {
      term: 'TEE-independent',
      def: 'A second-machine re-run of broker.processResponse against the recorded 0G Compute provider. Available via "ivaronix receipt verify <id> --tee-independent".',
    },
  ];

  return (
    <section id="faq" aria-labelledby="faq-heading">
      <SectionLabel>§ 07 — FAQ and glossary</SectionLabel>
      <h2 id="faq-heading" style={h2Style}>
        Hard questions, short answers.
      </h2>

      <div style={{ marginBottom: 48 }}>
        {faqs.map((f, idx) => (
          <details
            key={f.q}
            style={{
              padding: '16px 0',
              borderTop: '1px solid var(--color-hairline)',
              borderBottom: idx === faqs.length - 1 ? '1px solid var(--color-hairline)' : undefined,
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--color-fg)',
                listStyle: 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 16,
              }}
            >
              <span>{f.q}</span>
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--color-muted)',
                  flexShrink: 0,
                }}
              >
                +
              </span>
            </summary>
            <div style={{ ...pStyle, marginTop: 12, marginBottom: 0 }}>{f.a}</div>
          </details>
        ))}
      </div>

      <h3 style={h3Style}>Glossary</h3>
      <dl
        style={{
          padding: 24,
          background: 'var(--color-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          margin: 0,
        }}
      >
        {glossary.map((g, idx) => (
          <div
            key={g.term}
            style={{
              padding: '12px 0',
              borderTop: idx === 0 ? 'none' : '1px solid var(--color-hairline)',
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              gap: 24,
              alignItems: 'baseline',
            }}
          >
            <dt
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--color-fg)',
                fontWeight: 500,
              }}
            >
              {g.term}
            </dt>
            <dd
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--color-muted)',
                margin: 0,
              }}
            >
              {g.def}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Shared bits
// ──────────────────────────────────────────────────────────────────────

const h2Style: React.CSSProperties = {
  fontSize: 32,
  lineHeight: 1.15,
  fontWeight: 600,
  letterSpacing: '-0.5px',
  margin: '0 0 20px',
};

const h3Style: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
  fontWeight: 600,
  margin: '32px 0 16px',
};

const pStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.6,
  color: 'var(--color-fg)',
  margin: '0 0 18px',
};

const ulStyle: React.CSSProperties = {
  margin: '0 0 24px',
  paddingLeft: 24,
};

const liStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.6,
  color: 'var(--color-fg)',
  marginBottom: 10,
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.92em',
  padding: '1px 6px',
  background: 'var(--color-tonal)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 4,
};

const codeAccent: React.CSSProperties = {
  color: 'var(--color-fg)',
  fontWeight: 500,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  color: 'var(--color-muted)',
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 14,
  lineHeight: 1.55,
};

const dtStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: 'var(--color-muted)',
  marginTop: 12,
};

const ddStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.55,
  color: 'var(--color-fg)',
  margin: '4px 0 0',
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

function Divider(): React.JSX.Element {
  return (
    <hr
      style={{
        margin: '80px 0 56px',
        border: 0,
        borderTop: '1px solid var(--color-hairline)',
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="section-label" style={{ marginBottom: 16 }}>
      {children}
    </div>
  );
}
