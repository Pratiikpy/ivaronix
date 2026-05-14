# Q17 · Goldsky subgraph v2 lag check

> Per LOOP_DIRECTIVE Q17 + Phase 1 EXIT GATE: "Query made · indexer lag <30s confirmed OR honest FALLBACK to direct-chain-read documented"

## Status

**FALLBACK · option (b) per directive · DIRECT-CHAIN-READ is the production path** · the Goldsky subgraph endpoint is intentionally not configured (`SUBGRAPH_URL` env unset) and the Studio code in `apps/studio/src/lib/subgraph.ts:5-8` explicitly documents the fallback strategy. Direct-chain-read latency is **0s lag (real-time · reads chain head)** — strictly better than the directive's <30s threshold. Q1 marketplace listing already discloses this honestly via the visible "Data source: direct chain reads (set SUBGRAPH_URL for faster queries)" chip captured at Q1 (`QA_PROOF_PACK/testnet/multi-wallet/marketplace-3w/studio-surface/desktop/01-marketplace-listing.png`).

## What the code does (from `apps/studio/src/lib/subgraph.ts`)

```ts
// FINAL_BUILD_PLAN.md Block O · Goldsky subgraph query layer.
//
// Marketplace pages + dashboard + public discovery query through this
// module. When SUBGRAPH_URL env is set, queries hit the deployed
// Goldsky subgraph for fast indexed reads. When unset, falls back to
// direct-chain reads via ethers — slower (~5s per query) but functional
// so the marketplace works pre-Goldsky-deploy and pre-paid-tier.

const SUBGRAPH_URL = process.env.SUBGRAPH_URL; // when set: Goldsky-deployed endpoint

async function querySubgraph<T>(query, variables = {}): Promise<T | null> {
  if (!SUBGRAPH_URL) return null;
  // ...
}
```

When `SUBGRAPH_URL` is null, every `subgraph.ts` function (`skillsList`, `skillReceipts`, `creatorStats`, `recentActivity`) falls through to a direct chain read via ethers. This is currently the production path on testnet.

## Direct-chain-read latency measured this fire

`scripts/qa/ui-test-plan/q17-subgraph-check.ts` reads testnet contract state directly:

| Operation | Latency | Notes |
|---|---|---|
| `ReceiptRegistryV2.nextId()` | 845 ms | returns `79` (matches receipt 78 from PRE-QUEUE-2) |
| `provider.getBlock('latest')` | 270 ms | block 33335699 · ts 1778791457 |
| Indexer lag | **0 s · real-time** | reads chain head directly · no indexer in the path |

Both latencies are well within the directive's <30s tolerance.

## Why the directive's "indexer lag <30s" is automatically satisfied

A subgraph indexer typically has 30-second-to-2-minute lag because it watches new blocks then re-processes events. Direct-chain-read has **0s lag** because it queries the CURRENT chain head on every request. The trade-off is per-query latency (~270-845ms for a `view` function) vs. a subgraph's aggregated batched-query speed.

For Ivaronix's testnet volume (78 receipts total · 6 first-party skills) the direct-chain-read latency is acceptable. When mainnet volume reaches >1K receipts/day, Goldsky subgraph deploy becomes the optimization path.

## What's publicly disclosed today

Captured at Q1 marketplace surface (`QA_PROOF_PACK/testnet/multi-wallet/marketplace-3w/studio-surface/desktop/01-marketplace-listing.png`):

> "Data source: **direct chain reads** (set SUBGRAPH_URL for faster queries)"

This chip is visible to every marketplace visitor — full transparency about which read path is active.

## 5 strategies tried before claiming FALLBACK is the right answer

| # | Strategy | Outcome |
|---|---|---|
| 1 | Check `.env` for `SUBGRAPH_URL` | Unset · only Goldsky API key reference present (Block O v2.0.0 deploy artifact) |
| 2 | Probe Goldsky public endpoint with a placeholder URL | HTTP 404 (no deployed subgraph at that path · expected) |
| 3 | Run direct-chain-read latency baseline | 270-845ms per query · 0s indexer lag · acceptable |
| 4 | Read `apps/studio/src/lib/subgraph.ts` for the explicit fallback strategy | Confirmed: "When unset, falls back to direct-chain reads via ethers — slower (~5s per query) but functional so the marketplace works pre-Goldsky-deploy and pre-paid-tier" |
| 5 | Verify Studio discloses the fallback to users | YES · visible "Data source: direct chain reads (set SUBGRAPH_URL for faster queries)" chip captured at Q1 marketplace listing |

## Why this matches the locked design intent

`apps/studio/src/lib/subgraph.ts:5-8` is the canonical statement: subgraph is a PERFORMANCE optimization, NOT a correctness requirement. The marketplace pages + dashboard + activity feed function correctly on direct-chain-read today. Goldsky-deploy is "when our volume actually needs paid-tier indexing" · same pattern as Q15 DA NON-BLOCKING decision.

## Q17 closure

`SUBGRAPH_URL` unset on testnet · direct-chain-read fallback active · 0s indexer lag (real-time chain head) · 270-845ms per-query latency · Studio honestly discloses the active read path · production volume on testnet doesn't yet benefit from indexer optimization. **Q17 testnet portion CLOSED with option (b) FALLBACK + measured baseline.**

Mainnet path forward: when receipt volume crosses ~1K/day OR `/global` dashboard queries become too slow → operator deploys Goldsky subgraph for V2/V3 events → sets `SUBGRAPH_URL` env on Vercel production → Studio automatically routes through subgraph · marketplace chip flips from "direct chain reads" to "Goldsky indexed" · no code change required.
