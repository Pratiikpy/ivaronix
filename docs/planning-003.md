# planning-003.md · No-compromise plan to win 0G APAC Hackathon

> Synthesized from `wanderingthoughts.md` (89 thoughts, 55 angles, 30 sessions) + `wanderingflow.md`. Split by what ships on testnet (no funding gate) vs what requires mainnet OG (operator-action gate). Voice per CLAUDE.md §9: no em-dashes, no banned words, numbers > adjectives. Discipline per CLAUDE.md §1 + §11 + §12.

## How to read this doc

- **Section A · TESTNET.** Everything that can ship now with the operator's existing 69 OG on Galileo (chainID 16602). Zero new funding required. ~33h focused single-dev work.
- **Section B · MAINNET.** Everything that requires operator OG on Aristotle (chainID 16661) or external paid services. ~6h dev work + operator-action gates.
- **Section C · Acceptance gates.** §11.1 to §11.6 + §12.1 + §12.3 per item.
- **Section D · Sequencing.** Day-by-day cadence + dependencies.
- **Section E · Coverage map.** Every wander-thought + operator-action + §13 submission requirement mapped to a section.
- **Section F · Explicit skips.** What the plan deliberately does NOT do.
- **Section G · Stop-condition check.** §12.3 three-times-think before declaring done.
- **Section H · Final status.** Outcome target per phase boundary.

Each item carries: **WT** = wandering-thought reference, **E** = effort hours, **D** = dependency, **P** = proof artifact, **A** = acceptance gate.

---

# A · TESTNET version

## A.1 · Critical correctness (must ship before mainnet redeploy)

Six fixes that close pre-mainnet broken-state risks. Without these, mainnet ships with the headline command broken.

### A.1.1 · Form/schema enum drift bug
- **WT:** #43, #44, #85
- **E:** 50min
- **What:** `apps/studio/src/app/skill/new/page.tsx` declares `shell_access: ['none','read','read-write']` and `memory_access: ['none','project_only','cross_project']`. `packages/skills/src/manifest.ts:11,15` Zod requires `['none','sandbox-only','full']` and `['none','project_only','all']`. Every default-form save fails Zod validation today.
- **Fix:** import `Permissions.shape.shell_access._def.values` and `Permissions.shape.memory_access._def.values`. Form derives from schema, not redeclared.
- **Test:** vitest case asserting `SHELL_OPTIONS.length === 3 && SHELL_OPTIONS.includes('sandbox-only')`. Plus Playwright submit-default-form test that produces a real receipt.
- **P:** vitest run output green; Playwright video of submit-default-form-makes-real-receipt.
- **A:** §11.1 (real flow), §11.4 (no missed cases), §12.1.

### A.1.2 · CLI receipt verify V2-first
- **WT:** #88
- **E:** 1h
- **What:** `apps/cli/src/commands/receipt.ts:5` imports V1 client only. After K-2 mainnet redeploy, `ivaronix receipt verify <id>` returns "not found" for V2 receipts. CLAUDE.md §1 calls the CLI the gold standard; the gold standard breaks at the worst time without this fix.
- **Fix:** `getRegistry(network)` returns `ReceiptRegistryV2Client` when V2 address exists in `deployments/<network>.json`, V1 fallback otherwise.
- **Test:** `scripts/qa/metamask-e2e/verify-cli-receipt-v2.ts` runs `ivaronix receipt verify <V2-id>` against a real Galileo V2 receipt and asserts FULLY VERIFIED ✓.
- **P:** chainscan link for the V2 receipt; CLI stdout transcript with green status.
- **A:** §11.1, §11.4, §12.1, §1 (gold standard must work).

### A.1.3 · Studio V1-blindness pattern fix (5 surfaces + onboard)
- **WT:** #19, #28, #37, #41, #45, #51
- **E:** 1.5h
- **What:** Six surfaces read V1 only: `/` home counter, `/agents` leaderboard, `/skills` catalog, `/global` stats, `/embed/r/[id]` embed, `/r/[id]/print`. Plus `/onboard` mints to V1, trapping new mints in legacy contract.
- **Fix:** ship `apps/studio/src/lib/registry-aware.ts` with `loadReceiptUnified(idOrRoot)`, `liveCountsUnified()`, `listAgentsUnified()`. Each surface imports from the lib. `getPassportClientV2()` mirrors the receipt pattern. Onboard mints to V2 first.
- **Test:** Playwright suite asserts every surface renders V2 receipts when present + falls back to V1 when V2 is empty. Lint rule bans direct `getReceiptRegistry()` calls outside the lib.
- **P:** Side-by-side screenshots of each surface at 1440×900 + 375×812 per §10. V1 LEGACY chip rendered correctly.
- **A:** §11.1 to §11.4.

### A.1.4 · Studio package tests + ESLint + CI workflow
- **WT:** #2, #21, #84, #90
- **E:** 4h
- **What:** `apps/studio/package.json:10-11` ships `test: "echo skip"` + `lint: "echo skip"`. `pnpm -r test` returns success without exercising Studio. 13 packages ship `lint: "echo skip"`. No Foundry CI gate (only `jcs-roundtrip.yml` exists).
- **Fix:**
  - Wire vitest in `apps/studio` with 5 starter tests: schema-form parity, V2-first loader, skill list parity, Burn Mode encrypt+decrypt round-trip, SIWE auth.
  - Ship root `eslint.config.js` (ESLint 9 flat-config + `@typescript-eslint`) with 3 baseline rules: `no-explicit-any`, `no-non-null-assertion`, `no-console` (CLI override).
  - Replace 13 `lint: "echo skip"` with `eslint .`.
  - Ship `.github/workflows/ci.yml` with 5-job matrix: foundry-test, typecheck, studio-build, lint, regression-smokes. Block PR merge on red.
- **P:** GitHub Actions green on the PR that ships these.
- **A:** §11, §12.1.

### A.1.5 · V2 anchor smoke wired into label-gated CI
- **WT:** #52
- **E:** 2h
- **What:** `scripts/qa/metamask-e2e/verify-v2-anchor-live.ts` is comprehensive (signs EIP-712, anchors V2, verifies nonce + agent + receiptRoot + chainscan link) but runs only via manual `tsx`. K-2 correctness has zero CI gating.
- **Fix:** create `scripts/qa/metamask-e2e/run.ts` orchestrating V2 smoke + V1 fallback smoke + receipt-verify smoke. Wire into `.github/workflows/chain-smoke.yml` triggered on PR label `run-chain-smoke` + nightly cron. Use a CI-scoped wallet seeded with 0.5 OG from operator's 69 OG balance. Cost ~0.06 OG/month.
- **P:** GitHub Actions green; nightly cron history visible in Actions tab; chainscan links from each run.
- **A:** §11.1 (real chain side-effect), §12.1.

### A.1.6 · Schema-as-source-of-truth lint for Studio forms
- **WT:** #85
- **E:** 30min
- **What:** Companion to A.1.1. Any Studio form binding to a Zod enum must derive options from the schema, not redeclare them.
- **Fix:** add CLAUDE.md §10 sub-rule: "Forms binding to Zod schemas MUST derive options from the schema." Lint check fails when a form file declares an array literal with the same values as a Zod enum elsewhere.
- **A:** §12.1.

## A.2 · Submission-package polish (zero engineering, direct Criterion 4 + 5 lift)

Eight doc-only moves. Cheapest hours in the plan.

