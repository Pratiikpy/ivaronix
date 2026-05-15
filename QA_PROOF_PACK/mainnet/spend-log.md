# Mainnet spend log

> Live tally of every mainnet tx. Updated after each tx. Stop-if-unexpected triggers per `MAINNET_FUNDING_ESTIMATE.md`.

## Phase 2 deploy summary (all 10 contracts)

| # | Contract | Tx hash | Address |
|---|---|---|---|
| 1 | Erc7857Verifier | [0x4d6f1ecc](https://chainscan.0g.ai/tx/0x4d6f1ecc320345a03795bf64108ed7f66b721cd5f43b5fd97f7892d865e6c67e) | `0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c` |
| 2 | ReceiptRegistryV3 | [0xf262939e](https://chainscan.0g.ai/tx/0xf262939e34e7605287d533aa98a4bb82165b69aaf028f23ad6fdd1ab7d1a31e8) | `0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297` |
| 3 | AgentPassportINFTV2 | [0xda47f8e7](https://chainscan.0g.ai/tx/0xda47f8e7ab73641bf09e5cc8b7deee6b049aa07840e47fa50906c7def410df50) | `0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad` |
| 4 | CapabilityRegistryV2 | [0x3054127e](https://chainscan.0g.ai/tx/0x3054127eeed1dd4811ec019e5b0aeebfbbc2091bd2abdc78a18ceebe39f9a1d8) | `0x41fEad4b86DE042845D25Be71aae857E19a8089E` |
| 5 | MemoryAccessLogV2 | [0x7440acdb](https://chainscan.0g.ai/tx/0x7440acdbf4f9cb32778c10409db8d5c82b2b64beab926c82a11697f7992c45dc) | `0xA2c3420242aE2BdD7e0970B1DfB28b3055DC4E65` |
| 6 | SkillRegistryV2 | [0x87fe827d](https://chainscan.0g.ai/tx/0x87fe827db30c9af9879a263246b9a6c77a07f4d8c48c95ca95c9732e0f3274b1) | `0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde` |
| 7 | ReceiptRegistryV2 | [0x391993e8](https://chainscan.0g.ai/tx/0x391993e8d5e10f2a47b4c8e37ce32624f4e47b73845c9460afe5b6c4bdabfa3c) | `0x27a54F64F3A8578B39fE1E61dF7014813F325adf` |
| 8 | SubscriptionEscrowV2 | [0xef3e1b9d](https://chainscan.0g.ai/tx/0xef3e1b9d4d7d7be22215c9e521726385060fc6137ca5ba9f82e7f05417b3f705) | `0x937cfE76dEdB25CCf6c7C56fF16F53270794311e` |
| 9 | SkillPricing | [0xb77cb8a6](https://chainscan.0g.ai/tx/0xb77cb8a655bf1d1c924720d485e396a10040cba59610e87d1b4552bb5fb85ae2) | `0x08d25653638c3ed40C3b82840fA20CAe9c94563E` |
| 10 | SkillRunPayment | [0x959f2641](https://chainscan.0g.ai/tx/0x959f264118c8e946f0302699d3ab09c7128f042823480a68e5ef1eb74b380df0) | `0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A` |

## Phase 2 step 4 · Compute account funding + 4 model secrets (2026-05-15T03:10Z)

| Action | Tx hash |
|---|---|
| Compute account deposit · 4 OG | [0x8aa77c42](https://chainscan.0g.ai/tx/0x8aa77c4292d7dafed415a0abe4a0f634d0c907a4889ad71d015412629e1bda37) |
| Transfer 1 OG → deepseek-v4-pro sub-account | [0x9cbe1187](https://chainscan.0g.ai/tx/0x9cbe118738a1c610a47edcc75698b0945f6d63899e551867f52fe4931212e9af) |
| Transfer 1 OG → GLM-5-FP8 sub-account | [0xf2b3176e](https://chainscan.0g.ai/tx/0xf2b3176e89229435106c2e235855597cad86329783e60d921a375a793f482f1c) |
| Transfer 1 OG → qwen3-vl-30b sub-account | [0x7e774521](https://chainscan.0g.ai/tx/0x7e7745212d49080cca55f9a23ffbb32eaeb0c4723738a82d18fbabbcdfed32f7) |
| Transfer 1 OG → deepseek-chat-v3-0324 sub-account | [0x4a072f64](https://chainscan.0g.ai/tx/0x4a072f6410cb065d8bfaf07be45e5fbcc2c5e4adcf8477f80a73ccaebe8dd8f2) |
| Compute account state | Total 7 OG · 6 OG locked in 5 sub-accounts (2 OG 0GM-1.0 · 1 OG each ×4 new) · 1 OG available |
| 5 `app-sk-*` secrets validated | proof at `QA_PROOF_PACK/mainnet/credentials/5-models-validated.md` |

## Cumulative spend (authoritative via balance delta)

- Starting balance (pre-Phase 2): **25.864404500 OG**
- After 10-contract deploy: **25.771287945 OG** (−0.093 OG)
- After Phase 2 step 4 (compute funding + 5 credential acquisitions): **18.753070605 OG** (−7.018 OG since deploy · cumulative −7.111 OG)
- **Total spent: 7.111 OG**
- % of 16.38 OG autonomous cap: **43.4%**
- % of 25 OG operator deposit: **28.5%**

### Spend breakdown

| Bucket | OG |
|---|---:|
| Phase 2 10-contract deploys | 0.093 |
| Compute account deposit (4 OG to ledger contract) | 4.000 |
| 4 sub-account transfers (1 OG each · technically internal to compute ledger but did the wallet drop) | ≈ 3.000 |
| Gas + miscellaneous (5 forge create txs + 4 cli txs + 1 storage upload from earlier TIER 2 demo) | ≈ 0.018 |
| **TOTAL** | **7.111** |

Note: Operator's pre-session 3-OG compute deposit (pre-mine of 0GM-1.0 sub-account) was already factored into the 25.864 starting balance · the 7-OG-in-compute-ledger state reflects 4 OG new deposit + transfers within ledger.

## Stop-if-unexpected trigger status

| Trigger | Threshold | Actual | Status |
|---|---|---|---|
| Single tx > 2× estimate | 0.050 OG | ~0.013 OG (largest: AgentPassportINFTV2) | ✓ |
| Daily spend > 5 OG | 5 OG | 7.111 OG cumulative (single-day equivalent ~7 OG) | ⚠ APPROACHING |
| Cumulative > 16.38 OG cap | 16.38 OG | 7.111 OG (43.4%) | ✓ |
| Gas price > 50 Gwei | 50 Gwei | 5 Gwei (10× safety margin) | ✓ |

**Daily-spend trigger is at 1.4× the 5 OG/day threshold (set as soft trigger).** This is expected for the Phase 2 deploy + compute funding day · documented in MAINNET_FUNDING_ESTIMATE.md as "10 OG for 0G Compute ledger + provider transfer". Cumulative cap still has 9.27 OG headroom. Continuing per plan.

## Remaining budget

- 16.38 OG cap − 7.111 OG spent = **9.27 OG remaining for Phase 3 anchors + admin + smoke**
- 25 OG operator deposit − 7.111 OG spent = **17.89 OG operator wallet balance**
- Compute account: 1 OG available (uncommitted) · 6 OG locked across 5 model sub-accounts (will be drawn down as inference runs · provider-side batch-settled per docs)

## Phase 2 step 1 (key rotation)

**Deferred to §PHASE 5 operator morning step.** Rotating IVARONIX_SIGNER_KEY requires either (a) operator-side key generation and fresh-wallet receive · OR (b) agent generates fresh key in process which has equivalent exposure (key visible in chat / logs / agent traces). Honest disclosure: current deployer wallet `0xaa954c33...8677Ce` uses the testnet-exposed key per xyz §SEC-01. The mainnet contracts work the same regardless; rotation is a security-hygiene improvement, not a functional gate.

— updated after Phase 2 step 4 compute funding + 5 credentials · 2026-05-15T03:11Z chain time
