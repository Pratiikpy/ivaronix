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

/**
 * Known ReceiptRegistry deployment addresses per network. HALF_BAKED
 * §K-17 closure (sweep 219): the receipts schema cross-checks the
 * chainAnchor.registryAddress against this set so a tampered receipt
 * claiming a fake registry on the right chain fails parse-time
 * validation. Lowercase-compared, so checksum-vs-lowercase variants
 * are equivalent.
 *
 * Single source of truth lives in `contracts/deployments/<network>.json`;
 * `scripts/qa/metamask-e2e/verify-known-registries-vs-deployments.ts`
 * regression keeps this constant in sync with that file (sweep 219).
 *
 * Adding a future ReceiptRegistryV3 means appending its address here
 * AND in the deployments JSON. Doc reference: §15 bookkeeping rule.
 */
export const KNOWN_RECEIPT_REGISTRIES: Record<Network, ReadonlySet<string>> = {
  testnet: new Set<string>([
    '0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c'.toLowerCase(), // ReceiptRegistry V1
    '0xf675d4183b34fe8d1981FA9c117065aAcff690ab'.toLowerCase(), // ReceiptRegistryV2 (K-2 fix · EIP-712 anchor)
    '0x7396D536594e2BE833070c7EB441A10906046257'.toLowerCase(), // ReceiptRegistryV3 (B-V2-32 fix · receipt-type slots 10/11/12)
  ]),
  mainnet: new Set<string>(),
};

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

/**
 * Consensus tier per HLD §11 + COMPONENTS.md §15 + planning-003 §A.5.20.
 *
 * Tier composition (locked):
 *   quick       1 role  — single-pass answer
 *   standard    3 roles — analyst + critic + judge (adversarial review)
 *   high-stakes 5 roles — adds risk-reviewer + evidence-checker (legal /
 *               contract / financial review)
 *   audit       6 roles — adds red-team-critic on top of high-stakes
 *               (premium adversarial-audit tier; Track-3 marketplace
 *               pricing top tier)
 *
 * The `audit` tier was added 2026-05-10 to land the previously orphan
 * `red-team-critic` role declared in `packages/consensus/src/prompts.ts`.
 * Per planning-003 §A.5.20: "ship a 6-role audit tier; track 3
 * marketplace pricing gets audit as a premium tier."
 */
export type ConsensusTier = 'quick' | 'standard' | 'high-stakes' | 'audit';

/** Roles per consensus tier. */
export const ROLES_BY_TIER: Record<ConsensusTier, readonly string[]> = {
  quick: ['analyst'],
  standard: ['analyst', 'critic', 'judge'],
  'high-stakes': ['analyst', 'critic', 'risk-reviewer', 'evidence-checker', 'judge'],
  audit: ['analyst', 'critic', 'risk-reviewer', 'evidence-checker', 'red-team-critic', 'judge'],
};

/** Address (0x-prefixed 40-hex). */
export type Address = `0x${string}`;

/** Hash (0x-prefixed). */
export type Hash = `0x${string}`;
