/**
 * GET /api/auth/siwe/nonce — issues a fresh SIWE nonce for the handshake.
 * The nonce is also written to a short-lived httpOnly cookie so the verify
 * step can detect replay across browsers / sessions.
 *
 * Per-IP cap on the 'siwe-handshake' bucket — without it, an anonymous
 * flood balloons the in-memory nonce Map (each call writes a fresh entry
 * that lives for 5 minutes, garbage-collected only opportunistically on
 * the issuing path).
 */
import { NextResponse } from 'next/server';
import { issueNonce, NONCE_COOKIE_NAME } from '@/lib/siwe-session';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('siwe-handshake', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `siwe handshake rate limit exceeded · retry after ${Math.ceil((ipLimit.resetMs - Date.now()) / 1000)}s` },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }
  const { nonce, cookieValue } = issueNonce();
  const res = NextResponse.json({ nonce });
  // Cookie attrs:
  // - httpOnly: not readable by client JS (defence vs XSS leakage)
  // - sameSite: strict to block cross-site replays
  // - secure: enabled in production; relaxed in dev so localhost works
  // - maxAge: 5 min (matches NONCE_TTL_MS in siwe-session.ts)
  res.cookies.set({
    name: NONCE_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 300,
  });
  return res;
}
