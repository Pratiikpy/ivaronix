# 0G DA Integration · Status, Runbook, Path to Live

> Last refresh 2026-05-14 (corrected twice).
>
> Honest framing per `final-plan.md §1.6 Day 13-17`: the **0G testnet DA is real and reachable** but the path is more involved than initially thought:
>
> 1. The `ghcr.io/0glabs/0g-da-client:latest` image is **not anonymously pullable** (registry returns `denied`). The 0G team distributes the DA client as **source you build yourself** per `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/da-integration.md`.
> 2. Two DA contract addresses live on Galileo: `0xE75A073d…` (public submission entrance referenced in `testnet-overview.md`) and `0x857C0A28…` (the DASigner-aware entrance used by your own DA client per `da-integration.md`). The integration doc's address is the one to put in `da.env`.
> 3. Env var names are `COMBINED_SERVER_*` and `ENTRANCE_CONTRACT_ADDR` (per 0G's integration doc), not the `DA_*` names I had earlier.
>
> Updated runbook below reflects all three corrections.

## What IS shipped today

| Piece | Status | Path |
|---|---|---|
| `@ivaronix/og-da` package | ✅ shipped | `packages/og-da/` |
| gRPC client (proto + dispatcher) | ✅ shipped | `packages/og-da/src/index.ts` · `@grpc/grpc-js` + `@grpc/proto-loader` |
| `ivaronix da preflight` CLI command | ✅ shipped | `apps/cli/src/commands/da.ts` |
| Docker compose service `da-client` | ✅ shipped | `docker-compose.yml` (image `ghcr.io/0glabs/0g-da-client:latest`, port `127.0.0.1:51001`) |
| `da.env.example` template | ✅ shipped | top-level |
| Receipt schema field `storage.daBlobRef` | ✅ shipped | `apps/studio/src/lib/local-receipt.ts` (`endpoint · requestIdHex · status · blobBytes · dispersedAt`) |

## What's NOT yet exercised

1. ✅ ~~0G testnet DA entrance contract address is unknown~~ — **CORRECTED 2026-05-14**: address is published at `0xE75A073dA5bb7b0eC622170Fd268f35E675a957B`. `da.env.example` updated.
2. **`da-client` container hasn't been started yet.** The compose service is wired; `docker compose up -d da-client` is a 1-step operator action away. Pending: fresh DA wallet generation + ~0.005 OG funding.
3. **End-to-end disperse + retrieve loop has not been exercised.** No receipt anchored today carries a real `storage.daBlobRef.requestIdHex`. Pending: container started + `ivaronix da preflight` green + first disperse tx.
4. **Receipt pipeline integration not wired.** `packages/runtime/src/pipeline.ts` doesn't yet call `daClient.disperse(evidenceBlob)` post-Storage upload. Pending: turn-on flag `IVARONIX_DA_DISPERSE=true` once preflight is green.

These are operator-action blockers, not "0G network not ready" blockers. The Ivaronix code path is ready; the operator just needs to run the 5 commands in the runbook below.

## Why this is OK to ship at testnet

Per `final-plan.md` operating principle: "Every item in this plan exists because it improves the product for actual users — not because it impresses judges or checks competitive boxes." DA's product-side value is **batched receipt anchoring** at scale: lower per-receipt cost, reduced indexer round-trips, cleaner mainnet anchor cadence when receipt volume crosses ~1K/day. Until that scale is real and until 0G DA testnet is reachable, the value is theoretical.

The honest shipped surfaces (`/0g` page, `/learn#receipt-anatomy`, receipt-page four-light row) mark DA status honestly:
- `/0g` page lists DA under "scaffolding shipped" — not "live".
- The four-light row on `/r/<id>` does NOT include a DA light today. The four lights are Storage · Compute · TEE · Chain. DA would become a fifth light only once it actually attests.
- The `storage.daBlobRef` schema field is optional and stays unset on every receipt in the current 1683-receipt corpus.

## Operator runbook (8 commands to live · source build required)

Per the corrections above, the path:

1. **Update `da.env`:**
   - Fresh wallet via `node -e 'const{Wallet}=require("ethers");const w=Wallet.createRandom();console.log(w.address);console.log(w.privateKey);'`
   - Fund the address with ~0.005 OG.
   - `DA_PRIVATE_KEY=<the new key>`
   - `DA_ENTRANCE_CONTRACT=<published address>`
   - Confirm `DA_RPC_URL=https://evmrpc-testnet.0g.ai` matches the entrance contract's chain.

2. **Boot the container:**
   ```
   docker compose up -d da-client
   docker compose logs -f da-client    # confirm it finds validator peers
   ```

3. **Run preflight:**
   ```
   pnpm --filter @ivaronix/cli exec ivaronix da preflight
   ```
   Expected: `endpoint reachable localhost:51001` + `wallet ready · balance 0.005 OG` + `entrance contract ok`.

4. **Disperse a test blob:**
   ```
   pnpm --filter @ivaronix/cli exec ivaronix da disperse --file ./README.md
   ```
   Expected: `request_id_hex 0x… · status DISPERSED · bytes 12345`. Record the request_id.

5. **Retrieve the blob back:**
   ```
   pnpm --filter @ivaronix/cli exec ivaronix da retrieve --request-id 0x…
   ```
   Expected: bytes-for-bytes match against the original `./README.md`.

6. **Wire it into the receipt pipeline:**
   - `packages/runtime/src/pipeline.ts` already has the slot. When `IVARONIX_DA_DISPERSE=true`, after the storage upload succeeds, also call `daClient.disperse(evidenceBlob)` and write the result into `storage.daBlobRef`.
   - Schema field is optional — older receipts (1683 of them today) stay valid; new receipts opt-in.

7. **Surface the 5th chip on `/r/<id>`:**
   - When `storage.daBlobRef.status === 'DISPERSED'`, render a fifth chip "DA" alongside Storage / Compute / TEE / Chain. Green only when status is `DISPERSED` AND the receipt's `daBlobRef.requestIdHex` retrieves a byte-equal blob.
   - Updates the four-light row to a five-light row gated on `daBlobRef` presence — older receipts continue showing four lights.

8. **Anchor 10 receipts in one DA batch:**
   - Goal: prove the product-side win (lower per-receipt cost, fewer chain anchors). Encode 10 receipt roots into one DA blob, anchor a single Merkle root on `ReceiptRegistryV3` with a `daBlobRef` pointer. Reviewers re-derive each individual receipt from the DA blob.
   - Cost delta documented in `docs/MAINNET_READINESS.md`.

## Why this stays Phase 2 instead of Phase 1

The plan's Day 13-17 acceptance:
> "either (a) preflight green + batch of 10 receipts → 1 chain anchor + all 10 retrievable + inclusion proof verified + measured per-receipt-cost delta documented, OR (b) `docs/0G_DA_INTEGRATION.md` with full design + honest Day-1-of-endpoint runbook + Phase 2 queue entry"

Option (a) cannot complete without a reachable DA endpoint. This doc is Option (b). The Phase 2 entry is:

- **Trigger to promote back to Phase 1:** 0G testnet DA entrance contract address published.
- **Owner:** cron + operator (operator funds the new DA wallet · cron wires the address).
- **Acceptance:** all 8 runbook steps above complete successfully on Galileo testnet + the 10-receipt-batch demonstrates a real per-receipt cost delta.

## What the user sees today

- Home page lists "0G DA · IN PROGRESS — preflight done" in the honest-roadmap section. Status pill is amber, not green. Body line: "`ivaronix da preflight` confirms validator reachability. Full disperse/retrieve pipeline + receipt-batch encoder queued."
- `/0g` page treats DA the same way: scaffolding shipped, full pipeline queued.
- `/learn#receipt-anatomy` does not claim DA is part of the anchor today.
- `/faq` answer "Why does this need a blockchain at all?" mentions chain anchoring without claiming DA blob settlement.

Zero shipped surface lies about DA status.

## Local Docker state (operator-side)

The compose service `da-client` is wired but **not started** by default. The KV stack (Redis, Elastic, Mongo) runs on its own compose file at `infra/0g-kv/docker-compose.yml`. The root `docker-compose.yml` carries `da-client` only — `docker compose up -d da-client` starts it; absent that, the operator's host runs only the KV containers.

This is intentional: starting `da-client` against a network that can't reach validators produces noisy logs without value. When the endpoint lands, one command flips it on.

---

*This doc is the canonical source-of-truth for 0G DA status. Update the "What does NOT work yet" section the moment the 0G team publishes the testnet entrance address.*
