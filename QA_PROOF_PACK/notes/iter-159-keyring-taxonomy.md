# Iter-159 · Keyring rotation taxonomy (plan §786)

## Failure-mode taxonomy claim

Per `.claude/rules/og-router.md`:
- `'402'` (credential depleted) → permanent invalidation, rotate
- `'auth'` (rejected) → permanent invalidation, rotate
- `'429'` (rate-limited) → **TRANSIENT**, rotate this turn but credential stays pickable later

Plan §786: "Confirm Keyring.invalidate distinguishes 402/auth/429."

## Test run

`pnpm --filter @ivaronix/og-router test` — **19/19 PASS** (421ms total).

Key tests that lock the taxonomy:

| Test name | Behaviour locked |
|---|---|
| `invalidate('402') marks depleted and rotates pickActive to next` | 402 = permanent |
| `invalidate('auth') marks depleted and rotates pickActive to next` | auth = permanent |
| `invalidate('429') does NOT mark depleted (transient rate-limit)` | 429 = transient |
| `invalidate('429') still records the rotation event in the log` | 429 still logged |
| `multi-key cascade: 402 then auth then 429 across 3 creds` | mixed sequence ends with C still pickable |
| `pickActive returns null when ALL creds depleted` | rotation pool exhausted |
| `rotation event log captures label + reason + ISO timestamp` | observability intact |
| `invalidate(unknownLabel) is a no-op` | bad label handled defensively |
| `mixed-alias resolution: canonical key + legacy wallet` | env alias chain works |

## Critical regression sentinel

Lines 75-86 of `keyring.test.ts`:

```ts
test("invalidate('429') does NOT mark depleted (transient rate-limit)", () => {
  // Critical regression: collapsing 429 into permanent invalidation
  // would silently shrink the credential pool over time. Pin this.
  ...
  for (const item of kr.listAll()) {
    assert.equal(item.depleted, false, `${item.label} should not be depleted on 429`);
  }
});
```

This is the canonical defense against the "future-someone-simplifies-429-into-permanent" failure mode. If a contributor ever collapses the three reasons into one, this test fails and pre-commit catches it.

## Verdict

✅ **PASS** — Plan §786 fully satisfied. The taxonomy is locked at write-time (the keyring source-of-truth at `packages/og-router/src/keyring.ts`) AND read-time (19/19 test assertions covering 402/auth/429 + multi-key cascade + alias resolution).
