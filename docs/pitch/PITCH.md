# Ivaronix — Pitch Deck (text form)

> **Status:** v3 (full Nexus vision, locked 2026-05-07).
> **Audiences covered:** OG Labs grant judges, OG ecosystem partners, developer users, hackathon judges, OG APAC track, skill creators, regulated-industry early adopters.
> **Sister docs:** `PRD.md` (product), `HLD.md` (architecture), `BUILD.md` (30-day plan), `REFERENCE_PATTERNS.md` (proof of due diligence), `RECEIPTS_SPEC.md` (RFC).

---

## 0. Wording Lock for All Pitches

These phrases must appear in every pitch surface (or strict variant). Anti-phrases banned everywhere (CI-enforced — see `BUILD.md §9`).

| Use | Don't use |
|---|---|
| "0G Agent Operating System" | "AI infra platform" |
| "AI Action Receipts on 0G" | "AI proofs", "verified AI" |
| "Burn Mode (session key destroyed)" | "deleted from blockchain", "burnt off-chain" |
| "Adjudicated Consensus" / "agreement score" | "truth score" |
| "Agent Passport (ERC-7857 INFT)" | "AI NFT" |
| "Independently TEE-verified" | "verified by AI" |
| "Storage Verified" / "Chain Anchored" badges | "100% private", "fully decentralized" |
| "Hybrid memory" (vector+graph+FTS+KV) | "AI memory" (vague) |
| "Skill Registry" (until revenue split lives) | "AI marketplace" (overpromise) |

---

## 1. The 30-Second Pitch (audience-specific)

### For end users (Studio, Twitter, ProductHunt, marketing)

> **Catch the risks. Keep the receipts.** Drop any contract, repo, or PDF into Ivaronix Studio. AI agents review it three ways and disagree out loud — you see the conflicts, not a lukewarm average. Every important finding is anchored on 0G mainnet so you can prove what was caught (and when) without revealing the document. Ships with 50+ skills, runs in <60s, costs cents.

### For 0G ecosystem (grant judges, Discord, build.0g.ai)

> Ivaronix is the **0G-native Agent Operating System.** AI agents get private memory, permissioned skills, adjudicated consensus, burn mode, action receipts, and an ERC-7857 passport that follows your wallet. Run `ivaronix doc ask contract.pdf --burn --consensus --receipt` (CLI) or drop a file into Studio — and in <60 seconds you get an encrypted upload to 0G Storage, a TEE-verified consensus, an action receipt anchored on 0G mainnet, and a passport that compounds reputation over time. Ships with 50+ skills out of the box plus `@ivaronix/og-toolkit` — clean DX wrappers that every 0G app eventually wants.

---

## 2. The 90-Second Pitch (grant judges)

**Problem.** AI is moving from chat to action — auditing code, reviewing contracts, summarizing private docs, calling APIs, even sending transactions. But every action creates risk: what model answered, which skill ran, what data was touched, was permission granted, can the output be traced. Today nobody has receipts for AI actions. Off-chain logs can be forged or predated.

**Solution.** Ivaronix is the **0G Agent Operating System** — five surfaces (Studio, Forge CLI, API, Skill Registry, Trust Layer) sharing one spine: the **Action Receipt**.
- 0G Storage Merkle root for the encrypted artifact
- 0G Chain anchor for the receipt hash on mainnet 16661
- **Independent** TEE verification via 0G Compute (not just Router-flag)
- ERC-7857 Agent Passport that signs and accumulates reputation
- 50+ skills installable on day 1 (ports of `awesome-claude-skills`)

**Demo (CLI):**
```bash
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
```

**Demo (Studio):** drop file in browser → click "Run" → get verifiable audit report with public Proof URL.

**Traction (target by submission).** ≥100 mainnet receipts + ≥100 testnet receipts anchored. 6 contracts on mainnet 16661, all verified on ChainScan. Studio live with 50+ skills + public Proof Explorer.

