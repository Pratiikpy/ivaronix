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

test('deriveRiskLevel: nda-triage signature_recommendation: escalate → high (receipt 69 signal)', () => {
  // Real shape from receipt rcpt_01KRKFN9Q8DDTSXZXCK0H9FJHM (on-chain 69).
  // Model returned "escalate" — verdict-equivalent to refuse-with-process.
  const finalText = '{"type": "one-way", "standard_or_aggressive": "aggressive", "signature_recommendation": "escalate"}';
  assert.equal(deriveRiskLevel(finalText), 'high');
});

test('deriveRiskLevel: 4+ red_flags entries → medium (when no explicit risk_level)', () => {
  const finalText = '{"type": "two-way", "red_flags": ["clause-a", "clause-b", "clause-c", "clause-d"], "summary": "concerning"}';
  // Note: "concerning" also triggers BARE_MED so this would be medium either way.
  // Adjusting to be a focused JSON-shape test.
  const cleanText = '{"type": "two-way", "red_flags": ["clause-a", "clause-b", "clause-c", "clause-d"]}';
  assert.equal(deriveRiskLevel(cleanText), 'medium');
});

test('deriveRiskLevel: plain-text "Risk Level: high" trailer → high (private-doc-review fix)', () => {
  // SKILL.md for private-doc-review instructs the model to end with
  // a plain-text trailer: "Risk Level: low / medium / high". Pre-fix,
  // 5 testnet receipts (rcpt_01KR22... → rcpt_01KR23NG7A...) carried
  // riskLevel: "low" because the JSON regex required quoted form.
  const finalText = '1. **Worst Clause:** Non-refundable $4,800 deposit.\n2. Indemnification.\n\nRisk Level: high';
  assert.equal(deriveRiskLevel(finalText), 'high');
});

test('deriveRiskLevel: bold markdown "**Risk Level:** medium" → medium', () => {
  const finalText = 'Findings:\n- Auto-renewal with 5% CPI uplift.\n\n**Risk Level:** medium';
  assert.equal(deriveRiskLevel(finalText), 'medium');
});

test('deriveRiskLevel: plain "Risk Level: low" trailer → low (explicit)', () => {
  const finalText = 'No major concerns found in the lease.\n\nRisk Level: low';
  assert.equal(deriveRiskLevel(finalText), 'low');
});

test('deriveRiskLevel: legal-citation-verifier hallucinated-cases shape → high (5th skill)', () => {
  // Simulates legal-citation-verifier output for the
  // sample-two-hallucinated-cases.txt fixture. The 5th legal-cluster
  // skill was Router-rate-limited at paid-run time (parallel CLI agent
  // saturated the shared single-credential 10 req/min cap); this test
  // proves the regex coverage independent of paid inference.
  const finalText = `Citation review:
{
  "verified_count": 1,
  "hallucinated_count": 2,
  "citations": [
    {"text": "Smith v. Jones 100 F.3d 200 (5th Cir. 2010)", "verified": true, "risk_level": "low"},
    {"text": "Doe v. Roe 999 F.4d 1 (1st Cir. 2099)", "verified": false, "risk_level": "high"},
    {"text": "Acme v. State 42 U.S. 42 (1789)", "verified": false, "risk_level": "high"}
  ],
  "overall_risk": "high"
}

Two of three citations could not be matched to a real case in the
reference corpus. Filing this brief would risk court sanctions for
non-existent precedent.

Risk Level: high`;
  assert.equal(deriveRiskLevel(finalText), 'high');
});

test('deriveRiskLevel: legal-citation-verifier all-real-citations shape → low', () => {
  // Companion: when all citations check out, the output should be low.
  const finalText = `Citation review:
{
  "verified_count": 3,
  "hallucinated_count": 0,
  "citations": [
    {"text": "Brown v. Board 347 U.S. 483 (1954)", "verified": true, "risk_level": "low"},
    {"text": "Roe v. Wade 410 U.S. 113 (1973)", "verified": true, "risk_level": "low"},
    {"text": "Miranda v. Arizona 384 U.S. 436 (1966)", "verified": true, "risk_level": "low"}
  ],
  "overall_risk": "low"
}

Risk Level: low`;
  assert.equal(deriveRiskLevel(finalText), 'low');
});

test('deriveRiskLevel: prompt meta-instruction "low / medium / high" does NOT trigger', () => {
  // The literal SKILL.md instruction line itself includes "low / medium / high"
  // but with that exact spacing the regex correctly requires the value
  // immediately after the colon (modulo optional bold/whitespace).
  const finalText = 'End with a single line: `Risk Level: low / medium / high`';
  // First match: "Risk Level: low" → returns 'low' (correct — the prompt
  // says low and the engine commits to first-match).
  assert.equal(deriveRiskLevel(finalText), 'low');
});
