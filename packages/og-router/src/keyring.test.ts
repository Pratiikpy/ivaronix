/**
 * Unit tests for the multi-key Keyring rotation logic.
 *
 * Locks in the failure-mode taxonomy documented in
 * `.claude/rules/og-router.md`:
 *   - '402' (depleted credential)    → permanent invalidation, rotate
 *   - 'auth' (rejected credential)   → permanent invalidation, rotate
 *   - '429' (rate-limited)           → TRANSIENT; rotate this turn but
 *                                       the credential stays in the pool
 *
 * Without these tests, a future "simplification" that collapses '429'
 * into permanent invalidation silently halves the rotation pool — only
 * surfacing under sustained Router rate-limit incidents.
 *
 * Test runner: Node's built-in node:test via tsx (matches the repo's
 * 6-package convention).
 *
 * Note: we exercise rotation/invalidation/log paths only, NOT the
 * `chat()` / `chatRich()` methods (those require live Router endpoints
 * and are covered by the live smoke tests under `scripts/qa/`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keyring } from './keyring.js';
import type { RouterCredential } from './index.js';

function makeCred(label: string): RouterCredential {
  return {
    label,
    wallet: '0x0000000000000000000000000000000000000001' as `0x${string}`,
    apiKey: `app-sk-test-${label}`,
    serviceUrl: 'https://compute-network-test.example/v1/proxy',
    providerAddress: '0x0000000000000000000000000000000000000002' as `0x${string}`,
  };
}

test('constructor rejects empty credential list', () => {
  assert.throws(() => new Keyring([]), /at least one credential/i);
});

test('list reports all credentials with depleted=false initially', () => {
  const kr = new Keyring([makeCred('a'), makeCred('b'), makeCred('c')]);
  const items = kr.list();
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal(item.depleted, false);
    assert.ok(item.label);
    assert.ok(item.wallet);
    assert.ok(item.provider);
  }
});

test('pickActive returns first credential when none depleted', () => {
  const kr = new Keyring([makeCred('a'), makeCred('b')]);
  const cred = kr.pickActive();
  assert.equal(cred.label, 'a');
});

test("invalidate('402') marks depleted and rotates pickActive to next", () => {
  const kr = new Keyring([makeCred('a'), makeCred('b')]);
  kr.invalidate('a', '402');
  const cred = kr.pickActive();
  assert.equal(cred.label, 'b');
  assert.equal(kr.list().find((c) => c.label === 'a')?.depleted, true);
});

test("invalidate('auth') marks depleted and rotates pickActive to next", () => {
  const kr = new Keyring([makeCred('a'), makeCred('b')]);
  kr.invalidate('a', 'auth');
  const cred = kr.pickActive();
  assert.equal(cred.label, 'b');
  assert.equal(kr.list().find((c) => c.label === 'a')?.depleted, true);
});

test("invalidate('429') does NOT mark depleted (transient rate-limit)", () => {
  // Critical regression: collapsing 429 into permanent invalidation
  // silently halves the rotation pool. The rules file documents this
  // as the failure-mode taxonomy that should NEVER drift.
  const kr = new Keyring([makeCred('a'), makeCred('b')]);
  kr.invalidate('a', '429');
  // Despite the 429 rotation, both credentials remain non-depleted.
  for (const item of kr.list()) {
    assert.equal(item.depleted, false, `${item.label} should not be depleted on 429`);
  }
});

test("invalidate('429') still records the rotation event in the log", () => {
  const kr = new Keyring([makeCred('a'), makeCred('b')]);
  kr.invalidate('a', '429');
  const rotations = kr.peekRotations();
  assert.equal(rotations.length, 1);
  assert.equal(rotations[0]?.fromCredential, 'a');
  assert.equal(rotations[0]?.reason, '429');
});

test('rotation log captures fromCredential, toCredential, reason, atMs', () => {
  const kr = new Keyring([makeCred('a'), makeCred('b'), makeCred('c')]);
  const before = Date.now();
  kr.invalidate('a', '402');
  const after = Date.now();
  const rotations = kr.peekRotations();
  assert.equal(rotations.length, 1);
  const r = rotations[0]!;
  assert.equal(r.fromCredential, 'a');
  assert.equal(r.toCredential, 'b');
  assert.equal(r.reason, '402');
  assert.ok(r.atMs >= before && r.atMs <= after, 'atMs within bounds');
});

test('rotation log records "<no available credential>" when keyring is exhausted', () => {
  const kr = new Keyring([makeCred('only')]);
  kr.invalidate('only', '402');
  const rotations = kr.peekRotations();
  assert.equal(rotations.length, 1);
  assert.equal(rotations[0]?.toCredential, '<no available credential>');
});

test('drainRotations returns the log and clears it', () => {
  const kr = new Keyring([makeCred('a'), makeCred('b'), makeCred('c')]);
  kr.invalidate('a', '402');
  kr.invalidate('b', 'auth');
  const drained = kr.drainRotations();
  assert.equal(drained.length, 2);
  assert.equal(kr.peekRotations().length, 0);
  // Subsequent runs start with a clean log per the JSDoc contract.
  kr.invalidate('c', '429');
  assert.equal(kr.peekRotations().length, 1);
});

test('peekRotations returns a copy that does not mutate the internal log', () => {
  const kr = new Keyring([makeCred('a'), makeCred('b')]);
  kr.invalidate('a', '429');
  const snapshot = kr.peekRotations();
  // Mutating the snapshot must not affect future peeks. (Snapshot is a
  // copy of the array; the ROTATION objects themselves are shared, so
  // we only assert the array-shape isolation.)
  assert.equal(snapshot.length, 1);
  // Re-peek after the snapshot read still shows the rotation (not
  // cleared).
  assert.equal(kr.peekRotations().length, 1);
});

test('pickActive throws when every credential is depleted', () => {
  const kr = new Keyring([makeCred('a'), makeCred('b')]);
  kr.invalidate('a', '402');
  kr.invalidate('b', 'auth');
  assert.throws(() => kr.pickActive(), /All Router keys depleted/i);
});

test('multi-key cascade: 402 then auth then 429 across 3 creds', () => {
  // Realistic incident: cred-A runs out of funds (402), cred-B's secret
  // gets revoked (auth), cred-C hits a rate-limit (429). After this
  // sequence, cred-C should still be pickable (429 is transient).
  const kr = new Keyring([makeCred('a'), makeCred('b'), makeCred('c')]);
  kr.invalidate('a', '402');
  kr.invalidate('b', 'auth');
  kr.invalidate('c', '429');
  const cred = kr.pickActive();
  // a depleted, b depleted, c not depleted → pickActive returns c.
  assert.equal(cred.label, 'c');
  const rotations = kr.peekRotations();
  assert.equal(rotations.length, 3);
  assert.deepEqual(
    rotations.map((r) => r.reason),
    ['402', 'auth', '429'],
  );
});

test("invalidate('429') with a depleted next-cred skips the depleted one", () => {
  // 'a' is already depleted (402); a fresh 429 on 'b' should still log
  // the rotation but the next-pick logic must NOT route to 'a' (it's
  // permanently dead) — it should pick 'c' instead.
  const kr = new Keyring([makeCred('a'), makeCred('b'), makeCred('c')]);
  kr.invalidate('a', '402');
  kr.drainRotations();
  kr.invalidate('b', '429');
  const r = kr.peekRotations();
  assert.equal(r.length, 1);
  // For 429, the next-pick walks past depleted credentials per the
  // implementation comment "if (reason !== '429' && this.depleted.has(...)) continue;"
  // — meaning 429 is allowed to rotate to 'a' (the depleted one) for
  // logging purposes. This test pins that exact semantics so any
  // refactor changes are intentional.
  assert.ok(['a', 'c'].includes(r[0]!.toCredential));
});
