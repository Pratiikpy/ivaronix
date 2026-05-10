/**
 * Aggregation-policy evaluation for runConsensus output (planning-003 §A.4.4 ·
 * zer0Gig Efficiency Game).
 *
 * `runConsensus` produces an array of reviewer outputs + a judge synthesis.
 * Different deployments want different consensus shapes — a legal-review
 * skill might demand unanimous agreement; a brainstorm skill might accept
 * majority. This module is the policy evaluator: takes role outputs +
 * a policy name, returns `{ decision, dissents, agreementBucket }`.
 *
 * Output of `applyPolicy` is what runConsensus puts on the receipt body's
 * `execution.consensus.policyApplied` and `execution.consensus.dissents`
 * fields, so a verifier can re-run the policy and confirm it.
 *
 * Sentiment classification is intentionally simple — token presence of a
 * small "approve / reject / risk" vocabulary. The actual subtle disagreement
 * surfaces in `convergence.ts` (Jaccard or embedding-cosine). This module
 * is the *decision* layer on top of that.
 */

export type ConsensusPolicy = 'unanimous' | 'majority' | 'first-objection' | 'weighted';

export type Sentiment = 'approve' | 'reject' | 'risk' | 'neutral';

export interface PolicyInput {
  /** The reviewer outputs (judge excluded — judge is a synthesis, not a vote). */
  reviewerOutputs: { role: string; content: string }[];
  /** The policy to apply. */
  policy: ConsensusPolicy;
  /**
   * Optional per-role weights. Used only by `weighted`. Default: every
   * reviewer carries weight 1 (so `weighted` collapses to `majority`
   * when no weights are supplied).
   */
  weights?: Record<string, number>;
}

export interface PolicyDecision {
  /**
   * The aggregate decision. `pass` = reviewers cleared the run;
   * `block` = the policy blocked the run; `unclear` = the policy can't
   * decide (e.g. unanimous tie, or first-objection couldn't classify
   * any role's stance).
   */
  decision: 'pass' | 'block' | 'unclear';
  /**
   * How many reviewers dissented from the final decision. Zero on a
   * clean unanimous pass.
   */
  dissents: number;
  /**
   * Plain-English bucket — useful for chip rendering on /r/<id>.
   *   - 'STRICT'   = unanimous policy applied
   *   - 'BALANCED' = majority policy applied
   *   - 'LENIENT'  = first-objection inverted (LENIENT passes unless
   *                  every reviewer objects)
   *   - 'WEIGHTED' = per-role weighted majority
   */
  agreementBucket: 'STRICT' | 'BALANCED' | 'LENIENT' | 'WEIGHTED';
}

/**
 * Token-presence sentiment classifier. Light by design — the receipt's
 * convergence score (Jaccard or embedding-cosine) carries the real
 * agreement-strength signal; this is just enough to bucket each
 * reviewer's stance for the decision layer.
 *
 * `risk` weighs heavier than `approve` so a reviewer who flags risks
 * but otherwise approves still counts as a dissent under `unanimous`.
 */
export function classifySentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  // Strong-reject markers: explicit do-not-accept guidance.
  if (
    /\b(do not (sign|accept|proceed|approve)|reject(?:ed)?|recommend (?:rejecting|against)|red[- ]?flag(?:s|ged)?|critical (?:risk|issue)|high[- ]?risk|fatal\b|deal[- ]?breaker)/i.test(text)
  ) {
    return 'reject';
  }
  // Risk markers — reviewer flagged something worth attention even if
  // not a hard reject.
  if (/\b(risk|hostile|ambiguous|missing protection|unfavou?rable|caveat|concern|caution)\b/i.test(text)) {
    return 'risk';
  }
  // Approve markers — reviewer cleared the doc.
  if (
    /\b(safe to (?:sign|accept|proceed)|recommend (?:approving|accepting|signing)|approve(?:d)?|low[- ]?risk|clean|fine to)\b/i.test(lower)
  ) {
    return 'approve';
  }
  return 'neutral';
}

