# Ivaronix · Planning 01 — Parked Decisions

> Status: **PARKED**, not built.
> All items below are decisions we agreed on the strategy for. Full implementation plan, scope, and sequencing TBD next session. Captured here so we don't lose them.
>
> Each item has been ranked into one of three tiers based on win-probability lift vs the 8 OG showcase projects:
> - **Tier 1**: locked, ship first (hours, not days). Non-negotiable for the grant.
> - **Tier 2**: high-impact, week-scale. What gets us from finalist to top 3.
> - **Tier 3**: interesting, sequence later. What gets us to showcase placement post-grant.

---

## Tier 1 · Locked, ship first

### 1A. Privileged-document hero copy on home page → ✅ DONE

- **Headline shipped:** *"AI review for the documents you* **can't paste** *into ChatGPT."* (italic accent on `can't paste` via Instrument Serif). Picked candidate #1 because it names the substitution-blocker (ChatGPT) most concretely; per §12.5 genie rule, intent over letter — user said "go finish" without naming a headline, so I shipped the strongest concrete option. Trivial to swap to #2/#3/#4/#5 if requested (one-line edit in `apps/studio/src/app/page.tsx:113-115`).
- **Sub-headline shipped:** "Drop a contract, NDA, or term sheet covered by privilege or counterparty confidentiality. Burn Mode encrypts it; the session key is destroyed after the run. The audit ships an Action Receipt anchored on 0G Chain with the key fingerprint inside — **anyone can independently re-verify it from any machine**, even after the document is gone."
- **CTAs shipped:** primary "Run a private audit →" → `/onboard`. Secondary "See a sample receipt" → `/r/1004` (the FULLY VERIFIED TIER 1 receipt).
- **Page metadata:** `<title>` and `openGraph.title` both updated to match.
- **§11 e2e proof captured** (`screenshots/hero/`):
  - `01-studio-home-desktop.png` — disconnected state, 1440×900
  - `02-studio-home-connected.png` — connected via real MM popup, header chip `0xaa95…77Ce`
  - `03-studio-sample-receipt.png` — `/r/1004` lands cleanly from secondary CTA
  - `04-studio-onboard-from-cta.png` — `/onboard` lands cleanly from primary CTA
  - `05-studio-home-mobile.png` — 375×812 mobile, italic accent preserved
  - `06-brand-html-desktop.png` + `07-brand-html-mobile.png` — side-by-side reference
  - Plus `.webm` video recording of the full session.
- **Computed-style audit (§10 visual contract):** h1 fontSize 80px, fontFamily Outfit, body bg `rgb(250,250,247)` = `#FAFAF7` paper, body ink `rgb(10,10,10)` = `#0A0A0A`, header height 64px, header backdrop `saturate(1.5) blur(20px)`. All tokens match brand contract.
- **Verification script:** `scripts/qa/metamask-e2e/verify-hero.ts` — re-runnable end-to-end with real MM extension, both viewports, side-by-side capture.

### 1B. Confidential Data Room — see §2 below
- See full spec in §2.

### 1C. 3-page narrative pitch document
- **Why:** closes Criterion 2.5 (Documentation) head-on vs AIsphere's 19-page whitepaper. Judges who don't read code score this.
- **Structure (one page each):**
  - **What is Ivaronix · who is it for · why now.** Privileged-document persona up top, the receipt model in the middle.
  - **The receipt model:** schema → canonical hash → TIER 1 vs TIER 2 → independent re-verify path. Cite `RECEIPT_SCHEMA.md` for depth.
  - **Growth roadmap:** Year 1 (testnet → mainnet → first 10 firms) → Year 2 (skill marketplace → embeddable verifier) → Year 3 (cross-chain receipts → SOC2-style trust framework).
- **Effort:** half a day of writing, no code.
- **Saves score across all 5 criteria simultaneously**, not just 2.5 — the doc is what a non-technical judge reads to understand the rest.

---

## Tier 2 · High-impact, week-scale

### 2A. TEE-Bound Delegated AI Agent — see §3 below
- See full spec in §3 (was §1 before re-tier).

