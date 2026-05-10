/**
 * Unit tests for Burn Mode AES-256-GCM session-key encryption.
 *
 * Locks in the security-load-bearing invariants documented in
 * `.claude/rules/og-storage.md` and `burn.ts:13-14`:
 *   - Self-contained blob shape: nonce(12) || ciphertext || auth-tag(16)
 *   - Fresh randomBytes(12) nonce per encrypt (K-20 regression: NEVER
 *     derive nonce from Date.now() or plaintext hash — GCM nonce reuse
 *     under the same key is catastrophic)
 *   - keyFingerprint captured BEFORE the key buffer is zeroed
 *   - Decrypt fails closed against tampering or wrong key
 *
 * Test runner: Node's built-in node:test via tsx (matches the repo's
 * 7-package convention).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, createCipheriv } from 'node:crypto';
import { burnEncrypt, decryptWithKey } from './burn.js';

const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// sha256(zeros(32)) — the fingerprint we'd see if capture happened
// AFTER the key buffer was zeroed. Used as the regression sentinel
// for the keyFingerprint-before-zero ordering invariant.
const SHA256_OF_ZEROED_KEY = createHash('sha256')
  .update(Buffer.alloc(KEY_LENGTH))
  .digest('hex');

test('burnEncrypt produces self-contained blob: nonce(12) || ct || tag(16)', () => {
  const plaintext = Buffer.from('contract clause: termination on missed payment within 30 days');
  const result = burnEncrypt(plaintext);
  // Blob length must be exactly nonce + plaintext + tag (GCM is a stream
  // cipher · ciphertext length === plaintext length).
  assert.equal(
    result.ciphertext.length,
    NONCE_LENGTH + plaintext.length + TAG_LENGTH,
    'blob layout must be nonce(12) || ct(plaintext.length) || tag(16)',
  );
});

test('burnEncrypt nonce is fresh per call (K-20 regression sentinel)', () => {
  // The K-20 fix replaced a Date.now()-derived nonce with randomBytes(12).
  // If anyone reverts that, two encrypts in the same millisecond would
  // collide and this assertion fires. We don't sleep — we encrypt back-to-back
  // so any time-derived nonce would be most likely to collide here.
  const plaintext = Buffer.from('same plaintext both runs');
  const a = burnEncrypt(plaintext);
  const b = burnEncrypt(plaintext);
  const nonceA = Buffer.from(a.ciphertext.subarray(0, NONCE_LENGTH));
  const nonceB = Buffer.from(b.ciphertext.subarray(0, NONCE_LENGTH));
  assert.ok(!nonceA.equals(nonceB), 'two back-to-back encrypts must produce different nonces');
});

test('burnEncrypt: 1000 encrypts produce 1000 unique nonces', () => {
  // Higher-volume regression: a Date.now()-derived nonce might survive
  // the 2-encrypt test if the host clock has microsecond resolution,
  // but 1000 sequential calls in the same millisecond would expose it.
  // randomBytes(12) gives 96 bits of entropy → P(collision) over 1000
  // draws is ≈ 1000²/2^97 ≈ 6.3e-24, so any collision here is a real
  // implementation regression, not statistical chance.
  const seen = new Set<string>();
  const N = 1000;
  for (let i = 0; i < N; i++) {
    const result = burnEncrypt(Buffer.from('x'));
    const nonce = Buffer.from(result.ciphertext.subarray(0, NONCE_LENGTH)).toString('hex');
    seen.add(nonce);
  }
  assert.equal(seen.size, N, 'all 1000 nonces must be unique');
});

test('burnEncrypt: keyFingerprint format is sha256:<64-hex>', () => {
  const result = burnEncrypt(Buffer.from('any payload'));
  assert.match(result.keyFingerprint, /^sha256:[0-9a-f]{64}$/);
});

test('burnEncrypt: keyFingerprint NEVER equals sha256(zeros) (capture-before-zero ordering)', () => {
  // If the implementation ever moves the fingerprint capture AFTER
  // `key.fill(0)`, the fingerprint would equal sha256 of an all-zero
  // 32-byte buffer. Pinning that as the regression sentinel: a single
  // assertion catches the ordering mistake.
  const result = burnEncrypt(Buffer.from('any payload'));
  const hex = result.keyFingerprint.replace(/^sha256:/, '');
  assert.notEqual(
    hex,
    SHA256_OF_ZEROED_KEY,
    'fingerprint == sha256(zeros) means capture happened after key was zeroed',
  );
});

test('burnEncrypt: keyFingerprint differs across two calls (fresh random key)', () => {
  // Each call generates a fresh randomBytes(32) key, so the fingerprints
  // must differ. Same statistical argument as the nonce uniqueness test.
  const a = burnEncrypt(Buffer.from('p'));
  const b = burnEncrypt(Buffer.from('p'));
  assert.notEqual(a.keyFingerprint, b.keyFingerprint);
});

test('burnEncrypt: encryptionType tag is "aes-256-gcm"', () => {
  const result = burnEncrypt(Buffer.from('p'));
  assert.equal(result.encryptionType, 'aes-256-gcm');
});

test('burnEncrypt: destroyedAt is a recent wall-clock timestamp', () => {
  const before = Date.now();
  const result = burnEncrypt(Buffer.from('p'));
  const after = Date.now();
  assert.ok(result.destroyedAt >= before && result.destroyedAt <= after);
});

test('burnEncrypt: empty plaintext produces NONCE+TAG-only blob', () => {
  const result = burnEncrypt(Buffer.alloc(0));
  assert.equal(result.ciphertext.length, NONCE_LENGTH + TAG_LENGTH);
});

test('burnEncrypt: large plaintext (1MB) round-trips through nonce/tag layout', () => {
  // The nonce/tag layout shouldn't have hidden length assumptions.
  const big = randomBytes(1024 * 1024);
  const result = burnEncrypt(big);
  assert.equal(result.ciphertext.length, NONCE_LENGTH + big.length + TAG_LENGTH);
});

test('decryptWithKey: round-trip with externally-held key recovers plaintext', () => {
  // Wallet-mode use case: the caller holds the key separately, so
  // decryptWithKey is a real round-trip path. We construct a ciphertext
  // matching the same nonce(12) || ct || tag(16) layout that burnEncrypt
  // produces, then verify recovery.
  const key = randomBytes(KEY_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);
  const plaintext = Buffer.from('wallet-encrypted payload that the caller can decrypt later');
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([nonce, ct, tag]);
  const recovered = decryptWithKey(new Uint8Array(blob), new Uint8Array(key));
  assert.deepEqual(Buffer.from(recovered), plaintext);
});

test('decryptWithKey: wrong key fails closed (auth tag rejects)', () => {
  // GCM authenticated decryption: a flipped key triggers the tag
  // verification failure. Without this, decrypted-with-wrong-key
  // garbage could be returned silently — that would be a CIA breach.
  const realKey = randomBytes(KEY_LENGTH);
  const wrongKey = randomBytes(KEY_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', realKey, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.from('secret')), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([nonce, ct, tag]);
  assert.throws(
    () => decryptWithKey(new Uint8Array(blob), new Uint8Array(wrongKey)),
    /unsupported state|bad decrypt|authentication/i,
  );
});

test('decryptWithKey: tampered ciphertext fails closed', () => {
  // GCM detects ciphertext tampering via the auth tag. Flip one byte
  // in the middle and decrypt must throw, not return garbage.
  const key = randomBytes(KEY_LENGTH);
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(Buffer.from('XXXXXXXXXXXXXXXXXXXX')), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([nonce, ct, tag]);
  // Flip one byte inside the ciphertext region.
  blob[NONCE_LENGTH + 5] = blob[NONCE_LENGTH + 5]! ^ 0xff;
  assert.throws(
    () => decryptWithKey(new Uint8Array(blob), new Uint8Array(key)),
    /unsupported state|bad decrypt|authentication/i,
  );
});

test('decryptWithKey: blob shorter than NONCE+TAG throws explicit error', () => {
  const key = randomBytes(KEY_LENGTH);
  const tinyBlob = new Uint8Array(NONCE_LENGTH + TAG_LENGTH - 1);
  assert.throws(() => decryptWithKey(tinyBlob, new Uint8Array(key)), /blob too short/);
});

test('decryptWithKey: wrong-length key throws explicit error', () => {
  const blob = new Uint8Array(NONCE_LENGTH + 10 + TAG_LENGTH);
  assert.throws(
    () => decryptWithKey(blob, new Uint8Array(KEY_LENGTH - 1)),
    /key must be 32 bytes/,
  );
});
