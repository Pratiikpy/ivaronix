import { NextResponse } from 'next/server';
import { forgetNote, forgetBeforeNotes } from '@/lib/studio-memory';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/memory/forget
 *
 * Body forms (one OR the other):
 *   { id: string }                    — delete a single note by id
 *   { beforeMs: number }              — delete every note older than this timestamp
 *
 * Returns: { removed: number } (1 or 0 for id; arbitrary count for beforeMs).
 *
 * The CLI counterpart is `ivaronix memory forget --before <date>`; the
 * Studio path mirrors the same semantics on the per-wallet sandbox.
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

  let body: { id?: string; beforeMs?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (typeof body.id === 'string' && body.id.length > 0) {
    const ok = forgetNote({ wallet: session.wallet, id: body.id });
    return NextResponse.json({ removed: ok ? 1 : 0 });
  }
  if (typeof body.beforeMs === 'number' && Number.isFinite(body.beforeMs)) {
    const removed = forgetBeforeNotes({ wallet: session.wallet, beforeMs: body.beforeMs });
    return NextResponse.json({ removed });
  }
  return NextResponse.json({ error: 'expected id or beforeMs' }, { status: 400 });
}
