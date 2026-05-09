/**
 * GET /api/auth/siwe/nonce — issues a fresh SIWE nonce for the handshake.
 * The nonce is also written to a short-lived httpOnly cookie so the verify
 * step can detect replay across browsers / sessions.
 */
import { NextResponse } from 'next/server';
import { issueNonce, NONCE_COOKIE_NAME } from '@/lib/siwe-session';

export const dynamic = 'force-dynamic';

export async function GET() {
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
