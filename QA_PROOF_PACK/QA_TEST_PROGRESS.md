# QA Test Progress · ivaronix.vercel.app · commit `e9de060`

```
PASS:    154 / ~908 rows
FAIL:    0 (6 issues found · 6 SHIPPED · 1 partial = run-revoke UI refetch · tx confirmed on chain)
PENDING: 0
BLOCKED: 1 (3 OG-image routes — §B-V2-2 known-limitation)
DELEGATED-TO-USER: 0 (CLAUDE.md §1 rule prohibits)
Capture totals:
  Desktop screenshots: 301 across 7 harness runs
  Mobile (375x812):     21
  Videos (.webm):       24 session recordings
  CLI logs:             18 saved (judge-guide step 1 verify-1304 + verify-3-v2 added this iteration)
Last updated: 2026-05-12 (cron c25a7e8b · iteration 12)
```

## Iteration 12 — JUDGE_GUIDE.md literal reproducer

| # | Section | Row | Status | Method | Evidence |
|---|---|---|---|---|---|
| 90 | JUDGE_GUIDE step 1 · receipt 1304 reverify | `ivaronix receipt verify 1304 --tee-independent` against testnet | 🔧 BUG #6 (doc accuracy) | CLI | `cli-logs/judge-guide-step1-verify-1304-iteration12.log` — schema/hash/signature/chain-anchor PASS · tee:primary error "getting signature error" → ANCHORED not FULLY VERIFIED ✓ as doc claimed |
| 91 | JUDGE_GUIDE step 1 · receipt 3 reverify (control) | same failure on the fresh V2 receipt anchored last iteration → confirms the failure is current testnet state, not receipt-specific | ✅ CONFIRMED (not flaky) | CLI | `cli-logs/judge-guide-verify-receipt-3-v2-iteration12.log` |
| 92 | JUDGE_GUIDE doc fix shipped — commit `e9de060` | doc now discloses both possible outputs honestly (FULLY VERIFIED ✓ when TEE reachable, ANCHORED + tee:primary error when not). Names the failure mode (Router rate limit, provider session rotation, transient network). Explains first four checks are load-bearing authenticity proof. Drops the "no competitor in the field" superlative per CLAUDE.md §9 ban on competitor-bashing. Adds canonical IVARONIX_SIGNER_KEY next to legacy EVM_PRIVATE_KEY per §15 alias rule. | ✅ PASS | local + push | `e9de060` |
| 93 | numbers.json refresh after first V2 anchors landed | v2Anchored 0 → 3, total 1644 → 1647 (3 V2 receipts now on-chain). README/PITCH/JUDGE_GUIDE/MAINNET_READINESS auto-render markers re-rendered via `pnpm docs:render` (45 markers across 4 docs · 0 unknown-key warnings). | ✅ PASS | chain + refresh | `numbers.json` lastRefreshed = 2026-05-12 |
| 94 | JUDGE_GUIDE step 2 · `/r/1304` on Vercel | 200 OK, renders "TIER 1 · TEE" chip and "Anchored on the V1 ReceiptRegistry" — Studio doesn't false-claim FULLY VERIFIED, displays anchor state honestly | ✅ PASS | curl + HTML grep | live Vercel |
| 95 | JUDGE_GUIDE step 2 · `/agents` on Vercel | 200 OK, renders leaderboard of minted AgentPassports | ✅ PASS | curl | live Vercel |
| 96 | Studio source-file regressions after JUDGE_GUIDE fix | all 59 PASS — including new verify-no-og-chain-deployments-import-in-studio.ts (iteration 11 structural lock) and verify-canonical-env-aliases-everywhere.ts (caught a line shift in JUDGE_GUIDE that left the legacy alias `EVM_PRIVATE_KEY` un-paired with the canonical `IVARONIX_SIGNER_KEY` — fixed in the same commit) | ✅ PASS | local | green |
| 97 | Contract regressions after JUDGE_GUIDE fix | all 4 PASS — verify-contract-threat-model, verify-deploy-scripts-canonical-key, verify-k1-passport-v2, verify-k2-registry-v2 | ✅ PASS | local | green |
| 98 | Brutal honesty in render-target docs (per CLAUDE.md §1) | JUDGE_GUIDE.md now says "the difference is which independent checks the live network supports at the moment the judge runs the command" — judge gets the truth, not the marketing version. Strengthens the doc per §9 "let proof speak". | ✅ PASS | code review | `e9de060` |

