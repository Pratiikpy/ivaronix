/**
 * FINAL_BUILD_PLAN.md Block O · Goldsky subgraph query layer.
 *
 * Marketplace pages + dashboard + public discovery query through this
 * module. When SUBGRAPH_URL env is set, queries hit the deployed
 * Goldsky subgraph for fast indexed reads. When unset, falls back to
 * direct-chain reads via ethers — slower (~5s per query) but functional
 * so the marketplace works pre-Goldsky-deploy and pre-paid-tier.
 *
 * Exports the 4 functions Block I marketplace pages need:
 *   - skillsList(opts)         → list skills with prices + activity
 *   - skillReceipts(skillId)   → latest receipts for a skill
 *   - creatorStats(creator)    → lifetime earnings, total runs, etc.
 *   - recentActivity(limit)    → public dashboard feed
 */
import { JsonRpcProvider, Contract, formatUnits } from 'ethers';
import { getStudioDeployedAddress as getDeployedAddress } from './deployments-bundle';
import type { Network } from '@ivaronix/core';

export interface SkillListing {
  skillId: string; // 0x... hex
  owner: string;
  priceWei: string;
  priceOg: string; // pretty
  creatorBps: number;
  treasuryBps: number;
  isPriced: boolean;
  totalReceipts: number;
  totalPaidWei: string;
}

export interface SkillReceipt {
  receiptRoot: string;
  agent: string;
  anchoredAt: number;
  txHash: string;
  registryVersion: string;
  onChainId: string;
}

export interface CreatorStats {
  creator: string;
  lifetimeEarnedWei: string;
  lifetimeEarnedOg: string;
  totalRuns: number;
  totalWithdrawnWei: string;
  latestWithdrawal: number | null;
  latestPayment: number | null;
}

export interface ActivityEvent {
  kind: 'receipt' | 'payment' | 'withdrawal' | 'skill_published' | 'price_updated';
  ts: number;
  txHash: string;
  summary: string;
}

const SUBGRAPH_URL = process.env.SUBGRAPH_URL; // when set: Goldsky-deployed endpoint

const SKILL_PRICING_ABI = [
  'function getPricing(bytes32 skillId) view returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)',
];
const SKILL_REGISTRY_ABI = ['function ownerOf(bytes32 skillId) view returns (address)'];
const SKILL_RUN_PAYMENT_ABI = [
  'function creatorBalance(address) view returns (uint256)',
  'function creatorLifetimeEarned(address) view returns (uint256)',
];

function getNetwork(): Network {
  return (process.env.IVARONIX_NETWORK ?? 'testnet') as Network;
}

function getRpcUrl(): string {
  return process.env.IVARONIX_RPC_URL ?? (getNetwork() === 'mainnet' ? 'https://evmrpc.0g.ai' : 'https://evmrpc-testnet.0g.ai');
}

async function querySubgraph<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  if (!SUBGRAPH_URL) return null;
  try {
    const r = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!r.ok) return null;
    const json = await r.json() as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────

/**
 * List skills with pricing + activity rollups. v1 returns the 6 first-party
 * skill IDs (well-known set) hydrated with chain-side pricing. Goldsky path
 * returns the full indexed set sorted by recent activity.
 */
export async function skillsList(opts: {
  limit?: number;
  sortBy?: 'recent' | 'price' | 'popular';
} = {}): Promise<SkillListing[]> {
  const limit = opts.limit ?? 20;

  // Goldsky path
  if (SUBGRAPH_URL) {
    const sortField =
      opts.sortBy === 'price' ? 'priceWei' :
      opts.sortBy === 'popular' ? 'totalReceipts' :
      'priceUpdatedAt';
    const data = await querySubgraph<{ skills: Array<Omit<SkillListing, 'priceOg'>> }>(
      `query Skills($limit: Int!, $orderBy: String!) {
        skills(first: $limit, orderBy: $orderBy, orderDirection: desc) {
          skillId: id
          owner
          priceWei
          creatorBps
          treasuryBps
          isPriced
          totalReceipts
          totalPaidWei
        }
      }`,
      { limit, orderBy: sortField },
    );
    if (data?.skills) {
      return data.skills.map((s) => ({
        ...s,
        priceOg: formatUnits(s.priceWei, 18),
      }));
    }
  }

  // Direct-chain fallback: read the well-known first-party skill IDs
  return await skillsListFromChain(limit);
}

const FIRST_PARTY_SKILLS = [
  'private-doc-review',
  'content-pitch-review',
  'github-audit',
  '0g-integration-auditor',
  'lawyer-clean',
  'finance-watchdog',
];

async function skillsListFromChain(limit: number): Promise<SkillListing[]> {
  const network = getNetwork();
  const pricingAddr = getDeployedAddress(network, 'SkillPricing');
  const registryAddr = getDeployedAddress(network, 'SkillRegistryV2');
  if (!pricingAddr || !registryAddr) return [];

  const provider = new JsonRpcProvider(getRpcUrl(), { chainId: network === 'mainnet' ? 16661 : 16602, name: network });
  const pricing = new Contract(pricingAddr, SKILL_PRICING_ABI, provider);
  const registry = new Contract(registryAddr, SKILL_REGISTRY_ABI, provider);

  const { keccak256, toUtf8Bytes } = await import('ethers');
  const out: SkillListing[] = [];

  for (const slug of FIRST_PARTY_SKILLS.slice(0, limit)) {
    const skillId = keccak256(toUtf8Bytes(`skill:${slug}`));
    try {
      const [price, cBps, tBps, priced] = await pricing.getFunction('getPricing')(skillId) as [bigint, number, number, boolean];
      const owner = await registry.getFunction('ownerOf')(skillId) as string;
      if (owner === '0x0000000000000000000000000000000000000000') continue;
      out.push({
        skillId,
        owner,
        priceWei: price.toString(),
        priceOg: formatUnits(price, 18),
        // ethers v6 returns uint16 as BigInt at runtime (despite TS `number`
        // signature). Explicit Number() cast is mandatory or downstream
        // `creatorBps / 100` throws "Cannot mix BigInt" SSR exception that
        // crashes the whole /marketplace page. Caught by P5 UI test.
        creatorBps: Number(cBps),
        treasuryBps: Number(tBps),
        isPriced: priced,
        totalReceipts: 0, // not available without subgraph
        totalPaidWei: '0',
      });
    } catch {
      /* skill not in registry / not priced — skip */
    }
  }
  return out;
}

