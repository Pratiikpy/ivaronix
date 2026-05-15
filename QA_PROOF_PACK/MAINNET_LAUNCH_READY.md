# IVARONIX · MAINNET LAUNCH READY (autonomous portion · operator §PHASE 5 morning step queued)

> Per LOOP_DIRECTIVE MAINNET LAUNCH CLAIM GATE — all autonomous checkboxes green or honestly disclosed. The agent does NOT post a public-facing "we launched" claim · that's the operator's call upon reading this file + spot-checking artifacts.

## Timestamp

2026-05-15 (chain time post-Phase-3 closure)

## Key on-chain artifacts (spot-check these)

| Item | Value | Verify command |
|---|---|---|
| Mainnet RPC | `https://evmrpc.0g.ai` | `cast chain-id --rpc-url https://evmrpc.0g.ai` → 16661 |
| Operator wallet | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` | `cast balance ${WALLET} --rpc-url ${RPC}` |
| 10 contracts deployed | `contracts/deployments/mainnet.json` | `cast code <addr>` returns non-zero for each |
| 3 receipts anchored | V3 ids 0/1/2 · `ReceiptRegistryV3 0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297` | `cast call <V3> "nextId()(uint256)" --rpc-url ${RPC}` → 3 |
| 5 legal skills published | SkillRegistryV2 `0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde` | `cast call <V2> "latestVersion(bytes32)" <skillId>` |
| 1 passport minted | AgentPassportINFTV2 tokenId 1 | `cast call 0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad "balanceOf(address)" 0x7581a5ef2c1C563a1b071B3472715635B9C15699` → 1 |

## All autonomous checkboxes (per LOOP_DIRECTIVE MAINNET LAUNCH CLAIM GATE)

| Checkbox | Status | Proof |
|---|---|---|
| ✓ refundFailedRun burner-gap CLOSED | ✓ phase-1 done · phase-2 chain-time-gated (14h 49m remaining) | `testnet/burner-gaps/refundFailedRun.md` |
| ✓ recordReceipt burner-gap CLOSED | ✓ DONE | `testnet/burner-gaps/recordReceipt.md` |
| ✓ Phase 1 EXIT GATE fully green · PHASE_1_DONE.md written | ✓ DONE | `PHASE_1_DONE.md` |
| ✓ Goldsky subgraph status documented | ✓ FALLBACK · direct-chain-read | `testnet/subgraph-status.md` + `phase-1.5/ISSUE-D-subgraph-fallback-labeled.md` |
| ✓ KV server status documented | ✓ infra fixed (EverMemOS gateway live on :1995 local) + honest "CLI today" framing on `/memory` | `testnet/kv-status.md` + `phase-1.5/ISSUE-C-kv-fix.md` |
| ✓ MAINNET_FUNDING_ESTIMATE.md produced | ✓ DONE · 16.38 OG hard cap from forge bytecode size | `mainnet/MAINNET_FUNDING_ESTIMATE.md` |
| ✓ Phase 2 EXIT GATE: 10 contracts deployed | ✓ 10/10 · all verified non-zero bytecode | `mainnet/deploys/10-contracts-deployed.md` + `contracts/deployments/mainnet.json` |
| ✓ Phase 2 EXIT GATE: 5 skill manifests republished | ✓ 5/5 published + priced · 10 mainnet txs | `mainnet/skill-publishes/5-legal-skills.md` |
| ✓ Phase 2 EXIT GATE: pc.0g.ai route confirmed reaches 0GM-1.0 | ✓ + 4 more model providers · 5/5 credentials validated via raw curl | `mainnet/credentials/5-models-validated.md` |
| ⚠ Phase 3 MAINNET SMOKE COMPLETENESS | ✓ 6/7 chain-side items · UI render gated on Vercel cutover · §PHASE 5 morning step | `mainnet/PHASE_3_DONE.md` |
| ⚠ Phase 4 draft writing assembled · §36 claims audit | NOT STARTED · operator's morning step (or follow-up) | TBD |
| ✓ Spend log ≤ funding estimate cap | ✓ 9.44 OG spent · 57.6% of 16.38 cap · 6.94 OG headroom | `mainnet/spend-log.md` |

## Operator-action queue (§PHASE 5 morning step)

| Item | Why agent didn't do it | Operator action |
|---|---|---|
| Hetzner CX31 provision | Requires SSH access + DNS | provision · spin up production Docker · ~30 min |
| Cloudflare WAF + DDoS | Requires CF account · DNS | flip CF in front of Vercel + Hetzner |
| Production crons (wallet · container health) | Requires production server | cron on Hetzner box |
| Studio Vercel `IVARONIX_NETWORK=mainnet` env | Requires operator's Vercel auth | flip env + redeploy · ~5 min |
| Tweet from Ivaronix handle | requires operator authorization | "First receipt anchored against 0GM-1.0 via 0G Compute. Verify in 10 seconds: ivaronix.com/r/0" |
| Grant submission | requires operator authorization | grant portal submission |
| Key rotation per xyz §SEC-01 | Requires operator to generate fresh key + receive transferred OG | rotate before Phase 5 production smoke |
| PRE-QUEUE-1 refund tx (chain-time-gated) | 24h `REFUND_TIMELOCK` constant in contract | autonomous cron-watcher fires when chain crosses unlockAt (~14h 49m remaining at this writing) |

## What "mainnet launch ready" honestly means today

**The system works end-to-end at the cryptographic + chain layer**:
- 3 mainnet receipts are recompute-able from canonical JSON · keccak256 matches on-chain receiptRoot byte-for-byte
- Tampering produces complete hash divergence (256-bit avalanche)
- 3-wallet fee-split paid + withdrawn · 90/10 split observed
- 2-wallet memory grant/revoke cycle clean (state flips properly)
- 5 legal skills published + priced · listable from marketplace UI after Vercel cutover
- 5 model providers funded + invocable · 0G's flagship 0GM-1.0 confirmed responsive
- 232 Foundry tests pass under `via_ir=true` mainnet profile (same code as deployed)

**Honest open items for v1.1**:
- AI output quality: 0GM-1.0 thinking-mode default → render `reasoning_content` in UI OR bump max_tokens (only 1/3 receipts produce final-answer content today; 2/3 produce thinking-mode reasoning)
- 0G Storage upload integration (currently placeholder storageRoot)
- `broker.processResponse` TEE attestation integration (currently placeholder attestationHash)
- legal-citation-verifier runtime web_fetch enforcement
- Audit tier (term-sheet-risk-scanner falls back to high-stakes 5-role)

**Goldsky subgraph + 0G DA**: NON-BLOCKING per operating principle #10. Direct-chain-read is the production read path until volume justifies subgraph deploy.

## Recommended operator next steps (in order)

1. **Spot-check** 3-5 artifact paths from this file
2. **Decide** whether AI quality (1/3 USABLE A · 2/3 PARTIALLY-USABLE) is launch-ready for v1 OR if 0GM-1.0 thinking-mode fix lands first
3. **Provision Hetzner** + flip Studio Vercel to mainnet
4. **Authorize tweet** + grant submission if everything looks good

## Receipt URLs for stranger replay (judge demo path)

```
Receipt 0 · quick-tier (0GM-1.0):
  Tx: https://chainscan.0g.ai/tx/0xd9a48dedd80b88f166da56988c6b3923925476491eb6805dd6e87e0d351d4482
  Read body: QA_PROOF_PACK/mainnet/smoke/01-first-tier1-receipt.json

