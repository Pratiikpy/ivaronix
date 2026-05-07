import type { BuiltinHook, HookEvent_SessionStart } from '../types.js';

/**
 * print_passport — surface caller's passport state at session start so receipts
 * can be reasoned about ("this run started with trustScore=4"). Read-only.
 */
export const printPassport: BuiltinHook = {
  name: 'print_passport',
  subscribes: ['session.start'],
  run(event) {
    if (event.kind !== 'session.start') return { allow: true };
    const e = event as HookEvent_SessionStart;
    if (!e.caller) return { allow: true, logs: ['print_passport: no wallet configured'] };
    return {
      allow: true,
      logs: [
        `print_passport: caller=${e.caller} trustScore=${e.trustScore} command="${e.command}"`,
      ],
    };
  },
};
