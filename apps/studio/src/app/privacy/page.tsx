import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy · Ivaronix',
  description: 'What Ivaronix stores, where it stores it, and what it cannot see.',
};

/**
 * Privacy page. Voice: terse, technical, blunt. No banned words.
 * Show concrete env-var names, contract addresses, and storage paths
 * so readers can verify claims against the code. Applies to both
 * Galileo testnet and Aristotle mainnet deployments.
 */
export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 32px 96px', lineHeight: 1.6 }}>
      <div className="section-label" style={{ marginBottom: 12 }}>§ Privacy</div>
      <h1 style={{ fontSize: 36, fontWeight: 600, marginBottom: 24, letterSpacing: '-0.01em' }}>
        Privacy
      </h1>
      <p style={{ fontSize: 17, color: 'var(--color-muted)', marginBottom: 40 }}>
        What Ivaronix stores, where it stores it, and what it cannot see.
        Production runs on 0G Aristotle mainnet (chainId 16661); Galileo
        testnet (chainId 16602) is kept live for developer iteration.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>What we record</h2>
      <p>
        Every action you run produces a <strong>receipt</strong>: a signed,
        chain-anchored record on a <code>ReceiptRegistry</code> contract
        (V3 for the receipt-type slots admitted post-B-V2-32; V2 for legacy
        slots 0-9). Receipts are public by design — they are how a third
        party proves you ran the work claimed.
      </p>
      <p>A receipt body is canonical-hashed (RFC-8785 JCS) and contains:</p>
      <ul>
        <li>The skill that ran, its version, the model used.</li>
        <li>A keccak256 of the input + output (not the plaintext).</li>
        <li>The TEE attestation hash if the run used 0G Compute (TIER 1).</li>
        <li>The wallet that authorised the run (you).</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>What we cannot see</h2>
      <ul>
        <li>
          <strong>0G Compute (TIER 1) plaintext.</strong> Inference runs
          inside a TEE-attested provider. The operator wallet never
          handles your input or output text outside the TEE.
        </li>
        <li>
          <strong>Burn Mode contents.</strong> AES-256-GCM seals the
          input under a session key the operator never sees. Only the
          key fingerprint (<code>sha256(key)</code>) is recorded. The
          full key is wiped at the end of the run.
        </li>
        <li>
          <strong>Memory recall on a different wallet.</strong> Memory is
          per-wallet, stored under the wallet sandbox. Other wallets
          cannot recall your notes through Studio or the CLI.
        </li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Cookies + sessions</h2>
      <p>
        <code>iv-session</code> · 1 hour TTL, HMAC-signed with{' '}
        <code>IVARONIX_SESSION_SECRET</code>. Issued after a SIWE
        sign-in. <code>iv-siwe-nonce</code> · 5 minute TTL, single-use,
        prevents replay during the handshake. Both cookies are
        httpOnly + sameSite=strict.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Third-party analytics</h2>
      <p>
        None. No Google Analytics, Plausible, Mixpanel, Segment, or
        cookie-based tracking. The only network traffic Studio makes is
        to 0G RPC, 0G Storage, and the configured 0G Router endpoint.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Operator-as-proxy</h2>
      <p>
        Public chain reads (the <code>/global</code> ticker, dashboard
        refreshes) are made by the operator wallet so your wallet
        address does not appear in the indexer logs for unrelated reads.
        See <code>READ_PROXY_PRIVATE_KEY</code> /{' '}
        <code>IVARONIX_READ_PROXY_KEY</code> in the .env template for
        details.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Verification</h2>
      <p>
        Every claim above maps to source code. Repository:{' '}
        <a href="https://github.com/Pratiikpy/ivaronix" target="_blank" rel="noopener noreferrer">
          github.com/Pratiikpy/ivaronix
        </a>
        . Receipts can be re-verified independently with{' '}
        <code className="mono">ivaronix receipt verify --tee-independent</code>.
      </p>
    </main>
  );
}