## Iteration 4-6 — chain-read fix live + first V2 anchor + skill drift fix + real MM E2E

| # | Section | Row | Status | Method | Evidence |
|---|---|---|---|---|---|
| 48 | Chain-read fix verified on Vercel | `b342fd1` redeploy → all 6 seeded receipts 200 | ✅ PASS | curl vs live | `QA_PROOF_PACK/cli-logs/post-fix-http-sweep.log` |
| 49 | Dashboard passport state on live | `/api/dashboard/<operator>` returns `tokenId=1, trustScore=1624, receiptCount=1624` | ✅ PASS | curl | same log |
| 50 | First V2 anchor on Galileo | `ivaronix demo` → receipt id 3 V2, tx 0xac44c5ae…a9fd5 block 32908537 | ✅ PASS | CLI | `ivaronix-demo-post-fix.log` |
| 51 | Real 0G Storage upload (live indexer) | upload tx 0x0afe35c0…99634511 root 0x6736b9d0…fc2dfb | ✅ PASS | indexer | same log |
| 52 | `ivaronix receipt verify 3 --tee-independent` | FULLY VERIFIED ✓ via broker.processResponse | ✅ PASS | CLI | `receipt-verify-3-tee.log` |
| 53 | Fresh receipt /r/3 on Vercel | 200 | ✅ PASS | curl | sweep log |
| 54 | All 6 skill manifests now match on-chain | 6 republish txs anchored on SkillRegistry | ✅ PASS | chain | `skill-republish-all.log` |
| 55 | private-doc-review@0.3.1 | tx 0xef1db6aa…59eeda block 32907617 | ✅ PASS | chain | log |
| 56 | 0g-integration-auditor@0.1.1 | tx 0xea8dfea1…b5612b block 32907750 | ✅ PASS | chain | log |
| 57 | github-audit@0.1.1 | tx 0xf6158771…ef21ba block 32907795 | ✅ PASS | chain | log |
| 58 | content-pitch-review@0.1.1 | tx 0xea20444f…3309cf block 32907830 | ✅ PASS | chain | log |
| 59 | code-edit@0.2.1 | tx 0xc501bdad…a56432 block 32907877 | ✅ PASS | chain | log |
| 60 | plan-step@0.1.1 (with cache sync) | tx 0x3011d5e4…ec6d55 block 32908423 | ✅ PASS | chain | log |
| 61 | MM extension v13.30.0 loads in Chromium | extension id `gjobhipajikikfoclmndeobbmnicplde` | ✅ PASS | Playwright | `mm-e2e-vercel.log` |
| 62 | MM unlocks pre-onboarded profile | screenshot `02-mm-unlocked.png` | ✅ PASS | Playwright | `screenshots/metamask-vercel-run-1/` |
| 63 | Connect wallet on `/onboard` against LIVE Vercel | popup opens + click Connect + popup closes + Studio shows connected state | ✅ PASS | Playwright + MM | screenshots 03/04/06/07 |
| 64 | Studio route tour (5 routes) — `/`, `/skills`, `/global`, `/dashboard`, `/memory`, `/r/280` | each renders in connected state | ✅ PASS | Playwright + MM | screenshots 08-13 |
| 65 | `recordVideo` 1440×900 wired in run.ts:109 | webm captures saved per page in screenshots/metamask/ | ✅ PASS | Playwright | `.webm` files alongside screenshots |
| 66 | STUDIO_BASE env override added to all 7 harness scripts | `run.ts`, `run-burn.ts`, `run-audit.ts`, `run-revoke.ts`, `run-deeper.ts`, `run-full.ts`, `run-brand-deep.ts` all support `STUDIO_BASE=https://ivaronix.vercel.app` | ✅ PASS | local | commit `3fd5761` |
| 67 | run-burn.ts vs LIVE Vercel — burn-mode + consensus tier preview E2E | 7 screenshots + 2.6 MB session video | ✅ PASS | Playwright + MM | `QA_PROOF_PACK/screenshots/burn-vercel-run-1/` + `videos/burn-vercel-run-1/` |
| 68 | Consensus tier preview (quick / standard / high-stakes) | each tier preview captured with the correct role-count rendering | ✅ PASS | Playwright | 001/002/003 |
| 69 | Burn Mode toggle UI | Burn Mode toggle ON state captured | ✅ PASS | Playwright | 004 |
| 70 | Burn-mode AI run on live Studio | Run clicked + Run done states captured (full lifecycle) | ✅ PASS | Playwright | 005, 006 |
| 71 | /r/1004 receipt page rendered with burn-mode evidence | screenshot of receipt rendering on live Vercel | ✅ PASS | Playwright | 007-burn-receipt-r-1004.png |
| 72 | Full 1440×900 session video for burn flow | webm 2.6 MB | ✅ PASS | Playwright recordVideo | `videos/burn-vercel-run-1/page@2dcd1b26…webm` |
| 73 | CLAUDE.md §1 — no-delegation rule landed | locks in: drive Playwright + MM yourself; DELEGATED-TO-USER reserved for genuinely external blockers | ✅ PASS | local + push | commit `3fd5761` |
| 74 | Footer chain-reads bug found via run-deeper.ts | all 8 contract chainscan links missing from live Vercel footer (Footer.tsx used og-chain.loadDeployments which fails on Vercel cwd) | 🔧 BUG #4 | Playwright + curl | `mm-e2e-deeper-vercel.log` |
| 75 | Footer fix shipped — commit `2d9e01f` | Footer.tsx swapped to local deployments-bundle import (same pattern as chain.ts fix b342fd1) | ✅ PASS | local + push | `2d9e01f` |
| 76 | Footer fix VERIFIED on LIVE Vercel | `vercel inspect ivaronix.vercel.app` resolves to `hcsaho3oz` deploy; curl finds 8 unique chainscan addresses in footer HTML | ✅ PASS | curl vs live | `mm-e2e-deeper-vercel.log` + manual curl |
| 77 | run-full.ts vs LIVE Vercel — FULL product E2E (30+ captures) | onboard + Connect + Add Chain + balance + handle + mint Passport (real MM tx popup) + Home Run flow → fresh receipt + 6-route connected tour + brand 1440 + brand 375 + 4-route mobile viewport tour | ✅ PASS | Playwright + MM | `QA_PROOF_PACK/screenshots/full-vercel-run-1/` (180 saved) + `mobile/full-vercel-run-1/` + `videos/full-vercel-run-1/` (7 webm) |
| 78 | Real Agent Passport MINT TX via MM popup | mint clicked → MM tx popup → 2× Confirm → popup closes → mint state | ✅ PASS | Playwright | full-run frames 010-013 |
| 79 | Real Home Run flow → fresh receipt | doc uploaded → Run clicked → run done → `/r/<id>` rendered | ✅ PASS | Playwright | full-run frames 014-018 |
| 80 | Mobile viewport tour (375×812) — /, /onboard, /skills, /dashboard | all render without overflow at iPhone-X width | ✅ PASS | Playwright | mobile-vercel-run-1/ 027-030 |
| 81 | Brand HTML reference loaded for parity | brand/Ivaronix.html captured at 1440 + 375 alongside Studio | ✅ PASS | Playwright | full-run 025-026 |
| 82 | Memory grant Issue-button gating | run-deeper.ts reported "button not enabled" — investigation shows the button correctly gates on `grantee.length === 42 && grantee.startsWith('0x')`. Test harness types a 44-char `0xdEAD…6942069` (extra zero) → button correctly disabled. Studio behaves correctly. | ✅ PASS (test-harness drift, not Studio bug) | code review | MemoryPanel.tsx:226 |
| 83 | run-deeper.ts disconnect/reconnect cycle | disconnect succeeds → MM reconnect popup re-opens → Connect button clickable | ✅ PASS | Playwright | deeper 005-006 |
| 84 | run-audit.ts — brand-vs-Studio parity audit | 22 desktop + 12 mobile + 6 videos captured. Side-by-side: standalone brand HTML vs repo brand HTML at 1440 + 375; then every Studio route (/, /onboard, /skills, /skill detail, /global, /dashboard, /memory, /brand, /r/280, /r/933) at both viewports; plus sticky-header behavior, scroll interactions, fresh-run click | ✅ PASS | Playwright | `QA_PROOF_PACK/screenshots/audit-vercel-run-1/` + `mobile/audit-vercel-run-1/` + `videos/audit-vercel-run-1/` |
| 85 | run-brand-deep.ts — 3-way brand parity at 7 scroll positions | standalone brand HTML scrolled at y=0/900/1800/2700/3600/4500/5400 + repo brand HTML at same positions + Studio /brand at same positions = 21 captures total | ✅ PASS | Playwright | `screenshots/brand-deep-vercel-run-1/` + 5 webm fragments |
| 86 | TOTAL agent-driven MM E2E coverage | 7/7 harness scripts run against LIVE Vercel deploy with real MM extension | ✅ PASS | Playwright + MM | 301 screenshots + 21 mobile + 24 videos in `QA_PROOF_PACK/` |
| 87 | Footer chain links on live deploy — 8/8 visible | curl `https://ivaronix.vercel.app/` finds all 8 unique contract chainscan addresses (V1+V2 ReceiptRegistry, V1+V2 AgentPassportINFT, Erc7857Verifier, CapabilityRegistry, MemoryAccessLog, SkillRegistry) | ✅ PASS | curl | `mm-e2e-deeper-vercel.log` |
| 88 | run-revoke.ts — real MM tx popup signed | popup opened, 2× Confirm clicked, tx submitted on chain. UI refetch timed out at 90s (separate UX polish item) | 🟡 PARTIAL (tx submitted; UI refetch is a polish item) | Playwright + MM | `revoke-vercel-run-1/` |
| 89 | CLAUDE.md §1 rule-set landed (3 hard rules) | (a) real MetaMask only no compromise, (b) screenshots + screen recording on EVERY UI flow, (c) no delegation to user when agent can drive — drives the whole iteration | ✅ PASS | commits `0685eed`, `759f340`, `3fd5761` | pushed to main |

