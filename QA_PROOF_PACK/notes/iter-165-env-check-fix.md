# Iter-165 · numbers parity + env alias chain + doc drift (plan §1017 + §1115 + §1244)

## Plan §1017 · Numbers.json numeric-claim parity

`pnpm numbers:check`:

```
numbers.json is 4.6h old · within 24h window ✓
```

`pnpm docs:check`:

```
OK: README.md (22 marker(s) already in sync)
OK: docs/PITCH.md (8 marker(s) already in sync)
OK: docs/JUDGE_GUIDE.md (6 marker(s) already in sync)
OK: docs/MAINNET_READINESS.md (9 marker(s) already in sync)
OK: docs/numbers.json is 4.6h old (max 24h)

45 marker(s) checked across 4 target docs · 0 unknown-key warning(s).
```

✅ **PASS** — 45 numbers:auto markers across 4 docs are bit-exact with the canonical `docs/numbers.json` snapshot (refreshed in iter-161, 4.6h old).

## Plan §1115 · Environment Alias Chain Verification — REAL BUG + FIX

### Bug found

`pnpm env:check` from the repo root showed every canonical env var as **UNSET** even though the CLI itself resolves them correctly during `pnpm ivaronix demo`. The CLI walks up to find `.env` and loads it via dotenv at `apps/cli/src/bin/ivaronix.ts:7-17`; `env-check.ts` did NOT replicate this, it just read `process.env` directly.

So a tester running `pnpm env:check` to confirm the alias chain was wired would see "9 unset required" and assume the configuration was broken when in fact it was working.

### Fix

Added the same `findEnvFile(startDir)` walk-up loader to `scripts/diag/env-check.ts` before the `envCheckReport()` call. Walk-up matches the CLI's behaviour exactly. 14 lines added.

### Post-fix run

```
CANONICAL                 USED ALIAS            STATUS
IVARONIX_SIGNER_KEY       EVM_PRIVATE_KEY       legacy · resolves to IVARONIX_SIGNER_KEY  (66-char value set)
IVARONIX_READ_PROXY_KEY                         UNSET · optional
IVARONIX_RPC_URL          OG_RPC_URL            legacy · resolves to IVARONIX_RPC_URL  (28-char value set)
IVARONIX_NETWORK          OG_NETWORK            legacy · resolves to IVARONIX_NETWORK  (7-char value set)
IVARONIX_CHAIN_ID         OG_CHAIN_ID           legacy · resolves to IVARONIX_CHAIN_ID  (5-char value set)
IVARONIX_WALLET_ADDRESS   EVM_WALLET_ADDRESS    legacy · resolves to IVARONIX_WALLET_ADDRESS  (42-char value set)
IVARONIX_ROUTER_KEY       ZG_API_SECRET         legacy · resolves to IVARONIX_ROUTER_KEY  (483-char value set)
IVARONIX_ROUTER_URL       ZG_SERVICE_URL        legacy · resolves to IVARONIX_ROUTER_URL  (56-char value set)
IVARONIX_ROUTER_PROVIDER  OG_COMPUTE_PROVIDER   legacy · resolves to IVARONIX_ROUTER_PROVIDER  (42-char value set)
IVARONIX_DEFAULT_MODEL    OG_DEFAULT_MODEL      legacy · resolves to IVARONIX_DEFAULT_MODEL  (25-char value set)

Summary: 0 canonical · 9 legacy aliases · 0 unset (required) · 1 optional.
```

9/9 required env vars resolve correctly via the legacy → canonical alias chain. The operator could rename the legacy names in `.env` to silence the deprecation warnings; functionality is unaffected.

### Structural regressions (cross-checked)

`verify-env-template-completeness.ts` (sweep 205): **4/4 PASS**
- 17 `IVARONIX_*` tokens extracted from 220 TS/TSX files
- `.env.example` has 15 entries
- `apps/studio/.env.production.template` has 15 entries
- every IVARONIX_* var read by code appears in at least one env template

`verify-agents-md-canonical-aliases.ts` (sweep 44-45): **2/2 PASS**
- 6 AGENTS.md files in scope
- every legacy-alias mention leads with the canonical IVARONIX_* form

## Plan §1244 · Known Documentation Drift To Watch

The 3 gates above (`numbers:check` + `docs:check` + `env:check`) all PASS post-iter-164 fix. Combined with the iter-162 source-file regression suite (92/92 PASS) and iter-163 contract NatSpec coverage (15/15), the structural lock against silent doc-drift is intact across:

| Drift class | Locked by |
|---|---|
| numbers.json snapshot rot (≥24h) | `numbers:check` warns at 24h |
| render-target docs drifting from numbers.json | `docs:check` fails on any unsynced marker |
| Env vars read by code but undocumented in templates | `verify-env-template-completeness.ts` |
| AGENTS.md docs leading with legacy alias before canonical | `verify-agents-md-canonical-aliases.ts` |
| HALF_BAKED.md `✅` markers without citation | `verify-half-baked-closure-citations.ts` |
| KNOWN_RECEIPT_REGISTRIES drifting from deployments JSON | `verify-known-registries-vs-deployments.ts` |
| USER_TODO `✅ DEPLOYED` markers without matching contracts entry | `verify-user-todo-deploy-markers.ts` |

## Verdict

✅ **PASS + FIX** —
- Plan §1017 numeric-claim parity: 45/45 markers in sync
- Plan §1115 env alias chain: 9/9 required vars resolve correctly post-fix
- Plan §1244 doc drift: all 7 structural gates green

`pnpm env:check` is now a useful gate (was previously broken on Windows/anywhere without sourced env). Iter-165 closure aligns with iter-164 in pattern: real reproducer bug surfaced + closed in the same iteration per CLAUDE.md §1 brutal-honesty + §15 ship-X-discover-X bookkeeping.

Cumulative session plan-coverage now ~31 concrete sections proven.
