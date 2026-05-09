import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jcs, jcsBytes } from './jcs.js';

// ─── RFC-8785 test vectors · K-15 ────────────────────────────────────────
// Each vector lists the input JS value + the expected JCS output bytes.
// Future Rust / Go / Python implementations must produce byte-identical
// output for every vector here. The cross-impl CI test (HALF_BAKED K-15
// follow-up) will hash these vectors in all four languages and assert
// byte equality.

test('K-15 · primitives · null', () => {
  assert.equal(jcs(null), 'null');
});

test('K-15 · primitives · booleans', () => {
  assert.equal(jcs(true), 'true');
  assert.equal(jcs(false), 'false');
});

test('K-15 · numbers · zero handling (0 and -0 both serialize as "0")', () => {
  assert.equal(jcs(0), '0');
  assert.equal(jcs(-0), '0');
});

test('K-15 · numbers · simple integers + decimals', () => {
  assert.equal(jcs(1), '1');
  assert.equal(jcs(-1), '-1');
  assert.equal(jcs(1234567890), '1234567890');
  assert.equal(jcs(1.5), '1.5');
  assert.equal(jcs(0.1), '0.1');
});

test('K-15 · numbers · NaN rejected', () => {
  assert.throws(() => jcs(Number.NaN), /NaN is not allowed/);
});

test('K-15 · numbers · Infinity rejected', () => {
  assert.throws(() => jcs(Number.POSITIVE_INFINITY), /Infinity is not allowed/);
  assert.throws(() => jcs(Number.NEGATIVE_INFINITY), /Infinity is not allowed/);
});

test('K-15 · strings · ASCII pass-through', () => {
  assert.equal(jcs('hello'), '"hello"');
  assert.equal(jcs(''), '""');
});

test('K-15 · strings · escape required for control chars + quote + backslash', () => {
  assert.equal(jcs('a"b'), '"a\\"b"');
  assert.equal(jcs('a\\b'), '"a\\\\b"');
  assert.equal(jcs('a\nb'), '"a\\nb"');
  assert.equal(jcs('a\tb'), '"a\\tb"');
  assert.equal(jcs('a\rb'), '"a\\rb"');
  assert.equal(jcs('a\bb'), '"a\\bb"');
  assert.equal(jcs('a\fb'), '"a\\fb"');
  // Non-printables under U+0020 → \uXXXX
  assert.equal(jcs('ab'), '"a\\u0001b"');
});

test('K-15 · strings · NFC normalisation applied before serialization', () => {
  // U+00E9 ("é" precomposed) vs U+0065 U+0301 ("e" + combining acute).
  // NFC normalises both to U+00E9.
  const composed = 'é';
  const decomposed = 'é';
  assert.equal(jcs(composed), jcs(decomposed));
});

test('K-15 · objects · keys sorted by UTF-16 code-unit value', () => {
  assert.equal(jcs({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(jcs({ z: 1, A: 2 }), '{"A":2,"z":1}');
  // Empty object.
  assert.equal(jcs({}), '{}');
});

test('K-15 · objects · undefined members skipped', () => {
  // JCS forbids undefined; we mirror canonical.ts in dropping members
  // whose value is exactly undefined (treats them as absent).
  const obj = { a: 1, b: undefined as unknown as string, c: 3 };
  assert.equal(jcs(obj), '{"a":1,"c":3}');
});

test('K-15 · arrays · order preserved + values recursed', () => {
  assert.equal(jcs([1, 2, 3]), '[1,2,3]');
  assert.equal(jcs([{ b: 1, a: 2 }]), '[{"a":2,"b":1}]');
  assert.equal(jcs([]), '[]');
});

test('K-15 · nested · receipt-shaped object', () => {
  const value = {
    type: 'doc_ask',
    request: { skillId: 'private-doc-review', skillVersion: '0.1.0' },
    agent: { ownerWallet: '0xabcdef' },
    outputs: { riskLevel: 'low' },
  };
  // Keys at every level sorted alphabetically.
  assert.equal(
    jcs(value),
    '{"agent":{"ownerWallet":"0xabcdef"},"outputs":{"riskLevel":"low"},"request":{"skillId":"private-doc-review","skillVersion":"0.1.0"},"type":"doc_ask"}',
  );
});

test('K-15 · jcsBytes returns a UTF-8 buffer of the canonical string', () => {
  const v = { hello: 'world' };
  const text = jcs(v);
  const bytes = jcsBytes(v);
  assert.equal(new TextDecoder('utf-8').decode(bytes), text);
});

test('K-15 · symbols + functions + bigints rejected', () => {
  assert.throws(() => jcs(Symbol('x')), /symbol is not canonicalizable/);
  assert.throws(() => jcs(() => null), /function is not canonicalizable/);
  assert.throws(() => jcs(BigInt(1)), /bigint is not canonicalizable/);
});

test('K-15 · undefined at top level rejected', () => {
  assert.throws(() => jcs(undefined), /undefined is not canonicalizable/);
});

test('K-15 · large nested mix · deterministic output across calls', () => {
  const v = {
    list: [3, 1, 2, { z: 'last', a: 'first' }],
    str: 'café',
    n: -0,
    b: true,
    nullField: null,
  };
  const out1 = jcs(v);
  const out2 = jcs(v);
  assert.equal(out1, out2);
  // Manual expected value, building it up by sort order.
  // Top-level keys: b, list, n, nullField, str.
  // List preserved in order; the inner object's keys sorted: a, z.
  const expected =
    '{"b":true,"list":[3,1,2,{"a":"first","z":"last"}],"n":0,"nullField":null,"str":"café"}';
  assert.equal(out1, expected);
});
