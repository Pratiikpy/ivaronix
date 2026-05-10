import { NextResponse } from 'next/server';
import { loadDashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/<address> — returns the canonical dashboard payload
 * for an address: passport state + last 5 receipts + native OG balance
 * + local schedules.
 *
 * Read-only by design — every call resolves public chain state, so the
 * route doesn't gate on auth. Per-address caching lives in
 * `loadDashboard()` so the SSR page (planning-003 §A.5.16) and this
 * endpoint share the same cache surface.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ addr: string }> },
): Promise<NextResponse> {
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
