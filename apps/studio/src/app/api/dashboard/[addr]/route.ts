import { NextResponse } from 'next/server';
import { JsonRpcProvider, formatEther } from 'ethers';
import { getPassportClient, getReceiptRegistry, getNetwork } from '@/lib/chain';
import { NETWORKS } from '@ivaronix/core';

export const dynamic = 'force-dynamic';

// QA found findByAgent scans 100k blocks per call (>30s on testnet RPC).
// Per-address in-memory cache with 60s TTL — same cadence as /global's
// `Cached 60s.` pattern. Bounded at 64 entries to cap memory.
interface CacheEntry { ts: number; payload: unknown; }
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 64;
const cache = new Map<string, CacheEntry>();
function cacheGet(key: string): unknown | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.payload;
}
function cacheSet(key: string, payload: unknown): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { ts: Date.now(), payload });
}

/**
 * GET /api/dashboard/<address> — returns the canonical dashboard payload
 * for an address: passport state + last 5 receipts + native OG balance.
 *
 * Read-only by design — every call comes from a connected wallet via the
 * client component, so we don't trust the address blindly; we just echo
 * back chain state that's already public.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ addr: string }> },
): Promise<NextResponse> {
  const { addr } = await params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const cached = cacheGet(addr.toLowerCase());
  if (cached) {
    return NextResponse.json(cached, { headers: { 'x-cache': 'hit' } });
  }

  const network = getNetwork();
  const rpcUrl = NETWORKS[network].rpcUrl;
  const provider = new JsonRpcProvider(rpcUrl);

  const passportClient = getPassportClient();
  const registry = getReceiptRegistry();

  // Tighten findByAgent's lookback from 100k blocks (~30s on testnet RPC)
  // to 5k blocks (~3-5s). Receipts older than that are still on-chain;
  // they just don't show in the "recent 5" panel. The dashboard's purpose
  // is recency, not completeness — recent state is the answer.
  const [passport, balanceWei, recent] = await Promise.all([
    passportClient ? passportClient.getPassportByWallet(addr as `0x${string}`).catch(() => null) : null,
    provider.getBalance(addr).catch(() => 0n),
    registry ? registry.findByAgent(addr as `0x${string}`, 5, 5_000).catch(() => []) : [],
  ]);

  const payload = {
    network,
    address: addr,
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
  };

  cacheSet(addr.toLowerCase(), payload);
  return NextResponse.json(payload, { headers: { 'x-cache': 'miss' } });
}