**Why we win.** No 0G project owns "the receipt itself" as a primitive. MindVault = memory; SealedMind = sealed memory; AlphaDawg = signals; Provus = trading attestations; Aishi = companion identity. **Ivaronix unifies all of these layers under one OS** — every layer best-of-class against showcase + entries (see `REFERENCE_PATTERNS.md`) — and is the **only 0G project shipping with a real Studio + 50+ skill marketplace at MVP.**

---

## 3. The 5-Minute Pitch (deep-dive)

### 3.1 Wedge
**0G Agent Operating System.** AI agents that remember privately, use skills safely, take action, and prove what they did on 0G. Every action emits a canonical receipt (`RECEIPTS_SPEC.md`) signed by the agent's owner wallet, anchored on 0G mainnet, with TEE attestation independently verifiable from CLI or Studio.

### 3.2 Five surfaces
1. **Studio** (Next.js + Tailwind v4 + shadcn/ui on Vercel) — primary user surface. Drop-zone hero, skill browser, audit report viewer, public Proof URLs, agent passport profiles, Memory Permission Center.
2. **Forge CLI** — developer surface. 7 modes (plan/build/audit/doc/swarm/watch/receipt). Synthesizes OpenCode + Hermes + Octogent + claude-mem + awesome-claude-skills + 0G receipts.
3. **API + MCP server** — OpenAI-compatible HTTP + Nexus extensions + 5 MCP tools.
4. **Skill Registry** — 50+ skills out of the box, on-chain manifest hash anchors, sandbox + scanner, opt-in revenue split.
5. **Trust Layer** — Phase 3, teams + DAOs + regulated industries. Realistic enterprise revenue.

### 3.3 Seven layers (each best-of-class on 0G)
| Layer | 0G primitive | Best-of-class beats |
|---|---|---|
| Identity | Chain (ERC-7857) + Storage + KV | Aishi + MUSASHI + SealedMind + MindVault + AIsphere (strict superset) |
| Memory | Storage + KV + Sealed Inference | SealedMind + MindVault + Graphiti + claude-mem (only 4-way hybrid) |
| Skill | Manifest + on-chain registry + sandbox | awesome-claude-skills + MCP + OpenClaw (compatible with all three) |
| Action | Policy engine + safety guard | Don't Get Drained + ChainShield |
| Consensus | 5 roles + 7-gate fail-fast | AlphaDawg + MUSASHI (superset of both) |
| **Receipt** | Storage + Chain (THE wedge) | Provus + MUSASHI (typed receipts + 3-state verify, neither has) |
| Reputation | Passport `trustScore` | Provus ELO + MUSASHI strikes (hybrid) |

### 3.4 Core demo
**CLI:**
```bash
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
```
**Studio:** drop file → pick skill → toggle Burn Mode + Consensus → click "Run" → see report → click "Share" → copy public Proof URL.

End-to-end on **mainnet 16661** in <60 seconds, costing <0.02 OG (~$0.10).

```bash
ivaronix receipt verify <id> --tee-independent
# → CLAIMED → ANCHORED → FULLY VERIFIED
```

### 3.5 Differentiation (sharp version)
- **Multi-primitive use, deeply.** Storage + Compute + Chain + INFT + KV + Sealed Inference. Most entries use 1-2 primitives.
- **Mainnet rehearsal.** Phase A is a 22-day testnet rehearsal of the entire product before any mainnet OG is spent. Most entries deploy directly to mainnet under pressure.
- **Independent TEE verify.** Most projects stop at `verify_tee: true`. We use `broker.inference.processResponse()` post-hoc per role.
- **5-role consensus** vs. AlphaDawg's 3 / MUSASHI's 4.
- **9 typed receipt types** with **3-state verification UI**. No competitor has either.
- **Hybrid memory** (vector + temporal graph + FTS + KV). No competitor has all four.
- **50+ skill marketplace** at MVP. No competitor has more than ~10.
- **First Studio in 0G ecosystem.** Most entries are CLI-only or backend-only.
- **Live metrics.** ≥100 mainnet + ≥100 testnet receipts by submission, real uptime/latency/cost numbers in README. Provus playbook with depth.

