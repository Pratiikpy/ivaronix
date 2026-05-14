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

test('deriveRiskLevel: JSON "risk_level": "high" → high', () => {
  const finalText = '{"findings": [{"clause": "auto-renewal", "risk_level": "high", "section": "3.2"}]}';
  assert.equal(deriveRiskLevel(finalText), 'high');
});

test('deriveRiskLevel: JSON "risk_level": "medium" → medium', () => {
  const finalText = '{"finding": {"risk_level": "medium", "reason": "ambiguous indemnity"}}';
  assert.equal(deriveRiskLevel(finalText), 'medium');
});

test('deriveRiskLevel: JSON "risk_level": "low" → low (explicit JSON low beats fallthrough)', () => {
  const finalText = '{"findings": [{"clause": "standard", "risk_level": "low"}]}';
  assert.equal(deriveRiskLevel(finalText), 'low');
});

test('deriveRiskLevel: JSON "riskLevel" (camelCase) → high', () => {
  const finalText = '{"riskLevel": "high", "summary": "auto-renewal with 7% CPI uplift"}';
  assert.equal(deriveRiskLevel(finalText), 'high');
});

test('deriveRiskLevel: nda-triage signature_recommendation: refuse → high', () => {
  const finalText = '{"type": "one-way", "term_years": 0, "signature_recommendation": "refuse"}';
  assert.equal(deriveRiskLevel(finalText), 'high');
});

test('deriveRiskLevel: nda-triage signature_recommendation: negotiate → medium', () => {
  const finalText = '{"type": "two-way", "signature_recommendation": "negotiate"}';
  assert.equal(deriveRiskLevel(finalText), 'medium');
});

test('deriveRiskLevel: JSON high wins over severity:medium (priority order)', () => {
  const finalText = 'Initial scan: severity: medium\n\n{"findings": [{"risk_level": "critical"}]}';
  assert.equal(deriveRiskLevel(finalText), 'high');
});

test('deriveRiskLevel: markdown-fenced JSON block → high', () => {
  const finalText = '```json\n{"findings": [{"risk_level": "high"}]}\n```';
  assert.equal(deriveRiskLevel(finalText), 'high');
});
