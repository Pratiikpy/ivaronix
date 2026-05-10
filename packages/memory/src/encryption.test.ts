import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptObservation, decryptObservation, deriveMemoryKey } from './encryption.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const TEST_PRIV =
  '0x1111111111111111111111111111111111111111111111111111111111111111';
const KEY = deriveMemoryKey(TEST_PRIV);

// ─── K-20 regression suite ────────────────────────────────────────────────

test('K-20 · same plaintext + same key produces DIFFERENT ciphertexts', () => {
  const text = 'hello world this is a memory observation';
  const a = encryptObservation(text, KEY);
  const b = encryptObservation(text, KEY);
  assert.notEqual(
    Buffer.from(a).toString('hex'),
    Buffer.from(b).toString('hex'),
    'nonce reuse: identical ciphertexts under same key + same plaintext is a catastrophic AES-GCM break',
  );
});

test('K-20 · round-trip: encrypt -> decrypt returns the original plaintext', () => {
  const cases = [
    'simple ascii',
    'unicode π · 中文 · مرحبا · 🚀',
    'a'.repeat(10_000),
    '',
  ];
  for (const text of cases) {
    const ct = encryptObservation(text, KEY);
    const pt = decryptObservation(ct, KEY);
    assert.equal(pt, text, `round-trip failed for "${text.slice(0, 24)}…"`);
  }
});

test('K-20 · nonce uniqueness fuzz (10000 same-plaintext encryptions)', () => {
  const text = 'the same text every time';
  const seen = new Set<string>();
  const ITER = 10_000;
  for (let i = 0; i < ITER; i++) {
    const blob = encryptObservation(text, KEY);
    const nonceHex = Buffer.from(blob.subarray(0, 12)).toString('hex');
    assert.ok(!seen.has(nonceHex), `nonce collision after ${i} iterations: ${nonceHex}`);
    seen.add(nonceHex);
  }
  assert.equal(seen.size, ITER);
});

test('K-20 · ciphertexts under different plaintexts have different nonces', () => {
  const a = encryptObservation('plaintext A', KEY);
  const b = encryptObservation('plaintext B', KEY);
  const nonceA = Buffer.from(a.subarray(0, 12)).toString('hex');
  const nonceB = Buffer.from(b.subarray(0, 12)).toString('hex');
  assert.notEqual(nonceA, nonceB);
});

test('K-20 · decrypting with wrong key fails (auth tag mismatch)', () => {
  const ct = encryptObservation('secret', KEY);
  const wrongKey = deriveMemoryKey('0x' + '2'.repeat(64));
  assert.throws(() => decryptObservation(ct, wrongKey));
});

test('K-20 · tampered ciphertext fails authenticated decryption', () => {
  const ct = encryptObservation('the original message', KEY);
  // Flip a byte in the middle of the ciphertext. Index 15 is past the
  // 12-byte GCM nonce so it lands inside the encrypted payload.
  const tampered = new Uint8Array(ct);
  if (tampered.length <= 15) throw new Error('ciphertext too short to tamper-test');
  tampered[15] = tampered[15]! ^ 0xff;
  assert.throws(() => decryptObservation(tampered, KEY));
});

// ─── Source-file regression guards ───────────────────────────────────────

test('K-20 · encryption.ts source has no deterministic-nonce regressions', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(here, 'encryption.ts'), 'utf8');
  // The previous bug derived the nonce from sha256(plaintext || Date.now()).
  // The fix uses randomBytes(12). Catch both regression patterns explicitly.
  assert.ok(
    !/createHash\('sha256'\)\s*\.\s*update\(Buffer\.from\(plaintext/.test(src),
    'encryption.ts: nonce must NOT be derived from sha256(plaintext) — that reuses nonces under same plaintext + key',
  );
  assert.ok(
    !/Date\.now\(\)\.toString\(\)\s*\)/.test(src),
    'encryption.ts: nonce must NOT depend on Date.now() — millisecond collision is a catastrophic AES-GCM break',
  );
  assert.ok(
    /randomBytes\(NONCE_LEN\)/.test(src),
    'encryption.ts: nonce must be randomBytes(NONCE_LEN) per RFC 5116 / NIST SP 800-38D',
  );
});