### 3.6 Roadmap
- **Phase A — Testnet Complete (Day 1-22):** Studio + CLI + API + 50-skill marketplace + 6 contracts + ≥100 testnet receipts. Full feature surface.
- **Phase B — Mainnet Promotion (Day 23-30):** re-deploy 6 contracts, ≥100 mainnet receipts, ChainGPT audit applied for, submission filed.
- **Phase 2 (post-grant):** Pro subscription tier ($99-$999/mo), expanded skill marketplace with revenue split, advanced workflow DAGs (ShadowFlow style), team-mode alpha.
- **Phase 3 (year 1):** Trust Layer for teams (workspaces, shared memory, audit logs, approval workflows, compliance exports). Realistic enterprise revenue.
- **Phase 4 (year 1.5):** Agent economy (escrow, agent-to-agent payments, royalties).
- **Phase 5+:** Mobile, browser extension, DA integration for high-volume event streams.

### 3.7 What we will NOT build (locked)
- A chatbot / OpenAI wrapper. Ivaronix is an OS.
- A wallet. We never hold user funds.
- An "AI safety" tool that promises correctness — we promise *traceability*.
- Marketplace as a revenue line. It's a discovery moat.
- Voice / image gen / fine-tuning at MVP.
- A new L1 / appchain on 0G DA.

---

## 4. Per-Audience Positioning

### 4.1 OG Labs grant team
**Lead with:** Studio URL + mainnet contract addresses + ≥100-receipt count + verifiable Proof Explorer. They click → Studio loads → drop sample file → see live mainnet receipt in 60s. **Do not lead with architecture diagrams** — every applicant has those; few have a working Studio + 50 skills + 6 mainnet contracts.

### 4.2 0G ecosystem developers (X/Twitter, Discord)
**Lead with:** "What if every Claude Code session shipped with mainnet receipts?" Demo GIF showing `ivaronix doc ask` and clicking through to ChainScan. Tag `@0G_labs`. Highlight: "openclaw skills install ivaronix" works.

### 4.3 OpenClaw / Claude Code users
**Lead with:** `openclaw skills install ivaronix`. One command, your Claude Code stack now produces mainnet receipts. Plus 50+ skills you already know (awesome-claude-skills) now have on-chain reputation.

### 4.4 0G APAC Hackathon
**Lead with:** the only 0G project shipping a real Studio + 50-skill marketplace at MVP. Use Chinese-language demo command + APAC-friendly time-zone live demo.

### 4.5 Web3 security auditors
**Lead with:** every audit produces a verifiable mainnet receipt. The auditor's reputation now lives on-chain via passport. Specialized skills include `0g-integration-auditor`, `github-audit`, `security-audit`, `threat-modeling`. Career compounds on-chain.

### 4.6 Skill creators
**Lead with:** publish a skill, earn rep on every run, opt into revenue split (Phase 2). Free verified registry, sandbox-protected install. Your skill's manifest hash is on-chain — provenance permanent.

### 4.7 Investors (post-grant fundraise — premature for now)
Lead with: "horizontal trust infra for AI agents — receipts are the AWS S3 of agent verifiability." Don't pitch VCs until ≥1000 mainnet receipts and a paying user.

---

## 5. Bounty / Track Mapping (à la AlphaDawg's CLAUDE.md)

Every Ivaronix feature maps to a 0G ecosystem bounty/track when applicable:

| Feature | Maps to | Why |
|---|---|---|
| ReceiptRegistry on mainnet | 0G Chain track / Build with 0G | Real on-chain product |
| ERC-7857 Agent Passport | 0G iNFT / AgenticID track | First-class ERC-7857 use |
| Burn Mode + AES-256-GCM | 0G Storage track | Encryption pattern showcase |
| Independent TEE verification | 0G Compute / Verifiable Execution | Stronger than Router-flag |
| OpenClaw skill ship | OpenClaw integration prize | Ecosystem citizenship |
| MCP server | (no specific bounty — credibility) | Composability win |
| Studio + Proof Explorer | 0G developer experience | Public artifact |
| 50+ Skill Marketplace | (no specific bounty — moat) | "Apple App Store at launch" effect |

**When applying for the grant, line up the feature → track mapping in the form. Don't make judges figure it out.**

---

## 5.5 Internal-Priority Alignment Signals (timing matters)

