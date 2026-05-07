# Ivaronix — Product Requirements Document

> **Status:** v3 (full Nexus vision, locked 2026-05-07).
> **Companion docs:** `HLD.md` (architecture), `BUILD.md` (operational 30-day plan), `RECEIPTS_SPEC.md` (canonical schema), `REFERENCE_PATTERNS.md` (extracted patterns), `PITCH.md` (grant pitch).
> **Rule:** this doc holds *what & why*. Implementation lives in `HLD.md` and `BUILD.md`. Schemas live in `RECEIPTS_SPEC.md`. Don't duplicate.

---

## 1. Product Name

# Ivaronix

## Taglines (audience-specific)

| Audience | Tagline | Where it appears |
|---|---|---|
| End users (Studio hero, Twitter, marketing) | **"Catch the risks. Keep the receipts."** | Studio `/`, OG image, X announcement, ProductHunt |
| 0G ecosystem / grant judges | **"The 0G Agent Operating System."** | Grant pitch, Discord, build.0g.ai/showcase entry |
| Developers | **"AI work, with receipts."** | npm package description, README hero |
| Technical infra (PRDs, integrations) | **"AI Action Receipts on 0G."** | This doc, REFERENCE_PATTERNS, RECEIPTS_SPEC |

The receipt mechanic is the *spine*; the user-visceral wedge is the *outcome* — catching risks AI usually misses + proving what you found. Receipt is supporting evidence in user-facing copy, headline only in technical contexts.

## One-line Pitch (full version)

> Ivaronix is the 0G-native operating system where AI agents get private memory, permissioned skills, consensus review, burn mode, action receipts, identity, and reputation.

## Simpler Pitch (for normal humans)

> Catch the risks. Keep the receipts. AI work that double-checks itself, on 0G.

---

## 2. Final Positioning

Ivaronix is **not only**:
- a private AI chat
- a CLI coding agent
- a skill marketplace
- a memory vault
- a payment protocol
- a document AI
- a 0G demo

Ivaronix is **one 0G-native Agent OS** with one killer first workflow.

