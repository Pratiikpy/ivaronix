import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveRiskLevel } from './risk.js';

test('deriveRiskLevel: empty text → low', () => {
  assert.equal(deriveRiskLevel(''), 'low');
});

test('deriveRiskLevel: explicit severity:high → high', () => {
  assert.equal(deriveRiskLevel('The clause has severity: high implications.'), 'high');
});

test('deriveRiskLevel: explicit severity:medium → medium', () => {
  assert.equal(deriveRiskLevel('severity: medium based on the analysis.'), 'medium');
});

test('deriveRiskLevel: explicit severity:low → low', () => {
  assert.equal(deriveRiskLevel('Conclusion: severity: low risk profile.'), 'low');
});

test('deriveRiskLevel: severity:critical → high (collapsed to schema enum)', () => {
  assert.equal(deriveRiskLevel('severity: critical contract failure mode.'), 'high');
});

test('deriveRiskLevel: bare keyword "high-risk" → high', () => {
  assert.equal(deriveRiskLevel('This is a high-risk arrangement.'), 'high');
});

test('deriveRiskLevel: bare keyword "moderate" → medium', () => {
  assert.equal(deriveRiskLevel('Moderate concern about the indemnity clause.'), 'medium');
});

test('deriveRiskLevel: high beats medium (priority order)', () => {
  assert.equal(
    deriveRiskLevel('Some medium concerns and one severity: high finding.'),
    'high',
  );
});

test('deriveRiskLevel: text without risk markers → low (default)', () => {
  assert.equal(deriveRiskLevel('A perfectly ordinary lease summary with no risk markers.'), 'low');
});