Receipt 1 · standard 3-role (0GM-1.0 + deepseek-v4-pro NDA triage):
  Tx: https://chainscan.0g.ai/tx/0xbc40fd41c0ff4af78af91dcd598d3618b9c8bd7995069143e58d46c1886e8743
  Read body: QA_PROOF_PACK/mainnet/smoke/02-standard-3role-receipt.json

Receipt 2 · high-stakes 5-role (all 5 §3 models · private-doc-review):
  Tx: https://chainscan.0g.ai/tx/0x280d45489569a5ee5c927f064e26465857e54f0b8dd35d09678dd8938c07ac29
  Read body: QA_PROOF_PACK/mainnet/smoke/03-high-stakes-5role-receipt.json
```

## Spend summary

| Phase | OG spent |
|---|---:|
| Phase 2 deploy (10 contracts) | 0.093 |
| Phase 2 step 4 compute funding (5 sub-accounts + deposit) | 7.001 |
| Phase 3 anchors (3 receipts) | 0.002 |
| Phase 3 3-wallet flow (6 txs · 0.005 OG paid) | 0.105 |
| Phase 3 2-wallet flows (5 txs) | 0.085 |
| Phase 3 5-skill publishes (10 txs) | 0.067 |
| Phase 3 tamper/cross-machine verify | 0 (pure RPC reads) |
| Misc storage upload + retries | ~0.085 |
| **TOTAL spent** | **9.438 OG** |
| % of 16.38 OG autonomous cap | 57.6% |
| % of 25 OG operator deposit | 37.8% |

— agent · MAINNET LAUNCH READY (autonomous portion) · operator review next
