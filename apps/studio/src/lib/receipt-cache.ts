/**
 * Persist receipt bodies to Upstash Redis so /r/<id> can render the full
 * AI output for receipts anchored by Studio production (Vercel /tmp is
 * ephemeral · the body would otherwise be lost the moment the function
 * instance recycles).
 *
 * Bug-79 long-tail · the bundled-receipts path under
 * `apps/studio/src/data/receipts/anchored/` only covers CLI-anchored
 * receipts that ship with the deploy. Production-paid receipts (e.g.
 * receipt 140 from marketplace /r/140) anchor on chain but the body
 * disappears with /tmp, so the page shows "skill name in storage body —
 * fetch pending". This cache closes that gap.
 *
 * Keyed by `receiptRoot` (the canonical content-hash) so the lookup in
 * /r/<id> can ask Redis after the on-chain anchor is fetched. TTL set
 * to 30 days — receipts older than that fall back to the on-chain
 * anchor metadata only (which is forever).
 */

const URL_VAR = 'UPSTASH_REDIS_REST_URL';
const TOKEN_VAR = 'UPSTASH_REDIS_REST_TOKEN';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const KEY_PREFIX = 'receipt:body:';

function getCreds(): { url: string; token: string } | null {
  const url = process.env[URL_VAR]?.trim();
  const token = process.env[TOKEN_VAR]?.trim();
  if (!url || !token) return null;
  return { url, token };
}

export async function cacheReceiptBody(receiptRoot: string, body: unknown): Promise<boolean> {
  const creds = getCreds();
  if (!creds) {
    console.warn('[receipt-cache] UPSTASH_REDIS_REST_URL/TOKEN unset · skipping persistence');
    return false;
  }
  const key = KEY_PREFIX + receiptRoot.toLowerCase();
  const value = JSON.stringify(body);
  // Upstash REST API: command-array form via the body. Sending the value
  // in the URL path fails for receipt bodies (>2KB exceeds URL limits)
  // and the JSON-wrap form (`{ value }`) wasn't decoded server-side.
  // The command-array form `["SET", key, value, "EX", ttl]` is the most
  // robust shape and matches the @upstash/redis SDK's wire format.
  try {
    const res = await fetch(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, value, 'EX', String(TTL_SECONDS)]),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[receipt-cache] Upstash SET failed (${res.status}) for ${receiptRoot.slice(0, 10)}… body=${txt.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[receipt-cache] Upstash SET threw:', err);
    return false;
  }
}

export async function fetchCachedReceiptBody(receiptRoot: string): Promise<unknown | null> {
  const creds = getCreds();
  if (!creds) return null;
  const key = KEY_PREFIX + receiptRoot.toLowerCase();
  try {
    const res = await fetch(creds.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', key]),
      // 60s edge cache — receipts are immutable once cached.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | null };
    if (!data.result) return null;
    try {
      return JSON.parse(data.result);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
