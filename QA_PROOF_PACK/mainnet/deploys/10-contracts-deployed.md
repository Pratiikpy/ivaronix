# Phase 2 · 10 mainnet contracts deployed

> Per operator "Go · proceed to Phase 2" at 2026-05-15T02:44Z. All 10 V2/V3 contracts deployed on 0G Aristotle mainnet (chainId 16661) in ~6 minutes · all txs status=1 · all contracts verified non-zero bytecode on chain.

## Deploy results (chronological order)

| # | Contract | Address | Tx hash | Bytecode chars |
|---|---|---|---|---:|
| 1 | Erc7857Verifier | `0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c` | [0x4d6f1ecc...](https://chainscan.0g.ai/tx/0x4d6f1ecc320345a03795bf64108ed7f66b721cd5f43b5fd97f7892d865e6c67e) | 4,549 |
| 2 | ReceiptRegistryV3 | `0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297` | [0xf262939e...](https://chainscan.0g.ai/tx/0xf262939e34e7605287d533aa98a4bb82165b69aaf028f23ad6fdd1ab7d1a31e8) | 9,891 |
| 3 | AgentPassportINFTV2 | `0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad` | [0xda47f8e7...](https://chainscan.0g.ai/tx/0xda47f8e7ab73641bf09e5cc8b7deee6b049aa07840e47fa50906c7def410df50) | 21,589 |
| 4 | CapabilityRegistryV2 | `0x41fEad4b86DE042845D25Be71aae857E19a8089E` | [0x3054127e...](https://chainscan.0g.ai/tx/0x3054127eeed1dd4811ec019e5b0aeebfbbc2091bd2abdc78a18ceebe39f9a1d8) | 9,325 |
| 5 | MemoryAccessLogV2 | `0xA2c3420242aE2BdD7e0970B1DfB28b3055DC4E65` | [0x7440acdb...](https://chainscan.0g.ai/tx/0x7440acdbf4f9cb32778c10409db8d5c82b2b64beab926c82a11697f7992c45dc) | 1,945 |
| 6 | SkillRegistryV2 | `0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde` | [0x87fe827d...](https://chainscan.0g.ai/tx/0x87fe827db30c9af9879a263246b9a6c77a07f4d8c48c95ca95c9732e0f3274b1) | 7,967 |
| 7 | ReceiptRegistryV2 | `0x27a54F64F3A8578B39fE1E61dF7014813F325adf` | [0x391993e8...](https://chainscan.0g.ai/tx/0x391993e8d5e10f2a47b4c8e37ce32624f4e47b73845c9460afe5b6c4bdabfa3c) | 9,663 |
| 8 | SubscriptionEscrowV2 | `0x937cfE76dEdB25CCf6c7C56fF16F53270794311e` | [0xef3e1b9d...](https://chainscan.0g.ai/tx/0xef3e1b9d4d7d7be22215c9e521726385060fc6137ca5ba9f82e7f05417b3f705) | 16,019 |
| 9 | SkillPricing | `0x08d25653638c3ed40C3b82840fA20CAe9c94563E` | [0xb77cb8a6...](https://chainscan.0g.ai/tx/0xb77cb8a655bf1d1c924720d485e396a10040cba59610e87d1b4552bb5fb85ae2) | 3,495 |
| 10 | SkillRunPayment | `0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A` | [0x959f2641...](https://chainscan.0g.ai/tx/0x959f264118c8e946f0302699d3ab09c7128f042823480a68e5ef1eb74b380df0) | 7,693 |

## Spend summary

| Metric | Value |
|---|---|
| Starting balance | 25.864404500 OG |
| Ending balance | 25.771287945 OG |
| Total deploy spend | 0.093116555 OG |
| % of 16.38 OG autonomous cap | 0.57% |
| Operator's 25 OG deposit utilization | 0.37% |

All 10 deploys came in UNDER the bytecode-size estimate. Gas price held at 5 Gwei (priority 2 Gwei · matches operator's Galileo precedent).

## Stop-if-unexpected trigger check (per condition 2 from operator's go)

| Trigger | Threshold | Actual max | Status |
|---|---|---|---|
| Single tx cost > 2× estimate | 0.025 OG (largest contract AgentPassportINFTV2 estimate × 2) | ~0.0125 OG | ✓ within bound |
| Daily spend > 2× estimated daily | ~5 OG (2× of expected 2.5 OG/day) | 0.093 OG | ✓ well within |
| Cumulative > 16.38 OG cap | 16.38 OG | 0.093 OG (0.57%) | ✓ well within |
| Gas price > 50 Gwei | 50 Gwei | 5 Gwei | ✓ 10× safety margin |

NO triggers fired. Continuing per operator's Go.

## Deploy method notes

- **Forge `script`** rejects chain 16661 ("Chain 16661 not supported") even with `--legacy --skip-simulation`. WORKAROUND: use `forge create` directly (simpler · works for single-arg constructors).
- **Forge `create`** failed for SkillPricing + SkillRunPayment without `--gas-limit 2000000+`. Foundry's gas estimation seems to underestimate on unknown chains. WORKAROUND: pass explicit `--gas-limit 2000000` (SkillPricing) or `--gas-limit 5000000` (SkillRunPayment).
- **SkillRegistryV2** has bytes32[] + address[] constructor args. `forge create` CLI can't easily encode arrays. WORKAROUND: ethers TypeScript deployer at `scripts/deploy/mainnet-skill-registry-v2.ts`.

## Constructor wiring (canonical references)

- AgentPassportINFTV2 → Erc7857Verifier `0x9737...` + ReceiptRegistryV3 `0xCE35...`
- MemoryAccessLogV2 → CapabilityRegistryV2 `0x41fE...`
- SubscriptionEscrowV2 → ReceiptRegistryV2 `0x27a5...`
- SkillPricing → SkillRegistryV2 `0x080f...`
- SkillRunPayment → operator wallet (admin)
- SkillRegistryV2 → reserved-list: 6 first-party slug hashes pinned to deployer

## Verification on chain

Each address verified non-zero bytecode via `cast code <addr> --rpc-url https://evmrpc.0g.ai`. See `[FILE]/contracts/deployments/mainnet.json` for the canonical record.

## Outstanding Phase 2 items (queued for next iterations)

Per LOOP_DIRECTIVE Phase 2 work spec:
- [ ] Authorize operator wallet as recorder on AgentPassportINFTV2 (1 tx · ~0.001 OG)
- [ ] Configure pc.0g.ai adapter for `0GM-1.0` (requires app-sk-* mainnet credential)
- [ ] Update 5 skill manifests `acceptableModels[]` per MAINNET_PERFECT_PLAN §3 + republish to mainnet SkillRegistryV2 (5 tx · ~0.025 OG)
- [ ] Update apps/studio/src/lib/chain.ts to add mainnet network support
- [ ] `IVARONIX_NETWORK=mainnet` env on Vercel production
- [ ] `pnpm numbers:refresh --network mainnet`

## Phase 3 mainnet QA (per operator condition 4)

- [ ] `ivaronix doctor --network mainnet` → ALL GREEN
- [ ] `ivaronix demo --network mainnet` → 1 receipt FULLY VERIFIED ✓
- [ ] `ivaronix receipt verify <id> --tee-independent` → all 5 checks green
- [ ] `pc.0g.ai` route test reaches `0GM-1.0`
- [ ] 1 anchor per consensus tier × 4 (quick · standard · high-stakes · audit)
- [ ] 3-wallet marketplace flow on mainnet (creator + buyer + treasury)
- [ ] Stranger-machine verify: open `/r/<mainnet-id>` in incognito on different device

— agent · Phase 2 deploy · 2026-05-15T02:50Z chain time
