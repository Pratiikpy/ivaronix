# `apps/cli` — agent guidance

> Per planning-003 §A.5.2. CLAUDE.md §1 names the CLI as the "gold standard" for shippable features: one command, one receipt URL, no hidden plumbing.

## Stack at a glance

- Node 20 + TypeScript binary, distributed via `apps/npx-cli` (the `npx ivaronix` shim) and the local `pnpm ivaronix` script.
- Commander.js for arg parsing. Each command lives at `src/commands/<name>.ts` with a single `Command` exported; `src/index.ts` registers them.
- Default tier resolution per `src/commands/doc.ts`: `--quick > --audit > --high-stakes > --consensus > skill default`.

## Hot files

- **Env loader:** `src/lib/env.ts` re-exports from `@ivaronix/runtime/env` so canonical / legacy alias chains stay consistent.
- **Receipt build path:** `src/commands/doc.ts`, `src/commands/doc-bulk.ts`, `src/commands/room.ts`, `src/commands/passport-consolidate.ts`, `src/commands/model.ts` — every callsite assembles a `routerTrace` literal and MUST include `rotations: []` (planning-003 §A.5.14).
- **V2-first chain reads:** `src/commands/receipt.ts:buildReadRegistries(network)` returns V2-first-V1-fallback for verify/show/list paths (planning-003 §A.1.2).
- **0G DA:** `src/commands/da.ts` (preflight / disperse / retrieve). Preflight points at the compose stack — see repo-root `docker-compose.yml`.

## Required env

- `IVARONIX_SIGNER_KEY` — receipt signing + on-chain writes.
- `IVARONIX_NETWORK=testnet|mainnet`.
- `IVARONIX_ROUTER_KEY` + `IVARONIX_ROUTER_URL` + `IVARONIX_ROUTER_PROVIDER` + `IVARONIX_WALLET_ADDRESS` — Router credentials (TIER 1). Legacy aliases (`ZG_API_SECRET`, `ZG_SERVICE_URL`, `OG_COMPUTE_PROVIDER`, `EVM_WALLET_ADDRESS`) still resolve.
- `NVIDIA_API_KEY` (optional) — TIER 2 fallback per `packages/og-router/src/nvidia.ts`.

Legacy aliases (`OG_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, `OG_NETWORK`) still resolve with a one-time deprecation warning. <!-- agents-alias:allow:legacy-summary-line -->.

## Test command

```bash
pnpm --filter "@ivaronix/cli" typecheck
pnpm --filter "@ivaronix/cli" test
# Live smoke (real Router + chain):
pnpm tsx scripts/smoke/og-toolkit-smoke.ts
```

## See also

- `apps/npx-cli/README.md` — public-facing one-liner doc.
- `.claude/rules/og-router.md` — Router credential rotation rules.
- CLAUDE.md §1 (no compromise) · §6 (TIER 1 vs TIER 2) · §11 (test topology).
