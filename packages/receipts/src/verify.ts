import { canonicalHash } from '@ivaronix/core';
import { verifyMessage } from 'ethers';
import { ReceiptV1Schema, type ReceiptV1 } from './schema.js';
import { HASH_EXCLUDE } from './builder.js';

export type CheckName =
  | 'schema'
  | 'hash'
  | 'signature'
  | 'storage_availability'
  | 'chain_anchor'
  | 'tee_independent'
  | 'skill_manifest';

export interface CheckResult {
  name: CheckName;
  pass: boolean;
  detail?: string;
}

export type ReceiptState = 'CLAIMED' | 'ANCHORED' | 'FULLY VERIFIED';

export interface VerificationResult {
  checks: CheckResult[];
  state: ReceiptState | 'INVALID';
  receiptId: string;
}

/**
 * Verify the schema, hash, and signature of a receipt offline.
 * Returns CLAIMED if all three pass. Storage/chain/TEE checks require network calls.
 */
export function verifyClaimed(receiptJson: unknown): VerificationResult {
  const checks: CheckResult[] = [];

  // 1. Schema
  const schemaResult = ReceiptV1Schema.safeParse(receiptJson);
  if (!schemaResult.success) {
    checks.push({ name: 'schema', pass: false, detail: schemaResult.error.message });
    return { checks, state: 'INVALID', receiptId: '<unknown>' };
  }
  checks.push({ name: 'schema', pass: true });

  const receipt = schemaResult.data;

  // 2. Hash — recompute receiptRoot from canonical content
  const draftForHash: Partial<ReceiptV1> = {
    ...receipt,
    storage: { ...receipt.storage, receiptRoot: '0x' + '0'.repeat(64) },
  };
  const computedRoot = canonicalHash(draftForHash, HASH_EXCLUDE);
  if (computedRoot.toLowerCase() !== receipt.storage.receiptRoot.toLowerCase()) {
    checks.push({
      name: 'hash',
      pass: false,
      detail: `expected ${receipt.storage.receiptRoot}, computed ${computedRoot}`,
    });
    return { checks, state: 'INVALID', receiptId: receipt.id };
  }
  checks.push({ name: 'hash', pass: true });

  // 3. Signature
  if (!receipt.signature) {
    checks.push({ name: 'signature', pass: false, detail: 'receipt is unsigned' });
    return { checks, state: 'INVALID', receiptId: receipt.id };
  }

  let recovered: string;
  try {
    recovered = verifyMessage(receipt.storage.receiptRoot, receipt.signature.signature);
  } catch (err) {
    checks.push({ name: 'signature', pass: false, detail: (err as Error).message });
    return { checks, state: 'INVALID', receiptId: receipt.id };
  }

  if (recovered.toLowerCase() !== receipt.signature.signer.toLowerCase()) {
    checks.push({
      name: 'signature',
      pass: false,
      detail: `recovered ${recovered}, expected ${receipt.signature.signer}`,
    });
    return { checks, state: 'INVALID', receiptId: receipt.id };
  }

  if (receipt.signature.signer.toLowerCase() !== receipt.agent.ownerWallet.toLowerCase()) {
    checks.push({
      name: 'signature',
      pass: false,
      detail: `signer ${receipt.signature.signer} != agent.ownerWallet ${receipt.agent.ownerWallet}`,
    });
    return { checks, state: 'INVALID', receiptId: receipt.id };
  }

  checks.push({ name: 'signature', pass: true });

  return {
    checks,
    state: 'CLAIMED',
    receiptId: receipt.id,
  };
}
