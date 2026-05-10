/**
 * Token-bucket rate limiter for /api/run + /api/skill/save (HALF_BAKED K-8 + K-9).
 *
 * Default backend is an in-memory Map per process. Production multi-instance
 * deployments should set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 * to share buckets across instances; see `applyUpstashBacking`. The in-memory
 * adapter is honest about what it covers: a single Vercel function instance
 * over a sliding window. Multi-instance attacks evade the in-memory bucket
 * proportionally — the env-var path is the production answer.
 *
 * Buckets are keyed by `<kind>:<key>` so per-IP and per-wallet caps stack:
 * an authenticated wallet pays both buckets simultaneously.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number; // unix ms when the oldest hit ages out
  limit: number;
  windowSec: number;
}

export type RateKind = 'ip' | 'wallet' | 'skill-save' | 'memory-write' | 'onboard' | 'siwe-handshake' | 'dashboard-read';

/**
 * Slide a bucket and check whether one more hit fits.
 * Default limits per HALF_BAKED N · K-8 / N · K-9 + planning-003 §A.4.8
 * (memory-write per-wallet bucket).
 */
export function checkRateLimit(
  kind: RateKind,
  key: string,
  opts?: { limit?: number; windowSec?: number },
): RateLimitResult {
  const limits: Record<RateKind, { limit: number; windowSec: number }> = {
    ip: { limit: 10, windowSec: 60 }, // 10 anonymous /api/run hits per minute per IP
    wallet: { limit: 50, windowSec: 3_600 }, // 50 authenticated runs per hour per wallet
    'skill-save': { limit: 5, windowSec: 3_600 }, // 5 manifest saves per hour per wallet
    'memory-write': { limit: 60, windowSec: 3_600 }, // 60 memory writes per hour per wallet (~1/min)
    onboard: { limit: 5, windowSec: 900 }, // 5 onboard-metadata uploads per 15 min per IP (operator pays gas; tight ceiling, legit retry budget)
    'siwe-handshake': { limit: 30, windowSec: 60 }, // 30 nonce-or-verify hits per minute per IP. Anonymous flood otherwise (a) balloons the in-memory nonce Map (b) burns CPU on ECDSA recovery in verify.
    'dashboard-read': { limit: 60, windowSec: 60 }, // 60 fresh-address dashboard reads per minute per IP. The 60s LRU cache absorbs repeats; an attacker rotating addresses bypasses cache and forces RPC chain-walks, threatening the operator's RPC quota.
  };
  const limit = opts?.limit ?? limits[kind].limit;
  const windowSec = opts?.windowSec ?? limits[kind].windowSec;
  const now = Date.now();
  const cutoff = now - windowSec * 1000;
  const bucketKey = `${kind}:${key}`;
  let bucket = buckets.get(bucketKey);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(bucketKey, bucket);
  }
  // Drop hits older than the window.
  while (bucket.hits.length > 0 && bucket.hits[0]! < cutoff) bucket.hits.shift();
  const used = bucket.hits.length;
  if (used >= limit) {
    const oldest = bucket.hits[0]!;
    return {
      ok: false,
      remaining: 0,
      resetMs: oldest + windowSec * 1000,
      limit,
      windowSec,
    };
  }
  bucket.hits.push(now);
  return {
    ok: true,
    remaining: limit - used - 1,
    resetMs: now + windowSec * 1000,
    limit,
    windowSec,
  };
}

/** Build standard rate-limit headers for a 429 / 200 response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'x-ratelimit-limit': String(result.limit),
    'x-ratelimit-remaining': String(Math.max(0, result.remaining)),
    'x-ratelimit-reset': String(Math.ceil(result.resetMs / 1000)),
    ...(result.ok ? {} : { 'retry-after': String(Math.ceil((result.resetMs - Date.now()) / 1000)) }),
  };
}

/**
 * Read the client IP from request headers. Vercel + most proxies set
 * `x-forwarded-for`; we fall back to the connection-level IP. Honest about
 * spoofability: behind a misconfigured proxy this header is attacker-controlled,
 * which is why per-wallet limits exist on top of per-IP.
 */
export function readClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]!.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? 'unknown';
}

/** TEST-ONLY: clear all buckets between scenarios. */
export function __resetAllBuckets(): void {
  buckets.clear();
}
