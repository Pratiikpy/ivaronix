import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Studio per-wallet quick-capture memory (planning-003 §A.4.8).
 *
 * Studio's `/memory` page lets a connected user write notes and recall
 * them with substring + recency filters. The full TEE-attested encrypted
 * MemoryEngine ships in `packages/memory/` and is used by the CLI's
 * `ivaronix memory remember` command — that's the production path. This
 * module is the lightweight Studio-side surface.
 *
 * Storage shape:
 *   `.ivaronix/studio-memory/<wallet-lowercase>/notes.jsonl`
 *   One JSON object per line: { id, ts, scope, text }.
 *
 * Privacy disclosure (mirrored on the Studio page itself):
 *   - Notes are stored as plaintext in the per-wallet sandbox.
 *   - The operator running the Studio process can read them.
 *   - For end-to-end encrypted memory, use `ivaronix memory remember`
 *     locally with your own signer key.
 *
 * The pattern is intentionally the same as `/api/skill/save`'s
 * per-wallet sandbox — wallet address is the path, SIWE gates writes,
 * no cross-wallet writes possible.
 */

export interface StudioNote {
  id: string;
  ts: number;
  scope: string;
  text: string;
}

const NOTES_FILENAME = 'notes.jsonl';
const MAX_NOTE_BYTES = 4_000;
const MAX_NOTES_LISTED = 100;
const MAX_RECALL_HITS = 20;

/**
 * Walk up from process.cwd() looking for the workspace root, then return
 * the absolute path to `.ivaronix/studio-memory/<wallet>/`. Same shape
 * as `/api/skill/save`'s `loadSchedulesForOwner` walker.
 */
function sandboxDir(wallet: string): string {
  const norm = wallet.toLowerCase();
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'studio-memory', norm);
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: write into the cwd if we can't find the workspace root.
  // Production deploys (Vercel) won't see pnpm-workspace.yaml at runtime;
  // the `/tmp` mount is the right home there.
  return resolve(process.cwd(), '.ivaronix', 'studio-memory', norm);
}

function notesPath(wallet: string): string {
  return resolve(sandboxDir(wallet), NOTES_FILENAME);
}

function ensureSandbox(wallet: string): string {
  const dir = sandboxDir(wallet);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Append a new note. Returns the persisted record (with assigned id + ts).
 * Throws if the text is empty or exceeds {@link MAX_NOTE_BYTES}.
 */
export function rememberNote(opts: {
  wallet: string;
  text: string;
  scope?: string;
}): StudioNote {
  const text = opts.text.trim();
  if (text.length === 0) throw new Error('note text required');
  if (Buffer.byteLength(text, 'utf8') > MAX_NOTE_BYTES) {
    throw new Error(`note exceeds ${MAX_NOTE_BYTES} bytes (got ${Buffer.byteLength(text, 'utf8')})`);
  }
  ensureSandbox(opts.wallet);
  const note: StudioNote = {
    id: `note_${Date.now()}_${randomBytes(4).toString('hex')}`,
    ts: Date.now(),
    scope: (opts.scope ?? 'project').replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'project',
    text,
  };
  appendFileSync(notesPath(opts.wallet), JSON.stringify(note) + '\n', 'utf8');
  return note;
}

function readAllNotes(wallet: string): StudioNote[] {
  const path = notesPath(wallet);
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf8');
  const out: StudioNote[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as StudioNote;
      if (
        typeof parsed.id === 'string' &&
        typeof parsed.ts === 'number' &&
        typeof parsed.text === 'string'
      ) {
        out.push(parsed);
      }
    } catch {
      // Skip malformed lines — never bubble a parse error up to the API.
    }
  }
  return out;
}

/**
 * Read up to {@link MAX_NOTES_LISTED} most-recent notes for the wallet.
 * Newest first.
 */
export function listNotes(wallet: string): StudioNote[] {
  const all = readAllNotes(wallet);
  all.sort((a, b) => b.ts - a.ts);
  return all.slice(0, MAX_NOTES_LISTED);
}

/**
 * Recall notes by substring + recency. Case-insensitive match against
 * `text` and `scope`. Returns hits ranked by (a) substring match score
 * (more matches = better) and (b) recency. Bounded to
 * {@link MAX_RECALL_HITS}.
 *
 * This is intentionally a simple BM25-shaped filter — the production
 * vector + FTS path lives in `packages/memory/` (CLI). Studio's
 * lightweight implementation is fast, no SQLite dependency, and good
 * enough for the demo UX.
 */
export function recallNotes(opts: {
  wallet: string;
  query: string;
  scope?: string;
  fromTime?: number;
  toTime?: number;
}): StudioNote[] {
  const all = readAllNotes(opts.wallet);
  const tokens = opts.query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  const filtered = all.filter((n) => {
    if (opts.scope && opts.scope !== n.scope) return false;
    if (opts.fromTime && n.ts < opts.fromTime) return false;
    if (opts.toTime && n.ts > opts.toTime) return false;
    if (tokens.length === 0) return true; // empty query → recency feed
    const haystack = `${n.text} ${n.scope}`.toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  });
  // Score: token-match count + recency tiebreak (newer wins).
  const scored = filtered.map((n) => {
    const haystack = `${n.text} ${n.scope}`.toLowerCase();
    const tokenHits = tokens.reduce(
      (acc, t) => acc + (haystack.includes(t) ? 1 : 0),
      0,
    );
    return { note: n, score: tokenHits, ts: n.ts };
  });
  scored.sort((a, b) => (b.score - a.score) || (b.ts - a.ts));
  return scored.slice(0, MAX_RECALL_HITS).map((s) => s.note);
}

/**
 * Delete a single note by id. Returns true when removed, false when no
 * matching id was found. Implemented as read-filter-rewrite; works
 * fine up to a few thousand entries per wallet (10× the
 * {@link MAX_NOTES_LISTED} cap), and the demo UX keeps the cap small.
 */
export function forgetNote(opts: { wallet: string; id: string }): boolean {
  const all = readAllNotes(opts.wallet);
  const remaining = all.filter((n) => n.id !== opts.id);
  if (remaining.length === all.length) return false;
  ensureSandbox(opts.wallet);
  const out = remaining.map((n) => JSON.stringify(n)).join('\n') + (remaining.length > 0 ? '\n' : '');
  writeFileSync(notesPath(opts.wallet), out, 'utf8');
  return true;
}

/**
 * Delete every note older than `beforeMs` for the wallet. Returns the
 * count of deleted notes. The CLI's `ivaronix memory forget --before`
 * flag is the equivalent on the encrypted-engine path.
 */
export function forgetBeforeNotes(opts: { wallet: string; beforeMs: number }): number {
  const all = readAllNotes(opts.wallet);
  const remaining = all.filter((n) => n.ts >= opts.beforeMs);
  const removed = all.length - remaining.length;
  if (removed === 0) return 0;
  ensureSandbox(opts.wallet);
  const out = remaining.map((n) => JSON.stringify(n)).join('\n') + (remaining.length > 0 ? '\n' : '');
  writeFileSync(notesPath(opts.wallet), out, 'utf8');
  return removed;
}

export const STUDIO_MEMORY_LIMITS = {
  MAX_NOTE_BYTES,
  MAX_NOTES_LISTED,
  MAX_RECALL_HITS,
} as const;