The 0G team has signaled — through recent partnerships, public statements, and organizational moves — exactly which problems are in their attention window right now. Name these alignments explicitly in the application.

| 0G internal signal | Source / date | Our match — call out by name |
|---|---|---|
| **AI agents as the unit of work** — Heinrich's May-2026 layoff memo: "We build the infrastructure for the AI agent economy. Every day we talk about a world where AI agents handle the work humans used to do." | CEO email to staff, May 2026 | We are an **AI Agent Operating System**. Every action is a verifiable receipt produced by an agent. This is not adjacent to their thesis — this is their thesis, in code. |
| **Agent-to-agent payments** | OKX Agent Payments Protocol partnership (months-old) | Our **SkillRegistry creator-fee-split** is on-chain agent monetization with basis-point precision. Track 3 (Agentic Economy) wedge. |
| **TEE / private compute as flagship** | 0G Private Computer launch; Ming Wu's repeated TEE posts | Our **TIER-1 receipt marking** + `--tee-independent` re-verify is more honest than soft-fail-to-mock peers (AIsphere). |
| **Open-model priority** | Alibaba Qwen integration; Ming Wu promotes Qwen + GLM-5 | Our **default model is `qwen/qwen-2.5-7b-instruct`** on 0G Compute broker — locked in BUILD.md §11.4. |
| **Hardware-grade trust framing** | NVIDIA Inception membership | Our **TEE-tier honesty** mirrors hardware-rooted-trust framing: receipts mark whether attestation was actually fetched, not just claimed. |
| **APAC / bilingual reach** | JT Song's APAC events; Ming Wu posts bilingually; Ada Heinrich East-West narrative role | Bilingual README pass (English + 中文) is on the roadmap. Costs little, doubles addressable judge audience. |
| **"Don't trust, verify" as core philosophy** | Heinrich's repeated public framing | Our entire receipts thesis is the literal sentence "don't trust, verify" applied to AI actions. Use the phrase verbatim in the pitch. |
| **Apollo Accelerator** (4% acceptance) | Public program — Stanford-level selectivity | The deeper-engagement path post-grant. Frame the application with Apollo as the next step. |

**Rule:** when a 0G announcement, partnership, or staff statement matches one of our features, **name it by name** in the relevant pitch slide. Judges read alignment with their roadmap as proof we did the homework. This is not flattery — it's evidence that the receipts thesis is timely, not speculative.

---

## 6. Resources / Official Links (verified)

> All links verified against `oglabs resources/0g-doc/` and `0g-doc/docs/ai-context.md` on 2026-05-07. **The chain ID `16600` previously listed in `0G_OFFICIAL_LINKS.md` was incorrect.** Correct mainnet chain ID is `16661`.

### 6.1 Dev resources
- 0G Docs: https://docs.0g.ai
- 0G Build Portal: https://build.0g.ai
- 0G SDKs: https://build.0g.ai/sdks
- 0G Showcase: https://build.0g.ai/showcase
- 0G GitHub: https://github.com/0gfoundation

### 6.2 On-chain tools
- 0G Compute Marketplace: https://compute-marketplace.0g.ai
- 0G StorageScan (mainnet): https://storagescan.0g.ai
- 0G Explorer: https://explorer.0g.ai
- 0G ChainScan (mainnet): https://chainscan.0g.ai
- 0G ChainScan (testnet): https://chainscan-galileo.0g.ai
- 0G Faucet (testnet): https://faucet.0g.ai
- **Mainnet Chain ID: `16661`** (Aristotle)
- **Testnet Chain ID: `16602`** (Galileo)

### 6.3 Official channels
- Website: https://0g.ai
- Twitter/X: https://x.com/0G_labs
- Discord: https://discord.com/channels/1210423309808963594/1213988718646526023
- Blog: https://0g.ai/blog
- GitHub (foundation): https://github.com/0gfoundation

### 6.4 0G APAC
- 0G APAC Twitter/X: https://x.com/0G_cn
- 0G APAC DEV Telegram: https://t.me/zerog_apac_dev
- 0G APAC Hackathon 2026: https://www.hackquest.io/zh-cn/hackathons/0G-APAC-Hackathon
- HackQuest Twitter/X: https://x.com/HackQuest_

