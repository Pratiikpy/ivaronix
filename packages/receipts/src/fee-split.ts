/**
 * Track 3 settlement helper: given the skill's declared basis-point split
 * and the receipt's `totalCostNeuron`, compute the per-actor allocation as
 * BigInt-precise neuron strings.
 *
 * **Tier multiplier (planning-002 W5 — Efficiency Game).** Receipts that
 * passed independent TEE verification (TIER 1) earn 100% of the declared
 * creator share. Receipts signed by an external (non-TEE-attested) provider
 * (TIER 2) earn 85% — the 15% delta routes to the treasury as a soak buffer.
 * This turns the TIER 1 / TIER 2 receipt label from a honesty marker into
 * a market signal: skills run with TEE attestation pay creators more.
 *
 * Why BigInt: token costs can run to 1e15 neuron (≈0.001 OG); JS Number
 * loses precision at 2^53. We do the math in BigInt and serialise as
 * decimal strings, the same shape the rest of `billing.*Neuron` uses.
 *
 * The split is exact and deterministic. Rounding dust always lands in the
 * treasury, never created or destroyed.
 */

export type ReceiptTier = 'TIER_1' | 'TIER_2';

/** Multiplier in basis points applied to the declared creator share before
 * the actual neuron allocation is computed. The complement routes to
 * treasury. */
export const TIER_MULTIPLIER_BPS: Record<ReceiptTier, number> = {
  TIER_1: 10000, // 100% — TEE-attested via 0G Compute (router_flag / compute_sdk_process_response)
  TIER_2: 8500,  // 85% — external-signed (NVIDIA NIM, OpenAI, etc.); 15% delta to treasury
};

export interface FeeSplitInput {
  totalCostNeuron: string;
  /** Declared creator basis points from the skill manifest. */
  creatorBps: number;
  /** Declared treasury basis points from the skill manifest. */
  treasuryBps: number;
  creatorPassport?: string;
  /**
   * Receipt tier — controls the multiplier applied to the creator share.
   * Defaults to TIER_2 (conservative) so callers that don't specify get
   * the lower payout.
   */
  tier?: ReceiptTier;
}

export interface FeeSplitAllocation {
  /** Declared creator bps from the manifest (unchanged from input). */
  declaredCreatorBps: number;
  /** Declared treasury bps from the manifest (unchanged from input). */
  declaredTreasuryBps: number;
  /** Receipt tier the multiplier was applied for. */
  tier: ReceiptTier;
  /** Multiplier in bps (10000 = 100%, 8500 = 85%). */
  tierMultiplierBps: number;
  /** Effective creator bps after multiplier (= declaredCreatorBps * tierMultiplierBps / 10000). */
  creatorBps: number;
  /** Effective treasury bps (= 10000 - creatorBps). */
  treasuryBps: number;
  creatorNeuron: string;
  treasuryNeuron: string;
  creatorPassport?: string;
}

export function allocateFeeSplit(input: FeeSplitInput): FeeSplitAllocation {
  if (input.creatorBps + input.treasuryBps !== 10000) {
    throw new Error(
      `fee_split must sum to 10000 bps (got creator=${input.creatorBps} + treasury=${input.treasuryBps})`,
    );
  }
  if (input.creatorBps < 0 || input.treasuryBps < 0) {
    throw new Error('fee_split bps cannot be negative');
  }
  const total = BigInt(input.totalCostNeuron);
  if (total < 0n) throw new Error('totalCostNeuron cannot be negative');

  const tier: ReceiptTier = input.tier ?? 'TIER_2';
  const multiplierBps = TIER_MULTIPLIER_BPS[tier];

  // Effective creator bps after tier multiplier — round down to the nearest
  // bps to keep the bps-denominator clean (no fractional bps).
  const effectiveCreatorBps = Math.floor((input.creatorBps * multiplierBps) / 10000);
  const effectiveTreasuryBps = 10000 - effectiveCreatorBps;

  const creatorAlloc = (total * BigInt(effectiveCreatorBps)) / 10000n;
  const treasuryAlloc = total - creatorAlloc;

  return {
    declaredCreatorBps: input.creatorBps,
    declaredTreasuryBps: input.treasuryBps,
    tier,
    tierMultiplierBps: multiplierBps,
    creatorBps: effectiveCreatorBps,
    treasuryBps: effectiveTreasuryBps,
    creatorNeuron: creatorAlloc.toString(),
    treasuryNeuron: treasuryAlloc.toString(),
    creatorPassport: input.creatorPassport,
  };
}

/**
 * Aggregate creator earnings across a list of receipts. Used by
 * `ivaronix skill fee-split <id>` and Studio /skill/[id] to show
 * cumulative revenue.
 */
export function sumCreatorEarnings(
  receipts: { billing: { feeSplit?: { creatorNeuron?: string; creatorPassport?: string } | undefined } }[],
  creatorPassport?: string,
): { totalNeuron: string; receiptCount: number } {
  let total = 0n;
  let count = 0;
  for (const r of receipts) {
    const fs = r.billing.feeSplit;
    if (!fs?.creatorNeuron) continue;
    if (creatorPassport && fs.creatorPassport && fs.creatorPassport !== creatorPassport) continue;
    total += BigInt(fs.creatorNeuron);
    count += 1;
  }
  return { totalNeuron: total.toString(), receiptCount: count };
}
