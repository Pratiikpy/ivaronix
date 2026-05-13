/**
 * Plan §815 · `creator.fee_split` schema validation regression.
 *
 * Threat model: a future contributor relaxes the sum-to-10000 invariant or
 * removes the min/max range. Receipts produced after that change would carry
 * fee splits that don't add to 100%, and Track-3 marketplace payouts could
 * over-credit creators or strand bps in a rounding gap.
 *
 * What this locks at write-time:
 *   - 9000/1000 (canonical first-party default) → ACCEPT
 *   - 7000/3000 (commoditised category) → ACCEPT
 *   - 10000/0   (creator-only) → ACCEPT (edge of spec)
 *   - 0/10000   (treasury-only) → ACCEPT (edge of spec)
 *   - 9000/2000 (sum > 10000) → REJECT
 *   - 8000/1000 (sum < 10000) → REJECT
 *   - -100/10100 (negative creator) → REJECT
 *   - 9000/11000 (treasury > 10000) → REJECT
 *   - missing field → REJECT
 *   - fractional bps → REJECT (int constraint)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SkillManifestSchema } from './manifest.js';

function makeManifest(feeSplit: unknown): Record<string, unknown> {
  return {
    name: 'test/fee-split-regression',
    version: '0.1.0',
    description: 'fixture for plan §815 fee_split tests',
    license: 'Apache-2.0',
    entrypoint: 'prompt.md',
    og: {
      permissions: {
        memory_access: 'none',
        shell_access: 'none',
        receipt_required: true,
      },
      creator: {
        passport: 'did:0g:passport:0xtest:1',
        fee_split: feeSplit,
      },
    },
  };
}

test('fee_split 9000/1000 accepted (canonical first-party default)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 9000, treasury: 1000 }));
  assert.equal(result.success, true);
});

test('fee_split 7000/3000 accepted (commoditised category)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 7000, treasury: 3000 }));
  assert.equal(result.success, true);
});

test('fee_split 10000/0 accepted (creator-only edge case)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 10000, treasury: 0 }));
  assert.equal(result.success, true);
});

test('fee_split 0/10000 accepted (treasury-only edge case)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 0, treasury: 10000 }));
  assert.equal(result.success, true);
});

test('fee_split 9000/2000 rejected (sum > 10000)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 9000, treasury: 2000 }));
  assert.equal(result.success, false);
  if (!result.success) {
    const msg = JSON.stringify(result.error.issues);
    assert.match(msg, /must sum to 10000|sum to 10000|10000 basis/i);
  }
});

test('fee_split 8000/1000 rejected (sum < 10000)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 8000, treasury: 1000 }));
  assert.equal(result.success, false);
});

test('fee_split -100/10100 rejected (negative creator)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: -100, treasury: 10100 }));
  assert.equal(result.success, false);
});

test('fee_split 9000/11000 rejected (treasury > 10000)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 9000, treasury: 11000 }));
  assert.equal(result.success, false);
});

test('fee_split missing treasury rejected', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 9000 }));
  assert.equal(result.success, false);
});

test('fee_split missing creator rejected', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ treasury: 1000 }));
  assert.equal(result.success, false);
});

test('fee_split fractional bps rejected (int constraint)', () => {
  const result = SkillManifestSchema.safeParse(makeManifest({ creator: 9000.5, treasury: 999.5 }));
  assert.equal(result.success, false);
});

test('fee_split absent is accepted (block is optional per planning-003)', () => {
  // The creator block itself is optional; older manifests pre-A.3.8 ship
  // without it. Schema must stay backwards-compatible.
  const result = SkillManifestSchema.safeParse({
    name: 'test/no-creator',
    version: '0.1.0',
    description: 'fixture',
    license: 'Apache-2.0',
    entrypoint: 'prompt.md',
    og: {
      permissions: {
        memory_access: 'none',
        shell_access: 'none',
        receipt_required: true,
      },
    },
  });
  assert.equal(result.success, true);
});
