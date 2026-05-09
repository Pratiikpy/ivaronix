/**
 * Network identifier for 0G testnet (Galileo) or mainnet (Aristotle).
 * Verified against `oglabs resources/0g-doc/docs/ai-context.md` and `mainnet-overview.md`.
 */
export type Network = 'testnet' | 'mainnet';

export interface NetworkConfig {
  name: string;
  network: Network;
  chainId: number;
  rpcUrl: string;
  chainExplorer: string;
  storageExplorer: string;
  storageIndexer: string;
  routerBaseUrl: string;
  faucet?: string;
}

export const NETWORKS: Record<Network, NetworkConfig> = {
  testnet: {
    name: '0G-Galileo-Testnet',
    network: 'testnet',
    chainId: 16602,
    rpcUrl: 'https://evmrpc-testnet.0g.ai',
    chainExplorer: 'https://chainscan-galileo.0g.ai',
    storageExplorer: 'https://storagescan-galileo.0g.ai',
    storageIndexer: 'https://indexer-storage-testnet-turbo.0g.ai',
    routerBaseUrl: 'https://router-api-testnet.integratenetwork.work/v1',
    faucet: 'https://faucet.0g.ai',
  },
  mainnet: {
    name: '0G Mainnet',
    network: 'mainnet',
    chainId: 16661,
    rpcUrl: 'https://evmrpc.0g.ai',
    chainExplorer: 'https://chainscan.0g.ai',
    storageExplorer: 'https://storagescan.0g.ai',
    storageIndexer: 'https://indexer-storage-turbo.0g.ai',
    routerBaseUrl: 'https://router-api.0g.ai/v1',
  },
};

/** Stale chain IDs that doctor must reject. */
export const STALE_CHAIN_IDS = new Set([16601, 16600]);

/** Receipt type codes per RECEIPTS_SPEC.md §1. */
export const RECEIPT_TYPES = {
  doc_ask: 0,
  audit: 1,
  consensus: 2,
  burn: 3,
  memory_access: 4,
  skill_exec: 5,
  code_change: 6,
  passport_update: 7,
  swarm: 8,
  // Slot 9 (PASS 76 B-1): a single recurring-billing tick under a
  // SubscriptionEscrow agreement. Distinct from skill_exec because the
  // billing context (escrow id, drain amount, period) is the load-bearing
  // metadata, not just the skill that ran.
  subscription_skill_exec: 9,
  // Slot 10: confidential data room — one receipt per room creation
  // (manifest hash, parties, encrypted blob root) and one per read
  // (reader wallet, capability grant id, AI summary hash). Burn-mode
  // is auto-enabled on every read.
  doc_room_create: 10,
  doc_room_read: 11,
  // Slot 12 (planning-01 §2B): memory consolidation rollup. The agent
  // reads its own recent receipts in a window (day / month / year),
  // produces a TEE-attested summary, and anchors it as a new receipt
  // pointing at the source ids it consolidated. The consolidation IS
  // the rollup; no sidecar contract needed. Lineage is verifiable
  // via request.priorReceiptIds.
  memory_consolidation: 12,
} as const;

export type ReceiptType = keyof typeof RECEIPT_TYPES;

/** Receipt verification states surfaced uniformly across CLI + Studio. */
export type ReceiptState = 'draft' | 'claimed' | 'anchored' | 'fully-verified' | 'outcome-resolved';

/** Three-state UI chip per COMPONENTS.md §12 + UI_UX_GUIDE.md §6. */
export type ChipState = 'pending' | 'verified' | 'mismatch';

/** Consensus tier per HLD §11 + COMPONENTS.md §15. */
export type ConsensusTier = 'quick' | 'standard' | 'high-stakes';

/** Roles per consensus tier. */
export const ROLES_BY_TIER: Record<ConsensusTier, readonly string[]> = {
  quick: ['analyst'],
  standard: ['analyst', 'critic', 'judge'],
  'high-stakes': ['analyst', 'risk-reviewer', 'evidence-checker', 'red-team-critic', 'judge'],
};

/** Address (0x-prefixed 40-hex). */
export type Address = `0x${string}`;

/** Hash (0x-prefixed). */
export type Hash = `0x${string}`;
