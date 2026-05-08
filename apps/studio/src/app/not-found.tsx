import Link from 'next/link';

/**
 * Brand-consistent 404. Replaces Next's default minimal page so the cream
 * background + Outfit type + nav links stay intact when judges hit a
 * stale link.
 */
export default function NotFound() {
  return (
    <section
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '128px 32px',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <span
        style={{
          fontSize: 12,
          letterSpacing: '1.5px',
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
        }}
      >
        § 404 · NOT FOUND
      </span>
      <h1 style={{ fontSize: 64, lineHeight: 1.0, margin: 0, letterSpacing: '-1px' }}>
        Nothing here.
        <br />
        <span className="italic-display">Yet.</span>
      </h1>
      <p style={{ fontSize: 17, color: 'var(--color-muted)', margin: 0 }}>
        Maybe the receipt id doesn&apos;t exist on chain yet, or the skill was
        never published. Every public page is generated from real testnet
        state — if the state isn&apos;t there, neither is the page.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
        <Link href="/" className="btn-primary" style={{ textDecoration: 'none' }}>
          Back to home
        </Link>
        <Link href="/global" className="btn-secondary" style={{ textDecoration: 'none' }}>
          See live testnet stats
        </Link>
      </div>
    </section>
  );
}
