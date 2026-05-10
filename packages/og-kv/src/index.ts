/**
 * 0G Storage KV pointer helpers.
 *
 * Used for mutable pointers per HLD §3 / REFERENCE_PATTERNS §3.2:
 *   passport:{wallet}:latest         -> latest passport metadata root
 *   memory:{agentId}:manifest        -> latest memory manifest hash
 *   skills:{wallet}:installed        -> JSON array of installed skill IDs
 *   receipts:{wallet}:cursor         -> last receipt ID + block height
 *
 * Production implementation needs a `0g-da-client` Docker container running
 * locally (per `oglabs resources/0g-memory-kv-server/`). Until that's wired,
 * `createKvClient()` returns an `InMemoryKvClient` honestly labeled as a
 * stub — caller can detect it via `client instanceof InMemoryKvClient` or
 * check whether the returned client is null after passing
 * `requireDurable: true` (planning-003 §A.5.7 / WT 11).
 */

export type KvKey = `passport:${string}:latest` | `memory:${string}:manifest` | `skills:${string}:installed` | `receipts:${string}:cursor` | string;

export interface KvClient {
  get(key: KvKey): Promise<string | null>;
  set(key: KvKey, value: string): Promise<void>;
  del(key: KvKey): Promise<void>;
}

/**
 * In-process Map-backed KV. NOT durable — process restart wipes state, no
 * cross-process visibility, no chain anchoring. Logs a one-time warning
 * the first time a method is called so calls in production paths don't
 * silently lie about persistence.
 *
 * Closes WT 11 (planning-003 §A.5.7) which flagged that V1's
 * `StubKvClient` advertised the same `KvClient` interface as the
 * eventual production client — a third-party developer pulling
 * `@ivaronix/og-toolkit` and calling `og.kv.set(...)` thought they
 * wrote to 0G KV; they wrote to a Map.
 */
export class InMemoryKvClient implements KvClient {
  private store = new Map<string, string>();
  private static warned = false;

  private warnOnce(): void {
    if (!InMemoryKvClient.warned) {
      InMemoryKvClient.warned = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[og-kv] InMemoryKvClient is in use — process-local Map, NOT durable. ' +
          'Set IVARONIX_KV_URL to point at a 0G-DA-client container for real persistence.',
      );
    }
  }

  async get(key: KvKey): Promise<string | null> {
    this.warnOnce();
    return this.store.get(key) ?? null;
  }
  async set(key: KvKey, value: string): Promise<void> {
    this.warnOnce();
    this.store.set(key, value);
  }
  async del(key: KvKey): Promise<void> {
    this.warnOnce();
    this.store.delete(key);
  }
}

/**
 * @deprecated Use {@link InMemoryKvClient} for explicit not-durable
 *             semantics. Alias kept for one release cycle so existing
 *             imports don't break.
 */
export const StubKvClient = InMemoryKvClient;

/**
 * Returns a KvClient. By default the in-memory stub (no durable backend
 * yet). Pass `{ requireDurable: true }` to get `null` when only the stub
 * is available — callers can branch on null and skip KV-dependent code
 * paths instead of silently writing to a Map.
 *
 * Overloads keep TypeScript honest:
 *   - `createKvClient()` and `createKvClient({ requireDurable: false })` →
 *     guaranteed non-null `KvClient` (the in-memory stub).
 *   - `createKvClient({ requireDurable: true })` → `KvClient | null` so
 *     callers must branch on the gap.
 */
export function createKvClient(): KvClient;
export function createKvClient(opts: { requireDurable: false }): KvClient;
export function createKvClient(opts: { requireDurable: true }): KvClient | null;
export function createKvClient(opts?: { requireDurable?: boolean }): KvClient | null {
  if (opts?.requireDurable) {
    // No production backend wired yet. Return null so callers can detect
    // the gap and short-circuit cleanly.
    return null;
  }
  return new InMemoryKvClient();
}
