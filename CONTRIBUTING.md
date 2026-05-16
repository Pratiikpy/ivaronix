# Contributing

Thanks for taking the time. This repo has a few non-obvious rules; reading
this in full before opening a PR will save us both a round trip.

## Before you write code

Read these first.

1. **`CLAUDE.md`** — the operational contract. It covers writing voice,
   TIER 1 vs TIER 2 honesty, the end-to-end testing rule, and the
   completion discipline ("do not stop" rule). Every PR is reviewed
   against it.
2. **`docs/QUALITY.md`** — the quality philosophy in one page. Receipts
   over rhetoric. Brutal honesty over flattering claims. CLI as the
   gold standard.
3. **The path-scoped rule for the package you're editing** —
   `.claude/rules/<package>.md`. Lists hard rules, threat model, and
   the test command for that package.
4. **The package's `AGENTS.md`** — stack, hot files, env vars. Lives
   in `apps/studio/`, `apps/cli/`, `packages/og-router/`,
   `packages/og-chain/`, `contracts/`, and `seed-skills/`.

## Commits

- **Conventional commits.** `feat(scope): subject`, `fix(scope): subject`,
  `chore(scope): subject`, `docs(scope): subject`. Subject ≤ 70 chars.
- **No `Co-Authored-By` or `Author:` trailers.** Subject and body only.
- **`Closes audit <ID>` trailer** when a commit closes a ledger item
  from `docs/HALF_BAKED.md` or `docs/USER_TODO.md`. One trailer per
  closure. Search with `pnpm audit:list`.
- **No skip-hooks.** Do not pass `--no-verify`, `--no-gpg-sign`, or
  otherwise bypass commit signing or pre-commit checks.
- **No sprint language in production code.** Write what the code does,
  not when it was written. `Day-N`, `Phase A/B/C`, `MVP`, and similar
  references fossilise into permanent metadata and date the codebase.
  Traceability links like `WT 31` or `planning-003 §A.5.X` that point
  at a specific audit closure are fine.

## Before opening a PR

Run these locally. If they pass on your machine, CI should pass too.

```bash
pnpm -r typecheck                                  # every workspace must be clean
pnpm --filter @ivaronix/core test                   # canonical-hash regressions
pnpm --filter @ivaronix/consensus test              # consensus gates + tiers
pnpm --filter @ivaronix/receipts test               # receipt builder + fee split
pnpm --filter @ivaronix/skills test                 # skill manifest schema
pnpm --filter @ivaronix/memory test                 # memory encryption
pnpm --filter qa-metamask-e2e run regressions:studio    # Studio source-file checks
pnpm --filter qa-metamask-e2e run regressions:cli       # CLI checks
pnpm --filter qa-metamask-e2e run regressions:contracts # contract V2 checks
pnpm docs:check                                    # numbers.json staleness gate
pnpm receipt-types:check                            # receipt-type enum vs spec
```

CI gates all of these via `.github/workflows/ci.yml`.

## Adding tests

- **Package unit tests** live in `packages/<name>/src/*.test.ts` and run
  via `tsx --test`. Look at `packages/consensus/src/policy.test.ts` for
  the shape.
- **Source-file regressions** live in `scripts/qa/metamask-e2e/verify-*.ts`
  and get added to a filter in `run-source-regressions.ts`. Plain TS
  scripts that exit 1 on failure — no test framework.
- **Contract tests** live in `contracts/test/<Contract>.t.sol` and run
  via `forge test`. Test private keys must be the deterministic
  hex-pattern fills (`0xA1A1_AAAA_...`), never real keys.

## Solidity NatSpec

NatSpec compiles into permanent contract metadata, so the rules are
strict:

- `@notice` and `@dev` describe what the contract does, not when it
  was written.
- Every security-sensitive contract opens with a `Threat model:` block
  listing what it defends, what it does not defend, and the assumed
  attacker capabilities. See `CapabilityRegistry.sol`,
  `MemoryAccessLog.sol`, and `Erc7857Verifier.sol` for the pattern.
- No upgradeability. V2 is a new contract at a new address; V1 stays
  live for legacy state. Off-chain readers branch on
  `chainAnchor.registryAddress`.

## Brand assets

`brand/` ships under a separate licence. The MIT grant in `LICENSE`
covers code; the brand assets do not. Do not ship a fork at a
confusable domain with the brand attached. Full rules in `BRAND.md`.

## Visual changes

For any change to a Studio route:

1. Open `brand/Ivaronix.html` in a headless browser and screenshot at
   1440×900 and 375×812.
2. Open the changed Studio route at the same viewports.
3. If the Studio screenshot reads as "less designed" — weaker colours,
   blander type, sharper radii — fix Studio first. Don't commit.

## Auto-rendered docs

Some files render from a source of truth. Refresh and commit the diff in
the same PR:

```bash
pnpm receipt-types:render    # after editing packages/core/src/types.ts RECEIPT_TYPES
pnpm docs:render             # after bumping a value in docs/numbers.json
pnpm screenshots:refresh     # after changing a Studio surface in the README grid
pnpm tour:refresh            # after changing the home → /r/<id> flow
```

CI gates `docs:check` and `receipt-types:check` on these being in sync.

## Questions

Open an issue. Tag with the relevant package label (`studio`, `cli`,
`contracts`, etc.).
