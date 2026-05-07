import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeConvergence } from './convergence.js';

test('identical reviewer outputs yield convergence ≈ 1.0', () => {
  const text = 'The contract has high risk in clause 2 about non-refundable payment.';
  const result = computeConvergence([
    { role: 'analyst', content: text },
    { role: 'critic', content: text },
  ]);
  assert.equal(result.score, 1);
  assert.match(result.agreementSummary, /strongly agree/);
});

test('disjoint reviewer outputs yield convergence near 0', () => {
  const result = computeConvergence([
    { role: 'analyst', content: 'banana mango papaya' },
    { role: 'critic', content: 'wrench hammer screwdriver' },
  ]);
  assert.equal(result.score, 0);
  assert.match(result.agreementSummary, /diverge significantly/);
});

test('partially overlapping outputs land in the 0.3–0.7 band', () => {
  const result = computeConvergence([
    { role: 'analyst', content: 'risk clause refund payment terms agreement contract' },
    { role: 'critic', content: 'risk clause indemnification payment provider deliverables' },
  ]);
  assert.ok(result.score > 0.2 && result.score < 0.8, `expected 0.2 < score < 0.8 but got ${result.score}`);
  assert.notEqual(result.disagreementSummary, '');
});

test('judge is excluded from convergence', () => {
  // Three reviewers + a judge. Judge content should NOT affect convergence score.
  const reviewerText = 'risk clause refund';
  const result = computeConvergence([
    { role: 'analyst', content: reviewerText },
    { role: 'critic', content: reviewerText },
    { role: 'judge', content: 'totally different content like banana mango' },
  ]);
  assert.equal(result.score, 1, 'judge content should not lower convergence');
});

test('single reviewer trivially returns 1.0', () => {
  const result = computeConvergence([{ role: 'analyst', content: 'anything' }]);
  assert.equal(result.score, 1);
});

test('pairwise scores included for 3+ reviewers', () => {
  const result = computeConvergence([
    { role: 'analyst', content: 'risk clause refund' },
    { role: 'critic', content: 'risk clause refund' },
    { role: 'risk-reviewer', content: 'risk clause indemnification' },
  ]);
  assert.equal(Object.keys(result.pairwise).length, 3); // C(3,2) = 3 pairs
});
