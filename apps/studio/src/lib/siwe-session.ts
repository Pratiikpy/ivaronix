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
  // Per-process random secret. Sessions die on restart — acceptable for single
  // instance; for multi-instance the operator MUST set IVARONIX_SESSION_SECRET.
  if (!perProcessSecret) perProcessSecret = randomBytes(32);
  return perProcessSecret;
}
let perProcessSecret: Buffer | null = null;

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
 * Issue a session for the given wallet. Returns the cookie value (an
 * HMAC-protected token); the wallet → record mapping is held in-memory.
 */
export function issueSession(wallet: `0x${string}`): { cookieValue: string; expiresAtMs: number } {
  const id = randomBytes(24).toString('hex');
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  sessions.set(id, { wallet, issuedAtMs: Date.now(), expiresAtMs });
  // Cookie value is `<id>.<hmac(id)>`. Tampering invalidates the HMAC.
  const sig = createHmac('sha256', getHmacSecret()).update(id).digest('hex');
  return { cookieValue: `${id}.${sig}`, expiresAtMs };
}

/**
 * Read the session associated with a cookie value, or null if missing /
 * tampered / expired.
 */
export function readSession(cookieValue: string | undefined): SessionRecord | null {
  if (!cookieValue) return null;
  const dot = cookieValue.indexOf('.');
  if (dot < 0) return null;
  const id = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  const expected = createHmac('sha256', getHmacSecret()).update(id).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, 'hex');
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  const rec = sessions.get(id);
  if (!rec) return null;
  if (Date.now() > rec.expiresAtMs) {
    sessions.delete(id);
    return null;
  }
  return rec;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const NONCE_COOKIE_NAME = NONCE_COOKIE;

/** TEST-ONLY: clear all session + nonce state. */
export function __resetSessionState(): void {
  sessions.clear();
  nonces.clear();
}
