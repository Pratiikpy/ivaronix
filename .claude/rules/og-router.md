# 0G Router rules

> Auto-loads when working on `packages/og-router/**`. Path-scoped guidance per planning-003 §A.4.2.

## Stack

- OpenAI SDK (`openai` npm package) with custom `baseURL` pointing at `compute-network-X.integratenetwork.work/v1/proxy`. NOT a 0G-published endpoint — third-party Router infrastructure that fronts 0G Compute.
- Credentials: `RouterCredential` = `{ label, wallet, providerAddress, secretKey }`. Multi-key rotation via `Keyring`.

## Hard rules

- **Headers are SINGLE-USE.** Do NOT cache `getRequestHeaders(provider)` output. Fresh headers per request.
- **`processResponse(provider, chatID, usageJSON)` takes 3 args.** Third arg is `JSON.stringify(data.usage ?? {})` for fee caching, NOT response text.
- **Rate limit: 30 req/min.** Add 2s spacing between sequential calls when running batches.
- **JSON.parse from inference ALWAYS in try/catch.** 7B models malform JSON ~5-10% of the time. Pattern: try parse, on fail run a repair pass via the regex shapes in `packages/runtime/src/json-repair.ts`.

## Keyring failure-mode taxonomy

`Keyring.invalidate(label, reason)` distinguishes three failure modes:

- `'402'` — credential depleted (out of funds). Permanent invalidation. Rotate to next credential.
- `'auth'` — credential rejected (bad secret key, revoked). Permanent. Rotate.
- `'429'` — rate limited. TRANSIENT. Rotate this turn but the credential can be retried later. The label re-enters the rotation pool after a backoff.

Do NOT collapse `'429'` into permanent invalidation. The credential is still valid; rotating around it preserves capacity.

## Third-party endpoint warning

The Router endpoint (`compute-network-X.integratenetwork.work`) is NOT operated by 0G Foundation. It's a relay that fronts 0G Compute providers. Implications:
- The Router operator sees every request body before it reaches a 0G Compute provider.
- The Router can fail open (return cached responses) or fail closed (reject the call).
- Threat model: Router is trusted-but-curious. Operator-side disclosure is in scope; integrity violations (returning a different model's response) are not, because every TIER 1 receipt re-verifies via `broker.processResponse` against the actual 0G Compute provider.

## Threat-model JSDoc

Every file in `packages/og-router/` opens with the threat-model block per `docs/CRYPTO_NOTES.md` shape. `keyring.ts` has it; new files MUST too.

## Tests

`packages/og-router/test/` — vitest. Run via `pnpm --filter @ivaronix/og-router test`.

## File location reference

- Router client: `packages/og-router/src/index.ts`
- Multi-key rotation: `packages/og-router/src/keyring.ts`
- NVIDIA fallback (TIER 2): `packages/og-router/src/nvidia.ts`
