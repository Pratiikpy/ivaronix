import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGates, type GateInput } from './gates.js';

/**
 * Gate-2 sensitive-content scan regression suite.
 *
 * Locks in the planning-003 §A.5.15 fix: the broad `eth-private-key` regex
 * used to false-positive on every receipt id, tx hash, content hash, and
 * signature half referenced in a doc-review run. The fix replaces the broad
 * heuristic with two paths:
 *
 *   a) Exact-match against the operator's loaded signer key (zero false
 *      positives, perfect detection).
 *   b) Heuristic 64-hex scan with receipt-context suppression for read-only
 *      flows where no signer key is loaded.
 *
 * These tests cover both paths plus the negative cases that historically
 * tripped the old regex.
 */

const PRIVATE_KEY_HEX = 'a1a1aaaaa1a1aaaaa1a1aaaaa1a1aaaaa1a1aaaaa1a1aaaaa1a1aaaaa1a1aaaa';
const RECEIPT_HASH = 'b77087ee0123456789abcdef0123456789abcdef0123456789abcdef01234567';
const TX_HASH = '0xfeedface0123456789abcdef0123456789abcdef0123456789abcdef01234567';
const CONTENT_ROOT = '0xdeadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567';

function baseInput(context: string, signerPrivateKey?: string): GateInput {
  return {
    context,
    rawBytes: Buffer.from(context, 'utf8'),
    estimatedInputTokens: Math.ceil(context.length / 4) + 100, // pad over MIN_INPUT_TOKENS
    model: 'qwen-2.5-7b-instruct',
    ...(signerPrivateKey ? { signerPrivateKey } : {}),
  };
}

test('A.5.15 · receipt-hash references do NOT trip the secrets warning', () => {
  const ctx = `
    Verified prior audit against receipt 0x${RECEIPT_HASH}.
    The anchor tx ${TX_HASH} confirmed at block 12345.
    Content root: ${CONTENT_ROOT}.
    Storage evidence hash: ${RECEIPT_HASH}.
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx));
  assert.equal(result.pass, true, 'gate should pass on receipt-context-only doc');
  for (const w of result.warnings) {
    assert.doesNotMatch(
      w,
      /private key|64-hex token detected/i,
      `warning leaked on receipt-context doc: ${w}`,
    );
  }
});

test('A.5.15 · signer-private-key paste in doc → CRITICAL warning', () => {
  const ctx = `
    Lease document body. ${PRIVATE_KEY_HEX} should not be here.
    Signed by 0xCallerAddress.
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx, PRIVATE_KEY_HEX));
  assert.equal(result.pass, true, 'gate 2 warns, does not block');
  const critical = result.warnings.find((w) => /CRITICAL.*private key/i.test(w));
  assert.ok(critical, `expected CRITICAL warning; got: ${JSON.stringify(result.warnings)}`);
});

test('A.5.15 · signer-private-key with 0x prefix in doc still detected', () => {
  const ctx = `
    Operator pasted: 0x${PRIVATE_KEY_HEX} into the doc.
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx, PRIVATE_KEY_HEX));
  const critical = result.warnings.find((w) => /CRITICAL.*private key/i.test(w));
  assert.ok(critical, 'exact-match should be case + prefix insensitive');
});

test('A.5.15 · signer-private-key NOT in doc → no warning', () => {
  const ctx = `
    Lease document body. Tenant pays $1500 in rent.
    Reference: receipt id 0x${RECEIPT_HASH}.
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx, PRIVATE_KEY_HEX));
  for (const w of result.warnings) {
    assert.doesNotMatch(w, /private key/i, `false positive: ${w}`);
  }
});

test('A.5.15 · heuristic mode (no signer key): bare 64-hex outside receipt context → warns', () => {
  const ctx = `
    The user's wallet seed is ${PRIVATE_KEY_HEX} unfortunately.
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx)); // no signerPrivateKey
  const heuristic = result.warnings.find((w) => /64-hex token detected/i.test(w));
  assert.ok(heuristic, `heuristic should warn on bare 64-hex; got: ${JSON.stringify(result.warnings)}`);
});

test('A.5.15 · heuristic mode: receipt-context 64-hex still suppressed', () => {
  const ctx = `
    Verified receipt 0x${RECEIPT_HASH} via the registry.
    Anchor tx ${TX_HASH}.
    Storage root: ${CONTENT_ROOT}.
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx)); // no signerPrivateKey
  const heuristic = result.warnings.find((w) => /64-hex token detected/i.test(w));
  assert.equal(
    heuristic,
    undefined,
    `heuristic should suppress on receipt-context-only doc; got: ${JSON.stringify(result.warnings)}`,
  );
});

test('A.5.15 · BEGIN-PRIVATE-KEY block still detected', () => {
  const ctx = `
    The PEM-encoded operator key is:
    -----BEGIN RSA PRIVATE KEY-----
    notARealKeyButLooksReal...
    -----END RSA PRIVATE KEY-----
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx));
  const pem = result.warnings.find((w) => /private-key/i.test(w));
  assert.ok(pem, 'PEM-style detection should still fire');
});

test('A.5.15 · github token still detected', () => {
  const ctx = `
    Use ghp_${'A'.repeat(36)} for the integration.
  `.padEnd(200, ' ');
  const result = runGates(baseInput(ctx));
  const gh = result.warnings.find((w) => /github-token/i.test(w));
  assert.ok(gh, 'github-token detection should still fire');
});

test('A.5.15 · empty doc fails gate 1, not gate 2', () => {
  const result = runGates({
    context: '',
    rawBytes: Buffer.alloc(0),
    estimatedInputTokens: 0,
    model: 'qwen-2.5-7b-instruct',
  });
  assert.equal(result.pass, false);
  assert.equal(result.failedGate, '1-file-sanity');
});
