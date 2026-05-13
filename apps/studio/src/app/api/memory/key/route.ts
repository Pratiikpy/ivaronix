/**
 * FINAL_BUILD_PLAN.md Block F · D-7 · self-serve API-key issuance.
 *
 * POST /api/memory/key
 *   - SIWE-gated: caller must have an active SIWE session
 *   - Calls the operator-hosted EverMemOS /api/v1/users/register with the
 *     caller's wallet, receives a Bearer token mapped to that wallet
 *   - Returns the token to the caller; the Studio client persists it in
 *     localStorage and includes it on subsequent memory reads
 *
 * Authorization model:
 *   1. SIWE session → caller's wallet identity verified
 *   2. KV server's user-registration → token mapped to wallet at the
 *      EverMemOS layer (multi-user isolation at storage layer)
 *   3. Chain-grant cross-check on every read (memory-grant-check.ts)
 *      → revocations on CapabilityRegistryV2 become immediate read failures
 */
import { NextResponse } from 'next/server';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';
import { sanitizeErrorMessage } from '@/lib/error-sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sessionCookie = req.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = readSession(sessionCookie);

  if (!session) {
    return NextResponse.json(
      { error: 'SIWE session required — POST /api/auth/siwe/verify first' },
      { status: 401 },
    );
  }

  const kvServerUrl = process.env.KV_REMOTE_URL ?? process.env.IVARONIX_KV_URL;
  if (!kvServerUrl) {
    return NextResponse.json(
      {
        error: '0G KV server not configured on this deployment',
        code: 'KV_NOT_CONFIGURED',
        hint: 'Set KV_REMOTE_URL to your operator-hosted EverMemOS endpoint (see infra/0g-kv/README.md).',
      },
      { status: 503 },
    );
  }

  // Operator's bootstrap API key — set as KV_ISSUER_API_KEY in Studio env.
  // This is the key the KV server expects from anything that issues
  // user-scoped tokens. Without it, end-user registration is impossible.
  const issuerKey = process.env.KV_ISSUER_API_KEY;
  if (!issuerKey) {
    return NextResponse.json(
      {
        error: 'KV_ISSUER_API_KEY missing — operator must configure',
        code: 'KV_ISSUER_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  try {
    const registerRes = await fetch(`${kvServerUrl.replace(/\/$/, '')}/api/v1/users/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${issuerKey}`,
      },
      body: JSON.stringify({ wallet: session.wallet }),
    });

    if (!registerRes.ok) {
      const text = await registerRes.text();
      return NextResponse.json(
        {
          error: `KV server registration failed: ${registerRes.status}`,
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const data = (await registerRes.json()) as { api_key?: string; user_id?: string };
    if (!data.api_key) {
      return NextResponse.json({ error: 'KV server returned no api_key' }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      apiKey: data.api_key,
      userId: data.user_id,
      wallet: session.wallet,
      kvUrl: kvServerUrl,
    });
  } catch (err) {
    console.error('[api/memory/key] error:', err);
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 });
  }
}