/**
 * Apply the aggregation policy and return the decision shape.
 *
 * Edge case: zero reviewers (which the tier composition prevents but
 * the function defends against) returns `{ decision: 'unclear', dissents: 0, agreementBucket }`.
 */
export function applyPolicy(input: PolicyInput): PolicyDecision {
  const { reviewerOutputs, policy } = input;
  const weights = input.weights ?? {};

  const sentiments = reviewerOutputs.map((r) => ({
    role: r.role,
    sentiment: classifySentiment(r.content),
    weight: weights[r.role] ?? 1,
  }));

  const passes = sentiments.filter((s) => s.sentiment === 'approve' || s.sentiment === 'neutral');
  const blockers = sentiments.filter((s) => s.sentiment === 'reject');
  // Risks are soft — they count as a partial-dissent under `unanimous`
  // and `first-objection` but don't block on their own.
  const risks = sentiments.filter((s) => s.sentiment === 'risk');

  const N = sentiments.length;

  if (N === 0) {
    return { decision: 'unclear', dissents: 0, agreementBucket: bucketFor(policy) };
  }

  switch (policy) {
    case 'unanimous': {
      // Every reviewer must approve outright — `risk` and `reject` both
      // count as dissents.
      const dissents = blockers.length + risks.length;
      const decision: PolicyDecision['decision'] = dissents === 0 ? 'pass' : 'block';
      return { decision, dissents, agreementBucket: 'STRICT' };
    }

    case 'majority': {
      // Approves + neutrals form the pass coalition. `risk` is half-weight
      // (counts as half a dissent) — a reviewer who flagged a risk is
      // partially dissenting, but didn't outright block.
      const dissentScore = blockers.length + risks.length * 0.5;
      const passScore = passes.length;
      const decision: PolicyDecision['decision'] =
        passScore > dissentScore ? 'pass' : passScore < dissentScore ? 'block' : 'unclear';
      // Whole-number dissents for the receipt: count blockers + half-up
      // of risks.
      const dissents = blockers.length + Math.ceil(risks.length / 2);
      return { decision, dissents, agreementBucket: 'BALANCED' };
    }

    case 'first-objection': {
      // Any single hard-reject blocks the run. Risks alone don't trigger
      // the block; the policy is "stop on first hard objection," not
      // "stop on first concern."
      const dissents = blockers.length + risks.length;
      const decision: PolicyDecision['decision'] = blockers.length > 0 ? 'block' : 'pass';
      // Per planning-003 §A.4.4, the Studio Run-panel "LENIENT" preset
      // maps to first-objection because it's the most permissive
      // mode that still blocks on a hard reject. Naming follows the
      // user-facing label.
      return { decision, dissents, agreementBucket: 'LENIENT' };
    }

    case 'weighted': {
      // Weighted-majority sentiment. Each reviewer's weight contributes
      // to either the pass or the dissent pool; if no weights are
      // supplied this collapses to `majority`.
      let passWeight = 0;
      let dissentWeight = 0;
      for (const s of sentiments) {
        if (s.sentiment === 'reject') dissentWeight += s.weight;
        else if (s.sentiment === 'risk') dissentWeight += s.weight * 0.5;
        else passWeight += s.weight;
      }
      const decision: PolicyDecision['decision'] =
        passWeight > dissentWeight ? 'pass' : passWeight < dissentWeight ? 'block' : 'unclear';
      const dissents = blockers.length + Math.ceil(risks.length / 2);
      return { decision, dissents, agreementBucket: 'WEIGHTED' };
    }
  }
}

function bucketFor(policy: ConsensusPolicy): PolicyDecision['agreementBucket'] {
  switch (policy) {
    case 'unanimous':
      return 'STRICT';
    case 'majority':
      return 'BALANCED';
    case 'first-objection':
      return 'LENIENT';
    case 'weighted':
      return 'WEIGHTED';
  }
}
