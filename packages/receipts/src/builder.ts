import { canonicalize, canonicalHash, newReceiptId, sha256HexAsync, NETWORKS, type Network } from '@ivaronix/core';
import type { Signer } from 'ethers';
import { ReceiptV1Schema, type ReceiptV1, type UnsignedReceiptV1 } from './schema.js';

/** Fields excluded from the canonical hash (per RECEIPTS_SPEC.md §3 step 1). */
const HASH_EXCLUDE = new Set(['signature']);

export interface BuildReceiptInput {
  type: ReceiptV1['type'];
  agent: ReceiptV1['agent'];
  request: ReceiptV1['request'];
  execution: ReceiptV1['execution'];
  routerTrace: ReceiptV1['routerTrace'];
  teeVerification: ReceiptV1['teeVerification'];
  billing: ReceiptV1['billing'];
  storage: Omit<ReceiptV1['storage'], 'receiptRoot'>;
  burn?: ReceiptV1['burn'];
  chainAnchor: Omit<ReceiptV1['chainAnchor'], 'anchorTxHash' | 'anchorBlockNumber' | 'anchorTimestamp'>;
  outputs: ReceiptV1['outputs'];
  createdBy: string;
  parentReceiptId?: string | null;
}

/**
 * Build a draft receipt: assigns id + createdAt + computes the receiptRoot hash
 * over the canonical (signature-excluded) JSON. Returns an unsigned receipt.
 */
export function buildReceipt(input: BuildReceiptInput): UnsignedReceiptV1 {
  const draft = {
    version: '1.0' as const,
    id: newReceiptId(),
    type: input.type,
    parentReceiptId: input.parentReceiptId ?? null,
    agent: input.agent,
    request: input.request,
    execution: input.execution,
    routerTrace: input.routerTrace,
    teeVerification: input.teeVerification,
    billing: input.billing,
    storage: { ...input.storage, receiptRoot: '0x' + '0'.repeat(64) }, // placeholder — replaced after hashing
    burn: input.burn,
    chainAnchor: input.chainAnchor,
    outputs: input.outputs,
    createdAt: Date.now(),
    createdBy: input.createdBy,
  } as UnsignedReceiptV1;

  // Compute the receipt root hash over the canonical content (with placeholder root and no signature)
  const receiptRoot = canonicalHash(draft, HASH_EXCLUDE);
  draft.storage.receiptRoot = receiptRoot;

  // Validate before returning (catches schema-level errors early)
  ReceiptV1Schema.omit({ signature: true }).parse(draft);

  return draft;
}

export interface SignedReceipt extends ReceiptV1 {
  signature: NonNullable<ReceiptV1['signature']>;
}

/** Sign a draft receipt with eth_personal_sign over the receipt root hash. */
export async function signReceipt(
  draft: UnsignedReceiptV1,
  signer: Signer,
): Promise<SignedReceipt> {
  // Per RECEIPTS_SPEC.md §3 step 3: sign the receipt root hash.
  const signature = await signer.signMessage(draft.storage.receiptRoot);

  const signed: SignedReceipt = {
    ...draft,
    signature: {
      method: 'eth_personal_sign',
      signer: (await signer.getAddress()) as `0x${string}`,
      signature,
    },
  };

  ReceiptV1Schema.parse(signed);
  return signed;
}

/** Default chain-anchor scaffold for a new draft. Caller fills tx info post-anchor. */
export function defaultChainAnchor(network: Network, registryAddress: `0x${string}`): UnsignedReceiptV1['chainAnchor'] {
  const cfg = NETWORKS[network];
  return {
    network,
    chainId: cfg.chainId,
    rpcUrlHash: sha256HexAsync(cfg.rpcUrl),
    registryAddress,
  };
}

export { canonicalize, canonicalHash, HASH_EXCLUDE };
