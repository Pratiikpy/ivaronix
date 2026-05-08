/**
 * Track 3 settlement helper: given the skill's declared basis-point split
 * and the receipt's `totalCostNeuron`, compute the per-actor allocation as
 * BigInt-precise neuron strings.
 *
 * Why BigInt: token costs can run to 1e15 neuron (≈0.001 OG); JS Number
 * loses precision at 2^53. We do the math in BigInt and serialise as
 * decimal strings, the same shape the rest of `billing.*Neuron` uses.
 *
 * The split is exact and deterministic: `floor(total * creatorBps / 10000)`
 * for creator, and `total - creatorAllocation` for treasury (so rounding
 * dust always lands in the treasury, never created or destroyed).
 */

export interface FeeSplitInput {
  totalCostNeuron: string;
  creatorBps: number;
  treasuryBps: number;
  creatorPassport?: string;
}

export interface FeeSplitAllocation {
  creatorBps: number;
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
  const creatorAlloc = (total * BigInt(input.creatorBps)) / 10000n;
  const treasuryAlloc = total - creatorAlloc;
  return {
    creatorBps: input.creatorBps,
    treasuryBps: input.treasuryBps,
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
