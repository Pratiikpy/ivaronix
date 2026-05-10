import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms · Ivaronix',
  description: 'Terms of use for the Ivaronix testnet.',
};

/**
 * Terms page · HALF_BAKED §G Tier A item 7 closure.
 *
 * Voice: terse, technical, blunt per CLAUDE.md §9. No banned words.
 *
 * Testnet-only terms. Mainnet redeploy will replace this content with
 * full commercial terms; that work is queued in USER_TODO §B-V2.
 */
export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 32px 96px', lineHeight: 1.6 }}>
      <div className="section-label" style={{ marginBottom: 12 }}>§ Terms</div>
      <h1 style={{ fontSize: 36, fontWeight: 600, marginBottom: 24, letterSpacing: '-0.01em' }}>
        Terms
      </h1>
      <p style={{ fontSize: 17, color: 'var(--color-muted)', marginBottom: 40 }}>
        Ivaronix is on Galileo testnet today. These terms describe
        what testnet use looks like. Mainnet terms will replace this
        page when mainnet ships.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 40, marginBottom: 12 }}>Free testnet usage</h2>
      <p>
        The testnet is free to use. The operator pays gas for storage
        uploads, chain anchors, and TEE inference. There are per-IP
        and per-wallet rate-limits in place to prevent operator-wallet
        drain; check response headers for <code>x-ratelimit-*</code>
        when in doubt.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>No SLA</h2>
      <p>
        Testnet uptime is best-effort. The operator may pause the
        service to redeploy contracts, rotate keys, or upgrade the
        runtime. Receipts already anchored stay readable on chain
        regardless of operator state.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Wallet responsibility</h2>
      <p>
        You hold your own wallet keys. The operator never sees your
        private key. If you lose it, the operator cannot restore it.
        Receipts anchored under a lost wallet remain on chain but you
        can no longer claim them as yours.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Receipt immutability</h2>
      <p>
        Once anchored, receipts cannot be edited or deleted. The chain
        is the source of truth. Off-chain copies in our database may
        lag the chain or be removed; the chain record stands regardless.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>No warranty</h2>
      <p>
        The software is provided as-is. The receipt model is intended
        to be tamper-evident, not tamper-proof; an attacker with
        operator-level access could write receipts, but cannot change
        the canonical hash on existing receipts. Independent
        verification via{' '}
        <code className="mono">ivaronix receipt verify --tee-independent</code>{' '}
        is the recommended trust model — the operator does not need to
        be trusted to validate a receipt.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Acceptable use</h2>
      <p>
        Use Ivaronix for honest review work. Do not anchor content
        designed to mislead a downstream verifier — receipts are public
        and a fraudulent claim is forensically traceable to the
        signing wallet. Skills marked <code>compute_tee_required</code>
        run only inside TEE attestation; do not attempt to bypass that
        flag.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact</h2>
      <p>
        Issues:{' '}
        <a href="https://github.com/Pratiikpy/ivaronix/issues" target="_blank" rel="noopener noreferrer">
          GitHub Issues
        </a>
        . Questions about these terms: open a Discussion on the same
        repo.
      </p>
    </main>
  );
}
