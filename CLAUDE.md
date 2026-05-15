# Ivaronix · CLAUDE.md (working contract)

> Operational ground rules for any agent working on this project. Updated 2026-05-10.

## Index

- §1 Hard rules (no compromise · production-ready · brutal honesty · no half-baked anything)
- §2 Judging criteria (locked) + per-criterion strength + gap analysis
- §3 Resource directories (read these before claiming gaps)
- §4 PMF filter for new features
- §5 Track positioning (Track 1 primary · Track 3 automatic-secondary)
- §6 Receipt tier marking (TIER 1 TEE green · TIER 2 external-signed amber)
- §7 What ships (receipts as the product)
- §8 Failure modes you must not fall into
- §9 Writing voice — no AI slop (banned words · capability framing · JSDoc/NatSpec rule)
- §10 Visual contract — match `brand/Ivaronix.html`
- §11 End-to-end testing rule (real MetaMask · real chain · §11.3a captures-as-baseline)
- §12 Completion discipline (the "do not stop" rule)
- §13 README / submission documentation (locked submission requirements)
- §14 Per-package guidance (AGENTS.md + path-scoped `.claude/rules/`)
- §16 Multi-wallet testing rules (PASS / PENDING / BLOCKED · no "mostly proven")
- §15 Bookkeeping in the same commit (the "ship X → discover X" rule)

## 1. Hard rules

