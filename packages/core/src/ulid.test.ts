/**
 * Unit tests for the ULID-based ID helpers.
 *
 * Locks the receipt-id shape (`rcpt_<26-char-ULID>`) and the generic
 * `newId(prefix)` helper. RECEIPTS_SPEC.md §2 is the authority on the
 * `rcpt_` prefix; downstream verifiers (CLI, Studio, MCP server) all
 * pattern-match against this prefix.
 *
 * Test runner: Node's built-in node:test via tsx.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newReceiptId, newId } from './ulid.js';

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/; // Crockford's Base32, 26 chars

test('newReceiptId: rcpt_ prefix + 26-char Crockford-Base32 ULID', () => {
  const id = newReceiptId();
  assert.match(id, /^rcpt_[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('newReceiptId: each call returns a unique ID', () => {
  // ULID embeds a 48-bit timestamp + 80-bit randomness — collision
  // probability across two calls in the same ms is ~2^-80. Two
  // back-to-back calls must differ.
  const a = newReceiptId();
  const b = newReceiptId();
  assert.notEqual(a, b);
});

test('newReceiptId: 1000 ids are all unique (high-volume regression)', () => {
  // Same statistical argument as the og-storage burn nonce test.
  // 1000 draws against an 80-bit randomness space — any collision
  // is implementation, not chance.
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(newReceiptId());
  assert.equal(seen.size, 1000);
});

test('newReceiptId: ULID portion is monotonically non-decreasing within a ms', () => {
  // ULIDs encode timestamp in the leading 10 chars (Crockford-32).
  // Two ids generated quickly should have the same or increasing
  // timestamp prefix. Pinning monotonicity prevents a future
  // "let's use random instead" regression that would break the
  // timestamp-orderable property ULID promises.
  const a = newReceiptId().slice(5, 15); // skip "rcpt_", take first 10 chars of ULID
  const b = newReceiptId().slice(5, 15);
  assert.ok(a <= b, `expected ULID timestamp prefix to be non-decreasing: ${a} <= ${b}`);
});

test('newId(prefix): wraps with given prefix + underscore', () => {
  const id = newId('skill');
  assert.match(id, /^skill_[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('newId: empty prefix produces "_<ULID>"', () => {
  // Implementation just template-strings the prefix; empty string
  // works but produces a leading underscore. Pinning this so a
  // future validation that rejects empty prefix is an intentional
  // breaking change.
  const id = newId('');
  assert.match(id, /^_[0-9A-HJKMNP-TV-Z]{26}$/);
});

test('newId: each call returns unique (same as newReceiptId)', () => {
  assert.notEqual(newId('test'), newId('test'));
});

test('ULID alphabet: verify our regex matches the ulid library output', () => {
  // ULIDs use Crockford-Base32: 0-9 + A-Z minus I/L/O/U.
  // The regex [0-9A-HJKMNP-TV-Z] should accept exactly that set.
  // If the library ever emits an excluded char (I/L/O/U), our
  // pattern-match in receipt-id validators would silently fail
  // downstream. Fail loudly here.
  for (let i = 0; i < 100; i++) {
    const id = newReceiptId().slice(5); // skip "rcpt_"
    assert.match(id, ULID_RE);
    // Explicit anti-allowed: I/L/O/U should NEVER appear.
    assert.ok(!/[ILOU]/.test(id), `ULID contains forbidden char: ${id}`);
  }
});