### A.2.1 · README persona-first rewrite + 4-line ladder hero
- **WT:** #7, #16, #18, #54, #77, #48
- **E:** 1h
- **What:** Current README leads with architecture + numbers. Field shows persona-first wins (Aishi, VerifyHuman, Provus, MUSASHI). Ivaronix's lawyer/founder persona is consumer in spirit but framed as developer-infra. MUSASHI's hero ladders: action verb → mechanism → social proof → numbers.
- **Fix:** rewrite first 40 lines as MUSASHI-shape ladder:
  - Line 1: project name only.
  - Line 3: tagline `Catch the risks. Keep the receipts.`
  - Line 5-15: 5-line ASCII flow diagram (Drop document → 0G Compute TEE → 0G Chain anchor → Public Proof URL).
  - Line 17-25: 5-step "How it works" numbered list.
  - Line 27-30: 4-line ladder. AI review for documents you can't paste into ChatGPT. Burn-Mode encrypts; the session key dies after the run. Every audit anchors a verifiable receipt on 0G Chain. Anyone can re-verify it from any machine, in any language. **Verifiability over volume.**
  - Line 31-35: copy-paste quick start (`git clone → pnpm install → pnpm cli verify <id> --tee-independent`).
  - Drop "0G Agent Operating System" framing per #16 (keep only in `docs/_internal/` planning).
- **P:** README diff visible; cite VerifyHuman + Aishi + MUSASHI as positive references in PR description.
- **A:** §9, §11.4.

