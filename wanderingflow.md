# Wandering · Flow Log

> **SOURCE DOC — drove `docs/planning-003.md`. Frozen 2026-05-09.** Use as a tour of the codebase as it stood when planning-003 was written; do not act on items here directly. The plan is the contract.

> Short flow log of where I wandered and what jumped out. One line per file/area visited. Companion: `wanderingthoughts.md` (deep takes).

## Areas covered (TOC)

- ✅ docs/ inventory listing
- ✅ brand/ asset inventory
- ✅ seed-skills/ skill listing
- ✅ repo root (.gitignore, top-level docs, scripts/)
- ✅ README (top 50 lines)
- ✅ private-doc-review SKILL.md (manifest + prompt)
- ✅ .github/workflows/jcs-roundtrip.yml
- ⏳ contracts/ (foundry.toml read earlier; deeper deps + script dir)
- ⏳ apps/cli/ commands directory
- ⏳ apps/studio/ public + components
- ⏳ packages/ small packages (core, og-toolkit, og-router, og-storage, og-da, og-kv)
- ⏳ packages/skills/ + seed-skills coverage
- ⏳ deployments/ + addresses cross-check
- ⏳ entries/ competitor scan
- ⏳ og-projects-showcase/ scan
- ⏳ oglabs resources/ SDK browse
- ⏳ scripts/qa/ pattern coverage
- ⏳ scripts/* one-off tools
- ⏳ root-level docs (HLD.md, COMPONENTS.md, PRD.md, RECEIPTS_SPEC.md, UI_UX_GUIDE.md)
- ⏳ root-level pass docs (PLAN_pass76, PASS77_*, SESSION_FINAL.md)
- ⏳ env files (.env.example shape, .env safety)
- ⏳ docs/PHASE_B_DISCLOSURES + JUDGE_GUIDE + PITCH revisit
- ⏳ Studio routes per-page (/, /skills, /agents, /agent/[handle], /onboard, /data-room, /delegate, /skill/new, /docs, /global, /dashboard)
- ⏳ Studio components (FourLightRow, ReceiptStateChip, RunPanel, Section, ShareButton)
- ⏳ Receipt schema + builder + verify
- ⏳ Consensus convergence + prompts
- ⏳ Memory engine + manifest
- ⏳ CapabilityRegistry + IvaronixReceiptGuard contracts
- ⏳ Foundry test surface
- ⏳ Embed widget package
- ⏳ MCP server app
- ⏳ Telegram bot app
- ⏳ Print receipt route
- ⏳ Burn mode end-to-end audit
- ⏳ Fee-split allocator
- ⏳ Skill registry on-chain coverage
- ⏳ ULID + canonical hash pieces
- ⏳ Hooks + scanner + sandbox audit
- ⏳ Vendored opencode-* packages (drag on CI?)
- ⏳ Empty packages (widget, tui, ui, sdk, orchestrator, policy, hooks per HALF_BAKED J-13)

## Session 1 · 2026-05-10 09:14

- 09:14 — listed docs/ · 19 markdown files; pass-docs (PLAN_pass76 + PASS77_*) look stale alongside the new audit docs
- 09:14 — listed brand/ · 5 assets · `Ivaronix.html` design source + 4 SVGs (mark, icon, dot, wordmark); no PNG fallbacks
- 09:14 — listed seed-skills/ · 6 skills; private-doc-review is the headline
- 09:14 — repo root scan · `_archive/`, `CLI Open Source Project/`, `oglabs resources/`, `og-projects-showcase/`, `entries/` all gitignored (correct — nested .git folders)
- 09:14 — read .gitignore · `.env` excluded ✓, `.env.example` whitelisted ✓, brand/Ivaronix.html intentionally pushed
- 09:14 — read README top · headline number `1,330+ receipts` is stale (now 1,331+ after V2 smoke); `14 packages` claim contradicts actual `25 packages` (HALF_BAKED I-20 confirmed)
- 09:14 — read seed-skills/private-doc-review/SKILL.md · `compute_tee_required: true` now actually enforced after S-1 fix; manifest has `metadata.openclaw.install` block · fee_split 9000/1000 (90/10 creator/treasury)
- 09:14 — read .github/workflows/jcs-roundtrip.yml · only ONE workflow file in CI; no Foundry / Studio-build / typecheck workflow yet
- 09:14 — listed scripts/ · `verifier-py/`, `qa/`, plus 13 one-off `.ts` smoke scripts; no organising principle visible (mix of `automate-receipts-testnet.ts`, `chat-tools-smoke.ts`, etc.)

## Session 2 · 2026-05-10 09:15

- 09:15 — listed apps/cli/src/commands/ · 33 command files; chat + chat-v2 both present, room + delegate + passport-consolidate + skill-schedule + skill-registry-export + doc-bulk add up to 11 "v2-shaped" commands flat at the top level
- 09:15 — read apps/cli/src/bin/ivaronix.ts top · imports 28+ commands flat; comment line 76 says "Doc-ask (the killer demo)" — sprint-internal voice in shipped source
- 09:15 — read entries/AIsphere/README.md top 60 · 7 shields.io badges in the first paragraph + 8 emoji color badges in the soul-component table; mainnet address `0xc0238FEb…` linked; "civilization", "noosphere", "soul" pitch language
- 09:15 — read og-projects-showcase/Aishi/README.md top 50 · clean structured pitch + 8-image phone-screenshot preview grid + live URL `aishi.app` + `docs.aishi.app` + ERC-7857 INFT claim
- 09:15 — read UI_UX_GUIDE.md top 40 · canonical cream is `#faf9f6` here BUT CLAUDE.md §10 says cream is `#FAFAF7` — brand-token drift. Also: UI_UX_GUIDE typography is "Times New Roman / Georgia serif"; CLAUDE.md §10 typography is "Outfit + Instrument Serif italic + JetBrains Mono". Two conflicting design systems documented as canonical.

## Session 3 · 2026-05-10 09:16

- 09:16 — read .env.example · uses `OG_PRIVATE_KEY` / `OG_CHAIN_ID` / `OG_RPC_URL` naming; actual code (pipeline, deploy scripts) reads `EVM_PRIVATE_KEY` AND `OG_PRIVATE_KEY`; skill manifests want `ZG_API_SECRET` (not in template). Three naming conventions across one product.
- 09:16 — read HLD.md top 50 · §1 lists surfaces `apps/api`, `apps/skill-store`, `apps/worker`. Reality (per `apps/` ls): no `apps/api`, no `apps/skill-store`, no `apps/worker`. HLD has architectural drift vs the actual app graph.
- 09:16 — read seed-skills/0g-integration-auditor/SKILL.md top · skill description claims "Day-21 automation that anchors 100 mainnet receipts against public 0G OSS repos" — sprint-language ("Day-21") + claim that contradicts `USER_TODO.md A-2` (mainnet not deployed yet)
- 09:16 — read packages/og-toolkit/src/index.ts · public SDK surface clean (`createOg`, `runSkill`); BUT `createKvClient()` returns the `StubKvClient` per HALF_BAKED A-2; consumers see an in-memory map labelled as the 0G KV interface. Public-surface lie.
- 09:16 — read og-projects-showcase/dont-get-drained/README.md top · 1-paragraph verb-driven hero ("Publish · Compose · Guard · Verdict"); plain-text architecture diagram (no Mermaid pomp); Tech-stack table 4 rows; testnet AgentDirectory + Anvil hybrid. Showcase-bar pattern: persona-clear + concrete + short.

## Session 4 · 2026-05-10 09:17

- 09:17 — listed apps/mcp-server/ · single file `server.ts` only; minimal
- 09:17 — listed apps/telegram-bot/ · 2 files (`index.ts`, `smoke.ts`); minimal
- 09:17 — read contracts/src/CapabilityRegistry.sol top 70 · `grantsByGrantee` and `grantsByOwner` are BOTH `public mapping(address => bytes32[])` — anyone can enumerate who delegated to whom (privacy leak for B2B use case)
- 09:17 — read packages/og-da/src/index.ts top 60 · BlobStatus union has 6 states inc. both `'CONFIRMED'` and `'FINALIZED'`; comment says "no public testnet HTTP endpoint — operators run a 0g-da-client Docker container" — operator-onboarding friction
- 09:17 — read RECEIPTS_SPEC.md top 30 · §1 lists 9 receipt types (codes 0-8). `packages/core/src/types.ts` has 13 (added: subscription_skill_exec=9, doc_room_create=10, doc_room_read=11, memory_consolidation=12). Doc-vs-code drift, 4 missing types.
- 09:17 — read apps/mcp-server/src/server.ts top · uses `runPipeline` from `@ivaronix/runtime` (good — inherits V2 wiring) but ALSO imports `ReceiptRegistryClient` directly for read paths (verifyReceipt etc.); when V2 reads land they'll need branching here too.

## Session 5 · 2026-05-10 09:18

- 09:18 — read PRD.md top 50 · 4 audience-specific taglines table; positioning denies 7 single-layer framings ("not only a CLI coding agent / skill marketplace / memory vault / payment / doc AI / 0G demo") and claims "one 0G-native Agent OS"
- 09:18 — listed packages/widget/ · NOT empty (HALF_BAKED J-13 was wrong on this one) — `src/index.tsx`, `package.json`, `tsconfig.json`, `README.md` all present; widget is the planning-01 §3D embed
- 09:18 — listed apps/forge-daemon/ · NO src/ directory · the HLD §1 lists it as a real internal surface, but it has no source files — the daemon is a ghost in the architecture
- 09:18 — read COMPONENTS.md top 40 · §1 "Onboarding flow" documents 5-row stepper pattern researched from Aishi + SealedMind + 0G OpenClaw; very specific UX research
- 09:18 — read packages/widget/src/index.tsx · 76 lines · `<ReceiptVerifier id="1004" />` React component + iframe loader; defaults `https://ivaronix.studio` origin (a domain that doesn't exist yet — L-7 deploy gates)
- 09:18 — read entries/provus-protocol/README.md top · 30K+ mainnet TXs · ChainGPT-audited · 99.7% uptime · live URL `provus-protocol-frontend.vercel.app` · concrete cost compare ($50 Ethereum vs $0.04 0G) · the strongest verify-claim competitor in the field

## Session 6 · 2026-05-10 09:19

- 09:19 — read apps/studio/src/app/page.tsx top 60 · `liveReceiptCount()` reads V1 only (`getReceiptRegistry()` from chain.ts); home hero will undercount once V2 grows past zero. `loadAllSkills().length` confirms I-9 (page says "first-party" but loads all 156)
- 09:19 — listed apps/studio/src/app/onboard/ · `page.tsx` + `OnboardClient.tsx` — server/client split, COMPONENTS.md §1 documented this as 5-row stepper
- 09:19 — read contracts/src/SkillRegistry.sol top 50 · "first wallet to publish a skillId becomes its creator" → squatter risk on common skill names; no name-recovery mechanism
- 09:19 — read .prettierrc.json · clean (printWidth 100, single quotes, trailing all, lf endings) — no issues
- 09:19 — searched **/.eslintrc* · ZERO ESLint configs in Ivaronix's own code; every match is node_modules, oglabs resources, competitor entries, or vendored OZ. Confirms HALF_BAKED J-11 at a worse level: not just `lint: echo skip`, the workspace has NO lint configured anywhere

