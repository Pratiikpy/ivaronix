# Ivaronix Goldsky Subgraph

> FINAL_BUILD_PLAN.md Block O · marketplace + payment + activity query layer.

## What this indexes

Six event sources across five contracts on 0G Galileo testnet:

| Contract | Event | Index entity |
|---|---|---|
| `SkillRegistryV2` (0xF051…2193) | `SkillPublished` | `Skill` |
| `SkillRegistryV2` | `SkillOwnershipTransferred` | `Skill` (owner update) |
| `SkillPricing` (0xc336…718F) | `PriceUpdated` | `Skill` (price update) |
| `SkillPricing` | `PriceUnset` | `Skill` (price unset) |
| `SkillRunPayment` (0x9eA5…0A5C) | `SkillRunPaid` | `Payment`, `CreatorStats`, `GlobalStats` |
| `SkillRunPayment` | `Withdrawn` | `Withdrawal`, `CreatorStats` |
| `SkillRunPayment` | `Refunded` | `Payment` (refunded flag) |
| `ReceiptRegistryV3` (0x7396…6257) | `ReceiptAnchored` | `Receipt`, `GlobalStats` |
| `MemoryAccessLogV2` (0x2e2a…55cF) | `MemoryAccessed` | `MemoryAccess` |

## Deploy

Goldsky CLI required. Sign up at `goldsky.com`, generate an API key:

```bash
cd subgraph
yarn install                          # subgraph deps (graph-cli + assemblyscript)
yarn codegen                          # generates types from ABIs + schema.graphql
yarn build                            # compiles WASM
yarn deploy:testnet                   # pushes to Goldsky testnet endpoint
# OR for production:
yarn deploy:mainnet                   # pushes to Goldsky mainnet endpoint
```

After deploy, Goldsky returns a query URL like:
`https://api.goldsky.com/api/public/<project-id>/subgraphs/ivaronix/<version>/gn`

Set this in Studio's env:

```bash
SUBGRAPH_URL=https://api.goldsky.com/api/public/<project-id>/subgraphs/ivaronix/<version>/gn
```

## Studio query layer

`apps/studio/src/lib/subgraph.ts` exports 4 functions Block I marketplace
pages consume:

- `skillsList(opts)` — paginated + sortable skill listings
- `skillReceipts(skillId, limit)` — latest receipts that ran a skill
- `creatorStats(creator)` — lifetime earnings, total runs, latest activity
- `recentActivity(limit)` — global activity feed across all event types

## Chain-fallback when subgraph unavailable

When `SUBGRAPH_URL` is unset, the same 4 functions fall back to direct-chain
reads via ethers:

- `skillsList` — iterates the 6 first-party skill slugs and reads `SkillPricing.getPricing()` + `SkillRegistryV2.ownerOf()` per skill
- `skillReceipts` — returns empty array (would require event-iteration across all receipts; too slow without an index)
- `creatorStats` — reads `creatorLifetimeEarned` + `creatorBalance` directly from chain
- `recentActivity` — returns empty array (subgraph-only)

This means the marketplace pages stay functional before Goldsky is deployed,
just with reduced data density. Adding `SUBGRAPH_URL` post-deploy is a
zero-code-change upgrade.

## Mainnet upgrade path

When mainnet contracts ship (Block K), update `subgraph.yaml` `network: 0g-mainnet`,
swap the contract addresses to the mainnet variants, redeploy. The schema +
mappings stay identical.

## Testing the subgraph locally

```bash
yarn test                             # if subgraph tests exist
```

Or query manually:

```bash
curl -X POST $SUBGRAPH_URL \
  -H "Content-Type: application/json" \
  -d '{ "query": "{ skills(first: 5) { id owner priceWei } }" }'
```
