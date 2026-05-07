/**
 * Convergence scoring between role outputs.
 *
 * Day 5 ships a tokenized Jaccard similarity baseline (light, no embeddings dep).
 * Day 8 (hybrid memory) will swap in `all-MiniLM-L6-v2` cosine similarity for
 * higher fidelity. The receipt schema records `convergenceScore` regardless of method.
 */

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','of','to','in','on','at','by','for','with','from','as','is','are',
  'was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may',
  'might','can','this','that','these','those','it','its','they','them','their','there','here','where','when',
  'how','what','which','who','whom','whose','i','you','he','she','we','our','your','my',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface ConvergenceResult {
  /** Score in [0, 1]. 1 = perfect agreement on key terms. */
  score: number;
  /** Pairwise scores between non-judge roles. */
  pairwise: Record<string, number>;
  /** Method used for scoring. */
  method: 'jaccard-tokens';
  /** Plain-English summary of agreement. */
  agreementSummary: string;
  /** Plain-English summary of disagreement (or empty if score ≥ 0.85). */
  disagreementSummary: string;
}

export interface RoleOutput {
  role: string;
  content: string;
}

/**
 * Compute convergence across non-judge role outputs.
 * The judge is excluded — it's a synthesis, not an independent reviewer.
 */
export function computeConvergence(outputs: RoleOutput[]): ConvergenceResult {
  // Filter out judge if present
  const reviewers = outputs.filter((o) => o.role !== 'judge');

  if (reviewers.length < 2) {
    return {
      score: 1,
      pairwise: {},
      method: 'jaccard-tokens',
      agreementSummary: 'Only one reviewer; convergence trivially 1.0.',
      disagreementSummary: '',
    };
  }

  const tokens = reviewers.map((r) => ({ role: r.role, tokens: tokenize(r.content) }));
  const pairwise: Record<string, number> = {};
  let sum = 0;
  let count = 0;
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i]!;
      const b = tokens[j]!;
      const score = jaccard(a.tokens, b.tokens);
      pairwise[`${a.role} ↔ ${b.role}`] = Number(score.toFixed(4));
      sum += score;
      count++;
    }
  }

  const score = count > 0 ? sum / count : 1;
  const sharp = Number(score.toFixed(3));

  let agreementSummary: string;
  let disagreementSummary = '';

  if (sharp >= 0.85) {
    agreementSummary = `Reviewers strongly agree (avg pairwise Jaccard ${sharp}).`;
  } else if (sharp >= 0.65) {
    agreementSummary = `Reviewers broadly agree (Jaccard ${sharp}); see disagreement summary for points of divergence.`;
    disagreementSummary = formatDisagreement(reviewers, pairwise);
  } else if (sharp >= 0.4) {
    agreementSummary = `Reviewers partially overlap (Jaccard ${sharp}); the judge will flag conflicts.`;
    disagreementSummary = formatDisagreement(reviewers, pairwise);
  } else {
    agreementSummary = `Reviewers diverge significantly (Jaccard ${sharp}). Treat the final judgment with caution.`;
    disagreementSummary = formatDisagreement(reviewers, pairwise);
  }

  return {
    score: sharp,
    pairwise,
    method: 'jaccard-tokens',
    agreementSummary,
    disagreementSummary,
  };
}

function formatDisagreement(reviewers: RoleOutput[], pairwise: Record<string, number>): string {
  // Pick the most-disagreeing pair and quote one short snippet from each
  const sorted = Object.entries(pairwise).sort((a, b) => a[1] - b[1]);
  if (sorted.length === 0) return '';
  const [pairName] = sorted[0]!;
  const [a, b] = pairName.split(' ↔ ');
  const ra = reviewers.find((r) => r.role === a);
  const rb = reviewers.find((r) => r.role === b);
  if (!ra || !rb) return '';
  const snippet = (text: string) =>
    text
      .split(/\n+/)
      .find((line) => line.trim().length > 30)
      ?.slice(0, 160) ?? text.slice(0, 160);
  return `${ra.role}: "${snippet(ra.content)}"\n${rb.role}: "${snippet(rb.content)}"`;
}
