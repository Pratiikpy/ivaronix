import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recallNotes } from '@/lib/studio-memory';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Runtime body validation per HALF_BAKED §J-2 (sweep 148). Caps:
 *   query    1–1024 chars (search query — 1 KB is plenty)
 *   scope    ≤ 64 chars (tag-like)
 *   fromTime / toTime  finite non-negative numbers (unix ms)
 */
const RecallBodySchema = z.object({
  query: z.string().min(1).max(1024),
  scope: z.string().max(64).optional(),
  fromTime: z.number().int().nonnegative().finite().optional(),
  toTime: z.number().int().nonnegative().finite().optional(),
});

/**
 * POST /api/memory/recall
 *
 * Body: { query: string, scope?: string, fromTime?: number, toTime?: number }
 *
 * Returns up to 20 hits, ranked by token-match count then recency. The
 * production vector + FTS path lives in `packages/memory/` and is used
 * by the CLI's `ivaronix memory recall` — Studio's lightweight
 * implementation is fast and good enough for the demo UX.
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = RecallBodySchema.safeParse(rawBody);
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

  const hits = recallNotes({
    wallet: session.wallet,
    query: body.query,
    ...(body.scope ? { scope: body.scope } : {}),
    ...(typeof body.fromTime === 'number' ? { fromTime: body.fromTime } : {}),
    ...(typeof body.toTime === 'number' ? { toTime: body.toTime } : {}),
  });
  return NextResponse.json({ hits });
}
