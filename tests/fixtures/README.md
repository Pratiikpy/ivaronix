# Test fixtures

Tracked receipt + manifest fixtures used by CI gates. NOT operator runtime data.

## anchored-receipts/

Representative anchored receipts for the `Receipt verify roundtrip` CI job
(`.github/workflows/ci.yml` · `receipt-roundtrip` job). Each fixture must be:

- schema-valid against `RECEIPTS_SPEC §1` + `packages/receipts/src/receiptSchema.ts`
- hash-valid (canonical hash matches `body` per `packages/receipts/src/canonical.ts`)
- signature-valid (recovers to `agent.ownerWallet`)
- anchored on a stable network (Galileo testnet today; Aristotle later)

Update protocol: when you replace a fixture, run `pnpm exec tsx
apps/cli/src/bin/ivaronix.ts receipt verify <fixture>` locally and confirm
status reaches `→ ANCHORED ✓` before committing.

| File | Network | Registry | id | Notes |
|---|---|---|---|---|
| `v1-anchored-id-8.json` | Galileo | ReceiptRegistry V1 | 8 | First-anchored receipt; tests V1-fallback read path |
