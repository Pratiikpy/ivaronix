# Ivaronix · CLAUDE.md (working contract)

> Operational ground rules for any agent working on this project. Updated 2026-05-08.

## 1. Hard rules

- **No compromise.** If a feature is on the build list and is testable, ship it. If a feature is "cool but unverifiable" (you can't prove it works by using it), **push back and propose something verifiable instead.**
- **Production-ready option rule.** Always choose the strongest practical implementation, test, and UX path available. Do not choose the easiest path if it leaves the feature weaker, less polished, or less verifiable. If there are multiple options, pick the one that makes the product more useful, trustworthy, smooth, and production-ready.
- **No `Co-Authored-By` / `Author:` trailers in git commits.** Conventional-commits style; subject + body only.
- **Test = easy to verify by USING it.** If shipping a feature requires "so many things to even see if it works," redesign it or replace it with something simpler that earns the same value. The CLI is the gold standard — you run a command, you see the result, you know it works.
- **No lazy blocked.** Before marking anything blocked, prove you tried the strongest available method: Playwright, real browser extension, backend harness, CLI script, mocked external client, protocol-level test, code-level verification, multi-wallet flow, multi-session flow, or any other route that can prove the feature works end-to-end.
- **Blocked means truly external.** Only mark a test blocked when it needs something unavailable in this environment: a real phone, BotFather-issued Telegram token, Claude Desktop/Cursor UI, macOS/Linux machine, paid quota, or another genuinely external dependency. "Hard", "takes time", or "needs careful automation" is not blocked.
- **Brutal honesty.** If a path is wrong, say so. Reject items that don't move the needle.
- **The only blocker is money.** Anything not requiring real OG funding is a "yes, build it" item. Mainnet deployment + ChainGPT audit waits on the user funding the deployer wallet (B-2).

## 2. Judging criteria (lock this in your head)

The five 0G APAC Hackathon judging criteria — **the only thing that matters for the win**. For each, where Ivaronix is **strong** and where we **lack vs the field** as of 2026-05-09.

### 2.1 · 0G Technical Integration Depth & Innovation
- **Strong:** independent TEE re-verify via `broker.processResponse` is the universal field weakness; we solved it (receipts #994, #1004, #1056, #1069 all FULLY VERIFIED). Receipt-gated fee splits combine 0G Chain + Compute + economic layer in one verifiable flow no competitor pairs. ERC-7857 AgentPassportINFT live.
- **Lacking:** **0G DA is not integrated**, not even as a documented stub for receipt batching or evidence sharding. AIsphere claims all 6 0G primitives; we use 4-5 (Chain, Compute, Storage, Agent ID, Router). Document the DA integration path even if no public testnet endpoint exists yet.

### 2.2 · Technical Implementation & Completeness
- **Strong:** 61/61 Foundry tests, 14 packages typecheck-clean, edge-case discipline proven (tampered receiptRoot → INVALID, empty input → gated, bogus id → honest error). 6 contracts deployed on Galileo. 13/13 mainnet-readiness checklist green.
- **Lacking:** the README does not lead with these numbers. Provus's headline is "10,000+ attestations · 99.7% uptime" — a sentence judges remember. 1071 receipts is competitive but only useful if it is the first thing a reader sees.

### 2.3 · Product Value & Market Potential — biggest gap
- **Strong:** Track 1 + Track 3 fit (cognitive backbone + Agent-as-a-Service marketplace via creator/treasury fee split), proven across 5 first-party skills + 150+ skill catalog.
- **Lacking:** "0G Agent Operating System" is a developer-infra positioning. Aishi (companion), AlphaDawg (memory + sealed inference), Don't Get Drained (anti-scam), Provus (trading agent) each give a judge an instant "I'd use this" because each owns one consumer persona with one job-to-be-done. Ivaronix does not yet have ONE crisp persona-driven hero story on the home page. private-doc-review is the killer demo but the "founder / lawyer reviewing a contract before signing" persona is implicit, not headline. The growth roadmap (year 1 → year 2 → scale path) is not articulated as a single page. This is the criterion a non-technical judge scores Ivaronix lowest on.

### 2.4 · User Experience & Demo Quality
- **Strong:** editorial cream-on-black brand, multi-column footer with all 6 contract chainscan links, mobile hamburger nav, sticky header `backdrop-filter: blur(20px)`, `/r/<id>` proof pages render TIER 1 + TIER 2 + Burn Mode evidence honestly.
- **Lacking:** Studio `/onboard` is 5 gated steps before first receipt — friction for a judge who wants to see one thing work in 60 seconds. The home Run panel is dense (file-drop + 2 dropdowns + question + checkboxes + four-light row + Run). There is no zero-friction "drop a contract → see proof" path that completes in one click. Pitch sentence is not crystallized at first paint.

### 2.5 · Team Capability & Documentation
- **Strong:** technical docs are deep — `docs/RECEIPT_SCHEMA.md`, `docs/MAINNET_READINESS.md`, `docs/QA_FULL_PRODUCT_REPORT.md`, `docs/QA_LOOP_BRIEF.md`, comprehensive CLAUDE.md.
- **Lacking:** no narrative document for a judge who does not read code. AIsphere ships a 19-page whitepaper. Ivaronix needs a **3-page pitch document** ("what is Ivaronix · who is it for · why now") with one persona story up top, the receipt model in the middle, and the growth roadmap at the bottom. Without this, Criterion 5 leaks score to teams who wrote one.

### 2.6 · PMF rule (every user-facing feature)
Runnable in one command with a visible verifiable result. The CLI is the gold standard.
4. **User Experience** — editorial cream-on-black design language, sub-30-second time-to-first-receipt, public Proof URL works on a different machine without auth.

## 3. Resource directories — read these before claiming gaps

- **`oglabs resources/`** — official 0G SDKs (TS/Rust/Go), starter kits, agent skills, compute starter kit, fine-tuning example, agenticID, 0G DA Rust SDK, 0G memory KV server. **Always check here first** when implementing any 0G feature.
- **`og-projects-showcase/`** — 8 projects featured by OG Labs team (Aishi, dont-get-drained, derek2403-0g, verifyhuman, whale-fun, etc.). Use to understand what patterns OG actually highlights.
- **`entries/`** — 16 grant-track competitor entries (0G_OpenClaw_Hackathon, BuildProof, MindVault, AIsphere, AgentHub, AgentPay, ChainShield, POD, SealedMind, ShadowFlow). Use to understand the bar + find one-up opportunities.
- **`CLI Open Source Project/`** — OpenCode, HermesAgent, Octogent, claude-mem, awesome-claude-skills. Synthesis source for our CLI.

## 4. PMF filter — how to decide what to build next

Three checks for every feature:
1. **Is it good?** Not "is it cool" — is it actually useful? Would a real user care?
2. **Is it testable?** Can I verify it works by running it once?
3. **What 0G primitive does it stretch?** Track 1 rewards depth on 0G Storage, 0G Compute, 0G Chain. Surface-level integrations don't score.

If a feature passes 1+2+3, ship it. If it fails any one, push back.

UI promotion rule:
- When a feature exists in CLI, backend, contracts, or SDK but not in Studio, ask whether users would honestly use it from the UI.
- Add it to Studio only if it has real UI PMF: it helps users understand, control, verify, or complete an important workflow.
- If it belongs in Studio, design the proper UX first: placement, copy, state model, permissions, loading, errors, empty state, mobile, proof output, and how it connects to receipts.
- Any new UI feature must be tested like a human with the strongest available path: real wallet, real MetaMask extension, real Playwright flow, screenshots, video, visible state changes, proof page, and chain/receipt evidence. Selector-only checks do not count as user-flow proof.
- If a feature has no honest UI PMF, do not add a button for it. Keep it in CLI/API/docs and say why.

## 5. Track positioning (locked)

- **Track 1: Agentic Infrastructure & OpenClaw Lab** — primary. Ivaronix is the cognitive backbone: skills + memory + receipts + hooks + scanner + sandbox.
- **Track 3: Agentic Economy** — automatic secondary. SkillRegistry is an Agent-as-a-Service marketplace; `og.creator.fee_split` schema field is the wedge.
- **Tracks 2 + 4** — skip. Don't dilute the Track 1 narrative.

## 6. Receipt tier marking (locked)

- **TIER 1 · TEE** — inference on 0G Compute, TEE-attested, `verificationMethod: 'router_flag'` or `'compute_sdk_process_response'`.
- **TIER 2 · EXTERNAL** — inference on NVIDIA NIM / OpenAI / Ollama; signed + chain-anchored but `verificationMethod: 'external-signed'`. Render in amber, not green. Honest > flattering.

## 7. What ships

- **Receipts** are the product. Every action generates one. Every receipt:
  - schema-validated (Zod)
  - canonical-hash-bound
  - signed by an `AgentPassport`-resolvable wallet
  - anchored on `ReceiptRegistry` (0G Chain)
  - independently re-verifiable via `ivaronix receipt verify --tee-independent`

## 8. Failure modes you must not fall into

- **Don't ship demo-ware.** If a feature only works in a curated demo path, it's not real.
- **Don't hide tradeoffs.** External-provider receipts are TIER 2; we say so explicitly.
- **Don't add features that need a stack of dependencies to verify.** A feature you can't run in one command is a feature you can't ship.
- **Don't write commits with AI attribution.** Bare conventional commits.

## 9. Writing voice — no AI slop

When you write **anything that ships** (READMEs, docs, marketing copy, PR descriptions, code comments, commit bodies, blog posts, tweets, judge-facing copy):

- **No em-dash slurries.** One clause per sentence. If you reach for `—`, rewrite.
- **No "delve / unlock / unleash / robust / leverage / empower / seamless / harness / streamline / cutting-edge / state-of-the-art / revolutionize."** Banned words. They mark a paragraph as machine-written on sight.
- **No three-adjective stacks** ("powerful, scalable, secure"). Pick the one that's true and prove it with a number.
- **No "in today's fast-paced world" / "in the realm of" / "in the world of"** openers. Start with the noun that matters.
- **No symmetric bulleted slop** (every bullet starts with the same verb, every bullet has the same length). If a bullet only exists to balance the list, kill it.
- **No marketing sandwich** (claim → flowery elaboration → restated claim). Make the claim once.
- **No invented quotes, fake stats, or hallucinated user testimonials.**
- **Show, don't adjective.** "200ms p95" not "blazingly fast." "61/61 tests" not "extensively tested." A real number is worth ten adjectives.
- **Cut every word the sentence still works without.** Read it aloud — if you're embarrassed, rewrite.
- **Match Ivaronix's voice**: terse, technical, blunt. Editorial cream-on-black. Receipts > rhetoric.

If you catch yourself writing AI slop: stop, delete the paragraph, write one sentence that is true, ship that.

## 10. Visual contract — match `brand/Ivaronix.html`

`brand/Ivaronix.html` is the **canonical visual reference** for every Studio surface. The Next.js app at `apps/studio/` must look indistinguishable from that file when rendered side-by-side.

Non-negotiables:
- **Cream background** `#FAFAF7` (the brand kit's `paper` token; previous mention of `#faf9f6` was a typo), **body ink** `#0A0A0A` (the brand kit's `ink` token), **headline ink** `#111111` (the brand kit's `ink-soft`, used only on display headings — not on body).
- **Typography:** Outfit (geometric sans, weights 500/600/700) for body + headings, Instrument Serif italic for accents, JetBrains Mono for hashes/code. Load via `next/font/google`. **System fonts are a regression — never ship them as a default.**
- **Border radii:** `10px` / `14px` / `16px` / `20px`. Sharper radii (`4–8px`) read as draft-quality.
- **Hero density:** every landing surface (`/`, `/onboard`, `/skills`) has a hero band with concrete numbers (live receipt count, agent count) — not just a headline + button.
- **Hover micro-interactions:** cards lift `translateY(-2px)` + border-color tint on hover. Pure box-shadow without lift looks static.
- **Header:** sticky, `backdrop-filter: blur(20px)`, 64px tall, brackets-only logo on the left, nav links on the right.
- **Footer:** multi-column grid (Product / Docs / Network / Social), not a single-line flex.
- **Section eyebrows:** uppercase micro-labels with letterspacing; both `§ 01 · THING` and `— Thesis` styles are acceptable as long as the chosen one is consistent within a page.

Verification before shipping any UI change:
1. Open `brand/Ivaronix.html` in a headless browser, screenshot at 1440×900 + 375×812.
2. Open the changed Studio route at the same viewports.
3. Lay them side-by-side. If the Studio screenshot reads as "less designed" — colours weaker, type blander, radii sharper, hero emptier — fix the Studio render first; do not commit.

MetaMask and user-flow verification:
- For any Studio feature that touches wallet state, chain writes, receipts, passport, memory grants, or user onboarding, use a real MetaMask extension flow where possible. Do not count a mocked wallet, injected DOM flag, or connect-only check as end-to-end proof.
- Drive the UI like a user would: click buttons, handle MetaMask popups, wait for visible state changes, open the resulting proof page, and confirm the chain/receipt evidence shown to the user.
- Capture screenshots or video for the full flow, not only the final page. The proof must show what a judge would see and feel: transitions, loading states, connected state, error handling, and final result.
- Check every affected page at desktop and mobile sizes. If a page is user-facing, it must be visually inspected, not only asserted through selectors.

What "match" means:
- **Same** colour palette tokens, identical hex values.
- **Same** type ramp (display sizes, leading, letter-spacing).
- **Same** spacing scale (8/12/16/24/32/48/96).
- **Same** card surface treatment (white on cream, hairline border, lift-on-hover).
- **Same** four-light-row chip set wherever verification is shown.

The HTML file is updated when the brand evolves; treat it as the brand spec, not as legacy demo HTML. Any divergence is a Studio bug, not a brand drift.
