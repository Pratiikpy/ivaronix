/**
 * Recursive BigInt → string converter for response payloads.
 *
 * Why not just polyfill BigInt.prototype.toJSON? Tried that first
 * (commit 6fdc90e); the polyfill works in raw Node but didn't take
 * effect under Vercel's serverless runtime — likely because the
 * route bundle and the library bundles each load their own copy
 * of BigInt's prototype object, so polyfilling in one place doesn't
 * affect what library code sees. Doing the conversion explicitly
 * sidesteps that.
 *
 * Usage:
 *
 *   import { jsonSafe } from '@/lib/bigint-json';
 *   return NextResponse.json(jsonSafe(payload));
 *
 * BigInt values serialize as JSON strings (1234n → "1234"). Numeric-
 * looking but typed string — the same convention formatUnits() uses
 * and the same shape every existing .toString() call in this codebase
 * already produces.
 *
 * P5 auto run 2026-05-13 caught this: /api/run/demo's pipeline
 * succeeded end-to-end (consensus + storage + receipt anchored on-
 * chain id 23) and the response payload then threw on serialization,
 * the catch block intercepted, and the user saw PIPELINE_FAILED_POST_
 * PAYMENT despite the chain having a real receipt + their payment
 * already debited.
 */
export function jsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as unknown as T;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(jsonSafe) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = jsonSafe(v);
    }
    return out as unknown as T;
  }
  return value;
}
