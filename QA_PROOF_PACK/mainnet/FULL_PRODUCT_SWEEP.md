# IVARONIX · MAINNET FULL PRODUCT SWEEP

> Per operator directive 2026-05-15: NO claim of mainnet launch-ready until every shipped Ivaronix feature is end-to-end-proven on mainnet (not just core smoke).
>
> Every row ends PASS / NOT-SHIPPED-ON-UI / ROADMAP / BLOCKED-WITH-REAL-REASON. Every PASS has artifact path · tx hash if chain-write · receipt id if receipt-producing · screenshot/video if UI · CLI log if CLI/MCP.

## Inventory (from code · not memory · 2026-05-15)

### 1. Mainnet contracts (10 · `contracts/deployments/mainnet.json`)

| Contract | Address | Role |
|---|---|---|
| AgentPassportINFTV2 | `0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad` | ERC-7857 agent passport (mint · recordReceipt · trustScore) |
| CapabilityRegistryV2 | `0x41fEad4b86DE042845D25Be71aae857E19a8089E` | Memory + skill capability grants |
| Erc7857Verifier | `0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c` | Attestor signature verification |
| MemoryAccessLogV2 | `0xA2c3420242aE2BdD7e0970B1DfB28b3055DC4E65` | On-chain memory access trail |
| ReceiptRegistryV2 | `0x27a54F64F3A8578B39fE1E61dF7014813F325adf` | Legacy registry · receipt-type slots 0-9 |
| ReceiptRegistryV3 | `0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297` | Canonical · receipt-type slots 0-12 |
| SkillRegistryV2 | `0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde` | Skill manifest registry + version history |
| SkillPricing | `0x08d25653638c3ed40C3b82840fA20CAe9c94563E` | Per-skill price + creator/treasury bps |
| SkillRunPayment | `0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A` | Payment binding · refundFailedRun · creator withdraw |
| SubscriptionEscrowV2 | `0x937cfE76dEdB25CCf6c7C56fF16F53270794311e` | Subscription-based skill access |

### 2. Receipt types (13 · `packages/core/src/types.ts`)

| Slot | Name | Status on mainnet |
|---:|---|---|
| 0 | doc_ask | ✅ PASS (receipts 0,3,4) |
| 1 | audit | (not yet on mainnet) |
| 2 | consensus | ✅ PASS via receipt 1 (3-role) + receipt 2 (5-role) |
| 3 | burn | ⏳ pending burner sweep this iteration |
| 4 | memory_access | (chain-side burner exercised · receipt-type slot specifically not anchored) |
| 5 | skill_exec | ✅ PASS via paySkillRun → SkillRunPaid event |
| 6 | code_change | NOT-SHIPPED-ON-UI · CLI-only via `ivaronix code` |
| 7 | passport_update | (recorded in passport-update path · not yet exercised on mainnet receipt-type 7) |
| 8 | swarm | ROADMAP · multi-agent swarms |
| 9 | subscription_skill_exec | ⏳ pending SubscriptionEscrowV2 sweep |
| 10 | doc_room_create (V3 ONLY) | ⏳ pending burner sweep this iteration |
| 11 | doc_room_read (V3 ONLY) | ⏳ pending burner sweep this iteration |
| 12 | memory_consolidation (V3 ONLY) | ⏳ pending burner sweep this iteration |

### 3. CLI commands (33 · `apps/cli/src/commands/`)

```
audit · chat · code · compute · da · daemon · debug · delegate · demo ·
doc · doc-bulk · doctor · export · indexer · init · memory · model ·
openclaw · passport · passport-consolidate · plan · pr · receipt · room ·
serve · session · skill · skill-registry-export · skill-schedule · stats ·
subscribe · swarm · update · watch
```

### 4. Studio routes (30 · `apps/studio/src/app/`)

```
/ · /0g · /admin/treasury · /agent/[handle] · /agents · /brand · /dashboard ·
/data-room/[id] · /delegate/[id] · /docs · /embed/r/[id] · /faq · /global ·
/learn · /legal · /marketplace · /marketplace/[skillId] · /marketplace/new ·
/marketplace/payouts · /memory · /onboard · /privacy · /r/[id] ·
/r/[id]/print · /skill/[id] · /skill/new · /skills · /terms · /test-wallet ·
/thesis · /verticals
```

### 5. MCP server tools

`apps/mcp-server/` — to be probed via stdio `tools/list`.

## Sweep status (live · updated as each row closes)

### Receipt-type / chain-write coverage on mainnet

