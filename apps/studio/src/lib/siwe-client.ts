/**
 * Client-side SIWE handshake helper.
 *
 * Caught by P3 UI test on 2026-05-13: when a user connects their wallet
 * and clicks Run, /api/run rejects with "userWallet claim requires
 * active SIWE session — POST /api/auth/siwe/verify first" because the
 * RunPanel passes `userWallet` in the body but never completes the
 * SIWE handshake.
 *
 * Fix: call `ensureSiweSession()` from RunPanel BEFORE /api/run when a
 * userWallet claim will be sent. If the user already has an active
 * session, this is a no-op cookie check. If not, fetch a nonce, build
 * an EIP-4361 SIWE message, ask wagmi to sign it, then POST to
 * /api/auth/siwe/verify to set the session cookie.
 *
 * The /admin/treasury page is server-side gated so it didn't surface
 * this gap. RunPanel is the canonical user-attributed flow and needs
 * the handshake.
 */

export interface SiweEnsureResult {
  ok: boolean;
  /** New session set by this call, OR session was already active. */
  active: boolean;
  /** Surface this if !ok so the user gets a clear error toast. */
  error?: string;
}

interface SignMessageFn {
  (args: { message: string }): Promise<string>;
}

/**
 * Ensure a SIWE session exists for the given address.
 *
 * @param address The user's connected wallet (checksummed 0x... hex).
 * @param signMessage A function that signs a string via the wallet
 *                    (typically wagmi's `signMessageAsync`).
 * @returns ok=true when a session is active after this call.
 */
export async function ensureSiweSession(
  address: string,
  signMessage: SignMessageFn,
): Promise<SiweEnsureResult> {
  // Step 1: fetch a fresh nonce. The endpoint sets a session cookie with
  // the nonce so /verify can match it; without that cookie /verify rejects.
  let nonce: string;
  try {
    const nonceRes = await fetch('/api/auth/siwe/nonce', { credentials: 'include' });
    if (!nonceRes.ok) {
      return { ok: false, active: false, error: `nonce fetch ${nonceRes.status}` };
    }
    const json = (await nonceRes.json()) as { nonce?: string };
    if (!json.nonce) return { ok: false, active: false, error: 'nonce missing' };
    nonce = json.nonce;
  } catch (err) {
    return { ok: false, active: false, error: `nonce error: ${(err as Error).message}` };
  }

  // Step 2: build EIP-4361 SIWE message. Match the shape the server's
  // SiweMessage constructor expects. Domain = window.location.host;
  // URI = window.location.origin. Chain = Galileo (16602) for testnet.
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ivaronix.vercel.app';
  const host = typeof window !== 'undefined' ? window.location.host : 'ivaronix.vercel.app';
  const issuedAt = new Date().toISOString();
  const chainId = 16602; // Galileo

  // EIP-4361 message format (line-by-line per spec):
  const message = [
    `${host} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to Ivaronix to attribute receipts to your wallet.',
    '',
    `URI: ${origin}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');

  // Step 3: sign via wagmi
  let signature: string;
  try {
    signature = await signMessage({ message });
  } catch (err) {
    return { ok: false, active: false, error: `sign rejected: ${(err as Error).message}` };
  }

  // Step 4: POST to /verify · sets session cookie on success
  try {
    const verifyRes = await fetch('/api/auth/siwe/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message, signature }),
    });
    if (!verifyRes.ok) {
      const text = await verifyRes.text().catch(() => '');
      return { ok: false, active: false, error: `verify ${verifyRes.status} · ${text.slice(0, 200)}` };
    }
    return { ok: true, active: true };
  } catch (err) {
    return { ok: false, active: false, error: `verify error: ${(err as Error).message}` };
  }
}
