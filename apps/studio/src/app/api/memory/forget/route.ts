import { NextResponse } from 'next/server';
import { z } from 'zod';
import { forgetNote, forgetBeforeNotes } from '@/lib/studio-memory';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Runtime body validation per HALF_BAKED §J-2 (sweep 148). Either id OR
 * beforeMs is required; passing neither returns 400. The schema below
 * enforces both shape constraints (id is a string, beforeMs is a
 * non-negative finite integer) and the at-least-one-of-them rule via
 * a refinement.
 */
const ForgetBodySchema = z
  .object({
    id: z.string().min(1).max(80).optional(),
    beforeMs: z.number().int().nonnegative().finite().optional(),
  })
  .refine((b) => b.id !== undefined || b.beforeMs !== undefined, {
    message: 'expected id or beforeMs',
  });

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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = ForgetBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid body',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (body.id !== undefined) {
    const ok = forgetNote({ wallet: session.wallet, id: body.id });
    return NextResponse.json({ removed: ok ? 1 : 0 });
  }
  // refine() above guarantees at least one of {id, beforeMs} is set.
  const removed = forgetBeforeNotes({ wallet: session.wallet, beforeMs: body.beforeMs as number });
  return NextResponse.json({ removed });
}