/**
 * Latest receipts for a skill. Subgraph-only; direct-chain fallback would
 * require iterating ALL ReceiptAnchored events (too slow for v1 marketplace).
 * Returns empty array when subgraph is unavailable.
 */
export async function skillReceipts(skillId: string, limit = 10): Promise<SkillReceipt[]> {
  if (!SUBGRAPH_URL) return [];
  const data = await querySubgraph<{ receipts: SkillReceipt[] }>(
    `query SkillReceipts($skill: ID!, $limit: Int!) {
      receipts(where: { skill: $skill }, first: $limit, orderBy: anchoredAt, orderDirection: desc) {
        receiptRoot: id
        agent
        anchoredAt
        txHash
        registryVersion
        onChainId
      }
    }`,
    { skill: skillId, limit },
  );
  return data?.receipts ?? [];
}

/**
 * Creator dashboard stats. Goldsky path returns aggregated stats; chain
 * fallback reads creatorLifetimeEarned + creatorBalance directly.
 */
export async function creatorStats(creator: string): Promise<CreatorStats | null> {
  if (SUBGRAPH_URL) {
    const data = await querySubgraph<{ creatorStats?: CreatorStats }>(
      `query Creator($id: ID!) {
        creatorStats(id: $id) {
          creator: id
          lifetimeEarnedWei
          totalRuns
          totalWithdrawnWei: totalWithdrawn
          latestWithdrawal
          latestPayment
        }
      }`,
      { id: creator.toLowerCase() },
    );
    if (data?.creatorStats) {
      return {
        ...data.creatorStats,
        lifetimeEarnedOg: formatUnits(data.creatorStats.lifetimeEarnedWei, 18),
      };
    }
  }

  // Chain fallback
  const network = getNetwork();
  const paymentAddr = getDeployedAddress(network, 'SkillRunPayment');
  if (!paymentAddr) return null;
  const provider = new JsonRpcProvider(getRpcUrl(), { chainId: network === 'mainnet' ? 16661 : 16602, name: network });
  const payment = new Contract(paymentAddr, SKILL_RUN_PAYMENT_ABI, provider);

  try {
    const lifetime = await payment.getFunction('creatorLifetimeEarned')(creator) as bigint;
    const pending = await payment.getFunction('creatorBalance')(creator) as bigint;
    return {
      creator,
      lifetimeEarnedWei: lifetime.toString(),
      lifetimeEarnedOg: formatUnits(lifetime, 18),
      totalRuns: 0, // not available from chain alone
      totalWithdrawnWei: (lifetime - pending).toString(),
      latestWithdrawal: null,
      latestPayment: null,
    };
  } catch {
    return null;
  }
}

/**
 * Recent activity feed. Subgraph-only (chain fallback would require
 * iterating events across 5 contracts). Returns empty when unavailable.
 */
export async function recentActivity(limit = 20): Promise<ActivityEvent[]> {
  if (!SUBGRAPH_URL) return [];

  // Composite query: pull latest from each event source, merge + sort client-side
  const data = await querySubgraph<{
    receipts: Array<{ id: string; anchoredAt: string; txHash: string; agent: string }>;
    payments: Array<{ id: string; paidAt: string; payer: string; amount: string }>;
    withdrawals: Array<{ id: string; ts: string; by: string; amount: string; txHash: string }>;
  }>(
    `query Recent($limit: Int!) {
      receipts(first: $limit, orderBy: anchoredAt, orderDirection: desc) {
        id
        anchoredAt
        txHash
        agent
      }
      payments(first: $limit, orderBy: paidAt, orderDirection: desc) {
        id
        paidAt
        payer
        amount
      }
      withdrawals(first: $limit, orderBy: ts, orderDirection: desc) {
        id
        ts
        by
        amount
        txHash
      }
    }`,
    { limit },
  );
  if (!data) return [];

  const events: ActivityEvent[] = [];
  for (const r of data.receipts) {
    events.push({
      kind: 'receipt',
      ts: parseInt(r.anchoredAt, 10),
      txHash: r.txHash,
      summary: `Receipt anchored by ${r.agent.slice(0, 10)}…`,
    });
  }
  for (const p of data.payments) {
    events.push({
      kind: 'payment',
      ts: parseInt(p.paidAt, 10),
      txHash: p.id,
      summary: `${(parseFloat(formatUnits(p.amount, 18))).toFixed(4)} OG paid by ${p.payer.slice(0, 10)}…`,
    });
  }
  for (const w of data.withdrawals) {
    events.push({
      kind: 'withdrawal',
      ts: parseInt(w.ts, 10),
      txHash: w.txHash,
      summary: `${(parseFloat(formatUnits(w.amount, 18))).toFixed(4)} OG withdrawn by ${w.by.slice(0, 10)}…`,
    });
  }

  return events.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export function subgraphAvailable(): boolean {
  return Boolean(SUBGRAPH_URL);
}
