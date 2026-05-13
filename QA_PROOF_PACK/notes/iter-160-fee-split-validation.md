# Iter-160 · creator.fee_split schema validation (plan §815)

## What the contract says

Per `.claude/rules/skills.md`:

> `creator.fee_split` block required on every first-party skill manifest
> (planning-003 §A.3.8). Default 90/10 (creator 9000 bps / treasury
> 1000 bps); commoditised categories use 70/30 per
> `docs/MARKETPLACE_DESIGN.md`. Schema validates
> `creator + treasury === 10000`.

Per `packages/skills/src/manifest.ts:235-243`:

```ts
fee_split: z.object({
  creator: z.number().int().min(0).max(10000),
  treasury: z.number().int().min(0).max(10000),
}).refine((v) => v.creator + v.treasury === 10000, {
  message: 'creator + treasury must sum to 10000 basis points (100%)',
}).optional(),
```

## Regression added · `packages/skills/src/fee-split.test.ts`

12 tests covering positive + negative + edge cases:

| # | Input | Expected | Outcome |
|---|---|---|---|
| 1 | `9000 / 1000` | ACCEPT (canonical first-party default) | ✅ |
| 2 | `7000 / 3000` | ACCEPT (commoditised category) | ✅ |
| 3 | `10000 / 0` | ACCEPT (creator-only edge) | ✅ |
| 4 | `0 / 10000` | ACCEPT (treasury-only edge) | ✅ |
| 5 | `9000 / 2000` | REJECT (sum > 10000) | ✅ |
| 6 | `8000 / 1000` | REJECT (sum < 10000) | ✅ |
| 7 | `-100 / 10100` | REJECT (negative creator) | ✅ |
| 8 | `9000 / 11000` | REJECT (treasury > 10000) | ✅ |
| 9 | `{ creator: 9000 }` | REJECT (missing treasury) | ✅ |
| 10 | `{ treasury: 1000 }` | REJECT (missing creator) | ✅ |
| 11 | `9000.5 / 999.5` | REJECT (fractional bps) | ✅ |
| 12 | block absent | ACCEPT (backwards-compat for old manifests) | ✅ |

Test 5 additionally asserts the error message contains the canonical
"must sum to 10000 basis" string so future contributors can't silently
gut the constraint and replace it with `.optional()`.

## Threat model lock

The "future-someone-relaxes-the-sum-invariant" failure mode is the
most likely silent regression because:
1. The invariant is enforced by a Zod `.refine()` callback — easy to
   remove by accident during a schema refactor.
2. Track-3 marketplace economics depend on the sum being exactly
   10000 (basis points = 100%). A relaxed sum would let creator-only
   skills accidentally drain protocol fee or vice versa.
3. The CLI does NOT re-validate after parsing — it trusts the schema.

This regression locks the contract from the manifest-parse side. The
`forge test` suite covers the on-chain side (SkillRegistry rejects
non-canonical fee splits when published via `SkillRegistry.publish()`).

## Verdict

✅ **PASS** — Plan §815 fully satisfied with positive + negative
schema validation. 12 new regressions added; all 12 pass on first
run. Sandbox suite still green (9 top-level tests). Combined
`@ivaronix/skills` test count goes from 9 → 21.
