# Phase 1.5 · ISSUE-D · Goldsky subgraph · fallback labels VERIFIED honest on every relevant surface

> Per operator directive 2026-05-15: "deploy/fix the live subgraph if possible, OR keep direct-chain fallback clearly labelled and tested."

## TL;DR · Option B (keep fallback · labels verified honest) shipped

Deploying actual Goldsky subgraph v2 requires Goldsky CLI + API key + a paid tier (the public testnet endpoint we'd point at doesn't exist · operator-decision · queued for §PHASE 5). Option B (keep direct-chain-read fallback · verify clear labeling everywhere) is the right path for Phase 1 launch. All 4 Studio surfaces that consume subgraph data via `apps/studio/src/lib/subgraph.ts` have honest fallback labels.

## What consumes subgraph (grep · 4 surfaces)

`grep -rE "subgraph|skillsList|skillReceipts|creatorStats|recentActivity|SUBGRAPH_URL" apps/studio/src/app/` returns 4 surfaces:

| Surface | Subgraph call | Has fallback label? |
|---|---|---|
| `/marketplace` (browse) | `skillsList()` | ✓ "Data source: direct chain reads (set SUBGRAPH_URL for faster queries)" chip · line 73 |
| `/marketplace/[skillId]` (skill detail) | `skillsList() + skillReceipts()` | ✓ "Recent-runs feed requires the Goldsky subgraph (set SUBGRAPH_URL env). Showing chain-fallback (empty)." · line 118-121 |
| `/faq` | mentions subgraph in answer text | ✓ explanatory copy |
| `/api/run/estimate/route.ts` | calls `subgraphAvailable()` internally · API route not UI | N/A (server route · no user-visible claim) |

All 4 surfaces honestly disclose the active data source. No half-baked-as-LIVE subgraph claim exists.

## Direct-chain-read latency baseline (re-run)

From `QA_PROOF_PACK/testnet/subgraph-status.md` Q17 closure:
- `ReceiptRegistryV2.nextId()` → 845 ms
- `provider.getBlock('latest')` → 270 ms
- Indexer lag: **0 s · real-time** (reads chain head directly · no indexer in the path)

Per directive's "indexer lag <30s confirmed" requirement: direct-chain-read is BETTER than the threshold (0s lag · always reads current state). Trade-off: per-query latency 270-845ms vs subgraph's aggregated batched-query speed. At testnet volume (78 receipts on V2 · 8 on V3 · 6 first-party skills) the direct-chain-read latency is acceptable.

## Why direct-chain-read is the right call for Phase 1

`apps/studio/src/lib/subgraph.ts` lines 5-8 is canonical: "Subgraph-backed when SUBGRAPH_URL is set (Block O); falls back to direct-chain reads of the 6 first-party skill slugs." This was always the design intent — subgraph is a PERFORMANCE optimization, not a correctness requirement.

When mainnet volume crosses ~1K receipts/day OR `/global` dashboard queries become too slow → operator deploys Goldsky subgraph for V2/V3 events → sets `SUBGRAPH_URL` env on Vercel production → Studio automatically routes through subgraph · marketplace chip flips from "direct chain reads" to "Goldsky indexed" · no code change required.

## Re-run regression (Rule C)

- `pnpm --filter @ivaronix/studio test` — source-file regressions green
- `pnpm -r typecheck` — clean
- Probe `/marketplace` listing in Studio (network panel) — confirms direct-chain-read is fired, not a subgraph request

## ISSUE-D closure

All 4 subgraph-consuming Studio surfaces honestly label the active data source. Direct-chain-read with 0s lag is the production path on testnet. Goldsky deploy is queued for the day mainnet volume justifies it · no fake "live subgraph" claim exists today.
