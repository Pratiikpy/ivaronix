import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPolicy, classifySentiment } from './policy.js';

/**
 * Aggregation-policy regression suite (planning-003 §A.4.4 · zer0Gig
 * Efficiency Game). Locks in the four policy shapes — unanimous,
 * majority, first-objection, weighted — against representative
 * reviewer-output mixes.
 */

const A_APPROVE = {
  role: 'analyst',
  content: 'After reviewing the document, the terms look safe to sign. Recommend approving.',
};
const C_RISK = {
  role: 'critic',
  content: 'There is some risk here in clause 4 around auto-renewal. The user should be cautious about the renewal terms.',
};
const RR_REJECT = {
  role: 'risk-reviewer',
  content: 'High-risk: clause 7 is a dealbreaker. Do not sign as written. Recommend rejecting until renegotiated.',
};
const EC_NEUTRAL = {
  role: 'evidence-checker',
  content: 'The document references three external schedules that are not attached.',
};

test('A.4.4 · classifySentiment buckets approve / risk / reject / neutral', () => {
  assert.equal(classifySentiment(A_APPROVE.content), 'approve');
  assert.equal(classifySentiment(C_RISK.content), 'risk');
  assert.equal(classifySentiment(RR_REJECT.content), 'reject');
  assert.equal(classifySentiment(EC_NEUTRAL.content), 'neutral');
});

test('A.4.4 · unanimous: all-approve passes with zero dissents', () => {
  const r = applyPolicy({
    reviewerOutputs: [A_APPROVE, { role: 'critic', content: 'Approved. Clean document.' }],
    policy: 'unanimous',
  });
  assert.equal(r.decision, 'pass');
  assert.equal(r.dissents, 0);
  assert.equal(r.agreementBucket, 'STRICT');
});

test('A.4.4 · unanimous: any risk dissent blocks', () => {
  const r = applyPolicy({
    reviewerOutputs: [A_APPROVE, C_RISK],
    policy: 'unanimous',
  });
  assert.equal(r.decision, 'block');
  assert.equal(r.dissents, 1);
});

test('A.4.4 · unanimous: a hard reject blocks', () => {
  const r = applyPolicy({
    reviewerOutputs: [A_APPROVE, RR_REJECT],
    policy: 'unanimous',
  });
  assert.equal(r.decision, 'block');
  assert.equal(r.dissents, 1);
});

test('A.4.4 · majority: 2-of-3 approve passes', () => {
  const r = applyPolicy({
    reviewerOutputs: [A_APPROVE, EC_NEUTRAL, RR_REJECT],
    policy: 'majority',
  });
  assert.equal(r.decision, 'pass');
  assert.equal(r.agreementBucket, 'BALANCED');
});

test('A.4.4 · majority: 2-of-3 reject blocks', () => {
  const r = applyPolicy({
    reviewerOutputs: [
      A_APPROVE,
      RR_REJECT,
      { role: 'red-team-critic', content: 'Recommend rejecting. Multiple critical risks.' },
    ],
    policy: 'majority',
  });
  assert.equal(r.decision, 'block');
});

test('A.4.4 · first-objection: any hard reject blocks even with all others passing', () => {
  const r = applyPolicy({
    reviewerOutputs: [A_APPROVE, A_APPROVE, RR_REJECT, A_APPROVE],
    policy: 'first-objection',
  });
  assert.equal(r.decision, 'block');
  assert.equal(r.agreementBucket, 'LENIENT');
  // Per the LENIENT bucket: passes unless someone hard-rejects. Risks
  // alone don't block.
});

test('A.4.4 · first-objection: risks alone do NOT block', () => {
  const r = applyPolicy({
    reviewerOutputs: [A_APPROVE, C_RISK, EC_NEUTRAL],
    policy: 'first-objection',
  });
  assert.equal(r.decision, 'pass');
});

test('A.4.4 · weighted: high-weight reviewer dissent overrides multiple low-weight approves', () => {
  const r = applyPolicy({
    reviewerOutputs: [A_APPROVE, EC_NEUTRAL, RR_REJECT],
    policy: 'weighted',
    weights: { 'risk-reviewer': 5, analyst: 1, 'evidence-checker': 1 },
  });
  assert.equal(r.decision, 'block');
  assert.equal(r.agreementBucket, 'WEIGHTED');
});

test('A.4.4 · weighted: collapses to majority with no weights supplied', () => {
  const r1 = applyPolicy({
    reviewerOutputs: [A_APPROVE, EC_NEUTRAL, RR_REJECT],
    policy: 'weighted',
  });
  const r2 = applyPolicy({
    reviewerOutputs: [A_APPROVE, EC_NEUTRAL, RR_REJECT],
    policy: 'majority',
  });
  assert.equal(r1.decision, r2.decision);
});

test('A.4.4 · zero reviewers returns unclear with the right bucket', () => {
  const r = applyPolicy({ reviewerOutputs: [], policy: 'unanimous' });
  assert.equal(r.decision, 'unclear');
  assert.equal(r.dissents, 0);
  assert.equal(r.agreementBucket, 'STRICT');
});
