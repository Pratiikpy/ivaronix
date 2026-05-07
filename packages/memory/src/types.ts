import type { Address, Hash } from '@ivaronix/core';

/** A single memory observation. */
export interface Observation {
  id: string;            // ULID
  text: string;          // raw text (decrypted)
  tags: string[];        // namespaces / scopes (e.g., 'work', 'personal')
  source?: string;       // provenance (e.g., 'doc-ask', 'manual', skill id)
  createdAt: number;     // unix ms
  validFrom?: number;    // temporal window start
  validUntil?: number;   // temporal window end
  authorWallet?: Address; // who created this observation
  parentReceiptId?: string; // associated receipt (links memory to AI action)
}

/** Storage metadata that pairs with an observation. */
export interface ObservationMeta {
  id: string;
  ciphertext: Uint8Array;     // AES-256-GCM encrypted bytes
  embeddingVector: Float32Array; // 384-dim
  ftsContent: string;          // plaintext for FTS index (encrypted at rest? see below)
  tags: string[];
  source?: string;
  createdAt: number;
  validFrom?: number;
  validUntil?: number;
  authorWallet?: Address;
  parentReceiptId?: string;
}

/** Top-K recall result with provenance. */
export interface RecallHit {
  id: string;
  text: string;          // decrypted
  score: number;         // 0..1 — fused score across vector + FTS
  vectorScore: number;
  ftsScore: number;
  tags: string[];
  source?: string;
  createdAt: number;
  authorWallet?: Address;
  parentReceiptId?: string;
}

/** Recall request. */
export interface RecallQuery {
  text: string;
  tags?: string[];       // restrict to these scopes
  topK?: number;         // default 5
  fromTime?: number;     // optional temporal filter
  toTime?: number;
  caller?: Address;      // when caller != owner, capability check is enforced
  grantId?: Hash;        // if caller has a grant, pass it for validation
}

export interface MemoryEngineOptions {
  ownerWallet: Address;
  ownerPrivateKey: string; // used to derive encryption key
  dbPath: string;          // SQLite file path; pass ':memory:' for in-memory
  /** Whether to also call CapabilityRegistry on chain when caller != owner. */
  enableOnChainPermissions?: boolean;
  capabilityRegistryAddress?: Address;
  memoryAccessLogAddress?: Address;
  rpcUrl?: string;
  chainId?: number;
}

/** Manifest descriptor — pointer-style state captured for KV. */
export interface MemoryManifest {
  ownerWallet: Address;
  observationCount: number;
  rootHash: Hash;        // keccak of canonicalized fact list (snapshot anchor)
  lastWriteAt: number;
  embedding: { dim: number; method: string };
}
