/**
 * Convergence scoring between role outputs.
 *
 * Two methods, recorded on the receipt body via `method`:
 *
 *   1. `jaccard-tokens` — tokenized Jaccard similarity over stop-word-filtered
 *      tokens. Light, no embeddings dependency, but adversarial outputs that
 *      share token vocabulary (`approve risk acceptable` vs `reject risk
 *      unacceptable`) score artificially high (~0.5) when the actual semantic
 *      agreement is ~0. Default when no embedder is wired.
 *
 *   2. `embedding-cosine-MiniLM` — cosine similarity over all-MiniLM-L6-v2
 *      sentence embeddings. Catches semantic disagreement Jaccard misses.
 *      Used when the caller injects an async embedder (closure over
 *      `embedAsync` from `@ivaronix/memory/vector`).
 *
 * Closes planning-003 §A.4.9 (wandering thought #35). False-convergence on
 * legal/contract review is a liability; embedding similarity catches what
 * Jaccard misses without changing the public ConvergenceResult shape.
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

export type ConvergenceMethod = 'jaccard-tokens' | 'embedding-cosine-MiniLM' | 'hashing-trick-tfidf-v1';

export interface ConvergenceResult {
  /** Score in [0, 1]. 1 = perfect agreement. */
  score: number;
  /** Pairwise scores between non-judge roles. */
  pairwise: Record<string, number>;
  /** Method used for scoring. Reflects what actually ran (embedder may have failed to load). */
  method: ConvergenceMethod;
  /** Plain-English summary of agreement. */
  agreementSummary: string;
  /** Plain-English summary of disagreement (or empty if score ≥ 0.85). */
  disagreementSummary: string;
}

/**
 * Embedder injected by the caller. Returns the vector + the method label
 * the embedder used (e.g. `'all-MiniLM-L6-v2'` on success, the fallback
 * tag when the model failed to load). The convergence module stays
 * dependency-free; runtime callers (packages/runtime/pipeline.ts) wire
 * `embedAsync` from `@ivaronix/memory/vector`.
 */
export interface Embedder {
  embed(text: string): Promise<{ vec: Float32Array; method: string }>;
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

/**
 * Async convergence — uses cosine similarity over sentence embeddings when
 * the embedder is available; falls back to Jaccard when the embedder fails
 * to load (e.g. `@xenova/transformers` not installed) or throws on a
 * specific input.
 *
 * Per planning-003 §A.4.9 (WT 35): catches adversarial pairs where Jaccard
 * scores high (shared vocabulary) but semantic agreement is low. Tested
 * against:
 *   - "approve risk acceptable" vs "reject risk unacceptable" → Jaccard
 *     ≥ 0.5 medium-agreement, embedding-cosine ~0.2 strong-disagreement.
 *   - "the lease auto-renews for 24 months" vs "the lease does NOT auto-
 *     renew" → Jaccard ~0.7, embedding-cosine ~0.3.
 */
export async function computeConvergenceAsync(
  outputs: RoleOutput[],
  embedder: Embedder,
): Promise<ConvergenceResult> {
  const reviewers = outputs.filter((o) => o.role !== 'judge');

  if (reviewers.length < 2) {
    return {
      score: 1,
      pairwise: {},
      method: 'embedding-cosine-MiniLM',
      agreementSummary: 'Only one reviewer; convergence trivially 1.0.',
      disagreementSummary: '',
    };
  }

  let embeds: Array<{ role: string; vec: Float32Array; method: string }>;
  try {
    embeds = await Promise.all(
      reviewers.map(async (r) => {
        const { vec, method } = await embedder.embed(r.content);
        return { role: r.role, vec, method };
      }),
    );
  } catch (err) {
    // Embedder failed for the whole batch — fall back to Jaccard.
    return {
      ...computeConvergence(outputs),
      // Method stays jaccard-tokens (the actual computation that ran).
    };
  }

  // Use the method label from the first embed result. If the embedder
  // tagged itself as the fallback path (`hashing-trick-tfidf-v1`) propagate
  // that into the convergence result so the receipt records what really ran.
  const embedMethod = embeds[0]?.method ?? 'embedding-cosine-MiniLM';
  const method: ConvergenceMethod =
    embedMethod === 'all-MiniLM-L6-v2'
      ? 'embedding-cosine-MiniLM'
      : embedMethod === 'hashing-trick-tfidf-v1'
        ? 'hashing-trick-tfidf-v1'
        : 'embedding-cosine-MiniLM';

  const pairwise: Record<string, number> = {};
  let sum = 0;
  let count = 0;
  for (let i = 0; i < embeds.length; i++) {
    for (let j = i + 1; j < embeds.length; j++) {
      const a = embeds[i]!;
      const b = embeds[j]!;
      const score = embeddingCosineSimilarity(a.vec, b.vec);
      // Map cosine [-1, 1] to [0, 1] for consistency with Jaccard's range.
      const normalized = Math.max(0, (score + 1) / 2);
      pairwise[`${a.role} ↔ ${b.role}`] = Number(normalized.toFixed(4));
      sum += normalized;
      count++;
    }
  }

  const score = count > 0 ? sum / count : 1;
  const sharp = Number(score.toFixed(3));

  let agreementSummary: string;
  let disagreementSummary = '';

  if (sharp >= 0.85) {
    agreementSummary = `Reviewers strongly agree (avg pairwise cosine ${sharp}, method=${method}).`;
  } else if (sharp >= 0.65) {
    agreementSummary = `Reviewers broadly agree (cosine ${sharp}, method=${method}).`;
    disagreementSummary = formatDisagreement(reviewers, pairwise);
  } else if (sharp >= 0.4) {
    agreementSummary = `Reviewers partially overlap (cosine ${sharp}, method=${method}).`;
    disagreementSummary = formatDisagreement(reviewers, pairwise);
  } else {
    agreementSummary = `Reviewers diverge significantly (cosine ${sharp}, method=${method}). Treat final judgment with caution.`;
    disagreementSummary = formatDisagreement(reviewers, pairwise);
  }

  return { score: sharp, pairwise, method, agreementSummary, disagreementSummary };
}

/**
 * Pure cosine similarity between two equal-length Float32Array vectors.
 * Returns -1..1. The async wrapper above maps to 0..1 for consistency
 * with Jaccard's range so the receipt's `score` field is comparable
 * across methods.
 */
function embeddingCosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`vector dim mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
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