## Session 7 · 2026-05-10 09:20

- 09:20 — read packages/skills/src/scanner.ts top 60 · `ScanResult` shape is honest (registered/revoked/matches as separate fields); pure observation, doesn't block
- 09:20 — read packages/runtime/src/env.ts (full file) · 31 lines · uses ALL FOUR naming conventions in ONE file: `OG_*` (5 vars) + `EVM_*` (2 vars fallback) + `ZG_*` (2 vars) + `OG_COMPUTE_*` mixed; `defaultModel: 'qwen/qwen-2.5-7b-instruct'` hardcoded inline (drift risk vs `OG_DEFAULT_MODEL`)
- 09:20 — read contracts/src/Erc7857Verifier.sol top 50 · contract NatSpec line 11 says "Day 6 MVP" + line 13 "Future work (Phase B+) will swap this attestor for a TEE-backed remote attestation or ZKP verifier per ERC-7857 §integration" — sprint-language IN SHIPPED Solidity source code
- 09:20 — read apps/studio/src/components/Section.tsx (full file) · 38 lines · uses inline styles + CSS vars; padding 96px 0 matches CLAUDE.md §10 spacing scale; cites "UI_UX_GUIDE §13" — that's the doc with conflicting brand tokens (#faf9f6 vs CLAUDE.md's #FAFAF7)
- 09:20 — searched og-projects-showcase/MUSASHI · no folder; HALF_BAKED L-19 references MUSASHI as ERC-7857 mainnet competitor but it's not in the local og-projects-showcase — may be in entries/ or musashi-agent.xyz only

