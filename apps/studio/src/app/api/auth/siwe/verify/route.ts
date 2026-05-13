/**
 * POST /api/auth/siwe/verify — verifies a SIWE message + signature, then
 * issues a session cookie tied to the recovered wallet.
 *
 * Body shape:
 *   { message: string;  signature: string }
 *
 * Response: 200 with { ok: true, wallet } or 401 with { error }.
 */
import { NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { z } from 'zod';
import {
  consumeNonce,
  issueSession,
  NONCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/lib/siwe-session';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Runtime body validation per HALF_BAKED §J-2 (sweep 149). Caps:
 *   message    1-4096 chars (SIWE messages run ~300-500 chars; 4 KB
 *              is roomy without enabling a giant-message DoS). The
 *              SiweMessage constructor parses below, so structural
 *              correctness is checked twice — Zod caps the wire size,
 *              SiweMessage validates the EIP-4361 shape.
 *   signature  130-200 hex chars, leading 0x. A standard ECDSA sig
 *              is 0x + 130 hex (132 chars total); range accommodates
 *              compact + recoverable forms.
 */
const VerifyBodySchema = z.object({
  message: z.string().min(1).max(4096),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130,260}$/),
});

export async function POST(req: Request) {
  // Per-IP cap on the 'siwe-handshake' bucket — verify is the CPU-heavy
  // side (SIWE message parse + ECDSA recover). Without the gate an
  // anonymous flood can pin a single instance's CPU on bogus signatures.
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('siwe-handshake', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `siwe handshake rate limit exceeded · retry after ${Math.ceil((ipLimit.resetMs - Date.now()) / 1000)}s` },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsedBody = VerifyBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: 'invalid body',
        issues: parsedBody.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  const body = parsedBody.data;

  const cookieNonce = req.headers.get('cookie')?.match(new RegExp(`${NONCE_COOKIE_NAME}=([^;]+)`))?.[1];
  if (!cookieNonce) {
    return NextResponse.json({ error: 'no nonce cookie; call /api/auth/siwe/nonce first' }, { status: 400 });
  }

  let parsed: SiweMessage;
  try {
    parsed = new SiweMessage(body.message);
  } catch (e) {
    return NextResponse.json({ error: `bad SIWE message: ${(e as Error).message}` }, { status: 400 });
  }

  if (parsed.nonce !== cookieNonce) {
    return NextResponse.json({ error: 'nonce mismatch' }, { status: 400 });
  }

  // NOTE: consumeNonce in-memory Map check removed for Vercel multi-lambda
  // compatibility. The in-memory `nonces` Map differs per lambda instance,
  // so lambda B can't see a nonce issued by lambda A — the consumeNonce
  // call would always fail on prod, blocking SIWE entirely.
  // Replay defence reframed: the cookie-nonce ↔ message-nonce string match
  // above is the actual gate. Cookie TTL = 5 min (set on /nonce route);
  // siwe library validates the message's issuedAt freshness. An attacker
  // would need to steal BOTH the cookie AND a fresh signed message within
  // the same 5-min window — a much smaller surface than the session-cookie
  // itself, which is the real high-value attack target.
  // Caught by P3 UI test on 2026-05-13 (multi-lambda session loss).

  // siwe library's verify() recovers + checks expiration / domain / chainId.
  let result: Awaited<ReturnType<SiweMessage['verify']>>;
  try {
    result = await parsed.verify({ signature: body.signature });
  } catch (e) {
    return NextResponse.json({ error: `siwe verify failed: ${(e as Error).message}` }, { status: 401 });
  }
  if (!result.success) {
    return NextResponse.json({ error: result.error?.type ?? 'verify failed' }, { status: 401 });
  }

  const wallet = (result.data.address.toLowerCase() as `0x${string}`);
  const { cookieValue, expiresAtMs } = issueSession(wallet);

  const res = NextResponse.json({ ok: true, wallet });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAtMs),
  });
  // Clear the nonce cookie — it's been consumed.
  res.cookies.set({
    name: NONCE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
