import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateFeeSplit,
  TIER_MULTIPLIER_BPS,
  EFFICIENCY_GAME_MULTIPLIER_BPS,
} from './fee-split.js';

/**
 * Fee-split allocation regression suite.
 *
 * Two policies cover four × two × three matrix:
 *   policy: 'flat' | 'efficiency-game'
 *   tier:   TIER_1 | TIER_2
 *   outcome (efficiency-game only): {first, retry} × {ok, partial, failed}
 *
 * The legacy `flat` path stays exactly as it was before A.4.4 so old
 * receipts replay byte-identical. The new `efficiency-game` path conditions
 * the multiplier on outcome per planning-003 §A.4.4.
 */

const TOTAL = '100000000000000000'; // 0.1 OG in neuron (1e17)
const SKILL_BPS = { creator: 9000, treasury: 1000 };

test('A.4.4 · flat policy is byte-identical to pre-A.4.4 behaviour', () => {
  const r = allocateFeeSplit({
    totalCostNeuron: TOTAL,
    creatorBps: SKILL_BPS.creator,
    treasuryBps: SKILL_BPS.treasury,
    tier: 'TIER_1',
  });
  assert.equal(r.policyApplied, 'flat');
  assert.equal(r.tierMultiplierBps, TIER_MULTIPLIER_BPS.TIER_1);
  assert.equal(r.creatorBps, 9000);
  assert.equal(r.treasuryBps, 1000);
});

test('A.4.4 · efficiency-game TIER 1 first-attempt = 95% of declared bps', () => {
  const r = allocateFeeSplit({
    totalCostNeuron: TOTAL,
    creatorBps: SKILL_BPS.creator,
    treasuryBps: SKILL_BPS.treasury,
    tier: 'TIER_1',
    policy: 'efficiency-game',
    outcome: { attempts: 1, status: 'ok' },
  });
  assert.equal(r.policyApplied, 'efficiency-game');
  assert.equal(r.tierMultiplierBps, EFFICIENCY_GAME_MULTIPLIER_BPS.TIER_1.first); // 9500
  // 9000 declared * 9500/10000 = 8550 bps effective creator share
  assert.equal(r.creatorBps, 8550);
  assert.equal(r.treasuryBps, 1450);
});

test('A.4.4 · efficiency-game TIER 1 retry = 85% of declared bps', () => {
  const r = allocateFeeSplit({
    totalCostNeuron: TOTAL,
    creatorBps: SKILL_BPS.creator,
    treasuryBps: SKILL_BPS.treasury,
    tier: 'TIER_1',
    policy: 'efficiency-game',
    outcome: { attempts: 2, status: 'ok' },
  });
  assert.equal(r.tierMultiplierBps, EFFICIENCY_GAME_MULTIPLIER_BPS.TIER_1.retry); // 8500
  // 9000 * 8500/10000 = 7650
  assert.equal(r.creatorBps, 7650);
  assert.equal(r.treasuryBps, 2350);
});

test('A.4.4 · efficiency-game TIER 2 first-attempt = 70% of declared bps', () => {
  const r = allocateFeeSplit({
    totalCostNeuron: TOTAL,
    creatorBps: SKILL_BPS.creator,
    treasuryBps: SKILL_BPS.treasury,
    tier: 'TIER_2',
    policy: 'efficiency-game',
    outcome: { attempts: 1, status: 'ok' },
  });
  assert.equal(r.tierMultiplierBps, 7000);
  // 9000 * 7000/10000 = 6300
  assert.equal(r.creatorBps, 6300);
  assert.equal(r.treasuryBps, 3700);
});

test('A.4.4 · efficiency-game TIER 2 retry stays at 70% (TIER 2 never gets first-pass premium)', () => {
  const r = allocateFeeSplit({
    totalCostNeuron: TOTAL,
    creatorBps: SKILL_BPS.creator,
    treasuryBps: SKILL_BPS.treasury,
    tier: 'TIER_2',
    policy: 'efficiency-game',
    outcome: { attempts: 4, status: 'ok' },
  });
  assert.equal(r.tierMultiplierBps, 7000);
  assert.equal(r.creatorBps, 6300);
});

test('A.4.4 · efficiency-game failed status routes 100% to treasury, regardless of tier', () => {
  for (const tier of ['TIER_1', 'TIER_2'] as const) {
    const r = allocateFeeSplit({
      totalCostNeuron: TOTAL,
      creatorBps: SKILL_BPS.creator,
      treasuryBps: SKILL_BPS.treasury,
      tier,
      policy: 'efficiency-game',
      outcome: { attempts: 1, status: 'failed' },
    });
    assert.equal(r.tierMultiplierBps, 0);
    assert.equal(r.creatorBps, 0);
    assert.equal(r.treasuryBps, 10000);
    assert.equal(r.creatorNeuron, '0');
    assert.equal(r.treasuryNeuron, TOTAL);
  }
});

test('A.4.4 · efficiency-game default outcome (no outcome arg) is { attempts: 1, status: ok }', () => {
  const r = allocateFeeSplit({
    totalCostNeuron: TOTAL,
    creatorBps: SKILL_BPS.creator,
    treasuryBps: SKILL_BPS.treasury,
    tier: 'TIER_1',
    policy: 'efficiency-game',
  });
  assert.equal(r.tierMultiplierBps, EFFICIENCY_GAME_MULTIPLIER_BPS.TIER_1.first);
  assert.deepEqual(r.outcomeApplied, { attempts: 1, status: 'ok' });
});

test('A.4.4 · creator + treasury neuron always equal totalCostNeuron exactly (no dust loss)', () => {
  for (const policy of ['flat', 'efficiency-game'] as const) {
    for (const tier of ['TIER_1', 'TIER_2'] as const) {
      const r = allocateFeeSplit({
        totalCostNeuron: TOTAL,
        creatorBps: 7777, // odd-bps shape to exercise rounding
        treasuryBps: 2223,
        tier,
        policy,
      });
      const sum = BigInt(r.creatorNeuron) + BigInt(r.treasuryNeuron);
      assert.equal(sum.toString(), TOTAL, `policy=${policy} tier=${tier}: creator+treasury must equal total`);
    }
  }
});

test('A.4.4 · negative totalCostNeuron throws', () => {
  assert.throws(
    () =>
      allocateFeeSplit({
        totalCostNeuron: '-1',
        creatorBps: SKILL_BPS.creator,
        treasuryBps: SKILL_BPS.treasury,
      }),
    /negative/i,
  );
});

test('A.4.4 · invalid bps sum throws', () => {
  assert.throws(
    () =>
      allocateFeeSplit({
        totalCostNeuron: TOTAL,
        creatorBps: 5000,
        treasuryBps: 4000, // sums to 9000, not 10000
      }),
    /must sum to 10000/i,
  );
});
