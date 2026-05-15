# Ivaronix · 0G APAC Hackathon Submission Packet (DRAFT)

> Per `docs/LOOP_DIRECTIVE.md` Phase 4 work item 9. Single-page index for the operator's final review + grant submission step.
>
> **Status**: autonomous portion green at commit `29c4eb3` (2026-05-15). All 4 source docs in sync against post-mainnet numbers.json. Operator §PHASE 5 morning step + bilingual + whitepaper + tour.webm refresh remain before public submission.
>
> **DO NOT publish externally without operator authorization** (LOOP_DIRECTIVE Anti-Hallucination Rule #2).

## What landed (post-mainnet)

| Surface | Path | Status |
|---|---|---|
| README (English) | [`README.md`](../../../README.md) | ✓ Phase A testnet + Phase B mainnet sections live · 25 markers in sync |
| Pitch (3-page) | [`docs/PITCH.md`](../../PITCH.md) | ✓ 8 markers in sync |
| Judge guide (5 min · 3 commands · 3 URLs) | [`docs/JUDGE_GUIDE.md`](../../JUDGE_GUIDE.md) | ✓ 6 markers in sync |
| Mainnet readiness checklist (13/13 · post-deploy) | [`docs/MAINNET_READINESS.md`](../../MAINNET_READINESS.md) | ✓ 9 markers in sync |
| Claims-vs-built audit (§36) | [`QA_PROOF_PACK/claims-audit/findings.md`](../../../QA_PROOF_PACK/claims-audit/findings.md) | ✓ 99 SHIPPED · 11 ROADMAP · 0 UNBACKED |
| Mainnet launch-ready index | [`QA_PROOF_PACK/MAINNET_LAUNCH_READY.md`](../../../QA_PROOF_PACK/MAINNET_LAUNCH_READY.md) | ✓ autonomous portion all-green (operator queue listed) |
| Phase 3 mainnet QA closure | [`QA_PROOF_PACK/mainnet/PHASE_3_DONE.md`](../../../QA_PROOF_PACK/mainnet/PHASE_3_DONE.md) | ✓ 6/7 smoke items · honest disclosures |
| AI quality audit (mainnet receipts) | [`QA_PROOF_PACK/mainnet/ai-quality/mainnet-3-receipts-audit.md`](../../../QA_PROOF_PACK/mainnet/ai-quality/mainnet-3-receipts-audit.md) | ⚠ 1/3 USABLE A · 2/3 PARTIALLY-USABLE (0GM-1.0 thinking-mode · v1.1 fix queued) |
| Threat models per primitive | [`docs/CRYPTO_NOTES.md`](../../CRYPTO_NOTES.md) | ✓ existing · 2026-05-10 |
| Half-baked surfaces ledger | [`docs/PHASE_B_DISCLOSURES.md`](../../PHASE_B_DISCLOSURES.md) | ✓ existing · 2026-05-11 |
| Privacy notes (operator-as-proxy) | [`docs/PRIVACY_NOTES.md`](../../PRIVACY_NOTES.md) | ✓ existing |

## On-chain artifacts the judges can replay (mainnet)

| Item | Value | Verify command (judge runs cold) |
|---|---|---|
| Mainnet RPC | `https://evmrpc.0g.ai` | `cast chain-id --rpc-url https://evmrpc.0g.ai` → `16661` |
| ReceiptRegistryV3 | `0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297` | `cast call <V3> "nextId()(uint256)" --rpc-url https://evmrpc.0g.ai` → `3` |
| SkillRegistryV2 | `0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde` | 5 legal skills published + priced |
| Receipt 0 (quick · 0GM-1.0) | tx `0xd9a48ded…` | `pnpm ivaronix receipt verify 0 --network mainnet --tee-independent` |
| Receipt 1 (standard · NDA-triage) | tx `0xbc40fd41…` | `pnpm ivaronix receipt verify 1 --network mainnet --tee-independent` |
| Receipt 2 (high-stakes · private-doc-review) | tx `0x280d4548…` | `pnpm ivaronix receipt verify 2 --network mainnet --tee-independent` |
| Cross-machine verify (no auth · canonical hash) | script | `pnpm tsx scripts/mainnet/cross-machine-verify.ts` returns `3/3 root-match + agent-match` |

## Honest open items (operator §PHASE 5 + v1.1 roadmap)

**Operator §PHASE 5 morning step** (required before public launch claim):

1. Provision Hetzner CX31 + `0g-memory` + `0g-da-client` Docker sidecars for 24/7 production uptime
2. Cloudflare WAF + DDoS in front of Vercel + Hetzner
3. Studio Vercel env flip `IVARONIX_NETWORK=mainnet` + redeploy
4. Run `pnpm tour:refresh` against post-cutover production UI (refresh `screenshots/readme/tour.webm`)
5. Bilingual 中文 README pass (operator's language preference)
6. Whitepaper 5 pages (formal description per LOOP_DIRECTIVE Phase 4 work item 2)
7. Authorize tweet posting + grant submission (operator decision)

**v1.1 roadmap** (post-launch · documented honestly):

- 0GM-1.0 thinking-mode `max_tokens` bump 600→1500+ OR render `reasoning_content` in UI (closes the 2/3 PARTIALLY-USABLE AI quality gap)
- 0G Storage upload integration (currently `storageRoot` placeholder on the 3 mainnet receipts)
- `broker.processResponse` TEE attestation integration (currently `attestationHash` placeholder · per-provider attestation history rotates ~30 days)
- legal-citation-verifier runtime web_fetch enforcement (Option A gate from Phase 1.5 ISSUE-B)
- Audit tier (term-sheet-risk-scanner falls back to high-stakes 5-role until `llama-3.3-70b` adversarial role lands in 0G mainnet catalog)
- 0G DA receipt batching (NON-BLOCKING per Operating Principle #10 · only when batching is genuine product value at our volume)

## Tweet text (drafted · operator authorizes posting)

> First receipt anchored against `0GM-1.0` via `pc.0g.ai`.
> 10 contracts on 0G Aristotle mainnet. Cross-machine verify in 10 seconds:
>
> https://ivaronix.com/r/0
>
> @0G_labs

(Alt-text for image preview: `/r/0` proof page showing FULLY VERIFIED chip + 4-light row + tier badge.)

## Spend summary (autonomous mainnet portion)

| Phase | OG spent |
|---:|---:|
| Phase 2 deploy (10 contracts) | 0.093 |
| Phase 2 step 4 compute funding (5 sub-accounts + deposit) | 7.001 |
| Phase 3 anchors (3 receipts) | 0.002 |
| Phase 3 3-wallet flow | 0.105 |
| Phase 3 2-wallet flows | 0.085 |
| Phase 3 5-skill publishes | 0.067 |
| Misc retries + storage | 0.085 |
| **TOTAL spent** | **9.438 OG** |
| % of 16.38 OG autonomous cap | 57.6% |
| Headroom remaining | 6.94 OG |

— agent · SUBMISSION_PACKET/DRAFT/ assembled · 2026-05-15
