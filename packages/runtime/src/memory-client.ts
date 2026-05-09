/**
 * 0G Persistent Memory client (planning-002 W4).
 *
 * Thin REST wrapper around the `0g-memory` sidecar service (localhost:1995
 * by default). The sidecar runs as a Docker-composed stack of MongoDB +
 * Elasticsearch + Milvus + Redis + the local `zgs_kv` chain-sync binary.
 * Source: `oglabs resources/0g-memory/README.md`. Install + start sequence
 * is documented in `docs/USER_TODO.md` section B-4 — operator runs it once
 * per machine; we never write to those databases directly.
 *
 * Honest opt-in design:
 *   - Set `ZG_MEMORY_URL=http://localhost:1995` in .env to enable.
 *   - When unset, `MemoryClient.fromEnv()` returns null and the pipeline
 *     skips memory hooks entirely. No silent fallback to local FS.
 *   - When set but unreachable (sidecar down), every call returns the
 *     "empty" path (POST returns ok: false, search returns empty). The
 *     receipt body records `request.memoryQuery.retrievedCount: 0` and
 *     `verificationMethod` is unaffected.
 *
 * Memory primitive shape (per `oglabs resources/0g-memory/docs/api_docs/memory_api.md`):
 *   - POST /api/v1/memories  { group_id, user_id, type, content, metadata }
 *   - GET  /api/v1/memories/search?group_id&user_id&query&method&k
 *
 * Memory types we use:
 *   - `episodic_memory` for receipt-as-memory (every anchor stores the
 *     receipt body keyed by skillId + walletAddress)
 *
 * Search methods we use:
 *   - `agentic` (LLM-guided multi-round) for context retrieval before
 *     consensus calls — most relevant prior runs surface for the model
 */

export type MemoryType = 'profile' | 'episodic_memory' | 'foresight' | 'event_log';
export type MemorySearchMethod = 'keyword' | 'vector' | 'hybrid' | 'rrf' | 'agentic';

export interface MemoryEntry {
  group_id: string;
  user_id: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemorySearchInput {
  group_id: string;
  user_id: string;
  query: string;
  method?: MemorySearchMethod;
  k?: number;
}

export interface MemorySearchResult {
  entries: Array<{ content: string; score: number; metadata?: Record<string, unknown> }>;
  retrievedCount: number;
  method: MemorySearchMethod;
  ok: boolean;
}

export class MemoryClient {
  constructor(private readonly baseUrl: string) {}

  /** Read `ZG_MEMORY_URL` from env. Returns null when not configured. */
  static fromEnv(): MemoryClient | null {
    const url = process.env.ZG_MEMORY_URL;
    if (!url || url.trim() === '') return null;
    return new MemoryClient(url.replace(/\/$/, ''));
  }

  /** Persist a memory. Best-effort — never throws; returns ok flag. */
  async store(entry: MemoryEntry): Promise<{ ok: boolean; reason?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/memories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return { ok: false, reason: `http ${res.status}` };
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: (err as Error).message.slice(0, 100) };
    }
  }

  /** Search prior memories. Best-effort — empty result on any error. */
  async search(input: MemorySearchInput): Promise<MemorySearchResult> {
    const method: MemorySearchMethod = input.method ?? 'agentic';
    try {
      const params = new URLSearchParams({
        group_id: input.group_id,
        user_id: input.user_id,
        query: input.query,
        method,
        k: String(input.k ?? 5),
      });
      const res = await fetch(`${this.baseUrl}/api/v1/memories/search?${params.toString()}`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return { entries: [], retrievedCount: 0, method, ok: false };
      const body = (await res.json()) as { entries?: Array<{ content?: unknown; score?: unknown; metadata?: unknown }> };
      const entries = (body.entries ?? [])
        .filter((e) => typeof e.content === 'string')
        .map((e) => ({
          content: e.content as string,
          score: typeof e.score === 'number' ? e.score : 0,
          ...(e.metadata && typeof e.metadata === 'object' ? { metadata: e.metadata as Record<string, unknown> } : {}),
        }));
      return { entries, retrievedCount: entries.length, method, ok: true };
    } catch {
      return { entries: [], retrievedCount: 0, method, ok: false };
    }
  }
}

/** Build a `--- PRIOR MEMORIES ---` context block from search results.
 * Format mirrors the local-FS memory-depth block in `apps/cli/src/commands/doc.ts`
 * so the model treats both sources uniformly. */
export function buildMemoryContextBlock(result: MemorySearchResult, skillId: string): string {
  if (!result.ok || result.retrievedCount === 0) return '';
  const lines: string[] = [];
  lines.push(`--- PRIOR MEMORIES (0G Persistent Memory · ${result.method}) ---`);
  lines.push(`Retrieved ${result.retrievedCount} prior ${skillId} memories.`);
  for (const e of result.entries.slice(0, 8)) {
    lines.push(`- score=${e.score.toFixed(2)} · ${e.content.slice(0, 200)}${e.content.length > 200 ? '…' : ''}`);
  }
  lines.push('--- END PRIOR MEMORIES ---');
  return lines.join('\n') + '\n\n';
}
