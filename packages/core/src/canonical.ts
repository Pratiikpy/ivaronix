import { keccak256, toUtf8Bytes } from 'ethers';

/**
 * Canonical JSON serialization per RECEIPTS_SPEC.md §3.
 * - Sorts keys lexicographically (recursive)
 * - No whitespace
 * - UTF-8
 * - The `signature` field is excluded (canonicalize the unsigned receipt before signing)
 */
export function canonicalize(value: unknown, excludeKeys: ReadonlySet<string> = new Set()): string {
  const sortKeys = (val: unknown): unknown => {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) return val.map(sortKeys);
    if (typeof val !== 'object') return val;
    const obj = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      if (excludeKeys.has(k)) continue;
      sorted[k] = sortKeys(obj[k]);
    }
    return sorted;
  };
  return JSON.stringify(sortKeys(value));
}

/** keccak256 of canonical bytes — used as the receipt root hash. */
export function canonicalHash(value: unknown, excludeKeys?: ReadonlySet<string>): `0x${string}` {
  const bytes = toUtf8Bytes(canonicalize(value, excludeKeys));
  return keccak256(bytes) as `0x${string}`;
}

/**
 * V2 canonical hash · `keccak256(jcs(value))` per RFC-8785 + Ivaronix
 * receipts schemaVersion 2.0+. Use this once the polyglot reference
 * verifiers (Rust + Go + Python) have shipped — until then, new receipts
 * MUST keep using `canonicalHash` for compatibility with the existing
 * 1,330+ anchored receipts. K-15 in HALF_BAKED.md tracks the full
 * migration; the verifier branches on `schemaVersion` so v1 + v2
 * receipts coexist forever.
 */
export function canonicalHashV2(value: unknown, excludeKeys?: ReadonlySet<string>): `0x${string}` {
  // The exclude set still applies — we strip the same fields (signature,
  // chainAnchor mutables, etc.) before hashing. Apply the strip first,
  // then run JCS over the result.
  const strip = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(strip);
    const out: Record<string, unknown> = {};
    for (const [k, value] of Object.entries(v as Record<string, unknown>)) {
      if (excludeKeys?.has(k)) continue;
      out[k] = strip(value);
    }
    return out;
  };
  // Lazy import to avoid a circular dep — canonical.ts is depended on
  // by jcs consumers indirectly. The barrel exports both side by side.
  const { jcs } = require('./jcs.js') as typeof import('./jcs.js');
  return keccak256(toUtf8Bytes(jcs(strip(value)))) as `0x${string}`;
}

/** Hash of arbitrary string content (for input/output hashes per RECEIPTS_SPEC). */
export function sha256Hex(content: string): `sha256:${string}` {
  // Synchronous sha256 fallback using ethers' keccak isn't sha256. Use Web Crypto in async paths.
  // For sync sha256, callers should use the async sha256 in node:crypto. This stub returns a marker.
  // Real implementation uses async sha256 via ./hash.ts (added in Day 2).
  void content;
  throw new Error('sha256Hex is async — use sha256HexAsync from ./hash.ts');
}
