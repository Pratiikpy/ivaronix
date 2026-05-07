import type { BuiltinHook, HookEvent_PostConsensus } from '../types.js';

/**
 * log_tokens — record token usage and convergence score after the router responds.
 * Lives in the hook layer so it's auditable + opt-out via manifest, not implicit.
 */
export const logTokens: BuiltinHook = {
  name: 'log_tokens',
  subscribes: ['consensus.post'],
  run(event) {
    if (event.kind !== 'consensus.post') return { allow: true };
    const e = event as HookEvent_PostConsensus;
    return {
      allow: true,
      logs: [
        `log_tokens: ${e.inputTokens}+${e.outputTokens} tokens (${e.ms} ms, ${e.costOg.toFixed(8)} OG)` +
          (e.convergenceScore !== null ? `, convergence=${e.convergenceScore}` : ''),
      ],
    };
  },
};
