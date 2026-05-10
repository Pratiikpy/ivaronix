/**
 * Track 3 settlement helper: given the skill's declared basis-point split
 * and the receipt's `totalCostNeuron`, compute the per-actor allocation as
 * BigInt-precise neuron strings.
 *
 * Two settlement policies:
 *
 *   **`flat`** (default; pre-A.4.4 behaviour): the declared creator
 *   share is conditioned on the TIER 1 vs TIER 2 multiplier only.
 *   TIER 1 = 100%, TIER 2 = 85%. Matches the `planning-002 W5` baseline.
 *
 *   **`efficiency-game`** (planning-003 §A.4.4): the creator share is
 *   conditioned on outcome:
 *     - TIER 1 first-attempt (attempts == 1)  → 95% multiplier
 *     - TIER 1 retry (attempts > 1)           → 85% multiplier
 *     - TIER 2 (any attempts)                 → 70% multiplier
 *     - failed (status == 'failed')           → 0% (treasury collects gas)
 *   Skills opt in via `og.creator.fee_split_policy: 'efficiency-game'`.
 *
 * Why BigInt: token costs can run to 1e15 neuron (≈0.001 OG); JS Number
 * loses precision at 2^53. We do the math in BigInt and serialise as
 * decimal strings, the same shape the rest of `billing.*Neuron` uses.
 *
 * The split is exact and deterministic. Rounding dust always lands in the
 * treasury, never created or destroyed.
 */

export type ReceiptTier = 'TIER_1' | 'TIER_2';

export type FeeSplitPolicy = 'flat' | 'efficiency-game';

export type RunOutcomeStatus = 'ok' | 'partial' | 'failed';

/**
 * Multiplier in basis points applied to the declared creator share for
 * the `flat` policy. The complement routes to treasury.
 */
export const TIER_MULTIPLIER_BPS: Record<ReceiptTier, number> = {
  TIER_1: 10000, // 100% — TEE-attested via 0G Compute (router_flag / compute_sdk_process_response)
  TIER_2: 8500,  // 85% — external-signed (NVIDIA NIM, OpenAI, etc.); 15% delta to treasury
};

/**
 * Efficiency-game multiplier table per planning-003 §A.4.4. Indexed by
 * `[tier][attempts == 1 ? 'first' : 'retry']`. Values are basis points
 * applied to the declared creator share. A `failed` outcome short-circuits
 * to 0 regardless of tier (handled in `allocateFeeSplit` directly).
 */
export const EFFICIENCY_GAME_MULTIPLIER_BPS: Record<ReceiptTier, { first: number; retry: number }> = {
  TIER_1: { first: 9500, retry: 8500 },
  TIER_2: { first: 7000, retry: 7000 },
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
  /**
   * Settlement policy (planning-003 §A.4.4). Default `'flat'` matches
   * the pre-A.4.4 behaviour exactly. `'efficiency-game'` conditions the
   * creator share on `outcome.attempts` + `outcome.status` per the
   * `EFFICIENCY_GAME_MULTIPLIER_BPS` table.
   */
  policy?: FeeSplitPolicy;
  /**
   * Run outcome — only consulted when `policy === 'efficiency-game'`.
   * Defaults to `{ attempts: 1, status: 'ok' }` so a caller that opts
   * into the policy without providing outcome details gets the
   * first-attempt rate.
   */
  outcome?: { attempts: number; status: RunOutcomeStatus };
}

export interface FeeSplitAllocation {
  /** Declared creator bps from the manifest (unchanged from input). */
  declaredCreatorBps: number;
  /** Declared treasury bps from the manifest (unchanged from input). */
  declaredTreasuryBps: number;
  /** Receipt tier the multiplier was applied for. */
  tier: ReceiptTier;
  /** Multiplier in bps (10000 = 100%, 8500 = 85%, etc.). */
  tierMultiplierBps: number;
  /** Effective creator bps after multiplier (= declaredCreatorBps * tierMultiplierBps / 10000). */
  creatorBps: number;
  /** Effective treasury bps (= 10000 - creatorBps). */
  treasuryBps: number;
  creatorNeuron: string;
  treasuryNeuron: string;
  creatorPassport?: string;
  /** Settlement policy that was applied. */
  policyApplied: FeeSplitPolicy;
  /** Outcome record (efficiency-game only). */
  outcomeApplied?: { attempts: number; status: RunOutcomeStatus };
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
  const policy: FeeSplitPolicy = input.policy ?? 'flat';
  const outcome = input.outcome ?? { attempts: 1, status: 'ok' as const };

  // Resolve the multiplier based on the policy.
  let multiplierBps: number;
  if (policy === 'efficiency-game') {
    if (outcome.status === 'failed') {
      // Failed runs route 100% to treasury; gas is still spent. Per
      // planning-003 §A.4.4 ("failed = no creator payout").
      multiplierBps = 0;
    } else {
      const slot = outcome.attempts <= 1 ? 'first' : 'retry';
      multiplierBps = EFFICIENCY_GAME_MULTIPLIER_BPS[tier][slot];
    }
  } else {
    multiplierBps = TIER_MULTIPLIER_BPS[tier];
  }

  // Effective creator bps after policy multiplier — round down to the
  // nearest bps to keep the bps-denominator clean (no fractional bps).
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
    policyApplied: policy,
    outcomeApplied: policy === 'efficiency-game' ? outcome : undefined,
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
