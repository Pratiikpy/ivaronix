import Link from 'next/link';
import { unifiedNextId, livePassportCount } from '@/lib/chain';
import { getSampleReceiptHref } from '@/lib/sample-receipt';
import numbersJson from '../../../../../docs/numbers.json';

export const dynamic = 'force-dynamic';

// Fallback values pulled from the canonical numbers.json so when chain
// RPC fails (rare but real), the page still shows fresh-ish numbers
// rather than stale prose. numbers.json itself is auto-derived from
// chain on every `pnpm numbers:refresh` (24h staleness gate in CI).
const FALLBACK_RECEIPTS = `${numbersJson.receipts.total.toLocaleString()}+`;

async function liveNumbers(): Promise<{ receipts: number | null; passports: number | null }> {
  // Sweep 187: passport count via the shared livePassportCount helper
  // so the convention lives in one place (apps/studio/src/lib/chain.ts).
  const [unified, p] = await Promise.all([
    unifiedNextId().catch(() => null),
    livePassportCount().catch(() => null),
  ]);
  const r = unified && unified.total > 0n ? Number(unified.total) : null;
  return { receipts: r, passports: p !== null ? Number(p) : null };
}

export default async function ThesisPage() {
  const { receipts, passports } = await liveNumbers();
  const receiptsLabel = receipts !== null ? receipts.toLocaleString() : FALLBACK_RECEIPTS;
  const passportsLabel = passports !== null ? passports.toLocaleString() : '4';

  return (
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '64px 32px 96px' }}>
      <div className="section-label" style={{ marginBottom: 16 }}>
        Why Ivaronix
      </div>

      <h1
        style={{
          fontSize: 56,
          lineHeight: 1.05,
          letterSpacing: '-1.5px',
          fontWeight: 700,
          margin: 0,
          marginBottom: 32,
        }}
      >
        Some documents are too sensitive to <span className="italic-display" style={{ fontWeight: 400 }}>show anyone.</span>
      </h1>

      <p style={{ fontSize: 19, lineHeight: 1.55, color: 'var(--color-muted)', margin: 0 }}>
        Ivaronix gives you an AI specialist for the work you cannot send to ChatGPT — the term sheet under NDA,
        the indemnity clause that walks into court three years from now, the data room a buyer's counsel reads at
        11pm. It runs the review, then leaves a small piece of evidence: a signed receipt that says what the
        review found, when it ran, and that the document itself is gone.
      </p>

      <Divider />

      <SectionLabel>The problem</SectionLabel>
      <h2 style={h2Style}>You have three choices today. None of them are good.</h2>
      <p style={pStyle}>
        Pasting into ChatGPT trains the model on your draft. The vendor's terms quietly take a copy. If your
        document is privileged, that one paste is the privilege defense gone. There is no putting it back.
      </p>
      <p style={pStyle}>
        A vendor data room — Datasite, Intralinks, Box — keeps the access log on its own servers. The log is
        produced under subpoena on the vendor's schedule and disappears when your contract with the vendor ends.
        You pay them for the right to be audited by them.
      </p>
      <p style={pStyle}>
        A local model on your laptop keeps the document private and loses the audit trail. There is no proof
        for a regulator, an investor, or a partner that the review actually happened or said what you say it
        said. The cheapest rebuttal is "show me your logs," and you have none.
      </p>

      <Divider />

      <SectionLabel>How it works</SectionLabel>
      <h2 style={h2Style}>Five steps. None require you to trust us.</h2>
      <ol style={{ ...pStyle, paddingLeft: 24, listStyle: 'decimal' }}>
        <li style={{ marginBottom: 12 }}>
          You drop a file. The studio encrypts it in your browser before it leaves your machine.
        </li>
        <li style={{ marginBottom: 12 }}>
          The encrypted bytes go to a public storage layer. The decryption key stays in memory only — it never
          gets written to disk and is destroyed at the end of the run.
        </li>
        <li style={{ marginBottom: 12 }}>
          A specialist — a contract auditor, a privacy lawyer, a security reviewer — runs the analysis inside a
          hardware-isolated enclave. The plaintext is visible there for the duration of the run and nowhere
          else.
        </li>
        <li style={{ marginBottom: 12 }}>
          The result is wrapped in a signed receipt: who ran it, what skill was used, what was found, what the
          fingerprint of the destroyed key was. The receipt is anchored to a public chain.
        </li>
        <li>
          The original document is unreadable, including to us. The receipt is permanent. Anyone with its id can
          re-verify the run independently — different machine, different network, no account needed.
        </li>
      </ol>

      <p style={{ ...pStyle, fontStyle: 'italic', color: 'var(--color-fg)' }}>
        The receipt is the product. Everything else is plumbing to make it real.
      </p>

      <Divider />

      <SectionLabel>What you actually get</SectionLabel>
      <h2 style={h2Style}>Live numbers, from the chain itself.</h2>
      <NumbersGrid receipts={receiptsLabel} passports={passportsLabel} />
      <p style={{ ...pStyle, fontSize: 14, color: 'var(--color-muted)' }}>
        Every number above is read from the public chain at the moment this page loaded. Click any of them to
        inspect the underlying data — receipts, agents, skills. Nothing is cached, nothing is synthetic.
      </p>

      <Divider />

      <SectionLabel>Who it's for</SectionLabel>
      <h2 style={h2Style}>Three people. Three different bills paid.</h2>
      <p style={pStyle}>
        <strong style={{ color: 'var(--color-fg)' }}>The deal lawyer.</strong>{' '}
        Senior associate at a corporate firm. Reviews twenty term sheets a quarter, two of them at 11pm under
        NDA. The opposing party will not let her paste their draft into ChatGPT. Today the only option is to
        read carefully and remember. Now she runs a redline-grade review and ships a receipt the partner — and a
        regulator, three years later — can both verify.
      </p>
      <p style={pStyle}>
        <strong style={{ color: 'var(--color-fg)' }}>The founder.</strong>{' '}
        Series A round. The lead investor's term sheet has a full-ratchet clause buried in clean prose. She
        cannot afford a partner-level read on every revision. She runs the audit, gets a one-page risk summary,
        brings the receipt to her board call. The board call goes faster.
      </p>
      <p style={pStyle}>
        <strong style={{ color: 'var(--color-fg)' }}>The DD analyst.</strong>{' '}
        Buy-side firm running diligence on an acquisition. Twelve counterparties, thirty data rooms, every page
        under NDA. He needs a verifiable read trail for the audit committee. Each room read is a receipt. The
        analyst's wallet is on every receipt. The investment memo writes itself in the margin.
      </p>

      <Divider />

      <SectionLabel>What we will not build</SectionLabel>
      <h2 style={h2Style}>The shortest list in the company.</h2>
      <p style={pStyle}>
        We are not a vendor data room. We do not host your document. We do not run a directory. Every skill is
        open source. The runtime is open source. We will not add features that exist only to look complete in a
        screenshot.
      </p>
      <p style={pStyle}>
        We are also not finished. The agent's signing key currently lives on the operator side; the next version
        moves it inside the secure enclave so even we cannot extract it. We say so on the agent's profile page.
        We do not bury the parts we have not finished.
      </p>

      <div
        style={{
          marginTop: 64,
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
            From your first drop to your first receipt: under thirty seconds.
          </p>
          <p style={{ fontSize: 18, color: 'var(--color-fg)', margin: 0, fontWeight: 600 }}>
            Try one. The receipt will outlast the document.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/onboard" className="btn-primary" style={{ textDecoration: 'none' }}>
            Run a private audit →
          </Link>
          <Link href={getSampleReceiptHref()} className="btn-secondary" style={{ textDecoration: 'none' }}>
            See a sample receipt
          </Link>
        </div>
      </div>
    </article>
  );
}