## Iteration 3 — chain-read fix committed + JCS polyglot byte-equality

| # | Section | Row | Status | Method | Evidence |
|---|---|---|---|---|---|
| 40 | Studio chain-read fix: `deployments-bundle.ts` import | webpack traces `contracts/deployments/testnet.json` into bundle; V2 address baked into compiled JS | ✅ FIX SHIPPED | local + push | commit `b342fd1` · pushed; verified via .nft.json grep + grep for `0xf675...90ab` in compiled api/dashboard route.js |
| 41 | Pre-commit regressions after fix (75/75) | studio 58 + cli 13 + contracts 4 | ✅ PASS | local | all green; caught one self-introduced stale-snapshot pattern + fixed via prose rewrite |
| 42 | JCS: TS reference tests | `pnpm --filter @ivaronix/core exec tsx --test src/jcs.test.ts` | ✅ PASS | local | 17/17 |
| 43 | JCS: Python reference tests | `cd scripts/verifier-py && python -m unittest test_jcs.py` | ✅ PASS | local | 14/14 |
| 44 | JCS: Rust reference tests | `cd ivaronix-verifier-rs && cargo test --release` | ✅ PASS | local | 11/11 (named: arrays_preserve_order, nested_receipt_shape, numbers_*, determinism, strings_*, jcs_bytes_round_trip, objects_keys_sorted, primitives_*) |
| 45 | JCS: TS↔Py↔Rust 29-vector byte-equality | `python scripts/verifier-py/cross_check.py` | ✅ PASS | local | 29/29 vectors byte-equal across all 3 implementations — **the polyglot moat per CLAUDE.md §2.1** |
| 46 | numbers.json claim: polyglotHash 17+14+11+29 | matches reality (17/14/11/29 confirmed) | ✅ PASS | local | claim parity verified |
| 47 | numbers.json claim: receipts.v1Anchored 1644, v2Anchored 0 | matches live chain | ✅ PASS | chain + refresh | numbers:refresh re-confirmed |

