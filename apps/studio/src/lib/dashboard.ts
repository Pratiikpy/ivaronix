import { JsonRpcProvider, formatEther } from 'ethers';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { getPassportClient, unifiedFindByAgent, getNetwork } from './chain';
import { NETWORKS } from '@ivaronix/core';

/**
 * Dashboard data-load helpers.
 *
 * Extracted from `app/api/dashboard/[addr]/route.ts` so both the API
 * route AND the SSR-rendered page can call the same code path. Per
 * planning-003 §A.5.16: dashboard used to be a client component that
 * fetched `/api/dashboard/<addr>` after first paint, leaving search
 * engines and slow networks staring at a blank page for ~800ms. Now
 * the server component awaits this loader directly.
 *
 * Reads are read-only and on public chain state, so there's no auth
 * gate — the same address can be passed by anyone.
 */

export interface DashboardSchedule {
  scheduleId: string;
  skillId: string;
  cron: string;
  inputKind: 'doc' | 'prompt';
  /**
   * Operationally-relevant fields are exposed to anyone fetching
   * /api/dashboard/<addr> (the public dashboard read). Sensitive
   * content (the actual question text the user typed, the original
   * doc filename) is REDACTED in this public payload — sweep 177
   * closure for the "public dashboard leaks operator local-file
   * contents" privacy bug. Owners read full schedule data via
   * `ivaronix skill schedule list` on their own machine; the public
   * dashboard is intentionally status-only.
   */
  tier: string;
  runCount: number;
  maxRuns: number | null;
  lastRunAt: number | null;
  lastReceiptId: string | null;
  createdAt: number;
}

export interface DashboardData {
  network: string;
  address: string;
  balanceOg: string;
  passport: {
    tokenId: string;
    metadataRoot: string;
    memoryRoot: string;
    trustScore: string;
    receiptCount: string;
    violationCount: string;
    mintedAt: number;
    lastEvolutionAt: number;
  } | null;
  recentReceipts: { id: string; receiptRoot: string; receiptType: number; timestamp: number }[];
  schedules: DashboardSchedule[];
}

/**
 * Walk up from the runtime CWD looking for a sibling `.ivaronix/schedules`
 * directory. Schedules are stored on the operator machine (not on chain)
 * because they are local cron entries that the CLI's `skill schedule run`
 * loop fires; the dashboard surfaces them as a read-only list filtered
 * to the connected wallet.
 */
export function loadSchedulesForOwner(owner: string): DashboardSchedule[] {
  const norm = owner.toLowerCase();
  const out: DashboardSchedule[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      const candidates = [
        resolve(dir, '.ivaronix', 'schedules'),
        resolve(dir, 'apps', 'cli', '.ivaronix', 'schedules'),
      ];
      for (const ds of candidates) {
        if (!existsSync(ds)) continue;
        for (const fname of readdirSync(ds)) {
          if (!fname.endsWith('.json')) continue;
          try {
            const raw = readFileSync(resolve(ds, fname), 'utf8');
            const s = JSON.parse(raw) as Record<string, unknown>;
            const sw = (s.ownerWallet as string | undefined)?.toLowerCase();
            if (!sw || sw !== norm) continue;
            const inputKind = (s.inputKind as 'doc' | 'prompt') ?? 'doc';
            // Sweep 177: inputLabel + question REDACTED from the public
            // dashboard payload. Pre-sweep this exposed the user's actual
            // prompt text + doc filename to any caller of
            // /api/dashboard/<addr>. The route has no SIWE gate (it's a
            // public read of operational state), so anyone could query
            // someone else's wallet and harvest schedule contents.
            out.push({
              scheduleId: s.scheduleId as string,
              skillId: s.skillId as string,
              cron: s.cron as string,
              inputKind,
              tier: s.tier as string,
              runCount: Number(s.runCount ?? 0),
              maxRuns: (s.maxRuns as number | null) ?? null,
              lastRunAt: (s.lastRunAt as number | null) ?? null,
              lastReceiptId: (s.lastReceiptId as string | null) ?? null,
              createdAt: Number(s.createdAt ?? 0),
            });
          } catch { /* skip malformed schedule files */ }
        }
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

// QA found findByAgent scans 100k blocks per call (>30s on testnet RPC).
// Per-address in-memory cache with 60s TTL — same cadence as /global's
// `Cached 60s.` pattern. Bounded at 64 entries to cap memory.
interface CacheEntry { ts: number; payload: DashboardData; }
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 64;
const cache = new Map<string, CacheEntry>();
function cacheGet(key: string): DashboardData | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.payload;
}
function cacheSet(key: string, payload: DashboardData): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { ts: Date.now(), payload });
}

/**
 * Returns the canonical dashboard payload for an address: passport
 * state + last 5 receipts + native OG balance + local schedules.
 *
 * Throws on invalid address (so callers don't have to remember to
 * validate). Returns a `DashboardData` on success — never null. Caches
 * results per-address for 60s.
 */
export async function loadDashboard(address: string): Promise<DashboardData> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`invalid address: ${address}`);
  }
  const key = address.toLowerCase();
  const cached = cacheGet(key);
  if (cached) return cached;

  const network = getNetwork();
  const rpcUrl = NETWORKS[network].rpcUrl;
  const provider = new JsonRpcProvider(rpcUrl);
  const passportClient = getPassportClient();

  // Tighten findByAgent lookback to 5k blocks (~3-5s) for "recent 5" panel.
  // V2-first union via unifiedFindByAgent so post-K-2 receipts appear
  // alongside legacy V1 ones, with registryVersion tagged on each row.
  const [passport, balanceWei, recent] = await Promise.all([
    passportClient ? passportClient.getPassportByWallet(address as `0x${string}`).catch(() => null) : null,
    provider.getBalance(address).catch(() => 0n),
    unifiedFindByAgent(address as `0x${string}`, 5, 5_000).catch(() => []),
  ]);

  const payload: DashboardData = {
    network,
    address,
    balanceOg: formatEther(balanceWei),
    passport: passport
      ? {
          tokenId: passport.tokenId.toString(),
          metadataRoot: passport.metadataRoot,
          memoryRoot: passport.memoryRoot,
          trustScore: passport.trustScore.toString(),
          receiptCount: passport.receiptCount.toString(),
          violationCount: passport.violationCount.toString(),
          mintedAt: Number(passport.mintedAt),
          lastEvolutionAt: Number(passport.lastEvolutionAt),
        }
      : null,
    recentReceipts: recent.map((r) => ({
      id: r.id.toString(),
      receiptRoot: r.receiptRoot,
      receiptType: r.receiptType,
      timestamp: Number(r.timestamp),
    })),
    schedules: loadSchedulesForOwner(address),
  };

  cacheSet(key, payload);
  return payload;
}
