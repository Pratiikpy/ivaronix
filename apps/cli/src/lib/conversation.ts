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

export function loadConversation(id: string): ConversationFile {
  const dir = findConvDir();
  const direct = join(dir, id.endsWith('.json') ? id : `${id}.json`);
  if (existsSync(direct)) return JSON.parse(readFileSync(direct, 'utf8')) as ConversationFile;
  // Allow short-id prefix match
  const entries = readdirSync(dir);
  const prefix = id.startsWith('conv_') ? id : `conv_${id}`;
  const match = entries.find((e) => e.startsWith(prefix));
  if (!match) throw new Error(`conversation "${id}" not found in ${dir}`);
  return JSON.parse(readFileSync(join(dir, match), 'utf8')) as ConversationFile;
}

export function listConversations(limit = 20): { id: string; updatedAt: number; messages: number; model: string }[] {
  const dir = findConvDir();
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir).filter((e) => e.endsWith('.json'));
  const rows = entries
    .map((e) => {
      try {
        const stat = statSync(join(dir, e));
        const body = JSON.parse(readFileSync(join(dir, e), 'utf8')) as ConversationFile;
        return { id: body.id, updatedAt: body.updatedAt, messages: body.messages.length, model: body.model, mtime: stat.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((x): x is { id: string; updatedAt: number; messages: number; model: string; mtime: number } => x !== null)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
  return rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt, messages: r.messages, model: r.model }));
}
