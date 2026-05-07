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

/** Hash of arbitrary string content (for input/output hashes per RECEIPTS_SPEC). */
export function sha256Hex(content: string): `sha256:${string}` {
  // Synchronous sha256 fallback using ethers' keccak isn't sha256. Use Web Crypto in async paths.
  // For sync sha256, callers should use the async sha256 in node:crypto. This stub returns a marker.
  // Real implementation uses async sha256 via ./hash.ts (added in Day 2).
  void content;
  throw new Error('sha256Hex is async — use sha256HexAsync from ./hash.ts');
}