## Session 8 · 2026-05-10 09:21

- 09:21 — searched apps/api/** · no files · HLD.md §1 lists this surface but the directory doesn't exist; architectural-drift confirmed at the file-system level
- 09:21 — listed apps/npx-cli/ · 6 files (package.json, bundle.mjs, README, dist/ivaronix.mjs + LEGAL.txt); `ivaronix.mjs` is a pre-built esbuild bundle for the global-install path
- 09:21 — read apps/npx-cli/README.md · uses BOTH "The 0G Agent Operating System" + "Catch the risks. Keep the receipts." in 12 lines · links to `https://ivaronix.app` (domain not registered yet — same L-7 dependency as embed widget)
- 09:21 — read contracts/src/SubscriptionEscrow.sol top 60 · NatSpec `Per PASS 76 B-1` sprint-language fossilized in chain metadata (same pattern as Erc7857Verifier); `IntervalMode.AGENT_AUTO` lets agent skip-or-fire freely (loose for Track 3 marketplace accountability)
- 09:21 — read LICENSE · clean MIT (Ivaronix contributors 2026); vendored opencode attribution in 3-line footer; brand/ SVGs not separately licensed (potential trademark gap if logo asserts brand identity)
- 09:21 — read og-projects-showcase/whale-fun/README.md top · meme-token bonding-curve project; emoji-heavy feature bullets; testnet TokenFactory deployed but WhaleToken "not yet deployed"; weaker showcase-bar than Aishi or Don't Get Drained

## Session 9 · 2026-05-10 09:22

- 09:22 — read apps/studio/src/app/agents/page.tsx top 50 · uses `getPassportClient()` (V1 only); same V1-only pattern as the home receipt counter (#19); V2 passport mints will be invisible on the leaderboard
- 09:22 — read apps/studio/src/app/skills/page.tsx middle · `title="First-party skills"` confirmed; grid-template uses `minmax(340px, 1fr)` instead of `minmax(0, 1fr)` — long unbreakable text (skill name with no spaces, hash strings) can overflow on mobile per HALF_BAKED Round-2 D mobile audit
- 09:22 — listed apps/openclaw-skill/ · single file `SKILL.md` only; this isn't an "app", it's a skill manifest mis-located in `apps/`
- 09:22 — read packages/consensus/src/prompts.ts top 40 · `RoleId` enum has 6 roles (analyst/critic/risk-reviewer/evidence-checker/red-team-critic/judge); `READ_HARD` anti-hallucination guard hardcoded per role; need to check if `red-team-critic` is wired anywhere
- 09:22 — read SESSION_FINAL.md top 30 · dated 2026-05-08, claims "287 anchored receipts" (now ~1,332+) and "22 commands tested" — pass-doc with stale state; loudest example of #5 case for moving to `docs/_internal/`

## Session 10 · 2026-05-10 09:23

- 09:23 — listed packages/memory/src/ · 8 files (types, index, fts, vector, engine, encryption + 2 tests); clean hybrid-retrieval split (fts + vector + engine) per SealedMind pattern
- 09:23 — read apps/studio/src/components/ShareButton.tsx (full file) · 41 lines; `aria-live="polite"` on copy button (good a11y); silent fallback on clipboard failure (opens new tab, no toast) — failure path is invisible to user
- 09:23 — read contracts/src/MemoryAccessLog.sol top 50 · NatSpec line 16-17 ADMITS "Anyone can call logAccess() — the event records who logged what... There's no ACL because the events are public anyway"; `agent` param supplied by caller (NOT derived from msg.sender) — log-spoofing is documented as intentional
- 09:23 — read seed-skills/github-audit/SKILL.md top 40 · clean shape; `compute_tee_required: true`, `default_tier: standard`, `burn.auto_enable: false` (auditing public code, no privacy needed) — sensible defaults for a public-code skill
- 09:23 — confirmed entries/SealedMindMonoRepo/README.md exists (not yet read) — memory-layer competitor reference; HALF_BAKED L-16 noted SealedMind ships per-user encryption + vector index

## Session 11 · 2026-05-10 09:24

- 09:24 — read packages/memory/src/engine.ts top 60 · MemoryEngine IS fully wired; `create()` integrates with `CapabilityRegistryClient` + `MemoryAccessLogClient` when `enableOnChainPermissions` set; `remember()` uses K-20-fixed encryption + vector + FTS — production-grade
- 09:24 — read packages/consensus/src/convergence.ts top 50 · uses tokenized Jaccard similarity; comment "Day 8 will swap in `all-MiniLM-L6-v2` cosine similarity for higher fidelity" — sprint-language in production source; Jaccard is weak baseline (high token overlap on contradictory outputs gives false convergence)
- 09:24 — read entries/SealedMindMonoRepo/README.md top 35 · pitches "first portable memory layer" with Intel TDX + NVIDIA H100 TEE, AES-256-GCM, ERC-7857 iNFT, per-user encryption keys + vector index; 15-section ToC; the memory-layer wedge owner in the field
- 09:24 — read docs/QA_MISSION.md top 30 · sprint-internal doc dated 2026-05-08, addressed to "the contracted QA engineer"; opinionated voice ("If the engineer skips this, the rest is busywork"); same `_internal/` case as SESSION_FINAL (#30)

## Session 12 · 2026-05-10 09:25

- 09:25 — read packages/og-router/src/keyring.ts top 50 · multi-key rotation with `invalidate(label, reason)`; 402/auth = depleted permanently, 429 = transient; clean separation of failure modes
- 09:25 — searched apps/studio/src/app/r/[id]/print/ · glob with literal `[id]` brackets returned nothing; planning-01 §4A says print page exists; either glob path issue or print route lives elsewhere
- 09:25 — read apps/studio/src/app/embed/r/[id]/page.tsx top 50 · uses `getReceiptRegistry()` V1-only — third Studio surface with V1-blindness (after home #19 + agents #28); doc-comment hardcodes `https://ivaronix.studio/embed/r/1004` (dead domain per #17)
- 09:25 — listed oglabs resources/ top · only 2 markdown files at top (`resources.md` + `OG_LABS_RESOURCES_GUIDE.md`); SDK starter kits must be deeper

## Session 13 · 2026-05-10 09:26

- 09:26 — read apps/studio/src/app/r/[id]/print/page.tsx top 40 · route DOES exist (planning-01 §4A confirmed honest); glob's literal `[id]` brackets were the issue per Thought #39; uses V1-only `getReceiptRegistry()` — FOUR Studio routes with V1-blindness now
- 09:26 — read packages/consensus/src/gates.ts top 50 · MUSASHI 7-gate pre-flight pattern; 6 secrets-detection regex including `eth-private-key: /\b(?:0x)?[a-fA-F0-9]{64}\b/g` — matches ANY 64-hex string (receipt roots, hashes, etc.) → over-broad
- 09:26 — read packages/og-router/src/nvidia.ts top 50 · uses official OpenAI SDK with NVIDIA `integrate.api.nvidia.com/v1` base; clean wrapper; default model `qwen/qwen3.5-397b-a17b`
- 09:26 — read apps/studio/src/app/dashboard/page.tsx top 40 · client component (`'use client'`); reads `ScheduleSummary` shape; cron-fire surface from planning-01 §2C exposed here

## Session 14 · 2026-05-10 09:27

- 09:27 — read apps/studio/src/app/global/page.tsx top 50 · uses V1-only `getReceiptRegistry()` (FIFTH Studio surface); line 44 has the J-5 type-launder cast `(client as unknown as { contract: { queryFilter: Function ... } }).contract` — reaches into private field
- 09:27 — read apps/studio/src/app/skill/new/page.tsx top 40 · `'use client'`; SHELL_OPTIONS hardcoded `['none', 'read', 'read-write']` BUT manifest schema (packages/skills/src/manifest.ts) uses `['none', 'sandbox-only', 'full']` — values mismatch, written manifest will fail Zod validation
- 09:27 — read packages/og-router/src/index.ts top 50 · clean RouterClient + RouterCredential surface; uses OpenAI SDK with custom baseURL pointing at `compute-network-X.integratenetwork.work/v1/proxy` (third-party Router infra)
- 09:27 — searched MUSASHI · file at `entries/musashi/README.md` (lowercase); HALF_BAKED L-19 referenced this competitor; not yet read

## Session 15 · 2026-05-10 09:28

- 09:28 — read apps/studio/src/app/data-room/[id]/page.tsx top 40 · doc-comment lines 38-40 admit "server-side we have the operator key in env" for storage indexer auth on PUBLIC read paths — operator wallet signs every public manifest fetch, even for rooms it's not a party to
- 09:28 — read apps/studio/src/app/docs/page.tsx top 40 · clean module-card pattern using live `getDeployedAddress` + chainscan links; this is the surface that NOT V1-blind because it lists addresses, not reads chain state — bright spot
- 09:28 — read packages/runtime/src/logger.ts (full file) · 35 lines; clean three-method interface (info/pass/fail), `noopLogger` + `createCaptureLogger`; simple shape that the CLI + Studio + tests all share
- 09:28 — read entries/musashi/README.md top 35 · live mainnet on chainId 16661, ConvictionLog at `0x2B84aC...`, dashboard `musashi-agent.xyz`, YouTube demo, "97% of tokens fail" framing, ERC-7857 INFT — tight positioning

## Session 16 · 2026-05-10 09:29

- 09:29 — read apps/studio/src/app/onboard/OnboardClient.tsx top 50 · `'use client'`; uses wagmi for 5-row stepper per COMPONENTS.md §1; PASSPORT_ABI hardcodes V1 mint signature (forward-compatible with V2 since mint() is unchanged) but contract address fetch happens elsewhere — sixth Studio surface needing V2-awareness verification
- 09:29 — read contracts/src/IvaronixReceiptGuard.sol top 50 · clean library (zero deployment cost, zero state); NatSpec line 26-31 honest scope-out (skill-id matching stays off-chain); BUT line 10 references "planning-01 §3C" + line 13 "Inspired by Don't Get Drained's Safe-Guard pattern" — sprint-doc reference + competitor name in chain metadata (per #23 fossilization)
- 09:29 — read seed-skills/code-edit/SKILL.md top 35 · clean shape; outputs unified diff (no disk writes); `compute_tee_required: true`; MISSING `creator.passport` + `fee_split` block that private-doc-review + 0g-integration-auditor have — Track 3 fee-routing skipped for code-edit
- 09:29 — searched Trapezohe · no local copy of `entries/Trapezohe/`; HALF_BAKED L-15 referenced "Trapezohe Ghast Skills+MCP Store" with 405 users + `ghast.trapezohe.ai` live URL — competitor not locally available for read
- 09:30 — read scripts/qa/metamask-e2e/verify-v2-anchor-live.ts · live V2 smoke; signs typed-data, anchors to ReceiptRegistryV2, verifies nonce advancement + agent recovery + receiptRoot match + chainscan link; comprehensive E2E proof for K-2 — but lives at `verify-v2-anchor-live.ts`, the package's `tsx run.ts` entry runs a different file
- 09:30 — read pnpm-workspace.yaml · 3-line workspace (`apps/*`, `packages/*`, `scripts/qa/metamask-e2e`); other scripts/qa/* dirs sit outside the workspace — inconsistent tooling shape
- 09:30 — read scripts/qa/metamask-e2e/package.json · name `qa-metamask-e2e`, single script `tsx run.ts`, deps playwright/ethers/dotenv + workspace `@ivaronix/og-chain`; no CI integration

## Session 17 · 2026-05-10 09:31 — heeding the showcase + docs reminder

- 09:31 — read docs/PITCH.md page 1 · "deal lawyer reviewing M&A info memo" persona crisp; **headline number 1,165 receipts is stale** (current 1,332+); 6-contract table, 5 skills, 155 skill catalog (other surfaces say 150 or 156 — three different counts in the repo); 13/13 mainnet-readiness ✓; clean voice no banned words
- 09:31 — read og-projects-showcase/verifyhuman/README.md top 40 · template-quality README: one-line value prop, 5-line ASCII flow diagram, 5-step "How it works" numbered list, copy-paste `git clone → cd → npm install → cp .env.example .env → npm run dev`, prerequisites — Ivaronix's root README should mimic this terse zero-marketing shape
- 09:31 — read docs/JUDGE_GUIDE.md top 40 · "five minutes, three commands, three URLs" framing — exactly the criterion-2.4 path; Step 1 single-command verify path quotes receipt 1304 (FULLY VERIFIED ✓); positioned for a reviewer with clean machine + browser + 5 min — strong submission asset

## Session 18 · 2026-05-10 09:32

- 09:32 — read og-projects-showcase/Aishi/README.md top 50 · 5 badge SVGs, centered logo, Try-the-App + Docs buttons, **8 product screenshots in a 2×4 markdown table** (line 38-44) — visual density Ivaronix README has zero of; live `aishi.app` + `docs.aishi.app`; "Trust is mathematically guaranteed" + "Absolute Privacy & Sovereignty" trip §9 banned-adjective filter
- 09:32 — read docs/PHASE_B_DISCLOSURES.md top 40 · 8 items A-H each "File / Was / Now" format closing audits #2 #5 #8 #12 #13 #14 — strongest "we caught + we fixed" log in repo; UNLINKED from README/PITCH/JUDGE_GUIDE — discoverability gap on a Criterion-5 winner
- 09:32 — read docs/CRYPTO_NOTES.md top 35 · proper threat-model for memory AES-256-GCM (K-20 fix); documents the broken nonce derivation `sha256(plaintext||Date.now())[0..12]` + the fix `randomBytes(12)`; "What broke" + before/after code blocks — exactly the cryptographer voice judges credit
- 09:32 — read docs/HASH_FUNCTION.md top 35 · RFC-8785 spec doc; pins canonical hash to `keccak256(JCS(strip(receiptBody)))`; explicit number/string handling rules; ties to in-progress K-15 polyglot verifiers (Rust + Go + Python) — sets up the criterion-1 depth story

## Session 19 · 2026-05-10 09:33

- 09:33 — read og-projects-showcase/dont-get-drained/README.md top 50 · 4-step verb-first "How It Works" (Publish/Compose/Guard/Verdict), 7-line ASCII architecture, **aggregation policies** (unanimous/majority/any-reject) as user-facing knob on agent panel; AgentDirectory on 0G testnet + InferenceGuard on Anvil (honest mixed deployment) — Track 3 marketplace pattern with explicit policy surface
- 09:33 — read og-projects-showcase/Agent0G/README.md (24 lines, full file) · pitch-deck shape only: Problem/Solution/Vision/Revenue (3% rental cut); no images, no quickstart, no contract addresses, no architecture diagram; spelling "simmilar" line 9 — bottom-tier README quality, useful as floor reference
- 09:33 — read og-projects-showcase/zerog/README.md top 40 (project name "0GClaw") · **DIRECT COMPETITOR positioning**: "INFT + cron + x402 = autonomous economic agent"; ships "How It Compares to OpenClaw" table claiming OpenClaw is "dangerous (raw wallet access)" + "dies with your machine"; this is the wedge they want a judge to remember
- 09:33 — read docs/USER_TODO.md top 40 · polished operator action list ordered by submission risk; A-1 wallet 69 OG balance, A-2 mainnet 0.1 OG ask, A-V2-K1 mainnet redeploy 0.05 OG; per-action verify command — strong "no compromise on operator handoff" doc, UNLINKED from README/JUDGE_GUIDE
- 09:33 — read og-projects-showcase/zerog/AGENTS.md · short per-package agent-instructions file ("This is NOT the Next.js you know — read node_modules/next/dist/docs/ first") — pattern OG Labs's featured projects use; Ivaronix has one top-level CLAUDE.md only

## Session 20 · 2026-05-10 09:34

- 09:34 — read og-projects-showcase/derek2403-0g/README.md top 40 (project name "Zero Training") · federated learning on 0G; ASCII flow with coordinator + participants → 0G Storage uploads + on-chain Merkle root → FedAvg → ERC-7857 INFT mint of final model; live demo `0g-nine.vercel.app`; architecture table maps each piece to 0G product — clean shape
- 09:34 — read og-projects-showcase/whale-fun/README.md top 40 · meme-token platform; emoji headers (🐋 🌐 🚀 🛠️ 📦) violate §9 voice; WhaleToken "Not yet deployed" + TokenFactory deployed at `0xb17f...`; light shape, no architecture diagram — useful floor for "what voice NOT to ship"
- 09:34 — read og-projects-showcase/ETH_Global_Cannes_2026/README.md top 40 (project name "AlphaDawg") · 14 agents, 40 API routes, 3 chains (Arc/0G/Hedera), ~$27K target pool; mermaid graph LR diagram; live addresses table per chain; "glass box with mathematical proof" framing — top-tier pitch shape
- 09:34 — read og-projects-showcase/ETH_Global_Cannes_2026/CLAUDE.md (full 200+ lines) · gold-standard agent-guidance doc: COMMANDS / STACK / .env / VERIFIED SDK PATTERNS / ERROR → FIX / BUILD STATUS / TESTING FLOW / LIVE ON-CHAIN ASSETS / INVARIANTS — far beyond Ivaronix's CLAUDE.md operational discipline
- 09:34 — read og-projects-showcase/ETH_Global_Cannes_2026/.claude/rules/{og-compute,x402-payments,hedera,openclaw,dashboard}.md · path-scoped rules files that auto-load when an agent works on matching paths; each ~30-50 lines focused on one SDK/subsystem — pattern Ivaronix should adopt
- 09:34 — read docs/HALF_BAKED.md top 50 · audit ledger from 5 parallel subagents on 2026-05-09; A-1 through A-7 (HIGH bugs); 6 of 7 closed (S-1/S-2/S-3/S-4/S-5/H-1) but doc has no "✅ Closed by <task-id>" trailer per item — closure status invisible

## Session 21 · 2026-05-10 09:35

- 09:35 — read entries/AIsphere/README.md top 40 · 4-badge SVG row + "On-Chain AI Agent Civilization" tagline; mainnet `0xc0238FEb...`; "Tests 94/94" badge; noosphere etymology block + "It's not a platform. It's a civilization." sweeping-voice slogan; `README_CN.md` exists (meets §13 Chinese-or-English rule) — marketing voice backstopped by 94/94 + clickable mainnet address
- 09:35 — read entries/SealedMindMonoRepo/README.md top 40 · "first portable memory layer for AI agents" pitch; 4 capability bullets (Privacy/Persistence/Ownership/Isolation); 15-section ToC; AES-256-GCM + Intel TDX + NVIDIA H100 TEE explicit — direct competitor on memory primitive
- 09:35 — read contracts/test/IvaronixReceiptGuard.t.sol top 40 · Foundry test with `GuardCaller` contract wrapping the library function so `vm.expectRevert` can target it; standard Solidity test pattern; `_anchor` helper builds receipts deterministically — clean Foundry discipline
- 09:35 — read packages/og-storage/src/burn.ts top 40 · Burn Mode AES-256-GCM session-key encryption; **honest-scope JSDoc lines 13-14** ("Burn Mode protects against operator-side disclosure. It does NOT protect against compromise of the user's local machine") — gold-standard security-primitive doc-string voice
- 09:35 — globbed entries/* · 16 competitor entries: provus-protocol, POD, 0g-buildproof, aegis-vault, alphatrace, musashi, 0G_OpenClaw_Hackathon, kuberna-labs, SealedMindMonoRepo, 0g-mindvault, ShadowFlow, AgentHub, AgentPay, ChainShield, ogchain, AIsphere — broad field
- 09:35 — globbed contracts/test/* · 8 Foundry test files (AgentPassportINFT, CapabilityRegistry, SkillRegistry, SubscriptionEscrow, ReceiptRegistry, IvaronixReceiptGuard, AgentPassportINFTV2, ReceiptRegistryV2); maps 1:1 to deployed contracts — full coverage shape

## Session 22 · 2026-05-10 09:36

- 09:36 — read entries/provus-protocol/README.md top 50 · "Autonomous AI Trading Agent" mainnet on chainID 16661; **30,000+ TXs · 15K loop iterations · 99.7% uptime** badge row; ChainGPT audited; 4 contracts on mainnet; ~0.004 OG per attestation × 2 TX per 15s cycle; cost math `~$0.04 per decision vs ~$50 on Ethereum L1` — strongest mainnet-bar reference in the field
- 09:36 — read entries/0g-mindvault/README.md top 40 · "Solo Dev" badge in 5-badge row; ERC-7857 INFT memory + identity; live `0g-mindvault.vercel.app`; INFT `0xcfee7588...` + Registry `0xd0565f93...` on chain; "broken stateless agent" 4-line dialogue example — competitor on memory + INFT primitive overlap
- 09:36 — read entries/ChainShield/README.md top 40 · contract auditing + notarization platform; 4-bullet feature list; image-only flowchart (`public/1776736197035.jpg`); no contract addresses listed in README, no TX count, no deployed-status proof — weakest "is this real?" shape in the field
- 09:36 — read apps/studio/src/components/RunPanel.tsx top 50 · 6 first-party skills HARDCODED in `SKILLS` array (line 10-17) with per-skill default tier; PITCH.md + README say "5 first-party skills" — DRIFT point between code and docs same class as #53 receipt-count drift
- 09:36 — verified SAMPLE_DOC in RunPanel.tsx (residential lease with 6 numbered red-flag clauses) · used by W1 one-click demo path; designed for ~30s receipt-from-zero — strong demo-doc shape

## Session 23 · 2026-05-10 09:37

- 09:37 — read entries/POD/README.md top 40 (Part of Dreams) · freelancer reputation platform on Galileo testnet; portable Agent ID minted from completed work + AI-scoring; live `pod-topaz.vercel.app`; 4-badge row — Track 3-adjacent but for human work
- 09:37 — read entries/AgentHub/README.md top 40 · "AWS for AI agents" agent-to-agent marketplace; LIVE MCP server at `agenthubapi.oliver.tj/mcp`; YouTube demo + frontend + backend live; **backend reads agent defs from database, NOT filesystem** — different architectural shape from Ivaronix's `seed-skills/*.md`; direct Track 3 competitor
- 09:37 — read entries/AgentPay/README.md top 40 · payment infrastructure for autonomous agents; **Track 3 explicit badge**; 3 deployed contracts on 16602 testnet (AgentRegistry `0xfd2f...`, PaymentRouter `0xc97C...`, SplitVault `0xA5dd...`); live app + Loom demo + chainscan link — direct Track 3 competitor on the fee-split wedge
- 09:37 — read apps/studio/src/components/FourLightRow.tsx top 40 · 4-light verification chip (Storage/Compute/TEE/Chain) with `'pending'|'active'|'verified'|'mismatch'` enum; CSS-var token discipline; **lines 6-7 fossilize "Day-13 scaffold... Day-14 wires" sprint-language** in production component used on every `/r/<id>` page

## Session 24 · 2026-05-10 09:38 — `new-entries/` discovery (user shared the path)

- 09:38 — globbed `new-entries/**/README.md` · ~75 READMEs across orgs/zer0Gig + orgs/Trapezohe + orgs/moonnfun + individuals/{nexus-gateway, AIsphere, AgentPay, og-market-bot, agentra-0G, 0G_OpenClaw_Hackathon}; CLAUDE.md §3 said "sibling of oglabs/ NOT inside" but folder lives at `oglabs/new-entries/` (mental-model update)
- 09:38 — read new-entries/orgs/Trapezohe/skills_store/README.md top 40 · "Ghast Skills & MCP Store" — direct competitor on Ivaronix wedge: `registry.json` + `mcp-registry.json` + plugins-bundle-skills shape; live `ghast.trapezohe.ai`; Zod-validated manifests; Git-only (no chain) — simpler but no receipt-gated fee-split
- 09:38 — read new-entries/individuals/agentra-0G/README.md top 40 · "Decentralized AI Agent Economy" pitch + 5-badge row INCLUDING "Status: Under Development" + ⚠️ "Not production-ready"; same Track 3 scope as Ivaronix's wedge but admits non-shipping; long "coordination failure" framing
- 09:38 — read new-entries/orgs/Trapezohe/Ghast_Doc/README.md (12 lines) · standalone VitePress documentation site repo; only 3 commands documented (`pnpm install`, `docs:verify`, `docs:dev`) — separation-of-concerns pattern: docs site is its own repo

## Session 25 · 2026-05-10 09:39 — `new-entries/` deeper

- 09:39 — read new-entries/individuals/og-market-bot/README.md top 40 · Telegram-native marketplace for 0G primitives; mainnet contract `0x6Eea2069...` with `buyStorage()` + `buyCompute()` payable intents; Track 2 + Track 3 explicit — primitives marketplace via Telegram (Ivaronix has CLI + Studio, no Telegram)
- 09:39 — read new-entries/individuals/nexus-gateway/README.md top 40 (project name "Opi") · AI shopping concierge on Telegram; "USDC cashback" + 200+ brands on Laguna affiliate network; DeepSeek V3 on 0G Compute + grammY framework; **only consumer-facing project in the competitive field**
- 09:39 — read new-entries/orgs/zer0Gig/Documentation/README.md top 40 · "The Efficiency Game" payment mechanism: 1-shot=95% / 2-retries=85% / 3-retries=70% revenue; verified by 175K+ 0G Alignment Nodes; Track 3 explicit — quality-conditioned fee splits, more sophisticated than Ivaronix's flat 90/10
- 09:39 — read new-entries/orgs/moonnfun/moonnfun-web/README.md top 2 lines · multi-chain meme launchpad (SEI/BSC/Base); thin coverage; not strategically relevant to Ivaronix wedge

## Session 26 · 2026-05-10 09:40

- 09:40 — read entries/aegis-vault/README.md top 40 · MAINNET (16661); **235 Hardhat tests passing** + Slither fail-on-high + EIP-1167 minimal proxies (~2.7 KB); sealed-strategy commit-reveal LIVE on mainnet (`0x0d7334b8...` 2026-04-27); EIP-712 ExecutionIntent; full marketplace (OperatorRegistry + Staking + Reputation + InsurancePool + AegisGovernor multisig); Khalani cross-chain to Arbitrum — Track 2 production-rigor bar is stratospheric
- 09:40 — read entries/alphatrace/README.md top 40 · "first AI trading agent where decision history is publicly verifiable"; Gemini 1.5 Flash (NOT 0G Compute) + 0G Storage + 0G Chain anchor; 5-min decision cadence; cross-verify pattern (chain hash → Storage → matches) — verifies storage integrity, not compute integrity (TIER 2 under Ivaronix framework)
- 09:40 — read entries/ShadowFlow/README.md top 40 (Chinese) · multi-agent orchestration "Agent Team's VSCode"; ACP (Agent Communication Protocol) pitched as "next LSP"; quick start `git clone → docker compose up -d`; Anthropic/OpenAI/Gemini BYOK fallback — uses 0G Foundation's official `.0g-skills/` with 15 skills (cited in their CLAUDE.md)
- 09:40 — read seed-skills/plan-step/SKILL.md top 50 · `receipt_required: false` (line 27) **contradicts CLAUDE.md §7 "every action generates a receipt"** but pragmatically correct for read-only planning skill with no chain side-effect; has `creator.passport: did:0g:passport:0xaa954...` but MISSING `creator.fee_split` block (per #50 finding)

## Session 27 · 2026-05-10 09:41

- 09:41 — read entries/kuberna-labs/README.md top 40 · embedded SVG hero (lines 8-32) + inline `style="..."` attributes + Apple system-font CSS references; **GitHub strips inline CSS** so design doesn't render where judges read; high-effort visual layer invisible on GitHub web view
- 09:41 — read entries/ogchain/README.md top 40 (project name "Building Culture") · real-estate stack on **Base** EVM L2, NOT 0G primary; uses 0G Storage for off-chain docs but core deployment is Base; AMM (WETH↔property-shares) + lending + prediction markets + native ETH staking — strange-fit entry for a 0G hackathon
- 09:41 — read entries/0g-buildproof/README.md top 40 · "verifiable quality + reputation layer for 0G ecosystem projects"; AI-agent pipeline + BuildProofRegistry on 0G mainnet + report on 0G Storage; **mainnet-only**; recursive shape: BuildProof is itself a hackathon entry that audits other hackathon entries — same primitive as Ivaronix's `0g-integration-auditor` skill
- 09:41 — read seed-skills/content-pitch-review/SKILL.md top 50 · full `creator` block with **70/30 fee_split** (creator: 7000) and explicit comment "marketing-review skills are commoditised; let the field set price discovery on this one"; `passport_min_trust: 0`; slashing rule `on_violation: trustScore: -10, locked: true` — most sophisticated per-skill economic policy in the catalog

## Session 28 · 2026-05-10 09:42

- 09:42 — read apps/studio/package.json (full file, 42 lines) · Next 15.0.3 + React 19 + Tailwind v4 BETA + viem/wagmi 2.13/2.21 + ethers 6.13 + siwe 2.3.2; **`test: "echo skip"` + `lint: "echo skip"`** — Studio has NO package-level tests, only `typecheck`; `pnpm -r test` passes vacuously
- 09:42 — globbed apps/studio/{next,tailwind,postcss}.config · `next.config.ts` + `postcss.config.mjs` exist; no `tailwind.config.*` (Tailwind v4 CSS-first config pattern, same as AlphaDawg per S20)
- 09:42 — read packages/skills/src/manifest.ts top 60 · Zod schema = canonical source of truth; `shell_access: ['none','sandbox-only','full']` (line 15) + `memory_access: ['none','project_only','all']` (line 11) + 7 numeric/string fields; JSDoc explains "OG block is the long-term moat per PRD §3.4 — a forker who copies just name/description gets nothing"; line 55 fossilizes "(Day 11)" sprint reference
- 09:42 — read contracts/test/ReceiptRegistryV2.t.sol top 60 · clean Foundry test for K-2 EIP-712 anchor; `_sign` helper uses `vm.sign(pk, digest)` + `abi.encodePacked(r,s,v)`; `_params` deterministic AnchorParams; alice/bob test wallets with hardcoded hex-pattern privkeys (clearly test-only but no namespace-warning header)
- 09:42 — globbed contracts/foundry.toml · exists at expected path

## Session 29 · 2026-05-10 09:43

- 09:43 — read contracts/foundry.toml (full 25 lines) · solc 0.8.20, evm `cancun`, `optimizer = true`, `optimizer_runs = 200`, **`via_ir = false`**; RPC endpoints for testnet (16602) + mainnet (16661); empty etherscan keys; fs_permissions read-write only `./broadcast`; line_length 110 — direct deployment (no EIP-1167 proxies, contrast with Aegis #78)
- 09:43 — read apps/studio/next.config.ts (full 41 lines) · 7 workspace packages in `transpilePackages`; `extensionAlias['.js']: ['.ts','.tsx','.js']` (NodeNext convention noted line 5-7); webpack fallback noops `@react-native-async-storage/async-storage` for wagmi mobile-import quirk; **line 18 fossilizes internal debug comment** ("better-sqlite3 transitively?? no, it doesn't")
- 09:43 — read apps/studio/postcss.config.mjs (3 lines) · just `@tailwindcss/postcss` plugin; minimal Tailwind v4 setup
- 09:43 — read apps/cli/src/commands/receipt.ts top 50 · `findAnchoredDirs()` walks up 12 levels + canonical sibling search (`apps/{cli,mcp-server,studio}`); `resolveReceiptInput()` accepts numeric id / 0x bytes32 / ULID / file path — flexible input; imports V1 `ReceiptRegistryClient` directly — **V1-blindness on CLI verify path** same shape as 5 Studio surfaces
- 09:43 — globbed `tsconfig.base.json` + `tsconfig.json` across repo · ZERO Ivaronix-side `tsconfig.base.json` at repo root; competitor + node_modules patterns mostly use one — Ivaronix per-package tsconfigs drift

## Session 30 · 2026-05-10 09:44 — threshold-crossing session

- 09:44 — read contracts/test/AgentPassportINFTV2.t.sol top 40 · Foundry test for K-1; sets up `Erc7857Verifier` + `ReceiptRegistry` + `AgentPassportINFTV2` via constructor cross-check; `addAuthorizedRecorder(recorder)` closes K-1 vulnerability; attestor key `0xA77E5707_AAAA_BBBB_...` (test-only, same namespace concern as #86)
- 09:44 — read apps/cli/src/commands/skill.ts top 50 · `skillSearchDirs()` walks up 8 levels for `seed-skills/`; combines local `.ivaronix/skills` + repo seed-skills with dedup; `requireKey` reads EVM_PRIVATE_KEY OR OG_PRIVATE_KEY (per #15); imports `manifestHashToBytes32` for SkillRegistry — clean CLI shape
- 09:44 — read .github/workflows/jcs-roundtrip.yml (full 51 lines) · K-15 polyglot CI gate: TS + Python + Rust self-tests + cross-impl byte-equality on every PR/push; 15-min timeout; **Go support queued** (operator action: install Go); ONLY CI workflow in repo (per #2 + #84) — K-1/K-2/K-8/K-9/K-16/K-20 have zero CI gating
- 09:44 — globbed apps/studio/src/app/api/run/route.ts · exists at expected path

---

## Stop condition met · 2026-05-10 09:45

- 30 sessions of flow lines ✅
- ≥40 thought entries ✅ (92 thoughts internal numbering)
- ≥10 distinct angles ✅ (~55 angles)

The wandering loop terminates here per the loop spec. A "Top fixes" TL;DR has been added to the top of `wanderingthoughts.md` for the next agent reading the files.
