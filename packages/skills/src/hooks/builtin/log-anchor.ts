import type { BuiltinHook, HookEvent_PostAnchor } from '../types.js';

/**
 * log_anchor — emit the explorer URL for a freshly anchored receipt. Fires
 * on receipt.post-anchor; lets a skill manifest opt in to a one-line audit
 * trail of every chain anchor without writing custom code.
 */
export const logAnchor: BuiltinHook = {
  name: 'log_anchor',
  subscribes: ['receipt.post-anchor'],
  run(event) {
    if (event.kind !== 'receipt.post-anchor') return { allow: true };
    const e = event as HookEvent_PostAnchor;
    const explorer =
      e.network === 'mainnet'
        ? 'https://chainscan.0g.ai/tx/'
        : 'https://chainscan-galileo.0g.ai/tx/';
    return {
      allow: true,
      logs: [
        `log_anchor: ${e.receiptId} anchored at block ${e.blockNumber} · ${explorer}${e.txHash}`,
      ],
    };
  },
};
