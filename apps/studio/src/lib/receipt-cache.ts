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
 * Uses the official @upstash/redis SDK rather than hand-rolling the REST
 * wire format · earlier hand-rolled attempts hit silent format mismatches.
 *
 * Keyed by `receiptRoot` (the canonical content-hash). TTL 30 days.
 */
import { Redis } from '@upstash/redis';

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const KEY_PREFIX = 'receipt:body:';

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    console.warn('[receipt-cache] UPSTASH_REDIS_REST_URL/TOKEN unset · cache disabled');
    return null;
  }
  redisClient = new Redis({ url, token });
  return redisClient;
}

export async function cacheReceiptBody(receiptRoot: string, body: unknown): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const key = KEY_PREFIX + receiptRoot.toLowerCase();
  try {
    await r.set(key, JSON.stringify(body), { ex: TTL_SECONDS });
    return true;
  } catch (err) {
    console.warn(`[receipt-cache] SET ${receiptRoot.slice(0, 10)}… failed:`, (err as Error).message);
    return false;
  }
}

export async function fetchCachedReceiptBody(receiptRoot: string): Promise<unknown | null> {
  const r = getRedis();
  if (!r) return null;
  const key = KEY_PREFIX + receiptRoot.toLowerCase();
  try {
    const data = await r.get<string>(key);
    if (!data) return null;
    // The SDK auto-parses JSON when the stored value is a JSON string;
    // handle both shapes for safety.
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return data; }
    }
    return data;
  } catch (err) {
    console.warn(`[receipt-cache] GET ${receiptRoot.slice(0, 10)}… failed:`, (err as Error).message);
    return null;
  }
}
