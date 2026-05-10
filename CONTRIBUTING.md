# Contributing to Ivaronix

> What you need to read, the conventions you must follow, and how to ship a change.

## Read first

1. **`CLAUDE.md`** — operational ground rules. §1 (no compromise / production-ready option), §6 (TIER 1 vs TIER 2 honesty), §9 (writing voice / no AI slop), §10 (visual contract), §11 (end-to-end testing rule), §12 (completion discipline), §15 (ship X → discover X bookkeeping rule). Every PR is reviewed against these.
2. **`docs/QUALITY.md`** — the evergreen quality philosophy. Receipts > rhetoric · brutal honesty over flattering claims · CLI as gold standard.
3. **The path-scoped rule for the package you're editing** — `.claude/rules/<package>.md`. Auto-loads when editing files under that path; lists hard rules + threat model + test command.
4. **`<package>/AGENTS.md`** for package-specific stack + hot files + env. Six packages have these: `apps/studio`, `apps/cli`, `packages/og-router`, `packages/og-chain`, `contracts`, `seed-skills`.

## Commit conventions

- **Conventional commits.** `feat(scope): subject`, `fix(scope): subject`, `chore(scope): subject`, `docs(scope): subject`. Subject ≤70 chars.
- **No `Co-Authored-By` / `Author:` trailers.** Subject + body only. Per CLAUDE.md §1.
- **`Closes audit <ID>` trailer** when the commit closes a ledger item from `docs/HALF_BAKED.md`, `docs/planning-003.md`, or `docs/USER_TODO.md`. Multiple closures: one trailer per line. Queryable via `pnpm audit:list`.
- **No skip-hooks.** Don't pass `--no-verify`, `--no-gpg-sign`, or otherwise bypass commit signing / pre-commit hooks unless explicitly requested.
- **No sprint-language in production code.** No `Day-N`, `Phase A/B/C`, `K-N fix`, `MVP`, `killer demo`, `Track N headline`. Use capability statements + roadmap framing. Per CLAUDE.md §9. The `planning-003 §X` / `WT N` traceability links ARE allowed — those are audit-closure pointers.

## Before opening a PR

Run all of these and ensure they pass:

```bash
pnpm -r --filter "@ivaronix/*" run typecheck    # 24 packages must typecheck-clean
pnpm --filter @ivaronix/core test                # 17 JCS canonical-hash tests
pnpm --filter @ivaronix/consensus test           # 34 gates + policy + tier-shape tests
pnpm --filter @ivaronix/receipts test            # 16 builder + fee-split tests
pnpm --filter @ivaronix/skills test              # 9 manifest schema tests
pnpm --filter @ivaronix/memory test              # 14 encryption tests
pnpm --filter qa-metamask-e2e run regressions:studio    # 7 source-file regressions
pnpm --filter qa-metamask-e2e run regressions:cli       # 4 CLI regressions
pnpm --filter qa-metamask-e2e run regressions:contracts # 2 V2 contract regressions
pnpm docs:check                                  # numbers.json staleness gate
pnpm receipt-types:check                         # RECEIPTS_SPEC §1 vs source enum
```

CI gates on all of these via `.github/workflows/ci.yml`. If your local run passes, CI should pass too.

## Adding tests

- **Package unit tests** go in `packages/<name>/src/*.test.ts` and run via `tsx --test`. Same shape as `packages/consensus/src/policy.test.ts`.
- **Source-file regressions** go in `scripts/qa/metamask-e2e/verify-<id>-<slug>.ts` and get added to a filter in `run-source-regressions.ts`. They're plain TS scripts that exit 1 on failure, no test framework. Same shape as `verify-a48-memory-routes.ts`.
- **Contract tests** go in `contracts/test/<Contract>.t.sol` and run via `forge test`. Test private keys MUST be the deterministic hex-pattern fills (`0xA1A1_AAAA_…`), never real keys. Per `.claude/rules/contracts.md`.

## Solidity NatSpec discipline

- **`@notice` and `@dev` describe WHAT the contract does, not WHEN it was written.** NatSpec compiles into permanent contract metadata; sprint-language references fossilize. Per `.claude/rules/contracts.md`.
- **`Threat model:` block** required on every security-sensitive contract. Lists what the contract defends + what it does NOT defend + assumed attacker capabilities. Pattern: `CapabilityRegistry.sol`, `MemoryAccessLog.sol`, `Erc7857Verifier.sol`.
- **No upgradeability.** V2 = new contract at new address. V1 stays for legacy state; off-chain readers branch on `chainAnchor.registryAddress`. Per `docs/SOLIDITY_CHOICES.md`.

## Brand assets

The `brand/` directory ships under a separate license (see `BRAND.md`). The LICENSE's MIT grant covers code, not brand. Don't ship a fork at a confusable domain with the brand assets attached.

## Visual changes

- Open `brand/Ivaronix.html` in a headless browser, screenshot at 1440×900 + 375×812.
- Open the changed Studio route at the same viewports.
- Lay them side-by-side. If the Studio screenshot reads as "less designed" — colours weaker, type blander, radii sharper — fix the Studio render first; do not commit. Per CLAUDE.md §10.

## Refresh artefacts after changes

Some doc artefacts auto-render from source-of-truth files; refresh + commit the diff in the same PR:

```bash
pnpm receipt-types:render    # if you edited packages/core/src/types.ts RECEIPT_TYPES
pnpm docs:render             # if you bumped a value in docs/numbers.json
pnpm screenshots:refresh     # if you changed a Studio surface that's in the README grid
pnpm tour:refresh            # if you changed how the home → /r/<id> flow looks
```

The CI `docs:check` + `receipt-types:check` jobs gate on these being in sync.

## Questions

Start an issue. Tag with the relevant package label (`studio`, `cli`, `contracts`, etc.).
