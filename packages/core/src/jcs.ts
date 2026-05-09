/**
 * RFC-8785 (JCS — JSON Canonicalization Scheme) implementation in TypeScript.
 *
 * Used by Ivaronix receipts schemaVersion 2.0+ as the canonical-hash input.
 * Reference verifiers in Rust + Go + Python (see HASH_FUNCTION.md, in flight)
 * implement the same spec; cross-impl byte-equality is enforced in CI.
 *
 * Why not the existing `canonical.ts`? That impl uses Node's `JSON.stringify`
 * directly on values — for strings it omits NFC normalisation; for numbers
 * it inherits ECMAScript Number-to-string semantics that other languages
 * cannot reproduce without porting the full V8 implementation. RFC-8785
 * pins each step explicitly so any RFC-compliant implementation in any
 * language produces byte-identical output.
 *
 * Spec: https://www.rfc-editor.org/rfc/rfc8785
 */

/** Reject the values JCS forbids. Done up-front so error messages are clear. */
function ensureCanonicalizable(value: unknown, path: string): void {
  if (value === undefined) {
    throw new Error(`jcs: undefined is not canonicalizable (at ${path}; use null or omit)`);
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) throw new Error(`jcs: NaN is not allowed (at ${path})`);
    if (!Number.isFinite(value)) throw new Error(`jcs: Infinity is not allowed (at ${path})`);
  }
  if (typeof value === 'bigint') {
    throw new Error(`jcs: bigint is not canonicalizable (at ${path}; encode as decimal string)`);
  }
  if (typeof value === 'symbol' || typeof value === 'function') {
    throw new Error(`jcs: ${typeof value} is not canonicalizable (at ${path})`);
  }
}

/**
 * RFC-8785 §3.2.2.2 — String serialization. UTF-8 NFC normalisation, then
 * minimal escaping per the RFC. Other Unicode passes through as raw bytes
 * (the output stage emits UTF-8).
 */
function serializeString(s: string): string {
  // NFC is required — not every JS environment normalises by default.
  const normalised = s.normalize('NFC');
  let out = '"';
  for (let i = 0; i < normalised.length; i++) {
    const code = normalised.charCodeAt(i);
    if (code === 0x22) out += '\\"';        // "
    else if (code === 0x5c) out += '\\\\';   // \
    else if (code === 0x08) out += '\\b';
    else if (code === 0x09) out += '\\t';
    else if (code === 0x0a) out += '\\n';
    else if (code === 0x0c) out += '\\f';
    else if (code === 0x0d) out += '\\r';
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += normalised.charAt(i);
  }
  out += '"';
  return out;
}

/**
 * RFC-8785 §3.2.2.3 — Number serialization per ECMAScript Number-to-string,
 * with the spec carve-outs for `0` (always `0`), `-0` (always `0`), and
 * forbidden `NaN` / `Infinity`. The vast majority of integer + plain-decimal
 * cases pass through `String(n)` correctly; the exponent boundary at ±1e21
 * + small-fraction notation matches between V8 and the spec.
 *
 * NOTE: the full RFC-8785 number formatter has corner cases around very
 * small / very large doubles; this implementation handles every case the
 * test vectors cover. If a future receipt needs `1e-308`-scale precision,
 * extend this function and add a vector to jcs.test.ts.
 */
function serializeNumber(n: number): string {
  if (n === 0) return '0'; // covers both +0 and -0
  // ECMAScript Number-to-string handles the standard range honestly. The
  // edge cases (e.g. round-trip after parseFloat) match RFC-8785.
  const s = String(n);
  // ECMAScript prints `1e+21` for >=1e21 — RFC-8785 expects the same form.
  return s;
}

function recurse(value: unknown, path: string): string {
  ensureCanonicalizable(value, path);
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return serializeNumber(value);
  if (typeof value === 'string') return serializeString(value);
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (let i = 0; i < value.length; i++) {
      parts.push(recurse(value[i], `${path}[${i}]`));
    }
    return `[${parts.join(',')}]`;
  }
  if (typeof value === 'object') {
    // RFC-8785 §3.2.3 — sort keys by UTF-16 code-unit value (the same order
    // ECMAScript's String.prototype.localeCompare returns when neither
    // language tags nor `sensitivity` are involved). Plain `<` / `>` on
    // strings does the right thing for ASCII / BMP keys; we'd extend if a
    // receipt ever included supplementary-plane keys (none does today).
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      // Per RFC-8785, undefined values are not allowed; we already throw
      // in ensureCanonicalizable when traversing them. Members whose value
      // is exactly `undefined` are skipped at the source — JS-style — to
      // match the existing canonical.ts behaviour.
      if (v === undefined) continue;
      parts.push(`${serializeString(k)}:${recurse(v, `${path}.${k}`)}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new Error(`jcs: unsupported type ${typeof value} at ${path}`);
}

/**
 * Canonicalize a JS value per RFC-8785. Returns the JSON text as a UTF-8
 * string. The caller is responsible for hashing (typically `keccak256(jcs(v))`
 * for Ivaronix receipts schemaVersion 2.0+).
 */
export function jcs(value: unknown): string {
  return recurse(value, '$');
}

/**
 * Same as `jcs(value)` but returns the UTF-8 byte buffer directly. Use this
 * when feeding a hash function that wants `Uint8Array`.
 */
export function jcsBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(jcs(value));
}
