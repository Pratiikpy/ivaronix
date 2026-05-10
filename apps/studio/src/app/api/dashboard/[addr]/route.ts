import { NextResponse } from 'next/server';
import { loadDashboard } from '@/lib/dashboard';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/<address> — returns the canonical dashboard payload
 * for an address: passport state + last 5 receipts + native OG balance
 * + local schedules.
 *
 * Read-only by design — every call resolves public chain state, so the
 * route doesn't gate on auth. Per-address caching lives in
 * `loadDashboard()` so the SSR page and this endpoint share the same
 * cache surface.
 *
 * Per-IP throttle on the 'dashboard-read' bucket: the in-memory LRU
 * absorbs repeat addresses but an attacker rotating fresh addresses
 * bypasses the cache and forces a chain-walk on every call, threatening
 * the operator's RPC quota. 60/min/IP is well above any legit fan-out.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ addr: string }> },
): Promise<NextResponse> {
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('dashboard-read', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `dashboard rate limit exceeded · retry after ${Math.ceil((ipLimit.resetMs - Date.now()) / 1000)}s` },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const { addr } = await params;
  try {
    const payload = await loadDashboard(addr);
    return NextResponse.json(payload);
  } catch (err) {
    if ((err as Error).message?.startsWith('invalid address')) {
      return NextResponse.json({ error: 'invalid address' }, { status: 400 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