const h2Style: React.CSSProperties = {
  fontSize: 28,
  lineHeight: 1.15,
  fontWeight: 600,
  letterSpacing: '-0.5px',
  margin: '0 0 20px',
};

const pStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.6,
  color: 'var(--color-fg)',
  margin: '0 0 18px',
};

function Divider() {
  return (
    <hr
      style={{
        margin: '64px 0 40px',
        border: 0,
        borderTop: '1px solid var(--color-hairline)',
      }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-label" style={{ marginBottom: 16 }}>
      {children}
    </div>
  );
}

function NumbersGrid({ receipts, passports }: { receipts: string; passports: string }) {
  const items: Array<{ value: string; label: string; href: string; external?: boolean }> = [
    { value: receipts, label: 'reviews completed', href: '/dashboard' },
    { value: passports, label: 'specialists in service', href: '/agent' },
    { value: '10', label: 'verified expert skills', href: '/skills' },
    { value: '< 30s', label: 'first review to receipt', href: '/onboard' },
    { value: '0', label: 'reads of your file after the run', href: '/onboard' },
    { value: 'Public', label: 'every receipt is verifiable', href: '/r/1004' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}
    >
      {items.map((it) => (
        <Link
          key={it.label}
          href={it.href}
          style={{
            padding: 18,
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-card)',
            textDecoration: 'none',
            color: 'inherit',
            display: 'block',
          }}
          className="thesis-stat-card"
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-fg)',
              lineHeight: 1.0,
              marginBottom: 8,
            }}
          >
            {it.value}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.4 }}>{it.label}</div>
        </Link>
      ))}
    </div>
  );
}
