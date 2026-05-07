/**
 * 0G Storage KV pointer helpers.
 *
 * Used for mutable pointers per HLD §3 / REFERENCE_PATTERNS §3.2:
 *   passport:{wallet}:latest         -> latest passport metadata root
 *   memory:{agentId}:manifest        -> latest memory manifest hash
 *   skills:{wallet}:installed        -> JSON array of installed skill IDs
 *   receipts:{wallet}:cursor         -> last receipt ID + block height
 *
 * Real implementation lands in Day 8 (memory engine) once 0G KV SDK surface is confirmed.
 */

export type KvKey = `passport:${string}:latest` | `memory:${string}:manifest` | `skills:${string}:installed` | `receipts:${string}:cursor` | string;

export interface KvClient {
  get(key: KvKey): Promise<string | null>;
  set(key: KvKey, value: string): Promise<void>;
  del(key: KvKey): Promise<void>;
}

export class StubKvClient implements KvClient {
  private store = new Map<string, string>();

  async get(key: KvKey): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: KvKey, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async del(key: KvKey): Promise<void> {
    this.store.delete(key);
  }
}

export function createKvClient(): KvClient {
  return new StubKvClient();
}
