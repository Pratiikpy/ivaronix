import { canonicalize, canonicalHash, newReceiptId, sha256HexAsync, NETWORKS, type Network } from '@ivaronix/core';
import type { Signer } from 'ethers';
import { ReceiptV1Schema, type ReceiptV1, type UnsignedReceiptV1 } from './schema.js';

/**
 * Fields excluded from the canonical hash (per RECEIPTS_SPEC.md §3 step 1).
 *
 * The receipt hash is the digest of the IMMUTABLE content as of the `claimed` state.
 * Side-channel fields populated POST-CLAIM (chain anchor, storage tx) are excluded
 * so the hash remains stable across the `claimed → anchored` transition:
 *
 * - `signature`         — added after hash, RECEIPTS_SPEC.md §3 step 3
 * - `anchorTxHash`      — populated after on-chain anchor (`anchored` state)
 * - `anchorBlockNumber` — same
 * - `anchorTimestamp`   — same
 * - `receiptTxHash`     — 0G Storage upload tx (only known post-upload)
 *
 * NOT excluded (stay in canonical at build time and in verify):
 * - `proofDownloadVerified` — set to `false` at build, queried fresh at verify time (NOT mutated in receipt)
 * - `independentVerified`   — set to `null` at build, queried fresh at verify time
 * - `verifiedAt`            — same
 *
 * Verification re-runs the storage/chain/TEE checks from scratch each time;
 * it does NOT mutate these fields in the receipt JSON.
 */
/**
 * Keys excluded from the canonical hash. Two categories:
 *
 *   (1) Signature: `signature` is by definition computed AFTER the
 *       receiptRoot hash, so the body it signs cannot contain itself.
 *
 *   (2) Post-anchor metadata: every field written into the receipt body
 *       by the anchoring path AFTER the receiptRoot is computed.
 *       Including any of these in the hash means the verifier (who sees
 *       the post-anchor body) can never recompute the pre-anchor hash.
 *
 *       Today's post-anchor writes:
 *         - chainAnchor.anchorTxHash    (set after the anchor tx confirms)
 *         - chainAnchor.anchorBlockNumber
 *         - chainAnchor.anchorTimestamp
 *         - chainAnchor.onChainId       (B-V2-33 · written back to the
 *                                        local receipt JSON so 'verify' can
 *                                        navigate to chainscan without
 *                                        re-scanning events)
 *         - chainAnchor.status          (B-V2-33 · 'anchored' marker
 *                                        for the same reason)
 *         - receiptTxHash               (legacy alias kept for older receipts)
 *
 * If a new post-anchor field lands without being added here, every
 * receipt written after the change will fail hash verify. The
 * `receipts/builder.test.ts` "post-anchor metadata excluded" regression
 * is the read-side guard against this regression.
 */
const HASH_EXCLUDE = new Set([
  'signature',
  'anchorTxHash',
  'anchorBlockNumber',
  'anchorTimestamp',
  'onChainId',
  'status',
  'receiptTxHash',
  // FINAL_BUILD_PLAN.md Block B + D-4 · payment is post-claim side-channel
  // metadata, layered on after the receipt body's canonical hash is computed.
  // The 5-check verifier binds `event.receiptRoot === canonicalHash(body sans payment)`,
  // so excluding payment from the hash means the body's hash stays stable
  // whether or not the payment block is present (existing 1665+ receipts
  // verify unchanged; new payment-aware receipts hash the same body before
  // and after the payment block is added at /api/run/confirm).
  'payment',
]);

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
