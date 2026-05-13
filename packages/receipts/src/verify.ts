import { canonicalHash, KNOWN_PAYMENT_CONTRACTS, type Network } from '@ivaronix/core';
import { verifyMessage, JsonRpcProvider, Interface, type Provider } from 'ethers';
import { ReceiptV1Schema, type ReceiptV1 } from './schema.js';
import { HASH_EXCLUDE } from './builder.js';

export type CheckName =
  | 'schema'
  | 'hash'
  | 'signature'
  | 'storage_availability'
  | 'chain_anchor'
  | 'payment_tx_binding'
  | 'tee_independent'
  | 'skill_manifest';

export interface CheckResult {
  name: CheckName;
  pass: boolean;
  detail?: string;
}

/**
 * Receipt state machine per FINAL_BUILD_PLAN.md D-4:
 *
 *   CLAIMED         → schema + hash + signature pass
 *   ANCHORED        → CLAIMED + chain-anchor binding present
 *   PAID            → ANCHORED + payment-tx 5-check binding pass
 *                     (when billing.payment block is present)
 *   FULLY VERIFIED  → PAID + TEE re-attestation re-runs successfully
 *
 * Receipts pre-Block-B (no billing.payment) skip PAID and go straight
 * to FULLY VERIFIED after TEE check (BACKWARDS_COMPAT path).
 */
export type ReceiptState = 'CLAIMED' | 'ANCHORED' | 'PAID' | 'FULLY VERIFIED';

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

/**
 * FINAL_BUILD_PLAN.md D-4 · 5-check payment-tx binding verifier.
 *
 * For receipts that carry `billing.payment`, this check re-runs the
 * binding against the live chain. All 5 sub-checks must pass:
 *
 *   1. Tx exists on chain at `billing.payment.txHash`.
 *   2. `tx.to === billing.payment.paymentContract` (a known SkillRunPayment).
 *   3. `tx.from === billing.payment.payer` (the receipt's claimed payer
 *      matches who actually paid).
 *   4. `tx.value === billing.payment.paidOg` (the amount claimed matches
 *      what actually moved).
 *   5. The decoded `SkillRunPaid` event's `receiptRoot` matches
 *      `storage.receiptRoot` of this receipt.
 *
 * Returns a single CheckResult with `pass: false` and a detailed error
 * pointing to the first failing sub-check; or `pass: true` when all 5
 * pass. Used by the CLI verifier to advance state ANCHORED → PAID.
 *
 * For receipts WITHOUT `billing.payment` (legacy, free skills, or
 * pre-Block-B), this check is N/A and returns `pass: true` with a
 * "no payment block" detail.
 */
export async function verifyPaymentBinding(
  receipt: ReceiptV1,
  provider: Provider,
): Promise<CheckResult> {
  if (!receipt.billing.payment) {
    return {
      name: 'payment_tx_binding',
      pass: true,
      detail: 'no payment block — legacy receipt or free skill',
    };
  }
  const payment = receipt.billing.payment;
  const network = receipt.chainAnchor.network as Network;

  // Sub-check 0: paymentContract is a known SkillRunPayment for this network.
  const known = KNOWN_PAYMENT_CONTRACTS[network];
  if (!known || !known.has(payment.paymentContract.toLowerCase())) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `paymentContract ${payment.paymentContract} not in KNOWN_PAYMENT_CONTRACTS for ${network}`,
    };
  }

  // Sub-check 1: tx exists on chain.
  const tx = await provider.getTransaction(payment.txHash);
  if (!tx) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `tx ${payment.txHash} not found on chain (${network})`,
    };
  }

  // Sub-check 2: tx.to === paymentContract
  if (!tx.to || tx.to.toLowerCase() !== payment.paymentContract.toLowerCase()) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `tx.to ${tx.to} != billing.payment.paymentContract ${payment.paymentContract}`,
    };
  }

  // Sub-check 3: tx.from === payer
  if (!tx.from || tx.from.toLowerCase() !== payment.payer.toLowerCase()) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `tx.from ${tx.from} != billing.payment.payer ${payment.payer}`,
    };
  }

  // Sub-check 4: tx.value === paidOg (string compare wei)
  if (tx.value.toString() !== payment.paidOg) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `tx.value ${tx.value.toString()} != billing.payment.paidOg ${payment.paidOg}`,
    };
  }

  // Sub-check 5: decoded SkillRunPaid event's receiptRoot matches the
  // payment-binding nonce stored in `billing.payment.draftReceiptRoot`.
  // The draftReceiptRoot is what the user signed via paySkillRun before
  // the inference ran; storage.receiptRoot is the canonical hash of the
  // receipt body content (separate concern, used for tamper detection).
  const txReceipt = await provider.getTransactionReceipt(payment.txHash);
  if (!txReceipt) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `tx receipt for ${payment.txHash} not found on chain`,
    };
  }
  const eventInterface = new Interface([
    'event SkillRunPaid(bytes32 indexed receiptRoot, address indexed payer, address indexed creator, uint256 amount, uint256 creatorShare, uint256 treasuryShare, uint16 creatorBps, uint16 treasuryBps, uint64 timestamp)',
  ]);
  const fragment = eventInterface.getEvent('SkillRunPaid');
  if (!fragment) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: 'event fragment lookup failed (internal — verifier bug)',
    };
  }
  const eventTopic = fragment.topicHash;
  const log = txReceipt.logs.find(
    (l) => l.address.toLowerCase() === payment.paymentContract.toLowerCase() && l.topics[0] === eventTopic,
  );
  if (!log) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `no SkillRunPaid event found in tx ${payment.txHash} logs from ${payment.paymentContract}`,
    };
  }
  const decoded = eventInterface.decodeEventLog('SkillRunPaid', log.data, log.topics);
  const eventReceiptRoot = (decoded.receiptRoot as string).toLowerCase();
  if (eventReceiptRoot !== payment.draftReceiptRoot.toLowerCase()) {
    return {
      name: 'payment_tx_binding',
      pass: false,
      detail: `event receiptRoot ${eventReceiptRoot} != payment.draftReceiptRoot ${payment.draftReceiptRoot}`,
    };
  }

  return {
    name: 'payment_tx_binding',
    pass: true,
    detail: `5/5 checks pass · ${payment.paidOg} wei · creator ${payment.creator} ${payment.creatorBps}bps · treasury ${payment.treasuryBps}bps`,
  };
}

/**
 * Convenience: a single async function that returns the receipt state after
 * the payment binding check. Wraps verifyPaymentBinding for callers that
 * want a state transition.
 *
 * NOTE: this function does NOT re-check schema/hash/signature; callers
 * should run verifyClaimed first and confirm CLAIMED before calling this.
 */
export async function verifyAnchoredAndPaid(
  receipt: ReceiptV1,
  provider: Provider,
): Promise<{ paymentCheck: CheckResult; state: 'ANCHORED' | 'PAID' }> {
  const paymentCheck = await verifyPaymentBinding(receipt, provider);
  return {
    paymentCheck,
    state: paymentCheck.pass ? 'PAID' : 'ANCHORED',
  };
}

// Re-export so the CLI verifier can construct a provider for the right network.
export { JsonRpcProvider };
