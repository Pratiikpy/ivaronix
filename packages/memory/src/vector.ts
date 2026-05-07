import { createHash } from 'node:crypto';

/**
 * Day 8 baseline: hashing-trick TF-IDF-style sparse-to-dense embeddings.
 *
 * Tokens are hashed into a fixed-dimension vector (384, matching all-MiniLM-L6-v2).
 * Frequencies are normalized (L2 unit vector) so cosine similarity reduces to dot product.
 *
 * This is NOT semantic — synonyms and paraphrases won't match. But it's deterministic,
 * dependency-free, and good enough for first-pass recall. Day 18 polish swaps in
 * `transformers.js` + `all-MiniLM-L6-v2` cosine — same interface, no engine code change.
 */
export const EMBEDDING_DIM = 384;
export const EMBEDDING_METHOD = 'hashing-trick-tfidf-v1';

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','of','to','in','on','at','by','for','with','from','as','is','are',
  'was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may',
  'might','can','this','that','these','those','it','its','they','them','their','there','here','where','when',
  'how','what','which','who','whom','whose','i','you','he','she','we','our','your','my',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function hashToken(token: string, dim: number): number {
  // FNV-1a 32-bit, then mod dim
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return Math.abs(h) % dim;
}

export function embed(text: string, dim: number = EMBEDDING_DIM): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  // Term frequency
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  // Hashing trick — accumulate into vec
  for (const [token, count] of tf) {
    const idx = hashToken(token, dim);
    // log-tf weighting smooths frequency distribution
    vec[idx]! += 1 + Math.log(count);
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i]! /= norm;
  return vec;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error('vector length mismatch');
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  // Vectors are pre-normalized; dot product == cosine similarity in [-1,1].
  return Math.max(-1, Math.min(1, dot));
}

/** Simple flat index — O(N) per query but trivially correct.
 *  HNSW upgrade is a Day 18 swap-in (same interface). */
export class FlatVectorIndex {
  private items: { id: string; vector: Float32Array }[] = [];

  add(id: string, vector: Float32Array): void {
    this.items.push({ id, vector });
  }

  remove(id: string): void {
    this.items = this.items.filter((it) => it.id !== id);
  }

  search(query: Float32Array, topK: number): { id: string; score: number }[] {
    const scored = this.items.map((it) => ({
      id: it.id,
      score: cosineSimilarity(query, it.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  size(): number {
    return this.items.length;
  }

  /** Bulk replace (used when restoring from disk). */
  replaceAll(items: { id: string; vector: Float32Array }[]): void {
    this.items = items.slice();
  }
}
