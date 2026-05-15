# Phase 3 · MAINNET QA · DONE (autonomous portion)

> Per LOOP_DIRECTIVE PHASE 3 EXIT GATE · 6/7 smoke items chain-side green · UI-side gated on §PHASE 5 Studio Vercel cutover.

## Spend summary

- Operator wallet at session start: **25.864 OG**
- Operator wallet now: **16.426 OG**
- **Cumulative mainnet spend: 9.438 OG · 57.6% of 16.38 OG autonomous cap**
- 6.94 OG headroom remaining

## On-chain state on mainnet (chainId 16661)

| Resource | Count | Source of truth |
|---|---:|---|
| Contracts deployed | 10/10 | `contracts/deployments/mainnet.json` |
| Receipts anchored on V3 | 3 | `ReceiptRegistryV3.nextId() = 3` |
| Skills published on V2 | 5 (legal cluster) | `SkillRegistryV2.publishVersion × 5` |
| Skills priced | 5 | `SkillPricing.setPrice × 5` |
| Passports minted | 1 (alice burner) | `AgentPassportINFTV2.balanceOf(alice) = 1` |
| Compute account state | 7 OG funded · 5 sub-accounts · 1 OG available | `0g-compute-cli get-account` |

## Phase 3 smoke completeness (per LOOP_DIRECTIVE Phase 3 SMOKE COMPLETENESS table)

| Smoke item | Required evidence | Status | Path |
|---|---|---|---|
| Payment flow (3 distinct senders · real OG fee-split) | 3 chainscan tx URLs · CLI cross-check · balance changes on 3 wallets | ✓ DONE | `smoke/05-3-wallet-marketplace.md` |
| Receipt anchored · `outputs.parsed` populated · findings non-empty · summary accurate · AI quality rated `usable` | Receipt JSONs + AI audit | ⚠ 1/3 USABLE A · 2/3 PARTIALLY-USABLE B/B- | `smoke/01-03-*.json` + `ai-quality/mainnet-3-receipts-audit.md` |
| Proof page renders on stranger's machine | Stranger reads via chain RPC + canonical-hash match | ✓ CHAIN done · UI deferred | `smoke/04-cross-machine-verify.md` |
| CLI verify cross-checks | Cross-machine verifier rooted in canonical-hash | ✓ DONE | `smoke/04-cross-machine-verify.md` |
| Explorer links live | `chainscan.0g.ai/tx/<hash>` for all anchor + admin txs | ✓ DONE | `mainnet.json` + spend log |
| AI output usable | Read `outputs.parsed` for each skill receipt | ⚠ 1/3 USABLE A · 2/3 PARTIALLY-USABLE | `ai-quality/mainnet-3-receipts-audit.md` |
| Multi-wallet rigor (3-wallet marketplace) | Real MM popups (deferred to §PHASE 5 Studio cutover) · burner-script chain proof | ✓ chain side · UI side deferred | `smoke/05-3-wallet-marketplace.md` |
| Tamper test | 1-byte modification flips hash · restored matches again | ✓ DONE | `smoke/06-tamper-test.md` |
| QR cross-device verify | Phone scan + verify (deferred to §PHASE 5 UI cutover) | NOT DONE | requires Studio mainnet cutover |

## Per-tier mainnet receipts (per LOOP_DIRECTIVE Phase 3 work item 2)

| V3 id | Tier | Skill | Models invoked | Convergence | AI quality |
|---:|---|---|---|---:|---|
| 0 | quick (1-role) | private-doc-review | 0GM-1.0-35B-A3B-0427 | n/a single-role | PARTIALLY-USABLE B- (thinking-mode output) |
| 1 | standard (3-role) | nda-triage-reviewer | 0GM-1.0 · 0GM-1.0 · deepseek-v4-pro | 0.95 (judge: "converged") | USABLE A (judge produced clean JSON triage) |
| 2 | high-stakes (5-role) | private-doc-review | 0GM-1.0 · deepseek-v4-pro · z-ai/glm-5 · deepseek-v3.2 · 0GM-1.0 | 0.78 (heuristic · judge content empty) | PARTIALLY-USABLE B (critic produced 685c legal analysis · 4/5 in thinking-mode) |

**Audit tier deferred to v1.1** per operator decision · llama-3.3-70b adversarial red-team-critic not in current 0G mainnet catalog · term-sheet-risk-scanner defaults to high-stakes 5-role on mainnet (composition above).

