# Ivaronix · CLAUDE.md (working contract)

> Operational ground rules for any agent working on this project. Updated 2026-05-08.

## 1. Hard rules

- **No compromise.** If a feature is on the build list and is testable, ship it. If a feature is "cool but unverifiable" (you can't prove it works by using it), **push back and propose something verifiable instead.**
- **No `Co-Authored-By` / `Author:` trailers in git commits.** Conventional-commits style; subject + body only.
- **Test = easy to verify by USING it.** If shipping a feature requires "so many things to even see if it works," redesign it or replace it with something simpler that earns the same value. The CLI is the gold standard — you run a command, you see the result, you know it works.
- **Brutal honesty.** If a path is wrong, say so. Reject items that don't move the needle.
- **The only blocker is money.** Anything not requiring real OG funding is a "yes, build it" item. Mainnet deployment + ChainGPT audit waits on the user funding the deployer wallet (B-2).

## 2. Judging criteria (lock this in your head)

1. **Extent of adoption of 0G components** — every primitive you can credibly use, use it: `0G Chain` (deployed contracts), `0G Compute` (TEE inference + fine-tuning), `0G Storage` (state persistence + Merkle proofs), `0G DA` (data availability for receipts), agent skills SDK, agentic ID.
2. **Innovative solutions to AI / Functional integrity, code quality, mandatory on-chain deployment** — receipts are the spine; on-chain deployment is non-negotiable; code quality is enforced via typechecks + 61/61 Foundry tests + CI matrix.
3. **Market fit, problem-solving capability, user value, growth roadmap** — Track 1 (cognitive backbone for OpenClaw and any 0G agent). PMF: every user-facing feature should be runnable in one command with a visible verifiable result.
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

## 10. Visual contract — match `Ivaronix.html`

`Ivaronix.html` at the repo root is the **canonical visual reference** for every Studio surface. The Next.js app at `apps/studio/` must look indistinguishable from that file when rendered side-by-side.

Non-negotiables:
- **Cream background** `#faf9f6`, **near-black ink** `#0a0a0a` (not the warmer `#1a1a1a`).
- **Typography:** Outfit (geometric sans, weights 500/600/700) for body + headings, Instrument Serif italic for accents, JetBrains Mono for hashes/code. Load via `next/font/google`. **System fonts are a regression — never ship them as a default.**
- **Border radii:** `10px` / `14px` / `16px` / `20px`. Sharper radii (`4–8px`) read as draft-quality.
- **Hero density:** every landing surface (`/`, `/onboard`, `/skills`) has a hero band with concrete numbers (live receipt count, agent count) — not just a headline + button.
- **Hover micro-interactions:** cards lift `translateY(-2px)` + border-color tint on hover. Pure box-shadow without lift looks static.
- **Header:** sticky, `backdrop-filter: blur(20px)`, 64px tall, brackets-only logo on the left, nav links on the right.
- **Footer:** multi-column grid (Product / Docs / Network / Social), not a single-line flex.
- **Section eyebrows:** uppercase micro-labels with letterspacing; both `§ 01 · THING` and `— Thesis` styles are acceptable as long as the chosen one is consistent within a page.

Verification before shipping any UI change:
1. Open `Ivaronix.html` in a headless browser, screenshot at 1440×900 + 375×812.
2. Open the changed Studio route at the same viewports.
3. Lay them side-by-side. If the Studio screenshot reads as "less designed" — colours weaker, type blander, radii sharper, hero emptier — fix the Studio render first; do not commit.

What "match" means:
- **Same** colour palette tokens, identical hex values.
- **Same** type ramp (display sizes, leading, letter-spacing).
- **Same** spacing scale (8/12/16/24/32/48/96).
- **Same** card surface treatment (white on cream, hairline border, lift-on-hover).
- **Same** four-light-row chip set wherever verification is shown.

The HTML file is updated when the brand evolves; treat it as the brand spec, not as legacy demo HTML. Any divergence is a Studio bug, not a brand drift.