### A.2.2 · README screenshot grid + Playwright capture pipeline
- **WT:** #4, #56
- **E:** 75min
- **What:** Aishi packs 8 phone screenshots; Ivaronix has zero. Visual-density gap on first scroll.
- **Fix:**
  - Capture 6 product shots at 1200×800 PNG via existing E2E harness:
    1. Studio home with hero + receipt counter
    2. Run panel mid-execution (4 lights pending → verified)
    3. `/r/<id>` proof page with all four lights green + TIER 1 chip
    4. Burn Mode dialog with key fingerprint visible
    5. `/agents` leaderboard with 4 minted passports
    6. `/onboard` 5-row stepper with green checkmarks
  - Add to `screenshots/readme/` directory.
  - 2×3 markdown table in README directly under headline numbers.
  - `pnpm screenshots:refresh` script re-runs capture (auto-refresh, no drift).
  - Use only GitHub-renderable formats: shields.io, PNG/JPG, mermaid, markdown tables. NO inline CSS, custom fonts, or embedded SVG with style attributes (per Kuberna negative reference, #82).
- **P:** PNG files committed; README renders the grid on GitHub.
- **A:** §10.

### A.2.3 · Documentation section + judge-grade doc surfacing
- **WT:** #55
- **E:** 30min
- **What:** `PHASE_B_DISCLOSURES.md`, `CRYPTO_NOTES.md`, `HASH_FUNCTION.md`, `MAINNET_READINESS.md`, `RECEIPT_SCHEMA.md` are graduate-level depth artifacts unlinked from README. Judge skimming README → PITCH → JUDGE_GUIDE never sees them.
- **Fix:** add "Documentation" section to README immediately after Track 3 numbers block. One line per high-value doc with one-liner description. Add "Going deeper" footer to JUDGE_GUIDE linking PHASE_B + CRYPTO_NOTES.
- **A:** §12.4.

### A.2.4 · Track 3 by-the-numbers headline + Track 1 metrics block
- **WT:** #64, #70, #74, #78
- **E:** 30min
- **What:** Track 3 evidence (SkillRegistry, 156 skills, 26 paid runs, 0.0014 OG creator earnings, 90/10 split) is buried in PITCH.md. Field reads "AgentPay = Track 3, Agentra = Track 3 (under development), Ivaronix = ??". Plus Aegis Vault's 235 tests + mainnet shape sets a Track 2 bar Ivaronix doesn't compete on.
- **Fix:** add two blocks to README right after headline numbers:
  1. **Track 1 metrics** (the game we play): 6 first-party + 150 vendored skills (= 156), 13 receipt types, 6 0G primitives integrated (Chain/Compute/Storage/Router/AgentID/MemoryKV), 8 deployed contracts (V1 + V2), 1,332+ receipts anchored, 26 paid creator runs, 1 autonomous receipt-cycle agent.
  2. **Track 3 by the numbers** (auto-secondary): SkillRegistry `0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1` · 156 skills published · 26 paid runs of private-doc-review · creator earned 0.0014 OG · exact 90/10 split per `og.creator.fee_split` · `ivaronix skill earn-history` returns real chain numbers.
  3. Plus primitives table mapping each 0G primitive to receipt type + product surface (per #64).
  4. Plus explicit note: "Ivaronix targets Track 1 primary + Track 3 secondary. Track 2 production-rigor metrics (235 tests + mainnet sealed strategies) belong to Aegis Vault." Honest framing per CLAUDE.md §1.
- **A:** §1, §11.4.

### A.2.5 · Counter-position table + honest tier disclosure
- **WT:** #58, #65, #73, #79
- **E:** 30min
- **What:** 0GClaw publishes "How It Compares to OpenClaw" table painting OpenClaw as dangerous. Trapezohe Ghast skills_store + Agentra both target Track 3. AlphaTrace conflates storage integrity with compute integrity. AIsphere ships sweeping marketing slogans backed by numbers.
- **Fix:**
  - Add "How Ivaronix compares" table to README right after Track 3 block:

    | | OpenClaw | 0GClaw | Trapezohe | AlphaTrace | Ivaronix |
    |---|---------|--------|-----------|-----------|----------|
    | Where it runs | Your laptop | 0G infra | Git-only | Gemini (no TEE) | TEE-attested 0G Compute |
    | Verifiable compute | No | Storage proof only | No | Storage only (NOT compute) | TIER 1 TEE + chain anchor + 3rd-party re-verify |
    | Receipt-gated payment | No | x402 USDC | No | No | og.creator.fee_split per skill |
    | Re-runnable on stranger's machine | No | No | No | No | Yes |
    | Polyglot canonical hash | No | No | No | No | TS + Python + Rust byte-equal in CI |

  - Add "Why two tiers" callout: "Every Ivaronix receipt is TIER 1 (TEE-attested, green) or TIER 2 (external provider, amber). We refuse to render external-provider receipts as if they were TEE-attested. Some competitors don't make this distinction. We do because it's the only honest reading of what the cryptographic proofs guarantee."
  - Surface tier distinction on `/r/<id>` proof page: explicit "verifies storage integrity ✓ verifies compute integrity ✓" line for TIER 1; "verifies storage integrity ✓ verifies compute integrity ⚠ external provider" for TIER 2.
  - Add §9 sub-rule: "Slogans are allowed when paired with a concrete number or clickable artifact in the SAME paragraph." Cite AIsphere ("civilization" + 94/94 = works) vs Whale.fun (adjective stacks + zero numbers = doesn't work).
- **A:** §1, §6, §9.

### A.2.6 · Surface K-15 polyglot moat as Criterion 1 lead
- **WT:** #91 (covered by #80-89 cluster)
- **E:** 10min
- **What:** Three reference implementations (TS + Python + Rust) byte-equal in CI on every PR/push is unique in the field. Currently buried.
- **Fix:** lead README's technical-depth section with this. "TS reference (`packages/core/src/jcs.ts`, 17 tests). Python reference (`scripts/verifier-py/`, 14 tests). Rust reference (`ivaronix-verifier-rs/`, 11 tests). 29/29 byte-equal across all three on every PR. The only project in the field shipping reproducible canonical hashing across 3 languages."
- **A:** §11.4.

### A.2.7 · Numbers + skill-count consolidation
- **WT:** #1, #13, #19, #53, #68
- **E:** 3h
- **What:** Receipt count drifts (PITCH says 1,165, Studio shows 1,332+, README mid-update). Skill catalog count drifts (5/6/155/156 across 4+ surfaces). Foundry test count is 121/121 in HALF_BAKED, "90/90" in README. RunPanel hardcodes 6 skills. RECEIPTS_SPEC lists 9 types; code has 13.
- **Fix:**
  - Single `docs/numbers.json` source of truth: `{receiptCountV1, receiptCountV2, skillCount, contractCount, foundryTests, packagesGreen, mainnetItems, receiptTypes}`.
  - `pnpm numbers:refresh` reads `ReceiptRegistry.nextId()` + counts `seed-skills/*/SKILL.md` + parses `forge test` output + counts `pnpm -r ls` packages + reads `RECEIPT_TYPES` from `packages/core/src/types.ts`.
  - Markdown docs use `<!-- numbers:auto -->` placeholders; `pnpm docs:render` substitutes.
  - CI fails if `docs/numbers.json` is more than 24h older than the latest receipt anchored on chain.
  - RunPanel imports `loadAllSkills()` from `@ivaronix/skills` instead of hardcoding.
  - RECEIPTS_SPEC §1 type table generated from `RECEIPT_TYPES` between `<!-- AUTO:types:start -->` markers.
- **A:** §12.1.

## A.3 · Schema + voice cleanup

Eight items. Each closes a drift class or sprint-language fossilization.

### A.3.1 · Sprint-language scrub across JSDoc + NatSpec
- **WT:** #8, #11, #23, #49, #72
- **E:** 45min
- **What:** Production source carries "Day-13 scaffold," "Phase B+", "K-1 fix", "planning-01 §3C", "killer demo", "Track 5 headline" — sprint-internal vocabulary fossilized in source files (and chain metadata for Solidity). 9 contracts + Studio components + CLI bin file affected.
- **Fix:**
  - Grep `apps/studio/src/`, `apps/cli/src/`, `contracts/src/` for: `\bDay[\s-]?\d+\b|\bPhase [A-Z]\b|\bsprint\b|\bplanning-0\d|killer demo|Track [0-9] headline`.
  - Replace with capability-statement framing.
  - Add CLAUDE.md §9 sub-rule: "JSDoc/NatSpec describe WHAT the code does, not WHEN it was written."
  - Ship `pnpm lint:voice` lint that fails on those patterns. For Solidity: `forge inspect <contract> metadata | grep` lint to block sprint-language at deploy time.
  - Ship `contracts/SOLIDITY_VOICE.md` with examples.
- **A:** §9.

### A.3.2 · Threat-model JSDoc on every security primitive
- **WT:** #66
- **E:** 1h
- **What:** `packages/og-storage/src/burn.ts:13-14` and `packages/memory/src/encryption.ts` ship the gold-standard pattern: positive scope claim + explicit out-of-scope. Other security files don't.
- **Fix:** add CLAUDE.md §11 sub-rule. Backfill 5 files:
  - `packages/og-router/src/keyring.ts`
  - `apps/cli/src/commands/delegate.ts`
  - `contracts/src/CapabilityRegistry.sol` (NatSpec)
  - `contracts/src/MemoryAccessLog.sol` (NatSpec)
  - `contracts/src/Erc7857Verifier.sol` (NatSpec)
- Ship `pnpm security:check` lint that scans path-list and fails if threat-model header is missing.
- **A:** §11.

### A.3.3 · Brand-token consolidation
- **WT:** #6, #24
- **E:** 30min
- **What:** CLAUDE.md §10 says cream `#FAFAF7` + Outfit; UI_UX_GUIDE.md says cream `#faf9f6` + Times New Roman. Two canonical-source-of-truth claims that disagree.
- **Fix:** ship `brand/tokens.css` + `brand/tokens.json` with locked values from CLAUDE.md §10. Strip conflicting hex/font from UI_UX_GUIDE; replace with pointer. `pnpm brand:check` lints both docs + `globals.css` for hardcoded hex not in `tokens.json`.
- **A:** §10.

### A.3.4 · Env-var convention consolidation
- **WT:** #9, #15, #22
- **E:** 45min
- **What:** Same private key referenced as `OG_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, `IVARONIX_*`. Four prefixes for one product. New operator setting up Ivaronix hits "missing env var" errors because `forge` reads `OG_PRIVATE_KEY` directly while CLI reads aliases.
- **Fix:** `packages/runtime/src/env.ts` becomes canonical source. `IVARONIX_SIGNER_KEY` is the canonical name; map all four legacy aliases. `validateEnv()` prints deprecation warning on every legacy alias use. Update `contracts/script/Deploy*.sol` to read `IVARONIX_SIGNER_KEY` first via `vm.envOr(...)`. `pnpm env:check` script.
- **A:** §1 (no first-run friction).

### A.3.5 · `tsconfig.base.json` consolidation
- **WT:** #89
- **E:** 1.5h
- **What:** Zero Ivaronix-side `tsconfig.base.json`. Per-package tsconfigs drift on `strict`, `target`, `moduleResolution`.
- **Fix:** ship `tsconfig.base.json` at repo root with canonical settings (target ES2022, module NodeNext, strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, isolatedModules, verbatimModuleSyntax). All 14 per-package tsconfigs extend it. Run `pnpm -r typecheck` after; fix any newly-surfaced gaps.
- **A:** §11.

### A.3.6 · `receipt_required` schema simplification
- **WT:** #80
- **E:** 30min
- **What:** `seed-skills/plan-step/SKILL.md:27` opts out of `receipt_required`. CLAUDE.md §7: "Every action generates one [receipt]." Direct contradiction.
- **Fix:** drop `receipt_required` field from manifest schema. Every skill anchors. Update `plan-step` + any other opt-out skill. Update CLAUDE.md §7.
- **A:** §7.

### A.3.7 · Test-key namespace headers on contract test files
- **WT:** #86
- **E:** 40min
- **What:** Foundry test files use deterministic hex-pattern test keys but lack the "test-keys-only" header. Scanners might flag.
- **Fix:** add 5-line warning header to all 8 contract test files. Add convention to `contracts/AGENTS.md`. Lint check.
- **A:** §11.

### A.3.8 · Per-skill creator-fee-split coverage
- **WT:** #50
- **E:** 10min
- **What:** `code-edit` and `plan-step` SKILL.md files lack `creator.fee_split` block.
- **Fix:** add default `creator.fee_split: { creator: 9000, treasury: 1000 }` to every first-party skill missing it. Lint enforces presence.
- **A:** §7.

## A.4 · Architecture compounding (testnet-first)

### A.4.1 · Autonomous wander-cycle agent on TESTNET
- **WT:** #67, #69
- **E:** 4h scaffold + 1h observability
- **What:** Provus has 30K mainnet TXs from a 15s autonomous loop. Without continuous chain anchoring, the volume narrative is impossible. Same primitive applies to compliance-reviewer use case (15min cadence on contract repos).
- **Fix:** ship `scripts/wander-cycle/` agent. Runs `private-doc-review` on synthetic randomly-generated lease documents every 5min from a CI-funded wallet. Anchors receipt to V2. Logs to `docs/wander-cycle-history.jsonl` for observability.
- **Cost on testnet:** 8,640 receipts/month × 0.0001 OG = 0.86 OG/month. Allocate 1 OG from operator's 69 OG balance to CI wallet.
- **P:** A 24h trial run produces ~288 receipts. Receipt count visible on `/global` Studio page.
- **A:** §11.1, §12.1.

### A.4.2 · Path-scoped `.claude/rules/*.md` for monorepo agent guidance
- **WT:** #61
- **E:** 1h
- **What:** AlphaDawg pattern. One 400-line CLAUDE.md vs path-scoped rules files that auto-load on path match.
- **Fix:** ship 7 path-scoped rules files:
  - `.claude/rules/contracts.md` (NatSpec voice + Foundry invariants + no sprint-language)
  - `.claude/rules/og-router.md` (single-use headers + third-party endpoint warning + keyring failure-mode taxonomy)
  - `.claude/rules/og-storage.md` (chunking + content-address discipline + Burn Mode invariants)
  - `.claude/rules/og-chain.md` (V2-first fallback + EIP-712 typed-data domain + getDeployedAddress lookup order)
  - `.claude/rules/consensus.md` (RoleId enum + tier definitions + Jaccard threshold + processResponse third-arg)
  - `.claude/rules/skills.md` (manifest schema + sandbox enums + creator-fee-split requirement + scanner shape)
  - `.claude/rules/studio.md` (V2-first read pattern + brand contract per §10 + mobile breakpoints + Run-panel state)
- Each ~30-50 lines. Reduces top-level CLAUDE.md by ~40%.
- **A:** §11.

### A.4.3 · CHANGELOG.md + commit-trailer audit convention
- **WT:** #57, #62, #63
- **E:** 45min
- **What:** PHASE_B_DISCLOSURES.md is the strongest "we shipped discipline" log but it's a one-off. HALF_BAKED.md is 6/7 closed but has no inline status row. Same audit-fix lifecycle in two docs.
- **Fix:**
  - Rename PHASE_B_DISCLOSURES → CHANGELOG.md at repo root. Section by phase.
  - Add inline `Status: ✅ Closed by S-1 · commit abc1234` row to every HALF_BAKED.md A-item.
  - Establish commit-trailer convention: `Closes audit #N` (NOT `Co-Authored-By` per CLAUDE.md §1).
  - `pnpm audit:list` runs `git log --grep "Closes audit"` and prints the audit roll-up.
  - Promote in JUDGE_GUIDE.md: "How we operate · `git log --grep 'Closes audit'` shows every audit caught + fixed in this branch."
  - Add CLAUDE.md §9 example list: "Voice we ship: VerifyHuman. Voice we reject: Whale.fun. Voice we aspire to: AlphaDawg."
- **A:** §11, §12.6.

### A.4.4 · zer0Gig Efficiency Game adoption + dont-get-drained aggregation policies
- **WT:** #59, #75
- **E:** 6h
- **What:** zer0Gig pitches per-run quality conditioning (1-shot=95%, 2-retries=85%, 3-retries=70%). dont-get-drained surfaces aggregation policies as user knob (unanimous/majority/any-reject). Ivaronix ships flat 90/10 with no user knob.
- **Fix:**
  - Receipt schema: `outcome` block `{attempts, firstAttemptScore?, finalScore, retryReason?}`.
  - Skill manifest: `feeSplitPolicy: 'flat' | 'efficiency-game'` (default `flat`; first-party skills opt into `efficiency-game`).
  - Skill manifest: `consensus.policy: 'unanimous' | 'majority' | 'first-objection' | 'weighted'` (default `majority`).
  - On-chain split: TIER 1 first-attempt = 95%, TIER 1 retry = 85%, TIER 2 = 70%, failed = no creator payout (only treasury collects gas).
  - Run panel: dropdown next to skill picker "How strict?" with three options. Default to skill's manifest, override per-run.
  - `/r/<id>` chip: `EFFICIENCY 95%` + `STRICT/BALANCED/LENIENT` next to four-light row.
  - `consensus.policyApplied` and `consensus.dissents: number` recorded on receipt body.
- **P:** Test E2E receipts at all four payment tiers + all three policies.
- **A:** §11.1, §11.4.

### A.4.5 · Per-skill economic policy doc · `docs/MARKETPLACE_DESIGN.md`
- **WT:** #83
- **E:** 1h
- **What:** `content-pitch-review/SKILL.md:43-50` ships 70/30 with explicit comment ("commoditised, let market set price discovery"). private-doc-review ships 90/10. Per-skill policy is a Track 3 design depth competitors don't articulate.
- **Fix:** ship `docs/MARKETPLACE_DESIGN.md`. Document principle: "Per-skill fee splits. Differentiated skills (legal, security audit) earn 90/10. Commoditised skills (marketing review) earn 70/30." Render the split on skill catalog page next to each skill: `private-doc-review · 90/10 · TIER 1` vs `content-pitch-review · 70/30 · TIER 1`. Cite Efficiency Game (#75) as complementary mechanism: per-skill base × per-run quality = combined payout.
- **A:** §11.4.

### A.4.6 · `docs/SOLIDITY_CHOICES.md` · direct deploy + no upgradeability
- **WT:** #87
- **E:** 30min
- **What:** Aegis Vault chose EIP-1167 minimal proxies; Ivaronix chose direct deploy. Aegis cites "no upgradeable backdoor" as virtue. Ivaronix has the same virtue but doesn't articulate it. Comparison reads as "Aegis chose more sophisticated pattern; Ivaronix chose simpler."
- **Fix:** ship `docs/SOLIDITY_CHOICES.md` documenting:
  - Direct deploy + no governance multisig + no upgradeability = receipt-anchoring contracts as immutable as the receipts they anchor.
  - Per-block gas limit met by deploying contracts across multiple blocks rather than batching into proxies.
  - Optional: enable `via_ir = true` for production deploys (~20% bytecode reduction).
  - Cross-reference Aegis's "no upgradeable backdoor" line as supporting evidence.
- **A:** §12.4.

### A.4.7 · `docs/SKILL_PUBLISHING.md` · 3-path table
- **WT:** #71
- **E:** 30min
- **What:** AgentHub uses database-as-source; Ivaronix has 3 paths (seed-skills PR, /api/skill/save sandbox FS, SkillRegistry on-chain). Complexity not documented.
- **Fix:** ship `docs/SKILL_PUBLISHING.md` with 3-row table: Path / When / Persistence / Trust. Plus a decision tree on `/skills/new` Studio page.
- **A:** §11.4.

### A.4.8 · MemoryEngine as the FOURTH product surface
- **WT:** #33, #34
- **E:** 3-4h
- **What:** `packages/memory/src/engine.ts` is wired (MemoryEngine + CapabilityRegistry + MemoryAccessLog + K-20-fixed encryption + vector + FTS) but no CLI or Studio surface exposes it. SealedMind owns "memory-first" pitch with their 15-section ToC including SDK Usage / CLI / API Reference. Ivaronix has comparable depth in code, zero in product surface.
- **Fix:**
  - `ivaronix memory remember "<note>" --scope <work|legal|deals>` writes via MemoryEngine, encrypts at rest (K-20), anchors `memory_access` receipt on `MemoryAccessLogV2` (per A.5.25), indexes for hybrid retrieval.
  - `ivaronix memory recall "lease clauses"` runs hybrid FTS + vector (cosine similarity via `vector.ts` `embedAsync`), returns hits with anchor links.
  - `ivaronix memory forget --before 2025-01-01` purges old entries; receipt records the burn.
  - `apps/studio/src/app/memory/page.tsx` mirrors CLI surface, SIWE-gated.
  - `private-doc-review` skill auto-includes `og.permissions.memory_access: 'all'` and queries user's prior runs as context.
- Counter-positions SealedMind directly. Memory becomes Ivaronix's second leading-edge alongside polyglot verifiability.
- **A:** §11.1, §11.4.

### A.4.9 · Convergence scoring upgrade · Jaccard → embeddings
- **WT:** #35
- **E:** 2h
- **What:** `packages/consensus/src/convergence.ts` uses Jaccard tokenized similarity. Adversarial outputs ("approve risk acceptable" vs "reject risk unacceptable") share tokens — Jaccard returns ~0.5 medium-agreement when actual semantic agreement is ~0. False-confidence on legal review is a liability.
- **Fix:**
  - Wire `vector.ts` `embedAsync` into `convergenceEmbedding(...)`. Cosine similarity over `all-MiniLM-L6-v2` replaces Jaccard.
  - Keep Jaccard as fallback when embeddings can't load. `method: 'jaccard-tokens' | 'embedding-cosine-MiniLM'` recorded on receipt.
  - Add third signal: judge-explicit confidence (`convergence_assessment: agree|partial|disagree` parsed from judge role output).
  - Foundry-style unit tests with adversarial pairs that Jaccard rates ≥0.5 but cosine rates <0.2.
- **A:** §1, §11.

## A.5 · Process discipline + structural cleanup

### A.5.1 · 0G BuildProof submission post-mainnet
- **WT:** #81
- **E:** 15min after mainnet redeploy
- **D:** B.1 (mainnet redeploy)
- **What:** 0G BuildProof audits other 0G projects with AI agent + 0G Storage + 0G Chain. Mainnet-only. Submit Ivaronix to it post-K-1/K-2 mainnet redeploy for third-party validation.
- **Fix:** submit `https://github.com/Pratiikpy/ivaronix` to BuildProof. Capture passport URL. Add row to README: "Verified by 0G BuildProof: <passport-URL>." Counter-position regardless: "BuildProof is audit-as-service. Ivaronix is the platform that hosts services like BuildProof with receipt-gated fees."
- **A:** §12.4.

### A.5.2 · Per-package `AGENTS.md` for high-traffic packages
- **WT:** #60
- **E:** 1h
- **What:** zer0Gig + derek2403-0g ship per-package AGENTS.md. Ivaronix has one top-level CLAUDE.md.
- **Fix:** ship 6 `AGENTS.md` files: apps/studio, apps/cli, packages/og-router, packages/og-chain, contracts, seed-skills. Each 10-30 lines: package-specific gotchas + env vars read + chain addresses + test command. CLAUDE.md adds §13 line: "For package-specific guidance, see `<package>/AGENTS.md`."
- **A:** §11.

### A.5.3 · Operator-as-proxy privacy doc + per-deployment indexer key
- **WT:** #46
- **E:** 30min
- **What:** Data room operator wallet signs every public manifest fetch even for rooms it's not a party to. Privacy implication: operator sees all data-room reads.
- **Fix:** ship `docs/PRIVACY_NOTES.md` documenting the operator-as-proxy threat. Add `READ_PROXY_PRIVATE_KEY` env var (separate from `EVM_PRIVATE_KEY`) for storage-indexer auth only. Generate a fresh zero-balance key. CDN cache public manifests aggressively (Vercel edge cache) so indexer is hit once per (rootHash, cache-window) pair.
- **A:** §6.

### A.5.4 · Repo-root doc hygiene + sprint-doc archive
- **WT:** #5, #30, #36
- **E:** 30min
- **What:** 19 markdown docs in `docs/` with overlapping scope. SESSION_FINAL.md at repo root claims stale "287 anchored receipts." QA_MISSION.md is sprint-internal contractor brief.
- **Fix:**
  - `docs/spec/` — RECEIPT_SCHEMA, HASH_FUNCTION, CRYPTO_NOTES (technical contracts).
  - `docs/judge/` — JUDGE_GUIDE, PITCH, MAINNET_READINESS (external-facing).
  - `docs/audit/` — HALF_BAKED, QA_LOOP_BRIEF, QA_FULL_PRODUCT_REPORT, USER_TODO, PHASE_B_DISCLOSURES (honest internal state).
  - `docs/_internal/` — planning-01, planning-002, planning-003, PLAN_pass76, PASS77_*, QA_MISSION (engineering planning).
  - `git mv SESSION_FINAL.md _archive/`. Replace with `docs/STATUS.md` auto-generated from chain reads.
  - Split QA_MISSION into `docs/QUALITY.md` (evergreen philosophy) + `_archive/QA_MISSION.md` (contractor-specific).
  - Pre-commit hook fails when committing root-level markdown that references absolute receipt numbers.
- **A:** §11.4.

### A.5.5 · OG-image generation per Studio surface
- **WT:** #4
- **E:** 30min
- **D:** A.2.2 (screenshot harness)
- **What:** When Studio goes public, every `/r/<id>` shared link renders default Vercel image, not Ivaronix-branded.
- **Fix:** ship `apps/studio/src/app/opengraph-image.tsx` (default) + `apps/studio/src/app/r/[id]/opengraph-image.tsx` (per-receipt) using Next.js convention. Generate apple-touch-icon + favicon set from `ivaronix-mark.svg`.
- **A:** §10.

### A.5.6 · `scripts/` reorganization
- **WT:** #3
- **E:** 30min
- **What:** 13 one-off TS scripts at `scripts/*.ts` mix purposes. Two duplicate files (`smoke-storage.ts` + `storage-smoke.ts`).
- **Fix:** create `scripts/{ops,migrations,smoke,diag}/` subdirs. One git mv pass + `scripts/README.md` listing each subdir's purpose. Resolve the duplicate.
- **A:** §11.

### A.5.7 · `og-toolkit` honest stub disclosure
- **WT:** #11
- **E:** 15min
- **What:** `OgToolkit.kv` returns `StubKvClient` (in-memory Map) which lies about being a 0G KV.
- **Fix:** rename `StubKvClient` to `InMemoryKvClient`. Add `console.warn` first time used. Make `OgToolkit.kv` typed as `KvClient | null`; return null when only stub available. Doc-comment on `createKvClient()`: "stub for development; production needs `IVARONIX_KV_URL`."
- **A:** §1 (no public lies).

### A.5.8 · LICENSE + brand asset trademark separation
- **WT:** #27, #82
- **E:** 10min
- **What:** Repo MIT covers `brand/` SVGs by default. Hostile fork could ship at `ivaronix-x.app` with same logo.
- **Fix:** append `## Brand assets (separate license)` section to LICENSE. Brand assets reserved trademarks under nominative-fair-use rules. Add `BRAND.md` at repo root with the rule.
- **A:** §1.

### A.5.9 · IntervalMode AGENT_AUTO loose-accountability fix · `SubscriptionEscrowV2`
- **WT:** #26
- **E:** 1h
- **What:** `SubscriptionEscrow.sol:31-33` AGENT_AUTO has no rate-limit and no client-side recourse. Malicious agent silently drains funds.
- **Fix:** ship `SubscriptionEscrowV2.sol` requiring `attestationReceiptId` on every AGENT_AUTO check-in. Cross-check via `IReceiptRegistryView`. Receipt timestamp must be within `intervalSeconds` of `nextDueAt`. Receipts become load-bearing on the marketplace contract.
- **A:** §11.

### A.5.10 · CapabilityRegistryV2 with private storage
- **WT:** #12
- **E:** 30min
- **What:** `CapabilityRegistry.sol:29-30` `mapping(address => bytes32[]) public grantsByOwner` + `grantsByGrantee` are auto-public. Anyone can enumerate every grant + scopeHash for any wallet. Privacy leak for B2B legal reviews.
- **Fix:** ship `CapabilityRegistryV2.sol` with `internal grantsByOwner` (no auto-getter). Controlled `getGrantsByOwner(address)` view requiring `msg.sender == owner OR authorizedReader`. Off-chain indexers use events.
- **A:** §1.

### A.5.11 · SkillRegistryV2 with name-recovery + reserved-list
- **WT:** #20
- **E:** 30min
- **What:** `SkillRegistry.sol` is first-come-first-served. Squatter can register `keccak256("skill:private-doc-review")` first.
- **Fix:** ship `SkillRegistryV2.sol` with reserved-list pre-registration at construction. Document arbitration path in `docs/SKILLS_NAMING.md`.
- **A:** §11.

### A.5.12 · MemoryAccessLogV2 with msg.sender enforcement
- **WT:** #32
- **E:** 45min
- **What:** `MemoryAccessLog.sol:16-17` NatSpec ADMITS "no ACL because the events are public anyway." Anyone can spoof `agent` param for ~$0.001 gas, polluting any wallet's audit trail.
- **Fix:** ship `MemoryAccessLogV2.sol`. Require `msg.sender == agent` OR `grants[grantId].grantee == msg.sender` (cross-check against `CapabilityRegistry`). Existing V1 events stay readable; new logs go to V2.
- **Test:** Foundry tests for spoofing rejection.
- **A:** §11.

### A.5.13 · ShareButton silent clipboard-failure feedback
- **WT:** #31
- **E:** 10min
- **What:** `apps/studio/src/components/ShareButton.tsx:12-21` falls through to `window.open()` on clipboard failure with zero user feedback. Silent failure on the viral-loop moment.
- **Fix:** rewrite `useState<boolean>` to `useState<'idle' | 'copied' | 'fallback' | 'error'>('idle')` + 4-state label map. On clipboard fail set `'fallback'` and render "Opened in new tab — copy from URL bar →" for 3s.
- **A:** §11.4.

### A.5.14 · Keyring rotation transparency on receipts
- **WT:** #38
- **E:** 30min
- **What:** `Keyring.invalidate()` distinguishes 402/429/auth failure modes well, but receipt body's `routerTrace` doesn't capture WHICH credential rotation happened mid-run.
- **Fix:** extend receipt schema's `routerTrace` with `rotations: { fromCredential: string; toCredential: string; reason: '402' | '429' | 'auth'; atMs: number }[]`. Pipeline records on each `Keyring.invalidate()` call. Studio `/r/<id>` renders rotation list as small chip when non-empty.
- **A:** §11.4.

### A.5.15 · `eth-private-key` regex narrowing
- **WT:** #40
- **E:** 30min
- **What:** `packages/consensus/src/gates.ts:34` regex over-trips on every receipt id, tx hash, content hash, signature half. False-positives on every doc-review run that references a prior receipt.
- **Fix:** rewrite with context awareness. Negative lookbehind for "tx ", "hash ", "root ", "receipt #". AND match against the actual loaded `env.privateKey` byte string (zero false-positives + perfect detection of actual key paste).
- **A:** §1.

### A.5.16 · Dashboard SSR/SEO conversion
- **WT:** #42
- **E:** 1h
- **What:** `apps/studio/src/app/dashboard/page.tsx:1` is `'use client'`. SSR can't render; first paint blank for 800ms. SEO impact: search engines see blank.
- **Fix:** split into `page.tsx` (server, renders by `?address=` query) + `DashboardClient.tsx` (client island for wallet connect). First paint shows real content.
- **A:** §10.

### A.5.17 · `/docs` rename to `/0g` for shareability
- **WT:** #47
- **E:** 45min
- **What:** `/docs` renders 6-module 0G primitives showcase with live `getDeployedAddress` lookups + chainscan links. Best surface in Studio for external linkers but route name sounds like internal documentation.
- **Fix:** rename `/docs` → `/0g`. Ship per-route OG image (1200×630 module grid). Add copy-link button. Cross-link from README + JUDGE_GUIDE + PITCH so the URL becomes the canonical "0G primitive depth proof."
- **A:** §11.4.

### A.5.18 · `forge-daemon` ghost-surface deletion + HLD architectural-drift fix
- **WT:** #10, #15
- **E:** 30min
- **What:** `apps/forge-daemon/` exists as `package.json` only, no `src/`. HLD.md §1 lists it + `apps/skill-store` + `apps/worker` (don't exist) and misses `apps/npx-cli`, `apps/mcp-server`, `apps/openclaw-skill`, `apps/telegram-bot`.
- **Fix:** delete `apps/forge-daemon/`. Rewrite HLD.md §1 from live `apps/` directory. Mark planned ones as `(planned)`. Add `pnpm hld:check` script.
- **A:** §1, §11.

### A.5.19 · Studio components UI_UX_GUIDE → CLAUDE.md migration
- **WT:** #24
- **E:** 30min
- **What:** Section.tsx:4 cites stale `UI_UX_GUIDE §13`. Other components likely follow.
- **Fix:** rewrite doc-comments to point at CLAUDE.md §10 OR new `apps/studio/src/components/README.md`. Replace inline styles with Tailwind classes.
- **A:** §10.

### A.5.20 · `red-team-critic` orphan role · ship audit tier
- **WT:** #29
- **E:** 30min
- **What:** `packages/consensus/src/prompts.ts:11-17` declares 6 RoleId values; only 5 wired in tiers. `red-team-critic` is orphan dead-code.
- **Fix:** ship a 6-role "audit" tier (`ConsensusTier.audit`) using analyst/critic/risk-reviewer/evidence-checker/red-team-critic/judge. Add CLI flag `--audit`. Test that all 6 roles reach a non-zero `processResponse` call. Track 3 marketplace pricing gets `audit` as a premium tier.
- **A:** §11.

### A.5.21 · 0G DA Docker compose + live disperse + retrieve
- **WT:** #14
- **E:** 30min
- **What:** `packages/og-da/src/index.ts` admits 0G DA needs operator-run Docker. Field-unique flex on Ivaronix is "0G DA wired in code while AIsphere/Provus/Aishi only diagram it" but "wired in code" without a single live blob retrieved means a judge can't re-verify.
- **Fix:** ship `docker-compose.yml` at repo root with `0g-da-client` service. `ivaronix da preflight` outputs the EXACT one-line `docker compose up -d da-client` command on failure. Capture a live disperse + retrieve `request_id` + `storage_root`. Embed in README + JUDGE_GUIDE.
- **A:** §11.1.

### A.5.22 · npx-cli README rewrite + dead-link fix
- **WT:** #17, #25
- **E:** 15min
- **D:** B.2.1 (Vercel deploy URL)
- **What:** `apps/npx-cli/README.md` is 12 lines; both taglines, broken `ivaronix.app` link, no output preview. `packages/widget/src/index.tsx:44` hardcodes `https://ivaronix.studio` (DNS NXDOMAIN today).
- **Fix:** rewrite npx-cli README to ~30 lines: 1 tagline + install + verify-output transcript + 5-7 command bullets + license. Replace `ivaronix.app` with actual repo URL until L-7 ships. Set widget `DEFAULT_ORIGIN = 'https://ivaronix.vercel.app'` (Vercel preview) until custom domain lands. Add `STUDIO_BASE` env override + iframe error-state fallback.
- **A:** §11.4.

## A.6 · Operator runbook updates

### A.6.1 · USER_TODO refresh post-shipping
- **E:** 15min ongoing
- Update `docs/USER_TODO.md` after each Section A item ships. Operator should always see the next concrete action.

### A.6.2 · MAINNET_READINESS deeper coverage
- **E:** 30min
- Current doc is 13/13 green. Add row per A.5 fix as it ships. Once Section A complete, all 13 + ~25 new rows green.

### A.6.3 · JUDGE_GUIDE.md update with Phase 1 + Phase 2 outputs
- **E:** 30min
- Reference receipt 1304 currently. Update Step 1 to use a V2 receipt id from autonomous wander cycle (per A.4.1).

---

# B · MAINNET version

> Each B-item requires real operator action: OG funding, credential setup, DNS configuration, or paid services. Code is shippable on testnet first; mainnet is the final layer.

## B.1 · Mainnet contract redeploy

### B.1.1 · K-1 + K-2 V2 mainnet deploy
- **WT:** USER_TODO §A-2, §A-V2-K1, §A-V2-K2
- **E:** 1h after funding lands
- **Operator action:** send ~0.1 OG to deployer wallet on chainID 16661.
- **Run:**
  ```bash
  cd contracts
  export OG_PRIVATE_KEY=<deployer-key>
  forge script script/DeployPassportV2.s.sol:DeployPassportV2 \
    --rpc-url https://evmrpc.0g.ai --broadcast --legacy
  forge script script/DeployReceiptRegistryV2.s.sol:DeployReceiptRegistryV2 \
    --rpc-url https://evmrpc.0g.ai --broadcast --legacy
  ```
- **Post-deploy:** add addresses to `contracts/deployments/mainnet.json`. Authorize operator as recorder.
- **P:** Two mainnet TX hashes + chainscan links + V2 contract addresses.
- **A:** §11.1, §12.1.

### B.1.2 · 6 base contracts mainnet deploy
- **E:** 30min after funding lands
- **What:** Erc7857Verifier, ReceiptRegistry V1 (legacy compat), AgentPassportINFT V1 (legacy compat), CapabilityRegistry, MemoryAccessLog, SkillRegistry, SubscriptionEscrow.
- **Cost:** ~0.1 OG total.
- **Run:** `pnpm --filter @ivaronix/cli exec ivaronix deploy --network mainnet`.
- **P:** 6+ chainscan links in `contracts/deployments/mainnet.json`.
- **A:** §11.1.

### B.1.3 · V2 marketplace contracts mainnet deploy
- **D:** A.5.9, A.5.10, A.5.11, A.5.12 testnet versions deployed first
- **E:** 1h
- **What:** CapabilityRegistryV2, SkillRegistryV2, SubscriptionEscrowV2, MemoryAccessLogV2 to mainnet.
- **Cost:** ~0.05 OG total.
- **A:** §11.1.

## B.2 · Production Studio deploy

### B.2.1 · Vercel deploy + custom domain
- **WT:** USER_TODO §A-V2-L7
- **E:** 30min after `vercel login`
- **Operator action:**
  ```bash
  ! vercel login
  cd apps/studio
  vercel --prod
  # Configure custom domain in Vercel dashboard
  ```
- **P:** Live URL + working `/r/<id>` page on a different machine without auth.
- **A:** §11.1.

### B.2.2 · Update embed widget DEFAULT_ORIGIN to custom domain
- **D:** B.2.1
- **E:** 10min

### B.2.3 · OG-image generation verified on production
- **D:** B.2.1, A.5.5
- **E:** 15min · verify on production URL

## B.3 · Mainnet autonomous wander-cycle (volume play)

### B.3.1 · Switch wander-cycle from testnet to mainnet
- **WT:** #67
- **E:** 30min
- **D:** B.1.1 (V2 mainnet)
- **What:** Once mainnet redeploy done, autonomous wander-cycle switches RPC + V2 address. 8,640 receipts/month × 90 days = ~26K mainnet receipts.
- **Cost on mainnet:** ~2.6 OG over 90 days. Allocate from operator wallet.
- **Headline:** "1,332 manual + 26K autonomous = 27K+ mainnet receipts" before judging.
- **P:** chainscan link with 26K+ TXs.
- **A:** §11.1.

### B.3.2 · Studio counter sums V1 + V2 mainnet + testnet
- **WT:** #19
- **E:** 15min
- **D:** B.1.1
- **What:** `liveReceiptCount()` returns sum across V1+V2 mainnet + V1+V2 testnet with breakdown.

## B.4 · ChainGPT audit (optional, paid)

### B.4.1 · ChainGPT smart contract audit submission
- **What:** Aegis Vault + Provus both ship "ChainGPT-audited" badge. Ivaronix has 121/121 Foundry tests but no third-party audit.
- **E:** 1-2 weeks turnaround
- **Cost:** ChainGPT pricing (paid).
- **Run:** Submit V2 contracts to ChainGPT (`https://app.chaingpt.org/smart-contract-auditor`).
- **P:** Audit report URL + badge in README.
- **A:** §1.

## B.5 · Package publishing

### B.5.1 · `@ivaronix/cli` npm publish
- **D:** B.2.1 (custom domain so widget URLs work)
- **E:** 15min
- **Run:** `cd apps/cli && pnpm publish --access public` (after `npm login`).
- **P:** `npmjs.com/package/ivaronix` page live.

### B.5.2 · `@ivaronix/widget` npm publish
- **D:** B.2.1, B.5.1
- **E:** 5min

### B.5.3 · `ivaronix-verifier-rs` crates.io publish
- **WT:** USER_TODO §A-V2-K15
- **Operator action:**
  ```bash
  ! cargo login
  cd ivaronix-verifier-rs
  cargo publish --dry-run
  cargo publish
  ```
- **P:** `crates.io/crates/ivaronix-verifier` page live.

### B.5.4 · Python verifier PyPI publish
- **E:** 15min
- **Operator action:** `twine upload`. Need PyPI account.

### B.5.5 · Go reference verifier (after Go install)
- **WT:** USER_TODO §A-V2-K15-Go
- **D:** Operator runs `winget install GoLang.Go` first.
- **E:** 2h after Go is installed
- **What:** Scaffold `verifier-go/` mirroring Rust shape. Add Go job to `.github/workflows/jcs-roundtrip.yml`. Cross-impl byte-equality across 4 languages.
- **P:** CI workflow green with 4-lang byte-equality.

## B.6 · Cross-chain (optional, post-hackathon)

### B.6.1 · Khalani cross-chain adapter
- **What:** Aegis ships Khalani venue adapter. Ivaronix could ship same primitive: 0G-native receipt that settles on another chain without orchestrator custody.
- **E:** 1 week
- **A:** §1.

## B.7 · Telegram bot (optional, decision pending PMF filter)

### B.7.1 · Telegram bot wrapper
- **WT:** #76
- **D:** Operator gets BotFather token.
- **Decision:** ship ONLY if paired with autonomous wander-cycle (B.3.1) so it stretches a primitive. Otherwise skip per CLAUDE.md §4 PMF filter.
- **What:** User forwards a contract to bot → bot anchors a receipt → forwards back proof URL + cached PDF.
- **A:** §4.

---

# C · Acceptance gates (per CLAUDE.md §11 + §12)

Every item above must satisfy:

- **§11.1:** Real product, not synthetic. Real MetaMask, real chain, real side-effects.
- **§11.2:** Drive like a user. Click buttons, wait for visible state, watch transitions.
- **§11.3:** Capture proof a judge could replay. Screenshots at every state transition. Video for transitions. Side-by-side vs `brand/Ivaronix.html`.
- **§11.4:** Cover every shipped feature. Edge cases count. Tampered receipts must fail closed.
- **§11.5:** Every CLI feature passes UI-promotion gate before shipping a UI surface.
- **§11.6:** Reference QA_LOOP_BRIEF.md for stop-condition.
- **§12.1:** Stop only when verified end-to-end with proof OR fixed and re-tested OR explicitly blocked with real reason AND concrete unblock action.
- **§12.2:** No partial credits. Connect-only, screenshot-only, CLI-only, web-only, type-check-only, mock-only do NOT count.
- **§12.3:** Three-times-think check before declaring stop.
- **§12.4:** Every artifact linked or named in QA_LOOP_BRIEF.md or QA_FULL_PRODUCT_REPORT.md.
- **§12.5:** Genie rule. Interpret intent, not letter.
- **§12.6:** Living punch-list discipline.

---

# D · Sequencing + dependencies

## Day 1-2 · Testnet correctness (~6h)

A.1.2 (CLI V2-first) → A.1.3 (Studio V1-blindness) → A.1.1 (form/schema enum) → A.1.4 (Studio tests + ESLint + CI). Parallel: A.1.5 (V2 anchor smoke CI) + A.1.6 (schema-as-source-of-truth lint).

## Day 3 · Submission polish (~6h)

A.2.1 (README rewrite) + A.2.2 (screenshot grid) + A.2.3 (Documentation section) + A.2.4 (Track 3 + Track 1 numbers) + A.2.5 (counter-position + tier disclosure) + A.2.6 (K-15 polyglot moat) + A.2.7 (numbers consolidation).

## Day 4 · Schema + voice (~5h)

A.3.1 to A.3.8 batched.

## Day 5-6 · Architecture compounding (~17h)

A.4.1 (autonomous wander-cycle TESTNET) + A.4.2 (path-scoped rules) + A.4.3 (CHANGELOG + commit-trailer) + A.4.4 (Efficiency Game + aggregation policies) + A.4.5 (MARKETPLACE_DESIGN.md) + A.4.6 (SOLIDITY_CHOICES.md) + A.4.7 (SKILL_PUBLISHING.md) + A.4.8 (MemoryEngine surface) + A.4.9 (convergence embeddings).

## Day 7-8 · Process discipline (~10h)

A.5.1 to A.5.22 batched.

## Day 9 · Operator-action surface (~2h)

A.6.1 + A.6.2 + A.6.3. Operator funds 0.5 OG to CI wallet. Operator funds 0.1 OG to mainnet deployer.

## Day 10 · Mainnet (operator-async)

When operator funds mainnet: B.1.1 + B.1.2 + B.1.3.
When operator runs `vercel login`: B.2.1 → B.2.2 → B.2.3.
When B.1 ships: B.3.1 starts running. B.3.2 wires Studio counter.
A.5.1 (BuildProof submission) lands.
B.5.1 + B.5.2 + B.5.3 + B.5.4 (publishing).

## Day 11+ · Optional

B.4.1 (ChainGPT audit · paid · 1-2 weeks).
B.5.5 (Go verifier · operator installs Go).
B.6.1 (Khalani cross-chain · post-hackathon).
B.7.1 (Telegram bot · only if PMF filter passes).

---

# E · Coverage map (every wander-thought, operator-action, §13 requirement)

## E.1 · 89 wander-thoughts → sections

WT 1 → A.2.7 · WT 2 → A.1.4 · WT 3 → A.5.6 · WT 4 → A.5.5, A.2.2 · WT 5 → A.5.4 · WT 6 → A.3.3 · WT 7 → A.2.1, A.2.2 · WT 8 → A.3.1 · WT 9 → A.3.4 · WT 10 → A.5.18 · WT 11 → A.5.7 · WT 12 → A.5.10 · WT 13 → A.2.7 · WT 14 → A.5.21 · WT 15 → A.5.18 · WT 16 → A.2.1 · WT 17 → A.5.22 · WT 18 → A.2.5 · WT 19 → A.1.3, B.3.2 · WT 20 → A.5.11 · WT 21 → A.1.4 · WT 22 → A.3.4 · WT 23 → A.3.1 · WT 24 → A.5.19 · WT 25 → A.5.22 · WT 26 → A.5.9 · WT 27 → A.5.8 · WT 28 → A.1.3 · WT 29 → A.5.20 · WT 30 → A.5.4 · WT 31 → A.5.13 · WT 32 → A.5.12 · WT 33 → superseded by WT 34 · WT 34 → A.4.8 · WT 35 → A.4.9 · WT 36 → A.5.4 · WT 37 → A.1.3 · WT 38 → A.5.14 · WT 39 → resolved (route exists) · WT 40 → A.5.15 · WT 41 → A.1.3 · WT 42 → A.5.16 · WT 43 → A.1.1 · WT 44 → A.1.1 · WT 45 → A.1.3 · WT 46 → A.5.3 · WT 47 → A.5.17 · WT 48 → A.2.1 · WT 49 → A.3.1 · WT 50 → A.3.8 · WT 51 → A.1.3 · WT 52 → A.1.5 · WT 53 → A.2.7 · WT 54 → A.2.1 · WT 55 → A.2.3 · WT 56 → A.2.2 · WT 57 → A.4.3 · WT 58 → A.2.5 · WT 59 → A.4.4 · WT 60 → A.5.2 · WT 61 → A.4.2 · WT 62 → A.4.3 · WT 63 → A.4.3 · WT 64 → A.2.4 · WT 65 → A.2.5 · WT 66 → A.3.2 · WT 67 → A.4.1, B.3.1 · WT 68 → A.2.7 · WT 69 → A.4.1 · WT 70 → A.2.4 · WT 71 → A.4.7 · WT 72 → A.3.1 · WT 73 → A.2.5 · WT 74 → A.2.4 · WT 75 → A.4.4 · WT 76 → B.7.1 · WT 77 → A.2.1 · WT 78 → A.2.4, A.4.6 · WT 79 → A.2.5 · WT 80 → A.3.6 · WT 81 → A.5.1 · WT 82 → A.5.8, A.2.2 · WT 83 → A.4.5 · WT 84 → A.1.4 · WT 85 → A.1.1, A.1.6 · WT 86 → A.3.7 · WT 87 → A.4.6 · WT 88 → A.1.2 · WT 89 → A.3.5

**89/89 mapped ✓**

## E.2 · USER_TODO operator-action gates

- A-2 (mainnet OG funding) → B.1.1, B.1.2
- A-V2-K1 (mainnet K-1 deploy) → B.1.1
- A-V2-K2 (mainnet K-2 deploy) → B.1.1
- A-V2-K15 (Rust crates.io publish) → B.5.3
- A-V2-K15-Go (Go installation + verifier) → B.5.5
- A-V2-L7 (vercel login + custom domain) → B.2.1

**6/6 surfaced ✓**

## E.3 · CLAUDE.md §13 submission-package requirements

1. Project overview → A.2.1 (persona-first README rewrite) ✓
2. System architecture diagram → A.2.2 (screenshot grid) + A.2.1 (ASCII flow) ✓
3. 0G modules used + addresses → A.5.17 (`/0g` rename) + A.2.4 (Track 3 block) ✓
4. How modules support product → A.2.4 (primitives table) ✓
5. Local deployment / repro steps → A.2.1 (README quick-start) + A.6.2 (MAINNET_READINESS) ✓
6. Test account / faucet / reviewer notes → A.6.3 (JUDGE_GUIDE update) ✓

**6/6 covered ✓**

---

# F · What this plan does NOT do (explicit skips)

Per CLAUDE.md §4 PMF filter, some thoughts are explicitly skipped:

- **Track 2 production-rigor competition** (Aegis Vault). Frame around it via A.2.4; do not compete on metrics we don't optimize for.
- **Heavy SVG + inline-CSS README** (Kuberna pattern). GitHub strips inline CSS. Use shields.io + screenshots + mermaid (per A.2.2).
- **Telegram bot** (B.7) by default. Only ship if paired with autonomous wander-cycle.
- **Per-package AGENTS.md proliferation** beyond the 6 listed in A.5.2. Path-scoped rules (A.4.2) deliver same value with less spread.
- **Khalani cross-chain** (B.6.1). Post-hackathon.
- **ChainGPT audit** (B.4.1). Paid + 1-2 week turnaround. Optional unless judging depends on third-party audit signal.

---

# G · Stop-condition check (CLAUDE.md §12.3 three-times-think)

1. **Any feature in codebase / contract ABI / CLI command list NOT in plan?** Re-checked: 33 CLI commands, ~30 Studio routes, 8 deployed contracts + 5 V2 planned, 14 packages + scripts. All covered by Section A or B. ✓
2. **Any "blocked" item I could unblock with available tools?** Section A items all unblocked (no funding required). Section B items have explicit operator-action gates with concrete commands. ✓
3. **Any feature in `og-projects-showcase/` / `entries/` / `new-entries/` that closes a Criterion gap and is not on plan?** All 25+ competitors reviewed. Each surfaces a thought; each thought is mapped. Non-mapped elements (Aegis Track 2 metric race, Kuberna SVG-design pattern) are explicitly listed in Section F. ✓

All three return "no" → plan converges.

---

# H · Final status + recommended next action

**Total effort:**
- Section A (testnet): ~33h focused single-dev work.
- Section B (mainnet): ~6h dev + operator-async time for funding + paid services.

**Outcome target after Section A complete:** medal on Track 1 (Agentic Infrastructure). Compete tightly with AlphaDawg + Provus on Criterion 1 + 2.

**Outcome target after Section A + B complete:** #1 on Track 1 + #1 on Track 3 (Agentic Economy). Mainnet receipt volume narrative writes itself via autonomous cycle. Polyglot canonical hash CI moat is unique. Honest TIER 1 vs TIER 2 disclosure beats AlphaTrace's conflation. MemoryEngine surface counters SealedMind directly. Top 1-2 overall.

**Outcome target with optional B.4 + B.5 + B.6:** match Aegis on Track 2 production-rigor signals (ChainGPT audit) + ship cross-chain (Khalani) + publish on npm/PyPI/crates.io for permanent third-party reproducibility.

**Bar set by CLAUDE.md §1:** "the only blocker is money." Section A confirms this. Every non-funded item ships now. Section B unlocks the moment operator OG hits the deployer wallet.

**Recommended next action:** start Phase 1 immediately with A.1.1 (form/schema enum bug fix). 50 minutes to ship + test + verify. Direct unblock for the rest of Section A.

> Plan-003 is final. Execute Section A in order; Section B unblocks asynchronously when operator gates land.
