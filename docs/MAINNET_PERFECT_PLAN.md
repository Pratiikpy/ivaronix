# IVARONIX · MAINNET_PERFECT_PLAN.md

> The locked, concrete mainnet plan. Every 0G primitive used end-to-end. Every model assigned to every role of every consensus tier of every skill. Sovereignty circle closed. No checklist filler — every choice is justified by product value.
>
> This is the document the agent uses when promoting from testnet → mainnet. It is NOT a marketing doc.
>
> **Companion docs (read together):**
> - `docs/MAINNET_PROMOTION_PLAN.md` — deploy order · funding · smoke flow (the operational procedure)
> - `docs/UI_REAL_USER_TEST_PLAN.md` — real-MetaMask QA contract
> - `docs/LOOP_DIRECTIVE.md` — the 4-phase execution contract with exit gates
> - `docs/MAINNET_READINESS.md` — current 13/13 testnet-green status snapshot
> - `docs/MAINNET_FUNDING_ESTIMATE.md` (produced before Phase 2 deploy · authoritative funding cap)
>
> **When this doc conflicts with `MAINNET_PROMOTION_PLAN.md`**: defer to `MAINNET_PROMOTION_PLAN.md` for procedure (deploy order · funding gates · smoke checklist). This doc owns model assignment + skill composition + sovereignty story. They complement; they don't compete.

---

## §1 · The 0G stack we use on mainnet (every primitive · every endpoint)