The strongest 0G projects each solve one layer — memory (MindVault, SealedMind), payments (AgentPay), marketplace (Agent0G), audit (ChainShield), firewall (Don't Get Drained), consensus (AlphaDawg), identity (Aishi), scheduled agents (0GClaw), workflow DAGs (ShadowFlow), trading attestation (Provus). **Ivaronix wins by combining them into one coherent system** — every layer best-of-class, all primitives integrated, one demo proves the entire OS.

**Core rule:**

> Big architecture. Narrow insane demo.

The full platform is large; the first demo must be simple, clear, and powerful.

---

## 3. Five Product Surfaces

| # | Surface | Audience | Primary artifact |
|---|---|---|---|
| 1 | **Ivaronix Studio** | Users, teams, judges (primary surface) | Web app at `ivaronix.com` |
| 2 | **Ivaronix Forge CLI** | Developers, power users | `ivaronix` binary |
| 3 | **Ivaronix API** | Builders, integrators | OpenAI-compatible HTTP + SDK |
| 4 | **Ivaronix Skill Registry** | Skill creators, ecosystem | Verified skill marketplace |
| 5 | **Ivaronix Trust Layer** | Companies, DAOs (Phase 3) | Team workspaces + policies |

### 3.1 Ivaronix Studio (primary user surface)

The web app where normal humans live with Ivaronix. Built on Next.js 15 + React 19 + Tailwind v4 + shadcn/ui, hosted on Vercel.

> **For per-component UX decisions** (drop-zone four-light row, audit report layout, receipt verify states, skill browser permission pills, public Proof URL tile strip, agent passport profile radar, Memory Permission Center tabs, burn-mode visual deltas, consensus output rendering, etc.) — **`COMPONENTS.md` is the canonical source.** Every cross-folder pattern (Aishi mint stepper, Drained tri-light row, AlphaTrace re-verify button, BuildProof score caps, Aegis sealed chip, Provus ELO arrow, POD score ring) is mapped to a specific Ivaronix component there.

**Key views (each spec'd in COMPONENTS.md):**
- **Drop-zone hero (`/`)** — single full-bleed input + four-light status row (`Storage · Compute · TEE · Chain`). 8-second "AI work happening" theater. → `COMPONENTS.md §2`
- **Onboarding stepper (`/onboard`)** — 5 rows; ends with the user's first share-able Public Proof URL, not an empty profile. → `COMPONENTS.md §1`
- **Skill Browser (`/skills`)** — 50+ skills with permission pills, sandbox-preview button (try without installing). → `COMPONENTS.md §4`
- **Skill Detail (`/skill/<id>`)** — header + live demo box + last-20-receipts feed + on-chain reputation. → `COMPONENTS.md §5`
- **Audit Report viewer** — verdict banner + badge row + per-reviewer card grid; disagreement summary when consensus < 0.85. → `COMPONENTS.md §3, §15`
- **Public Proof URL (`/r/<id>`)** — print-friendly, no auth, 4-tile receipt strip with client-side re-verify. → `COMPONENTS.md §6`
- **Agent Passport profile (`/@<handle>`)** — handle + ELO + receipt feed + 6-axis radar + milestone log. → `COMPONENTS.md §7`
- **Memory Permission Center (`/memory`)** — phone-style three-tab UX (Memories / Permissions / Access Log). → `COMPONENTS.md §8`
- **Global stats (`/global`)** — sparse honest dashboard with live counters and scrolling receipt ticker. → `COMPONENTS.md §9`

**Cross-cutting visual language:** the Four-Light Row appears in the hero, the receipt verify pane, the OG-image, and the Twitter card — same chip set in CLI ANSI and Studio React. Burn Mode toggles the row to purple/fast-pulsing visuals that *look* sealed. See `HLD.md §4.2`.

This is the surface judges click. **First real Studio in the 0G ecosystem.**

### 3.2 Ivaronix Forge CLI (developer surface)

The OpenCode + Hermes + Octogent + claude-mem + awesome-claude-skills synthesis with 0G receipts woven in.

> Ivaronix Forge is the 0G-native AI agent workspace where coding agents remember projects, install permissioned skills, coordinate subagents, and prove their work on 0G.

7 modes: `plan` / `build` / `audit` / `doc` / `swarm` / `watch` / `receipt`.

Same backend as Studio (shared API + receipt schema + skill format). Power users do everything from the terminal; their work appears in their Studio profile.

### 3.3 Ivaronix API (developer integrations)

OpenAI-compatible plus Nexus extensions. One sentence:

> Use Ivaronix like OpenAI, but with memory, skills, consensus, policy, and 0G proof.

```typescript
await ivaronix.run({
  model: "qwen/qwen-2.5-7b-instruct",
  input: "Analyze this repo",
  memory: true,
  skill: "github-audit",
  consensus: true,
  receipt: true
})
```

Endpoints: `/chat`, `/run`, `/documents/ask`, `/consensus`, `/skills/run`, `/memory/query`, `/receipts/create`, `/receipts/verify`, `/agents`, `/policies`. MCP server alongside.

### 3.4 Ivaronix Skill Registry (the awesome-claude-skills move)

Verified skill registry, not a random GitHub import.

**The day-1 differentiation:** **port 50+ skills from `awesome-claude-skills`** to Ivaronix manifest format. Skills include code-review, security-audit, contract-review, github-audit, threat-modeling, type-design-analyzer, comment-analyzer, etc.

**No other 0G project ships with 50+ skills out of the box.** AIsphere has 10 MCP tools. SealedMind ships one OpenClaw skill. Ivaronix's "Apple App Store at launch" effect is real.

**The real long-term moat is NOT the 50-count — it's the `og:` manifest extension.** Ivaronix's skill format is a **strict superset** of awesome-claude-skills `SKILL.md`, plus a 0G-native `og:` block (permissions, reputation hooks, fee splits, consensus tier, scanner score, on-chain anchor) that has no off-chain equivalent. A forker who copies the format gets nothing — to match Ivaronix, they'd need to deploy `SkillRegistry`, integrate ERC-7857 passport, run a scanner pipeline, build fee routing. **The 50-skill marketplace is the launch moment; the `og:` block is the moat.** See `COMPONENTS.md §13` for the full extension.

Compatibility: native awesome-claude-skills format + MCP server compatible + OpenClaw compatible. Cross-compose with any AI tool.

Permission manifest example:
```json
{
  "name": "github-audit",
  "version": "0.4.1",
  "permissions": ["read_repo", "run_tests"],
  "memoryAccess": "project_only",
  "networkAccess": ["github.com"],
  "walletAccess": false,
  "writesFiles": false,
  "receiptRequired": true,
  "creator": "did:0g:passport:0x..."
}
```

On-chain `SkillRegistry` contract anchors manifest hash + version. Reputation accumulates per skill (every receipt produced by a skill increments its trust score). Sandbox + scanner runs on every install.

### 3.5 Ivaronix Trust Layer (Phase 3)

Teams, DAOs, regulated industries. Policy engine, approval gates, team memory, agent fleet management, spend limits, compliance exports, audit log dashboards. **Realistic enterprise revenue line; not built at MVP but designed in schema now.**

---

## 4. The Seven Core Layers

The product is one thing — the **Action Receipt** — but it sits on seven layers. Each maps to a 0G primitive and is best-of-class against every showcase + entry.

### 4.1 Identity Layer — *ERC-7857 Agent Passport*

Every agent gets a wallet-bound passport.

**Fields:** ownerWallet, agentId, name, avatar, role, personality, modelHistory, memoryRoot, skillManifestRoot, permissionProfile, trustScore, receiptCount, violationCount, namespaceRoots, lastEvolutionEvent.

**Spec:** full ERC-7857 (encrypted metadata, secure re-encryption on transfer, authorized executor, cloning) — *most projects ship a subset; we ship all of it*.

**Persistent on-chain events** (Aishi pattern): mints, evolution, milestones, skill installs, key rotations, transfers.

**Reputation accumulation in passport** (MUSASHI pattern): trustScore, receiptCount, violationCount.

**CapabilityRegistry integration** (SealedMind pattern): passport authorizes memory grants.

**Best-of-class verdict:** strict superset of Aishi + MUSASHI + SealedMind + MindVault + AIsphere passports.

### 4.2 Memory Layer — *0G Storage + 0G KV + 0G Sealed Inference*

Wallet-owned, encrypted, content-addressed memory with temporal context.

**Hybrid memory** = vector index (SealedMind/HNSW) + temporal graph (Graphiti) + SQLite+FTS5 (claude-mem) + KV pointers (OpenClaw). **No competitor combines all four.**

**Encryption:** AES-256-GCM with per-user key derivation (SealedMind).

**Inference:** 0G Sealed Inference (Intel TDX + NVIDIA H100 TEE) for fact extraction + recall synthesis.

**On-chain access control:** `CapabilityRegistry` (memory grants) + `MemoryAccessLog` (audit trail).

**Memory personas:** work / personal / crypto / legal / research / project / company / team — namespace-isolated.

**Memory actions:** approve, edit, delete, burn, export, import, search, ask, view-graph, see-access-log.

**Lifecycle hooks** (claude-mem pattern): `PreToolUse / PostToolUse / SessionStart / SessionEnd / PreCompact / UserPromptSubmit` for automatic observation extraction.

**Memory Permission Center** (Studio UI): grant/revoke memory access by agent / skill / project / session / namespace / document collection / team workspace.

**Core line:**
> Your AI should remember you without owning you.

**Best-of-class verdict:** strict superset of SealedMind + MindVault + Graphiti + claude-mem.

### 4.3 Skill Runtime Layer — *Permissioned, on-chain registered, sandboxed*

Skills are folders with `SKILL.md` + `manifest.json` + `prompt.md` + `tools/` + `tests/`.

**Format compatibility:** native awesome-claude-skills + MCP-compatible + OpenClaw-compatible + native 0G manifest fields (walletAccess, memoryAccess, networkAccess, receiptRequired).

**On-chain anchoring:** `SkillRegistry.sol` stores `(skillId, version) → manifestHash`. Skill creators identify via passport.

**Safety pipeline:** scanner (prompt injection, suspicious URLs, secret leakage, wallet-drain, excessive permissions) → sandbox (PATH allowlist, cwd jail, network allowlist) → permission prompt.

**Skill commands:**
```bash
ivaronix skill search github-audit
ivaronix skill add github.com/user/repo/path/to/skill
ivaronix skill inspect github-audit
ivaronix skill permissions github-audit
ivaronix skill scan github-audit
ivaronix skill run github-audit --receipt
ivaronix skill registry sync
```

**Reputation per skill:** every receipt produced increments the skill's trust score.

**Wording lock:** never claim "guaranteed safe"; say "scanned, sandboxed, labeled, and limited."

**Day-1 catalog:** 50+ ports from awesome-claude-skills + 3 first-party 0G-native skills (`private-doc-review`, `0g-integration-auditor`, `github-audit`).

### 4.4 Action / Workflow Layer — *Policy engine + safety guard*

Agents act, not just chat.

**Actions:** read docs, audit code, review contracts, monitor wallets, summarize Telegram/Discord, generate reports, run scheduled jobs, call APIs, draft posts/PRs/tests/docs, execute multi-step workflows.

**Safe Autonomy Slider:** Observe → Suggest → Draft → Act-with-approval → Auto-within-limits.

**Policy engine:** file/network/API allowlists, memory/wallet scope, max spend, dry-run, emergency stop, incident log.

**Agent Safety Guard:** runs PRE every file write, shell exec, network call, wallet signature, memory access, skill install, external posting.

Plain-English permission prompts:
```
GitHub Audit Skill wants:
  - read this repo
  - inspect package files
  - run tests
  - create a receipt

It will not:
  - access wallet funds
  - post externally
  - read personal memory
```

**Future workflow DAGs** (Phase 2, ShadowFlow pattern):
```
Step 1 → Step 2 → Approval Gate → Tool Call → Receipt → Rollback / Retry
```

### 4.5 Consensus Layer — *Adjudicated multi-agent (the wow layer)*

Not "ask many models." **Adjudicated Consensus** with three tiers (cost shown upfront, user explicitly opts in to higher tiers).

| Tier | Roles | Use case | Est. cost |
|---|---|---|---|
| **Quick** | 1 (single model) | Quick draft / no consensus needed | ~$0.02 |
| **Standard** (default for `--consensus`) | 3 (analyst / critic / judge) | Most audits, doc-asks, code reviews | ~$0.10 |
| **High-Stakes** (opt-in via `--high-stakes`) | 5 (analyst / critic / risk-reviewer / evidence-checker / judge) | Legal, contract, financial, medical | ~$0.25 |

**Default 3-role superset of AlphaDawg's 3 / MUSASHI's bull-bear:**
1. **Analyst** — primary analysis
2. **Critic** — adversarial; tries to break the analysis (combines AlphaDawg's red-team + MUSASHI's bear)
3. **Final Judge** — synthesizes; reads past consensus outcomes (self-calibration) before deciding

**High-Stakes tier adds:**
4. **Risk Reviewer** — flags risks the analyst missed (legal/regulatory frame)
5. **Evidence Checker** — verifies citations against source line-by-line

**Pre-flight 7-gate fail-fast** (MUSASHI pattern) BEFORE launching expensive 5-role consensus:
1. File type/size sanity
2. Sensitive-content detection (PII, secrets) → triggers Burn Mode
3. Token budget vs. context window
4. Model capability match (tool calling? JSON mode? TEE?)
5. Provider availability
6. Wallet/Router balance sufficient
7. Receipt registry not paused

**Independent TEE verify per role** — every role's response independently re-verified via `broker.inference.processResponse()`.

**Output:** convergence score (semantic similarity 0-1), agreement summary, disagreement summary, evidence coverage, risk level, citations, final judgement, receipt.

**Cycle memory** (AlphaDawg pattern): consensus transcripts stored in temporal memory graph; available for future runs.

**Wording lock:** never say "truth score." Say "agreement score, disagreement summary, evidence coverage, risk level, and execution proof."

**Best-of-class verdict:** combines AlphaDawg + MUSASHI + Don't Get Drained + Provus's self-calibration. Strict superset.

### 4.6 Receipt / Proof Layer — *The 0G-native spine*

Every important AI action creates an Action Receipt.

**9 receipt types** (no competitor has typed receipts):
- `doc_ask` — private document Q&A
- `audit` — repo / code / contract audit
- `consensus` — multi-role consensus run
- `burn` — burn-mode operation (child of another receipt)
- `memory_access` — skill / agent read/wrote memory
- `skill_exec` — skill execution
- `code_change` — diff produced by `ivaronix code`
- `passport_update` — passport mutation (skill install, key rotation)
- `swarm` — parent-of-workers run

**Schema:** `RECEIPTS_SPEC.md` is canonical. Single source of truth.

**Lifecycle:**
```
draft → claimed → anchored → fully-verified → outcome-resolved
```

**3-state verification UI** (no competitor surfaces this):
```
Schema:                PASS
Hash:                  PASS
Signature:             PASS    → CLAIMED
Storage availability:  PASS    (root 0x... matches)
Chain anchor:          PASS    (block 12345)
                                          → ANCHORED
TEE independent:       PASS    (provider 0x... attested)
Skill manifest:        PASS    (matches passport at block 12345)
                                          → FULLY VERIFIED
```

**Independent TEE verify** via `broker.inference.processResponse(providerAddress, zgResKey)` — most projects stop at Router flag; we don't.

**Outcome-resolved receipts** close the reputation loop: was the audit accurate? did the doc summary hold? Adjusts passport `trustScore` post-hoc.

**Public Proof URLs** never leak plaintext — only hashes, citation IDs, sanitized headlines (max 200 chars), wording-locked.

**Killer line:**
> A blockchain transaction has a receipt. An AI action should have one too.

### 4.7 Reputation Layer — *Receipt-based, on-chain, conviction-weighted*

Agent reputation comes from verified actions, not fake ratings.

**Model:** conviction-strikes (MUSASHI) for discrete actions + optional ELO (Provus) per skill/agent pair when actions repeat.

**Stored in:** ERC-7857 Agent Passport (`trustScore`, `receiptCount`, `violationCount`).

**Updated by:**
- Receipt count (every receipt +X)
- Policy compliance (clean runs +Y, violations -Z)
- Skill outcomes (skill produced verifiable outputs)
- User approvals / rejections (in Studio)
- Outcome-resolved receipts (post-hoc accuracy adjustments)
- Dispute resolutions (Phase 3)

This creates real agent trust over time. Public passport pages render trust trajectory.

---

## 5. Phase 4 — Economy Layer (designed now, built later)

Schema reserves room for: agentWallet, escrow, revenueSplit, invoices, royalties, pay-per-run, agent-to-agent payments, subscriptions, marketplace settlement.

Settle through 0G Chain. Use 0G Storage for invoice records.

**Honest framing:** the company is NOT built on marketplace economics. Marketplace is a **discovery + trust moat**, not a revenue line. Real revenue in Phase 2/3 (Pro subscription + Enterprise/Trust Layer).

---

## 6. Killer MVP Workflow

The MVP demonstrates one workflow end-to-end. **Everything else is theatre.**

**CLI version:**
```bash
ivaronix doc ask contract.pdf "find risky clauses" \
  --burn --consensus --receipt
```

**Studio version:** Drop `contract.pdf` in browser → select skill `private-doc-review` → toggle Burn Mode + Consensus → click "Run" → wait <60s → see audit report with `Verify on Chain` buttons next to every finding → click "Share" → copy public Proof URL.

**What happens (one demo, full stack):**
1. User connects wallet (passport restored from 0G KV pointer).
2. Local AES-256-GCM encrypt of `contract.pdf`; ciphertext uploaded to 0G Storage.
3. Pre-flight 7-gate fail-fast.
4. **5-role consensus** (analyst/risk-reviewer/evidence-checker/red-team-critic/judge) in parallel via 0G Router with `verify_tee: true`.
5. **Independent TEE verify per role** via `broker.inference.processResponse()`.
6. **Burn Mode**: session key destroyed, local cache zeroed.
7. Evidence JSON sealed → 0G Storage root captured.
8. Receipt JSON canonicalized → signed by owner wallet → uploaded to 0G Storage.
9. **Receipt anchored on 0G Chain** (testnet 16602 first, mainnet 16661 after promotion; `ReceiptRegistry.anchor()`).
10. **Passport (ERC-7857 INFT) trustScore + receiptCount updated** on chain.
11. CLI/Studio prints summary + public Proof URL.

**Verification companion:**
```bash
ivaronix receipt verify <id> --tee-independent
```

**This single workflow proves:** private docs, encrypted storage, 5-role consensus, TEE independent verify, burn mode, action receipts, agent passport (ERC-7857), CLI + Studio + API + Hub, full 0G stack.

**One demo. Entire OS.**

---

## 7. Must Build First — Testnet-Complete MVP (no compromise)

**Strategy:** build the FULL product on Galileo testnet 16602 first. Full feature surface, end-to-end tested. Then promote to Aristotle mainnet 16661 as a single, deliberate event.

> Don't compromise. Build everything that can be built on testnet. Mainnet is a promotion, not a deploy step.

### 7.1 Studio (web app) — primary surface
1. Drop-zone hero + skill browser + report viewer
2. Public Proof URLs (`/r/<id>`)
3. Agent passport profile pages (`/@<handle>`)
4. Memory Permission Center
5. Wallet-native onboarding
6. Skill marketplace browse with 50+ skills

### 7.2 Forge CLI
7. All 7 modes (plan/build/audit/doc/swarm/watch/receipt)
8. `ivaronix doctor` all-green
9. `ivaronix doc ask --burn --consensus --receipt` end-to-end
10. `ivaronix receipt verify --tee-independent` 3-state output

### 7.3 API
11. OpenAI-compatible endpoints
12. Ivaronix extensions (memory, skills, consensus, policy, receipts)
13. MCP server (5 tools)

### 7.4 Receipts & Storage
14. Burn Mode (AES-256-GCM, session-key destruction, wording lock)
15. Encrypted 0G Storage with peekHeader
16. Canonical receipt schema with signing/hashing/upload/anchor pipeline
17. 9 receipt types working

### 7.5 Contracts (testnet first; promoted to mainnet at end)
18. `ReceiptRegistry` — receipt anchors
19. `Erc7857Verifier` — sealed-data integrity
20. `AgentPassportINFT` (ERC-7857) — agent identity
21. `CapabilityRegistry` — memory grants
22. `MemoryAccessLog` — audit trail
23. `SkillRegistry` — manifest hash anchors

### 7.6 Memory & Skills
24. 0G Storage KV pointers (passport, memory, skills, receipts)
25. SQLite + FTS5 + HNSW + temporal graph hybrid memory
26. Lifecycle hooks (PreToolUse/PostToolUse/SessionStart/SessionEnd/PreCompact/UserPromptSubmit)
27. **50+ skills ported from awesome-claude-skills**
28. 3 first-party 0G-native skills (`private-doc-review`, `0g-integration-auditor`, `github-audit`)
29. Skill scanner + sandbox + permission gate

### 7.7 Ecosystem citizenship
30. OpenClaw skill (`openclaw skills install ivaronix`)
31. Compatibility with awesome-claude-skills format + MCP server protocol

### 7.8 Quality
32. CI matrix green: receipt schema validation, wording-lint, receipt-verify roundtrip, contract tests
33. `ENGINEERING_DEBUG_LOG.md` ≥3 documented incidents (Provus playbook)
34. Public dashboard listing recent receipts; ≥100 testnet receipts auto-anchored

### 7.9 Mainnet promotion (Phase B)
35. Re-deploy all 6 contracts to mainnet 16661, verify on ChainScan
36. ≥100 mainnet receipts anchored from automation
37. ChainGPT audit application submitted

**Sequence:** items 1-34 on **testnet 16602** (Day 1-22). Items 35-37 on **mainnet 16661** (Day 23-30). See `BUILD.md §1`.

## 8. Build Later (Phase 3+, post-grant)

Roadmap, not grant submission:
- Trust Layer for teams (workspaces, shared memory, audit logs, approval workflows, compliance exports)
- Agent economy (escrow, agent-to-agent payments, marketplace settlement, royalties)
- Mobile / browser extension
- DA integration for high-volume event streams
- Voice / image gen / fine-tuning
- DAO governance
- Custom L1 / appchain on 0G DA
- Insurance / staking pools

---

## 9. What This Product Is NOT

Lock these to prevent scope creep:

- ❌ NOT a chatbot. It's a receipt-emitting agent OS.
- ❌ NOT a private LLM provider. It uses 0G Router.
- ❌ NOT another OpenAI-API wrapper. We extend with receipts, memory, skills, identity.
- ❌ NOT a wallet. We never hold user funds beyond gas / Router balance.
- ❌ NOT an "AI safety" tool that promises correctness. We promise *traceability*, not truth.
- ❌ NOT a marketplace gambit. Marketplace is a discovery moat, not a revenue line.
- ❌ NOT enterprise team workspace at MVP. (Phase 3.)

---

## 10. Killer Demo Beats Killer Architecture

Single guiding rule:

> **Big architecture. Narrow insane demo.**

The demo is the doc-ask + burn + 5-role consensus + receipt + verify workflow — **first end-to-end on testnet 16602, then promoted to mainnet 16661** as the submission moment. Everything else exists to support that one workflow flowing flawlessly across all 5 surfaces. Architecture diagrams without the workflow shipping = grant rejection.

---

## 11. Why Ivaronix Beats Other 0G Projects

Most 0G projects pick one lane:

| Project | Lane |
|---|---|
| MindVault / SealedMind | Memory |
| AgentPay / zer0Gig | Payments |
| Agent0G | Marketplace / workflow builder |
| ChainShield / BuildProof | Audit / proof |
| Don't Get Drained | Safety / firewall |
| AlphaDawg / MUSASHI | Consensus / debate |
| Aishi | Companion identity |
| 0GClaw | Scheduled autonomy |
| Provus | Real-time trading attestation |
| ShadowFlow | Workflow DAGs |

**Ivaronix combines** Memory + Identity + Skills + Permissions + Consensus + Receipts + CLI + API + Studio + Marketplace + Reputation **into one OS** — best-of-class at every layer (see `REFERENCE_PATTERNS.md` for proofs) — and demos through ONE workflow:

```
Private docs/code → 5-role consensus → burn mode → action receipt → agent passport
```

Ivaronix doesn't out-feature any single project. It *unifies the receipt primitive* under one OS that every 0G developer wants installed. **Plus it ships with 50+ skills out of the box that no other 0G project comes close to matching.**

---

## 12. Monetization (honest)

| Layer | Will it monetize? | Real answer |
|---|---|---|
| Receipts (paid per-receipt) | Maybe | Real if regulated industries adopt. Free at MVP. Charge later. |
| Skill Marketplace (revenue split) | Probably not at scale | Marketplaces die from supply-or-demand collapse. Ship as verified registry; revenue split is opt-in for skill creators who want it. **Don't bet company on this.** |
| Pro subscription ($99-$999/mo) | Likely | Realistic revenue line for power users + small teams. Phase 2. |
| Enterprise / Trust Layer | Most likely real revenue | Compliance + audit logs + team policies sell to regulated industries. Phase 3. |

**Strategy:** marketplace is a discovery + trust moat. Pro is the realistic revenue line. Enterprise is the upside.

---

## 13. Honest Risks

| Risk | Mitigation |
|---|---|
| Scope death (37 items is a lot) | Sequenced into 30-day testnet-then-mainnet plan with daily gates (`BUILD.md §1`) |
| Half-shipped features at submission | Testnet-first means full feature surface verified before mainnet OG spent |
| Studio quality bar (must be beautiful) | Use Vercel-stack + shadcn/ui; treat polish as a Day 19-22 dedicated phase, not afterthought |
| 50 skill ports take longer than estimated | Skill ports are mechanical: parse SKILL.md → produce manifest.json → run sandbox tests. Day 14-15 dedicated. |
| Independent TEE verify slips | Day 5 hard gate; non-negotiable; the most 0G-native CLI feature |
| "Burn Mode" wording overclaims | Wording lock in `RECEIPTS_SPEC.md §5`, CI-enforced via `BUILD.md §9` |
| Marketplace may never monetize | Designed as discovery moat; Pro/Enterprise are the revenue lines |
| Contracts have unknown bugs at promotion | Phase A end-to-end test on testnet finds them first; ChainGPT audit applied for during Phase B |
| Money | Phase A on testnet faucet (free); Phase B mainnet ~2 OG (≈$10) total |

---

## 14. Success Criteria for Grant Submission

### Phase A — Testnet Complete (Day 22 gate)

- [ ] All 6 contracts deployed + verified on testnet 16602
- [ ] Studio live, drop-zone works, skill browser shows 50+ skills, public Proof URLs render
- [ ] CLI binary installable: `npm i -g @ivaronix/forge`
- [ ] `ivaronix doc ask --burn --consensus --receipt` returns testnet anchor in <60s
- [ ] `ivaronix receipt verify --tee-independent` shows all 3 states
- [ ] ≥100 testnet receipts anchored from automation
- [ ] Three first-party skills + 50+ ported skills working
- [ ] Memory grant/revoke + access log working
- [ ] Lifecycle hooks firing
- [ ] OpenClaw skill installable; MCP server reachable
- [ ] Memory Permission Center live in Studio
- [ ] Public Proof URLs SEO-friendly
- [ ] `ENGINEERING_DEBUG_LOG.md` ≥3 documented incidents
- [ ] CI green (schema, wording-lint, receipt-verify roundtrip, contract tests)
- [ ] Demo GIF / 60-second screencast in README

### Phase B — Mainnet Promotion (Day 30 gate)

- [ ] All 6 contracts re-deployed + verified on mainnet 16661, addresses in README
- [ ] `ivaronix doctor --network mainnet` all-green
- [ ] First mainnet receipt fully verified, public Proof URL works
- [ ] ≥100 mainnet receipts anchored
- [ ] Studio defaulted to mainnet; testnet receipts filterable
- [ ] README has live metric block (TX count, uptime, latency, cost-per-receipt)
- [ ] No banned phrases anywhere (CI green per `BUILD.md §9`)
- [ ] ChainGPT audit application submitted
- [ ] Twitter/X thread drafted (visibility)
- [ ] `PITCH.md §8` checklist all green

**The Provus playbook with full Nexus depth.** That's the bar.

---

## 15. Doc Map

| Doc | Holds |
|---|---|
| `PRD.md` (this doc) | Wedge, surfaces, layers, MVP scope, monetization, success criteria |
| `HLD.md` | Architecture: monorepo, contracts, CLI, Studio, daemon, data flows |
| `BUILD.md` | Operational: 30-day plan, env, SDK quirks, deploy steps, automation |
| `COMPONENTS.md` | **Per-component UX decisions** (Studio screens, CLI surfaces, visual language) sourced from cross-folder analysis |
| `RECEIPTS_SPEC.md` | Canonical receipt schema (RFC-style) |
| `REFERENCE_PATTERNS.md` | Extracted contract + pipeline patterns from showcase + entries |
| `PITCH.md` | Grant pitch + per-audience positioning + bounty mapping |
| `0G_TESTNET_NOTES.md` | Live testnet wallet + pricing |
| `entries.md` | Competitor scorecard |

If a topic appears in two docs, **the doc closer to "single source of truth" wins**:
`RECEIPTS_SPEC > REFERENCE_PATTERNS > COMPONENTS > BUILD > HLD > PRD > PITCH`.

When in doubt, link, don't duplicate.

**Component-level rule:** if a doc describes how a Studio screen, CLI surface, or visual chip should look, it MUST link to `COMPONENTS.md` rather than restate. `COMPONENTS.md` is the single source for "what should it look and feel like?"

---

## 16. Voice / Brand Wording (locked, CI-enforced)

**Use:**
- "0G Agent Operating System"
- "AI Action Receipts on 0G"
- "Burn Mode" (with footnote: session key destroyed; ciphertext remains on Storage but is unreadable)
- "Adjudicated Consensus" / "agreement score"
- "Agent Passport" / "ERC-7857 INFT"
- "Independently TEE-verified" / "Router-flag verified"
- "Storage Verified" / "Chain Anchored" badges (only when the SDK / on-chain state confirms)
- "Memory Permission Center"
- "Skill Registry" (NOT "skill marketplace" until revenue split is live)
- "Hybrid memory" (vector + temporal graph + FTS + KV)

**Never use:**
- "Truth score"
- "Verified by AI"
- "Deleted from blockchain"
- "Burnt off-chain"
- "Guaranteed safe"
- "100% private" / "fully private" (overclaim — say "operator-side private" with the scope footnote)
- "Decentralized AI" (overclaim — Router routes; only TEE inference is sealed)
- "Plain-text deletion" (ambiguous — never deleted; key destroyed)
- "AI proofs" (vague; say "AI Action Receipts")
- "End-to-end private" (overclaim — local machine is out of scope)

**Burn Mode honest-scope footnote** (must accompany any Burn Mode marketing or surface UI):

> Burn Mode protects against operator-side disclosure. It does NOT protect against compromise of the user's local machine — local plaintext copies (editor history, terminal scrollback, swap files, browser cache) remain under the user's control. For end-to-end privacy, combine with full-disk encryption + swap disabled + terminal/editor history disabled.

See `RECEIPTS_SPEC.md §5` and `COMPONENTS.md §14` for the canonical wording.

---

## 17. Pitches (canonical)

### For Users
> Private AI agents that read your docs, remember your context, burn secrets, and prove what they did.

### For Developers
> OpenCode-style AI agent workspace with 0G memory, skills, consensus, and receipts.

### For Teams
> Govern AI agents before they touch files, tools, wallets, code, customers, or private memory.

### For Skill Creators
> Publish trusted skills and earn when agents use them.

### For 0G Labs
> Ivaronix turns 0G Compute, Storage, Chain, DA, ERC-7857/AgenticID, and Router into one daily-use Agent OS.

### YC pitch
> AI agents are moving from chat to action. But action creates risk: agents read private data, run skills, touch code, call APIs, access wallets, and make decisions without proof. Ivaronix is the 0G-native Agent OS that gives agents private memory, permissioned skills, consensus review, burn mode, action receipts, identity, CLI/API/Studio, and 50+ skills out of the box. We start with private docs/code agents and expand into the trust layer for all action-taking AI agents.

---

**End of PRD.** Implementation in `HLD.md`. Operational steps in `BUILD.md`. Receipt shape in `RECEIPTS_SPEC.md`.