### 6.5 APAC contacts (use only when relevant; respect time zones)
- Project Growth: `@BVspark`
- Project BD: `@vanessaaal7`
- Project Integration & DevRel: `@dragon0195`

### 6.6 Safety rules
- 0G team will **never** DM asking for funds, private keys, seed phrases, or transfers. Treat such DMs as scams.
- Trust only links above. Verify any other link against `https://docs.0g.ai` or `https://github.com/0gfoundation`.
- Some local docs may carry stale chain IDs (e.g., `16601`). Re-check official docs before any mainnet deployment.

---

## 7. The Single Slide

```
                  ┌─────────────────────────────────┐
                  │       I V A R O N I X            │
                  │                                  │
                  │  The 0G Agent Operating System  │
                  │                                  │
                  │  Studio · CLI · API · Skills · │
                  │  Trust Layer                     │
                  │                                  │
                  │  $ ivaronix doc ask doc.pdf      │
                  │       --burn --consensus         │
                  │       --receipt                  │
                  │                                  │
                  │  → 0G Storage root               │
                  │  → 0G Chain anchor (16661)       │
                  │  → ERC-7857 Passport             │
                  │  → Independently TEE-verified    │
                  │  → 50+ skills installable        │
                  │                                  │
                  │  127 mainnet receipts │           │
                  │  99.4% uptime │                   │
                  │  0.011 OG/receipt                 │
                  │                                  │
                  │  github.com/.../ivaronix         │
                  │  ivaronix.com/r/<id>             │
                  └─────────────────────────────────┘
```

The metrics in the slide must be **real and verifiable on-chain at the moment of submission**. No vanity numbers.

---

## 8. The Submission Checklist

Two-gate approach: Phase A (testnet-complete) is a hard pre-requisite for Phase B (mainnet promotion). Don't skip Phase A.

### Phase A — Testnet Complete (Day 22 gate)

- [ ] All 6 contracts deployed + verified on testnet 16602
- [ ] **Studio live** on Vercel preview, drop-zone works, skill browser shows 50+ skills, public Proof URLs render
- [ ] Forge CLI installable: `npm i -g @ivaronix/forge`
- [ ] `ivaronix doctor` all-green on testnet
- [ ] `ivaronix doc ask <pdf> --burn --consensus --receipt` returns testnet anchor in <60s
- [ ] `ivaronix receipt verify <id> --tee-independent` shows all 3 verification states
- [ ] ≥100 testnet receipts anchored from automation
- [ ] All 3 first-party skills + ≥50 ported skills installed and working
- [ ] Memory grant/revoke + access log working
- [ ] All 6 lifecycle hooks firing automatically
- [ ] OpenClaw skill installable: `openclaw skills install ivaronix`
- [ ] MCP server reachable; 5 tools exposed
- [ ] apps/api OpenAI-compatible endpoints live
- [ ] `ENGINEERING_DEBUG_LOG.md` ≥3 documented incidents
- [ ] CI matrix green: schema validation, wording-lint, receipt-verify roundtrip, contract tests
- [ ] Demo GIF / 60-second screencast in README

### Phase B — Mainnet Promotion (Day 30 gate)

- [ ] All 6 contracts re-deployed + verified on mainnet 16661, addresses in README
- [ ] Studio defaulted to mainnet 16661
- [ ] First mainnet receipt fully verified from public Proof URL
- [ ] ≥100 mainnet receipts anchored
- [ ] 50+ skills re-anchored on mainnet `SkillRegistry`
- [ ] README has live metric block: real TX count, uptime, latency, cost-per-receipt — verifiable on-chain
- [ ] No banned phrases anywhere (CI green per `BUILD.md §9`)
- [ ] Twitter/X thread published (visibility for grant judges who lurk)
- [ ] ChainGPT audit application submitted (free; weeks of lead-time; apply early)
- [ ] OG Labs grant form filled and submitted

If even one box is unchecked, **delay submission**. Provus, MUSASHI, SealedMind didn't ship half-done. Neither do we.

---

**End of PITCH.**