| Feature | Receipt-type | Status | Receipt id / tx | Proof artifact |
|---|---|---|---|---|
| TIER 1 anchor · quick (0GM-1.0) | 0 | ✅ PASS | id 0 · `0xd9a48ded...` | smoke/01-first-tier1-receipt.json |
| TIER 1 anchor · standard 3-role | 2 | ✅ PASS | id 1 · `0xbc40fd41...` | smoke/02-standard-3role-receipt.json |
| TIER 1 anchor · high-stakes 5-role | 2 | ✅ PASS | id 2 · `0x280d4548...` | smoke/03-high-stakes-5role-receipt.json |
| Real 0G Storage upload | (any) | ✅ PASS | id 3 · storage tx `0x0c6a4cf0...` | v1.1/01-real-storage-anchor.md |
| Real broker.processResponse TEE | (any) | ✅ PASS | id 4 · processResponse=TRUE | v1.1/02-real-attestation-anchor.md |
| legal-citation-verifier web_fetch | (high-stakes) | ✅ PASS | id 6 · brief verdict do-not-file | v1.1/03-citation-verifier-anchor.md |
| 3-wallet marketplace fee-split | 5 (skill_exec) | ✅ PASS | 6 txs · 90/10 split | smoke/05-3-wallet-marketplace.md |
| 2-wallet memory grant/revoke | (CapabilityRegistryV2 events) | ✅ PASS | issueGrant + revokeGrant | smoke/07-2-wallet-flows.md |
| 2-wallet passport mint + ownerOf | (no receipt · ERC-7857 tx) | ✅ PASS | tokenId 1 · alice | smoke/07-2-wallet-flows.md |
| Tamper test (1-byte flip) | (read-only · proves invariant) | ✅ PASS | receipt 0 · 256-bit divergence | smoke/06-tamper-test.md |
| Cross-machine verifier | (read-only) | ✅ PASS | 3/3 root+agent match | smoke/04-cross-machine-verify.md |
| 5 legal skills published + priced | (no receipt-type · SkillRegistryV2 events) | ✅ PASS | 10 mainnet txs | skill-publishes/5-legal-skills.md |
| **recordReceipt trust accrual** | 7 (passport_update) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **Burn Mode end-to-end** | 3 (burn) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **doc_room_create** | 10 (V3 ONLY) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **doc_room_read** | 11 (V3 ONLY) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **memory_consolidation** | 12 (V3 ONLY) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **Delegate creation flow** | (no receipt-type · ERC-7857 delegation) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **SubscriptionEscrowV2 deposit/withdraw** | 9 (subscription_skill_exec) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **refundFailedRun** | (no receipt · SkillRunPayment.Refunded event) | ⏳ CHAIN-TIME-GATED | unlockAt ~10h away · cron-watcher wired | testnet/burner-gaps/refund-pending.json |
| **TIER 2 NVIDIA fallback** | 0 (doc_ask · verificationMethod=external-signed) | ⏳ TARGETED | (this iteration) | (this iteration) |
| **`audit` 6-role tier** | 1 (audit) | BLOCKED · llama-3.3-70b adversarial red-team-critic not in 0G mainnet catalog · §16.1 try-before-skip exhausted in Phase 3 closure | — | mainnet/PHASE_3_DONE.md |
| **0G DA batching** | (batch · not per-receipt) | ROADMAP · NON-BLOCKING per Operating Principle #10 | — | docs/0G_DA_INTEGRATION.md |

### Studio UI coverage on mainnet (post-Vercel cutover · commit c4c9c17)

| Route | HTTP | Visually inspected? | Real-MM smoke? | Status |
|---|---:|---|---|---|
| / | 200 | ✓ home-desktop.png + home-mobile.png | (no wallet flow on home) | ✅ PASS |
| /global | 200 | ✓ global-desktop.png + global-mobile.png | n/a (read-only) | ✅ PASS |
| /legal | 200 | ✓ legal-desktop.png + legal-mobile.png | n/a (info) | ✅ PASS |
| /marketplace | 200 | ✓ marketplace-desktop.png + mobile | ⏳ buy-flow real-MM pending | ⚠ VIEWED · ACTIVE-WALLET pending |
| /r/0 (pre-v1.1) | 200 | ✓ r-0-desktop.png + mobile | n/a (read-only) | ✅ PASS |
| /r/1 | 200 | ✓ r-1-desktop.png + mobile | n/a | ✅ PASS |
| /r/2 | 200 | ✓ r-2-desktop.png + mobile | n/a | ✅ PASS |
| /r/3 (v1.1-1 storage) | 200 | ✓ r-3-desktop.png + mobile | n/a | ✅ PASS |
| /r/4 (v1.1-2 TEE) | 200 | ✓ r-4-desktop.png + mobile · ANCHORED · TIER 1 · TEE · 0GM all green | n/a | ✅ PASS |
| /r/6 (v1.1-3 citation) | 200 | ✓ r-6-desktop.png + mobile | n/a | ✅ PASS |
| /onboard | n/c yet | ⏳ pending capture | ⏳ real-MM mint pending | (next) |
| /skills | n/c yet | ⏳ pending capture | n/a (read-only) | (next) |
| /agents | n/c yet | ⏳ pending capture | n/a (read-only) | (next) |
| /dashboard | n/c yet | ⏳ pending capture | ⏳ wallet-connect smoke | (next) |
| /memory | n/c yet | ⏳ pending capture | ⏳ real-MM grant/revoke | (next) |
| /skill/new | n/c yet | ⏳ pending capture | ⏳ real-MM publish | (next) |
| /admin/treasury | n/c yet | ⏳ pending capture | ⏳ real-MM withdraw | (next) |
| /data-room/[id] | n/c yet | ⏳ pending capture | ⏳ real-MM create+read | (next) |
| /delegate/[id] | n/c yet | ⏳ pending capture | ⏳ real-MM delegation | (next) |

### CLI sweep coverage on mainnet

| Command | Mainnet exercise | Status | Log |
|---|---|---|---|
| ivaronix doctor --network mainnet | ⏳ pending | (next) | — |
| ivaronix demo --network mainnet | ✅ PASS | id 0 anchored | (smoke/01-...) |
| ivaronix doc ask <file> | ⏳ pending direct CLI mainnet | (next) | — |
| ivaronix receipt show <id> | ⏳ pending | (next) | — |
| ivaronix receipt verify <id> --tee-independent | ✅ PASS | cross-machine 3/3 | smoke/04-... |
| ivaronix skill list | ⏳ pending | (next) | — |
| ivaronix skill publish | ✅ PASS via direct script | 5 skills | skill-publishes/... |
| ivaronix memory remember/recall/grant/revoke | ⏳ pending real CLI | (next) | — |
| ivaronix passport show | ⏳ pending | (next) | — |
| ivaronix marketplace ... | ⏳ pending | (next) | — |
| ivaronix da preflight | ROADMAP | DA non-blocking | docs/0G_DA_INTEGRATION.md |

---

(this doc continues to update as each row closes)
