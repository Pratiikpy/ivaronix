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
