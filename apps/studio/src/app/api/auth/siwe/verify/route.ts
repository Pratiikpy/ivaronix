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
import {
  consumeNonce,
  issueSession,
  NONCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@/lib/siwe-session';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface VerifyBody {
  message?: string;
  signature?: string;
}

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

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  if (!body.message || !body.signature) {
    return NextResponse.json({ error: 'message and signature required' }, { status: 400 });
  }

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

  // Consume the nonce — single-use, prevents replay even within the TTL window.
  if (!consumeNonce(cookieNonce)) {
    return NextResponse.json({ error: 'nonce expired or already used' }, { status: 400 });
  }

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
