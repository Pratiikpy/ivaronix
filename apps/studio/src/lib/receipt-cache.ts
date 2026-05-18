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
    if (process.env.IVARONIX_DEBUG) {
      console.warn('[receipt-cache] UPSTASH_REDIS_REST_URL/TOKEN unset · skipping persistence');
    }
    return false;
  }
  const key = KEY_PREFIX + receiptRoot.toLowerCase();
  const value = JSON.stringify(body);
  // Upstash REST API: SET <key> <value> EX <ttl>
  try {
    const res = await fetch(`${creds.url}/set/${encodeURIComponent(key)}?EX=${TTL_SECONDS}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) {
      console.warn(`[receipt-cache] Upstash SET failed (${res.status}) for ${receiptRoot.slice(0, 10)}…`);
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
    const res = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${creds.token}` },
      // No revalidation cache — receipts are immutable once cached, but a
      // 60s edge cache still saves the round-trip for hot receipts.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | null };
    if (!data.result) return null;
    // Upstash stores our JSON-wrapped object as a string; double-decode.
    try {
      const wrapped = JSON.parse(data.result) as { value?: string };
      if (typeof wrapped.value !== 'string') return null;
      return JSON.parse(wrapped.value);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