- **No compromise.** If a feature is on the build list and is testable, ship it. If a feature is "cool but unverifiable" (you can't prove it works by using it), **push back and propose something verifiable instead.**
- **Production-ready option rule.** Always choose the strongest practical implementation, test, and UX path available. Do not choose the easiest path if it leaves the feature weaker, less polished, or less verifiable. If there are multiple options, pick the one that makes the product more useful, trustworthy, smooth, and production-ready.
- **No `Co-Authored-By` / `Author:` trailers in git commits.** Conventional-commits style; subject + body only.
- **CI-clean before push.** Before `git push` (especially the first push or any push that touches `apps/studio/`, `next.config.ts`, `packages/*/package.json`, or `transpilePackages`), run BOTH: (1) `pnpm -r typecheck` — all workspace projects clean; (2) `pnpm --filter @ivaronix/studio build` — the production `next build` Vercel runs (the pre-commit hook only runs source-file regressions, NOT typecheck or build, so a build break can slip past it). If either fails, fix it before pushing — a broken `main` breaks Vercel's auto-deploy. For contract changes also run `cd contracts && forge test`.
- **Test = easy to verify by USING it.** If shipping a feature requires "so many things to even see if it works," redesign it or replace it with something simpler that earns the same value. The CLI is the gold standard — you run a command, you see the result, you know it works.
- **Real MetaMask only. No compromise.** Every UI / wallet / chain / receipt / passport / memory / data-room / delegate / marketplace test uses the *real* MetaMask browser extension driving real popups (connect, sign, switch chain, confirm tx). NO mocked wallets. NO `window.ethereum` injection. NO `NEXT_PUBLIC_TEST_WALLET=1` shim for tests we claim as "verified end-to-end." The shim exists ONLY for internal dev iteration on UI scaffolding; any test that claims `PASS` against a wallet flow MUST use the real extension. "Hard / slow / annoying" is not a reason to downgrade — find the right wallet shape (1 / 2 / 3 wallets, fund from operator A → fresh keys via Galileo faucet or operator-to-operator transfer) and do it the human way. This rule overrides any contrary suggestion in §11 or elsewhere.
- **Screenshots + screen recording on every UI test. No exceptions.** Not just wallet flows — *every* UI interaction the tester touches: every page load, every button click, every form input, every state transition, every error toast, every empty state, every hover, every mobile viewport, every navigation step. If the eye sees it, the camera captures it. Screenshot at every meaningful state; a screen recording of the full user journey for any flow longer than 3 clicks. Captures are baseline documentation per §11.3a — they don't replace the on-chain / API / CLI proof, but no test claims `PASS` against a UI surface without them. Save under `QA_PROOF_PACK/screenshots/` and `QA_PROOF_PACK/videos/` per §Proof Folder Rule.
- **No lazy blocked.** Before marking anything blocked, prove you tried the strongest available method: Playwright, real browser extension, backend harness, CLI script, mocked external client, protocol-level test, code-level verification, multi-wallet flow, multi-session flow, or any other route that can prove the feature works end-to-end.
- **No delegation to the user for anything you can do yourself.** Every test, every fix, every script that an agent can drive from this terminal — drive it. The repo ships a real MetaMask Playwright harness at `scripts/qa/metamask-e2e/run.ts` (MM v13.30.0 pre-extracted, profile already onboarded, signer key wired through `.env`); a `run-burn.ts` for burn-mode flows; a `run-audit.ts` / `run-revoke.ts` / `run-deeper.ts` / `run-full.ts` / `run-brand-deep.ts` set for the multi-flow sweep; CLI scripts that anchor receipts (`ivaronix demo`, `ivaronix doc ask`); a `ivaronix skill publish` path for fixing on-chain manifest drift; and 94+ source-file regressions. Use them. The harness already wires Playwright's `recordVideo` for full session recording — turn it on (`videos/<flow>-<wallets>-<viewport>-<date>.webm`) and capture every flow longer than 3 clicks. **Full power, no holding back.** "DELEGATED-TO-USER" is reserved for items that genuinely require something physical / external the agent cannot create (a real phone, a BotFather token the user must request, a paid quota, hardware not present). "I'm an AI in a terminal so I can't drive a browser" is FALSE when Playwright + chromium + a pre-onboarded MM profile are sitting in `scripts/qa/metamask-e2e/` — that is the agent's job. Re-read this rule before assigning anything to the user.
- **Blocked means truly external.** Only mark a test blocked when it needs something unavailable in this environment: a real phone, BotFather-issued Telegram token, Claude Desktop/Cursor UI, macOS/Linux machine, paid quota, or another genuinely external dependency. "Hard", "takes time", or "needs careful automation" is not blocked.
- **Brutal honesty.** If a path is wrong, say so. Reject items that don't move the needle.
- **Surface the half-baked, always.** When a feature exists in code but the UX, surface, or end-to-end story is incomplete, say it explicitly *first* — before recommending it as a strength or proposing to extend it. Do not bury "we have the mechanics, the surface is missing" inside a feature pitch. The user must hear "this is half-finished, here is exactly what part" before any extend / promote / lock-in conversation. Half-baked surfaced late = wasted strategy time.
- **The only blocker is money.** Anything not requiring real OG funding is a "yes, build it" item. Mainnet deployment + ChainGPT audit waits on the user funding the deployer wallet (B-2).
- **TESTNET DEPLOY IS NOT A BLOCKER.** The operator wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` is funded with OG on Galileo testnet (check via `ivaronix doctor` or `pnpm --filter @ivaronix/cli dev passport show`). Any agent thinking "this needs operator-funded deploy" for TESTNET must first verify the wallet balance is too low. If the balance ≥ 0.005 OG, the deploy is the agent's job, not the operator's. The `.env` file ships `EVM_PRIVATE_KEY` (legacy alias for `IVARONIX_SIGNER_KEY`) — that's the deployer key. Use it. The cron c25a7e8b iteration-78 burn-in caught the iter-76 "operator-action" mislabeling: B-V2-32's V3 deploy was actually doable, took 30 seconds, used 0.001-ish OG. **Think twice before declaring "operator-action only" — search for a way to do it first.** Foundry gas-price gotcha for Galileo: `ETH_PRIORITY_GAS_PRICE=2500000000 + ETH_GAS_PRICE=5000000000` env vars (2 Gwei tip floor on the chain). MAINNET is different — that's the actual gated layer (B-2).

- **TRY-BEFORE-SKIP rule (the generalized form).** Before declaring ANY task as "operator-only", "blocked", "deferred", "queued for operator action", or any other not-the-agent-doing-it framing, the agent MUST execute this 6-step checklist out loud in its scratchpad. Skipping any step is a §1 brutal-honesty violation. The 6 steps:
  1. **Name the task concretely.** Not "the V3 thing" — "deploy `ReceiptRegistryV3` to Galileo testnet via `forge create`."
  2. **List every resource available.** Check `.env` for keys. Check `ivaronix doctor` for funded wallet balance. Check `find ~/.ivaronix -name '*.json' -mtime -30` for credentials. Check the QA harness paths (`scripts/qa/metamask-e2e/`). Check the Foundry deploy scripts (`contracts/script/`). Check the Playwright + MetaMask profile (`scripts/qa/metamask-e2e/mm/`). If ANY of these provides the missing piece, the task is agent-doable.
  3. **Search for a working pattern in the repo.** Has a similar task been done before? Look at `git log --grep "Closes audit"` for past closures with the same shape. Look at `apps/cli/src/commands/demo.ts` if anchoring; `contracts/script/Deploy*.s.sol` if deploying; `scripts/qa/metamask-e2e/run-*.ts` if UI-testing.
  4. **Attempt the task at least once with the most-likely command.** Run `forge create`, run the deploy script, run the CLI, drive the MetaMask harness. Capture the actual error message — not the imagined one. The cron c25a7e8b iter-78 went from `Error: Chain 16602 not supported` → `Error: gas price below minimum` → `SUCCESS` in 3 attempts. The first error was not the real blocker.
  5. **If attempt fails, diagnose the SPECIFIC failure mode.** "Forge says chain not supported" is solvable by `--legacy --skip-simulation` or env-var gas pricing. "RPC says insufficient funds" is the real wallet-funding gate. "No private key in env" is operator-action. Most failures are NOT the third category.
  6. **Only AFTER the 6-step audit can you declare blocked.** If you declare "operator-action only" without running the command at least once, that's a compromise. The user has every right to push back with "i hope u r nt compramising in any way" (verbatim user quote from iter-78 · 2026-05-12). The cron found a real bug because the user pushed back; that's the user doing the agent's job.

  **The skip-cost is REAL.** Every time the agent skips a doable task and labels it "operator-action": (a) the user has to push back to surface it; (b) the cron run looks like it stopped short; (c) the next contributor reads "operator-action gated" and assumes there's no way around it; (d) the trust in agent-driven cron loops degrades. The structural fix is this rule + the iter-78 historical case as the canonical example. **Re-read this rule every time the words "operator-action", "PENDING", "blocked", or "queued for user" enter the agent's output.**

## 2. Judging criteria (lock this in your head)

The five 0G APAC Hackathon judging criteria — **the only thing that matters for the win**. For each, where Ivaronix is **strong** and where we **lack vs the field** as of 2026-05-09.

When asked "where are we lacking" or "how do we win", do **not** answer with obvious operational chores like funding a wallet, switching to mainnet, adding an explorer link, or submitting a README. Those are table stakes. Answer from the judge's product lens: 0G depth, implementation completeness, market value, UX/demo quality, and documentation clarity compared with `new-entries`, `entries`, and `og-projects-showcase`.

### 2.1 · 0G Technical Integration Depth & Innovation
- **Strong:** independent TEE re-verify via `broker.processResponse` is the universal field weakness; we solved it (receipts #994, #1004, #1056, #1069 all FULLY VERIFIED). Receipt-gated fee splits combine 0G Chain + Compute + economic layer in one verifiable flow no competitor pairs. ERC-7857 AgentPassportINFT live.
- **Lacking:** **0G DA is not integrated**, not even as a documented stub for receipt batching or evidence sharding. AIsphere claims all 6 0G primitives; we use 4-5 (Chain, Compute, Storage, Agent ID, Router). Document the DA integration path even if no public testnet endpoint exists yet.

### 2.2 · Technical Implementation & Completeness
- **Strong:** Foundry tests + packages typecheck-clean (current counts in `docs/numbers.json` — `foundryTests` + `packages.typecheckClean`), edge-case discipline proven (tampered receiptRoot → INVALID, empty input → gated, bogus id → honest error). 6 contracts deployed on Galileo. 13/13 mainnet-readiness checklist green.
- **Lacking:** the README does not lead with these numbers. Provus's headline is "10,000+ attestations · 99.7% uptime" — a sentence judges remember. Our anchored-receipt count is competitive but only useful if it is the first thing a reader sees.

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
- **`C:\Users\prate\Downloads\new-entries\`** (sibling of oglabs/, NOT inside) — 9 newer competitor entries split into `individuals/` (Agentra, AIsphere, AgentPay, agentra-0G, nexus-gateway/Opi, og-market-bot, 0G_OpenClaw_Hackathon) and `orgs/` (Trapezohe/Ghast, moonnfun, zer0Gig). Several stake skill/agent marketplace ground (Agentra, Trapezohe Ghast Skills+MCP Store, zer0Gig). When asked for a strategic compare against the field, ALWAYS read this directory too — agents that miss it produce stale recommendations.
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

No half-baked anything:
- No half-baked build, feature, UI/UX, testing, polish, docs, demo flow, receipts, proof links, wallet flow, mobile view, error states, loading states, empty states, permissions, security checks, marketplace logic, multi-wallet testing, mainnet readiness, competitor comparison, or submission package.
- No fake green status. No "works on my path." No connect-only testing. No screenshot-only proof. No selector-only QA. No lazy blocked items.
- No feature without PMF. No UI button without real use. No claim without receipt/proof.
- Function, proof, UX, and testing must land together. If users see it, it must work and feel finished.

## 9. Writing voice — no AI slop

When you write **anything that ships** (READMEs, docs, marketing copy, PR descriptions, code comments, commit bodies, blog posts, tweets, judge-facing copy):

- **No em-dash slurries.** One clause per sentence. If you reach for `—`, rewrite.
- **No "delve / unlock / unleash / robust / leverage / empower / seamless / harness / streamline / cutting-edge / state-of-the-art / revolutionize."** Banned words. They mark a paragraph as machine-written on sight. <!-- wording-lint:allow:meta-list-of-banned-tokens -->
- **No three-adjective stacks** ("powerful, scalable, secure"). Pick the one that's true and prove it with a number.
- **No "in today's fast-paced world" / "in the realm of" / "in the world of"** openers. Start with the noun that matters. <!-- wording-lint:allow:meta-list-of-banned-phrases -->
- **No symmetric bulleted slop** (every bullet starts with the same verb, every bullet has the same length). If a bullet only exists to balance the list, kill it.
- **No marketing sandwich** (claim → flowery elaboration → restated claim). Make the claim once.
- **No invented quotes, fake stats, or hallucinated user testimonials.**
- **Show, don't adjective.** "200ms p95" not "blazingly fast." "every Foundry test green" not "extensively tested." A real number is worth ten adjectives.
- **Cut every word the sentence still works without.** Read it aloud — if you're embarrassed, rewrite.
- **Match Ivaronix's voice**: terse, technical, blunt. Editorial cream-on-black. Receipts > rhetoric.
- **JSDoc and NatSpec describe WHAT the code does, not WHEN it was written.** No `Day-N`, `Phase A/B/C`, `K-N fix`, `MVP`, `killer demo`, `Track N headline`, `sprint`. Use capability-statement framing ("this writes the receipt anchor"), threat-model framing ("defends against operator-side disclosure"), or roadmap framing ("queued in USER_TODO §B-V2"). Sprint references fossilize — in NatSpec they compile into permanent contract metadata. The exception is explicit traceability links (`planning-003 §A.5.X`, `WT 31`) that map a comment to a specific audit closure; those are intentional and stay.
- **No competitor-bashing in public-facing copy.** README, JUDGE_GUIDE, PITCH, MAINNET_READINESS, the Studio UI, OG-image labels, npx-cli README — these are the *public trust surface*, not battle notes. Rules: explain the product first; show real proof (numbers, links, commands); state facts not "we beat X"; never name a competitor negatively; no "the only project in the field" / "no other 0G project ships" superlatives; use "why this matters" not "why others fail"; mention tradeoffs honestly; let proof speak. Section headings: "What makes Ivaronix different" (a bulleted list of facts), never "How Ivaronix compares" with a competitor column. Comparison analysis stays in **internal docs only** (`docs/HALF_BAKED.md`, `docs/_internal/`, the `entries/` reference folder) — never in a file a judge or user reads as the product's own voice. A top-tier project's README reads calm, confident, factual; it doesn't read insecure. (Codex review · 2026-05-11.)

If you catch yourself writing AI slop or competitor-dunking: stop, delete the paragraph, write one sentence that is true about *our* product, ship that.

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

Test topology first:
- Before claiming any feature is fully tested, ask what the correct real-world test shape is. Identify the actors, wallets, roles, permissions, UI surfaces, chain writes, receipts, state transitions, failure states, and proof artifacts needed to honestly say "this works end-to-end."
- Pick the strongest practical topology, not the smallest shortcut. Example: a marketplace flow needs at least a creator wallet and buyer wallet; serious E2E should use creator + buyer + treasury/admin so listing, purchase/run, payout, protocol fee, receipt, reputation, and UI state can all be verified.
- A feature is not fully done until every expected state change is observed from the user's point of view and from the system's proof layer: UI update, wallet/chain result, receipt/proof URL, API/CLI visibility if relevant, and any updated dashboard/list/history.
- If a feature has multiple roles or surfaces, test the whole path across those roles and surfaces. Do not test only the happy button click. Test what should happen before, during, after, and on failure.

What "match" means:
- **Same** colour palette tokens, identical hex values.
- **Same** type ramp (display sizes, leading, letter-spacing).
- **Same** spacing scale (8/12/16/24/32/48/96).
- **Same** card surface treatment (white on cream, hairline border, lift-on-hover).
- **Same** four-light-row chip set wherever verification is shown.

The HTML file is updated when the brand evolves; treat it as the brand spec, not as legacy demo HTML. Any divergence is a Studio bug, not a brand drift.


## 11. End-to-end testing rule (the "real human" test)

The canonical user intent for what counts as a passing E2E test lives in `docs/QA_LOOP_BRIEF.md` (verbatim user instruction, do not paraphrase). Every shipped feature must satisfy all of the following before it counts as "done."

### 11.1 · Use the real product, not synthetic shortcuts
- **Real MetaMask extension** loaded into Playwright via `--load-extension`, not a mocked wallet, not a window.ethereum injection. Drive the actual MM popups for connect, sign, switch chain, add network, confirm tx.
- **Real wallet, real chain.** Galileo testnet for now, mainnet once funded. No localhost-only flows count.
- **Real on-chain side effects.** A test that produces a real anchor tx + receipt URL + chainscan link is the bar. A test that asserts "button clicked" is not.

### 11.2 · Drive it like a user, not like a test runner
- Click buttons. Wait for visible state. Watch transitions. Read the proof page the user would land on.
- For any feature that touches more than one wallet (data room, multi-party grants, hand-offs, escrow), drive **every** wallet through its own MetaMask popup. Do not collapse a multi-party flow into a single-wallet shortcut.
- For any feature that touches more than one device viewport, run the same flow at desktop (1440×900) and mobile (375×812). Mobile is not optional.

### 11.3 · Capture proof a judge could replay
- Screenshots at every meaningful state transition: pre-action, MM popup open, post-confirm, final proof page. Not only the final result.
- Video recording of the full flow whenever the smoothness of transitions, loading states, or interaction feel matters. The judge cares how it feels, not only that it worked.
- Side-by-side check against `brand/Ivaronix.html` at both viewports per §10. If Studio looks less designed, fix Studio first.

### 11.3a · Screenshots and screen recording are BASELINE, not proof

**Captures are documentation, not verification.** A passing E2E test produces both: (1) the artefact set above (screenshots + video + chainscan links) AND (2) a real on-chain side effect a stranger can replay. Capturing pretty UI states without driving the underlying flow is a §1-rule failure in disguise — the artefacts look impressive, the system isn't actually proven.

Concretely:
- A screenshot of `/r/<id>` rendering FULLY VERIFIED ✓ proves nothing on its own. A judge needs to be able to open the same URL on their machine and see the same chip — that requires a real chain anchor, real signature recovery, real TEE attestation upstream of the screenshot.
- A 30-second tour video walking 6 surfaces is a viewing-aid, not a test. The test is the receipt that anchored on-chain in the same week the video was captured.
- The CLI's `--tee-independent` flag is the gold-standard verification path because it re-runs the broker's `processResponse` against the actual 0G Compute provider on a different machine. THAT's the proof. The captures are how the operator demonstrates that proof to a viewer who can't run the flow themselves.

For full-flow tests that involve wallet state, multi-party grants, or chain writes, the §11.1 + §11.2 rules apply: real MetaMask, real wallets (one per role), real chain side effects. Screenshots and video supplement; they don't substitute. If the only artefacts a feature produces are captures — no chain tx, no receipt URL, no replay path — the feature is not tested, regardless of how good the captures look.

### 11.4 · Cover every shipped feature, not only the headline
- "If even one thing is missed, you are not done" (verbatim from QA_LOOP_BRIEF.md). Sweep every page, every CLI command, every receipt type, every contract write path. The brief's punch list pattern is the right shape.
- Edge cases count: tampered receiptRoot must fail closed, empty input must be gated before Router spend, bogus on-chain id must produce an honest error. Silent failures are a test bug.

### 11.5 · Every CLI feature passes the UI-promotion gate before shipping a UI surface
- Per §4, ask: should this be on UI? Would a real user use it from the UI? Does it have honest UI PMF?
- If yes, ship the UI surface AND test it end-to-end per §11.1–4.
- If no, document why in the CLI command's own help text and the QA brief. Do not promote a feature to UI just because it exists in CLI.

### 11.6 · Reference, do not paraphrase
- When testing intent is the question, re-read `docs/QA_LOOP_BRIEF.md` directly. The verbatim user voice is the source of truth for what "no compromise" means in test scope. CLAUDE.md §11 is the operational summary; the brief is the contract.

## 12. Completion discipline (the "do not stop" rule)

This is the stop-condition contract. Future agents reading CLAUDE.md get this as a hard gate, not a suggestion.

### 12.1 · Stop condition (verbatim from `docs/QA_LOOP_BRIEF.md`)

You may stop only when **every shipped feature** is one of:
- **verified end-to-end with proof** (screenshot or video, receipt URL, tx hash, command output, or chainscan link),
- **fixed and re-tested** after a regression was found, OR
- **explicitly blocked with a real reason AND a concrete unblock action** (BotFather token, mainnet OG funding, no public testnet endpoint, etc.).

Anything else is not done. "Looks like it works" is not done. "I asserted on a selector" is not done. "I built it but did not test it" is not done.

### 12.2 · No partial credits

These do **not** count as end-to-end proof on their own:
- Connect-only: wallet connects but no chain write was tested.
- Screenshots-only: pixels captured but no functional flow was driven.
- CLI-only: terminal works but the UI surface was not verified.
- Web-only: UI renders but the CLI counterpart was not exercised.
- Type-check-only: code compiles but no runtime path was proven.
- Mock-only: synthetic wallet, injected `window.ethereum`, or stubbed RPC.

Every shipped feature needs the matched pair: **the user-facing surface AND the underlying code path AND the on-chain side effect**. If any leg is missing, the feature is not shipped.

### 12.3 · Think three times before stopping

Before declaring `READY` (or any equivalent), run this checklist out loud, in order:
1. Is there any feature in the codebase, manifest, contract ABI, or CLI command list that does **not** have a corresponding proof line in `QA_LOOP_BRIEF.md` or `QA_FULL_PRODUCT_REPORT.md`? If yes, do not stop.
2. Is there any item I marked "blocked" that I could actually unblock with the tools available (Playwright, real MM, fresh wallet generation, Docker, multi-session flow)? If yes, do not stop.
3. Is there any feature in `og-projects-showcase/` or `entries/` or `new-entries/` that closes a judging-criterion gap on Ivaronix and that I have not built? If yes, decide build-or-skip with the PMF filter (§4) and the criterion gap analysis (§2). Do not stop until the decision is recorded.

Only after all three return "no" can the loop terminate.

### 12.4 · Evidence-folder rule

Every artifact used as proof — screenshot, video, transaction hash, receipt URL, public proof URL, command output, chainscan link — **must be linked or named** in either `docs/QA_LOOP_BRIEF.md` (the punch-list section) or `docs/QA_FULL_PRODUCT_REPORT.md`. If the artifact lives only in `screenshots/` or `screenshots/metamask/` and the brief points nowhere to it, the test is not fully recorded. Future agents reading the brief should be able to locate every proof without scavenging the filesystem.

### 12.5 · Genie rule (intent, not letter)

When the user says "test it," "ship it," or "make it ready," interpret the **intent**, not only the words. The intent is: a real human, using the product the way a real human would, sees a polished result, and a judge running the same flow on a different machine arrives at the same conclusion. Do not look for loopholes that technically satisfy the letter while violating the intent.

If a phrase is ambiguous (e.g. "test the data room"), the right move is to drive the longest reasonable user journey with the strongest available method (real MM, real wallet, real chain, video + screenshots, multi-wallet if applicable, both viewports), not the shortest one that compiles. Unclear instructions resolve toward the harder, more thorough interpretation, not the easier one.

### 12.6 · Living punch-list discipline

`docs/QA_LOOP_BRIEF.md` is the source of truth for "what's tested vs what isn't." Every shipped feature gets a line in the punch-list with its current status. The status updates in the same commit that ships the feature, not in a follow-up commit. If a feature has no line in the punch-list, it has no proof, so it does not exist.

## 13. README / submission documentation (locked)

The 0G APAC Hackathon submission must include a project README — in English or Chinese — that contains every one of the following. This is a hard submission requirement, not a stretch goal. Strong documentation is a judging input.

1. **Project overview** — one paragraph that names the product, the persona, and the substitution problem it solves. No banned words from §9. Real numbers, not adjectives.
2. **System architecture diagram or technical description** — a diagram (svg or ascii) plus a short narrative covering: where the document goes, where the receipt is signed, how the chain anchor happens, how independent re-verification works.
3. **Explanation of which 0G modules are used** — list each integrated module (`0G Chain`, `0G Compute`, `0G Storage`, `0G DA`, `0G Router`, `Agent ID`) with the contract address or endpoint where applicable.
4. **Description of how those modules support the product** — for each module, one sentence describing the user-visible value it carries (e.g. "0G Compute runs the specialist inside a TEE, so the plaintext is invisible outside the run").
5. **Local deployment / reproduction steps for judges** — exactly the commands a reviewer types to clone, install, env-fill, run the studio, run the CLI, and produce a verifiable receipt. Tested on a clean machine before submission.
6. **Test account details, faucet instructions, reviewer notes** — testnet faucet link, a pre-funded reviewer wallet address (or instructions to fund a fresh one), the chainscan URL pattern, and any rate-limit caveats.

The README is owned by the submission lead, lives at `README.md` in repo root, and is reviewed against this checklist before submission. Anything missing is treated as a §1-rule failure ("ship it or push back"), not a polish item.

## 14. Per-package guidance

For package-specific conventions, env vars, hot files, and test commands, see the per-package `AGENTS.md` files (planning-003 §A.5.2):

- `apps/studio/AGENTS.md` — Next.js 15 / wagmi / SIWE / brand contract.
- `apps/cli/AGENTS.md` — Commander.js binary, default tier resolution.
- `packages/og-router/AGENTS.md` — Keyring rotation, processResponse 3-arg rule.
- `packages/og-chain/AGENTS.md` — V2-first read pattern, EIP-712 anchor flow.
- `contracts/AGENTS.md` — Foundry, V1→V2 migration pattern, threat-model NatSpec.
- `seed-skills/AGENTS.md` — manifest skeleton, three publishing paths.

Path-scoped rules at `.claude/rules/<package>.md` auto-load when editing files under `<package>/**`. Treat the AGENTS.md files as the human-readable index and the rules files as the operational contract.

## 15. Bookkeeping in the same commit (the "ship X → discover X" rule)

Every time you ship a new file, script, test, rule, or env var, the **same commit** (or the next commit before EOD) updates every reference that should mention it. This is the rule that 8 separate cron-sweep audits on 2026-05-10 each independently caught one violation of, even though the underlying ships were all done correctly.

The pattern looks like this. You ship a new diag script at `scripts/diag/audit-list.ts` and add it to `package.json` as `pnpm audit:list`. The work is done. But:

- `scripts/README.md` (the canonical script inventory · `planning-003 §A.5.6`) doesn't mention it → operators searching for the canonical command list won't find it.
- The doc-comment in the consumer file (`packages/runtime/src/env.ts`) still says "queued · USER_TODO §B-V2-11" → readers think the script doesn't exist yet.
- `docs/USER_TODO.md §B-V2-11` (the source-of-truth queue) still reads as queued → future contributors re-do the work.
- `CHANGELOG.md` mentions "Until pnpm audit:list ships, run the grep manually" → stale narrative.

Each of these is a 1-minute fix. None of them block the ship. **All four were missed in the original commit** because the contributor's mental model was "I'm shipping the script" not "I'm shipping the script AND closing every reference to its absence."

### The discipline

When you add a new ____, also update ____:

| You added… | Update these in the same commit… |
|---|---|
| A new `pnpm <verb>` script | `package.json` scripts, `scripts/README.md` "Running" section, the relevant `<package>/AGENTS.md` test-command block, `CONTRIBUTING.md` pre-PR command list |
| A new `verify-*.ts` source-file regression | `scripts/qa/metamask-e2e/run-source-regressions.ts` filter list, `scripts/README.md` qa/ section |
| A new threat-model JSDoc on a security primitive | `SECURITY.md` "What the receipt system defends against" list with file:line citation |
| A new top-level repo doc (e.g. `BRAND.md`) | `README.md` Documentation index, the relevant CLAUDE.md section if it adds a rule |
| A new env var | `packages/runtime/src/env.ts` alias chain, **both** env templates (`.env.example` at repo root + `apps/studio/.env.production.template`), `docs/PRIVACY_NOTES.md` if it touches privacy. `pnpm env:check` runs naturally so no separate update there. Lead with the canonical `IVARONIX_*` form in the templates; document the legacy alias as a deprecated fallback in a comment. **The templates get copy-pasted verbatim by operators — a stale entry breaks first-time setup, not just doc accuracy.** **Structural lock**: `verify-env-template-completeness.ts` fails any IVARONIX_* var that code reads but neither template documents (the regression maintains an `ALLOW_CODE_ONLY` set for genuinely-internal debug flags like `IVARONIX_DEBUG` · sweep 205). |
| A new auto-derived count in `numbers.json` | `scripts/diag/numbers-refresh.ts` `buildSnapshot()`, replacing `existing.<field>` with a `count<X>()` helper. Don't preserve a hand-frozen number across refreshes — the value silently drifts when the underlying source changes (cron-sweep findings · 2026-05-10). |
| A new ghost-surface deletion (empty package or app dir) | `HLD.md` §1 "All surfaces are real today" call-out, any `packages/<X>` reference in HLD/UI_UX_GUIDE/COMPONENTS pointing at the deleted dir, the architecture diagram if it shows the surface. **Same rule applies to `git mv` renames.** Do NOT rely on git to track empty-dir deletions — they're untracked locally only. **Structural lock**: `verify-no-ghost-surfaces.ts` (sweep 100 · "4th occurrence" rule) parses HLD §1's surface table on every commit and fails when an `apps/<name>` row references a missing or empty directory. So adding a row without an `apps/<name>/` directory, or deleting an `apps/<name>/` directory without removing the HLD row, both fail pre-commit. |
| A new contract V2 | `contracts/deployments/{testnet,mainnet}.json`, `apps/studio/src/lib/chain.ts` `unifiedX` helpers, `apps/cli/src/commands/receipt.ts` `buildReadRegistries`, `docs/MAINNET_READINESS.md`, `CHANGELOG.md` with `Closes audit K-N` trailer, **and** `packages/core/src/types.ts` `KNOWN_RECEIPT_REGISTRIES` when the V2 is a new `ReceiptRegistry*` (the receipts schema chainAnchor superRefine reads this set per §K-17). **Numbers + addresses propagate automatically once added to `contracts/deployments/testnet.json`** — `pnpm numbers:refresh` rebuilds `contracts.list` + `contracts.addresses` (sweep 36); `pnpm docs:render` regenerates the README + MAINNET_READINESS contracts:auto blocks (sweeps 40-41). Don't hand-edit those tables. **Structural locks**: `verify-numbers-vs-deployments.ts` fails when `numbers.json` contracts.addresses drifts from the deployments JSON; `verify-known-registries-vs-deployments.ts` (sweep 219) fails when `KNOWN_RECEIPT_REGISTRIES` drifts from the same source of truth; `verify-user-todo-deploy-markers.ts` (sweep 199) fails when a USER_TODO §A-V2 deploy entry's `### ... ✅ DEPLOYED` header is missing for a contract that exists in `testnet.json`. |
| A new audit closure | `CHANGELOG.md` row, `Closes audit <ID>` commit trailer, `docs/USER_TODO.md` row marked ✅ SHIPPED if it was queued there. **The trailer is structurally enforced**: `.githooks/commit-msg` (sweep 236+239) rejects any commit that adds a `✅ {CLOSED|FIXED|SHIPPED|DEPLOYED|VERIFIED|CODE-COMPLETE}` marker to HALF_BAKED.md / PHASE_B_DISCLOSURES.md / USER_TODO.md without a `Closes audit <ID>` line in the body. Read-side companion: `verify-half-baked-closure-citations.ts` (sweep 203 + extensions 224/238) fails any ✅ header missing a citation. So the rule is locked at both write-time (hook) and read-time (regression) — not muscle memory. |
| A new canonical `IVARONIX_*` alias chain | `packages/runtime/src/env.ts` alias array, **every** `AGENTS.md` that mentions the legacy form (`apps/{cli,studio}/AGENTS.md`, `packages/og-router/AGENTS.md`, etc.). Lead with canonical; demote legacy to a parenthetical or comment. The `verify-agents-md-canonical-aliases.ts` regression enforces ordering — fails CI on any AGENTS.md line that mentions a legacy alias without the canonical leading on the same line. (cron-sweep 44-45 caught 6 ordering violations across 3 AGENTS.md files; gate now prevents recurrence.) |
| A new numerical claim in a render-target markdown doc | The four target docs (README, PITCH, JUDGE_GUIDE, MAINNET_READINESS) must wrap any value ≥ 100 that comes from `numbers.json` in `<!-- numbers:auto:KEY -->VALUE<!-- /numbers:auto:KEY -->` markers. The `verify-no-bare-numbers-in-rendered-docs.ts` regression enforces this — fails CI on any bare numerical claim that matches a numbers.json value (filtered to ≥100 to avoid table-row + URL noise). Wrap-then-render-then-commit is the workflow. |

### Why this matters

A repo at "production-ready" feels different from a repo at "everything works": every doc points at every file that exists, every rule references every place it applies, every "queued" entry in any tracker is fresh. The cost of not doing the bookkeeping is invisibility — the work is real, but the next contributor has to re-discover it from scratch by grepping the codebase.

**Rule of thumb: if you spent more than 20 minutes shipping something, spend 5 minutes updating its references.** The 25% overhead is what production-ready repos look like and what hackathon-stage repos skip.

## 16. Multi-wallet testing rules (PASS / PENDING / BLOCKED · no "mostly proven")

User directive captured iter-133 (verbatim in `docs/MULTI_WALLET_RULES.md`). Every feature that involves permissions, memory sharing, delegation, data rooms, paid runs, marketplace, creator/treasury split, passport authority, or wallet roles must be tested with the exact required wallet count:

- **1-wallet feature** = real MetaMask wallet test (real Chrome + real MM popup flow)
- **2-wallet feature** = Wallet A + Wallet B, real on-chain actions, UI/CLI/ChainScan cross-check (Wallet B's key imported into a real MetaMask, exercised through Studio)
- **3-wallet feature** = creator + buyer + treasury/admin, real payment/split/receipt proof (all three wallets imported into real MM, fee-split paid flow exercised end-to-end)

**Forbidden claims:**
- "mostly proven" — use PASS / PENDING / BLOCKED instead
- "works in principle" — use PENDING with the concrete missing flow
- "covered by chain-level proof" — chain-only proof on a multi-wallet feature is PENDING, not PASS
- "should work because the contract reverts" — only PASS once the user-facing surface is exercised through real MM

**Compounding requirements:** for 2-wallet features, ALL three of (a) real on-chain tx, (b) UI exercised with Wallet B in MM, (c) CLI cross-check must be true for PASS. For 3-wallet features, add (d) third-wallet role exercised in MM too.

Current state: `QA_PROOF_PACK/multi-wallet/MATRIX_AUDIT.md` lists every multi-wallet row in the QA plan with its PASS / PENDING / BLOCKED status. Pre-iter-133, the agent claimed "5 rows proven" based on chain-only proofs — per these rules, all 5 are PENDING (chain side done, UI side never exercised). Honest current count: 2 PASS (security-gate tests where UI N/A), 12 PENDING, 0 BLOCKED.

**Re-read this section before claiming any multi-wallet feature is fully working.** The user has explicitly forbidden the "mostly proven" framing; the cron has to honor it across every future iteration.

### 16.1 · The MetaMask popup no-skip rule (2026-05-13, locked)

**User directive verbatim** (2026-05-13, after agent compromised across iters 139-141 + iter-171):

> "u were comprimsign when doign ttesitn of UI frm metmaask spcelign i thinu were nt dign trasncaiotn in qa test and also comrpaisming in mult walelt setup see ik u can do it u kn u can do it make spcif urle that u will enver skip this no matter hwo muc u gotta try its no skip ruel no comrpasmie ruel no amtter wht bcz its doable we both knw that u hv doen tht too in past with me with difrnt sesiosn"

Translation: real MetaMask popup driving + on-chain transaction signing in QA is **NEVER OPTIONAL, NEVER SKIPPED, NEVER FRAMED AS BLOCKED**. The user has done this with the agent across multiple sessions before; it is doable; compromise here is the worst kind because the precedent exists.

**The no-skip rule:**

This applies to:
- 1-wallet flows (operator wallet drives Studio + signs receipts via real MM popup)
- 2-wallet flows (Wallet A + Wallet B, each independently exercises Studio + signs through their own MM popup)
- 3-wallet flows (creator + buyer + treasury, each signs via real MM popup; chainscan shows 3 distinct sender addresses across publish/pay/withdraw)
- Any N-wallet flow

**Forbidden framings** (these are all compromises in disguise):
- "MM v13.30 LavaMoat UI is obfuscated so we can't drive it programmatically" → use Add Account derivation (proven in iter-145), or pause-and-manual-paste hybrid, or pre-injected storage state, or any other working method
- "MM UI selector wasn't stable" → try multiple selectors, screenshot what we see, fall back to keyboard nav, or pause for user click
- "It would take 3-5 more iterations" → so iterate 3-5 more
- "Chain side is proven so UI is implied" → no, §16 PASS requires UI exercise with each wallet
- "We'll capture it in the final regression sweep" → no, the multi-wallet flow is its own build block (FINAL_BUILD_PLAN.md Block J)
- "It's hybrid + needs operator's manual click" → fine, do the hybrid; never skip
- "Operator-action required" — only valid if the dependency is TRULY external (BotFather token, mainnet OG funding from CEX). MM popup driving is **NEVER** operator-action when the operator is at the keyboard.
- "Brittle / hard / slow" → not a reason to downgrade. CLAUDE.md §1 already forbids "no lazy blocked."

**Strategies known to work** (the agent MUST try multiple before claiming blocked):
1. **MM Add Account derivation** — single seed + multiple derivation indexes = N user-controlled wallets. iter-145 proved this works; user iter-170 confirmed by creating 3 accounts. **This is the v1 strategy locked in FINAL_BUILD_PLAN.md D-11 / Block J.**
2. **Hybrid pause-and-import** — script pauses, signals user to paste private key into MM Import Account UI, user clicks Import, script resumes via state polling. iter-142 pattern.
3. **Headed Playwright with user clicking MM popups in real time** — script drives Studio, MM popups appear, user clicks Confirm, script captures the tx hash post-confirm. Works when user is at keyboard.
4. **Headless Playwright with key pre-injected via Chromium storage state** — write MM's KeyringController state directly into IndexedDB before browser launch. Advanced; reserved for fully-automated CI.
5. **Multiple persistent profile dirs** — one MM extension per wallet, each in its own `.profile-<wallet>` dir. Heavier but isolated.

**The 3-strategies-before-blocked rule:**

Before the agent may write "BLOCKED" on a multi-wallet row, it MUST list (in the proof artifact):
- Strategies tried (with screenshots / logs / failure modes per strategy)
- Strategies remaining (with reasoning for why each would fail)

If **fewer than 3 strategies have been tried**, the row is still **IN PROGRESS**, not BLOCKED. The agent must try another strategy.

**Completion criteria** (PASS conditions, locked by CLAUDE.md §16 + amended by §16.1):

A multi-wallet flow row gets PASS only when **ALL FOUR are true** for each wallet in the flow:
1. Real on-chain tx visible on chainscan (chainscan-galileo.0g.ai for testnet, chainscan.0g.ai for mainnet)
2. UI exercised with that wallet through a real MM popup (screenshot + video proof in `QA_PROOF_PACK/multi-wallet/`)
3. CLI cross-check matches what UI shows (e.g., `pnpm ivaronix receipt show <id>` displays the same wallet as the receipt's `agent.ownerWallet`)
4. Verifier `pnpm ivaronix receipt verify <id> --tee-independent` returns FULLY VERIFIED for receipts produced in the flow

**Where this rule was violated (the historical record):**

- iters 139-141: agent attempted programmatic MM key import via Playwright. MM v13.30 LavaMoat selectors didn't stabilise after 3 iterations. Agent gave up and fell back to "Add Account" derivation. **This was the correct fallback**, but the agent then claimed the 2-wallet flow was structurally equivalent to 2 imported wallets, which only became true after the user explicitly approved D-11 in FINAL_BUILD_PLAN.md.
- iter-145: 3-wallet flow via "Add Account" — captured 21 screenshots, real on-chain anchors. **This is the proven-working pattern** that Block J locks.
- iter-171: hybrid Playwright flow stalled when MM UI scrape returned only 1 account row instead of 3. Agent's first reaction was to extend the fallback chain rather than reach for a different working strategy. User intervened: "kindly stop the cron now." The right move would have been to pivot to D-11 immediately, not run a partial scrape.
- After iter-171: agent rolled multi-wallet UI proof into "final regression sweep §6 checkbox" — a compromise the user explicitly forbade. Fixed in the FINAL_BUILD_PLAN.md revision: multi-wallet UI is its own Block J.

**This rule supersedes any prior framing of "blocked by MM UI complexity."** Compromise here is the worst kind because we have explicit precedent (with this user, in past sessions) that it's doable. Multi-wallet UI testing is part of the launch product; no fake green, no skipped row, no "PENDING due to MM tooling" — try another strategy until PASS conditions are met.

---

## 17. UI testing no-skip rule (because UI is where users live)

**User directive verbatim** (2026-05-13, after the agent repeatedly tried to roll UI flows into regression checkboxes):

> "u msu ad it sueper clear so there is no way the agetn wil skisp or comrpaismin in ui tesitn bcz ui is the hting where ppl use moslty use our priduct we cnt hv skippign that thign uk"

Translation: make this super clear. There is no way the agent skips or compromises on UI testing. UI is the surface real users live on. We can't have the agent skipping that.

### 17.1 · The principle — test like a human, not like a script

**Most users will experience Ivaronix through its UI, not its CLI or its chain reads.** Studio + the receipt page + the marketplace are the load-bearing user surfaces. If those don't work end-to-end through a real browser + real wallet + real clicks, the product is broken regardless of how good the CLI proof story is.

Therefore: **every UI flow that ships gets exercised THE WAY A REAL HUMAN WOULD USE THE PRODUCT — before it can be claimed PASS.**

"The way a real human would use it" means:

- **Click buttons, don't assert selectors.** A real human clicks "Connect Wallet"; the agent clicks the same button via Playwright. Asserting that the button EXISTS is not testing — clicking it and confirming the next state is.
- **Try the wrong path first.** A real human submits the form with one field missing, hits Run before connecting, drops a 500MB file, switches MetaMask to the wrong network mid-flow. Test the error states the way they'd be hit by an impatient user.
- **Read the UI like a human reads it.** Does the price actually show in OG? Is the four-light row legible? Does the receipt page tell a stranger what the AI did without making them open the JSON? If the UI confuses a human, it's broken.
- **Pause between actions like a human pauses.** A real human takes 2-5 seconds between clicks reading the screen. Bot-speed clicks miss race conditions that real users hit. Add realistic delays in Playwright flows.
- **Hover, scroll, tab, copy.** Tooltips matter. Long pages must scroll cleanly. Tab order must work. Copy buttons must put the right thing on the clipboard. These are not optional.
- **Try the mobile flow with thumbs.** At 375×812, the tap targets must be reachable, modals must close cleanly, the keyboard must not cover form inputs. Drive Playwright with touch events, not mouse events.
- **Wallet popups are full interactions, not modals to dismiss.** Read the popup text. Confirm it shows the correct gas, correct amount, correct recipient. A user who doesn't trust the popup text will reject the tx; the agent's test must verify the popup tells the right story.
- **Open the proof page in a fresh browser, no auth, like a stranger received the URL.** This is the WHOLE POINT of the product — a stranger can verify. If the agent only ever tests `/r/<id>` in the same browser that anchored the receipt, it has tested nothing.
- **Try to break it.** A real human will paste a 100KB doc into a 4KB field, paste a wallet address into a price field, hit the back button mid-tx, refresh during a wallet popup, open two tabs with the same wallet. Cover these.

No exceptions. No "structural equivalents." No "we tested the underlying API so the UI is implied." No "regression sweep covered it" without naming the specific Playwright test or manual rehearsal that exercised the visible UI the way a human would.

### 17.2 · Scope (every UI surface)

This rule applies to:

- **Every Studio route**: `/`, `/onboard`, `/skills`, `/memory`, `/dashboard`, `/global`, `/agents`, `/thesis`, `/brand`, `/docs`, `/privacy`, `/terms`, `/r/[id]`, `/embed/r/[id]`, `/data-room/[id]`, `/delegate/[id]`, `/marketplace`, `/marketplace/[skillId]`, `/marketplace/new`, `/marketplace/payouts`, `/admin/treasury`, `/admin/health`, `/skill/new`, `/skill/[id]`, `/agent/[addr]`, plus any future routes
- **Every interactive element on those routes**: hero CTAs, navigation links, dropdowns, file uploads, form inputs, toggles, checkboxes, copy buttons, share buttons, verify buttons, connect wallet, disconnect, run, anchor, withdraw, refund, switch network, switch wallet, ALL of them
- **Every state**: pre-action, loading, mid-action, success, error, empty, network-offline, wallet-rejected, tx-pending, tx-confirmed, tx-failed
- **Every viewport**: 1440×900 desktop AND 375×812 mobile
- **Every wallet**: 1-wallet, 2-wallet, 3-wallet flows — see §16

### 17.3 · Method (the bar for "tested")

A UI flow is **TESTED** when:

1. A real browser (headed Chromium via Playwright, or operator's Chrome) loads the production URL
2. A real human-or-bot clicks the actual button (no `page.evaluate(fn)` that bypasses the click)
3. A real wallet (real MetaMask extension, not `window.ethereum` shim) signs the transaction if one is required
4. A real on-chain side effect occurs (tx hash, anchor, payment, withdrawal) — verifiable on chainscan
5. The UI updates to reflect the new state (post-anchor receipt page renders, balance updates, marketplace list refreshes)
6. Screenshots captured at every meaningful state transition (pre-click, popup-open, post-confirm, final state)
7. Full session video captured for any flow >3 clicks
8. The same flow re-driven at 375×812 mobile viewport with proof

A UI flow is **NOT TESTED** if any of these are true:
- The underlying API was tested but the visible UI wasn't clicked
- A Playwright selector was asserted but no actual click happened
- The flow was "proven structurally" via code review
- The flow was "rolled into final regression sweep" without naming the specific test or rehearsal
- The flow was tested at desktop only (mobile is not optional per §10)
- The flow used a mock wallet / injected provider / window.ethereum shim
- The flow used `window.ethereum.request` directly without going through the MM popup
- The screenshots show selectors but no state transitions
- The video is <3 clicks but the flow is meant to be >3 clicks (incomplete capture)

### 17.4 · Forbidden framings (these are compromise in disguise)

The agent MUST NOT use any of these to claim a UI flow is tested:

- "Tested via underlying API" → no, the UI was the thing being tested
- "Selector exists, so it works" → no, the click + state-transition is the test
- "Mobile inferred from desktop" → no, 375×812 is its own test
- "Chain proof covers the UI" → no, §16/§17 require both
- "We'll do it in the regression sweep" → name the specific rehearsal or it's not tested
- "MM popup is brittle so we skipped" → §16.1 applies; try another strategy
- "Headless mode tested it" → no, headed is the bar (real visual rendering matters)
- "Component test covered the render" → component tests are NOT UI flow tests
- "It's similar to a tested flow" → similar is not tested
- "The CLI cross-check confirms it" → CLI is not UI; both required

### 17.5 · 5-strategies-before-blocked rule

Before claiming a UI flow is BLOCKED, the agent MUST have tried **at least 5 strategies** and documented each attempt with screenshots + error logs:

1. Playwright + headed Chromium + real extension + clicked button
2. Playwright with multiple alternative selectors (data-testid, aria-label, role+name, text content, xpath)
3. Hybrid: agent drives Studio, operator clicks MM popups in real time
4. Keyboard navigation fallback (Tab + Enter through the form)
5. Different browser context (fresh profile, no extensions, etc.)
6. (For wallet popups specifically) different MM derivation pattern (Add Account vs Import vs storage-state pre-injection)

If fewer than 5 strategies have been tried with screenshots/logs, the row is **IN PROGRESS**, not BLOCKED. The agent must try more.

### 17.6 · The capture rule (no proof = not tested)

Per CLAUDE.md §1 "Screenshots + screen recording on every UI test. No exceptions." reinforced:

Every claim of "UI tested" must point at:
- A screenshot file path under `QA_PROOF_PACK/screenshots/<flow-name>/` showing the state transition
- (For flows >3 clicks) a video file path under `QA_PROOF_PACK/videos/<flow-name>.webm` capturing the full session
- (For chain-write flows) a chainscan link showing the resulting tx

If proof artifacts don't exist, the flow isn't tested — even if it ran successfully. **"It worked when I ran it" is not evidence**; the artifact is the evidence.

### 17.7 · The visual-inspection rule (the agent MUST look at the screenshots)

**Taking a screenshot is not the same as inspecting it.** A real human at a QA session looks at the screen and judges whether the UI rendered correctly. The agent must do the same — by `Read`ing each captured screenshot file after the flow completes and visually verifying the rendered state matches expectation.

**The bar for "visually inspected":**

After every UI flow that captures screenshots, the agent MUST:

1. **Read each captured screenshot file** via the `Read` tool. The Read tool renders PNG/JPG screenshots as images the agent can see.
2. **Compare each screenshot against the expected state.** Did the four-light row turn green? Is the price in OG visible? Did the wallet address render correctly? Is the receipt page showing the right tier chip? Is mobile (375×812) layout breaking? Is the MM popup text saying what it should?
3. **Document what it saw** in the proof artifact (`QA_PROOF_PACK/notes/<iter>-ui-inspection-<flow>.md`):
   - "screenshot 03-connect-wallet.png: shows wallet 0x... connected, balance 0.05 OG, network Galileo. OK."
   - "screenshot 07-receipt-page.png: receipt id 14, TIER 1 chip green, 0GM chip green, payment hash visible, BUT: chainscan link points to chainscan-newton not chainscan-galileo — DRIFT."
4. **Surface anomalies immediately.** If the screenshot shows broken layout, missing content, unexpected error state, wrong copy, or anything off — flag it as a finding in the proof note + fix it before claiming the flow PASS.

**Forbidden:**
- "Captured 21 screenshots, all good" without naming what each one shows → not inspected
- "Screenshots show no errors" without quoting specific visible elements → not inspected
- Inspecting only the final state — every meaningful transition needs inspection (per §17.3 #6)
- Inspecting only desktop when mobile is also in scope — both viewports require inspection

**Operator-confirmation loop:**

The user has been brutally clear: "send screenshots/images after doing full flow UI test so I can check if anything is wrong." This means after a UI flow completes, the agent must:

1. List the captured screenshot paths back to the user (sorted in flow order)
2. For each screenshot, give a 1-sentence description of what it shows
3. Flag any anomaly the agent saw
4. Wait for the operator to spot-check before declaring PASS

This is not optional. The operator sees things the agent might miss (font choice, spacing, brand drift, copy that reads wrong) — the agent's visual inspection is necessary but not sufficient.

### 17.8 · Where this rule was violated (historical record)

- iter-144 (this session): captured 18 desktop screenshots but did NOT capture a full session video; mobile counterpart (iter-148) captured 22 screenshots but no video. Both should have shipped with video per §17.3.
- iter-171: when MM v13.30 UI scraping failed for 3-wallet enumeration, the agent's response was to roll the multi-wallet UI flow into "final regression sweep §6 checkbox." User intervened. Correct response: try strategies 2-5 of §17.5 immediately.
- Various iters claimed "all Studio routes return HTTP 200" as a proxy for "UI tested." HTTP 200 is NOT UI tested per §17.3; visible state transition + screenshot + video + visual inspection is required.
- **Multi-wallet captures across iters 144-148**: screenshots were captured but the agent never `Read` them back to verify what they showed. The screenshots may show drift the agent never caught. This violated §17.7 retroactively.

### 17.9 · Authority

This rule overrides any prior framing of "UI testing is hard" or "UI proof can be inferred from CLI/chain." The user has been brutally clear: **UI is where users live; UI testing is non-negotiable; the agent must visually inspect every captured screenshot and surface anomalies to the operator before PASS.**

Agent re-reads this section before claiming any UI flow is PASS. If the row's proof artifacts don't satisfy §17.3 + §17.6 + §17.7, the row is **NOT PASS**, regardless of how many other proofs exist.

The cron + the build phase + the final regression sweep must all honor this rule. Every Studio surface that ships in v1 (Block E + Block I + receipt pages + admin pages + memory + skills + thesis + onboarding + the post-receipt banner + the wallet-switch flow + every error-toast + every empty state + every loading state) gets §17.3 + §17.7-compliant testing before submission.

No skip. No compromise. No exception. **UI is the product surface; screenshots without inspection are not evidence.**

### 17.10 · Test priority order (Priority A → B → C, no skipping)

**User directive verbatim** (2026-05-13): "you must add a rule that only, like, for example, complete priority A, then go to priority B. Without priority A, you can't go to priority B."

The full UI test catalog lives in **`docs/FINAL_BUILD_TEST_PLAN.md`**, organized into three priority tiers. **The agent MUST complete Priority A in full before touching Priority B. The agent MUST complete Priority B in full before touching Priority C.** No skipping. No "we'll do A and B in parallel." No "this Priority C test is easy, let me get it out of the way."

**Priority A (submission blocker — every UI flow MUST cover all 4 categories before PASS):**
1. **Error-state realism** — 9 specific failure modes per `FINAL_BUILD_TEST_PLAN.md §A.1` (Compute 500, Storage 504, wallet rejects, tx timeout, network change, SIWE expire, chain halt, insufficient balance, wallet locked)
2. **Stranger-replays-receipt** — incognito on a different machine, no auth, no wallet, FULLY VERIFIED ✓ on `/r/<id>` AND `pnpm ivaronix receipt verify <id> --tee-independent` works on a never-used-Ivaronix machine
3. **State recovery** — refresh / back / tab-close / history-30min
4. **Receipt-as-shareable-artifact** — Twitter/Slack/Discord previews, Print, PDF export, OG image at 3 scraper user-agents

**Priority B (launch-ready blocker — must pass before mainnet promotion / public launch):**
5. **Accessibility (a11y)** — keyboard nav, focus, ARIA, WCAG AA contrast, screen reader, reduced-motion
6. **Cross-browser** — Safari iOS (HK Festival judges on iPhone), Firefox, Edge, mobile WebKit at 375×812

**Priority C (post-launch v1.1 backlog):**
7. Performance / network-throttling
8. Internationalization / Unicode (CJK / RTL / emoji)
9. Wallet edge cases (multi-tab, mid-flow switch, auto-lock)
10. Devtools / extension interference
11. JS-disabled fallback for `/r/<id>`
12. Time-zone handling

**Enforcement:**

- A Block (per `FINAL_BUILD_PLAN.md`) cannot be marked DONE if any of its Priority A coverage rows are PENDING / BLOCKED / NOT TESTED.
- The §10 "Definition of done" submission gate in `FINAL_BUILD_PLAN.md` includes "All Priority A UI tests PASS for every shipped flow" as a hard checkbox.
- The agent MAY work on Priority B during build phase, but ONLY after the same flow's Priority A is fully PASS. Going to B without A complete is a §1 brutal-honesty violation.
- The agent MAY NOT work on Priority C until both A AND B are fully PASS for the flow in question. Priority C is post-launch.

**Forbidden:**
- "I'll do a quick a11y check while I think about error-state-realism" → no, error-state-realism (A.1) is in front of a11y (B.5)
- "Cross-browser is easy, let me knock it out first" → no, A first
- "Priority A for the demo flow is done; let me start B on marketplace" → check: did you complete A for marketplace too? If not, no B for any flow.

**Cross-reference:** every Block in `FINAL_BUILD_PLAN.md §4` references its Priority A test rows. Block acceptance criteria gate on these rows being PASS.

Re-read `docs/FINAL_BUILD_TEST_PLAN.md` before starting any UI test. Re-read this §17.10 before deciding "I'm done with A and can move to B." The priority order is non-negotiable.
> Avyartha-kalatvam: do not waste even one tiny second, and do not compromise on correctness, proof, or product quality.

