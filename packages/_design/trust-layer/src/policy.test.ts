/**
 * Unit tests for the Trust Layer policy evaluator.
 *
 * Locks in the rule-matching semantics for the Phase-3 enterprise
 * surface (PRD §3.5). The evaluator is pure — no I/O — but its
 * decisions gate high-stakes runs (mainnet, code mode, daily caps).
 * Wrong decisions ship as silent security regressions: a misordered
 * default-allow could let a denied caller through, a wrong cap-check
 * direction (>= vs >) could permit one extra run past the budget.
 *
 * The trust-layer is not wired to the runtime today (USER_TODO §B-V2).
 * Locking the contract now means future wire-up starts on tested
 * ground — anyone who refactors the matcher must explicitly choose to
 * change a documented semantic.
 *
 * Test runner: Node's built-in node:test via tsx (matches the repo's
 * 8-package convention).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePolicy,
  defaultPolicySet,
  type EvalCandidate,
} from './policy.js';
import { PolicySet, type PolicySetT } from './schema.js';

const STUB_WALLET = '0x0000000000000000000000000000000000000001';

function makeSet(rules: PolicySetT['rules'], defaultEffect: PolicySetT['defaultEffect'] = 'allow'): PolicySetT {
  return {
    teamId: 'team_TEST',
    version: '0.0.1',
    rules,
    defaultEffect,
    updatedBy: STUB_WALLET,
    updatedAt: 1700000000000,
  };
}

test('empty rules → returns defaultEffect (allow)', () => {
  const set = makeSet([], 'allow');
  const decision = evaluatePolicy(set, { skillId: 'any' });
  assert.equal(decision.effect, 'allow');
  assert.equal(decision.rule, null);
  assert.match(decision.reason, /no rule matched/);
});

test('empty rules → returns defaultEffect (deny)', () => {
  const set = makeSet([], 'deny');
  const decision = evaluatePolicy(set, {});
  assert.equal(decision.effect, 'deny');
  assert.equal(decision.rule, null);
});

test('first matching rule wins (order matters)', () => {
  // The matcher walks rules top-to-bottom and returns on first match.
  // Reordering rules must change the decision; this test pins that
  // contract so future "optimizations" (e.g. priority-sort) are
  // explicit.
  const set = makeSet([
    {
      id: 'first',
      match: { mode: 'code' },
      effect: 'deny',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
    {
      id: 'second',
      match: { mode: 'code' },
      effect: 'allow',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  const decision = evaluatePolicy(set, { mode: 'code' });
  assert.equal(decision.effect, 'deny');
  assert.equal(decision.rule?.id, 'first');
});

test('match by exact field: skillId equality', () => {
  const set = makeSet([
    {
      id: 'github-only',
      match: { skillId: 'github-audit' },
      effect: 'allow',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  assert.equal(evaluatePolicy(set, { skillId: 'github-audit' }).effect, 'allow');
  assert.equal(evaluatePolicy(set, { skillId: 'private-doc-review' }).rule, null);
});

test('match by glob: skillId "*" matches everything', () => {
  const set = makeSet([
    {
      id: 'star',
      match: { skillId: '*' },
      effect: 'allow',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  assert.equal(evaluatePolicy(set, { skillId: 'anything' }).effect, 'allow');
  assert.equal(evaluatePolicy(set, { skillId: 'something-else' }).effect, 'allow');
});

test('match by glob: trailing /* matches the prefix', () => {
  const set = makeSet([
    {
      id: 'code-edit-prefix',
      match: { skillId: 'code-edit/*' },
      effect: 'deny',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  assert.equal(evaluatePolicy(set, { skillId: 'code-edit/foo' }).effect, 'deny');
  assert.equal(evaluatePolicy(set, { skillId: 'code-edit/' }).effect, 'deny');
  assert.equal(evaluatePolicy(set, { skillId: 'github-audit' }).rule, null);
});

test('multi-field match: ALL specified fields must match', () => {
  // mainnet + high-stakes is a real PRD requirement: only deny if
  // BOTH conditions hold.
  const set = makeSet([
    {
      id: 'mainnet-high-stakes',
      match: { network: 'mainnet', tier: 'high-stakes' },
      effect: 'require_approval',
      approvers: ['role:admin'],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  assert.equal(
    evaluatePolicy(set, { network: 'mainnet', tier: 'high-stakes' }).effect,
    'require_approval',
  );
  // testnet + high-stakes → no match (network mismatch)
  assert.equal(
    evaluatePolicy(set, { network: 'testnet', tier: 'high-stakes' }).rule,
    null,
  );
  // mainnet + standard → no match (tier mismatch)
  assert.equal(
    evaluatePolicy(set, { network: 'mainnet', tier: 'standard' }).rule,
    null,
  );
});

test('minTrustScore: deny when callerTrustScore below threshold', () => {
  const set = makeSet([
    {
      id: 'high-trust-only',
      match: { mode: 'audit' },
      effect: 'allow',
      approvers: [],
      minTrustScore: 80,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  const denied = evaluatePolicy(set, { mode: 'audit', callerTrustScore: 50 });
  assert.equal(denied.effect, 'deny');
  assert.match(denied.reason, /trustScore 50 < required 80/);
  // At exact threshold → allowed (>= is the gate, not >).
  assert.equal(
    evaluatePolicy(set, { mode: 'audit', callerTrustScore: 80 }).effect,
    'allow',
  );
});

test('minTrustScore: missing callerTrustScore treated as 0', () => {
  // Honest fallback: a caller with no trust score is treated as the
  // lowest possible. Otherwise undefined > 50 returns NaN comparisons
  // which are always false → would silently allow.
  const set = makeSet([
    {
      id: 'high-trust-only',
      match: {},
      effect: 'allow',
      approvers: [],
      minTrustScore: 1,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  const decision = evaluatePolicy(set, {});
  assert.equal(decision.effect, 'deny');
  assert.match(decision.reason, /trustScore 0 < required 1/);
});

test('dailyCapOg: deny when todaySpendOg >= cap', () => {
  // The cap check is `>= cap`, not `> cap`. A user who spent exactly
  // 1 OG today with a 1 OG cap is OVER — no more runs allowed. Pinning
  // this exactly so a future "off-by-one fix" must explicitly change
  // the threshold.
  const set = makeSet([
    {
      id: 'cap-1og',
      match: { network: 'mainnet' },
      effect: 'allow',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 1,
      ttlSeconds: 0,
    },
  ]);
  const denied = evaluatePolicy(set, { network: 'mainnet', todaySpendOg: 1 });
  assert.equal(denied.effect, 'deny');
  assert.match(denied.reason, /daily spend cap 1 OG reached/);
  // Just under cap → allowed.
  assert.equal(
    evaluatePolicy(set, { network: 'mainnet', todaySpendOg: 0.99 }).effect,
    'allow',
  );
});

test('dailyCapOg: missing todaySpendOg treated as 0 (no spend yet)', () => {
  const set = makeSet([
    {
      id: 'cap',
      match: {},
      effect: 'allow',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 1,
      ttlSeconds: 0,
    },
  ]);
  assert.equal(evaluatePolicy(set, {}).effect, 'allow');
});

test('returns rule.description as decision.reason when description set', () => {
  const set = makeSet([
    {
      id: 'with-desc',
      match: {},
      effect: 'allow',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
      description: 'humanly-readable explanation here',
    },
  ]);
  assert.equal(
    evaluatePolicy(set, {}).reason,
    'humanly-readable explanation here',
  );
});

test('returns "matched rule <id>" reason when description omitted', () => {
  const set = makeSet([
    {
      id: 'no-desc',
      match: {},
      effect: 'allow',
      approvers: [],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  assert.match(evaluatePolicy(set, {}).reason, /matched rule no-desc/);
});

test('approval gate: passes through approvers list to decision', () => {
  const set = makeSet([
    {
      id: 'admin-required',
      match: {},
      effect: 'require_approval',
      approvers: ['role:admin', '0xdeadbeef'],
      minTrustScore: 0,
      dailyCapOg: 0,
      ttlSeconds: 0,
    },
  ]);
  const decision = evaluatePolicy(set, {});
  assert.deepEqual(decision.approvers, ['role:admin', '0xdeadbeef']);
});

test('defaultPolicySet: shape parses against PolicySet schema', () => {
  // Lock the starter-set shape against the canonical Zod schema. If
  // someone changes defaultPolicySet without re-validating, this fires.
  const set = defaultPolicySet('team_01ABCDEFGHIJKLMNPQRSTUVWXY', STUB_WALLET);
  const parsed = PolicySet.safeParse(set);
  assert.ok(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues));
});

test('defaultPolicySet: includes mainnet-high-stakes-requires-approval rule', () => {
  // PRD §3.5 requires this gate be present out-of-the-box. A starter
  // set that omits it leaks security posture for new teams.
  const set = defaultPolicySet('team_01ABCDEFGHIJKLMNPQRSTUVWXY', STUB_WALLET);
  const decision = evaluatePolicy(set, { network: 'mainnet', tier: 'high-stakes' });
  assert.equal(decision.effect, 'require_approval');
  assert.deepEqual(decision.approvers, ['role:admin']);
});

test('defaultPolicySet: enforces 1 OG/day cap on mainnet', () => {
  // Same PRD requirement: spend gate must be present.
  const set = defaultPolicySet('team_01ABCDEFGHIJKLMNPQRSTUVWXY', STUB_WALLET);
  const denied = evaluatePolicy(set, {
    network: 'mainnet',
    tier: 'standard',
    todaySpendOg: 1,
  });
  assert.equal(denied.effect, 'deny');
  assert.match(denied.reason, /daily spend cap/);
});
