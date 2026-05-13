/**
 * Polyfill BigInt.prototype.toJSON so NextResponse.json (built on
 * JSON.stringify) can serialize BigInt values. Without this, any bigint
 * leaking into a response payload throws "Do not know how to serialize a
 * BigInt" — the catch block then surfaces a misleading high-level error
 * (PIPELINE_FAILED_POST_PAYMENT etc.) while the underlying pipeline
 * actually succeeded and anchored the receipt on chain.
 *
 * P5 auto run 2026-05-13 caught this in /api/run/demo: receipt rcpt_
 * 01KRH9F3MNK614DQ8HXPHXYN02 was anchored on-chain id 23 + storage
 * uploaded + burn-mode keyFingerprint visible in the logs · final
 * response was {"ok":false,"error":"Do not know how to serialize a
 * BigInt"} so the user thinks the run failed.
 *
 * Loaded once per API route via `import './bigint-json'` at top of file.
 * BigInt values serialize as JSON strings: 1234n → "1234". Numeric-looking
 * but typed string — receivers must parse with BigInt() if they need the
 * value back as bigint (the same convention `formatUnits` already uses).
 *
 * Safe to load multiple times — assignment is idempotent.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface BigInt {
    toJSON(): string;
  }
}

if (typeof (BigInt.prototype as { toJSON?: () => string }).toJSON !== 'function') {
  (BigInt.prototype as { toJSON?: () => string }).toJSON = function (this: bigint): string {
    return this.toString();
  };
}

export const bigintJsonPolyfillApplied = true;
