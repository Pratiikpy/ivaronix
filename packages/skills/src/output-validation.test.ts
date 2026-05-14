/**
 * Unit tests for the output-schema validation logic (B-V2-46 closure).
 *
 * The validation runs in `apps/cli/src/commands/doc.ts` after
 * `tryParseJson` and before `buildReceipt`. This test mirrors the
 * pure-logic portion so the contract is locked.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

interface OutputSchema {
  required_keys: string[];
  fail_closed?: boolean;
}

interface ValidationResult {
  validationFailed: boolean;
  validationError?: string;
}

/**
 * Mirror of the validation block in `apps/cli/src/commands/doc.ts`.
 * Kept here as the canonical test target so future refactors stay
 * byte-equivalent.
 */
function validateAgainstSchema(data: unknown, schema: OutputSchema): ValidationResult {
  const required = schema.required_keys;
  if (Array.isArray(data)) {
    return {
      validationFailed: true,
      validationError: `array shape but object with required keys [${required.join(', ')}] expected`,
    };
  }
  if (data === null || typeof data !== 'object') {
    return {
      validationFailed: true,
      validationError: `${typeof data} shape but object with required keys [${required.join(', ')}] expected`,
    };
  }
  const missing = required.filter((k) => !(k in (data as Record<string, unknown>)));
  if (missing.length > 0) {
    return {
      validationFailed: true,
      validationError: `missing required keys: ${missing.join(', ')}`,
    };
  }
  return { validationFailed: false };
}

const NDA_SCHEMA: OutputSchema = {
  required_keys: ['type', 'term_years', 'governing_law', 'signature_recommendation'],
};

test('validates · all required keys present → ok', () => {
  const data = {
    type: 'one-way',
    term_years: 3,
    governing_law: 'Delaware',
    signature_recommendation: 'sign',
    extra_field: 'allowed',
  };
  assert.deepEqual(validateAgainstSchema(data, NDA_SCHEMA), { validationFailed: false });
});

test('rejects · empty array shape (the receipt #72 case)', () => {
  const result = validateAgainstSchema([], NDA_SCHEMA);
  assert.equal(result.validationFailed, true);
  assert.match(result.validationError!, /array shape but object/);
});

test('rejects · null shape', () => {
  const result = validateAgainstSchema(null, NDA_SCHEMA);
  assert.equal(result.validationFailed, true);
  assert.match(result.validationError!, /object shape but object with required keys/);
});

test('rejects · string shape', () => {
  const result = validateAgainstSchema('nope', NDA_SCHEMA);
  assert.equal(result.validationFailed, true);
  assert.match(result.validationError!, /string shape/);
});

test('rejects · number shape', () => {
  const result = validateAgainstSchema(42, NDA_SCHEMA);
  assert.equal(result.validationFailed, true);
  assert.match(result.validationError!, /number shape/);
});

test('rejects · missing some required keys', () => {
  const data = { type: 'one-way', term_years: 3 };
  const result = validateAgainstSchema(data, NDA_SCHEMA);
  assert.equal(result.validationFailed, true);
  assert.match(result.validationError!, /missing required keys: governing_law, signature_recommendation/);
});

test('rejects · missing one required key', () => {
  const data = { type: 'one-way', term_years: 3, governing_law: 'Delaware' };
  const result = validateAgainstSchema(data, NDA_SCHEMA);
  assert.equal(result.validationFailed, true);
  assert.match(result.validationError!, /missing required keys: signature_recommendation/);
});

test('accepts · contract-renewal findings array shape (single-key required)', () => {
  const FINDINGS_SCHEMA: OutputSchema = { required_keys: ['findings'] };
  assert.deepEqual(
    validateAgainstSchema({ findings: [{ section: '3.2', risk_level: 'high' }] }, FINDINGS_SCHEMA),
    { validationFailed: false },
  );
});

test('citations skill · accepts citations array wrapped in object', () => {
  const CITATIONS_SCHEMA: OutputSchema = { required_keys: ['citations'] };
  const data = { citations: [{ case_name: 'Mata v. Avianca', verified: false }] };
  assert.deepEqual(validateAgainstSchema(data, CITATIONS_SCHEMA), { validationFailed: false });
});

test('citations skill · rejects bare array of citations (missing wrapper object)', () => {
  const CITATIONS_SCHEMA: OutputSchema = { required_keys: ['citations'] };
  const data = [{ case_name: 'Mata v. Avianca' }];
  const result = validateAgainstSchema(data, CITATIONS_SCHEMA);
  assert.equal(result.validationFailed, true);
  assert.match(result.validationError!, /array shape/);
});
