import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { ulid } from '@ivaronix/core';
import type { ChatRichMessage } from '@ivaronix/og-router';

/**
 * Conversation persistence for `ivaronix chat`. Saved as a JSON file under
 * `.ivaronix/conversations/<ulid>.json`. The format is minimal — message
 * history + metadata — so any future Studio polish can render the same
 * file without an additional schema.
 */
export interface ConversationFile {
  id: string;
  createdAt: number;
  updatedAt: number;
  network: string;
  model: string;
  skill: string | null;
  messages: ChatRichMessage[];
  tokens: { input: number; output: number };
  costOg: number;
  receipts: string[];
}

function findConvDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, '.ivaronix', 'conversations');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to creating one under cwd
  const fallback = resolve(process.cwd(), '.ivaronix', 'conversations');
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

export function newConversation(initial: Omit<ConversationFile, 'id' | 'createdAt' | 'updatedAt'>): ConversationFile {
  const id = `conv_${ulid()}`;
  const now = Date.now();
  return { id, createdAt: now, updatedAt: now, ...initial };
}

export function saveConversation(c: ConversationFile): string {
  const dir = findConvDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${c.id}.json`);
  writeFileSync(path, JSON.stringify({ ...c, updatedAt: Date.now() }, null, 2));
  return path;
}

/**
 * Lightweight runtime shape check for ConversationFile · HALF_BAKED §J-3
 * (sweep 158). Pre-sweep, `loadConversation` cast `JSON.parse(...) as
 * ConversationFile` with no runtime validation. A stale or migration-
 * dropped conversation file would crash downstream at `.messages.length`
 * with a useless "Cannot read 'length' of undefined" error.
 *
 * Not a full Zod schema (CLI doesn't depend on zod). Just the fields
 * `loadConversation`'s callers rely on, with a structured error pointing
 * at the missing field.
 */
function parseConversationFile(json: unknown, sourcePath: string): ConversationFile {
  if (!json || typeof json !== 'object') {
    throw new Error(`malformed conversation file at ${sourcePath}: expected object, got ${typeof json}`);
  }
  const j = json as Record<string, unknown>;
  const required: Array<{ k: keyof ConversationFile; t: string }> = [
    { k: 'id', t: 'string' },
    { k: 'updatedAt', t: 'number' },
    { k: 'network', t: 'string' },
    { k: 'model', t: 'string' },
    { k: 'messages', t: 'array' },
  ];
  for (const { k, t } of required) {
    const v = j[k];
    const ok = t === 'array' ? Array.isArray(v) : typeof v === t;
    if (!ok) {
      throw new Error(`malformed conversation file at ${sourcePath}: field "${String(k)}" expected ${t}, got ${Array.isArray(v) ? 'array' : typeof v}`);
    }
  }
  return j as unknown as ConversationFile;
}

export function loadConversation(id: string): ConversationFile {
  const dir = findConvDir();
  const direct = join(dir, id.endsWith('.json') ? id : `${id}.json`);
  if (existsSync(direct)) {
    return parseConversationFile(JSON.parse(readFileSync(direct, 'utf8')), direct);
  }
  // Allow short-id prefix match
  const entries = readdirSync(dir);
  const prefix = id.startsWith('conv_') ? id : `conv_${id}`;
  const match = entries.find((e) => e.startsWith(prefix));
  if (!match) throw new Error(`conversation "${id}" not found in ${dir}`);
  const matchPath = join(dir, match);
  return parseConversationFile(JSON.parse(readFileSync(matchPath, 'utf8')), matchPath);
}

export function listConversations(limit = 20): { id: string; updatedAt: number; messages: number; model: string }[] {
  const dir = findConvDir();
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).filter((e) => e.endsWith('.json'));
  const rows = entries
    .map((e) => {
      try {
        const stat = statSync(join(dir, e));
        const path = join(dir, e);
        const body = parseConversationFile(JSON.parse(readFileSync(path, 'utf8')), path);
        return { id: body.id, updatedAt: body.updatedAt, messages: body.messages.length, model: body.model, mtime: stat.mtimeMs };
      } catch {
        // Malformed conversation file — skip in listing rather than crash.
        // parseConversationFile throws with sourcePath context; the outer
        // catch suppresses but the file is still untouched on disk for
        // operator inspection (`ivaronix session prune --dry-run` lists
        // candidates, the listing skip just keeps the menu clean).
        return null;
      }
    })
    .filter((x): x is { id: string; updatedAt: number; messages: number; model: string; mtime: number } => x !== null)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  return rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt, messages: r.messages, model: r.model }));
}
