import type { BuiltinHook, HookEvent_PreConsensus } from '../types.js';

/**
 * balance_check — emit a warning log if the estimated tier cost is unusually high
 * relative to a $0.01-equivalent threshold. Does NOT block the run; it's meant to
 * surface "you're about to spend serious money" in an auditable way.
 *
 * The actual router-balance fetch happens upstream; this hook only operates on
 * the estimate produced by the consensus tier ladder.
 */

const HIGH_COST_OG = 0.05; // ~5¢ at typical 0G prices

export const balanceCheck: BuiltinHook = {
  name: 'balance_check',
  subscribes: ['consensus.pre'],
  run(event) {
    if (event.kind !== 'consensus.pre') return { allow: true };
    const e = event as HookEvent_PreConsensus;
    if (e.estimatedCostOg < HIGH_COST_OG) return { allow: true };
    return {
      allow: true,
      logs: [
        `balance_check: estimated cost ${e.estimatedCostOg.toFixed(4)} OG (tier=${e.tier}) is above ${HIGH_COST_OG} OG threshold`,
      ],
    };
  },
};
