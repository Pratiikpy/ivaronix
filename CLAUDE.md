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
- §15 Bookkeeping in the same commit (the "ship X → discover X" rule)

## 1. Hard rules

- **No compromise.** If a feature is on the build list and is testable, ship it. If a feature is "cool but unverifiable" (you can't prove it works by using it), **push back and propose something verifiable instead.**
- **Production-ready option rule.** Always choose the strongest practical implementation, test, and UX path available. Do not choose the easiest path if it leaves the feature weaker, less polished, or less verifiable. If there are multiple options, pick the one that makes the product more useful, trustworthy, smooth, and production-ready.
- **No `Co-Authored-By` / `Author:` trailers in git commits.** Conventional-commits style; subject + body only.
- **Test = easy to verify by USING it.** If shipping a feature requires "so many things to even see if it works," redesign it or replace it with something simpler that earns the same value. The CLI is the gold standard — you run a command, you see the result, you know it works.
- **No lazy blocked.** Before marking anything blocked, prove you tried the strongest available method: Playwright, real browser extension, backend harness, CLI script, mocked external client, protocol-level test, code-level verification, multi-wallet flow, multi-session flow, or any other route that can prove the feature works end-to-end.
- **Blocked means truly external.** Only mark a test blocked when it needs something unavailable in this environment: a real phone, BotFather-issued Telegram token, Claude Desktop/Cursor UI, macOS/Linux machine, paid quota, or another genuinely external dependency. "Hard", "takes time", or "needs careful automation" is not blocked.
- **Brutal honesty.** If a path is wrong, say so. Reject items that don't move the needle.
- **Surface the half-baked, always.** When a feature exists in code but the UX, surface, or end-to-end story is incomplete, say it explicitly *first* — before recommending it as a strength or proposing to extend it. Do not bury "we have the mechanics, the surface is missing" inside a feature pitch. The user must hear "this is half-finished, here is exactly what part" before any extend / promote / lock-in conversation. Half-baked surfaced late = wasted strategy time.
- **The only blocker is money.** Anything not requiring real OG funding is a "yes, build it" item. Mainnet deployment + ChainGPT audit waits on the user funding the deployer wallet (B-2).

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
| A new env var | `packages/runtime/src/env.ts` alias chain, **both** env templates (`.env.example` at repo root + `apps/studio/.env.production.template`), `docs/PRIVACY_NOTES.md` if it touches privacy. `pnpm env:check` runs naturally so no separate update there. Lead with the canonical `IVARONIX_*` form in the templates; document the legacy alias as a deprecated fallback in a comment. **The templates get copy-pasted verbatim by operators — a stale entry breaks first-time setup, not just doc accuracy.** |
| A new auto-derived count in `numbers.json` | `scripts/diag/numbers-refresh.ts` `buildSnapshot()`, replacing `existing.<field>` with a `count<X>()` helper. Don't preserve a hand-frozen number across refreshes — the value silently drifts when the underlying source changes (cron-sweep findings · 2026-05-10). |
| A new ghost-surface deletion (empty package or app dir) | `HLD.md` §1 "All surfaces are real today" call-out, any `packages/<X>` reference in HLD/UI_UX_GUIDE/COMPONENTS pointing at the deleted dir, the architecture diagram if it shows the surface. **Same rule applies to `git mv` renames.** Do NOT rely on git to track empty-dir deletions — they're untracked locally only. |
| A new contract V2 | `contracts/deployments/{testnet,mainnet}.json`, `apps/studio/src/lib/chain.ts` `unifiedX` helpers, `apps/cli/src/commands/receipt.ts` `buildReadRegistries`, `docs/MAINNET_READINESS.md`, `CHANGELOG.md` with `Closes audit K-N` trailer. **Numbers + addresses propagate automatically once added to `contracts/deployments/testnet.json`** — `pnpm numbers:refresh` rebuilds `contracts.list` + `contracts.addresses` (sweep 36); `pnpm docs:render` regenerates the README + MAINNET_READINESS contracts:auto blocks (sweeps 40-41). Don't hand-edit those tables. |
| A new audit closure | `CHANGELOG.md` row, `Closes audit <ID>` commit trailer, `docs/USER_TODO.md` row marked ✅ SHIPPED if it was queued there. **The trailer is structurally enforced**: `.githooks/commit-msg` (sweep 236+239) rejects any commit that adds a `✅ {CLOSED|FIXED|SHIPPED|DEPLOYED|VERIFIED|CODE-COMPLETE}` marker to HALF_BAKED.md / PHASE_B_DISCLOSURES.md / USER_TODO.md without a `Closes audit <ID>` line in the body. Read-side companion: `verify-half-baked-closure-citations.ts` (sweep 203 + extensions 224/238) fails any ✅ header missing a citation. So the rule is locked at both write-time (hook) and read-time (regression) — not muscle memory. |
| A new canonical `IVARONIX_*` alias chain | `packages/runtime/src/env.ts` alias array, **every** `AGENTS.md` that mentions the legacy form (`apps/{cli,studio}/AGENTS.md`, `packages/og-router/AGENTS.md`, etc.). Lead with canonical; demote legacy to a parenthetical or comment. The `verify-agents-md-canonical-aliases.ts` regression enforces ordering — fails CI on any AGENTS.md line that mentions a legacy alias without the canonical leading on the same line. (cron-sweep 44-45 caught 6 ordering violations across 3 AGENTS.md files; gate now prevents recurrence.) |
| A new numerical claim in a render-target markdown doc | The four target docs (README, PITCH, JUDGE_GUIDE, MAINNET_READINESS) must wrap any value ≥ 100 that comes from `numbers.json` in `<!-- numbers:auto:KEY -->VALUE<!-- /numbers:auto:KEY -->` markers. The `verify-no-bare-numbers-in-rendered-docs.ts` regression enforces this — fails CI on any bare numerical claim that matches a numbers.json value (filtered to ≥100 to avoid table-row + URL noise). Wrap-then-render-then-commit is the workflow. |

### Why this matters

A repo at "production-ready" feels different from a repo at "everything works": every doc points at every file that exists, every rule references every place it applies, every "queued" entry in any tracker is fresh. The cost of not doing the bookkeeping is invisibility — the work is real, but the next contributor has to re-discover it from scratch by grepping the codebase.

**Rule of thumb: if you spent more than 20 minutes shipping something, spend 5 minutes updating its references.** The 25% overhead is what production-ready repos look like and what hackathon-stage repos skip.
