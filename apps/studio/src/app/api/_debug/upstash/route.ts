/**
 * Diagnostic-only endpoint · `/api/_debug/upstash`
 *
 * Tests the receipt-cache write/read round-trip against the deployed
 * Upstash credentials. Returns the raw HTTP responses so we can see
 * exactly where the cache flow is breaking on production (the
 * `console.warn` in receipt-cache.ts is invisible from outside Vercel
 * function logs).
 *
 * Returns JSON · safe to leave deployed (no secrets, no destructive
 * ops). Will remove once Upstash is confirmed working.
 *
 * error-sanitize-allow:debug-endpoint-must-expose-raw-failure-mode
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return NextResponse.json({
      ok: false,
      reason: 'env-missing',
      hasUrl: !!url,
      hasToken: !!token,
    });
  }

  const probeKey = `receipt:body:debug-${Date.now()}`;
  const probeValue = JSON.stringify({ smoke: 'test', ts: Date.now() });

  // SET via command-array body
  const setStart = Date.now();
  let setRes: { status: number; body: string };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['SET', probeKey, probeValue, 'EX', '60']),
    });
    setRes = { status: r.status, body: (await r.text()).slice(0, 500) };
  } catch (err) {
    setRes = { status: 0, body: `THREW: ${(err as Error).message}` };
  }
  const setMs = Date.now() - setStart;

  // GET via command-array body
  const getStart = Date.now();
  let getRes: { status: number; body: string };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', probeKey]),
    });
    getRes = { status: r.status, body: (await r.text()).slice(0, 500) };
  } catch (err) {
    getRes = { status: 0, body: `THREW: ${(err as Error).message}` };
  }
  const getMs = Date.now() - getStart;

  return NextResponse.json({
    ok: setRes.status === 200 && getRes.status === 200,
    url: url.replace(/^https:\/\/([^.]+)\..*/, 'https://$1.<redacted>'),
    tokenLength: token.length,
    probeKey,
    probeValue,
    set: { ...setRes, ms: setMs },
    get: { ...getRes, ms: getMs },
  });
}
