import { NextResponse } from 'next/server';
import { rememberNote } from '@/lib/studio-memory';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/memory/remember
 *
 * Body: { text: string, scope?: string }
 *
 * Per planning-003 §A.4.8 (MemoryEngine fourth product surface). Same
 * SIWE + per-IP + per-wallet rate-limit pattern as `/api/skill/save`.
 *
 * Privacy: notes are stored as plaintext in the per-wallet sandbox.
 * For E2E-encrypted memory, use `ivaronix memory remember` locally with
 * your own signer key. See `docs/PRIVACY_NOTES.md` §4.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('ip', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'rate limit exceeded (per-IP)' },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const sessionCookie = req.headers
    .get('cookie')
    ?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = readSession(sessionCookie);
  if (!session) {
    return NextResponse.json(
      { error: 'authentication required — POST /api/auth/siwe/verify first' },
      { status: 401 },
    );
  }

  const walletLimit = checkRateLimit('memory-write', session.wallet);
  if (!walletLimit.ok) {
    return NextResponse.json(
      { error: 'rate limit exceeded (per-wallet memory writes)' },
      { status: 429, headers: rateLimitHeaders(walletLimit) },
    );
  }

  let body: { text?: string; scope?: string };
  try {
    body = (await req.json()) as { text?: string; scope?: string };
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.text || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  try {
    const note = rememberNote({
      wallet: session.wallet,
      text: body.text,
      scope: body.scope,
    });
    return NextResponse.json({ note });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