### 2B. Memory consolidation lifecycle on AgentPassport
- **Why:** Aishi (showcase #1) wins 2.1 partly on memory consolidation depth — daily → monthly → yearly memory rollups anchored on chain. We currently have receipts but no consolidation tier on `AgentPassportINFT`.
- **What to add:**
  - New passport fields or sidecar contract: `dailyMemoryRoot`, `monthlyMemoryRoot`, `yearlyReflection` per agent.
  - CLI commands: `ivaronix passport consolidate --day | --month | --year` — runs a TEE-attested consolidation pass over the agent's recent receipts and anchors the rollup.
  - Each consolidation event itself ships a receipt (so you can verify the consolidation itself wasn't fabricated).
- **Closes:** Criterion 2.1 specifically vs Aishi. Applied to our reviewer personas, this becomes "Adam the term-sheet hawk has reviewed 142 contracts; here is his monthly summary of the patterns he keeps flagging."

### 2C. Cron-scheduled skill execution
- **Why:** 0GClaw (showcase) wins on "active INFT" — cron-scheduled autonomous execution + x402 micropayments. We currently fire on user trigger only.
- **What to add:**
  - `ivaronix skill schedule <id> --cron "0 9 * * MON" --input <file-or-prompt>` — registers a schedule on chain (or in a daemon).
  - On every fire: run the skill, anchor a receipt, settle the fee split automatically to the creator's passport.
  - Studio surface: a "Scheduled Runs" tab on `/dashboard` showing next-fire timestamps and recent receipts per schedule.
- **Strengthens Track 3:** creators earn passive income from scheduled skill execution, not just per-run.

---

## Tier 3 · Interesting, sequence later

### 3A. Memory DAG / prior-receipt context retrieval
- **Why:** AlphaDawg's memory loop (every reasoning cycle loads prior `priorCids` from 0G Storage as context) is what turns their bot from stateless into a learning agent. We anchor receipts but don't feed past receipts into the next run as context.
- **What to add:**
  - Before each skill run: load the agent's last N receipts of the same type from local indexer, summarize, prepend to system prompt as `--- PRIOR RUNS CONTEXT ---`.
  - Optional flag: `--memory-depth 5` (default 3, max 20).
  - Receipt records `request.priorReceiptIds: [...]` so the lineage is verifiable.
- **Effect:** "Adam the term-sheet hawk" gets sharper over time because he reads his own past receipts. Closes 2.1 deeper.

### 3B. Visual skill creation flow
- **Why:** Agent0G (showcase) ships a no-code workflow builder. Our skills require TypeScript module authoring — Track 3 onboarding bar is high.
- **What to add:**
  - Studio page `/skill/new` where a creator composes a skill from primitives without editing code: system prompt textarea + role config dropdown + fee split sliders + permission checkboxes + tier default selector.
  - Live preview of the resulting `SKILL.md` frontmatter as the creator edits.
  - One-click "Publish to SkillRegistry" that mints the skill on chain.
- **Lowers** the bar for non-dev creators dramatically.

### 3C. Receipt-as-firewall wiring
- **Why:** Don't Get Drained (showcase) is wired into Safe Guard execution path — receipts gate transactions, they don't just log them. We produce receipts but don't gate any external action.
- **What to add:**
  - Solidity helper: `IvaronixReceiptGuard.requireValidReceipt(receiptId, expectedAgent, expectedSkillId)` — reverts if the receipt isn't FULLY VERIFIED on `ReceiptRegistry`.
  - Any external dapp can require an Ivaronix TIER 1 receipt before executing a tx. We become a *gate*, not just a *log*.
  - Demo: a Safe wallet that requires a `private-doc-review` receipt before approving a vendor contract payment.

### 3D. Embeddable receipt-verifier widget
- **Why:** distribution moat. The `broker.processResponse` re-verify is currently CLI-only. If any external website can render "verify this Ivaronix receipt" inline, our brand surfaces beyond our own domain.
- **What to ship:**
  - `<ReceiptVerifier id="1004" />` React component, npm-published as `@ivaronix/widget`.
  - `<iframe src="https://ivaronix.studio/embed/r/1004">` fallback for non-React sites.
  - Renders the four-light row, TIER badge, and a "verify" button that calls our public `/v1/receipt/<id>` endpoint.
- **Effect:** judges see Ivaronix everywhere on the open web, not just on our own site.

---

## §3 · TEE-Bound Delegated AI Agent (full spec)

**On TEE_HEE specifically:** it is performance art. "AI that owns its own Twitter" wins press, not OG showcase. OG showcase rewards depth on 0G primitives + a real user pull — that's why Aishi ranks #1 (full-stack 0G companion architecture), not "first autonomous AI." Don't fork it.

**One idea worth stealing from that whole list:** TEE-bound identity for the agent itself. Not "user signs from their wallet, runs an AI, gets a receipt." Instead: the AI has its own AgentPassportINFT, its own signing key that never leaves 0G Compute TEE, and the user grants/revokes capabilities via CapabilityRegistry. Every action the AI takes is signed by a key only the TEE controls — re-verifiable via `broker.processResponse`.

**That maps Ivaronix to:** *"I want an AI specialist to handle my contract reviews / data room access / repo audits. The AI has its own identity. Every action it takes is signed by the TEE, not by me or the operator. I can revoke at any time."*

**This uses every primitive we have at depth:** AgentPassportINFT (AI identity), CapabilityRegistry (user grants/revokes), 0G Compute (TEE-bound key + inference), ReceiptRegistry (signed actions), Burn Mode (confidential I/O), MemoryAccessLog (audit trail). Closes Criterion 2.1 hard. No competitor in 24 entries combines all six on one product.

**Phase positioning:** Phase B headline feature. Not before the data room ships — without the data room as a user pull, this becomes a tech feature with no story.

---

## §2 · Confidential Data Room — The Marketplace We're Building (full spec)

**The pick:** F (Confidential Data Room with Burn-Mode-receipt-gated multi-party access). Beat all other marketplace shapes (skill marketplace, skill-bounty board, audited-doc one-shot, compute-attested data, receipt-as-proof) after factoring in `entries/` + `og-projects-showcase/` + `new-entries/`. Three new-entries (Agentra, Trapezohe Ghast Skills Store, zer0Gig) already crowd skill marketplace — that lane is saturated.

**Persona:** deal lawyer / corporate finance associate / due-diligence partner sharing a confidential information memo or term sheet across two-or-three counterparties under NDA. Each counterparty's wallet is a named party in the room manifest.

**Pain:** existing VDRs (Datasite, Intralinks, Dropbox) produce vendor-controlled access logs; any AI summary leaks the document to a third-party server. One breach or one discovery subpoena and the privilege defense collapses.

**Counterparty:** the buy-side firm pays per data room or per GB-month. Seller's counsel is the deployer; buyer's counsel is the reader.

**Why F beats the field:** 10x more receipt volume per session than B (one-shot review) — every read is a receipt, every AI summary is a receipt, every grant change is a receipt. Uses **Chain + Storage + Compute + DA** in one user action, closes the 0G DA gap CLAUDE.md §2.1 flagged. Pulls **Track 5 (Privacy & Sovereign Infrastructure)** alongside locked Track 1 + Track 3 — none of the 24 competitors claim Track 5 with this product depth.

**Rough dev scope (TBD):**
- One Studio page (`/data-room/[id]`)
- One CLI command (`ivaronix room create --doc <file> --parties <addr,addr>`)
- One new receipt type (`doc-room-read`)
- No new contracts (capability grants reuse existing `CapabilityRegistry`)

**Fallback if multi-party UI runs long:** ship B (one-shot Burn Mode review) — same receipts, single doc, single buyer, ships in a day.

---

## Build order (decided, not yet planned)

1. **Privileged-document hero copy** on home page — pick a headline from the 5 sent, wire it, screenshot side-by-side against `brand/Ivaronix.html`. Estimated 15 min.
2. **Confidential Data Room** (item 2 above) — full implementation pass.
3. **TEE-Bound Delegated AI Agent** (item 1 above) — Phase B headline, after #2 ships.

---

## Open questions for next session

- Final hero headline (5 candidates, all editorial-voice compatible).
- Data room: B-fallback now, or commit to F directly?
- TEE-bound delegated agent: do we redeploy `AgentPassportINFT` with TEE-attestation on mint, or layer an `AgentTeeBinding` contract on top?
- Named reviewer personas (Adam the term-sheet hawk, Rhea the privacy-paranoid counsel) — wire as part of #2 default selector, or separate Phase B item?
