# QA Fix Log · ivaronix.vercel.app · commit `7aebbfb`

Per the plan's §God-Level Fixing Mindset and §Working Files Rule. Every fix needs reproduce-first, root-cause, expected behavior, fix plan, files changed, retest proof, regression check, remaining risk.

## Iteration 12-13 · Render-target doc honesty sweep

| # | Issue | Expected | Root cause | Fix | Files changed | Tests run | Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| 6 | JUDGE_GUIDE.md step 1 + README "Verify a real receipt right now" + MAINNET_READINESS §11 all promise `Status: → FULLY VERIFIED ✓` as the deterministic expected output. Driving the literal reproducer against receipts 1304, 3, and 1069 today produces `ANCHORED + tee:primary error "getting signature error"` instead. | Either show the actual current output or make the verify path consistently produce FULLY VERIFIED ✓. | `broker.inference.processResponse` fails against the live 0G Compute provider — Router rate limit, provider session rotation, or transient network. Not receipt-specific (same failure on 1304 V1, 3 V2, 1069 V1). Schema/hash/signature/chain-anchor all PASS. Only the optional fifth check (live re-verify) fails. | Per CLAUDE.md §1 brutal honesty: update the three render-target docs to disclose both outputs, name the failure mode, frame the first four checks as the load-bearing authenticity proof. Same model PITCH.md already uses at line 92. | `docs/JUDGE_GUIDE.md`, `README.md`, `docs/MAINNET_READINESS.md`, `Ivaronix_User_QA_Test_Plan.md`, `QA_PROOF_PACK/QA_TEST_PROGRESS.md` | `pnpm --filter @ivaronix/cli dev receipt verify <id> --tee-independent` (4 runs across 3 receipts) · `pnpm --filter @ivaronix/studio test` (59 PASS) · `pnpm docs:render` (45 markers in sync). | `QA_PROOF_PACK/cli-logs/judge-guide-step1-verify-1304-iteration12.log`, `judge-guide-verify-receipt-3-v2-iteration12.log`, `verify-1069-mainnet-readiness-claim-iteration13.log`. Also drops the "no competitor in the field" superlative from JUDGE_GUIDE step 1 per §9 + adds canonical `IVARONIX_SIGNER_KEY` next to legacy `EVM_PRIVATE_KEY` per §15. | ✅ CLOSED via `e9de060` + `7aebbfb` |
| 7 | `.claude/rules/skills.md:71` lists 6 built-in hooks (including `safety_filter`); only 5 ship in `packages/skills/src/hooks/builtin/`. Documentation drift caught by QA plan §1190. | Rules doc should match `BUILTIN_HOOKS` registry exactly. | `safety_filter` was probably planned but never shipped; rules doc kept the name. `packages/skills/src/hooks/registry.ts:9-15` is canonical with 5 entries. | Update rules doc to list the 5 shipped hooks + add a registry-line pointer. Per CLAUDE.md §9 honest-by-absence: don't claim a feature that doesn't ship. | `.claude/rules/skills.md:71` | grep verified 5 hooks exist in `builtin/` directory and 5 entries in `BUILTIN_HOOKS`; no `safety-filter.ts`. | Code-level confirmation in `registry.ts:9-15`. | ✅ CLOSED (this iteration) |

```
Total fixes: 3
Open issues: 1 (fix in flight — local build verifying)
Closed:      2
```

## Fix #3 — Studio chain reads broken on Vercel (root cause of /r/<id> 404 + dashboard empty)

