/**
 * Unit tests for the legacy V1 canonical-hash primitives + the V2
 * bridge that wraps RFC-8785 JCS.
 *
 * Every Ivaronix receipt's `receiptRoot` derives from these. The
 * existing 1,644+ V1 anchors trust the V1 canonicalize algorithm
 * (sorted keys + recursive + exclude-set). Any bug here invalidates
 * the entire historical anchor set — verifiers must produce the same
 * hash on the same input forever.
 *
 * `jcs.test.ts` covers `jcs()` directly (17 tests). This file covers
 * the V1 path + V2 bridge that consumers actually call from
 * receipt-builders.
 *
 * Test runner: Node's built-in node:test via tsx.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalize,
  canonicalHash,
  canonicalHashV2,
  sha256Hex,
} from './canonical.js';

test('canonicalize: sorts keys lexicographically (top level)', () => {
  // Two objects with same content but different key order must
  // canonicalize to the same string.
  const a = canonicalize({ z: 1, a: 2, m: 3 });
  const b = canonicalize({ a: 2, m: 3, z: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"m":3,"z":1}');
});

test('canonicalize: sorts keys recursively (nested objects)', () => {
  const a = canonicalize({ outer: { z: 1, a: 2 } });
  const b = canonicalize({ outer: { a: 2, z: 1 } });
  assert.equal(a, b);
  assert.equal(a, '{"outer":{"a":2,"z":1}}');
});

test('canonicalize: array element order is preserved (NOT sorted)', () => {
  // Arrays are ordered collections; sorting them would change semantics.
  // Pinning that the algorithm sorts keys but NOT array elements.
  const out = canonicalize({ items: [3, 1, 2] });
  assert.equal(out, '{"items":[3,1,2]}');
});

test('canonicalize: array elements canonicalize recursively', () => {
  const out = canonicalize({ items: [{ z: 1, a: 2 }] });
  assert.equal(out, '{"items":[{"a":2,"z":1}]}');
});

test('canonicalize: no whitespace in output', () => {
  const out = canonicalize({ a: 1, b: 2 });
  assert.equal(out, '{"a":1,"b":2}');
  assert.ok(!/\s/.test(out));
});

test('canonicalize: excludeKeys removes named keys at every level', () => {
  const out = canonicalize(
    { signature: 'should-not-appear', other: { signature: 'also-removed', kept: 'yes' } },
    new Set(['signature']),
  );
  assert.equal(out, '{"other":{"kept":"yes"}}');
});

test('canonicalize: empty excludeKeys keeps everything', () => {
  const out = canonicalize({ signature: 'kept', a: 1 });
  assert.equal(out, '{"a":1,"signature":"kept"}');
});

test('canonicalize: null and undefined preserved (V1 semantics)', () => {
  // V1 keeps null + undefined as-is. V2 (JCS) rejects undefined.
  // Pinning V1 specifically so any future "let's mirror JCS" change
  // is intentional, not silent.
  assert.equal(canonicalize(null), 'null');
  assert.equal(canonicalize({ a: null }), '{"a":null}');
});

test('canonicalize: primitives pass through (string/number/boolean)', () => {
  assert.equal(canonicalize('hello'), '"hello"');
  assert.equal(canonicalize(42), '42');
  assert.equal(canonicalize(true), 'true');
  assert.equal(canonicalize(false), 'false');
});

test('canonicalHash: returns 0x-prefixed 64-hex (keccak256)', () => {
  const h = canonicalHash({ a: 1 });
  assert.match(h, /^0x[0-9a-f]{64}$/);
});

test('canonicalHash: deterministic across key-order permutations', () => {
  // The whole point of canonicalization. Same content = same hash,
  // regardless of how the object was constructed.
  const h1 = canonicalHash({ z: 1, a: 2, m: 3 });
  const h2 = canonicalHash({ a: 2, m: 3, z: 1 });
  const h3 = canonicalHash({ m: 3, z: 1, a: 2 });
  assert.equal(h1, h2);
  assert.equal(h2, h3);
});

test('canonicalHash: different content → different hash', () => {
  const a = canonicalHash({ a: 1 });
  const b = canonicalHash({ a: 2 });
  assert.notEqual(a, b);
});

test('canonicalHash: signature excluded when listed in excludeKeys', () => {
  // The receipt-build pattern: hash the unsigned receipt by excluding
  // `signature` from canonicalization. The same receipt before/after
  // signing must yield the same hash.
  const exclude = new Set(['signature']);
  const before = canonicalHash({ a: 1 }, exclude);
  const after = canonicalHash({ a: 1, signature: '0xdeadbeef' }, exclude);
  assert.equal(before, after);
});

test('canonicalHashV2: returns 0x-prefixed 64-hex (keccak256 of jcs)', () => {
  const h = canonicalHashV2({ a: 1 });
  assert.match(h, /^0x[0-9a-f]{64}$/);
});

test('canonicalHashV2: deterministic across key-order permutations', () => {
  const h1 = canonicalHashV2({ z: 1, a: 2, m: 3 });
  const h2 = canonicalHashV2({ a: 2, m: 3, z: 1 });
  assert.equal(h1, h2);
});

test('canonicalHashV2: signature excluded when listed in excludeKeys', () => {
  const exclude = new Set(['signature']);
  const before = canonicalHashV2({ a: 1 }, exclude);
  const after = canonicalHashV2({ a: 1, signature: '0xdeadbeef' }, exclude);
  assert.equal(before, after);
});

test('canonicalHash vs canonicalHashV2: identical hash on benign inputs (by design)', () => {
  // V1 (JSON.stringify-based) and V2 (RFC-8785 JCS) both sort keys
  // recursively + drop whitespace + emit UTF-8. On benign inputs
  // (no undefined, no Symbol, no edge-case number formatting) they
  // produce IDENTICAL hashes. This is intentional — JCS was designed
  // to match JSON.stringify on the common case. The schemaVersion
  // gate matters for OTHER reasons (V2 rejects undefined where V1
  // silently kept it, future polyglot-verifier alignment, etc.).
  const v1 = canonicalHash({ a: 1, b: [2, 3] });
  const v2 = canonicalHashV2({ a: 1, b: [2, 3] });
  assert.equal(v1, v2, 'V1 and V2 must agree on benign inputs (no edge-case primitives)');
});

test('canonicalHash + canonicalHashV2: both treat object-property undefined as omitted', () => {
  // Practical convergence on the common case: V1's JSON.stringify drops
  // `undefined` properties; V2's JCS skips undefined values inside
  // objects (JS-style, per packages/core/src/jcs.ts line 109). So
  // `{ a: 1, missing: undefined }` hashes the same as `{ a: 1 }`
  // under BOTH algorithms. Pinning this convergence.
  assert.equal(
    canonicalHash({ a: 1, missing: undefined }),
    canonicalHash({ a: 1 }),
  );
  assert.equal(
    canonicalHashV2({ a: 1, missing: undefined }),
    canonicalHashV2({ a: 1 }),
  );
});

test('canonicalHashV2 (V2 / JCS): rejects bare undefined, Symbol, function, BigInt', () => {
  // Where V1 and V2 actually diverge: V1's canonicalize would happily
  // pass `undefined` through to JSON.stringify (which returns the
  // string "undefined"... actually it returns undefined, leading to
  // toUtf8Bytes failing). V2's JCS rejects these primitives explicitly
  // at the top level with clear error messages. Pinning the V2-strict
  // contract so any future "let's allow Symbol for keys" change must
  // be intentional.
  assert.throws(() => canonicalHashV2(undefined), /undefined is not canonicalizable/);
  assert.throws(() => canonicalHashV2(Symbol('x')), /symbol is not canonicalizable/);
  assert.throws(() => canonicalHashV2(() => null), /function is not canonicalizable/);
  assert.throws(() => canonicalHashV2(BigInt(1)), /bigint is not canonicalizable/);
});

test('sha256Hex (sync): explicitly throws · async path required', () => {
  // The sync stub exists so callers don't accidentally use a fake
  // sync implementation. The throw redirects them to sha256HexAsync.
  // Pinning the throw + the message text so any future "let's
  // implement sync sha256 with WebCrypto" lands intentionally.
  assert.throws(() => sha256Hex('any'), /sha256Hex is async/);
});