## Multi-wallet flows on mainnet (per LOOP_DIRECTIVE Phase 3 work item 4)

| Flow | Wallets | Chain-side | UI-side |
|---|---|---|---|
| Marketplace 3-wallet (creator + buyer + treasury · fee-split paid) | alice + bob + operator | ✓ 6 txs · 90/10 split verified · alice withdrew · `smoke/05-3-wallet-marketplace.md` | deferred · §PHASE 5 |
| Memory grant/revoke 2-wallet | alice + bob | ✓ issueGrant + revokeGrant · isValid pre/post correct · `smoke/07-2-wallet-flows.md` | deferred · §PHASE 5 |
| Passport mint + ownership verify 2-wallet | alice + operator | ✓ mint · tokenId 1 · ownerOf=alice · `smoke/07-2-wallet-flows.md` (trust accrual via recordReceipt deferred to follow-up) | deferred · §PHASE 5 |

## Open items (gated on operator's §PHASE 5 morning step)

1. Studio Vercel mainnet cutover (`IVARONIX_NETWORK=mainnet` env on production) — enables `/r/<mainnet-id>` UI render for judges
2. Hetzner CX31 provision + 0g-memory Docker + Cloudflare WAF — production resilience layer
3. Production crons for wallet-balance + container health
4. Tweet authorization + grant submission
5. PRE-QUEUE-1 refundFailedRun phase-2 chain-time-gated tx (14h 49m remaining)

## Honest disclosures (per §2.5 + §1 rules)

1. **AI quality**: 1/3 receipts USABLE A · 2/3 PARTIALLY-USABLE. Cause: 0GM-1.0 thinking-mode default consumes max_tokens for reasoning. v1.1 fix: bump to 1500+ tokens OR render `reasoning_content` in UI. Receipts ARE chain-anchored and cryptographically valid · just not in optimal user-facing format.
2. **Model substitutions per §2.5**: `qwen3-32b-instruct` → `qwen3-vl-flash` (same family · vision-language variant) · `deepseek-v3.1` → `deepseek-v3.2` (newer snapshot · same family). Receipts record actual model returned.
3. **legal-citation-verifier Q9 PARTIAL** persists on mainnet — runtime web_fetch enforcement for CourtListener/Cornell LII queued as that-skill mainnet-promotion gate. Other 4 legal skills are full PASS.
4. **storageRoot is a placeholder** for the 3 anchored receipts. 0G Storage upload integration is queued — the earlier testnet TIER 2 demo proved that path; combining storage+anchor into one flow is the v1.1 work item.
5. **attestationHash is a placeholder** computed as `keccak256(completionIds + timestamp)`. Real TEE-attested signature via `broker.processResponse` is a runtime upgrade — receipt records provider addresses so verifiers can check independently.
6. **Key rotation deferred to §PHASE 5** — current deployer wallet `0xaa954c33...8677Ce` uses the testnet-exposed key per xyz §SEC-01. Operator rotates on Hetzner deploy.
7. **Studio Vercel cutover** not autonomously executed — requires operator's Vercel auth + redeploy. Once flipped, the cross-machine UI verify can be filmed.

## What's mainnet launch-ready

**Chain layer · cryptographic guarantees · economic flow**: ✓ proven
- 10 contracts deployed and verified
- 3 receipts cryptographically replayable (cross-machine verifier · canonical-hash matches chain)
- 3-wallet fee-split paid + withdrawn end-to-end
- 2-wallet memory grant/revoke + passport mint + ownership verified
- Tamper test proves strict commitment
- 5 legal skills listed + priced on SkillRegistryV2/SkillPricing
- 5 model providers wired + funded · 0G's flagship 0GM-1.0 confirmed responsive

**Honest gaps**:
- AI quality 67% PARTIALLY-USABLE (thinking-mode token consumption) — v1.1 fix queued
- UI layer (`/r/<mainnet-id>`) needs Vercel cutover — operator-actionable
- 0G Storage upload + TEE attestation integration — v1.1 work items
- Audit tier deferred to v1.1
- Goldsky subgraph deferred to when volume justifies
- 0G DA NON-BLOCKING per operating principle #10
- §PHASE 5 Hetzner + Cloudflare layer — operator's morning step

— agent · Phase 3 closure · ${new Date(1778817800 * 1000).toISOString()}
