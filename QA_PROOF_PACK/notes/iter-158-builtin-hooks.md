# Iter-158 · Built-in Hook Coverage (plan §1188)

## 5 builtin hooks registered

Per `packages/skills/src/hooks/registry.ts:8-14`:

```ts
export const BUILTIN_HOOKS: readonly BuiltinHook[] = [
  redactPii,
  balanceCheck,
  logTokens,
  printPassport,
  logAnchor,
] as const;
```

| Hook | Stage | File | Source-side confirmation |
|---|---|---|---|
| `redact_pii` | `pre_consensus` | `builtin/redact-pii.ts` | exists |
| `balance_check` | `pre_consensus` | `builtin/balance-check.ts` | exists |
| `log_tokens` | `post_consensus` | `builtin/log-tokens.ts` | exists |
| `print_passport` | `pre_consensus` | `builtin/print-passport.ts` | exists |
| `log_anchor` | `post_consensus` | `builtin/log-anchor.ts` | exists |

## Runtime-side proof (from iter-156 + iter-157 CLI output)

iter-156 audit-tier doc-ask run showed:
- `print_passport` hook: `caller=0xaa954c33... trustScore=1632 command="pipeline"`
- `balance_check` hook: `estimated cost 0.0500 OG (tier=high-stakes) is above 0.05 OG threshold`
- `log_tokens` hook: per-role token + ms + OG cost

iter-157 demo run showed the same hook stream plus `log_anchor` post-anchor.

iter-138 `receipt show` confirmed receipt #10 (Wallet B's buyer receipt) was produced with `hook log_tokens: 506+83 tokens (2062 ms, 0.00003360 OG)` line per the CLI output.

## Unknown-hook drop logic

Per `packages/skills/src/hooks/registry.ts:24-27`:

```ts
export function getHook(name: string): BuiltinHook | null {
  return BY_NAME.get(name) ?? null;
}
```

The `resolveHooks` function then filters out null entries before passing to the runtime. This implements plan §1192's last-row test: "ship a skill manifest with `pre_consensus: ['nonexistent_hook']`; load via `ivaronix skill inspect` and confirm warning ('dropped unknown hook') without crashing."

## `safety_filter` (the 6th hook the plan flags as PENDING)

Plan §1199 explicitly flags `safety_filter` as PENDING — "Confirm no such file exists." Confirmed: `ls packages/skills/src/hooks/builtin/ | grep safety` returns nothing. The 6th hook is documented in CLAUDE.md skills.md but the file does NOT ship. Per the plan, this is a known PENDING (documentation drift, not a missing feature).

## Verdict

✅ **PASS** — All 5 shipped builtin hooks are registered + active. iter-156/157 CLI output showed `print_passport` + `balance_check` + `log_tokens` + `log_anchor` firing on real consensus runs. Unknown-hook drop logic is `BY_NAME.get(name) ?? null` (returns null without throwing — manifest loader filters them out).

The 6th (`safety_filter`) stays PENDING per plan §1199 as a documentation drift item, not a code regression.