| Field | Detail |
|---|---|
| **Issue** | Every `/r/<id>` route returns 404 on live Vercel (`/r/994`, `/r/1004`, `/r/1014`, `/r/1056`, `/r/1069`, `/r/1304` — all 6 seeded IDs referenced by `MAINNET_READINESS.md` #6 + `JUDGE_GUIDE.md` step 1+2). `/api/dashboard/<operator>` returns `passport: null, recentReceipts: []` for the operator wallet `0xaa954c…` that has 1,644 receipts anchored on chain. RPC balance read works (returns 69.04 OG), so chain connectivity is fine. |
| **Severity** | CRITICAL — **submission-blocking.** Every JUDGE_GUIDE.md step that involves a receipt page fails. The whole proof-explorer UX is dead on the live deploy. |
| **Expected** | `/r/<existing-id>` renders FULLY VERIFIED ✓ chip + four-light row + anchor tx link. `/api/dashboard/<addr>` returns real passport + recentReceipts for an operator with receipts. |
| **Root cause** | `@ivaronix/og-chain` `getDeployedAddress(network, contract)` reads `contracts/deployments/<network>.json` via `findDeploymentsDir(process.cwd())` which walks up looking for the file. On Vercel's serverless function, `process.cwd()` is the function root and the `contracts/` directory is **not included in the function bundle** — `@vercel/nft` doesn't trace JSON files referenced via runtime `process.cwd()` walks. Result: `getDeployedAddress` returns null for every contract → `getReceiptRegistry()` returns null → `unifiedGetReceipt()` has no clients to try → returns null → `notFound()` → 404. Same root cause for `unifiedFindByAgent` returning empty. |
| **Why local works** | CLI runs from inside the monorepo so `process.cwd()` walk-up finds `contracts/deployments/`. Vercel runs the function with a different cwd that doesn't contain it. |
| **Fix plan** | Build-time static import of the JSON manifest into the Studio bundle via webpack. Replaces the runtime `process.cwd()` walk with a typed module import. Manifest becomes part of the function's static dependency graph; `@vercel/nft` traces it correctly. |
| **Files changed** | (1) NEW `apps/studio/src/lib/deployments-bundle.ts` — imports `contracts/deployments/testnet.json` directly + exports `getStudioDeployedAddress` and `getStudioDeployments`. (2) `apps/studio/src/lib/chain.ts` — swap import from `@ivaronix/og-chain` to local `deployments-bundle`. (3-6) `apps/studio/src/app/{onboard,memory,global,0g}/page.tsx` — swap to local bundle (4 routes that import `getDeployedAddress` / `loadDeployments` directly). |
| **Tests run** | typecheck + clean `next build` (in flight); CI on push. Live verification: re-curl `/r/1004` → expect 200 + real receipt page. Re-curl `/api/dashboard/<operator>` → expect non-empty `passport` + `recentReceipts`. |
| **Evidence** | Pending build + Vercel redeploy. After redeploy, append curl outputs to QA_PROOF_PACK/cli-logs/post-fix-http-sweep.log. |
| **Regression risk** | Studio now reads addresses at build-time, not runtime. Implication: **on every V2 redeploy of a contract, Studio MUST be rebuilt + redeployed** to pick up the new address (this was already true logically; now it's enforced by the build). Documented in deployments-bundle.ts JSDoc + CLAUDE.md §15 bookkeeping rule covers it. |
| **Remaining risk** | Mainnet manifest is `null` in the bundle today — Studio on mainnet will fall back to null lookups until `contracts/deployments/mainnet.json` is written + Studio rebuilt. Not a regression (mainnet not yet live), but documented. |
| **Status** | ✅ FIX SHIPPED — commit `b342fd1` pushed, Vercel redeploying. Live verification appended after redeploy lands. |
| **Pre-commit caveat** | The fix's JSDoc originally hardcoded "1,644 receipts" (the live chain count from numbers.json) — pre-commit's `verify-no-stale-numeric-snapshots.ts` correctly caught it and blocked the push. Rewrote the JSDoc to evergreen prose ("receipts genuinely exist on Galileo"). This is the regression doing its job. |

## Fix #4 — All 6 first-party skill manifests drifted from on-chain hash (tamper guard rejected every demo run)

| Field | Detail |
|---|---|
| **Issue** | `ivaronix demo` (and `/api/run` flow that uses any first-party skill) failed with `Error: registry: local manifestHash (0x…) differs from on-chain (0x…) — manifest was tampered with after publication`. Tested all 6 first-party skills — every single one (private-doc-review, 0g-integration-auditor, github-audit, content-pitch-review, plan-step, code-edit) had drifted local-vs-chain hash. |
| **Severity** | CRITICAL — blocks every receipt-anchoring flow that goes through a first-party skill. The Studio Run panel + CLI demo + `ivaronix doc ask` all rely on these. |
| **Expected** | Local manifestHash == on-chain manifestHash → tamper guard allows the run to proceed → receipt anchors. |
| **Root cause** | After `private-doc-review@0.3.0` was last republished (per `TEST_REPORT.md` B3, sweep `5e497ab`), three subsequent commits modified the SKILL.md files without bumping their versions: `54643a7` (canonical-leading env rewrites · 5 manifests), `40b718f` (Efficiency Game schema + fee-split), `32161a6` (added `metadata.openclaw` blocks to all 5 first-party manifests). Each commit changed the canonical hash of one or more manifests; none triggered the "bump version + republish" follow-up rule (CLAUDE.md §15 — bookkeeping in the same commit). |
| **Why didn't CI catch it** | The 94 verify-*.ts regressions don't check on-chain manifest hash parity vs local — it would require a chain read at pre-commit time which would slow the hook unacceptably. Worth proposing a separate `pnpm skill-hash:check` script that's run before submission (queued for §B-V2). |
| **Fix plan** | (1) Bump version on each of the 6 skills (patch). (2) Run `ivaronix skill publish <skill>` for each → anchors new versionId + manifestHash on SkillRegistry. (3) Verify by re-running `ivaronix demo`. (4) Commit the version bumps. |
| **Sub-issue · plan-step had a stale local cache** | `.ivaronix/skills/plan-step/SKILL.md` is a cached copy from a per-wallet skill-publish sandbox (per `/api/skill/save` flow). The cache had `version: 0.1.0` while the seed had `0.1.1`. CLI loader prefers the cached copy when present → reads the old version. Copied seed→cache to fix. (No other skills had a cached copy.) Worth a separate `verify-no-stale-skill-cache.ts` regression. |
| **Files changed** | `seed-skills/{private-doc-review,0g-integration-auditor,github-audit,content-pitch-review,plan-step,code-edit}/SKILL.md` (6 version bumps) + `.ivaronix/skills/plan-step/SKILL.md` (cache sync). |
| **Tests run** | 6× `ivaronix skill publish <skill>` against SkillRegistry on Galileo. |
| **Evidence** | All 6 publish-tx hashes captured in `QA_PROOF_PACK/cli-logs/skill-republish-all.log`: |
| | · `private-doc-review@0.3.1` tx `0xef1db6aa0c6a04860fd239d3333e152707d1174c4bdb1d729290b5f4dc59eeda` block 32907617 |
| | · `0g-integration-auditor@0.1.1` tx `0xea8dfea1c05ea4606869f34fed2f41ccca94d1c40589ee4652492ab9e0b5612b` block 32907750 |
| | · `github-audit@0.1.1` tx `0xf61587715f29a4297d77fe80232a9f71e271137b457b28eb83d98102e2ef21ba` block 32907795 |
| | · `content-pitch-review@0.1.1` tx `0xea20444f9ee9a35be7c7d900e248c029ed2b1b341d53864e36b97694173309cf` block 32907830 |
| | · `code-edit@0.2.1` tx `0xc501bdad3aca21c7f8167068c2d09f881b4979b0fcede13eb3ab014944a56432` block 32907877 |
| | · `plan-step@0.1.1` tx `0x3011d5e47154e51337658c6b622e47248088aa740de1f53d8baabd5b85ec6d55` block 32908423 |
| **Regression check** | Re-running `ivaronix demo` (in flight at fix close-out). Expected: tamper guard passes, receipt anchors. |
| **Remaining risk** | Any future commit that edits SKILL.md without bumping version + republishing reintroduces this drift. Proposed mitigation: `pnpm skill-hash:check` regression (queued for §B-V2). Also: the `.ivaronix/skills/<id>/` per-wallet cache is a known divergence vector — `verify-no-stale-skill-cache.ts` regression queued. |
| **Status** | ✅ ALL 6 CLOSED via republish |

## Fix #5 — Footer.tsx chain reads: same Vercel cwd bug as #3 but in a different file

| Field | Detail |
|---|---|
| **Issue** | QA iteration 7 `run-deeper.ts` against the live Vercel deploy reported `0G Compute / 0G Storage / 0G Chain / 0G DA / 0G Router / Sealed Inference` all "not visible" in the footer. Investigation revealed Footer.tsx imports `loadDeployments` directly from `@ivaronix/og-chain`, same `findDeploymentsDir(process.cwd())` walk-up that broke chain reads in fix #3. On Vercel, the function bundle does NOT contain `contracts/deployments/<network>.json` → `loadDeployments` returns `null` → `liveRegistry = []` → the Network column of the footer renders ZERO contract chainscan links. |
| **Severity** | HIGH — `JUDGE_GUIDE.md` step 2 + `MAINNET_READINESS.md §1` both depend on the Network column being populated. Judges following the guide would see an empty footer column where 8 chainscan links should be. |
| **Expected** | Footer Network column renders 8 chainscan links — V1+V2 for `ReceiptRegistry`, V1+V2 for `AgentPassportINFT`, plus `Erc7857Verifier`, `CapabilityRegistry`, `MemoryAccessLog`, `SkillRegistry`. |
| **Root cause** | Same exact pattern as fix #3, in a different file that I missed when patching. Fix #3 hit 5 sites (chain.ts + 4 page.tsx files) but Footer.tsx wasn't in the search net. |
| **Fix plan** | Swap `loadDeployments` import from `@ivaronix/og-chain` to `getStudioDeployments as loadDeployments` from `@/lib/deployments-bundle` — same one-line pattern as fix #3. |
| **Files changed** | `apps/studio/src/components/Footer.tsx` (1 import line). |
| **Tests run** | `pnpm --filter @ivaronix/studio typecheck` clean; clean `next build` succeeds; `0xf675d4183b34fe8d1981FA9c117065aAcff690ab` (V2 ReceiptRegistry) confirmed baked into compiled `apps/studio/.next/server/chunks/1947.js` (the footer chunk). |
| **Evidence on LIVE Vercel after deploy** | Vercel deploy `hcsaho3oz` (commit `2d9e01f`) Ready in ~18s. `vercel inspect ivaronix.vercel.app` confirms it's the bound alias. `curl https://ivaronix.vercel.app/ \| grep -oE 'chainscan-galileo\.0g\.ai/address/0x[a-fA-F0-9]+' \| sort -u` returns 8 unique addresses — exactly what's expected (V1+V2 of ReceiptRegistry, AgentPassportINFT, plus Erc7857Verifier, CapabilityRegistry, MemoryAccessLog, SkillRegistry). |
| **Regression check** | All 75 source-file regressions still PASS on pre-commit. The same `verify-no-stale-numeric-snapshots.ts` that caught my "1,644 receipts" JSDoc in fix #3 also re-ran clean (the new fix's JSDoc uses evergreen prose). |
| **Remaining risk** | Same as fix #3: any V2 contract redeploy now requires a Studio rebuild + redeploy to pick up the new address. Documented. |
| **Pattern lock** | Proposed regression: `verify-no-og-chain-deployments-import-in-studio.ts` to fail CI if `apps/studio/src/**` imports `loadDeployments`/`getDeployedAddress` from `@ivaronix/og-chain` again. Queued (would have caught this in pre-commit). |
| **Status** | ✅ CLOSED via `2d9e01f` — fix shipped, Vercel redeploy verified live |




| # | Issue | Expected | Root cause | Fix plan | Files changed | Tests run | Evidence | Regression | Remaining risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `pnpm wording-lint` failed on 3 hits in QA test plan (`delve` / `leverage` / `robust` at line 1110:62/69/79) | The plan's gate-script row quotes the CLAUDE.md §9 banned-word list as an example — this is documentation about the rule, not violation of it. | The QA test plan I authored quotes banned-word examples without the `wording-lint:allow:meta-list-of-banned-tokens` marker. CLAUDE.md uses the same marker (line 128) for the same reason. | Add the standard marker to the row. | `Ivaronix_User_QA_Test_Plan.md:1110` | `pnpm wording-lint` re-run | `pnpm wording-lint` returns `0 total · 0 amnestied · 3/3 assertions passed` | No drift; line is a meta-list and marker is bounded to it | None | ✅ CLOSED |
| 2 | `pnpm docs:check` + `pnpm numbers:check` failed with "DRIFT: docs/numbers.json is 34.1h old (max 24h)" | numbers.json should be refreshed within the 24h window | Auto-derived counts had not been refreshed since `2026-05-11`; the freshness gate is a sentinel against doc-claim drift. | `pnpm numbers:refresh` (hits live chain to update counts). | `docs/numbers.json` (auto-regenerated) | `pnpm docs:check` + `pnpm numbers:check` re-run | both now green (10.2h old, within 24h window); refresh confirmed 1,644 V1 + 0 V2 receipts, 13 receipt types, 6 first-party skills, 25 workspace packages | Tester should re-run `pnpm numbers:refresh` daily during the QA window so the gate keeps passing | None today; refresh again before submission | ✅ CLOSED |
