import type { BuiltinHook, HookEvent, HookEventKind, HookResult } from './types.js';
import { redactPii } from './builtin/redact-pii.js';
import { balanceCheck } from './builtin/balance-check.js';
import { logTokens } from './builtin/log-tokens.js';
import { printPassport } from './builtin/print-passport.js';

/** All built-in hooks the runtime knows about. Keep this list small + audited. */
export const BUILTIN_HOOKS: readonly BuiltinHook[] = [
  redactPii,
  balanceCheck,
  logTokens,
  printPassport,
] as const;

const BY_NAME = new Map<string, BuiltinHook>(BUILTIN_HOOKS.map((h) => [h.name, h]));

/** Look up a hook by name. Returns null when the name is not in the registry. */
export function getHook(name: string): BuiltinHook | null {
  return BY_NAME.get(name) ?? null;
}

/**
 * Resolve the list of hook names declared for an event in a skill manifest.
 * Returns the ordered array of valid (registered) hook implementations.
 * Unknown names are silently dropped — the loader should warn separately.
 */
export function resolveHooks(
  declared: readonly string[] | undefined,
  event: HookEventKind,
): BuiltinHook[] {
  const out: BuiltinHook[] = [];
  for (const name of declared ?? []) {
    const h = BY_NAME.get(name);
    if (h && h.subscribes.includes(event)) out.push(h);
  }
  return out;
}

/**
 * Aggregate hook result. Used to apply patches and bubble up logs/blocks.
 */
export interface AggregateHookResult {
  allow: boolean;
  blockingHook: string | null;
  reason: string | null;
  logs: string[];
  /** Final patched event (after all pre-* hooks have applied their patches in order). */
  patched: HookEvent;
}

/**
 * Run every hook subscribed to this event in declaration order. Patches are
 * applied to the working event between hooks so a later hook sees the
 * upstream-redacted text.
 */
export async function runHooks(
  hooks: readonly BuiltinHook[],
  event: HookEvent,
): Promise<AggregateHookResult> {
  let working: HookEvent = event;
  const logs: string[] = [];

  for (const h of hooks) {
    const r: HookResult = await h.run(working);
    if (r.logs?.length) logs.push(...r.logs);
    if (!r.allow) {
      return {
        allow: false,
        blockingHook: h.name,
        reason: r.reason ?? `hook "${h.name}" rejected`,
        logs,
        patched: working,
      };
    }
    if (r.patch && (working.kind === 'consensus.pre')) {
      working = { ...working, ...r.patch } as HookEvent;
    }
  }

  return { allow: true, blockingHook: null, reason: null, logs, patched: working };
}
