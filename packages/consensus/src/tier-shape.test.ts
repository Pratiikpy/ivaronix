import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES_BY_TIER, type ConsensusTier } from '@ivaronix/core';
import { ROLE_PROMPTS } from './prompts.js';
import { TIER_COST_OG } from './index.js';

/**
 * Tier-shape contract regression suite (planning-003 §A.5.20).
 *
 * Locks in the four-tier composition that ships in 2026-05-10:
 *   quick       1 role  — analyst
 *   standard    3 roles — analyst + critic + judge
 *   high-stakes 5 roles — analyst + critic + risk-reviewer + evidence-checker + judge
 *   audit       6 roles — high-stakes + red-team-critic
 *
 * Tests prevent (a) a role becoming orphan again (red-team-critic was
 * declared in prompts.ts but unwired into any tier before this audit),
 * (b) silent tier composition drift (e.g. accidentally dropping `critic`
 * from `high-stakes`, which is what the previous shipped state did),
 * and (c) drift between the role table and the cost table.
 */

test('A.5.20 · all four tiers exist and have the documented role count', () => {
  const expected: Record<ConsensusTier, number> = {
    quick: 1,
    standard: 3,
    'high-stakes': 5,
    audit: 6,
  };
  for (const [tier, count] of Object.entries(expected) as [ConsensusTier, number][]) {
    assert.equal(
      ROLES_BY_TIER[tier].length,
      count,
      `tier "${tier}" should have ${count} roles, got ${ROLES_BY_TIER[tier].length}`,
    );
  }
});

test('A.5.20 · standard ⊂ high-stakes ⊂ audit (composition is monotone)', () => {
  const std = new Set(ROLES_BY_TIER.standard);
  const high = new Set(ROLES_BY_TIER['high-stakes']);
  const audit = new Set(ROLES_BY_TIER.audit);
  for (const role of std) {
    assert.ok(high.has(role), `high-stakes should include all standard roles; missing "${role}"`);
  }
  for (const role of high) {
    assert.ok(audit.has(role), `audit should include all high-stakes roles; missing "${role}"`);
  }
});

test('A.5.20 · audit tier is the only one with red-team-critic', () => {
  for (const [tier, roles] of Object.entries(ROLES_BY_TIER) as [ConsensusTier, readonly string[]][]) {
    const hasRedTeam = roles.includes('red-team-critic');
    if (tier === 'audit') {
      assert.ok(hasRedTeam, 'audit tier must include red-team-critic');
    } else {
      assert.ok(!hasRedTeam, `${tier} tier must not include red-team-critic`);
    }
  }
});

test('A.5.20 · every tier ends in judge except quick', () => {
  for (const [tier, roles] of Object.entries(ROLES_BY_TIER) as [ConsensusTier, readonly string[]][]) {
    if (tier === 'quick') {
      assert.ok(!roles.includes('judge'), 'quick tier should be judgement-free');
    } else {
      assert.equal(
        roles[roles.length - 1],
        'judge',
        `${tier} tier must end with judge as the last role`,
      );
    }
  }
});

test('A.5.20 · every role used by any tier has a ROLE_PROMPTS entry', () => {
  const used = new Set<string>();
  for (const roles of Object.values(ROLES_BY_TIER)) {
    for (const r of roles) used.add(r);
  }
  for (const role of used) {
    assert.ok(
      ROLE_PROMPTS[role as keyof typeof ROLE_PROMPTS],
      `role "${role}" used by a tier but has no ROLE_PROMPTS entry`,
    );
  }
});

test('A.5.20 · no orphan roles in ROLE_PROMPTS', () => {
  const declared = Object.keys(ROLE_PROMPTS);
  const used = new Set<string>();
  for (const roles of Object.values(ROLES_BY_TIER)) {
    for (const r of roles) used.add(r);
  }
  for (const role of declared) {
    assert.ok(
      used.has(role),
      `role "${role}" declared in ROLE_PROMPTS but not wired into any tier (this is exactly the bug A.5.20 closed for red-team-critic)`,
    );
  }
});

test('A.5.20 · TIER_COST_OG has an entry for every tier (no missing-key drift)', () => {
  for (const tier of Object.keys(ROLES_BY_TIER) as ConsensusTier[]) {
    const cost = TIER_COST_OG[tier];
    assert.ok(typeof cost === 'number' && cost > 0, `tier "${tier}" has no cost entry`);
  }
});

test('A.5.20 · audit tier costs more than high-stakes (premium pricing)', () => {
  assert.ok(
    TIER_COST_OG.audit > TIER_COST_OG['high-stakes'],
    'audit tier should be priced as premium above high-stakes',
  );
});
