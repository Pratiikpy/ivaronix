/**
 * Diagnostic-only endpoint · `/api/debug/upstash`
 *
 * Tests the receipt-cache write/read round-trip using the official
 * @upstash/redis SDK. Returns JSON with the actual outcome so we can see
 * whether the cache flow works on production without combing through
 * Vercel function logs.
 *
 * error-sanitize-allow:debug-endpoint-must-expose-raw-failure-mode
 */
import { NextResponse } from 'next/server';
import { cacheReceiptBody, fetchCachedReceiptBody } from '@/lib/receipt-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const hasUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!hasUrl || !hasToken) {
    return NextResponse.json({ ok: false, reason: 'env-missing', hasUrl, hasToken });
  }

  // Fake a receiptRoot so we don't collide with real cache entries.
  const probeRoot = `0xdebug${Date.now()}`;
  const probeBody = { smoke: 'upstash-roundtrip', ts: Date.now() };

  const setStart = Date.now();
  const setOk = await cacheReceiptBody(probeRoot, probeBody);
  const setMs = Date.now() - setStart;

  const getStart = Date.now();
  const got = await fetchCachedReceiptBody(probeRoot);
  const getMs = Date.now() - getStart;

  const roundtripMatches = JSON.stringify(got) === JSON.stringify(probeBody);

  return NextResponse.json({
    ok: setOk && roundtripMatches,
    setOk,
    setMs,
    getMs,
    roundtripMatches,
    probeRoot,
    probeBody,
    fetched: got,
  });
}
