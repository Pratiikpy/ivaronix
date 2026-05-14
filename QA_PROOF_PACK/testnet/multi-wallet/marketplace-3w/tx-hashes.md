# Q1 · Marketplace 3-wallet flow · tx hashes

> Source: `QA_PROOF_PACK/multi-wallet/burner-3-wallet/proof-1778781630636.json` (latest run · 2026-05-14T18:00:30Z UTC chain time). Burner harness `scripts/qa/ui-test-plan/burner-3-wallet-flow.ts` drove the flow end-to-end with 3 wallets signing through their own keypairs.

## Wallet topology (3 distinct on-chain identities)

| Role | Address | Signs |
|---|---|---|
| Creator | `0xb54497fBf3FFa656649E66e02d8260f2584AdD7D` (alice burner) | `publishVersion`, `setPrice`, `withdrawCreator` |
| Buyer | `0x1cfF4eF4b114860F01C90126Db6AF7E71B50b713` (bob burner) | `paySkillRun` |
| Treasury / admin | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` (operator wallet) | funding txs · admin actions |

Burner keys are stored in the proof JSON so the operator can re-import each into MetaMask for the MM UI smoke pass.

## 6 distinct chainscan tx URLs (all status=1)

1. **fund alice (operator → alice)**  
   `0xaafc7a595944b34c4e7f6a216f8ceb27744fbdb38a7a93a7c5352e38fa1b8e7c`  
   https://chainscan-galileo.0g.ai/tx/0xaafc7a595944b34c4e7f6a216f8ceb27744fbdb38a7a93a7c5352e38fa1b8e7c
2. **fund bob (operator → bob)**  
   `0xe882975e1b692a261afd0b8701e832a75099f7df40a1b5b6b80db9ba37b2c71b`  
   https://chainscan-galileo.0g.ai/tx/0xe882975e1b692a261afd0b8701e832a75099f7df40a1b5b6b80db9ba37b2c71b
3. **publishVersion (alice → SkillRegistryV2)**  
   `0x82f3306abf71ba820e02bb2ddfd7e6a68bc96962c64eb0a9bea59c445425b84b`  
   https://chainscan-galileo.0g.ai/tx/0x82f3306abf71ba820e02bb2ddfd7e6a68bc96962c64eb0a9bea59c445425b84b
4. **setPrice (alice → SkillPricing)**  
   `0x1952d2c78abc8b6451f1e639ed9795d0de3712d912ae112c41bcb72aaecf8313`  
   https://chainscan-galileo.0g.ai/tx/0x1952d2c78abc8b6451f1e639ed9795d0de3712d912ae112c41bcb72aaecf8313
5. **paySkillRun (bob → SkillRunPayment · 0.005 OG value)**  
   `0xc15582452738bd9427ff801d4093f815e727215d4c68b1052d0c49345383829f`  
   https://chainscan-galileo.0g.ai/tx/0xc15582452738bd9427ff801d4093f815e727215d4c68b1052d0c49345383829f
6. **withdrawCreator (alice → SkillRunPayment)**  
   `0xf688fd9784d1b178a1b2d37c4c61fbacadcacdbd03bd0188745f33362565f14f`  
   https://chainscan-galileo.0g.ai/tx/0xf688fd9784d1b178a1b2d37c4c61fbacadcacdbd03bd0188745f33362565f14f

## Skill listed for the run

- slug: `burner-test-mp5smkdu`
- skillId: `0xb9276bc6ff6b348191d2a9df7424c64ece8a06ed193262e7acaa52320004c89d`
- price: 0.005 OG
- creator bps: 9000 (90%)
- treasury bps: 1000 (10%)

## Fee-split verification

- Creator received: 0.0045 OG (== expected creator share)
- Creator wallet balance after withdraw: 0.0209 OG (started at 0.02 OG funding · gained 0.0045 · spent ~0.0036 in gas for 3 txs)
- Creator unpaid balance after withdraw: 0.0 OG (full pull · contract creatorBalance zeroed for alice)
- bps observed: 9000 / 1000 (matches setPrice config) ✓

Treasury share (0.0005 OG per tx) accumulates in the shared `treasuryBalance` across all marketplace tests — that's why `treasuryReceived` in the proof JSON shows 0.0075 OG (the running total, not the per-tx delta).