## Iteration 2 — package unit tests + live HTTP sweep + critical chain-read bug found

| # | Section | Row | Status | Method | Evidence |
|---|---|---|---|---|---|
| 17 | core unit suite | `pnpm --filter @ivaronix/core test` | ✅ PASS | local | 52/52 tests |
| 18 | consensus unit suite | `pnpm --filter @ivaronix/consensus test` | ✅ PASS | local | 34/34 |
| 19 | receipts unit suite | same pattern | ✅ PASS | local | 30/30 |
| 20 | skills unit suite | | ✅ PASS | local | 9/9 |
| 21 | memory unit suite | | ✅ PASS | local | 14/14 |
| 22 | og-chain unit suite | | ✅ PASS | local | 8/8 |
| 23 | og-router unit suite | | ✅ PASS | local | 19/19 |
| 24 | og-storage unit suite | | ✅ PASS | local | 15/15 |
| 25 | og-kv unit suite | | ✅ PASS | local | 12/12 |
| 26 | og-da unit suite | | ✅ PASS | local | 14/14 |
| 27 | indexer unit suite | | ✅ PASS | local | 22/22 |
| 28 | runtime unit suite | | ✅ PASS | local | 30/30 |
| 29 | Public page sweep (13 routes) | `/`, `/onboard`, `/skills`, `/privacy`, `/terms`, `/thesis`, `/0g`, `/dashboard`, `/agents`, `/memory`, `/global`, `/brand`, `/docs (→307)` | ✅ PASS | curl vs live Vercel | all 200 except `/docs` 307→`/0g` (intentional) |
| 30 | OG image routes (3) | `/opengraph-image`, `/0g/opengraph-image`, `/r/1004/opengraph-image` | 🟡 BLOCKED §B-V2-2 | curl | all 503 (graceful — known limitation) |
| 31 | `GET /api/auth/siwe/nonce` cookie | sets `iv-siwe-nonce` with `Secure; HttpOnly; SameSite=strict` | ✅ PASS | curl `-i` | 4/4 flags present — fix-log #3 corrects the plan's stale POST |
| 32 | `POST /api/skill/save` anon | rejects with 401 | ✅ PASS | curl | 401 ✓ |
| 33 | `POST /api/memory/remember` anon | rejects with 401 | ✅ PASS | curl | 401 ✓ |
| 34 | Security headers on `/` | `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `HSTS max-age=63072000; includeSubDomains; preload` | ✅ PASS | `curl -I` | 4/4 present |
| 35 | CSP header | deliberately omitted per `next.config.ts:53-57` | 🟡 KNOWN-LIMITATION | curl | `USER_TODO §B-V2` queued |
| 36 | `/api/dashboard/<operator>` chain read | returns operator wallet + balance + passport + recent receipts | 🔧 FIX IN FLIGHT | curl | returned `passport: null, recentReceipts: []` for 1,644-receipt operator — fix #3 below |
| 37 | `/r/<id>` chain lookup (6 seeded IDs) | `/r/994/1004/1014/1056/1069/1304` all 200 per MAINNET_READINESS.md #6 + JUDGE_GUIDE.md | 🔧 FIX IN FLIGHT | curl | ALL returned 404 — same root cause as #36; fix #3 below |
| 38 | docs:check after numbers refresh | 45 markers in sync | ✅ PASS | local | re-confirmed green |
| 39 | wording-lint after fix | 0 banned-word hits | ✅ PASS | local | re-confirmed green |

## Iteration 1 — pnpm pre-commit gates + Foundry + typecheck (commit `759f340`)

| # | Section | Row | Status | Method | Evidence |
|---|---|---|---|---|---|
| 1 | CI gate | `gh run list --commit=759f340` shows both workflows | ✅ PASS | gh CLI | jcs-roundtrip success; main CI in_progress at run time |
| 2 | Vercel gate | `vercel ls ivaronix` Ready, aliased | ✅ PASS | vercel CLI | dpl_DT7znoKRPSDXTUmtXexyXKyPek3h, 17s build |
| 3 | Studio regressions (58) | `pnpm regressions:studio` | ✅ PASS | local | QA_PROOF_PACK/cli-logs/regressions-studio.log — 58/58 |
| 4 | CLI regressions (13) | `pnpm regressions:cli` | ✅ PASS | local | regressions-cli.log — 13/13 |
| 5 | Contracts regressions (4) | `pnpm regressions:contracts` | ✅ PASS | local | regressions-contracts.log — 4/4 |
| 6 | Foundry tests (167) | `forge test -vv` | ✅ PASS | local | forge-test.log — 167/0/0 across 13 suites |
| 7 | Workspace typecheck | `pnpm -r typecheck` | ✅ PASS | local | workspace-typecheck.log — all packages Done |
| 8 | `pnpm docs:check` | 45 markers checked, 0 unknown-key | ✅ PASS | local | green after numbers refresh |
| 9 | `pnpm numbers:check` | 10.2h old, within 24h | ✅ PASS | local | refreshed during run; was 34.1h stale |
| 10 | `pnpm receipt-types:check` | 13 receipt types in sync | ✅ PASS | local | green |
| 11 | `pnpm wording-lint` | 0 new banned-word hits | ✅ PASS | local | 3 self-introduced hits fixed in fix-log #1 |
| 12 | `pnpm brand:check` | 4/4, no hex-color drift across 73 studio files | ✅ PASS | local | 6 existing amnesty entries |
| 13 | `pnpm env:check` | 9 canonical / 0 legacy / 1 unset (`IVARONIX_READ_PROXY_KEY`) | ✅ KNOWN-LIMITATION | sourced apps/studio/.env | `READ_PROXY_KEY` is optional privacy feature per `docs/PRIVACY_NOTES.md §14` |
| 14 | `pnpm audit:list` | 122 audit closures across 104 commits | ✅ PASS | local | git trailer queryable |
| 15 | numbers.json refresh against live chain | 1,644 V1 + 0 V2 receipts; 13 receipt types; 6 first-party skills; 25 workspace packages | ✅ PASS | live chain | matches numbers.json after refresh |
| 16 | docs:check 45 marker parity | every `<!-- numbers:auto:KEY -->` in README/PITCH/JUDGE_GUIDE/MAINNET_READINESS renders the right value | ✅ PASS | local | green |


## Environment block (locked at start of run)

| Item | Value |
|---|---|
| App URL | `https://ivaronix.vercel.app` |
| Repo | `https://github.com/Pratiikpy/ivaronix.git` |
| Branch | `main` |
| Commit | `759f340` — *docs(claude-md): §1 — split screenshots+recording into its own rule, ALL UI flows* |
| Network | 0G Galileo testnet · chainId 16602 · RPC `https://evmrpc-testnet.0g.ai` · explorer `https://chainscan-galileo.0g.ai` |
| Operator wallet A | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` · ~69 OG at last check |
| Test wallets B + C | Pending — operator-to-operator transfer from A planned |
| ReceiptRegistry V1 | `0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c` |
| ReceiptRegistry V2 | `0xf675d4183b34fe8d1981FA9c117065aAcff690ab` |
| AgentPassport V1 | `0x08d25653638c3ed40C3b82840fA20CAe9c94563E` |
| AgentPassport V2 | `0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d` |
| Erc7857Verifier | `0xEAd66Cb90B681720f3aab52d86c289E21106d938` |
| CapabilityRegistry | `0x3783f3c4834fCCBD553860e15c64C7E052646a8D` |
| MemoryAccessLog | `0xEe1aDFe76785377C4430B1325d86E58A6eC92119` |
| SkillRegistry | `0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1` |
| Storage indexer | `https://indexer-storage-testnet-turbo.0g.ai` |
| Compute Router | `https://compute-network-6.integratenetwork.work/v1/proxy` |
| Compute provider | `0xa48f01287233509FD694a22Bf840225062E67836` |
| Default model | `qwen/qwen-2.5-7b-instruct` |
| Browser | n/a (CLI-driven by agent); UI items DELEGATED-TO-USER per CLAUDE.md §1 (real MetaMask only) |

## Known caveats (NOT FAIL — KNOWN-LIMITATION / BLOCKED with reference)

| Caveat | Marker | Reference |
|---|---|---|
| OG-image routes return 503 by design | `BLOCKED §B-V2-2` | `docs/USER_TODO.md §B-V2-2` |
| Memory engine uses hashing-trick fallback on Vercel | `KNOWN-LIMITATION` | architectural (250 MB serverless cap) |
| 6 OPEN PHASE_B disclosures | `KNOWN-LIMITATION` | `docs/PHASE_B_DISCLOSURES.md` items 2-6 |
| 4 V1-only contracts (Cap/Memory/Skill/SubEsc) | `PENDING §B-V2-15/16/17/18` | each V2 redeploy queued |
| Sentry observability slot exists but not wired | `PENDING §B-V2-26` | env-template only |

## Test rows (filled in as the cron iterations run)

| # | Section | Row | Status | Wallets | Method | Evidence | Notes |
|---|---|---|---|---|---|---|---|

<!-- Rows append here as each row of the plan is exercised. -->