| Primitive | Mainnet endpoint | Our use | Justification |
|---|---|---|---|
| **0G Chain (Aristotle · 16661)** | `https://evmrpc.0g.ai` · explorer `chainscan.0g.ai` | 10 deployed contracts (V2/V3 only · no V1) · all receipt anchors · skill registry · passport mints · fee-split distribution | Receipts must anchor on a public chain to be independently re-verifiable. 0G Chain = native receipt registry surface. |
| **0G Compute (TEE · Private Computer)** | `pc.0g.ai/v1/proxy` (OpenAI-compatible · `app-sk-<SECRET>` credentials) | Every receipt's inference call. Sovereign-tier (0GM-1.0) + frontier-tier (deepseek-v4-pro) routed here. TEE attestation per call. | Pc.0g.ai is 0G's flagship TEE inference endpoint. Every sealed-inference receipt routes through it. Day-zero alignment with 0G's biggest product. |
| **0G Compute Router (fallback)** | `compute-network-X.integratenetwork.work/v1/proxy` (multi-provider · open-model marketplace) | Open-model roles in consensus (Qwen 3 32B · GLM-5-FP8 · DeepSeek V3.1 · Llama 3.3 · DeepSeek-Chat). Keyring rotation on 402/429. | Diverse-model-per-role consensus needs multi-provider access. Router gives us cross-architecture diversity for the highest-rigor tiers. |
| **0G Storage** | Production indexer URL (when 0G ships · current testnet `indexer-storage-testnet-turbo` flips to prod hostname) | Encrypted receipt body · Burn Mode ciphertext (AES-256-GCM session key destroyed after run · key fingerprint anchored) · evidence root | Receipt body must live somewhere durable, not on chain. 0G Storage = native blob layer. Burn Mode rides on the encryption-then-destroy-key primitive. |
| **0G Memory KV** | Operator-hosted gateway (`0g-memory` Docker on Hetzner CX31 · REST `localhost:1995` · 0G's open-source KV stack until they ship a public endpoint we can point at) | Portable encrypted memory · agent-passport-bound · stream-id derived from wallet for cross-machine portability | Memory must follow the user across machines without a server-side index. 0G KV is the native primitive. We operate the gateway today; cut over when 0G ships their public endpoint. |
| **0G Agent ID (ERC-7857)** | `AgentPassportINFTV2` mainnet address (assigned at deploy · `Erc7857Verifier` paired) | Passport minting · trust score recording (authorizedRecorders + ±100 delta cap) · `og.creator.fee_split` linked to passport-resolvable wallets | Signer reputation must compound on-chain. ERC-7857 is the 0G-native standard. We use it strictly (not a stretched analogue). |
| **0G DA** | `0g-da-client` Docker on Hetzner CX31 · mainnet DA entrance contract (set in `da.env` when 0G publishes) | **NON-BLOCKING for mainnet launch.** Receipt batching is real product value at scale (>1K/day) but NOT required for mainnet promotion. Stays "ready for batching later" until: (a) 0G ships public mainnet DA entrance contract AND (b) our receipt volume genuinely benefits from batching. Until both true → documented runbook in `docs/0G_DA_INTEGRATION.md` · NOT a fake-shipped claim. Never frame as "6/6 primitives" — judges score useful product integration, not primitive collection. | Build when justified by product · not for grant optics |
| **0G Compute fine-tuning pipeline** | 0G Compute (training mode · per `oglabs resources/fine-tuning-example/`) | **PHASE 2 ONLY · NOT LIVE TODAY.** 4 first-party fine-tunes planned: `ivaronix-legal-v1` (Qwen 3.6 35B base) · `ivaronix-medical-v1` · `ivaronix-hiring-v1` · `ivaronix-fintech-v1`. **Do NOT present these as live in any user-facing surface · marketing copy · pitch deck · README until they are actually trained, tested, and published under `Ivaronix` HF org.** Phase 1 launch uses public open models only. | Mark as roadmap until trained · then claim |

**6 of 7 0G primitives integrated as real product flow** (Chain · Compute · Storage · KV · Agent ID · Router). DA is the 7th, conditionally built. Sovereignty circle:

```
Trained on 0G Compute  →  Served on 0G Private Computer (TEE)  →  Paid in $0G
        ↑                                                              ↓
0G Memory KV (portable across machines)                  Anchored on 0G Chain
        ↑                                                              ↓
Agent Passport (ERC-7857 reputation accumulates)         Body on 0G Storage (encrypted)
        ↑                                                              ↓
        └──────────────── Receipts compound over time ────────────────┘
```

---

## §2 · Models we use on mainnet (full catalog · ranked by role)

**Sovereign tier (0G's own model · default for analyst + judge roles):**
- **`0GM-1.0-35B-A3B`** — MoE · 35B total / ~3B active · 262K native context / 1M extensible · vision encoder · agentic-coding + tool-use fine-tune · thinking-mode default · Apache 2.0 · live on `pc.0g.ai`

**Frontier tier (hardest reasoning · top-of-stack judge role on audit-tier consensus):**
- **`deepseek-v4-pro`** — via `pc.0g.ai` · served from Alibaba Bailian · TEE-attested · same OpenAI-compat shape

**Open catalog (diverse-architecture roles in consensus):**
- **`qwen3-32b-instruct`** — open · multilingual · high-context · APAC content
- **`glm-5-fp8`** — open · high-throughput · APAC content · cost-balanced
- **`deepseek-v3.1`** — open · math / financial / risk reasoning (Provus-confirmed live on Galileo)
- **`llama-3.3-70b-instruct`** — open · multilingual · general-purpose
- **`deepseek-chat`** — general chat · cost-balanced (0g-kit default)

**Testnet-only (NEVER promote to mainnet):**
- ~~`qwen/qwen-2.5-7b-instruct`~~ — testnet iteration only · removed from mainnet skill manifests

**Our fine-tunes — PHASE 2 ROADMAP · NOT LIVE TODAY:**
- `ivaronix-legal-v1` (Qwen 3.6 35B base · contract / NDA / term-sheet / clause corpus) · **NOT TRAINED YET**
- `ivaronix-medical-v1` (Qwen 3.6 35B base · medical-review support corpus) · **NOT TRAINED YET**
- `ivaronix-hiring-v1` (Qwen 3.6 35B base · employment / interview / screening corpus) · **NOT TRAINED YET**
- `ivaronix-fintech-v1` (Qwen 3.6 35B base · risk / claims / fraud-review corpus) · **NOT TRAINED YET**

**RULE**: do NOT reference these fine-tunes in pitch · README · whitepaper · marketing · or skill manifests as if they were live. They are roadmap only until trained, tested, and published. Phase 1 launch ships with public open models · the fine-tunes come later as a Phase 2 win that strengthens the sovereignty story further.

---

## §2.5 · Model fallback honesty rule (locked)

The mainnet plan above lists **targets**. The receipt records **what actually ran**. These are not the same thing.

**Fallback chain per role** (when a target model is unavailable):
- Sovereign-tier targets `0GM-1.0-35B-A3B` → falls back to `qwen3-32b-instruct` (open base) if `pc.0g.ai` route fails or `0GM-1.0` provider unreachable
- Frontier-tier targets `deepseek-v4-pro` → falls back to `deepseek-v3.1` (open) if Bailian route unreachable
- Open-catalog roles target the listed model → fall back to whichever provider is healthy in the Keyring rotation
- All failures logged on the receipt under `execution.rolesRun[].fallbackChain[]` · timestamp · reason
- Receipt's `verification.tier` reflects ACTUAL provider used (TIER 1 if reached TEE-attested · TIER 2 if fell through to external · TIER 3 if local-only)

**Honesty discipline**: receipt must always carry the actual model + provider + tier used, not what was targeted. UI displays "Ran on `0GM-1.0` via `pc.0g.ai`" when that's true. UI displays "Ran on `qwen3-32b-instruct` via Router (frontier-target `0GM-1.0` was unavailable)" when fallback engaged. **Never claim a model that didn't run.**

---

## §3 · Per-skill model + tier assignment on mainnet (TARGETS · not promises)

Each skill manifest's `og.consensus.role_models{}` block lists these as **preferred models**. The actual model used per role is determined at runtime by provider availability + the §2.5 fallback chain. **Receipt records actual model · not target.** Role names defined in `packages/consensus/src/prompts.ts:11-17`. Tier composition is **monotone** (`standard ⊂ high-stakes ⊂ audit`).

### `private-doc-review` (legal contract review · the cluster anchor)

- **Default tier**: `high-stakes` (5-role)
- **Why**: contract review is high-cost-when-wrong · diverse models reduce hallucination risk · `0GM-1.0` + `deepseek-v4-pro` together is the strongest realistic composition

| Role | Mainnet model | Role rationale |
|---|---|---|
| analyst | `0GM-1.0-35B-A3B` | Sovereign default · agentic-coding fine-tune extends well to clause analysis · 262K context handles long contracts |
| critic | `deepseek-v4-pro` | Frontier reasoning · catches what analyst missed |
| risk-reviewer | `glm-5-fp8` | Diverse architecture · APAC strength on multi-jurisdiction terms |
| evidence-checker | `deepseek-v3.1` | Math/financial precision · catches numerical clause errors |
| judge | `0GM-1.0-35B-A3B` (different seed) | Final synthesis · sovereign tier · thinking-mode trace surfaced on receipt |

### `contract-renewal-clause-detector`

- **Default tier**: `standard` (3-role)
- **Why**: narrower scope (clause detection only · binary find/not-find shape) · 3-role consensus suffices

| Role | Mainnet model |
|---|---|
| analyst | `0GM-1.0-35B-A3B` |
| critic | `0GM-1.0-35B-A3B` (different seed + temperature) |
| judge | `deepseek-v4-pro` |

### `legal-citation-verifier` (the Mata v. Avianca fix)

- **Default tier**: `high-stakes` (5-role · evidence-checker role calls external APIs)
- **Critical design**: evidence-checker role queries CourtListener + Cornell LII via HTTP · `0GM-1.0` is used only to parse citations from text and normalize matched results · **the AI never determines "exists or not"** · external database is ground truth · this design survives every model upgrade and prevents any model from hallucinating citations through us

**External-API failure-mode contract (locked)**: CourtListener and Cornell LII are external dependencies we don't control. If one or both are unreachable for a verifier run:
- Receipt MUST surface a visible warning chip ("external verification limited · 1 of 2 sources unreachable" or "external verification unavailable · cited cases not externally cross-checked")
- The hallucination_signal field becomes `unverified` (not `verified` and not `not_found`)
- The receipt's tier stays at high-stakes (process verified) but the verification.method records `external-source-degraded`
- A disclaimer is added to the receipt's `outputs.summary`: "Citation existence not confirmed against external database during this run · re-run when sources reachable for full verification"
- UI on `/r/<id>` shows the disclaimer prominently · not buried in evidence drawer
- This honest failure mode is BETTER than silently claiming verified when we couldn't check

| Role | Mainnet model | Special behavior |
|---|---|---|
| analyst | `0GM-1.0-35B-A3B` | Parses citations from brief text |
| critic | `deepseek-v4-pro` | Second-pass citation extraction (catches what analyst missed) |
| risk-reviewer | `glm-5-fp8` | Cross-checks parser output against citation grammar |
| evidence-checker | `0GM-1.0-35B-A3B` + **external HTTP** to CourtListener (`https://www.courtlistener.com/api/rest/v3/`) and Cornell LII (`https://www.law.cornell.edu/`) | The actual verification step · every external call logged to receipt with timestamp + URL + status code + response hash |
| judge | `0GM-1.0-35B-A3B` | Synthesizes verified-vs-hallucinated · outputs `{citation_text, exists: bool, real_source_url, hallucination_signal, recommended_correction}` |

### `nda-triage-reviewer`

- **Default tier**: `standard` (3-role)
- **Why**: NDA triage is classification-shaped · 3-role consensus catches edge cases (mutual vs one-way · buried non-solicit · broad confidentiality)

| Role | Mainnet model |
|---|---|
| analyst | `0GM-1.0-35B-A3B` |
| critic | `0GM-1.0-35B-A3B` (different seed) |
| judge | `deepseek-v4-pro` |

### `term-sheet-risk-scanner`

- **Default tier**: `audit` (6-role adversarial · the most rigorous tier we offer)
- **Why**: term-sheet errors cost founders 7-figure equity events · maximum diversity warranted · red-team-critic role adversarially challenges every flagged clause

| Role | Mainnet model | Role rationale |
|---|---|---|
| analyst | `0GM-1.0-35B-A3B` | Initial clause extraction |
| critic | `deepseek-v4-pro` | Frontier challenge of analyst's framings |
| risk-reviewer | `qwen3-32b-instruct` | Diverse architecture · catches APAC-jurisdiction term variants |
| evidence-checker | `glm-5-fp8` | Cross-checks against standard term-sheet comparables corpus |
| red-team-critic | `llama-3.3-70b-instruct` | Adversarial · proposes worst-case interpretations of ambiguous clauses |
| judge | `0GM-1.0-35B-A3B` | Synthesis with adversarial input weighed |

### Quick-tier fallback (any skill · single-pass · cheapest option)

- **`quick` tier**: 1 role · analyst only · either `deepseek-chat` or `qwen3-32b-instruct` (per skill manifest preference) · no Qwen 7B on mainnet

---

## §4 · Receipt anatomy on mainnet (what every receipt carries · locked)

Every mainnet receipt JSON includes these fields (per `packages/core/src/types.ts` RECEIPT_TYPES · 13 types):

```json
{
  "id": "rcpt_01...",
  "schemaVersion": 3,
  "timestamp": "...",
  "skill": { "id": "...", "version": "...", "vertical": "legal" },
  "tier": "high-stakes",
  "execution": {
    "burnMode": true|false,
    "consensusTier": "high-stakes",
    "rolesRun": [
      { "role": "analyst", "model": "0GM-1.0-35B-A3B", "provider": "pc.0g.ai", "tier": "TIER 1", "seed": ... },
      { "role": "critic", "model": "deepseek-v4-pro", "provider": "pc.0g.ai", "tier": "TIER 1", ... },
      ...
    ],
    "convergenceScore": 0.87,
    "modelWeightsHash": "sha256:..."
  },
  "storage": {
    "evidenceRoot": "0x...",
    "encryption": {
      "enabled": true,
      "type": "aes-256-gcm",
      "headerDetected": true,
      "keyFingerprint": "sha256:..."
    }
  },
  "burn": {
    "sessionKeyDestroyedAt": ...,
    "localCleanupStatus": "completed"
  },
  "outputs": {
    "summary": "1-3 sentence AI conclusion",
    "parsed": { ... structured output per skill ... },
    "findings": [ { "section": "...", "risk": "high|medium|low", "recommendation": "..." }, ... ],
    "suggestedAction": "1-sentence next step" (per Loop 59),
    "confidence": 0.84
  },
  "agent": {
    "passport": "did:0g:passport:0x...:1",
    "ownerWallet": "0x...",
    "trustScore": 0.87,
    "trustBand": "Verified|Trusted|Issuer"
  },
  "signer": {
    "address": "0x...",
    "role": "owner|managed-on-behalf|issuer-vouched",
    "issuerVouch": null | { "issuerAddress": "0x...", "issuerName": "...", "bondAmount": "..." }
  },
  "chainAnchor": {
    "network": "mainnet",
    "chainId": 16661,
    "registryAddress": "0x...",
    "registryVersion": "v3",
    "anchorTx": "0x...",
    "blockNumber": ...,
    "anchorBlockTimestamp": ...
  },
  "verification": {
    "verificationMethod": "router_flag | compute_sdk_process_response | external-signed | local-attested",
    "tier1Verified": true|false,
    "attestationHash": "0x...",
    "daCommitment": null | { "requestId": "...", "storageRoot": "0x...", "inclusionProof": "..." }
  },
  "outcomes": [],
  "retractions": []
}
```

**Disclaimer in `outputs.summary` for sensitive verticals** (legal · medical · hiring · financial): every receipt from these verticals MUST carry the line: "Output supports professional review — does not replace licensed counsel/practitioner."

---

## §5 · Receipt pipeline on mainnet (every step verified)

```
1. User drops doc → Studio /api/run (SIWE session OR demo-mode operator-signed)
   │
2. Daemon validates: skill manifest · tier · rate limit · operator-wallet hard cap · sensitive-vertical disclaimer applied
   │
3. Burn Mode (if enabled): AES-256-GCM session key (randomBytes(32)) · nonce (randomBytes(12)) · keyFingerprint captured before key buffer zeroed
   │
4. Upload to 0G Storage via @0gfoundation/0g-ts-sdk · evidenceRoot = keccak256(chunks)
   │
5. Daemon dispatches to og-router · per-role calls to pc.0g.ai (sovereign + frontier) and Router (open catalog)
   - getRequestHeaders(providerAddress) · single-use per call
   - openai-compat call: chat.completions.create({model, messages})
   - processResponse(provider, chatID, JSON.stringify(usage)) · 3-arg form per CLAUDE.md
   │
6. Consensus convergence (packages/consensus) · Jaccard + MiniLM cosine · threshold per skill manifest (default 0.6)
   │
7. Receipt assembly: RFC-8785 canonical JSON · canonical hash via packages/core/src/jcs.ts
   - schema v3 · tier · confidence · model+provider per role · summary · suggestedAction · agent passport · trust score
   - signed with operator wallet OR user wallet OR issuer-vouched wallet (per skill manifest signerRole)
   │
8. Chain anchor: ReceiptRegistryV3.anchor(receiptId, root, agentAddress, signature, nonce) on mainnet 16661
   │
9. DA path (when receipt is part of a batch):
   - Encode batch as DA blob · disperse via 0g-da-client gRPC to mainnet DA validators
   - Receive blob commitment + inclusion proof
   - Anchor batch commitment on chain (single tx for N receipts)
   - Each receipt's /r/<id> carries DA commitment + inclusion proof
   │
10. Return to Studio: rcpt_id · chain tx hash · /r/<id> URL · OG card URL
    │
11. Subgraph indexer picks up event for Studio reads
    │
12. Receipt page renders:
    - Question (left) + AI findings (lead) + Burn Mode disclosure (when active)
    - 4-light row (or 5 with DA): STORAGE · COMPUTE · TEE · CHAIN · (DA)
    - Tier badge (high-stakes 5-role) · confidence (0.84) · trust band (Verified)
    - Signer context paragraph
    - "Verify yourself in 10 seconds" button (interactive ceremony)
    - QR code "verify on another device"
    - Print PDF · Share buttons (LinkedIn · email · X · WhatsApp · iMessage previews)
    - Evidence drawer (collapsed by default): receiptRoot · storageRoot · anchorTx · signature · canonicalHash · DA commitment
```

---

## §6 · Server-side infrastructure on mainnet (Hetzner CX31)

| Service | Where | Process | Notes |
|---|---|---|---|
| Studio (Next.js) | Vercel · primary region Singapore (sin1) · fallback Mumbai (bom1) | Edge functions for `/r/<id>` · KV-cached body fetch | OG image generation per receipt |
| Hono daemon | Hetzner CX31 (~$10/mo) · Frankfurt or Singapore region | pm2 supervisor · auto-restart | API · receipt pipeline · Router · SIWE |
| 0G Memory KV sidecar | Hetzner CX31 · Docker | `0g-memory:latest` · REST `localhost:1995` (loopback only) | Operator-hosted gateway · cuts over to 0G's public endpoint when shipped |
| 0G DA Client | Hetzner CX31 · Docker | `ghcr.io/0glabs/0g-da-client:latest` · `combined` mode · gRPC `localhost:51001` (loopback only) | Built only when receipt batching is real product need OR when 0G publishes mainnet DA entrance contract |
| Subgraph indexer | Goldsky-hosted (preferred) OR self-hosted Graph Node on same box | — | Index receipt events for Studio reads |
| Cloudflare | In front of Vercel + Hetzner | DDoS · WAF · cache rules (static + receipt pages 5min · API uncached) | Free tier |

**Scaling tiers** (do not pre-optimize):
- 0-1K receipts/day → CX31 ($10/mo)
- 1K-10K → CX41 ($20/mo) — DA blob encoding gets CPU-heavy
- 10K-100K → CX52 or AX series ($50-100/mo)
- 100K+/day → multi-region · load balancer · DA Client cluster ($300+/mo)

---

## §7 · Mainnet promotion gate (cannot claim live without all 13 green)

- [ ] Operator wallet funded ≥ 10 OG on chainId 16661 (CEX bridge to deployer `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`)
- [ ] Rotate `IVARONIX_SIGNER_KEY` (legacy alias: `EVM_PRIVATE_KEY` · xyz §SEC-01 testnet leak risk)
- [ ] All 10 mainnet contracts deployed per `FINAL_BUILD_PLAN.md §9` runbook · addresses in `contracts/deployments/mainnet.json`
- [ ] `ivaronix doctor --network mainnet` all green (RPC · Compute provider reachable · KV gateway healthy · DA Client healthy if built · Storage indexer reachable)
- [ ] `ivaronix demo --network mainnet` produces receipt in <60s · returns `FULLY VERIFIED ✓`
- [ ] `pnpm ivaronix receipt verify <mainnet-id> --tee-independent` returns `FULLY VERIFIED ✓` against `pc.0g.ai`
- [ ] At least one receipt anchored from each consensus tier (`quick` · `standard` · `high-stakes` · `audit`) · all `FULLY VERIFIED`
- [ ] At least one receipt per legal skill (`private-doc-review` · `contract-renewal-clause-detector` · `legal-citation-verifier` · `nda-triage-reviewer` · `term-sheet-risk-scanner`) on mainnet · all `FULLY VERIFIED`
- [ ] Studio `/r/<mainnet-id>` renders correctly · body fetched from production 0G Storage · tier + confidence + signer context visible
- [ ] Multi-wallet flow on mainnet: marketplace 3-wallet (creator + buyer + treasury) + memory grant/revoke 2-wallet + passport mint+trust 2-wallet · all captured in `QA_PROOF_PACK/mainnet/multi-wallet/`
- [ ] AI quality audit on every mainnet skill receipt · `outputs.parsed` populated · `outputs.findings[]` non-empty for real input · `outputs.summary` accurate · `outputs.suggestedAction` actionable
- [ ] Cloudflare DDoS + WAF in front · rate limiting active · operator wallet daily cap enforced
- [ ] Daily wallet-balance + DA-health + KV-health crons running · alerts to operator

**Failure of any item → not live · fix and re-test the specific failed item · do NOT skip to writing phase.**

---

## §8 · Day-zero alignment (when mainnet goes live)

The moment §7 is fully green:
1. **Anchor a real receipt against `0GM-1.0-35B-A3B`** via `pc.0g.ai` · use `private-doc-review` on a real sample contract
2. **Tweet from Ivaronix handle** (when registered): "First receipt anchored against `0GM-1.0` via `pc.0g.ai`. Verify in 10 seconds: ivaronix.com/r/<id>" · tag @0G_labs
3. **Update `docs/MAINNET_READINESS.md`** with mainnet-13/13 green checklist · mainnet contract address table
4. **Update `README.md`** numbers blocks via `pnpm numbers:refresh --network mainnet`
5. **Update `docs/PITCH.md` + `docs/JUDGE_GUIDE.md`** to reflect mainnet (drop testnet eyebrow text on /legal · keep "TESTNET" badge ONLY on testnet routes if any remain)

---

## §9 · Locked decisions (do not re-litigate without explicit operator override)

- **0GM-1.0 is the sovereign-tier TARGET** for analyst + judge roles · receipt records actual model used · §2.5 fallback chain applies if `pc.0g.ai` route unavailable
- **deepseek-v4-pro is the frontier-tier TARGET** on `audit` judge and `high-stakes` critic · receipt records actual · §2.5 fallback chain applies
- **Diverse-model-per-role on `high-stakes` and `audit`** — agreement across architectures is the trust signal · never collapse to single-model multi-seed on these tiers
- **Qwen 2.5 7B is testnet-only** · never appears in mainnet manifests or receipts
- **Process verified, not answer verified** copy discipline on every receipt + skill manifest
- **Sensitive-vertical disclaimer** ("Output supports legal/medical/hiring review — does not replace licensed professional") in every relevant skill's `description` + every relevant receipt's `outputs.summary`
- **`legal-citation-verifier` calls CourtListener + Cornell LII external** — AI does NOT determine "exists or not" · external database is ground truth · architecture survives all model upgrades · failure-mode contract per §3 (visible warning chip + disclaimer in summary when sources degraded)
- **DA is NON-BLOCKING for mainnet launch** — built only when receipt batching is genuine product value at our volume AND 0G has shipped mainnet DA entrance contract · honest documented runbook is the only acceptable fallback · never framed as "6/6 primitives" or "primitives collection"
- **Fine-tunes are PHASE 2 ROADMAP only** — do NOT present `ivaronix-*` fine-tunes as live in any user-facing surface · marketing copy · pitch deck · README · skill manifests · until they are actually trained, tested, published. Phase 1 mainnet ships with public open models only.
- **Model fallback honesty (§2.5)** — receipt records actual model + provider + tier used · NEVER claim a model that didn't run · fallback chain documented per role · UI shows "Ran on X (target Y was unavailable)" when fallback engaged
- **No claim without proof link** — every numerical claim · every model reference · every primitive integration claim in README · pitch · whitepaper · website MUST map to a receipt URL · tx hash · screenshot · video · or explicit roadmap label. No bare claims that aren't traceable to evidence on disk.
- **KV gateway operator-hosted today · cut over to 0G's public endpoint when shipped** · do NOT claim "0G-hosted" before that
- **$0G-only pricing on mainnet** · Stripe/USD billing deferred to Phase 2
- **Mainnet model claims gated on §7 smoke tests** · do NOT say "mainnet uses 0GM-1.0" until the smoke test confirms our route reaches it end-to-end

---

— end of MAINNET_PERFECT_PLAN.md —
