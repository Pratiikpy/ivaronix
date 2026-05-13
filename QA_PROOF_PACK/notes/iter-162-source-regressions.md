# Iter-162 · Source-file regression suite (plan §1126)

## Plan §1126 claim

> 111 verify-*.ts files on disk · 92 automated · 19 require live server

## Live run (no Studio dev server, no live RPC)

| Filter | Scripts | Result |
|---|---:|---|
| `regressions:studio` (offline) | 75 | **all 75 PASS** |
| `regressions:cli` | 13 | **all 13 PASS** |
| `regressions:contracts` | 4 | **all 4 PASS** |
| **Total** | **92** | **92/92 PASS** |

The 19 remaining `verify-*.ts` are the `studio-live` filter (Playwright + dev server on :3300) and `live-chain` filter (Galileo RPC + funded wallet). Those run nightly on the cron + on `run-chain-smoke` PR label per `.github/workflows/chain-smoke.yml`.

## What this locks at write-time

Each `verify-*.ts` is a structural lock against a specific drift class. Sampling the most load-bearing ones:

| Regression | Locks against |
|---|---|
| `verify-no-ghost-surfaces` | HLD §1 surface table claiming `apps/<name>` rows that don't have a corresponding directory |
| `verify-no-sprint-natspec` | sprint-language (Day-N, Phase, K-N fix) compiling into permanent contract metadata |
| `verify-numbers-vs-deployments` | `numbers.json` contracts.addresses drifting from `contracts/deployments/testnet.json` |
| `verify-half-baked-closure-citations` | ✅ markers in HALF_BAKED.md without sha/sweep/date citation (silent re-open) |
| `verify-known-registries-vs-deployments` | `KNOWN_RECEIPT_REGISTRIES` in core drifting from deployments source-of-truth |
| `verify-tee-verification-method-honesty` | Receipts mislabeling TIER 2 inference as `router_flag`/`compute_sdk_process_response` (the canonical TIER 1 verificationMethod strings) |
| `verify-no-og-chain-deployments-import-in-studio` | Vercel build failure when Studio imports the cwd-walking `loadDeployments` instead of the bundled deployment map |
| `verify-a13-studio-v2-first` | Studio surfaces calling `getReceiptRegistry()` directly instead of the V2-first `unifiedX` helpers |
| `verify-form-schema-parity` | Studio forms redeclaring Zod enum values instead of importing `.options` from the schema package |
| `verify-known-registries-vs-deployments` | `KNOWN_RECEIPT_REGISTRIES` in core drifting from deployments source-of-truth |
| `verify-env-template-completeness` | Code reading an `IVARONIX_*` env var that neither `.env.example` nor `apps/studio/.env.production.template` documents |

## Why this matters for plan §1126

The "92 automated source-file regressions" is the most valuable single line in the test plan because:

1. They run on every commit via pre-commit hook (a subset · `.githooks/pre-commit`).
2. They run on every CI PR.
3. They run via `pnpm --filter qa-metamask-e2e run regressions` for any local sweep.
4. Each one represents a real drift class that was caught during development.

If even one of these 92 drifts back to a passing state when the underlying source has actually changed shape, the cron + the pre-commit + CI all catch it. This is the structural backbone that lets the cron run automated iterations 60+ times in a row without manual review burning out.

## Verdict

✅ **PASS** — Plan §1126 fully validated. 92 of 92 agent-runnable source-file regressions PASS on a clean run. Cumulative session plan-coverage now ~28 concrete sections proven.
