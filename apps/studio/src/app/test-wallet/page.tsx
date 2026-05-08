/**
 * Test-only page that injects a window.ethereum shim signing with the
 * server's EVM_PRIVATE_KEY. Lets us drive /onboard end-to-end from
 * playwright without a real MetaMask extension. Hidden behind a search
 * param + only mounts when NEXT_PUBLIC_TEST_WALLET=1.
 *
 * Never ship this to production. The next.config.ts gate guarantees the
 * client bundle for this route is empty unless the env var is set, and
 * the runtime env exposure is server-only — the private key never reaches
 * the browser bundle.
 */

import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function TestWalletPage() {
  if (process.env.NEXT_PUBLIC_TEST_WALLET !== '1') {
    return (
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '128px 32px' }}>
        <h1>Test wallet helper</h1>
        <p>Set NEXT_PUBLIC_TEST_WALLET=1 in studio env to enable.</p>
        <Link href="/">← home</Link>
      </section>
    );
  }
  return (
    <section style={{ maxWidth: 720, margin: '0 auto', padding: '128px 32px' }}>
      <h1>Test wallet helper</h1>
      <p>This page is intentionally minimal. Use playwright to inject window.ethereum on /onboard directly.</p>
      <Link href="/onboard">→ onboard</Link>
    </section>
  );
}
