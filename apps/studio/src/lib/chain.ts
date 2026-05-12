import { JsonRpcProvider } from 'ethers';
import {
  ReceiptRegistryClient,
  ReceiptRegistryV2Client,
  ReceiptRegistryV3Client,
  AgentPassportClient,
  SkillRegistryClient,
} from '@ivaronix/og-chain';
import { NETWORKS, RECEIPT_TYPES, type Network, type Hash, type Address } from '@ivaronix/core';
// Studio-local address resolver — imports contracts/deployments/<network>.json at
// build time so the JSON is traced into the Vercel function bundle. Replaces
// @ivaronix/og-chain's `getDeployedAddress` which walks up from process.cwd()
// (works in CLI; returns null on Vercel because contracts/ isn't bundled).
// See apps/studio/src/lib/deployments-bundle.ts for the full diagnosis.
import { getStudioDeployedAddress as getDeployedAddress } from './deployments-bundle';

/** Reverse-map a numeric receipt type code (as stored on chain) to its canonical name. */
const RECEIPT_TYPE_LABELS: Record<number, string> = Object.fromEntries(
  Object.entries(RECEIPT_TYPES).map(([k, v]) => [v as number, k])
);

export function receiptTypeLabel(code: number | bigint): string {
  const n = typeof code === 'bigint' ? Number(code) : code;
  return RECEIPT_TYPE_LABELS[n] ?? `type_${n}`;
}

/**
 * Server-side Ethers provider. The Studio reads on-chain data directly using
 * the og-chain workspace package — no API proxy. RPC at request time; route
 * handlers add per-call caching where the cost is meaningful (see
 * `lib/dashboard.ts` 60s per-address cache for the findByAgent scan).
 */
export function getNetwork(): Network {
  return (process.env.NEXT_PUBLIC_OG_NETWORK as Network) ?? 'testnet';
}

export function getProvider(): JsonRpcProvider {
  const net = getNetwork();
  const cfg = NETWORKS[net];
  return new JsonRpcProvider(cfg.rpcUrl, { chainId: cfg.chainId, name: cfg.name });
}

export function getReceiptRegistry(): ReceiptRegistryClient | null {
  const addr = getDeployedAddress(getNetwork(), 'ReceiptRegistry');
  if (!addr) return null;
  return new ReceiptRegistryClient(addr, getProvider());
}

export function getReceiptRegistryV2(): ReceiptRegistryV2Client | null {
  const addr = getDeployedAddress(getNetwork(), 'ReceiptRegistryV2');
  if (!addr) return null;
  return new ReceiptRegistryV2Client(addr, getProvider());
}

export function getReceiptRegistryV3(): ReceiptRegistryV3Client | null {
  const addr = getDeployedAddress(getNetwork(), 'ReceiptRegistryV3');
  if (!addr) return null;
  return new ReceiptRegistryV3Client(addr, getProvider());
}

/**
 * Unified registry view: V3 first, V2 fallback, V1 fallback. The label
 * tells the caller which registry the row came from so the UI can
 * render a `LEGACY-REGISTRY` chip on V1/V2 receipts when V3 is active
 * for new anchors.
 *
 * B-V2-32 closure (iter-78 + iter-79): V3 deployed 2026-05-12 at
 * 0x7396D536594e2BE833070c7EB441A10906046257 admits receipt-type slots
 * 10/11/12 (doc_room_create · doc_room_read · memory_consolidation)
 * that V2 capped at 9. New anchors with those slots land on V3; V2
 * stays live for the 7 existing V2-anchored receipts.
 */
export interface UnifiedRegistries {
  v3: ReceiptRegistryV3Client | null;
  v2: ReceiptRegistryV2Client | null;
  v1: ReceiptRegistryClient | null;
}

export function getRegistries(): UnifiedRegistries {
  return {
    v3: getReceiptRegistryV3(),
    v2: getReceiptRegistryV2(),
    v1: getReceiptRegistry(),
  };
}

/**
 * Cross-registry receipt row. The `registryVersion` field tells the UI
 * whether to render a `LEGACY-REGISTRY` chip alongside the receipt.
 *
 * Closes the V1-blindness pattern across 8 Studio surfaces (planning-003
 * §A.1.3, wandering thoughts #19, #28, #37, #41, #45, #51).
 */
export interface UnifiedReceipt {
  id: bigint;
  receiptRoot: Hash;
  storageRoot: Hash;
  attestationHash: Hash;
  agentAddress: Address;
  timestamp: bigint;
  receiptType: number;
  registryVersion: 'v1' | 'v2' | 'v3';
}

/**
 * Live passport count from AgentPassportINFT.
 *
 * Contract initializes `nextTokenId = 1` (the first mint gets id 1).
 * Anchored count is `nextTokenId - 1`. Sweep 187 consolidates this
 * subtraction so the three Studio surfaces (home, thesis, dashboard)
 * read through one helper instead of duplicating the convention.
 *
 * Returns null when the AgentPassportINFT client is unavailable (no
 * deployment for the current network) or when the chain read fails.
 * Returns 0n for an empty registry (no passports minted).
 */
export async function livePassportCount(): Promise<bigint | null> {
  const p = getPassportClient();
  if (!p) return null;
  try {
    const next = await p.nextTokenId();
    return next > 0n ? next - 1n : 0n;
  } catch {
    return null;
  }
}

