# Changelog

> Audit-and-close ledger. Every audit finding has a status row, every fix carries a `Closes audit #N` commit trailer, every phase has a section. Closes planning-003 §A.4.3 (wandering thoughts #57, #62, #63). Companion: `docs/HALF_BAKED.md` (open audit ledger), `docs/PHASE_B_DISCLOSURES.md` (legacy Phase-B closure log, being merged here).

## Convention

Every audit-fix commit MUST carry the trailer:

```
Closes audit <ID>
```

Where `<ID>` is the audit code from `docs/HALF_BAKED.md` or `docs/planning-003.md` (e.g. `S-1`, `K-2`, `A.1.3`, `WT 43`). Multiple closures: comma-separated.

`pnpm audit:list` (queued · USER_TODO §B-V2-13) runs `git log --grep "Closes audit"` to print the rolling audit roll-up. Until that ships, run the grep manually.

CLAUDE.md §1: NO `Co-Authored-By` trailers. Conventional-commit subject + body only.

## Phase C — testnet polish bundle (in progress · 2026-05-10)

Plan `docs/planning-003.md` Section A drives this phase. Operator-action gates for mainnet captured in `docs/USER_TODO.md` §B-V2-1 through §B-V2-13.

### Phase 1 · Critical correctness (6/6 ✅)

| ID | Item | File / Was / Now | Commit |
|---|---|---|---|
| A.1.1 | Form/schema enum drift bug | `apps/studio/src/app/skill/new/page.tsx`: hardcoded `['none','read','read-write']` mismatched Zod `['none','sandbox-only','full']`. **Now:** form derives `MEMORY_OPTIONS`/`SHELL_OPTIONS` from `MemoryAccessEnum.options` + `ShellAccessEnum.options` (manifest schema is source of truth). | `571bb8c` |
| A.1.2 | CLI receipt verify V2-only | `apps/cli/src/commands/receipt.ts`: V1-only loader broke gold-standard verify on V2 receipts post-mainnet. **Now:** `buildReadRegistries(network)` returns V2-first-V1-fallback for verify/show/list paths; anchor write path stays V1 (V2 needs EIP-712 sig flow). | `60aabe9` |
| A.1.3 | Studio V1-blindness across 8 surfaces + onboard mint | 8 Studio routes called `getReceiptRegistry()` directly; `/onboard` minted to V1, trapping new mints in legacy contract. **Now:** `apps/studio/src/lib/chain.ts` adds `unifiedNextId/GetReceipt/FindByReceiptRoot/FindByAgent` helpers. All 8 surfaces refactored. `/onboard` mints V2-first. | `57e7f26` |
| A.1.4 | Studio test target was no-op | `apps/studio/package.json`: `"test": "echo skip"`. **Now:** `pnpm --filter qa-metamask-e2e run regressions:studio` runs source-file regressions. CI workflow `regression-smokes` job gates studio + cli + contracts groups. | `0ce639a` |
| A.1.5 | V2 anchor smoke not CI-gated | `verify-v2-anchor-live.ts` ran only manually. **Now:** `.github/workflows/chain-smoke.yml` runs label-gated PR + nightly cron with `IVARONIX_CI_WALLET_KEY` secret. Operator runbook `docs/CI_WALLET.md` ships. | `eb91d1b` |
| A.1.6 | TIER_OPTIONS hardcoded | Form had third hardcoded enum. **Now:** `ConsensusTierEnum` extracted from manifest schema; form imports it. | `21a849d` |

### Phase 2 · Submission polish (5/7 — A.2.1 partial, A.2.2 deferred)

| ID | Item | Commit |
|---|---|---|
| A.2.3 | Documentation section linking 11 deep docs from README | `0f2578f` |
| A.2.4 | Track 1 + Track 3 by-the-numbers headline blocks | `0f2578f` |
| A.2.5 | Counter-position table (vs OpenClaw, 0GClaw, Trapezohe, AlphaTrace) + honest TIER 1/2 disclosure callout | `0f2578f` |
| A.2.6 | Polyglot canonical hash Criterion-1 moat surfaced | `0f2578f` |
| A.2.7 | `docs/numbers.json` + `pnpm numbers:refresh` (1,644 receipts confirmed live) | (numbers commit) |

### Phase 3 · Schema + voice (8/8 done or queued)

| ID | Item | Commit |
|---|---|---|
| A.3.1 | Sprint-language scrub (4 Solidity NatSpec + 2 user-visible TS comments) | `a111765` |
| A.3.2 | Threat-model JSDoc on 5 security primitives | `af54b30` |
| A.3.3 | Brand-token consolidation (`brand/tokens.css` + `brand/tokens.json`) | (brand commit) |
| A.3.4 | Env-var canonical `IVARONIX_*` with deprecation warnings | `ee243bc` |
| A.3.5 | `tsconfig.base.json` (per-package extends migration queued §B-V2-12) | `58cd323` |
| A.3.6 | `receipt_required: true` on plan-step (every skill anchors) | `41ba3bd` |
| A.3.7 | Test-key namespace warning on 8 Foundry test files | `c3a8730` + `bdf31d0` |
| A.3.8 | `creator.fee_split` 90/10 added to 4 skills missing it | `41ba3bd` |

### Phase 4 · Architecture compounding (in progress)

| ID | Item | Status |
|---|---|---|
| A.4.1 | Autonomous wander-cycle agent on TESTNET | shipped (`scripts/wander-cycle/`) — operator daemonising via §A-V2 next |
| A.4.2 | Path-scoped `.claude/rules/*.md` (7 files) | shipped |
| A.4.3 | CHANGELOG.md + commit-trailer convention | shipped |
| A.4.4 | zer0Gig Efficiency Game adoption | queued (6h) |
| A.4.5 | `docs/MARKETPLACE_DESIGN.md` | shipped |
| A.4.6 | `docs/SOLIDITY_CHOICES.md` | shipped |
| A.4.7 | `docs/SKILL_PUBLISHING.md` | shipped |
| A.4.8 | MemoryEngine fourth product surface (CLI + Studio) | queued (3-4h) |
| A.4.9 | Convergence Jaccard → embeddings | shipped (`packages/consensus/src/convergence.ts` async path) |

### Phase 5 · Polish + ghost-surface deletion (in progress · 2026-05-10)

| ID | Item | File / Was / Now | Status |
|---|---|---|---|
| A.5.7 | og-toolkit honest-stub disclosure | `packages/og-kv/src/index.ts`: `StubKvClient` advertised the same interface as the production client; third parties calling `og.kv.set(...)` got a Map silently. **Now:** renamed `InMemoryKvClient` (alias kept), prints one-time `console.warn` on first use, `createKvClient({ requireDurable: true })` returns `null` so callers can short-circuit instead of writing to a Map. | shipped |
| A.5.13 | ShareButton silent clipboard-failure feedback | `apps/studio/src/components/ShareButton.tsx`: on clipboard failure the catch silently opened a tab while the button kept saying "Copy URL". **Now:** four-state machine (`idle | copied | fallback | error`) with explicit per-state labels; the `error` branch slices the URL into the button so the user can copy from the button itself when popups are blocked too. | shipped |
| A.5.18 | forge-daemon ghost-surface deletion + HLD architectural-drift fix | `apps/forge-daemon/` was an empty directory; HLD.md §1 surface table referenced 7 surfaces, three of which (`forge-daemon`, `skill-store`, `worker`) didn't exist; the architecture diagram drew arrows into a non-existent local Hono daemon. **Now:** empty `apps/forge-daemon/` deleted; HLD §1 table rewritten to list the 7 real apps (studio, cli, api, mcp-server, npx-cli, openclaw-skill, telegram-bot); explicit "this does not exist; here's what we use instead" callouts added; arch diagram updated to show `packages/sdk + packages/runtime` as the in-process orchestrator. | shipped |
| A.5.15 | `eth-private-key` regex narrowing + exact-match path | `packages/consensus/src/gates.ts:34`: broad `\b(?:0x)?[a-fA-F0-9]{64}\b` regex false-positived on every receipt id, tx hash, content root, and signature half referenced in a doc-review run. **Now:** broad heuristic dropped from `SECRETS_REGEX_LIST`. Two paths added: (a) when `signerPrivateKey` is supplied via `GateInput`, exact-match scan against the operator's loaded key — zero false positives, perfect detection of an accidental paste; (b) when no signer key is loaded (read-only flows), heuristic 64-hex scan with receipt-context suppression via `RECEIPT_CONTEXT_LABELS` lookback (`tx`, `hash`, `root`, `receipt`, `anchor`, `id`, `block`, `commit`, `storage`, `attestation`, `signature`, `r:`, `s:`, `evidence`). Wired through `ConsensusInput` → `runGates` → all three callers (`pipeline.ts`, `apps/cli/src/commands/doc.ts`, `apps/cli/src/commands/passport-consolidate.ts`, `packages/skills/src/run.ts`). 9 new regression tests in `gates.test.ts` (15/15 passing). | shipped |
| A.5.4 | Repo-root doc hygiene + sprint-doc archival headers | 24 docs in `docs/` mixed evergreen-canonical with sprint-internal at one level; root had `SESSION_FINAL.md` (2026-05-08 snapshot) + `QA_TEST_PROGRESS.md` (sprint contractor tracker) + `wandering{thoughts,flow}.md` (planning-003 source docs) with no live-state pointer at the top. **Now:** new `docs/QUALITY.md` extracts evergreen quality philosophy from QA_MISSION (CLI as gold standard, TIER 1 vs TIER 2 honesty, test topology, stop condition). Archival headers added at the top of: `SESSION_FINAL.md`, `QA_TEST_PROGRESS.md`, `docs/QA_MISSION.md`, `docs/planning-01.md`, `docs/planning-002.md`, `docs/PLAN_pass76.md`, `docs/PLAN_pass77_cli.md`, `docs/PASS77_F1h_*.md` (3 files), `wanderingthoughts.md`, `wanderingflow.md`. Each archived doc points readers to live state. Full subdir restructure (`docs/{spec,judge,audit,_internal}/`) + auto-gen `STATUS.md` + pre-commit absolute-number hook deferred to USER_TODO §B-V2-19/20/21 — all three are mainnet-window polish that need the full cross-reference sweep done in one commit. | partial (headers shipped; subdir move queued) |
| A.5.20 | `red-team-critic` orphan role · audit tier shipped | `packages/consensus/src/prompts.ts` declared 6 RoleId values; only 5 wired into tiers — `red-team-critic` was orphan dead-code. Worse, `high-stakes` in `packages/core/src/types.ts` had `red-team-critic` but was missing `critic`, so the documented "5 reviewers + judge" tier shape had silently drifted. **Now:** new `audit` tier (6 roles: analyst + critic + risk-reviewer + evidence-checker + red-team-critic + judge) added to `ConsensusTier`. `high-stakes` corrected to (analyst + critic + risk-reviewer + evidence-checker + judge — 5 roles). Composition is monotone: `standard ⊂ high-stakes ⊂ audit`. Wired through: `ConsensusTier` in core/types, `ROLES_BY_TIER`, `TIER_COST_OG` (audit priced at 0.072 OG, premium above high-stakes), `ConsensusTierEnum` + `RegistryEntry.default_tier` Zod, `--audit` CLI flag with precedence quick > audit > high-stakes > consensus, `HookEvent_PreConsensus.tier`, `apps/studio/src/app/skills/page.tsx` `SkillCard.defaultTier`. New `tier-shape.test.ts` (8 tests) enforces tier composition + cost-table coverage + monotone-extension property + no-orphan-role guarantee. 23/23 consensus tests pass. | shipped |
| A.5.6 | `scripts/` reorganization | 13 one-off TS scripts at `scripts/*.ts` mixed purposes; two duplicate files (`smoke-storage.ts` + `storage-smoke.ts`); flat layout had crossed the ~12-file readability threshold. **Now:** `scripts/{ops,migrations,smoke,diag}/` subdirs created. 12 scripts moved via `git mv`: `ops/` (anchor-all-receipt-types, automate-receipts-testnet, build-hello-receipt) · `migrations/` (migrate-openclaw-metadata, port-awesome-claude-skills) · `smoke/` (chat-tools-smoke, cron-smoke, og-toolkit-smoke, smoke-storage) · `diag/` (debug-router, fresh-wallet-onboard, numbers-refresh). Duplicate `storage-smoke.ts` deleted (its B-1 SDK-bump verification value is moot now that the migration is integrated; the comprehensive `smoke/smoke-storage.ts` covers both plaintext + burn-mode upload). `scripts/README.md` indexes the four subdirs by purpose. Three `REPO_ROOT` relative-path drift fixes (numbers-refresh, port-awesome-claude-skills, migrate-openclaw-metadata) so the moved scripts still resolve to the actual repo root. `package.json` `numbers:*` aliases updated to the new path. `pnpm numbers:print` confirms 1,644 receipts live from new path. | shipped |

## Phase B — pre-K-1/K-2 cleanup (closed 2026-05-09)

See `docs/PHASE_B_DISCLOSURES.md` for the full File / Was / Now log of items A through H. Summary:

- **A.** Vanity agent handle copy: dropped sprint-internal "Handles arrive Day 17" placeholder.
- **B.** Receipt type human label: `receiptTypeLabel(5) → "skill_exec"` reverse-mapped from `RECEIPT_TYPES`.
- **C.** CLAIMED banner shown as success: now amber, not green.
- **D.** Hardcoded first-party skill count on /global: live count from `loadAllSkills()`.
- **E.** Agent profile receipts cap: 5 → 25 visible window.
- **F.** MemoryAccessLog audit feed for THIS owner: real on-chain events.
- **G.** Skill registry hash mismatch panel: closed.
- **H.** Wallet-connect copy alignment: standardised across surfaces.

## How to grep the rolling audit log

Until `pnpm audit:list` ships:

```bash
git log --grep "Closes audit" --pretty=format:"%h %s%n%b" | grep -E "Closes audit|^[a-f0-9]{7,}"
```

This prints every commit subject with a `Closes audit` trailer + the IDs it closed. Pair with `docs/HALF_BAKED.md` (open ledger) to see the full audit lifecycle.
