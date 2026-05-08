/**
 * Embedding layer.
 *
 * Default: real semantic embeddings via `@xenova/transformers` running
 * `Xenova/all-MiniLM-L6-v2` (384-dim, mean-pooled, L2-normalized). Lazy-loaded
 * on first use; the ONNX weights cache to disk after the first call.
 *
 * Fallback: hashing-trick TF-IDF (the Day-8 baseline). Used when the model
 * fails to load (e.g. network-restricted CI), so memory still works.
 *
 * Both produce 384-dim float vectors with cosine similarity ∈ [-1,1] —
 * downstream code (FlatVectorIndex, FTS, engine) is unchanged.
 */

export const EMBEDDING_DIM = 384;
export const EMBEDDING_METHOD = 'all-MiniLM-L6-v2';
export const FALLBACK_METHOD = 'hashing-trick-tfidf-v1';

// ─── transformers.js path ────────────────────────────────────────────────────

let _pipeline: ((text: string, opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array }>) | null = null;
let _loadAttempted = false;
let _modelLoadFailed = false;

async function loadPipeline() {
  if (_pipeline) return _pipeline;
  if (_loadAttempted) return null;
  _loadAttempted = true;
  try {
    const xf = (await import('@xenova/transformers')) as { pipeline: (task: string, model: string) => Promise<typeof _pipeline> };
    _pipeline = await xf.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return _pipeline;
  } catch (err) {
    _modelLoadFailed = true;
    // eslint-disable-next-line no-console
    console.warn(`[memory] all-MiniLM-L6-v2 unavailable, falling back to hashing-trick: ${(err as Error).message}`);
    return null;
  }
}

/** Async embedding via real model. Falls back to hashing-trick on load failure. */
export async function embedAsync(text: string): Promise<{ vec: Float32Array; method: string }> {
  const pipe = await loadPipeline();
  if (!pipe) {
    return { vec: embedHashingTrick(text, EMBEDDING_DIM), method: FALLBACK_METHOD };
  }
  try {
    const out = await pipe(text, { pooling: 'mean', normalize: true });
    const vec = new Float32Array(EMBEDDING_DIM);
    for (let i = 0; i < EMBEDDING_DIM && i < out.data.length; i++) vec[i] = out.data[i] ?? 0;
    return { vec, method: EMBEDDING_METHOD };
  } catch (err) {
    _modelLoadFailed = true;
    // eslint-disable-next-line no-console
    console.warn(`[memory] embedAsync failed, falling back to hashing-trick: ${(err as Error).message}`);
    return { vec: embedHashingTrick(text, EMBEDDING_DIM), method: FALLBACK_METHOD };
  }
}

export function isModelLoadFailed(): boolean {
  return _modelLoadFailed;
}

// ─── hashing-trick fallback ──────────────────────────────────────────────────

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
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193) | 0;
  }
  return Math.abs(h) % dim;
}

function embedHashingTrick(text: string, dim: number = EMBEDDING_DIM): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (const [token, count] of tf) {
    const idx = hashToken(token, dim);
    vec[idx]! += 1 + Math.log(count);
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i]! /= norm;
  return vec;
}

/** Synchronous embedding kept for backward compatibility. Always hashing-trick. Prefer `embedAsync`. */
export function embed(text: string, dim: number = EMBEDDING_DIM): Float32Array {
  return embedHashingTrick(text, dim);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error('vector length mismatch');
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return Math.max(-1, Math.min(1, dot));
}

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

  replaceAll(items: { id: string; vector: Float32Array }[]): void {
    this.items = items.slice();
  }
}