/**
 * Sum of next-ids across V1 + V2 registries. Studio home + /global use
 * `total` as the headline; `v2` / `v1` breakouts surface post-K-2
 * activity for judges who care which registry is active.
 *
 * Sweep 184 fix: `total` is now ANCHORED COUNT (sum of `nextId - 1` per
 * registry), matching the convention used by numbers-refresh.ts and
 * the CLI count headlines. Pre-sweep `total: v2id + v1id` over-counted
 * by 1 per deployed registry because each registry's `nextId` value
 * is the NEXT id to assign, not the count of anchored receipts. With
 * both V1 + V2 deployed, the over-count was 2 — Studio's /global
 * showed 1646 while docs (numbers.json) and CLI quoted 1644.
 *
 * The `v2` / `v1` raw nextId values are still returned in the breakout
 * fields for callers that need them; only the `total` semantics
 * changed.
 */
export async function unifiedNextId(): Promise<{ v3: bigint; v2: bigint; v1: bigint; total: bigint }> {
  const { v3, v2, v1 } = getRegistries();
  const [v3id, v2id, v1id] = await Promise.all([
    v3 ? v3.nextId().catch(() => 0n) : Promise.resolve(0n),
    v2 ? v2.nextId().catch(() => 0n) : Promise.resolve(0n),
    v1 ? v1.nextId().catch(() => 0n) : Promise.resolve(0n),
  ]);
  const v3Anchored = v3id > 0n ? v3id - 1n : 0n;
  const v2Anchored = v2id > 0n ? v2id - 1n : 0n;
  const v1Anchored = v1id > 0n ? v1id - 1n : 0n;
  return { v3: v3id, v2: v2id, v1: v1id, total: v3Anchored + v2Anchored + v1Anchored };
}

/**
 * V2-first receipt lookup by id. Returns `null` if the id doesn't exist
 * on either registry. Pass `preferred: 'v1'` to skip V2 (used by callers
 * that already know the receipt is V1, e.g. printing a known legacy id).
 */
export async function unifiedGetReceipt(
  id: bigint,
  preferred?: 'v1' | 'v2' | 'v3',
): Promise<UnifiedReceipt | null> {
  const { v3, v2, v1 } = getRegistries();
  // Default order V3 → V2 → V1; `preferred` floats the named version to front.
  const order: Array<'v3' | 'v2' | 'v1'> =
    preferred === 'v1' ? ['v1', 'v3', 'v2']
    : preferred === 'v2' ? ['v2', 'v3', 'v1']
    : ['v3', 'v2', 'v1'];
  for (const v of order) {
    const client = v === 'v3' ? v3 : v === 'v2' ? v2 : v1;
    if (!client) continue;
    try {
      const r = await client.getReceipt(id);
      if (r) return { ...r, registryVersion: v };
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * V2-first lookup by `receiptRoot` bytes32. Used by /r/<id> when the URL
 * carries a 0x… root and by the print page when resolving a hash-style id.
 */
export async function unifiedFindByReceiptRoot(
  root: Hash,
  lookbackBlocks = 200_000,
): Promise<UnifiedReceipt | null> {
  const { v3, v2, v1 } = getRegistries();
  if (v3) {
    try {
      const r = await v3.findByReceiptRoot(root, lookbackBlocks);
      if (r) return { ...r, registryVersion: 'v3' };
    } catch {
      // try V2
    }
  }
  if (v2) {
    try {
      const r = await v2.findByReceiptRoot(root, lookbackBlocks);
      if (r) return { ...r, registryVersion: 'v2' };
    } catch {
      // try V1
    }
  }
  if (v1) {
    try {
      const r = await v1.findByReceiptRoot(root, lookbackBlocks);
      if (r) return { ...r, registryVersion: 'v1' };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Merged `findByAgent` across V1 + V2 with version tags. Sorted by
 * timestamp desc, sliced to `limit`. Used by /agent/[handle] and the
 * dashboard route.
 */
export async function unifiedFindByAgent(
  agent: Address,
  limit = 25,
  lookbackBlocks = 200_000,
): Promise<UnifiedReceipt[]> {
  const { v3, v2, v1 } = getRegistries();
  const merged: UnifiedReceipt[] = [];
  const tasks: Promise<void>[] = [];
  if (v3) {
    tasks.push(
      v3.findByAgent(agent, limit * 2, lookbackBlocks)
        .then((events) => {
          for (const e of events) merged.push({ ...e, registryVersion: 'v3' });
        })
        .catch(() => undefined),
    );
  }
  if (v2) {
    tasks.push(
      v2.findByAgent(agent, limit * 2, lookbackBlocks)
        .then((events) => {
          for (const e of events) merged.push({ ...e, registryVersion: 'v2' });
        })
        .catch(() => undefined),
    );
  }
  if (v1) {
    tasks.push(
      v1.findByAgent(agent, limit * 2, lookbackBlocks)
        .then((events) => {
          for (const e of events) merged.push({ ...e, registryVersion: 'v1' });
        })
        .catch(() => undefined),
    );
  }
  await Promise.all(tasks);
  merged.sort((a, b) => Number(b.timestamp - a.timestamp));
  return merged.slice(0, limit);
}

export function getPassportClient(): AgentPassportClient | null {
  const addr = getDeployedAddress(getNetwork(), 'AgentPassportINFT');
  if (!addr) return null;
  return new AgentPassportClient(addr, getProvider());
}

export function getSkillRegistry(): SkillRegistryClient | null {
  const addr = getDeployedAddress(getNetwork(), 'SkillRegistry');
  if (!addr) return null;
  return new SkillRegistryClient(addr, getProvider());
}

export function explorerTxUrl(txHash: string): string {
  return `${NETWORKS[getNetwork()].chainExplorer}/tx/${txHash}`;
}

export function explorerAddrUrl(addr: string): string {
  return `${NETWORKS[getNetwork()].chainExplorer}/address/${addr}`;
}
