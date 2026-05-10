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

  // 2. Hash — recompute receiptRoot from canonical content.
  //
  // CRITICAL: hash the ORIGINAL JSON (receiptJson, the function arg),
  // not the Zod-parsed `receipt`. Zod's `safeParse` fills in default
  // values for any field with a .default() declaration that's missing
  // from the input. Hashing the parsed version produces a different
  // canonical string than the builder produced when the receipt was
  // created — every schema evolution that adds a default-valued field
  // would silently break hash verification on every previously-anchored
  // receipt. Sweep 61 caught this on receipt 1644 when the README's
  // headline `verify 1644` reported INVALID despite the receipt being
  // chain-anchored and signed correctly.
  //
  // Approach: cast receiptJson to a record-shaped object, swap
  // storage.receiptRoot for the all-zeros placeholder (matching the
  // builder's pre-hash state), then canonicalize. The schema check
  // above already validated structural correctness; this hash check
  // re-derives the deterministic content fingerprint.
  const originalJson = receiptJson as Record<string, unknown>;
  const originalStorage = (originalJson.storage as Record<string, unknown>) ?? {};
  const draftForHash: Record<string, unknown> = {
    ...originalJson,
    storage: { ...originalStorage, receiptRoot: '0x' + '0'.repeat(64) },
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

  // Tier-aware signer ↔ ownerWallet equality check. Closes HALF_BAKED
  // §I-3 / §K-14 (sweep 156).
  //
  // The receipt's `agent.signedBy` field declares the trust tier:
  //   - 'operator'                    → signer MUST equal ownerWallet
  //                                     (operator owns both, legacy default)
  //   - 'user-direct'                 → signer MUST equal ownerWallet
  //                                     (browser-side SIWE end-state)
  //   - 'operator-on-behalf-of-user'  → signer ≠ ownerWallet by design
  //                                     (W9 trust tier: operator anchors
  //                                     a receipt attributing the action
  //                                     to a user wallet who authenticated
  //                                     via SIWE before /api/run accepted
  //                                     the request).
  //
  // Pre-sweep-156 the equality check was unconditional, so every
  // 'operator-on-behalf-of-user' receipt failed verification with state
  // INVALID — the project's own verifier rejected its own emitted W9
  // receipts. HALF_BAKED §I-3 ranked this as "most embarrassing finding."
  //
  // For the delegated tier we accept the inequality as honest; the trust
  // gradient (operator-signer vs end-user-signer) is recorded in the
  // receipt body. A future enhancement can cross-check the operator's
  // signing wallet against ReceiptRegistry's authorizedRecorders or the
  // AgentPassportINFT V2 authorizedRelayers list — currently the
  // operator's identity is captured by signature.signer alone.
  const signedBy = receipt.agent.signedBy ?? 'operator';
  if (signedBy === 'operator-on-behalf-of-user') {
    checks.push({
      name: 'signature',
      pass: true,
      detail: `delegated · signer ${receipt.signature.signer} (operator) signed on behalf of ${receipt.agent.ownerWallet} (user)`,
    });
  } else {
    if (receipt.signature.signer.toLowerCase() !== receipt.agent.ownerWallet.toLowerCase()) {
      checks.push({
        name: 'signature',
        pass: false,
        detail: `signer ${receipt.signature.signer} != agent.ownerWallet ${receipt.agent.ownerWallet} (signedBy=${signedBy} requires equality)`,
      });
      return { checks, state: 'INVALID', receiptId: receipt.id };
    }
    checks.push({ name: 'signature', pass: true });
  }

  return {
    checks,
    state: 'CLAIMED',
    receiptId: receipt.id,
  };
}
