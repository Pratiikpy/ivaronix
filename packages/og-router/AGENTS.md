# `@ivaronix/og-router` — agent guidance

> Per planning-003 §A.5.2. Path-scoped specifics live in `.claude/rules/og-router.md` (auto-loaded when editing files here).

## Stack at a glance

- OpenAI SDK with custom `baseURL` pointing at `compute-network-X.integratenetwork.work/v1/proxy` — third-party Router infrastructure that fronts 0G Compute, NOT a 0G-published endpoint.
- Multi-credential `Keyring` with rotation on 402 (depleted) / 429 (rate-limited) / auth (rejected) failures.

## Hard rules (load-bearing — don't break)

- **Headers are SINGLE-USE.** Never cache `getRequestHeaders(provider)` output.
- **`processResponse(provider, chatID, usageJSON)` takes 3 args.** Third arg is `JSON.stringify(data.usage ?? {})`, NOT response text. Required for Router fee caching.
- **Rate limit: 30 req/min.** Add 2s spacing between sequential calls in batches.
- **JSON.parse from inference ALWAYS in try/catch.** 7B models malform JSON ~5-10%; repair via `packages/runtime/src/json-repair.ts`.

## Hot files

- **`src/keyring.ts`** — Keyring with rotation log. `drainRotations()` returns and clears the log; pipeline copies these onto `routerTrace.rotations` per planning-003 §A.5.14.
- **`src/index.ts`** — RouterClient with `chat()` + `chatRich()`.
- **`src/nvidia.ts`** — TIER 2 fallback when 0G Compute is unreachable (receipt records `verificationMethod: 'external-signed'`).

## Required env

- `IVARONIX_ROUTER_KEY` (legacy alias: `ZG_API_SECRET`) — Router API secret.
- `IVARONIX_ROUTER_URL` (legacy alias: `ZG_SERVICE_URL`) — `https://compute-network-1.integratenetwork.work/v1/proxy`.
- `IVARONIX_ROUTER_PROVIDER` (legacy alias: `OG_COMPUTE_PROVIDER`) — `0x...` provider address.
- `IVARONIX_WALLET_ADDRESS` (legacy alias: `EVM_WALLET_ADDRESS`) — paying wallet address.

## Test command

```bash
pnpm --filter @ivaronix/og-router typecheck
pnpm --filter @ivaronix/og-router test
# Live smoke (real Router credentials, costs ~0.0001 OG):
pnpm tsx scripts/smoke/og-toolkit-smoke.ts
```

## See also

- `.claude/rules/og-router.md` — full hard-rule list including failure-mode taxonomy and threat model.
- `docs/CRYPTO_NOTES.md` — broader cryptographic primitive choices.
