/**
 * Minimal SIWE session helpers for /api/auth/siwe/{nonce,verify} and request gating.
 * Per HALF_BAKED K-8 + K-9: when a request body claims `userWallet`, we require an
 * active SIWE session whose wallet matches the claim — otherwise the operator's key
 * could anchor receipts under an arbitrary user identity.
 *
 * In-process implementation is intentional: sessions live in a Map keyed by
 * cookie value, expire after `SESSION_TTL_MS`. Production multi-instance setups
 * should swap this for a Redis-backed store (the function shape is preserved so
 * the swap is local).
 */

import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 60 * 60 * 1_000; // 1 hour
const NONCE_TTL_MS = 5 * 60 * 1_000; // 5 minutes for SIWE handshake

interface SessionRecord {
  wallet: `0x${string}`;
  issuedAtMs: number;
  expiresAtMs: number;
}

const sessions = new Map<string, SessionRecord>();
const nonces = new Map<string, { issuedAtMs: number }>();

const SESSION_COOKIE = 'iv-session';
const NONCE_COOKIE = 'iv-siwe-nonce';

function getHmacSecret(): Buffer {
  const env = process.env.IVARONIX_SESSION_SECRET;
  if (env && env.length >= 32) return Buffer.from(env, 'utf8');
  // Sweep 195: warn on misconfigured-but-set secret. Operators who set
  // IVARONIX_SESSION_SECRET to a too-short value EXPECT stable sessions
  // across restarts; pre-sweep this fell through silently to a per-
  // process random secret and they'd be confused why every restart
  // invalidates every session. Warn once so the misconfig is visible
  // in operator logs.
  if (env && env.length < 32 && !shortSecretWarned) {
    shortSecretWarned = true;
    console.warn(
      `[siwe-session] IVARONIX_SESSION_SECRET is set but too short (${env.length} chars; needs ≥ 32). ` +
      `Falling back to per-process random secret — sessions will die on every restart. ` +
      `Generate a real secret: \`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\``,
    );
  }
  // Per-process random secret. Sessions die on restart — acceptable for single
  // instance; for multi-instance the operator MUST set IVARONIX_SESSION_SECRET.
  if (!perProcessSecret) perProcessSecret = randomBytes(32);
  return perProcessSecret;
}
let perProcessSecret: Buffer | null = null;
let shortSecretWarned = false;

/** Issue a fresh nonce for a SIWE handshake; valid for NONCE_TTL_MS. */
export function issueNonce(): { nonce: string; cookieValue: string } {
  const nonce = randomBytes(16).toString('hex');
  nonces.set(nonce, { issuedAtMs: Date.now() });
  // Garbage-collect expired nonces opportunistically.
  for (const [k, v] of nonces) {
    if (Date.now() - v.issuedAtMs > NONCE_TTL_MS) nonces.delete(k);
  }
  return { nonce, cookieValue: nonce };
}

/** Consume a nonce: returns true and removes it if valid + unexpired. */
export function consumeNonce(nonce: string): boolean {
  const rec = nonces.get(nonce);
  if (!rec) return false;
  nonces.delete(nonce);
  if (Date.now() - rec.issuedAtMs > NONCE_TTL_MS) return false;
  return true;
}

/**
 * Issue a session for the given wallet. STATELESS token: the wallet +
 * expiry are embedded in the cookie itself, HMAC-signed by the server
 * secret. No Map lookup required at read time — critical for Vercel
 * multi-lambda where lambda A's in-memory Map isn't visible to lambda B.
 *
 * Cookie shape: `<base64url(JSON{wallet, expiresAtMs})>.<hex hmac>`.
 * Caught by P3 UI test on 2026-05-13: user's SIWE sign succeeded on
 * lambda A but /api/run rejected on lambda B because the session wasn't
 * in B's in-memory `sessions` Map.
 */
export function issueSession(wallet: `0x${string}`): { cookieValue: string; expiresAtMs: number } {
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ wallet, expiresAtMs }), 'utf8').toString('base64url');
  const sig = createHmac('sha256', getHmacSecret()).update(payload).digest('hex');
  return { cookieValue: `${payload}.${sig}`, expiresAtMs };
}

/**
 * Read the session from a stateless HMAC-signed cookie. Returns null on
 * any tamper / expiry / parse error. No Map lookup — works across
 * Vercel lambda instances as long as IVARONIX_SESSION_SECRET is set
 * (otherwise each lambda has its own per-process random secret and
 * sessions remain instance-local — see warning in getHmacSecret).
 */
export function readSession(cookieValue: string | undefined): SessionRecord | null {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf('.');
  if (dot < 0) return null;
  const payload = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expected = createHmac('sha256', getHmacSecret()).update(payload).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, 'hex');
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  let decoded: { wallet?: string; expiresAtMs?: number };
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!decoded.wallet || typeof decoded.expiresAtMs !== 'number') return null;
  if (Date.now() > decoded.expiresAtMs) return null;
  return {
    wallet: decoded.wallet as `0x${string}`,
    issuedAtMs: decoded.expiresAtMs - SESSION_TTL_MS,
    expiresAtMs: decoded.expiresAtMs,
  };
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const NONCE_COOKIE_NAME = NONCE_COOKIE;

/** TEST-ONLY: clear all session + nonce state. */
export function __resetSessionState(): void {
  sessions.clear();
  nonces.clear();
}
