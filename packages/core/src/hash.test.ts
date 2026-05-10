/**
 * Unit tests for the SHA-256 hex digest helper.
 *
 * Covers `input/output hash` per RECEIPTS_SPEC.md — every receipt
 * carries `inputHash: sha256:<hex>` and `outputHash: sha256:<hex>`,
 * derived via this primitive. A regression that emits a different
 * hex format silently invalidates every receipt's content-binding.
 *
 * Test runner: Node's built-in node:test via tsx.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256HexAsync } from './hash.js';

test('sha256HexAsync: returns sha256:<64-hex> shape', () => {
  const h = sha256HexAsync('hello');
  assert.match(h, /^sha256:[0-9a-f]{64}$/);
});

test('sha256HexAsync: empty string maps to NIST FIPS-180 known constant', () => {
  // SHA-256 of zero bytes is the well-known fixed value
  // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.
  // If this ever changes, the implementation isn't SHA-256.
  assert.equal(
    sha256HexAsync(''),
    'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});

test('sha256HexAsync: "abc" maps to NIST FIPS-180 known constant', () => {
  // Per NIST FIPS-180 §B.1: SHA-256 of "abc" is
  // ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad.
  // Same regression sentinel as above.
  assert.equal(
    sha256HexAsync('abc'),
    'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('sha256HexAsync: deterministic across calls (same input → same hash)', () => {
  const a = sha256HexAsync('the quick brown fox');
  const b = sha256HexAsync('the quick brown fox');
  assert.equal(a, b);
});

test('sha256HexAsync: different input → different hash', () => {
  assert.notEqual(sha256HexAsync('a'), sha256HexAsync('b'));
});

test('sha256HexAsync: accepts Uint8Array input (binary content)', () => {
  // Some code paths pass already-binary content (file reads, blob
  // decryption output). The string + Uint8Array branches must produce
  // the same hash for the same bytes.
  const fromString = sha256HexAsync('hello');
  const fromBytes = sha256HexAsync(new TextEncoder().encode('hello'));
  assert.equal(fromString, fromBytes);
});

test('sha256HexAsync: UTF-8 multibyte handled correctly', () => {
  // The implementation uses UTF-8 explicitly. A "→" (0xE2 0x86 0x92)
  // would hash differently if the impl ever switched to UTF-16 or
  // Latin-1.
  const fromString = sha256HexAsync('a→b');
  const expected = sha256HexAsync(
    new Uint8Array([0x61, 0xe2, 0x86, 0x92, 0x62]),
  );
  assert.equal(fromString, expected);
});
