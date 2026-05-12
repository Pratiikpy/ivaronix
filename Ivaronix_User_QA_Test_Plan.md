# Ivaronix User QA Test Plan

## Purpose

This document is for a QA tester or normal user who needs to verify Ivaronix before launch.

The goal is simple:

> Use every important feature like a real user, confirm it works end to end, and collect proof.

Do not only check that buttons exist. Click them, run the flow, wait for the result, verify the receipt, and record what happened.

## Functional Launch Goal

The goal of this QA plan is to make Ivaronix **functionally ready to launch**.

That means:

- every user-visible feature works end to end
- every important CLI command works as expected
- every result is useful, not generic or fake
- every receipt/proof claim is verifiable
- every wallet/chain action is real or honestly marked pending
- every private-data promise is tested for leaks
- every error/loading/empty state helps the user continue
- every fix is retested with evidence
- every launch-critical issue is either fixed or honestly documented

Do not treat QA as a checklist for clicks.

Treat QA as the final proof that the product can be used by real users, judges, and reviewers without hidden broken flows.

## Non-Compromise Standard

This is the standard for the whole QA process:

> No compromise, no shortcuts, no fake green, no half-tested feature, no "probably works."

Every feature must end in one of four honest states:

| State | Meaning |
|---|---|
| `PASS` | Tested with the strongest available method and evidence exists. |
| `FAIL` | Tested and broken; root cause or next debug step is written down. |
| `PENDING` | Not finished yet; exact remaining work is written down. |
| `BLOCKED` | Truly external blocker exists and proof/reason is written down. |

Anything else is not accepted.

Do not reduce the test quality because a flow is hard, slow, boring, or annoying.

If a feature matters to users, judges, receipts, privacy, wallet flow, payments, 0G proof, or launch readiness, it must be tested properly.

## Real Human Testing Mandate

All launch-critical testing must be done the way a real user would experience it.

No compromise.

| Rule | Meaning |
|---|---|
| Real wallet extension first | If a wallet flow exists, test it with the real MetaMask/browser wallet extension. |
| Real browser first | UI must be tested in an actual browser, not only by DOM checks or component tests. |
| Real clicks and typing | Use real clicks, keyboard input, file upload, popups, and navigation. |
| Real network state | Test correct network, wrong network, switch network, and refresh/reconnect behavior. |
| Real signatures | Sign and reject real wallet prompts where the feature requires it. |
| Real transactions | If a feature claims tx/on-chain proof, test the actual transaction path. |
| Real proof opening | Open proof links in a fresh browser/incognito session. |
| Real mobile viewport | Test mobile-visible flows in mobile viewport; do not infer from desktop. |
| Real terminal flow | CLI/TUI features must be tested in a real terminal when possible. |
| Real multi-wallet roles | If the feature needs 2 or 3 wallets, set up and test those roles properly. |
| Mock only as last resort | Mocks/shims are allowed only when real testing is impossible, and must be labeled as weaker evidence. |
| No downgrade because it is hard | Large or painful flows must still be tested correctly if they are launch-critical. |

If a real-user method is possible, do not replace it with a weaker method.

## Visible UI Element Sweep

Every visible UI element must be tested like a real human is exploring the product.

This includes:

- hero section
- hero CTA buttons
- navigation links
- header actions
- footer links
- cards
- card buttons
- tabs
- filters
- dropdowns
- modals
- forms
- inputs
- upload controls
- toggles
- checkboxes
- sliders
- copy buttons
- share buttons
- verify buttons
- connect wallet buttons
- disconnect buttons
- run buttons
- receipt links
- explorer links
- empty states
- loading states
- error states
- success states
- mobile menu
- tooltips
- any visible feature section on any page

Testing standard:

| UI Element | What To Verify |
|---|---|
| Button/CTA | Click it and confirm it does the correct thing. |
| Link | Open it and confirm destination is correct. |
| Form/input | Type real input, submit, validate success/error state. |
| Upload | Upload a real test file and confirm the app processes it. |
| Toggle/checkbox | Turn it on/off and confirm behavior changes correctly. |
| Tab/filter | Change it and confirm content updates correctly. |
| Modal | Open, interact, close, and test keyboard/escape behavior if possible. |
| Tooltip/help text | Hover/focus and confirm it explains the control. |
| Empty state | Confirm it tells the user what to do next. |
| Loading state | Confirm it appears during slow actions and does not feel frozen. |
| Error state | Confirm it explains what failed and how to continue. |
| Success state | Confirm it shows the real result/proof, not fake success. |

No visible user-facing element should remain untested.

No hold back.

If a user can see it, click it, read it, type into it, upload through it, or make a decision from it, QA must test it.

## Testing Rules

| Rule | What to do |
|---|---|
| Test like a user | Use the browser, mouse, keyboard, MetaMask, terminal, and real app screens. |
| Capture proof | Save screenshots, videos, receipt links, ChainScan links, and CLI output. |
| Test desktop and mobile | Use at least desktop `1440x900` and mobile `375x812` (locked in CLAUDE.md §10 — iPhone X/SE width). |
| Use real wallet flows | For wallet actions, use MetaMask and approve/reject popups like a real user. |
| Do not fake green | If something is pending, blocked, or future, mark it honestly. |
| Check smoothness | Watch loading states, page transitions, error states, button feedback, and broken layouts. |
| Verify public proof | Open proof links in a fresh browser or incognito window where possible. |
| Check claims | If UI says Chain, Storage, Compute, TEE, Passport, or Receipt, verify the proof behind it. |

## QA Mindset

Read this before testing.

| Mindset | Meaning |
|---|---|
| Test full flows, not isolated clicks | Start from the first user action and finish at the final proof/result. |
| Prove outcomes, not clicks | A button working is not enough; the final answer/proof must be useful and correct. |
| No receipt means no claim | If an action claims proof, there must be a real receipt or clear pending state. |
| No green without evidence | Do not mark Chain, Storage, Compute, TEE, Passport, or Memory green without proof. |
| Bad paths matter too | Rejected wallet, wrong network, failed tx, bad receipt, and missing keys must be tested. |
| Private data must stay private | Public receipt/proof pages must not leak private files, prompts, or secret phrases. |
| UI and CLI must agree | The same receipt, passport, memory, model, and tier data must match in UI and CLI. |
| Mobile is not optional | Main flows must work on mobile viewport without broken layout or hidden actions. |
| Watch videos, not only screenshots | Smoothness, confusion, loading, and transitions are easier to catch in recordings. |
| Every button needs purpose | If a user can click it, it must either work, explain itself, or be removed. |
| Every error needs next step | Error messages must tell the user what happened and how to continue. |
| Every proof link must open fresh | Public proof should work in a fresh browser without special local state. |
| If it feels confusing, it failed | A feature can technically work and still fail UX. Mark it honestly. |
| If it works once only, retest | Re-run core flows after refresh, disconnect, or new session. |
| If blocked, prove why | Mark blocked only after trying the strongest available method. |
| Use the best available test method | Do not use a weaker test if a stronger realistic method is possible. |
| Function first, polish always | The feature must work, and visible user surfaces must feel finished. |
| No half-baked anything | No half-baked build, feature, UI, proof, docs, testing, or launch status. |

## Best Available Test Method

For every feature, use the strongest realistic testing method available.

Do not use a weaker method if a stronger one is possible.

| Situation | Correct Testing Standard |
|---|---|
| UI can be tested with real MetaMask | Do not only mock wallet. Use real extension, real popup, real connect/sign/tx flow. |
| Flow can be recorded on video | Do not only take screenshots. Record the full user journey. |
| Receipt can be verified by CLI | Do not only look at UI. Run CLI verification too. |
| Tx can be opened on explorer | Do not only trust app status. Open ChainScan/explorer link. |
| Feature needs 2 wallets | Do not test with 1 wallet. Use owner + second wallet. |
| Marketplace/payment needs 3 wallets | Do not shortcut it. Use creator + buyer + treasury/admin wallet. |
| TUI can be tested in real terminal | Do not only unit-test logic. Use real terminal keyboard flow. |
| Telegram cannot be live-tested | Test backend handlers deeply, then mark live phone/BotFather test separately. |
| Mobile can be tested with viewport | Do not assume desktop means mobile works. Capture mobile evidence. |
| Public proof can be opened fresh | Do not only test while logged in. Open incognito/fresh browser. |

## Evidence Hierarchy

When choosing evidence, prefer stronger proof.

```text
Real user flow video
> screenshot
> CLI output
> logs
> code inspection
```

Code inspection is last, not first.

Use code inspection only when a real user test is impossible or to explain why a failure happens.

## Persistence Rule

The goal is to finish the work, not stop at the first error.

Do not mark something blocked just because it failed once.

Debug, isolate the cause, retry with the next strongest method, and only mark blocked when the blocker is truly external.

| If This Happens | What To Do |
|---|---|
| Playwright fails | Try fixing selector/timing, then try real browser/extension flow if available. |
| MetaMask popup fails | Check extension state, network, wallet unlock, permissions, and retry. |
| UI flow fails | Check API/backend/CLI path to isolate whether UI or backend is broken. |
| CLI command fails | Check config, env, provider key, wallet, chain, working directory, and logs. |
| Compute rate-limits | Retry later, try configured fallback only if receipt labels stay honest. |
| Chain tx fails | Check network, gas, nonce, wallet funds, contract address, and explorer state. |
| Receipt verify fails | Compare receipt hash, tx hash, contract, tier, and local canonical hash. |
| Storage proof missing | Confirm whether storage root should exist; if not wired, mark pending honestly. |
| Telegram cannot be live-tested | Test backend handlers fully and mark phone/BotFather test separately. |
| Feature needs multiple wallets | Set up the required wallets instead of downgrading the test. |
| One path works | Still test refresh, failure path, mobile, and UI/CLI agreement. |

Blocked means truly external.

Examples of real blockers:

- missing real phone
- missing BotFather token
- missing paid quota
- missing mainnet funds
- unavailable third-party service
- unavailable macOS/Linux machine for cross-OS test

Anything else should be investigated before calling it blocked.

## Blocker Protocol

Before stopping on any blocker, follow this loop.

Do not jump straight to "blocked."

| Step | What To Do |
|---|---|
| 1. Understand the failure | Write what failed, where it failed, and what the expected behavior was. |
| 2. Think theoretically | List possible causes and possible solutions before touching code again. |
| 3. Pick the strongest route | Choose the solution most likely to prove the feature end to end. |
| 4. Try practically | Run the test or fix in the real environment, not only by reading code. |
| 5. Capture result | Save output, screenshot, video, tx, receipt, or error log. |
| 6. Repeat if needed | If it fails again, use what you learned and try a better route. |

Minimum standard before marking `BLOCKED`:

```text
Think 3 times.
Try 3 serious methods.
Only then mark blocked if the remaining issue is truly external.
```

Examples of serious methods:

- Playwright real browser flow
- real MetaMask extension flow
- direct backend/API test
- CLI command test
- mocked external client only when live external access is impossible
- code-level protocol test
- explorer/ChainScan verification
- fresh browser/incognito proof test
- multi-wallet test when permissions/payments require it

When writing a blocked item, include:

| Required Field | Meaning |
|---|---|
| Failure | What failed exactly. |
| Expected behavior | What should have happened. |
| Tried methods | The 3 serious methods attempted. |
| Evidence | Logs, screenshots, videos, tx links, or CLI output. |
| Real blocker | The truly external thing missing. |
| Unblock action | What the user/team must provide next. |

Do not mark `BLOCKED` if the next step is only "try harder", "debug more", "use another test method", or "set up the required wallet/tool."

## Working Files Rule

During QA and fixing, maintain separate files so progress, fixes, and real user blockers do not get mixed.

| File | Purpose |
|---|---|
| `QA_TEST_PROGRESS.md` | Tracks every feature test, current status, evidence links, screenshots, videos, receipts, tx links, and next step. |
| `QA_FIX_LOG.md` | Tracks every bug/fix with expected behavior, root cause, fix plan, files changed, retest proof, and remaining risk. |
| `docs/USER_TODO.md` | Only for things that are 100% external and cannot be solved theoretically or practically by the agent. |

### `QA_TEST_PROGRESS.md` Must Include

**Top of the file: running tally** (update after every test):

```
# QA Test Progress · ivaronix.vercel.app · commit <sha>
PASS:    XX / 60+
FAIL:    XX
PENDING: XX
BLOCKED: XX (with §B-V2-2, §A-2 etc. references)
Last updated: YYYY-MM-DD HH:MM
```

**Per-row fields:**

| Field | Meaning |
|---|---|
| Feature/flow | What is being tested. |
| Status | `PASS`, `FAIL`, `PENDING`, or `BLOCKED`. |
| Wallet count | 0, 1, 2, or 3 wallets. |
| Test method | Real browser, MetaMask, CLI, API, backend harness, etc. |
| Evidence | Screenshot/video/receipt/tx/CLI output path or link inside `QA_PROOF_PACK/`. |
| Outcome quality | Whether the result was actually useful and correct. |
| Cross-check | UI ↔ CLI ↔ chainscan all-three-agree confirmation (where applicable). |
| Next step | What must happen next. |

### `QA_FIX_LOG.md` Must Include

| Field | Meaning |
|---|---|
| Issue | What was broken. |
| Expected behavior | What should happen. |
| Root cause | Why it broke. |
| Fix plan | How it will be fixed. |
| Files changed | Exact files touched. |
| Tests run | Commands and user flows rerun. |
| Evidence | Proof that the fix works. |
| Regression check | Nearby flows checked after fix. |
| Remaining risk | Anything still weak or pending. |
| Status | `PASS`, `FAIL`, `PENDING`, or `BLOCKED`. |

### `docs/USER_TODO.md` Rule

Only put something in `docs/USER_TODO.md` when it is truly external.

Examples:

- real BotFather token
- real phone/Telegram account
- missing paid quota
- mainnet funds
- hardware or OS not available here
- account permission only user can approve

Do not put normal debugging work in user TODO.

If there is any theoretical or practical solution the agent can still try, it must stay in `QA_TEST_PROGRESS.md` or `QA_FIX_LOG.md`, not `docs/USER_TODO.md`.

## Proof Folder Rule

Before testing starts, create this folder:

```text
QA_PROOF_PACK/
```

Required structure:

```text
QA_PROOF_PACK/
  screenshots/
  videos/
  receipts/
  tx-links/
  cli-logs/
  failure-flows/
  mobile/
  fix-proof/
  notes/
```

Every evidence artifact must be saved inside this folder and linked from `QA_TEST_PROGRESS.md` or `QA_FIX_LOG.md`.

| Folder | What Goes Here |
|---|---|
| `screenshots/` | Desktop screenshots for normal flows. |
| `videos/` | Full user journey recordings. |
| `receipts/` | Receipt IDs, proof URLs, receipt screenshots, receipt JSON if exported. |
| `tx-links/` | ChainScan/explorer links and notes. |
| `cli-logs/` | CLI command outputs and terminal recordings. |
| `failure-flows/` | Rejected wallet, wrong network, bad receipt, failed tx, missing key, rate-limit evidence. |
| `mobile/` | Mobile viewport screenshots and videos. |
| `fix-proof/` | Before/after screenshots, videos, CLI output, and regression proof after fixes. |
| `notes/` | Tester notes, confusion log, outcome-quality notes, known limitations. |

Evidence rule:

> If evidence is not saved and linked, the test is not complete.

## Test Environment Setup

Before running QA, record the exact environment.

| Item | What To Record |
|---|---|
| App URL | `https://ivaronix.vercel.app` (current Vercel production). For preview deploys, record the `*.vercel.app` URL. |
| Git commit | Exact commit hash being tested (verify `vercel ls ivaronix` shows it tied to `● Ready` production). |
| Branch | Branch name (`main` for production). |
| CI status | Both GitHub workflows (`CI` + `jcs-roundtrip`) must be `● success` on the tested commit. Check `gh run list --commit=<sha>`. |
| Browser | Browser name and version. |
| Wallet | MetaMask version + each test wallet address + role (A=Owner, B=Grantee, C=Treasury). |
| Network | 0G Galileo testnet · chainId 16602 · RPC `https://evmrpc-testnet.0g.ai` · explorer `https://chainscan-galileo.0g.ai`. |
| Contracts | Read from `contracts/deployments/testnet.json`. Known V2 addresses: `ReceiptRegistryV2 0xf675d4183b34fe8d1981FA9c117065aAcff690ab`, `AgentPassportINFTV2 0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d`. |
| Operator wallet | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` (Galileo, funded ~69 OG at last check). |
| Faucet | Galileo faucet → fund Wallet B/C from `https://faucet.0g.ai/`. Confirm balance via `/api/dashboard/<addr>`. |
| Storage indexer | `https://indexer-storage-testnet-turbo.0g.ai` (live testnet endpoint — every `/api/run` anchor uploads to this). |
| Official 0G SDK lineage | Confirm `packages/og-storage/` uses `@0gfoundation/0g-ts-sdk` (the official 0G TS SDK — cross-reference `oglabs resources/0g-storage-ts-sdk/`). Compute via `openai` SDK + custom `baseURL` at `compute-network-*.integratenetwork.work` (third-party Router fronting 0G Compute). No forks, no hand-rolled storage. |
| 8 deployed contracts | Read all from `contracts/deployments/testnet.json`. **Live on Galileo:** `ReceiptRegistry` (V1, legacy), `ReceiptRegistryV2` (0xf675...90ab), `Erc7857Verifier` (0xEAd6...d938), `AgentPassportINFT` (V1), `AgentPassportINFTV2` (0x85e9...494d), `CapabilityRegistry` (0x3783...6a8D), `MemoryAccessLog`, `SkillRegistry`. Every chainscan link must open. V2 redeploys for the last 4 queued in `§B-V2-15/16/17/18` — test against V1 today; mark V2-of-each as `PENDING` until deployed. |
| API keys | Only record whether present/missing, never the secret value. |
| Compute provider | 0G Router/Private Compute (default TIER 1), NVIDIA NIM (TIER 2 fallback). |
| Storage mode | Real 0G Storage (wired into `/api/run` end-to-end since commit `7b1addc`). |
| Test data | Golden files (see § Golden Test Files) + seeded receipt IDs for proof-page verification: try IDs `#994`, `#1004`, `#1056`, `#1069` (all FULLY VERIFIED ✓) and the V1 fixture at `tests/fixtures/anchored-receipts/v1-anchored-id-8.json`. |

### Known caveats baked into the deploy (skip-the-rabbit-hole list)

| Caveat | Reality | Tester should |
|---|---|---|
| OG-image routes (`/opengraph-image`, `/0g/opengraph-image`, `/r/[id]/opengraph-image`) | Return HTTP **503 "OG image unavailable"** by design — `next/og` font-asset resolution fails on Vercel's Next 15.5 server bundle. Logged in `docs/USER_TODO.md §B-V2-2`. | Mark `BLOCKED` with reference to §B-V2-2; do not waste cycles debugging. Social-card unfurl shows no preview; this blocks no user feature. |
| Memory engine MiniLM embedder on Vercel | `IVARONIX_MEMORY_EMBEDDER=fallback` → memory uses the hashing-trick TF-IDF embedder, not MiniLM. By design (250 MB serverless cap + sharp/onnxruntime native deps). | Test memory recall accuracy with this in mind; record results as the *deployed* embedder, not as MiniLM. |

Add this environment block at the top of `QA_TEST_PROGRESS.md`.

## Secrets And Privacy Rule

Never leak secrets while collecting proof.

| Risk | Rule |
|---|---|
| API keys | Redact keys from screenshots, videos, CLI logs, and docs. |
| Private keys/seed phrase | Never show or store them in QA evidence. |
| Wallet popup | Screenshots are allowed, but seed phrase/private key screens are not. |
| Private documents | Public proof pages must not expose original file content. |
| Golden secret phrase | Use `PRIVATE_TEST_PHRASE_DO_NOT_LEAK` to verify no public leak. |
| Logs | Logs must not contain full secrets, private document text, or raw auth tokens. |
| Shared proof pack | Make sure the proof pack can be shared safely with judges/users. |

If evidence accidentally includes a secret, mark the test failed and regenerate clean evidence.

## Browser And Accessibility Basics

Production QA should include basic browser and accessibility checks.

| Check | Pass Condition |
|---|---|
| Chromium desktop | Main flows work. |
| Firefox desktop | Public pages and proof pages work. |
| Mobile viewport | Main flows do not overlap or hide actions. |
| Keyboard navigation | Main CTAs, dialogs, forms, and close buttons are reachable by keyboard. |
| Focus states | User can see where keyboard focus is. |
| Color contrast | Important text and status chips are readable. |
| Form labels | Inputs have clear labels or placeholders. |
| Modal/dialog close | Popups can be closed without trapping the user. |
| Error readability | Error messages are visible and understandable. |

Do not overdo accessibility testing at this stage, but do not ignore obvious blockers.

## Performance And Reliability Budgets

Slow AI/chain actions are acceptable only if the app communicates clearly.

| Flow | Expected Standard |
|---|---|
| Public page load | Should feel quick and not show broken layout while loading. |
| Wallet connect | User sees clear state changes and no duplicate prompts. |
| AI run | Progress/loading is visible; user knows the run is still alive. |
| Chain tx | Pending state is visible until confirmed/failed. |
| Receipt page | Opens quickly enough to share confidently. |
| CLI command | Prints progress for slow actions. |
| Rate limit | Shows provider/rate-limit issue honestly and suggests retry. |
| Refresh during pending run | App recovers or explains status clearly. |

If a flow takes too long, it can still pass only if the user never feels the app is frozen.

### Hard Budgets (measure + record in proof pack)

| Budget | Target | How to measure |
|---|---|---|
| `/` first-load JS | ≤ 110 KB (current build shows 102 KB shared + per-page) | Read `next build` output for the route table. |
| Lighthouse Performance score | ≥ 85 on `/r/<id>` and `/` (desktop) | Run Lighthouse from Chrome DevTools at `1440×900`. |
| Lighthouse Performance score | ≥ 75 on mobile (`375×812`) | Lighthouse mobile preset. |
| Core Web Vitals — LCP | < 2.5s on `/r/<id>` (cold cache) | Lighthouse / PageSpeed Insights. |
| Core Web Vitals — CLS | < 0.1 across `/`, `/onboard`, `/r/<id>`, `/skills` | Lighthouse. |
| Core Web Vitals — INP | < 200 ms on the Run button | Lighthouse / Chrome user-flow. |
| npx-cli bundle | ≤ 10 MB (current: 8 MB) | `ls -lh apps/npx-cli/dist/ivaronix.mjs`. |
| Vercel serverless function | ≤ 250 MB uncompressed (HARD CAP — bigger = deploy rejected) | Vercel build log "Large Dependencies" section. Current `api/run` ~23 MB after the webpack-cache trim. |
| `/api/run` p50 latency on a cached doc-ask | < 8s | Run 5 doc-asks, capture timings. |
| `/api/run` p95 latency on a fresh doc-ask | < 45s (well under the 60s `maxDuration` hobby cap) | Same. |
| Chain anchor confirmation (Galileo) | < 6s after tx broadcast (block time ~3s) | Time from `tx.wait()` start to receipt. |
| Storage upload (≤ 1 MB blob) | < 5s round-trip to `indexer-storage-testnet-turbo.0g.ai` | Time the upload step in run logs. |
| Receipt verify (cold) on a fresh machine | < 90s including `pnpm install` per JUDGE_GUIDE step 1 | Stopwatch the JUDGE_GUIDE reproducer. |

Save each measurement in `QA_PROOF_PACK/notes/performance-budgets.md` so the submission can claim numbers backed by evidence.

## Accessibility (WCAG-relevant basics)

Production UI should satisfy minimum WCAG 2.1 AA on the routes a judge or user lands on first.

| Check | Target | How |
|---|---|---|
| Color contrast (text on background) | ≥ 4.5:1 for body, ≥ 3:1 for large text | DevTools Accessibility tab or axe DevTools on `/`, `/onboard`, `/r/<id>`. |
| Keyboard-only flow | Connect wallet → run → view receipt achievable without mouse | Tab through `/` end-to-end; confirm focus visible at every step. |
| Focus visible | Every interactive control shows a focus ring | Tab navigation screenshot. |
| ARIA labels on icon-only buttons | `aria-label` or `title` present | DevTools inspector on the hamburger, copy, theme buttons. |
| Form errors | Surfaced via `aria-describedby` or visible inline text | Trigger a Zod validation failure on `/skill/new`. |
| Screen-reader heading order | `<h1>` once per route; `<h2>`/`<h3>` semantic | DevTools "Accessibility tree". |
| `<html lang="en">` | Set | View source. |
| Modal/dialog focus trap | Trap holds; ESC closes | Test on any modal Studio uses. |

Run axe DevTools auto-audit on at least `/`, `/onboard`, `/r/<id>`. Record violations and either fix or document as `PENDING` with reason. |

## Indexer / External-Service Outage Behavior

The deploy depends on third-party endpoints. The plan must verify each fails *honest*, not silent.

| Failure | Test | Pass condition |
|---|---|---|
| `indexer-storage-testnet-turbo.0g.ai` unreachable | DNS-block or set `IVARONIX_STORAGE_INDEXER=http://127.0.0.1:1` for a run. | Receipt anchors without `storage.evidenceRoot`; Studio Storage light stays pending; CLI logs the retry/skip honestly. NEVER a fake root. |
| Galileo RPC unreachable (`evmrpc-testnet.0g.ai`) | Same DNS-block trick. | Studio shows "RPC unreachable" on dashboard; receipt anchoring blocked with clear error; no half-state. |
| 0G Compute Router unreachable | Block `compute-network-*.integratenetwork.work`. | If `compute_tee_required: true` — refuse the run cleanly. Else honest TIER 2 fall-through to NVIDIA NIM with the amber chip. |
| NVIDIA NIM unreachable | Block `integrate.api.nvidia.com`. | Run fails with honest error; no silent retry against secrets. |
| Upstash Redis unreachable | Wrong `UPSTASH_REDIS_REST_URL`. | Rate-limit bucket falls back to per-instance memory; users see normal limits; logs note the degraded state. |
| Vercel function timeout (60s hobby) | Submit a >60s `/api/run`. | Clean 504; receipt is NOT half-anchored; UI states timeout. |

## Plain-Text Receipt Verify (zero-install path)

The strongest no-friction proof: a curl one-liner that anyone can run.

| Test | Action | Pass condition |
|---|---|---|
| `curl` receipt fetch | `curl -sS https://ivaronix.vercel.app/r/<id>` | Returns the proof-page HTML; meta tags include canonical receipt id + receipt hash. No wallet, no install. |
| Public receipt JSON endpoint | If exposed: `curl -sS https://ivaronix.vercel.app/api/receipt/<id>` (or document why this isn't exposed). | Returns receipt body JSON. If NOT exposed, `PENDING` with reason — "judges have to clone the repo for full JSON access" — document as a polish item. |
| ChainScan-only path | Open `https://chainscan-galileo.0g.ai/tx/<txHash>` in fresh incognito. | Tx exists; calling contract is `ReceiptRegistryV2` at the known address. |

## Streaming / Long-Run UX

Long AI runs (audit tier, 6 roles) can take 30-60 seconds. The UI must communicate liveness.

| Test | Action | Pass condition |
|---|---|---|
| Loading indicator during a long run | Submit an audit-tier run; watch the UI for 30-60s. | Progress dots, role completion, or a live token-count visible — never a frozen spinner. |
| Refresh mid-run | F5 while a run is anchoring. | App reconnects to the in-flight request OR explains the partial state cleanly. No double-spend. |
| Cancel mid-run | If a cancel button exists: click it. | Run aborts cleanly; no half-anchored receipt; CLI exits 1. |



## Data Reset And Repeatability

QA must be repeatable.

| Rule | Meaning |
|---|---|
| Use named test wallets | Wallet A, Wallet B, Wallet C with clear roles. |
| Use golden files | Same input files for every serious test pass. |
| Record created IDs | Receipt IDs, tx hashes, passport IDs, room IDs, delegate IDs. |
| Clean up where possible | Revoke grants/delegates after tests. |
| Do not rely on old data | Fresh test run should create fresh evidence. |
| Retest after refresh | State must survive reload where expected. |
| Retest after reconnect | Wallet state must recover after disconnect/reconnect. |

If a test cannot be repeated, write why.

## Observability And Debuggability

When something fails, the system should help debug it.

| Check | Pass Condition |
|---|---|
| UI error | User sees readable error and next step. |
| CLI error | CLI prints useful reason and does not hide the failure. |
| Server logs | Logs show enough context to debug without leaking secrets. |
| Receipt status | Failed/pending/success status is clear. |
| Chain status | Tx pending/confirmed/failed is visible. |
| Provider status | Compute/provider errors are labeled correctly. |
| Correlation ID | If available, receipt/run/request ID links UI, CLI, and logs. |

No silent failures.

## Release Gate And Rollback Rule

Before saying "ready for production" or "ready for mainnet", run this gate.

| Gate | Pass Condition |
|---|---|
| QA checklist | All launch-critical rows are `PASS`. |
| Known limitations | All pending/future items are documented honestly. |
| Core flow | Connect -> run -> receipt -> verify passes on the target environment. |
| Public proof | Proof page opens in fresh browser. |
| CLI verify | CLI verifies the same receipt. |
| Chain proof | Explorer links open and match receipt. |
| Storage honesty | Storage status is real or pending honestly. |
| Secrets check | No leaked keys/private data in proof pack. |
| Mobile check | Main flow and proof page work on mobile viewport. |
| Rollback note | Write how to revert/redeploy if production breaks. |

Rollback note should include:

- previous known-good commit
- deployment URL/provider
- env variables changed
- contracts changed or not changed
- database/storage migration changed or not changed
- who must approve rollback

## God-Level QA Rules

These rules make the test serious enough for launch, judging, and real users.

| Rule | Meaning |
|---|---|
| User journey scoring | After each major flow, rate clarity, smoothness, and confidence from 1 to 5. |
| Confusion log | Every moment of confusion must be written down, even if the feature works. |
| Judge-mode test | Run the product as if a judge only gives it 3 minutes of attention. |
| New-user test | Someone who has never seen Ivaronix should try the core flow without help. |
| Proof explain-back | Tester must explain the receipt in their own words; if they cannot, the UI failed. |
| Trust claim audit | List every claim on UI/docs and verify real proof exists. |
| Refresh survival | Refresh after major actions and confirm state survives correctly. |
| Fresh machine/browser test | Verify proof pages and CLI receipt verification outside the original session. |
| Performance feel check | Slow actions must show progress and never feel frozen. |
| Submission rehearsal | Run the final demo exactly like the submitted video/script. |
| Outcome over decoration | A beautiful screen still fails if the result is weak, fake, or confusing. |
| Proof over confidence | Do not trust a green status unless the proof can be opened and checked. |

## God-Level Fixing Mindset

Use this when fixing any bug, visual issue, broken flow, or weak feature.

| Rule | Meaning |
|---|---|
| Reproduce before fixing | First prove the bug exists and understand the exact failing flow. |
| Fix root cause | Do not only hide the symptom or patch the visible error. |
| Write expected behavior | Before changing anything, define what should happen after the fix. |
| Check nearby flows | A bug in one place may mean similar bugs exist nearby. |
| Do not patch blindly | Understand the flow, state, wallet, receipt, and proof impact before editing. |
| Do not hide errors | Errors should become useful messages, not fake success. |
| No fake fallback success | Fallbacks must be labeled honestly and must not pretend proof exists. |
| Preserve pending states | If Storage/TEE/Chain proof is pending, keep it pending until real proof exists. |
| Fix UI and logic together | If behavior changes, the visible UI must explain the new behavior. |
| Retest full user flow | After fixing, repeat the whole user journey, not only the broken button. |
| Retest failure path | Confirm the bad path now fails safely and clearly. |
| Check desktop and mobile | Any visible fix must be checked on both viewport sizes. |
| Check UI and CLI agreement | If receipts/passports/memory are involved, UI and CLI must match. |
| Check proof still validates | Fixes must not break receipt hashes, tx links, proof pages, or CLI verify. |
| Check privacy again | Confirm private data still does not leak after the fix. |
| Check no regression | Re-run nearby tests that could be affected. |
| Update docs if changed | If behavior changed, update user-facing or QA docs. |
| Capture proof after fix | Save screenshot/video/CLI output showing the fix works. |
| Simpler is better | If a fix feels fragile or too clever, simplify it. |
| No fixed without evidence | Do not mark fixed until proof exists. |

## No-Skip Rules

These rules prevent weak QA, lazy blocked states, and incomplete launch claims.

| Rule | Meaning |
|---|---|
| Every feature gets a row | If the product has it, the QA plan must test it. |
| Every row needs evidence | Each tested item needs screenshot, video, receipt, tx link, or CLI output. |
| Every evidence needs link/path | The proof must be easy to find later. |
| Every claim needs proof | Any claim about 0G, AI, privacy, receipts, wallet, or storage must be verified. |
| Every proof opens fresh | Proof links must work outside the original logged-in session. |
| Every wallet flow uses MetaMask | Wallet flows must be tested with real wallet popups, not only mocked UI. |
| Every tx needs explorer link | On-chain claims need ChainScan/explorer evidence. |
| Every receipt needs CLI verify | Important receipts must be verified from CLI too. |
| Every UI feature needs video | Main visible flows need recording, not only still screenshots. |
| Every mobile page needs screenshot | Mobile cannot be assumed from desktop. |
| Every failure path gets tested | Rejections, bad input, wrong network, failed tx, and missing keys must be checked. |
| Every fix gets retested | A fix is not done until the related user flow passes again. |
| Every new feature updates QA plan | New feature means new test row and expected outcome. |
| Every blocked item needs proof | Blocked means truly external, not “I did not try hard enough.” |
| Every pending item needs reason | Pending must say why and what unblocks it. |
| Every done item needs outcome | Done means the final user result works, not only code compiled. |
| Every ready status needs sign-off | Ready means evidence exists and acceptance criteria passed. |
| No skipping quiet features | Small features still affect trust. |
| No skipping boring pages | Docs, privacy, terms, empty states, and settings still matter. |
| No skipping error states | Broken paths are part of product quality. |
| No skipping empty states | First-time users often see empty states first. |
| No skipping loading states | Long AI/chain actions must feel alive. |
| No skipping privacy checks | Private work is a core promise. |
| No skipping refresh tests | State must survive refresh where expected. |
| No skipping cross-wallet tests | Permission, delegate, memory, and marketplace flows need multiple wallets. |
| No skipping UI/CLI mismatch checks | The same truth must appear in both surfaces. |
| No later without owner | If something is deferred, write owner/reason/unblocker. |
| No works without artifact | “Works” must have proof. |
| No probably in QA | Replace probably with pass, fail, pending, or blocked with reason. |
| No silent assumptions | Write assumptions down. |
| No compromise on core flow | Connect -> run -> receipt -> verify must be excellent. |
| No lowering the bar | If the proper test is hard, do the proper test anyway or mark the real blocker. |
| No fake readiness | Ready means proven with evidence, not hopeful or visually convincing. |
| No partial truth | If part of a feature works and part does not, say exactly that. |
| No hiding weak outcomes | If the AI answer is generic, wrong, or useless, the feature failed outcome QA. |
| No skipping proof because it costs effort | Receipts, tx links, CLI verify, videos, and screenshots are required where relevant. |

## Wallet Setup

| Wallet Count | Use Case |
|---|---|
| 0 wallets | Public pages, proof pages, docs, embeds, receipt verification by ID. |
| 1 wallet | Connect, run AI action, create receipt, mint/show passport, use skills, memory owner actions. |
| 2 wallets | Grant/revoke memory, delegate access, data room sharing, owner/executor flows. |
| 3 wallets | Marketplace/economy testing: creator wallet, buyer wallet, treasury/admin wallet. |

## Evidence Naming

Use clear filenames for screenshots and videos:

```text
route-feature-walletcount-viewport-date.png
core-run-receipt-flow-1wallet-desktop-2026-05-11.webm
```

Example:

```text
memory-grant-2wallets-desktop-2026-05-11.png
```

## Master Feature Checklist

| Area | Feature | Wallets | UI Test | CLI Test | Expected Result | Evidence |
|---|---|---:|---|---|---|---|
| Public web | Landing/home page | 0 | Open Studio home page on desktop and mobile. Click main CTAs. | Not needed. | Page loads fast, copy is clear, CTAs work, no broken layout. | Screenshot + short video. |
| Public web | Brand page | 0 | Open `/brand`. Compare visual style with final brand kit. | Not needed. | Logo, colors, spacing, and typography look consistent. | Screenshot desktop/mobile. |
| Public web | Docs page | 0 | Open `/docs`. Click docs links and sections. | Not needed. | User can understand what Ivaronix does and how 0G is used. | Screenshot. |
| Public web | 0G explainer page | 0 | Open `/0g`. Check Compute, Chain, Storage, Passport explanations. | Not needed. | Claims are honest and easy to understand. | Screenshot. |
| Public web | Thesis page | 0 | Open `/thesis`. Read product story. | Not needed. | Story is clear: private AI work plus receipts. | Screenshot. |
| Public web | Privacy and terms | 0 | Open `/privacy` and `/terms`. | Not needed. | Pages load and do not look unfinished. | Screenshot. |
| Public web | OG-image / social card | 0 | Open `https://cards-dev.twitter.com/validator` and paste `/r/<id>` URL. Also `curl -I https://ivaronix.vercel.app/opengraph-image`. | Not needed. | **Known limitation:** returns HTTP 503 by design (logged in `docs/USER_TODO.md §B-V2-2` — Vercel `next/og` font-asset resolution issue). Mark `BLOCKED` against §B-V2-2; do not debug. Social unfurl shows no preview but blocks no feature. | curl headers screenshot + reference to §B-V2-2. |
| Public web | Brand-parity (CLAUDE.md §10) | 0 | Open `brand/Ivaronix.html` in a browser. Screenshot at 1440×900 + 375×812. Side-by-side vs the same routes on the deploy. | Not needed. | Same color tokens (`#FAFAF7` cream, `#0A0A0A` ink, `#16a34a` green), same fonts (Outfit / Instrument Serif / JetBrains Mono via `next/font/google`), same border radii (10/14/16/20px), same hover-lift, same sticky-blur header, same multi-column footer w/ 6 contract chainscan links, same mobile hamburger. | Side-by-side screenshots. |
| Wallet | Connect wallet | 1 | Click Connect Wallet, approve MetaMask, confirm header shows connected address. | Not needed. | Wallet connects, address appears, disconnect works. | Video showing popup + connected state. |
| Wallet | Wrong network handling | 1 | Switch MetaMask to a non-Galileo chain, open app, try protected action. | Not needed. | App prompts user to switch to chainId 16602 (Galileo); MetaMask "add network" / "switch" popup appears; resolves cleanly. | Screenshot/video. |
| Wallet | Disconnect wallet | 1 | Click Disconnect. Refresh page. Reconnect. | Not needed. | App returns to disconnected state cleanly; reconnect works on same wallet. | Screenshot. |
| Wallet | Mid-flow disconnect | 1 | Start a run; disconnect mid-anchor (or reject MM sign). | Not needed. | UI recovers cleanly, no half-anchored state, error message names next step. | Video. |
| Auth | SIWE/session auth | 1 | Try protected action, sign message if asked. Refresh page. | Not needed. | Session works after signing; protected action does not work without auth. | Video + screenshot. |
| Auth | SIWE cookie hardening | 1 | After `/api/auth/siwe/verify`, open browser DevTools → Application → Cookies. Inspect `iv-siwe-nonce`. | `curl -i -X POST <url>/api/auth/siwe/nonce` and read `Set-Cookie` header. | Cookie carries `HttpOnly; SameSite=Strict; Secure` flags. Missing any one = FAIL. | Screenshot of DevTools cookie inspector + curl headers. |
| Auth | Anon write rejection | 0 | `curl -X POST https://ivaronix.vercel.app/api/skill/save -d '{}'` without SIWE cookie. | Same with `curl`. | HTTP **401** + sanitized error body. Same for `/api/memory/*` writes. | curl output. |
| Auth | Rate limit (anon `/api/run`) | 0 | `for i in $(seq 1 11); do curl -X POST https://ivaronix.vercel.app/api/run -d '{...}' ; done` | Same. | 11th request returns **429** with `Retry-After` header. Also test 51st authenticated request → 429. | curl output. |
| Limits | `/api/run` `maxDuration` cap | 1 | Submit a run designed to take >60s on hobby tier (large context, audit tier). | Same via CLI for comparison. | Run cleanly times out at 60s (hobby) or 300s (pro) — Vercel returns a clean 504 / function-timeout response; receipt is NOT half-anchored. RunPanel shows "timeout" honestly. | Server response + log. |
| Skills | Skill schedule (persistent cron) | 1 | `ivaronix skill schedule add --skill private-doc-review --cron "*/5 * * * *" --doc sample.pdf --question "find risks"` then `ivaronix skill schedule run` (daemon mode) | Same. | Schedule persists across CLI invocations; running the daemon fires at the cron interval; each fire produces a real anchored receipt. `list` view honestly says "fires only when `schedule run` is up — no autonomous remote daemon yet." | CLI list + receipt URLs. |
| Skills | Fee-split variation honoring manifest | 3 | Run `content-pitch-review` (70/30) and `private-doc-review` (90/10) in the same session. | Same. | Each skill's receipt records the EXACT split from that skill's manifest (`og.creator.fee_split`). Default 90/10 must not bleed into a commoditised 70/30 skill. Per `docs/MARKETPLACE_DESIGN.md`. | Two receipts side-by-side. |
| Auth | CSRF on state-changing routes | 1 | From a different `Origin` header, `curl` POST against `/api/run`, `/api/skill/save`, `/api/memory/remember`. | Same. | Origin-mismatch → request rejected (planned in §B-V2-27; if not yet enforced, mark `PENDING` with §B-V2-27 reference). | curl output. |
| Security | HTTP security headers | 0 | `curl -I https://ivaronix.vercel.app/` | Same. | Headers present: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. | curl -I output. |
| Security | Error sanitization | 1 | Trigger a server error (e.g. malformed run body, bad receipt id). | Read response. | Response body has NO file paths, 0x addresses, env-var names. Server-side log still has the full stack (operator-only). | Screenshot/curl output. |
| Onboarding | First-time setup | 1 | Open `/onboard`, connect wallet, choose handle/name if available, continue. | `ivaronix init` | User reaches main workspace without confusion. CLI creates local project config. | Video + CLI output. |
| Agent identity | Agent Passport page (V2) | 1 | Open `/agent` or passport area. Mint via **V2** address `0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d`. | `ivaronix passport show` | Passport exists or user is guided to create it. It shows wallet, agent info, receipt count, trust score. Mint tx hits V2, not V1. | Screenshot + tx link. |
| Agent identity | Authorized-recorders gate (V2) | 2 | Wallet B (not an authorized recorder) tries to call `incrementReceiptCount` on Wallet A's passport. | Direct ABI call via `cast send`. | Tx reverts — only authorized recorders can write trust deltas. | Reverted tx hash + reason. |
| Agent identity | Delta cap (V2) | 1 | Authorized recorder pushes a trust delta above the cap in a single call. | `cast send` with oversized delta. | Tx reverts at the contract level; cumulative trust score never moves by more than the cap in one transaction. | Reverted tx + reason. |
| Agent identity | Cross-check rule (V2) | 1 | Submit a receipt that fails the passport↔receipt cross-check. | Direct ABI call. | Anchor reverts; no orphan-receipt + ghost-passport-bump combination is possible. | Reverted tx. |
| Agent identity | Public agent profile | 0 | Open `/agent/<address>` if supported. | Not needed. | Public profile loads without wallet. | Screenshot. |
| Agent identity | Agent list | 0 | Open `/agents`. Use search/filter if present. | Not needed. | Agents render correctly, no fake data presented as live if not live. | Screenshot. |
| Core run | Private document review | 1 | Upload or paste a simple document. Select private document review skill. Run it. | `ivaronix doc ask sample.pdf "find risks" --burn --quick` | AI returns useful answer, receipt link is created, user can open proof page. | Full video + receipt URL. |
| Core run | Code/repo audit | 1 | Use GitHub audit/code audit flow if shown in UI. | `ivaronix audit .` or `ivaronix code "review this repo"` | App finds issues or gives review result. Receipt/proof appears when enabled. | Screenshot/video + CLI output. |
| Core run | 0G integration audit | 1 | Run 0G integration auditor skill from UI if available. | `ivaronix skill run 0g-integration-auditor` | Output checks 0G usage and creates/verifies receipt where supported. | Screenshot + receipt URL. |
| Core run | Loading state | 1 | Start a run and watch screen while waiting. | Run any long CLI command. | User sees clear loading/progress, not a frozen screen. | Video. |
| Core run | Error state | 1 | Temporarily use bad input or no provider key if safe. | Run command with missing config. | Error is human-readable and gives next action. | Screenshot + CLI output. |
| Receipts | Receipt creation | 1 | Complete any AI action. Click receipt/proof link. | `ivaronix demo --tier standard` | Receipt has ID/hash, model, skill, cost, wallet/operator, chain tx, tier label. | Receipt URL + screenshot. |
| Receipts | Public proof page | 0 | Open `/r/<receiptId>` in fresh browser. | `ivaronix receipt show <id>` | Proof page opens without wallet and shows the receipt clearly. | Screenshot + CLI output. |
| Receipts | Receipt verification | 0 | Use verify button if present on proof page. | `ivaronix receipt verify <id>` | Verification passes or explains exactly why it cannot verify. | CLI output + screenshot. |
| Receipts | TEE-independent verify | 0 | Open receipt with TEE info, check proof details. | `ivaronix receipt verify <id> --tee-independent` | Independent verification passes for TIER 1 TEE path (re-runs `broker.processResponse` against 0G Compute), or honestly says not TEE. | CLI output. |
| Receipts | JCS byte-equality across languages | 0 | Not needed. | Run all 3 reference verifiers against the same receipt: TS (`ivaronix receipt verify <id>`), Python (`cd scripts/verifier-py && python cli.py <id>`), Rust (`cd ivaronix-verifier-rs && cargo run -- <id>`). | All three produce identical canonical hash (byte-equal). CI workflow `jcs-roundtrip` already runs this across 29 fixtures on every push. | CLI outputs side-by-side + green CI badge. |
| Receipts | V2-first read fallback | 0 | Open `/r/<id-anchored-on-V1>` (e.g. fixture id 8). | `ivaronix receipt verify tests/fixtures/anchored-receipts/v1-anchored-id-8.json` | Studio reads ReceiptRegistryV2 first, falls back to V1. Both V1 and V2 receipts resolve on the same `/r/<id>` route. | Screenshot of V1 + V2 receipts rendering. |
| Receipts | Chain anchor tx-hash match | 0 | Open `/r/<id>`, copy chain anchor tx hash. | `ivaronix receipt show <id>` | UI tx hash, CLI tx hash, and Galileo chainscan tx hash all match byte-for-byte. | Screenshot + curl/CLI + chainscan URL. |
| Receipts | Print/share receipt | 0 | Open receipt print/share view if available. | Not needed. | Receipt can be shared without original private file. | Screenshot/PDF. |
| Receipts | Embed receipt | 0 | Open `/embed/r/<receiptId>` or embed preview. | Not needed. | Embed renders cleanly in small frame. | Screenshot. |
| Receipts | ChainScan link | 0 | Click tx link on receipt. | Not needed. | ChainScan opens correct transaction on `chainscan-galileo.0g.ai` and matches receipt hash. | URL + screenshot. |
| 0G Compute | TIER 1 trusted path | 1 | Run action using 0G Compute/Router path. | `ivaronix compute test` then `ivaronix demo --tier high-stakes` | Receipt marks TIER 1 only when trusted/TEE path is actually used. | Receipt URL + CLI output. |
| 0G Compute | External provider honesty | 1 | Run external provider path if enabled. | NVIDIA/OpenRouter provider command if configured. | Receipt says external provider/TIER 2 and does not fake TEE verification. | Receipt screenshot. |
| 0G Compute | Provider health | 0/1 | Check provider status UI if available. | `ivaronix compute providers list` or `ivaronix doctor` | Shows configured providers and missing keys clearly. | CLI output. |
| 0G Compute | Keyring rotation (taxonomy) | 0/1 | Not needed. | Inject a fake 402 (depleted), 'auth' (rejected), and 429 (rate-limited) into `Keyring.invalidate`. | 402 + 'auth' → permanent invalidation, label drops from rotation pool. 429 → transient; label rotates this turn but re-enters the pool after backoff. Failures DO NOT silently collapse into permanent. | CLI logs + before/after rotation state. |
| 0G Compute | JSON-repair on malformed output | 0/1 | Not needed. | Use `packages/runtime/src/json-repair.ts` unit test as oracle. Force a 7B-model response that returns malformed JSON (truncated/trailing comma/unescaped). | `tryParseRepair` recovers the intent in ≥90% of malformed cases (per the existing test suite). On unrecoverable malformation, error surfaces honestly — no fake-anchor with garbage outputs. | Test suite output + a manual `tsx -e "..."` repro. |
| 0G Compute | TIER 2 fall-through gate | 1 | Run a skill that has `og.permissions.compute_tee_required: true` while forcing the Router unreachable (or set provider to NIM). | `--force-provider nvidia` if supported, else env trick. | Skill REFUSES to run on TIER 2; no TIER 2 receipt ever produced. Without this gate, a TEE-only skill could silently downgrade. | CLI error + no receipt. |
| Skills | `passport_min_trust` gating | 1 | Set a skill's manifest to `passport_min_trust: 50`. Call from a wallet whose trust score < 50. | Same. | Caller is rejected before any Router spend. Receipt is NOT anchored. | CLI error or 403 response. |
| Skills | `receipt_required: true` enforcement | 1 | Set a skill's manifest to `receipt_required: true`, then invoke with `--no-receipt`. | Same. | Skill REFUSES to run without receipt (or `--no-receipt` is rejected). | CLI error. |
| Skills | `og.burn.auto_enable` for doc-room reads | 2 | Wallet B opens a room that has `og.burn.auto_enable: true`. | `ivaronix room read <id> --as <walletB>` | Run is forced into Burn Mode; ciphertext to 0G Storage; receipt records `burn: true`. Per-receipt-type slot 11 (`doc_room_read`). | Receipt + log. |
| Skills | Unknown hook handling | 1 | Ship a manifest with `pre_consensus: ['nonexistent_hook']`. | `ivaronix skill inspect <skill>`. | Warning printed; unknown hook dropped; skill still loads + runs. No crash. | CLI output. |
| 0G Chain | Receipt anchor | 1 | After action, open receipt and chain tx. | `ivaronix receipt verify <id>` | Chain anchor exists and matches receipt hash. | ChainScan URL + CLI output. |
| 0G Chain | Contract links | 0 | Open contract links in docs/dashboard if present. | Not needed. | Links open correct 0G explorer pages. | Screenshot + links. |
| 0G Storage | Storage evidence on normal run | 1 | Open `/r/<id>` after a normal Studio run via `/api/run`. | `ivaronix receipt show <id>` and check `storage.evidenceRoot`. | Storage light is **green** with a real `storageEvidenceRoot` (keccak Merkle root). The pipeline uploads on every anchor (since commit `7b1addc`). If `null`, the indexer was unreachable on that run — record this as a transient and re-run. | Screenshot of green Storage light + receipt JSON. |
| 0G Storage | Storage upload + retrieve round-trip | 1 | Not the primary UI test. | After a run, fetch the blob back from the storage indexer at `https://indexer-storage-testnet-turbo.0g.ai` using the `evidenceRoot`. Compare byte-for-byte against the original (or its ciphertext for burn). | Retrieved bytes match what was uploaded. This is the only proper proof the 0G Storage integration is *complete*, not just wired. | CLI download + diff output. |
| 0G Storage | Burn upload path | 1 | Toggle Burn Mode in Studio Run panel, run against a file. | `ivaronix doc ask file.pdf "find risks" --burn --quick` | Ciphertext (NOT plaintext) is uploaded to 0G Storage. Receipt records `burn: true` + `keyFingerprint`. Public proof page shows Burn Mode honestly. | Receipt + CLI output. |
| 0G Storage | Burn-mode decrypt round-trip | 1 | Not UI. | Download the burn ciphertext from 0G Storage using `evidenceRoot`. Decrypt with the captured session key → plaintext matches original. Decrypt with a tampered ciphertext → AES-GCM auth tag fails closed. | Right key → exact original bytes. Wrong key or tampered byte → decrypt rejects (no silent garbage output). | CLI output of both cases. |
| Burn mode | Burn mode toggle | 1 | Turn on Burn Mode before doc/code run. | `--burn` flag on doc command. | App explains key destruction/private session clearly. Receipt marks burn mode. | Video + receipt URL. |
| Burn mode | Burn receipt | 1 | Open resulting receipt. | `ivaronix receipt show <id>` | Receipt proves action happened but does not expose private file content. | Screenshot. |
| Consensus | Consensus tier `quick` | 1 | Set tier to `quick`. | `ivaronix consensus run --tier quick` | 1 role (analyst); receipt records `tier=quick` and the role list. | Receipt screenshot. |
| Consensus | Consensus tier `standard` | 1 | Set tier to `standard`. | `--tier standard` | 3 roles (analyst + critic + judge); receipt records the role list. | Receipt screenshot. |
| Consensus | Consensus tier `high-stakes` | 1 | Set tier to `high-stakes`. | `--tier high-stakes` | 5 roles (analyst + critic + risk-reviewer + evidence-checker + judge). | Receipt screenshot. |
| Consensus | Consensus tier `audit` | 1 | Set tier to `audit` (premium adversarial). | `--tier audit` | 6 roles — adds `red-team-critic` on top of high-stakes. Composition is monotone (quick ⊂ standard ⊂ high-stakes ⊂ audit). | Receipt screenshot + role list dump. |
| Consensus | Policy override | 1 | Pass `body.policy = 'unanimous' \| 'majority' \| 'first-objection' \| 'weighted'`. | Same via CLI flag if available. | Receipt's `execution.consensus.policyApplied` field reflects what was chosen (or the skill default if unset). | Receipt JSON snippet. |
| Consensus | Convergence threshold | 1 | Run a deliberately conflicting input. | Same via CLI. | Below-threshold convergence → receipt records "no convergence"; never silently averaged. | Receipt screenshot. |
| Skills | Skills catalog | 0/1 | Open `/skills`. Search/filter skills. | `ivaronix skill list` | Skills show names, descriptions, permission labels, and status. | Screenshot + CLI output. |
| Skills | Skill detail page | 0/1 | Open a skill detail page. | `ivaronix skill inspect private-doc-review` | Shows what the skill does, permissions, and whether it can create receipts. | Screenshot + CLI output. |
| Skills | Run private-doc-review | 1 | Select skill and run against sample doc. | `ivaronix skill run private-doc-review` | Skill produces result and receipt if receipt mode is enabled. | Video + receipt. |
| Skills | Run github-audit | 1 | Select GitHub/repo audit skill. | `ivaronix skill run github-audit` | Skill audits repo/input and shows useful result. | Screenshot + CLI output. |
| Skills | Run 0g-integration-auditor | 1 | Select 0G auditor skill. | `ivaronix skill run 0g-integration-auditor` | Skill checks 0G usage and proof depth. | Screenshot + CLI output. |
| Skills | Skill permissions | 1 | Before running skill, inspect permission prompt. | `ivaronix skill permissions <skill>` | User sees file/network/wallet/memory access before approving. | Screenshot. |
| Skills | Skill install/import | 1 | Add skill from local/GitHub if UI supports it. | `ivaronix skill install <source>` | Skill installs, shows manifest, and can be inspected before run. | CLI output + screenshot. |
| Skills | `/api/skill/save` schema enforcement | 1 | POST a manifest with bogus `memory_access` / `shell_access` / `default_tier` enum values. | `curl -X POST .../api/skill/save`. | Zod rejects with 400 + sanitized message; tampered manifest never reaches sandbox. | curl output. |
| Skills | `creator.fee_split` validation | 1 | POST a manifest where `creator + treasury !== 10000` bps. | Same. | Rejected at save with clear reason ("split must total 10000"). A valid 9000/1000 manifest accepts and the split is reflected on every receipt from that skill. | curl + receipt JSON. |
| Skills | `/api/skill/save` Vercel guard | 1 | POST `/api/skill/save` against the live Vercel deploy. | Same. | Returns **HTTP 503** with the message pointing to `ivaronix skill publish <dir>` or PR to `seed-skills/<id>/SKILL.md` (Vercel's filesystem is read-only — by design). | curl output. |
| Skills | Skill schedule | 1 | Schedule a skill if UI supports it. | `ivaronix skill-schedule ...` | Schedule is created/listed/cancelled cleanly. | Screenshot/CLI output. |
| Memory | Memory page | 1 | Open `/memory`. Add/search/delete memory if controls exist. | `ivaronix memory add/search/list/forget` | Memory actions work and UI updates correctly. | Video + CLI output. |
| Memory | Memory search | 1 | Search a saved memory. | `ivaronix memory search "pricing"` | Correct memory returns. Empty state is clear if none. | Screenshot + CLI output. |
| Memory | Memory grant | 2 | Wallet A grants memory/project access to Wallet B. | Memory grant command if available. | Grant appears in UI/log and on-chain/event proof if supported. | Video + tx link. |
| Memory | Memory revoke | 2 | Wallet A revokes Wallet B access. Refresh as Wallet B. | Memory revoke command if available. | Wallet B no longer has access. UI shows revoked state. | Video + tx link. |
| Memory | MemoryAccessLog spoofing defense | 2 | Wallet B tries to write a log entry into Wallet A's namespace (directly via ABI `log` call). | `cast send` against `MemoryAccessLog`. | Tx reverts — only the namespace owner (or active grantee) can write to that namespace's log. No log-spoofing. | Reverted tx + reason. |
| Memory | Snapshot updates passport.memoryRoot | 1 | After `memory snapshot`, check passport's `memoryRoot` field on chain. | `ivaronix memory snapshot` then `ivaronix passport show`. | Snapshot uploads to 0G Storage, returns rootHash, and updates passport on-chain. (Queued in §B-V2-24; if not yet shipped, mark `PENDING` with that reference.) | CLI output + chainscan. |
| Data room | Create room | 1 | Open `/data-room`, create room with document/evidence. | `ivaronix room create ...` | Room exists and shows owner/access state. | Screenshot/video. |
| Data room | Share room | 2 | Wallet A shares room with Wallet B. Wallet B opens it. | `ivaronix room grant ...` | Wallet B can access only what was granted. | Video with both wallets. |
| Data room | Revoke room | 2 | Wallet A revokes Wallet B. Wallet B refreshes. | `ivaronix room revoke ...` | Access is removed and UI explains why. | Video. |
| Delegate | Create delegate | 2 | Open `/delegate`, authorize Wallet B as delegate. | `ivaronix delegate grant ...` | Delegate authorization appears and receipt/log exists. | Screenshot + tx. |
| Delegate | Delegate run | 2 | Wallet B runs allowed action for Wallet A. | Delegate run command if available. | Action works only inside allowed scope. Receipt names delegate/owner. | Video + receipt. |
| Delegate | Delegate receipt semantics | 2 | Open the resulting receipt JSON. | `ivaronix receipt show <id>` | Receipt records `agent.signedBy = 'operator-on-behalf-of-user'` and `owner = <Wallet A address>` (NOT the operator). | Receipt JSON snippet. |
| Delegate | Revoke delegate | 2 | Wallet A revokes Wallet B. Try same action again. | `ivaronix delegate revoke ...` | Action fails after revoke with clear message. | Video + screenshot. |
| Dashboard | User dashboard | 1 | Open `/dashboard`. Check receipts, passport, usage, skills. | `ivaronix stats` | Dashboard reflects real recent actions. | Screenshot + CLI output. |
| Global | Global feed/explorer | 0 | Open `/global`, use filters/search. | Not needed. | Public receipt/action feed is clear and not misleading. | Screenshot. |
| Developer API | Local API/server | 0/1 | Open API/docs page if present. | `ivaronix serve` | Server starts, endpoint responds, docs explain usage. | CLI output + browser screenshot. |
| Developer API | Receipt API | 0/1 | Use UI/API tester if available. | `curl`/CLI command where documented. | API returns receipt data in expected shape. | Output. |
| Developer embed | Embed page | 0 | Open embed route in browser. | Not needed. | Embeddable proof card works in small viewport. | Screenshot. |
| CLI setup | Doctor check | 0 | Not needed. | `ivaronix doctor` | Shows config, chain, provider, keys, and missing items clearly. | CLI output. |
| CLI setup | Init project | 0 | Not needed. | `ivaronix init` | Creates/recognizes `.ivaronix` config without breaking repo. | CLI output + file listing. |
| CLI chat | Normal chat | 0/1 | Not needed. | `ivaronix chat` or `ivaronix` | User can send prompt and receive answer. | Terminal recording. |
| CLI chat | TUI slash commands | 0/1 | Not needed. | Start `ivaronix`, type `/`, test `/help`, `/model`, `/memory`, `/skills`, `/resume`, `/exit`. | Palette opens, commands work, terminal feels smooth. | Human terminal video. |
| CLI chat | Paste and resume | 0/1 | Not needed. | Paste long text, exit with Ctrl-D, reopen, run `/resume`. | Session resumes or explains unavailable state. | Terminal video. |
| CLI documents | Ask document | 1 | Same as doc UI if available. | `ivaronix doc ask file.pdf "find risks" --burn --quick` | Reads doc, answers, creates receipt if enabled. | CLI output + receipt. |
| CLI documents | Bulk documents | 1 | Not needed unless UI exists. | `ivaronix doc-bulk ...` | Batch runs finish and produce clear summary. | CLI output. |
| CLI code | Plan mode | 0/1 | Not needed. | `ivaronix plan "ship wallet login"` | Gives plan without unwanted edits. | CLI output. |
| CLI code | Code mode | 0/1 | Not needed. | `ivaronix code "small safe task"` | Shows proposed edits/patches and asks permission when needed. | Terminal recording. |
| CLI code | Apply interactive | 0/1 | Not needed. | `ivaronix code --apply --interactive "safe test change"` | User can accept/reject hunks. No surprise writes. | Terminal recording + git diff. |
| CLI audit | Repo audit | 0/1 | Not needed. | `ivaronix audit .` | Finds issues with file references and receipt if enabled. | CLI output. |
| CLI PR | PR review | 0/1 | Not needed. | `ivaronix pr ...` | Reviews PR/diff and gives actionable result. | CLI output. |
| CLI receipts | List/show/verify | 0 | Not needed. | `ivaronix receipt list`, `show`, `verify` | Receipt commands work from a clean terminal. | CLI output. |
| CLI model | Model/provider commands | 0/1 | Not needed. | `ivaronix model ...` and `ivaronix compute ...` | Shows model/provider status and honest provider tier. | CLI output. |
| CLI memory | Memory commands | 1 | Same as memory UI. | `ivaronix memory add/list/search/forget` | Memory works from CLI and matches UI where shared. | CLI + UI screenshot. |
| CLI passport | Passport commands | 1 | Same as passport UI. | `ivaronix passport show/mint/authorize/revoke` | Passport state matches chain/UI. | CLI + tx link. |
| CLI skills | Skill commands | 0/1 | Same as skill UI. | `ivaronix skill list/inspect/install/run` | Skill system works end to end. | CLI output. |
| CLI daemon | Background process | 0/1 | Not needed. | `ivaronix daemon ...` | Starts/stops cleanly and logs are readable. | CLI output. |
| CLI watch | Watch mode | 0/1 | Not needed. | `ivaronix watch ...` | Watches target and reports actions without runaway behavior. | Terminal recording. |
| CLI swarm | Swarm/orchestration | 0/1 | Not needed unless UI exists. | `ivaronix swarm ...` | Multi-agent run creates clear plan, progress, and result. | CLI output. |
| CLI OpenClaw | OpenClaw compatibility | 0/1 | Not needed. | `ivaronix openclaw ...` | OpenClaw flow installs/runs or explains missing setup. | CLI output. |
| CLI DA | DA commands | 0/1 | Not needed. | `ivaronix da ...` | DA preflight/status works or marks future honestly. | CLI output. |
| CLI export | Export data | 0/1 | Not needed. | `ivaronix export ...` | Exports receipts/session data without corrupt output. | File + CLI output. |
| CLI update | Update check | 0 | Not needed. | `ivaronix update` | Shows current/latest or offline-safe message. | CLI output. |
| npx bundle | `npx ivaronix` install + verify | 0 | Not needed. | On a clean shell (NOT inside the repo): `npx ivaronix receipt verify <known-id>`. | Bundle downloads, runs, returns FULLY VERIFIED ✓ or honest reason. This is the README's quickstart and what a judge types. Bundle source: `apps/npx-cli/dist/ivaronix.mjs` (~8 MB esbuild). | Terminal recording from a non-repo shell. |
| CLI swarm | Swarm receipt | 1 | Not needed. | `ivaronix swarm "small multi-agent task"` | Multi-agent run anchors a `swarm` receipt (type 8). Plan + role list + final result on the receipt. | CLI output + receipt URL. |
| Marketplace | Creator skill publish | 1 | Publish/create skill if UI supports it. | `ivaronix skill publish ...` if available. | Skill appears with creator identity and permissions. | Screenshot + tx if on-chain. |
| Marketplace | Buyer runs creator skill | 2 | Wallet B runs Wallet A's skill. | Run skill as second configured wallet. | Receipt shows skill and buyer/user action. | Video + receipt. |
| Marketplace | Fee split serious test | 3 | Creator wallet, buyer wallet, treasury/admin wallet. Run paid skill. | Skill fee-split/earn-history commands. | Creator/treasury split is recorded correctly or marked future if not live. | Receipts + balances/history. |
| Marketplace | Reputation from receipts | 1/2 | Check skill/agent trust score after verified run. | `ivaronix skill earn-history` or stats command. | Reputation comes from receipts/actions, not fake ratings. | Screenshot + receipt. |
| Mobile UX | Mobile public pages | 0 | Test key routes on `375x812`. | Not needed. | No overlap, tiny text, clipped buttons, or hidden CTAs. | Screenshots. |
| Mobile UX | Mobile wallet flow | 1 | Connect wallet/mobile viewport with MetaMask extension simulation or real mobile wallet if possible. | Not needed. | Flow remains understandable. | Video. |
| Visual polish | Core flow video | 1 | Record from home -> connect -> run -> receipt -> verify. | Record CLI parallel only if relevant. | Flow feels premium, not hacky. | One complete demo video. |
| Visual polish | Empty states | 0/1 | Open pages before data exists. | Run CLI commands on fresh profile if possible. | Empty state explains next action. | Screenshots. |
| Visual polish | Error states | 0/1 | Trigger safe errors. | Trigger missing-config CLI errors. | Error messages are useful and do not leak secrets. | Screenshots/output. |
| Judge replay | Fresh-machine end-to-end | 0 | On a clean machine (no `.ivaronix` config), open a `/r/<id>` URL in incognito. | Same machine: `git clone https://github.com/Pratiikpy/ivaronix.git && cd ivaronix && pnpm install && pnpm exec tsx apps/cli/src/bin/ivaronix.ts receipt verify tests/fixtures/anchored-receipts/v1-anchored-id-8.json` | Proof page renders identically. CLI returns `FULLY VERIFIED ✓` for the tracked fixture. This is the gold-standard verification per CLAUDE.md §11.3a — a stranger reproducing the proof on their machine. | Video of clone+verify on a clean VM. |
| CI gate | GitHub Actions status | 0 | `gh run list --commit=<sha-being-tested>` | Same. | Both `CI` and `jcs-roundtrip` workflows show `● success` for the commit. Any non-green = NOT testable yet. | gh output. |
| Vercel gate | Deploy bound to commit | 0 | `vercel ls ivaronix` | Same. | The `● Ready` production deploy is tied to the same commit. Aliases include `ivaronix.vercel.app`. | vercel CLI output. |

## First-Party Skill Checklist

| Skill | Wallets | Test Action | Expected Result |
|---|---:|---|---|
| `private-doc-review` | 1 | Run against a small contract/document. | Gives summary, risks, and receipt/proof if enabled. |
| `github-audit` | 1 | Run against a repo or sample GitHub input. | Finds repo/code issues with useful evidence. |
| `0g-integration-auditor` | 1 | Run against Ivaronix or sample 0G project. | Checks Compute, Chain, Storage, receipts, and honesty of claims. |
| `code-edit` | 1 | Run on a safe local test repo. | Proposes or applies controlled edits with permission. |
| `content-pitch-review` | 0/1 | Run against pitch/landing copy. | Gives clear market/story feedback. |
| `plan-step` | 0/1 | Run against a task plan. | Produces next actionable steps. |
| `imports` | n/a | **NOT SHIPPED YET** — no `seed-skills/imports/SKILL.md` exists. Mark `PENDING` until skill ships or remove from the catalog. | n/a — first-party catalog should list 6 skills, not 7. |

## Golden Test Files

Use the same fixed test files every time. This makes QA fair because every run is judged against the same expected outcome.

| Golden File | What It Should Contain | Feature Tested | Good Output Must Catch |
|---|---|---|---|
| `golden-contract-risky.pdf` or `.txt` | A sample contract with risky termination, payment, liability, and confidentiality clauses. | Private doc review, burn mode, consensus, receipt. | Must mention the risky clauses specifically, not only generic legal advice. |
| `golden-buggy-repo/` | A small repo with 3-5 known issues: auth bug, missing env check, bad error handling, unsafe write, weak test. | Code audit, GitHub audit, code mode. | Must identify real files/areas and explain why they are risky. |
| `golden-0g-integration-repo/` | A sample 0G app with one correct Chain use, one missing Storage root, one fake TEE claim. | 0G integration auditor, receipt honesty. | Must catch missing Storage proof and fake TEE/Compute claim. |
| `golden-pitch.md` | A project pitch with unclear market, too many features, and weak user problem. | Content/pitch review skill. | Must suggest sharper positioning and clearer first user workflow. |
| `golden-private-note.txt` | A private text with a unique secret phrase like `PRIVATE_TEST_PHRASE_DO_NOT_LEAK`. | Privacy leak check, burn mode, proof page. | Public proof page must not reveal the secret phrase. |
| `golden-invalid-receipt.json` | A receipt with changed hash, wrong tx, or missing model field. | Receipt verify, error state. | Verification must fail with a clear reason. |
| `golden-valid-receipt-id.txt` | A known good receipt ID from testnet/mainnet. | Public proof, CLI verify. | UI and CLI verification both pass and show matching data. |

## Outcome Quality Checklist

This section checks whether each feature gives the right result, not only whether the button worked.

| Feature | Quality Question | Pass Condition | Evidence |
|---|---|---|---|
| Private doc review | Did it actually understand the document? | Output names specific risky clauses/sections from the golden contract. | Screenshot + receipt. |
| Private doc review | Is the answer useful to a founder/user? | It explains risk in simple language and gives clear next steps. | Screenshot. |
| Code audit | Did it find real issues? | It catches at least the known critical issues in `golden-buggy-repo`. | CLI output + screenshot. |
| Code audit | Are findings actionable? | Each major issue includes file/area, why it matters, and suggested fix. | CLI output. |
| GitHub audit | Does it avoid generic advice? | Output references concrete files, configs, or flows from the repo. | Screenshot/CLI output. |
| 0G integration audit | Does it verify real 0G usage? | It checks Compute, Chain, Storage, receipt, tier labels, and explorer proof. | Receipt + output. |
| Receipt proof page | Can a non-dev understand it? | A normal user can tell what happened, when, which model/skill, and what proof exists. | Screenshot + tester notes. |
| Receipt proof page | Does it avoid leaking private input? | Public page does not show full private document or secret phrase. | Incognito screenshot. |
| Receipt schema | Is the receipt complete? | Shows ID/hash, wallet/operator, skill, model, tier, cost, tx, timestamp, proof status. | Receipt screenshot. |
| Chain proof | Does chain data match the receipt? | Tx/anchor hash matches receipt hash or explains pending state honestly. | ChainScan link + CLI verify. |
| Compute proof | Is TIER label honest? | TIER 1 only for 0G trusted/TEE path; external providers show TIER 2/no TEE. | Receipt screenshot. |
| Storage proof | Is Storage label honest? | Green only with a real `storageEvidenceRoot` that the indexer also serves back the same bytes for (round-trip verified); pending only when upload genuinely failed. | Receipt screenshot + retrieved blob diff. |
| Burn mode | Does it protect private content? | Secret phrase/input content is not visible on public proof page. | Incognito screenshot. |
| Burn mode | Does it explain what burn means? | UI says key/session is destroyed; it does not claim blockchain deletion. | Screenshot. |
| Consensus | Is consensus meaningful? | It shows agreement, disagreement/risk, evidence coverage, and final decision. | Screenshot + receipt. |
| Consensus | Is it more useful than single answer? | It catches at least one risk or caveat a single plain answer may miss. | Tester notes. |
| Skill permissions | Are permissions accurate? | Skill asks only for needed file/network/memory/wallet access. | Screenshot. |
| Memory | Does memory recall correctly? | Saved memory can be found later and used in the correct context. | UI + CLI output. |
| Memory grant/revoke | Does access really change? | Second wallet gains access after grant and loses access after revoke. | Two-wallet video. |
| Delegate | Is delegate scope enforced? | Delegate can only perform allowed actions and fails after revoke. | Video + receipt. |
| Data room | Is sharing controlled? | Shared wallet sees allowed material only; non-shared wallet cannot access. | Multi-wallet video. |
| Marketplace/economy | Is money/fee logic clear? | Creator, buyer, and treasury/admin roles are visible and receipt/history matches. | Three-wallet evidence. |
| CLI TUI | Does it feel usable? | Slash commands, paste, resume, exit, and error messages feel smooth in real terminal. | Terminal video. |
| Mobile UI | Is the main flow usable? | No clipped text/buttons, no overlap, wallet flow understandable. | Mobile screenshots/video. |
| Error states | Does the user know what to do? | Failed wallet, wrong network, bad receipt, missing key all show clear next action. | Screenshots. |

## MAINNET_READINESS.md 13-Item Walkthrough (the final gate per QA_LOOP_BRIEF.md #12)

`docs/MAINNET_READINESS.md` is the final gate before declaring `READY`. All 13 items must be PASS on the tested chain, with specific evidence per the doc.

| # | Item | Evidence required (per the doc) | How to test |
|---|---|---|---|
| 1 | Contracts deployed (8/8 on Galileo) | Live addresses in `contracts/deployments/testnet.json`. | Read JSON; open every chainscan URL. |
| 2 | Env vars (9/9 required) | `IVARONIX_NETWORK`, `IVARONIX_RPC_URL`, `IVARONIX_SIGNER_KEY`, `IVARONIX_ROUTER_KEY`, `IVARONIX_ROUTER_PROVIDER`, `NVIDIA_API_KEY`, etc. all set; legacy aliases still resolve. | `pnpm env:check`. |
| 3 | Deployer wallet funded | `≥ 0.1 OG` on Galileo. Currently 69.56 OG. | `/api/dashboard/<addr>` or `ivaronix doctor`. |
| 4 | RPC latency | `eth_blockNumber` round-trip < 2s (current: 0.77s). | `time cast block-number --rpc-url <rpc>`. |
| 5 | Receipt anchoring | `numbers.json receipts.total = 1644+` matches `ReceiptRegistry.nextId() + ReceiptRegistryV2.nextId()`. | Read both contracts; sum. |
| 6 | Proof Explorer (`/r/<id>`) | HTTP 200 on `#994`, `#1004`, `#1014`, `#1056`, `#1069`. | `curl -o /dev/null -w '%{http_code}\n' https://ivaronix.vercel.app/r/{994,1004,1014,1056,1069}`. |
| 7 | Passport state | tokenId 1, trust 1053+, receipts 1053+, violations 0. | `ivaronix passport show 0xaa954c...`. |
| 8 | Memory grant/revoke lifecycle | 5+ grants on chain; ACTIVE → REVOKED proven via Studio + chain. | Tested in Memory section; cross-check chain event log. |
| 9 | Burn-mode receipt | `#1069`: AES-256-GCM, keyFingerprint `sha256:11a3f1a1…`, `destroyedAt 1778314505036`. | `ivaronix receipt show 1069` and inspect storage.encryption. |
| 10 | Fresh user flow (one command) | `ivaronix demo` → receipt anchor tx in ~3s. | Run on a clean machine; capture the tx hash. |
| 11 | TEE-independent verify on `#1069` | schema/hash/signature/chain-anchor PASS, tee:primary PASS via `broker.processResponse` → **FULLY VERIFIED ✓**. | `ivaronix receipt verify 1069 --tee-independent`. |
| 12 | Studio routes (8/8) | `/`, `/onboard`, `/skills`, `/global`, `/dashboard`, `/memory`, `/brand`, `/agent/<addr>` all HTTP 200. | Already tested in Master Checklist; cross-reference. |
| 13 | `serve` HTTP API (4/4 on port 4243) | `/healthz`, `/v1/skills`, `/v1/passport/<addr>`, `/v1/receipt/<id>` all HTTP 200. | `ivaronix serve` then `curl localhost:4243/healthz` etc. |

Mainnet promotion gate (per `docs/MAINNET_READINESS.md §109`): all 13 items GREEN on mainnet (chainId 16661) with mainnet wallet + mainnet contracts before declaring mainnet-READY. Each item gets re-run against the new chain.

## `ivaronix serve` HTTP API (4 routes)

The `ivaronix serve` command boots a local HTTP server on port 4243 (Hono per `docs/build/BUILD.md §11`). Test every route.

| Route | Wallets | Expected response |
|---|---|---|
| `GET /healthz` | 0 | `200 { ok: true, network, blockNumber }`. |
| `GET /v1/skills` | 0 | `200` array of catalog skills (matches `ivaronix skill list`). |
| `GET /v1/passport/<addr>` | 0 | `200` passport state for the address (matches `ivaronix passport show`). |
| `GET /v1/receipt/<id>` | 0 | `200` receipt body (matches `ivaronix receipt show`). 404 on unknown id. |

CORS, rate-limit, auth-vs-anon behavior, JSON content-type, and error sanitization all apply equally to `serve` as to the Studio `/api/*` routes.

## PHASE_B_DISCLOSURES.md — known limitations a tester must respect (not flag as bugs)

`docs/PHASE_B_DISCLOSURES.md` lists 6 OPEN honest disclosures. A tester who flags these as "FAIL" is testing wrong — they're documented, honest, mid-flight items. Mark each as `KNOWN-LIMITATION` with the disclosure id.

| # | Open disclosure | Why it's NOT a bug |
|---|---|---|
| 2 | SubscriptionEscrow deployed, no CLI / Studio surface yet | Contract is live; surfaces queued in `§B-V2-18`. Recurring `subscription_skill_exec` receipts are PENDING. |
| 3 | `/global` "OG spent" reads only local filesystem (not chain-derived) | Surface honesty: page shows local data, not a chain aggregation. Should NOT be claimed as a global feed in pitch copy. |
| 4 | `/data-room/[id]` reads only local manifest | Cross-machine works via `?storage=<rootHash>` query param fallback (planning-002 W6). |
| 5 | `fee_split` recorded but no on-chain payout | Receipt shape correct; actual settlement is `§B-V2-15` (CapabilityRegistryV2) or follow-on payout contract. |
| 6 | CLI commands without a Studio surface | Some CLI features (`swarm`, `passport-consolidate`, `skill-schedule`, etc.) are CLI-only by design. Don't expect Studio UI. |

Closed disclosures (must STAY closed in regression testing):
- 1 · Studio-anchored receipt issuer is operator wallet → CLOSED (now `'operator-on-behalf-of-user'` with SIWE delegation when user wallet present). Re-test on every commit.
- A · Vanity agent handle copy / B · Receipt-type human labels / C · CLAIMED banner / D · Hardcoded skill count / E · Profile receipt cap / F · MemoryAccessLog per-owner filter / G · daemon honest help text — all CLOSED. Regression-test each.

## HALF_BAKED.md CLOSED-Stays-CLOSED Regression Audit

`docs/HALF_BAKED.md` lists every audit finding (Sections A through Z+). Most are `✅ CLOSED <sha>`. The QA must regression-test the CLOSED items so they don't silently un-close. (The `pnpm audit:list` tool surfaces commit trailers — every claim of CLOSED must have a verifiable `Closes audit <ID>` trailer in git history.)

| Audit ID | What it closed | Regression check |
|---|---|---|
| A-1 · `compute_tee_required` dead branch | Closed `d15703f`. | Run a TEE-required skill against a force-NIM provider — must refuse, not silently accept. |
| A-3 · `attestationHash: null` on TIER 1 | Closed `1f43a27`. | Every TIER 1 receipt has a non-null attestationHash. |
| A-4 · Storage light green when no upload | Closed `b9676f1`. | Storage light gates on real `evidenceRoot` (see 0G Storage section). |
| A-5 · Storage light green-at-click | Closed `98f102b`. | Storage light starts pending; transitions only on response. |
| A-9 · `/api/run` zero rate limiting | Closed `245e017`. | 11th anon request → 429 (see Auth section). |
| A-10 · No HTTP security headers | Closed sweep 130. | All 4 headers present (see Security section). |
| K-1 / K-2 / K-8 / K-9 / K-15 / K-16 / K-20 | All CLOSED. | Each has a `Closes audit K-N` trailer; tests already in respective sections. |

`pnpm audit:list` should be run and the output saved to `QA_PROOF_PACK/notes/audit-list.txt`. Any divergence between HALF_BAKED.md "✅ CLOSED" markers and `pnpm audit:list` output = drift to flag.

## JUDGE_GUIDE.md Five-Minute Reproducer (the literal demo path judges will follow)

`docs/JUDGE_GUIDE.md` directs judges through a specific 5-minute walkthrough. The plan must reproduce it on a clean machine, in order, with timing — and confirm every claim in the doc.

| Step | Time | Action | Pass condition |
|---|---|---|---|
| 1 | 60s | On a clean machine: `git clone https://github.com/Pratiikpy/ivaronix.git oglabs && cd oglabs && pnpm install && pnpm --filter @ivaronix/cli exec ivaronix receipt verify 1304 --tee-independent` | Output matches one of the doc's two disclosed paths: (a) `schema PASS`, `hash PASS`, `signature PASS → CLAIMED`, `chain anchor PASS (id=1304) → ANCHORED`, `tee:primary PASS → via broker.processResponse`, **`→ FULLY VERIFIED ✓`** when the live provider's TEE channel is reachable; or (b) the same first four checks PASS plus `tee:primary error getting signature error`, **`→ ANCHORED (some TEE checks failed)`** when the channel is rate-limited / rotated / transiently unreachable. The receipt is authentic in either case — `tee:primary` is the additional check that depends on the live 0G Compute network. No wallet, no account. |
| 2 | 90s | Open `https://ivaronix.vercel.app/r/1304`, `/agents`, and the third surface JUDGE_GUIDE.md names in three tabs. | `/r/1304` renders four-light row + TIER 1 chip + anchor tx link + key fingerprint + Print/save-as-PDF button. `/agents` is a live read of `AgentPassportINFT.nextTokenId()` sorted by trust score. |
| 3 | 90s | Run a fresh receipt as the judge with their own wallet. | Receipt anchors, `/r/<new-id>` renders identically to receipt 1304's pattern. |
| 4 | 60s | Land on the receipt page they just produced — read what it says it did. | Receipt explains in plain language: skill used, model, TIER chip, anchor tx, storage root, key fingerprint. Judge can explain it back to a non-technical observer. |

If any step diverges from the doc's expected output, FAIL the run AND fix the doc-or-code mismatch before submitting.

## Numbers.json Numeric-Claim Parity

`docs/numbers.json` is the single source of truth for every numeric claim in README / PITCH / JUDGE_GUIDE / MAINNET_READINESS. Drift here = the docs lie.

| Claim | numbers.json value | Test |
|---|---|---|
| Receipts anchored | `1,644+` (V1 + V2) | `ivaronix receipt count` (or read chain directly via `ReceiptRegistry.nextId()` + `ReceiptRegistryV2.nextId()`). |
| Receipt types | `13` | `wc -l packages/core/src/types.ts` grep + count. |
| Contracts deployed | `8` | `cat contracts/deployments/testnet.json` count. |
| Foundry tests | `167` | `cd contracts && forge test --list \| wc -l`. |
| First-party skills | `6` (catalog of `156`) | `ls seed-skills/ \| wc -l` excluding AGENTS.md/README. |
| Creator earnings (testnet) | `0.0014 OG · 26 paid runs of private-doc-review · 90/10 split` | Sum `billing.feeSplit.creatorNeuron` across receipts of skill `private-doc-review`. |
| Workspace packages | `25` (apps `6`, typecheck clean `21`, test files `21`) | `cat pnpm-workspace.yaml` + ls + count. |
| Polyglot hash | `3 languages · 17 TS + 14 Py + 11 Rust tests · 29 cross-impl vectors` | Run all three suites and count assertions. CI workflow at `.github/workflows/jcs-roundtrip.yml`. |
| Mainnet readiness | `13/13 checklist green · blocked on 0.1 OG to deployer wallet (§A-2)` | Read `docs/MAINNET_READINESS.md` checklist line-by-line. |

Run `pnpm numbers:check` — if any auto-derived claim disagrees with the live source, FAIL. Then run `pnpm docs:check` to confirm every `<!-- numbers:auto:KEY -->` marker in README/PITCH/etc. renders the value from numbers.json.

## TIER 1 Verification-Method Sub-Types

`docs/RECEIPT_SCHEMA.md §35` distinguishes two TIER 1 verification methods. Plan must test both.

| Sub-type | When | Test |
|---|---|---|
| `router_flag` | TIER 1, the provider's TEE attestation was flagged at submission time (cheap check). | Run a TIER 1 skill via the Router. Receipt `teeVerification.verificationMethod === 'router_flag'`. |
| `compute_sdk_process_response` | TIER 1, `broker.processResponse` confirmed the attestation post-hoc (the gold standard). | Run `ivaronix receipt verify <tier-1-id> --tee-independent`. Receipt or output records `compute_sdk_process_response`. **This is the verification path JUDGE_GUIDE.md step 1 uses.** |
| `external-signed` | TIER 2 — NVIDIA NIM / OpenAI / Ollama. Signed and chain-anchored but **NOT TEE-verified**. | Run a TIER 2 skill (force `--provider nvidia`). Receipt `verificationMethod === 'external-signed'`; `/r/<id>` renders amber (NOT green). |

## Cryptographic Invariants (from `docs/CRYPTO_NOTES.md`)

Specific cryptographic guarantees the codebase claims. Each must hold or the privacy/integrity story collapses.

| Invariant | Test |
|---|---|
| AES-256-GCM IND-CCA2 security under random 12-byte nonce | Implementation review: `packages/og-storage/src/burn.ts` uses `randomBytes(12)` per encrypt; same-plaintext-same-key produces different ciphertexts. |
| Nonce uniqueness over 10,000 iterations | Run the `burn.test.ts` 10k-nonce uniqueness fuzz; zero collisions. |
| Round-trip integrity over ASCII / Unicode / large strings / empty string | Run the test suite's four-shape round-trip; every case decrypts back exact. |
| Auth-tag failure on wrong key | Decrypt with a key whose fingerprint != stored fingerprint → throws cleanly. |
| Auth-tag failure on tampered ciphertext | Flip one byte in stored ciphertext → decrypt rejects (no silent garbage output). |
| `keyFingerprint = sha256(realKey)` BEFORE buffer-zero-out | Source-file regression: `verify-burn-keyfingerprint-before-zero.ts` enforces ordering. Any later "I had the key" claim must produce a key whose `sha256` matches the receipt's `storage.encryption.keyFingerprint`. |
| No `createHash('sha256').update(plaintext)` patterns in `encryption.ts` | Source-file regression already enforces (line-level forbidden patterns). |

## Privacy Invariants (from `docs/PRIVACY_NOTES.md`)

Each privacy claim Ivaronix makes is tied to a specific mitigation that needs adversarial proof.

| Invariant | Threat | Test |
|---|---|---|
| Operator wallet does NOT show up in indexer logs for blobs they aren't a party to | A user inspecting the 0G Storage indexer's signer logs sees only the read-proxy address, not the operator's signer key. | Set `IVARONIX_READ_PROXY_KEY` to a fresh key. Trigger a public-manifest read. Inspect what address signs the indexer query. Must be the read-proxy address, NEVER the operator wallet. |
| TIER 1 plaintext NEVER leaves the TEE | The Router sees the request bytes; the inference output stays sealed inside the TEE. | Run a TIER 1 doc-ask with `PRIVATE_TEST_PHRASE_DO_NOT_LEAK`. Confirm the secret phrase appears NOWHERE in: the receipt body's `outputs`, the public `/r/<id>` page, the Router relay logs (if accessible), and any chain anchor field. |
| TIER 2 honest disclosure | Plaintext IS visible to the provider on TIER 2. | Same `PRIVATE_TEST_PHRASE_DO_NOT_LEAK` test against TIER 2. Public `/r/<id>` must show amber chip + "external provider" label so the user knows the provider saw the input. |
| Burn Mode: operator forgets the key after the run | Local memory destroyed before the receipt is signed. | After a burn run, inspect operator's memory (if introspectable) or trust the source-file regression. The receipt's `keyFingerprint` is the only commitment that survives. |
| Data-room read-leak mitigation | Without read-proxy: operator-signed reads reveal "user X read room Y" in indexer logs. | Same as the operator-wallet test above, but in the data-room flow specifically. |
| Side-channel awareness (documented, NOT mitigated) | Timing, request volume, response size can reveal patterns even with full crypto in place. | Confirm `PRIVACY_NOTES.md §50-52` documents this honestly; no claim that side-channels are protected. |

## Receipt JSON Field-by-Field Validation (from `docs/RECEIPT_SCHEMA.md`)

The receipt body has a specific shape. Every field must serialize, sign, and round-trip cleanly.

| Field path | What it carries | Test |
|---|---|---|
| `id` (ULID) | `rcpt_*` prefix per `@ivaronix/core` `newId('rcpt')`. | Regex check on every produced receipt. |
| `type` | One of the 13 from `RECEIPT_TYPES`. | Cross-check vs Receipt Type Coverage section above. |
| `schemaVersion` | `1.0` or `2.0+`. | V2 receipts carry `2.0+`; V1 fixture carries `1.x`. |
| `agent.ownerWallet` | EIP-55 checksummed `0x...` address. | Regex check + checksum validation. |
| `agent.signedBy` | `'operator' \| 'operator-on-behalf-of-user' \| 'user-direct'`. | Tested in Delegation section. |
| `outputs.wording.headline` | Plain-language headline shown on `/r/<id>` and OG image. | Cannot leak `PRIVATE_TEST_PHRASE_DO_NOT_LEAK`. |
| `chainAnchor.registryAddress` | One of the known `ReceiptRegistry` / `ReceiptRegistryV2` addresses. | Cross-check vs `KNOWN_RECEIPT_REGISTRIES` set in `@ivaronix/core`. |
| `chainAnchor.txHash` | Real Galileo tx hash. | Opens on chainscan-galileo.0g.ai. |
| `storage.evidenceRoot` | keccak Merkle root, OR omitted if indexer unreachable. | Already covered in 0G Storage section. |
| `storage.encryption.keyFingerprint` | `sha256(realKey)` hex, for Burn-Mode receipts. | Tested in CRYPTO_NOTES section above. |
| `teeVerification.verificationMethod` | One of three sub-types above. | Tested in TIER 1 Sub-Types section. |
| `billing.feeSplit.creatorNeuron` | Wallet receiving the creator share. | Matches the skill manifest's `creator.fee_split` declared neuron. |
| `billing.feeSplit.treasury` | Wallet receiving the treasury share. | Same source-of-truth check. |
| `execution.consensus.policyApplied` | One of `'unanimous' \| 'majority' \| 'first-objection' \| 'weighted'` or skill default. | Tested in Consensus section. |
| Tamper detection | Mutating ANY signed field breaks signature recovery. | Tamper a fixture; `ivaronix receipt verify` returns INVALID with the exact field that broke. |
| Freshness window | `RECEIPT_SCHEMA.md §126` defines max-age before re-verify is suggested. | Verify a fresh receipt + a stale fixture; UI/CLI surface the freshness state. |

## Smart Contract Threat-Model Coverage

Every security-sensitive contract has a `Threat model:` NatSpec block listing what it defends + what it explicitly does NOT defend. Each defense needs an adversarial test row in QA.

| Contract | Threat-model defense | Test (adversarial) | Pass condition |
|---|---|---|---|
| `ReceiptRegistryV2` | EIP-712 anchor signature recovery — `agentAddress` is the recovered signer, NOT `msg.sender`. | Submit an anchor with a forged signature (wrong wallet). | Tx reverts on signature mismatch. |
| `ReceiptRegistryV2` | Per-agent monotonic nonces prevent replay. | Replay a previously-mined anchor tx with same nonce. | Tx reverts on nonce reuse. |
| `AgentPassportINFTV2` | `authorizedRecorders`-only writes (vs anyone calling `incrementReceiptCount`). | Wallet B (not authorized) calls `incrementReceiptCount` on Wallet A's passport. | Tx reverts. |
| `AgentPassportINFTV2` | ±100 `trustScoreDelta` cap per call. | Authorized recorder pushes delta = 200. | Tx reverts at the cap. |
| `AgentPassportINFTV2` | `executorVersion` bumps on transfer (prevents executor-state carryover). | Transfer a passport between wallets; observe `executorVersion`. | Increments on each transfer. |
| `AgentPassportINFTV2` | `passportOf` set BEFORE `_safeMint` + `nonReentrant`. | Re-entrancy on mint callback. | Re-entrant call reverts. |
| `CapabilityRegistryV2` | Social-graph leak fix + K-22 `consumeRead` DoS protection. | Read consume above the burst quota. | DoS-style read floods are rejected. Marked `PENDING` if V2 not yet deployed (`§B-V2-15`). |
| `MemoryAccessLogV2` | Log-spoofing defense (only namespace owner or active grantee writes). | Wallet B writes into Wallet A's log namespace. | Tx reverts. `PENDING` if V2 not yet deployed (`§B-V2-16`). |
| `SkillRegistryV2` | Squatter-risk fix — name reservation gated. | Re-register an existing skill name. | Tx reverts. `PENDING` if V2 not yet deployed (`§B-V2-17`). |
| `IvaronixReceiptGuard` | Library-level guards against double-anchor + replay. | Library unit tests via `GuardCaller` helper. | All `*.t.sol` Foundry tests green. |
| `SubscriptionEscrowV2` | AGENT_AUTO accountability fix — agent address recorded on every drain. | Drain without agent-address claim. | Tx reverts. `PENDING` if V2 not yet deployed (`§B-V2-18`). |

Run `cd contracts && forge test -vvv` and confirm every `*.t.sol` test passes. The plan should record total Foundry test count (current: see `docs/numbers.json`).

## Environment Alias Chain Verification

`packages/runtime/src/env.ts` defines **10 canonical → legacy alias chains** (e.g. `IVARONIX_SIGNER_KEY` → `OG_PRIVATE_KEY` → `EVM_PRIVATE_KEY`). Each must resolve correctly from any alias.

| Test | Action | Pass condition |
|---|---|---|
| Canonical-only set | Set ONLY `IVARONIX_SIGNER_KEY`; unset all legacy. Run any anchor flow. | Works without deprecation warning. |
| Legacy-only fallback | Set ONLY `OG_PRIVATE_KEY`; unset canonical. | Works + emits a one-time deprecation warning naming the canonical replacement. |
| Mixed (canonical wins) | Set both canonical AND legacy to different values. | Canonical value used; legacy is silently ignored. |
| All 10 chains | Repeat for each: `*_SIGNER_KEY`, `*_READ_PROXY_KEY`, `*_RPC_URL`, `*_NETWORK`, `*_CHAIN_ID`, `*_WALLET_ADDRESS`, `*_ROUTER_KEY`, `*_ROUTER_URL`, `*_ROUTER_PROVIDER`, `*_DEFAULT_MODEL`. | Every chain resolves; `pnpm env:check` returns all green. |

## Source-File Regression Suite (95 verify-\*.ts files on disk · 76 automated · 19 require live server)

`scripts/qa/metamask-e2e/verify-*.ts` ships **95 verify-\*.ts files** as of cron iteration 17 (counted via `find scripts/qa/metamask-e2e -name 'verify-*.ts' | wc -l`). Of these, **76 run automatically** (pre-commit on Studio offline · CI on all three offline filters); the remaining **19 require a running Studio dev server** and are gated behind the `studio-live` filter. The `verify-no-orphan-regressions.ts` meta-regression confirms every file is wired to at least one filter. A serious tester re-runs the whole offline suite to confirm what was tested matches what's on disk.

| Suite | Command | Pass condition |
|---|---|---|
| Studio offline regressions (59) | `pnpm --filter qa-metamask-e2e run regressions:studio` | All 59 PASS. Pre-commit runs this suite on every `git commit`. |
| CLI regressions (13) | `pnpm --filter qa-metamask-e2e run regressions:cli` | All 13 PASS. |
| Contract regressions (4) | `pnpm --filter qa-metamask-e2e run regressions:contracts` | All 4 PASS. |
| Live-server regressions (~19) | `pnpm --filter qa-metamask-e2e run regressions:studio-live` after `pnpm --filter @ivaronix/studio dev` | Run before merging Studio changes that touch live-state behavior. |
| Total automated | All three offline filters above + Foundry tests + workspace typecheck + Studio build. | Everything green on the same commit being tested. |

## 0G Primitive Integration Depth (Criterion 1 — the headline judging axis)

CLAUDE.md §2.1 names 0G integration depth as the most weighted judging criterion. The plan must independently verify each 0G primitive is **really wired**, not surface-level.

| Primitive | Where it lives | Test action | Pass condition | Evidence |
|---|---|---|---|---|
| 0G Chain | `packages/og-chain/` + `ReceiptRegistryV2`, `AgentPassportINFTV2`, `CapabilityRegistry`, `MemoryAccessLog`, `SkillRegistry` deployed at the addresses in `contracts/deployments/testnet.json` | Anchor a receipt + read it back via V2-first → V1 fallback. Open every contract on chainscan-galileo.0g.ai. | All 8 contracts deployed, readable, and used by Studio/CLI. | Chainscan screenshots + UI ↔ CLI tx hash match. |
| 0G Compute (TIER 1) | OpenAI SDK with `baseURL=https://compute-network-*.integratenetwork.work/v1/proxy`; verified via `broker.processResponse` (TEE re-verify) | Run with `--tee-independent` against a known TIER-1 receipt. | Returns `FULLY VERIFIED ✓` — the broker confirms the TEE attestation upstream of the Router. **This is Ivaronix's strongest moat per CLAUDE.md §2.1.** | CLI output + receipt JSON. |
| 0G Storage | `packages/og-storage/` uses `@0gfoundation/0g-ts-sdk` `Indexer` against `indexer-storage-testnet-turbo.0g.ai` | Run a doc-ask → fetch the `evidenceRoot` back from the indexer → byte-diff. | Round-trip succeeds. Code path is wired since `7b1addc`; live verification is item #26. | Upload log + download diff. |
| 0G Router | `packages/og-router/` Keyring + nvidia fallback | Test keyring rotation taxonomy (402/auth/429) per the row above. | Permanent vs transient invalidation distinct. | CLI logs. |
| 0G Agent ID (ERC-7857) | `AgentPassportINFTV2` deployed at `0x85e9...494d` + `Erc7857Verifier` at `0xEAd6...d938` | Mint via V2, verify authorized-recorders gate, delta cap, cross-check rule. | All four properties hold per the V2 sub-rows in the Master checklist. | Tx hashes + chainscan. |
| 0G KV | `packages/og-kv/` — `InMemoryKvClient` (`§WT-11` honest-stub) + optional local `dev:kv` Docker | `pnpm dev:kv` brings up a real local node; `ivaronix memory snapshot` uses it. | Local KV node responds; stream-ID derivation is deterministic per wallet. | Container log + CLI output. |
| 0G DA | `packages/og-da/` `DaClient` + `DEFAULT_DA_ENDPOINT=localhost:51001` | `ivaronix da preflight` against either localhost or a known endpoint. | Returns honest stub response with size-guard at `MAX_BLOB_SIZE = 31_744 KB`; receipt batching design documented even if no live testnet endpoint yet. **Closes the "0G DA not integrated" gap CLAUDE.md §2.1 calls out.** | CLI output. |

Honest reality check after the sweep: list which of the 7 primitives Ivaronix has **wired + live-verified**, which are **wired + code-only (waiting on live verification)**, and which are **honest stubs** (DA). Anything not on a real chain or live indexer must NOT be claimed as "integrated" in the README / pitch.

## Receipt Type Coverage (all 13 types from `RECEIPT_TYPES`)

The codebase defines **13 typed receipts** in `packages/core/src/types.ts:70`. Each anchors through `runPipeline → anchorReceipt`. Every type stresses a different schema slot — testing one does NOT verify the others.

| Slot | Type | Generated by | Test action | Pass condition |
|---|---|---|---|---|
| 0 | `doc_ask` | Studio Run panel / `ivaronix doc ask` | Run doc-ask flow from `golden-contract-risky.pdf`. | Receipt JSON has `type: 'doc_ask'`, anchors on V2, chain tx confirms. |
| 1 | `audit` | `ivaronix audit .` against `golden-buggy-repo/` | Run audit; check receipt type. | `type: 'audit'`. |
| 2 | `consensus` | Consensus run at any tier (quick/standard/high-stakes/audit). | Pure consensus path via skill that requires consensus. | `type: 'consensus'`, role list matches tier. |
| 3 | `burn` | Burn-Mode toggle + run. | Burn doc-ask. | `type: 'burn'`, `storage.evidenceRoot` is ciphertext root, `keyFingerprint` present. |
| 4 | `memory_access` | `ivaronix memory remember/recall/grant/revoke`. | Each memory operation anchors a `memory_access` receipt unless `--no-log`. | One receipt per memory write/grant; `type: 'memory_access'`. |
| 5 | `skill_exec` | Any skill run (UI or CLI). | Run `0g-integration-auditor`. | `type: 'skill_exec'`, references skill manifest hash. |
| 6 | `code_change` | `ivaronix code "..."` with `--apply`. | Apply a tiny safe edit. | `type: 'code_change'`, diff hash recorded. |
| 7 | `passport_update` | Passport mint, trust-score delta, executor-version bump. | Mint via V2. | `type: 'passport_update'`, executor version increments on transfer. |
| 8 | `swarm` | `ivaronix swarm ...` multi-agent orchestration. | Iteration-14 cron drove a 1-task quick-tier swarm: receipt #5 anchored on V2 (block 32918394) but with `type: 'doc_ask'` not `'swarm'`. `apps/cli/src/commands/swarm.ts:157` hardcodes `receiptType: 'doc_ask'` for every dispatched task and no parent aggregate receipt is anchored. `PENDING` until the swarm CLI is updated to anchor a parent `swarm` receipt (`§B-V2-31`). | `type: 'swarm'`, plan + result + role list. |
| 9 | `subscription_skill_exec` | One recurring billing tick under `SubscriptionEscrow`. | `PENDING` until `SubscriptionEscrowV2` is deployed (`§B-V2-18`). Mark `PENDING` with that reference; do not try until deployed. | Receipt records escrow id, drain amount, period. |
| 10 | `doc_room_create` | `ivaronix room create` / `/data-room` create flow. | Create a confidential room. | `type: 'doc_room_create'`, manifest hash + parties + encrypted blob root. |
| 11 | `doc_room_read` | Reader opens granted room. | Wallet B reads after grant. | `type: 'doc_room_read'`, auto-Burn-Mode (per `og.burn.auto_enable`), reader wallet + capability grant id + AI summary hash. |
| 12 | `memory_consolidation` | `ivaronix passport-consolidate` (day/month/year rollup). | Run consolidation against ≥3 recent receipts. | `type: 'memory_consolidation'`, `request.priorReceiptIds` lists the consolidated sources. Lineage verifiable. |

Receipt-type integrity sweep: at the end of QA, dump every receipt produced in `QA_PROOF_PACK/receipts/` and confirm at least one of each type 0-12 (except 9 which stays `PENDING` until SubscriptionEscrowV2 deploys).

## Receipt State Lifecycle (`ReceiptState`)

The codebase defines **5 receipt states** in `packages/core/src/types.ts:103`. The plan must observe each.

| State | When | Test |
|---|---|---|
| `draft` | Schema valid, hash computed, NOT signed. | Run a dry-run that produces a draft (no anchor). | 
| `claimed` | Signed + canonical-hash-bound but NOT yet on chain. | Sign locally, hold before anchor. |
| `anchored` | On chain (V2). | After any normal run, `getReceipt(id)` returns it. |
| `fully-verified` | Anchored + `--tee-independent` verified against 0G Compute. | `ivaronix receipt verify <id> --tee-independent` returns FULLY VERIFIED. |
| `outcome-resolved` | Downstream caller observed the receipt's outcome (e.g. subscription billing settled). | Mark `PENDING` until SubscriptionEscrowV2 is deployed; the lifecycle exists in code but has no live producer. |

## Built-in Hook Coverage (5 hooks from `packages/skills/src/hooks/builtin/`)

The codebase ships **5 built-in hooks**. CLAUDE.md skills.md mentions a 6th (`safety_filter`) — that file does NOT exist yet. The QA plan tests the 5 that ship; treats the 6th as `PENDING`.

| Hook | Fires | Test action | Pass condition |
|---|---|---|---|
| `redact_pii` | `pre_consensus` | Run a skill with `og.hooks.pre_consensus: ['redact_pii']` against text containing an email + phone number. | Output redacts both; log line says how many matches scrubbed. |
| `balance_check` | `pre_consensus` | Run a tier that estimates above `HIGH_COST_OG` threshold (e.g. `audit` tier with long context). | Warning log emitted before the run starts. |
| `log_tokens` | `post_consensus` | Run any consensus skill. | Log line carries input/output token counts, ms, OG cost, convergence score. |
| `print_passport` | `pre_consensus` | Run any skill with a wallet configured. | Log line: `caller=<addr> trustScore=<n> command="..."`. |
| `log_anchor` | `post_consensus` | Run any anchored skill. | Log line carries the explorer URL for the freshly anchored receipt + block number + tx hash. |
| `safety_filter` (CLAUDE.md mentions) | n/a | Confirm no such file exists. | `PENDING` — flagged as documentation drift; either file ships or CLAUDE.md skills.md updates. |

Hook drop-on-unknown test: ship a skill manifest with `pre_consensus: ['nonexistent_hook']`; load via `ivaronix skill inspect` and confirm warning ("dropped unknown hook 'nonexistent_hook'") without crashing.

## Untested Surfaces (apps + packages not yet in Master Checklist)

These exist in the repo and need coverage. Some were treated as fully `BLOCKED` in the original plan — that was wrong; each has a testable layer that does NOT require the external blocker.

| Surface | Where | Test action | Pass condition |
|---|---|---|---|
| `@ivaronix/og-toolkit` SDK | `packages/og-toolkit/` — receipt-aware-by-default DX wrappers | `pnpm add @ivaronix/og-toolkit` in a scratch project; call the one-line action API. | One import → one call → real receipt anchored on Galileo without further setup. This is the long-term moat for adoption (CLAUDE.md TL;DR strategy). |
| MCP server (5 tools) | `apps/mcp-server/src/server.ts` — `ivaronix.ask`, `ivaronix.verifyReceipt`, `ivaronix.searchMemory`, `ivaronix.installSkill`, `ivaronix.passportShow` | Even without Claude Desktop, `tsx apps/mcp-server/src/bin/server.ts` should boot the stdio server. Send raw JSON-RPC `tools/list` over stdin and confirm all 5 tools are listed with input schemas. | All 5 tool names appear; each has a valid Zod-derived input schema; server accepts `tools/call` with mock inputs (offline path). Full Claude Desktop integration stays `BLOCKED`-with-reason. |
| Telegram bot smoke | `apps/telegram-bot/src/smoke.ts` | `IVARONIX_TG_TEST=1 pnpm --filter @ivaronix/telegram-bot exec tsx src/smoke.ts` | Output: `SMOKE OK · bot wired · commands registered without errors`. Does NOT need a phone or BotFather token — the plan was wrong to mark the whole bot BLOCKED. |
| Telegram bot commands surface | `apps/telegram-bot/src/index.ts` — 8 commands: `/start`, `/help`, `/connect`, `/passport`, `/receipt`, `/run`, `/skill`, `/audit` | Same smoke test confirms registration. For live behavior, mark `BLOCKED` with BotFather-token reason. | Smoke confirms all 8 commands register; live-phone test remains the BLOCKED layer. |
| OpenClaw skill install | `apps/openclaw-skill/SKILL.md` — install Ivaronix as an OpenClaw skill | If OpenClaw CLI is installed: `openclaw skills install Pratiikpy/ivaronix#apps/openclaw-skill`. | Skill installs; downstream `openclaw run ivaronix.ask "..."` works. Mark `BLOCKED`-OpenClaw if not installed. |
| `@ivaronix/indexer` SQLite read-replica | `packages/indexer/src/{db,worker}.ts` — 22 tests | `pnpm --filter @ivaronix/indexer test` runs the full suite (CRUD + filters + stats + worker thread). | 22 tests PASS. |
| Studio `/test-wallet` automation shim | `apps/studio/src/app/test-wallet/page.tsx` — Playwright window.ethereum shim | Set `NEXT_PUBLIC_TEST_WALLET=1` in the test env. Navigate to `/test-wallet` in Playwright; the shim injects an in-page signer using `IVARONIX_SIGNER_KEY` server-side. | Lets E2E flows complete without a real MetaMask extension. NEVER ship to production (gated by env var; the next.config.ts gate keeps the client bundle empty unless flag set). The plan should USE this for automated UI rows; manual rows still use real MetaMask. |
| 0G DA local-disperser | `docker-compose.yml` — `0g-da-client` container on localhost:51001 | `cp da.env.example da.env`, fill `DA_PRIVATE_KEY` (fresh, ≥0.005 OG, NOT operator), `DA_RPC_URL`, `DA_ENTRANCE_CONTRACT`. `docker compose up -d da-client`. `ivaronix da preflight`. | "endpoint reachable localhost:51001". Closes the "0G DA not integrated" gap CLAUDE.md §2.1 flags. |

## Additional pnpm Scripts (gates a tester should run)

Beyond the 94 verify-\*.ts regressions, these scripts gate behavior the plan must check. All should return green on the tested commit.

| Script | What it gates |
|---|---|
| `pnpm wording-lint` | CLAUDE.md §9 banned words/phrases — `<!-- wording-lint:allow:meta-list-of-banned-tokens -->` "delve, leverage, robust, em-dash slurries", etc. Pre-commit + CI both run it. |
| `pnpm numbers:check` | `docs/numbers.json` auto-derived counts (Foundry test count, packages typecheck count, anchored receipts) vs reality. Drift = FAIL. |
| `pnpm receipt-types:check` | `RECEIPTS_SPEC §1` ↔ source-of-truth `RECEIPT_TYPES` enum parity. |
| `pnpm docs:check` | README + PITCH + JUDGE_GUIDE + MAINNET_READINESS auto-rendered numbers vs reality. |
| `pnpm audit:list` | Every `Closes audit <ID>` git-trailer queryable; lists closed audits per HALF_BAKED entry. |
| `pnpm env:check` | `.env.example` + `apps/studio/.env.production.template` completeness vs every `IVARONIX_*` token code reads. |
| `pnpm brand:check` | Hex literals in `apps/studio/src/` vs `brand/tokens.json` palette. Drift requires either replacing with a brand token or adding an amnesty entry. `brand-amnesty.json` currently has 6 entries — every new amnesty should justify itself. |
| `pnpm screenshots:refresh` + `pnpm tour:refresh` | README screenshot grid + tour video. If brand/UI changed and these weren't refreshed, the README misrepresents the live product. |
| `pnpm wander:cycle` / `:loop` | Autonomous wander-cycle agent. For testnet (`§B-V2-3`), confirm one cycle anchors a receipt under the CI wallet. |

## Schema Version Coexistence (RFC-8785 migration)

`docs/HASH_FUNCTION.md` describes a `schemaVersion` field that lets v1 (legacy `canonical.ts`) and v2 (`jcs.ts` RFC-8785 + keccak256) receipts coexist on the same chain forever.

| Test | Action | Pass condition |
|---|---|---|
| v1 receipt resolves on the live `/r/<id>` | Fixture `tests/fixtures/anchored-receipts/v1-anchored-id-8.json` (V1, schemaVersion 1.x) | Studio reads V2 first, V1 fallback. Page renders correctly with VERIFIED chip. |
| v2 receipt resolves on the live `/r/<id>` | Any receipt anchored post-K-15 (schemaVersion 2.0+) | Renders identically; JCS canonical hash matches the byte-equal TS+Py+Rust trio. |
| `schemaVersion` field gates the verifier branch | CLI `ivaronix receipt verify <v1-id>` vs `<v2-id>` | Each verifier path produces the correct canonical hash per its schemaVersion. No cross-pollution. |

## Known Documentation Drift To Watch

| Item | What's drifting |
|---|---|
| Studio CSP | `next.config.ts:53-57` says CSP "deliberately omitted — needs end-to-end app testing to draft policy that allows wagmi + Next.js inline scripts". Tracked in `docs/USER_TODO.md §B-V2`. Mark `PENDING` until CSP ships. |
| CLAUDE.md skills.md `safety_filter` hook | ✅ FIXED iter-13 (commit `04664b3`). `.claude/rules/skills.md:71` now lists the 5 shipped hooks with a `BUILTIN_HOOKS` registry pointer. The 6th file `safety-filter.ts` was never shipped; the rule was the source of drift, not the codebase. |
| `seed-skills/imports/` directory | NOT a single skill — it's the **vendored 150-skill catalog** that backs `numbers.json.skills.vendored: 150` (verified iter-19: `find seed-skills/imports -name 'SKILL.md' \| wc -l` = 150). First-party catalog is 6 (`seed-skills/{0g-integration-auditor, code-edit, content-pitch-review, github-audit, plan-step, private-doc-review}/SKILL.md`), vendored catalog is 150, total 156. Plan claim "imports skill listed in some catalogs but doesn't exist" was wrong. |
| README screenshot grid | If brand changed since last `pnpm screenshots:refresh`, the README's grid mis-renders the product. Run before submission. |

## Authoritative Sources For Test Intent

When the test plan and the docs disagree, these are the source-of-truth (in order):

| Doc | Authority |
|---|---|
| `docs/QA_LOOP_BRIEF.md` | The verbatim user voice on what "no compromise" means in test scope. **Highest authority.** |
| `docs/QA_MISSION.md` | Mission framing. |
| `docs/QUALITY.md` | Cross-cutting quality bar. |
| `docs/RECEIPT_SCHEMA.md` | Receipt JSON schema (every field). |
| `docs/HASH_FUNCTION.md` | Canonical-hash spec (RFC-8785 + keccak256). |
| `docs/MAINNET_READINESS.md` | Mainnet gates checklist. |
| `docs/JUDGE_GUIDE.md` | Judge-facing claims. **Anything claimed here must be tested.** |
| `docs/PITCH.md` | Pitch claims. Same rule. |
| `docs/PRIVACY_NOTES.md` | Privacy claims. Burn Mode + memory privacy tests must satisfy. |
| `docs/CRYPTO_NOTES.md` | Crypto choices (AES-256-GCM, EIP-712, keccak256, etc.). |
| `docs/MARKETPLACE_DESIGN.md` | Fee-split rules + category bps. |
| `docs/CI_WALLET.md` | CI wallet setup (separate from operator wallet for safety). |
| `docs/QA_FULL_PRODUCT_REPORT.md` | Existing QA evidence to build on (don't re-do; reference + extend). |
| `docs/PHASE_B_DISCLOSURES.md` | Honest known-limitation register. |

## CLI Commands Missing From Master Checklist

The master checklist already covers 28 commands. These 5 were missed — they anchor receipts or change state, so they're not optional.

| Command | Wallets | Test action | Expected result |
|---|---|---|---|
| `ivaronix passport-consolidate <window>` | 1 | Consolidate last day's receipts. | Anchors a `memory_consolidation` receipt (type 12) pointing at the source ids. `request.priorReceiptIds` is populated. |
| `ivaronix session ...` | 0/1 | Open / list / kill sessions. | Session state persists across runs; killing one wipes only that session's local state. |
| `ivaronix skill-registry-export` | 0 | Export every on-chain `SkillRegistry` entry as JSON. | Output matches what `/api/skills` and `/skills` page render. |
| `ivaronix indexer ...` | 0 | Indexer reads (receipt-by-agent, receipt-by-root, count). | Same data as the V2-first chain client + Studio dashboard. |
| `ivaronix debug <subcommand>` | 0/1 | Each debug subcommand (storage / chain / compute / env). | Output is honest about what's missing; no `console.log` litters the live build. |

## Negative And Failure Flow Checklist

These tests prove the app is reliable when things go wrong.

| Failure Case | Wallets | Test Action | Expected Result | Evidence |
|---|---:|---|---|---|
| Reject wallet connect | 1 | Click connect, reject MetaMask popup. | UI returns to safe disconnected state with clear message. | Video. |
| Reject SIWE/signature | 1 | Trigger sign-in, reject signature. | Protected action does not continue; error is clear. | Video. |
| Wrong network | 1 | Switch wallet to wrong chain. | App asks to switch network before tx/run. | Screenshot. |
| Failed transaction | 1 | Trigger tx then reject or simulate failure. | UI does not mark success; no fake receipt green. | Video. |
| No compute balance/key | 1 | Run compute action without valid provider balance/key. | App/CLI explains missing compute setup. | Screenshot/CLI output. |
| Rate limited compute | 1 | Run when provider rate-limits. | App shows retry/fallback message and does not claim completed run. | Screenshot. |
| Invalid receipt ID | 0 | Open `/r/bad-id` and CLI verify bad ID. | UI/CLI says invalid/not found, not broken page. | Screenshot + CLI output. |
| Tampered receipt | 0 | Verify `golden-invalid-receipt.json`. | Verification fails with reason. | CLI output. |
| Indexer-unreachable Storage path | 1 | Trigger a run while the storage indexer is unreachable (e.g. inject a DNS-block via local hosts file, or in dev set `IVARONIX_STORAGE_INDEXER=http://127.0.0.1:1`). | Storage light stays **pending** (never silently green); receipt JSON omits `storage.evidenceRoot` rather than faking it. | Screenshot + receipt JSON. |
| External provider run | 1 | Run NVIDIA/OpenRouter path if configured. | Receipt shows external/TIER 2/no TEE. | Receipt screenshot. |
| Empty memory | 1 | Search memory before adding anything. | Empty state explains how to add memory. | Screenshot. |
| Unauthorized memory access | 2 | Wallet B tries to read Wallet A memory without grant. | Access denied with clear reason. | Video. |
| Revoked delegate | 2 | Wallet B tries action after revoke. | Action fails and receipt/log does not fake success. | Video. |
| Mobile overflow | 0/1 | Open all main routes on mobile viewport. | No text overlap, hidden buttons, or broken nav. | Screenshots. |
| Browser refresh during run | 1 | Start run, refresh midway. | App recovers or explains run status safely. | Video. |
| CLI interrupted command | 0/1 | Start command, cancel with Ctrl-C. | CLI exits cleanly without corrupting state. | Terminal video. |

## UI And CLI Cross-Check

For every important result, confirm the same truth from both sides.

| Item | UI Check | CLI Check | Pass Condition |
|---|---|---|---|
| Receipt ID | Open proof page. | `ivaronix receipt show <id>` | Same ID/hash appears in both. |
| Chain tx | Click ChainScan link. | `ivaronix receipt verify <id>` | CLI and ChainScan agree. |
| TIER label | Read proof page tier. | CLI receipt output. | Both say same TIER and verification method. |
| Storage state | Read proof page Storage status. | CLI/debug output if available. | Both show real root or pending honestly. |
| Skill name | Check receipt/proof page. | `ivaronix receipt show <id>` | Same skill name and version/hash. |
| Model/provider | Check receipt/proof page. | CLI receipt output. | Same model/provider/tier. |
| Passport | Open passport UI. | `ivaronix passport show` | Same owner/passport state. |
| Memory access | Check `/memory`. | `ivaronix memory ...` | Same grant/revoke status. |

## Proof Pack Checklist

Create one final folder named something like:

```text
Ivaronix_Final_QA_Proof_Pack/
```

It should contain:

| Folder/File | What It Should Contain |
|---|---|
| `01-core-flow/` | Video from connect wallet -> run private task -> receipt -> verify. |
| `02-receipts/` | Receipt URLs, screenshots, and CLI verification outputs. |
| `03-chain/` | ChainScan links for receipt anchors and contracts. |
| `04-compute/` | TIER 1/TIER 2 proof screenshots and provider/TEE verification output. |
| `05-storage/` | Storage roots if wired, or screenshots proving pending state is honest. |
| `06-burn-mode/` | Burn-mode run video and proof page privacy leak check. |
| `07-consensus/` | Consensus run output and receipt. |
| `08-skills/` | Screenshots/outputs for first-party skills. |
| `09-memory-passport/` | Passport, memory add/search, grant/revoke proof. |
| `10-delegate-data-room/` | Two-wallet delegate/data-room videos. |
| `11-marketplace/` | Three-wallet marketplace/fee-split proof if this feature is being submitted. |
| `12-mobile-ux/` | Mobile screenshots/videos for main routes. |
| `13-failures/` | Failure-flow screenshots proving errors are handled. |
| `14-cli/` | Terminal recordings/output for CLI commands. |
| `15-known-limitations.md` | Honest list of pending/future items. |

## Final Demo Script Match

The public demo video should only show flows that QA already proved.

| Demo Part | Must Already Be Proven By QA |
|---|---|
| Connect wallet | Wallet flow video exists. |
| Run private doc/code task | Core run receipt exists. |
| Burn mode | Burn receipt and privacy leak check pass. |
| Consensus | Consensus output is meaningful. |
| 0G Compute | TIER label is honest and verified. |
| 0G Chain | Chain tx link opens and matches receipt. |
| 0G Storage | Storage is real or clearly shown as pending. |
| Proof page | Opens in fresh/incognito browser. |
| CLI verify | `ivaronix receipt verify <id>` passes. |

## Minimum Launch Acceptance

| Requirement | Pass Condition |
|---|---|
| Public pages | All important public routes load on desktop and mobile. |
| Wallet flow | MetaMask connect, disconnect, network handling, and signing work. |
| Core demo | User can run one private document/code task and receive a receipt. |
| Proof page | Receipt page opens without wallet and explains what happened. |
| Chain proof | Receipt includes a valid 0G Chain tx or clear pending state. |
| Compute proof | TIER 1/TIER 2 labels are honest and verifiable. |
| Storage honesty | On every normal `/api/run`, `storage.evidenceRoot` is a real Merkle root that the indexer round-trips. Pending state only allowed when indexer was unreachable (transient). |
| CLI proof | `ivaronix receipt verify <id>` works from terminal. |
| Outcome quality | Golden files produce specific, useful, non-generic answers. |
| Privacy leak check | Private input does not appear on public proof pages. |
| Failure flows | Rejected wallet, wrong network, bad receipt, missing key, and failed tx are handled clearly. |
| UI/CLI consistency | Important receipt/passport/memory data matches between UI and CLI. |
| Proof pack | Screenshots, videos, receipt links, tx links, and CLI logs are saved. |
| Mobile polish | No broken layout in the main user flow. |
| Error states | Bad input/missing config gives helpful message. |
| No fake status | Anything not production-wired is marked pending/future honestly. |

## Studio Component-Level Coverage (`apps/studio/src/components/`)

The Studio ships 13 reusable components. Each must render correctly across desktop + mobile and the routes it's used on. Most are already tested implicitly via the route checks — this is the explicit per-component sweep.

| Component | Where used | Per-component test |
|---|---|---|
| `Header.tsx` | every page | Sticky, `backdrop-filter: blur(20px)`, brackets-only logo left, nav links right, 64px tall. Hover effects work. |
| `Footer.tsx` | every page | Multi-column grid (Product / Docs / Network / Social), 6 chainscan links present + open correct contracts. |
| `Logo.tsx` | header, OG images | SVG renders at 48×32 brackets + italic Instrument Serif "i" + green tittle (`#16a34a`). |
| `WalletConnect.tsx` | header, gated pages | Connect → MM popup; connected state shows address; disconnect resets cleanly. |
| `MobileMenu.tsx` | mobile only | Hamburger at 375×812 opens; all nav links accessible; close icon works; trap focus until closed. |
| `RunPanel.tsx` | `/` | File-drop + 2 dropdowns + question + checkboxes + four-light-row + Run button. State persists across re-renders before submit. "Use sample contract →" pre-fills correctly. |
| `FourLightRow.tsx` | `/`, `/r/<id>` | All four lights (schema / hash / sig / chain — plus Storage as 5th wired in /r/[id]) render with correct states (`pending` / `verified` / `failed`). |
| `Section.tsx` | content pages | Provides the editorial section frame: optional eyebrow (`§ NN · LABEL` or `— Thesis` style), heading, body. |
| `MemoryPanel.tsx` | `/memory` | SIWE-gated; live MemoryAccessLog feed scrolls; grant management UI works. |
| `MemoryNotesPanel.tsx` | `/memory` | Notes scratch surface for memory entries; saves locally without breaking server state. |
| `PermissionPills.tsx` | `/skill/<id>`, `/skill/new` | Renders skill permissions: `memory_access`, `shell_access`, `receipt_required`, `compute_tee_required`, `passport_min_trust` — each as a distinct pill with the correct color. |
| `ReceiptStateChip.tsx` | `/r/<id>`, dashboard | Renders one of 5 states: `draft` / `claimed` / `anchored` / `fully-verified` / `outcome-resolved` with the correct chip color. Never a stale state. |
| `ShareButton.tsx` | `/r/<id>` | Copies the canonical proof URL (not the localhost dev URL); Twitter intent works; share fallback for browsers without `navigator.share`. |

## Marketplace Fee-Split — All 4 Discrete Categories (from `docs/MARKETPLACE_DESIGN.md`)

The marketplace supports 4 discrete fee-split categories. Plan must verify each renders and routes correctly.

| Category | Split (bps) | When | Test |
|---|---|---|---|
| Differentiated specialty | `9000` / `1000` (90/10) | First-party + high-trust creator skills (`private-doc-review`, `github-audit`, `0g-integration-auditor`, etc.) | Receipt records `feeSplit = 9000/1000`. |
| Trust-critical infra | `8000` / `2000` (80/20) | Audit + compliance skills (TBD ship list). | Receipt records `feeSplit = 8000/2000`. If no skill currently uses 80/20, mark `PENDING` against creator-onboarding. |
| Commoditised | `7000` / `3000` (70/30) | Default for first-time creators; commoditised categories (`content-pitch-review`). | Receipt records `feeSplit = 7000/3000`. |
| 50/50 (limited use) | `5000` / `5000` | Mostly historic; documented but rarely picked. | If no skill uses 50/50, mark `PENDING`. |
| Default = 70/30 commoditised | — | First-time creators get 70/30 unless explicitly selecting up. | `/skill/new` dropdown defaults to `Commoditised 70/30`. |
| Dropdown enum enforcement | — | The select on `/skill/new` only allows the 4 discrete values. | Submitting `creator: 7321 / treasury: 2679` (free-form) is rejected by the Zod schema with 400. |

## Efficiency Game / Quality-Conditioned Earning (queued · planning-003 §A.4.5)

`docs/MARKETPLACE_DESIGN.md §3` references an "Efficiency Game" with zer0Gig-style quality-conditioned earning multipliers. Test what ships today; mark the rest PENDING.

| Item | State | Test |
|---|---|---|
| Per-skill convergence-bucket multiplier (76.5% / 63.0% / 49.0% / 0% of base split — `MARKETPLACE_DESIGN.md §75-77`) | `PENDING` — table is documented but receipt billing block does NOT yet record the multiplier. | When wired: receipt's `billing.feeSplit.efficiencyMultiplier` field carries the convergence-bucket value. |
| Policy override interaction (`unanimous` / `majority` / `first-objection` / `weighted`) with fee-split | `PENDING` until Efficiency Game ships. | Same — the policy applied feeds into the multiplier. |

## SIWE Session Lifecycle (`apps/studio/src/lib/siwe-session.ts`)

The SIWE implementation enforces two TTLs. Plan must verify each.

| TTL | Defined | Test |
|---|---|---|
| Nonce TTL | `NONCE_TTL_MS` (read from code) — nonce expires after this window | Issue a nonce at `t=0`. Wait until `t > NONCE_TTL_MS`. Submit the verify with the stale nonce. → REJECTED with clear reason. |
| Session TTL | `SESSION_TTL_MS` | Successfully sign in; wait until `t > SESSION_TTL_MS`. Subsequent protected action → 401 (session expired, re-sign required). |
| Nonce cleanup sweep | On every `getNonce()` call, expired nonces are dropped from the `Map`. | Issue many nonces; verify the in-memory map doesn't grow unbounded (operator-side observability). |
| Session cleanup sweep | Same pattern on `verifyAndCreateSession()`. | Same — long-running instance doesn't leak memory. |
| Per-instance nonce/session store | Today: in-process `Map` per Vercel instance | Without Upstash, a sign-in on one instance won't work against another. The plan should confirm Upstash is the recommended production path; document the per-instance limitation if Upstash is unset. |

## /onboard "5 steps · < 90 seconds" Claim (literal page-eyebrow promise)

`apps/studio/src/app/onboard/page.tsx` displays the eyebrow `§ ONBOARD · 5 STEPS · < 90 s` — that's a literal time budget the page makes to the user.

| Test | Action | Pass condition |
|---|---|---|
| 5 distinct steps | Open `/onboard` on a fresh wallet. | Step indicator clearly shows 1-of-5, advances through 5 distinct screens. |
| Time budget under 90s | Stopwatch the flow on a primed wallet (already-funded, MetaMask ready). | Total flow ≤ 90 seconds, including MM signs. If > 90s, surface the timing gap. |
| First-receipt target | At the end of the flow, user holds a public Proof URL of a real AI run. | URL opens in incognito and renders FULLY VERIFIED ✓. |

## `@ivaronix/og-toolkit` SDK Quickstart (literal README code)

`packages/og-toolkit/README.md` advertises a 30-second quickstart. Run the exact code from the README, verify it works in a scratch project.

| Test | Action | Pass condition |
|---|---|---|
| Install from local workspace | In a scratch project: `pnpm add @ivaronix/og-toolkit` (file: path) | Module resolves; types come through. |
| Raw 0G primitives surface | Code from README: `const og = createOg({ network: 'testnet', privateKey: process.env.IVARONIX_SIGNER_KEY }); await og.chain.verifyChainId(); await og.storage.upload(myBuffer);` | `verifyChainId()` returns 16602; `storage.upload()` returns a Merkle root. |
| Receipt-aware one-liner | `const r = await og.runSkill({ skillId: 'github-audit', userPrompt: '...', context: '...', tier: 'standard', receipt: true });` | `r.finalText` populated; `r.receiptTxHash` is a real Galileo tx that opens on chainscan. |
| `pnpm publish --dry-run` | From `packages/og-toolkit/` | Dry-run succeeds; `files` array in package.json picks up `dist/`, `README.md`, `LICENSE` only (no source). |

## README.md Quickstart Walkthrough (the 60-second + 30-second commands)

The repo `README.md` has two specific quickstart blocks at §172 "Verify a real receipt right now" (60 seconds, no wallet) and §197 "Run a fresh receipt of your own in 30 seconds". Both must reproduce as written.

| Block | Command(s) | Pass condition |
|---|---|---|
| 60s verify (no wallet) | `git clone https://github.com/Pratiikpy/ivaronix.git oglabs && cd oglabs && pnpm install && pnpm exec tsx apps/cli/src/bin/ivaronix.ts receipt verify tests/fixtures/anchored-receipts/v1-anchored-id-8.json` | Output exits 0 with `Status: → ANCHORED ✓` (schema + hash + signature + chain anchor all PASS for the V1 fixture id=8). The 60s command does NOT include `--tee-independent` — that's the additional check covered in JUDGE_GUIDE.md step 1. Verified iter-19 cron: ANCHORED ✓ in <1s after `pnpm install` (clone + install excluded from the per-command timing). |
| 30s fresh receipt | `pnpm --filter @ivaronix/cli exec ivaronix demo` (after env config) | Anchors a real receipt in ~3-5s; prints proof URL + chainscan + verify command. README claim "30 seconds" — tester records actual time. |
| `npx ivaronix` (zero-clone) | On a clean shell: `npx ivaronix receipt verify <known-id>` | Bundle downloads, verifies, exits 0. |

## Wander-Cycle Autonomous Loop (planning-003 §A.4.1, §B-V2-3)

The autonomous wander-cycle runs `private-doc-review` against synthetic leases on a cron, anchoring receipts under a CI wallet. Headline-target: scale `1,644 manual` → `26K+ autonomous` mainnet receipts over 90 days.

| Test | Action | Pass condition |
|---|---|---|
| One-iteration smoke | `pnpm wander:cycle` (single iteration) | Generates a synthetic lease → invokes `ivaronix doc ask --skill private-doc-review` → real receipt anchored. Appends one JSONL line to `docs/wander-cycle-history.jsonl`. |
| Continuous loop | `pnpm wander:loop` for 10 minutes on testnet | Multiple iterations succeed without errors; no orphaned in-flight runs; history file grows monotonically. |
| Mainnet wander (queued) | After mainnet contracts deploy: set `WANDER_CYCLE_NETWORK=mainnet` + CI wallet env. | Same agent code, mainnet RPC + V2 address. `PENDING` until §A-2 + §A-V2-K1/K2 close. |

## Visual / UX Regression Baseline (from `docs/build/TEST_REPORT.md` B1-B9)

`TEST_REPORT.md` records 9 bugs that were FIXED on 2026-05-08. Each must STAY fixed — these are the visual/UX regression targets.

| Bug ID | What was broken | Regression check today |
|---|---|---|
| B1 | `ivaronix doc ask` didn't populate `billing.feeSplit` on receipt | Run `doc ask` against a skill with `fee_split: 9000/1000`; receipt JSON has the split. |
| B2 | `doc ask` skipped 0G Storage upload | Run `doc ask`; receipt has `storage.evidenceRoot` (or honest null if indexer unreachable). |
| B3 | Adding `fee_split` to a skill manifest changed canonical hash → MISMATCH | When you edit a skill manifest, the version field must bump (`0.2.x → 0.3.0`). `ivaronix skill inspect` flags stale-hash registrations. |
| B4 | `/skill/[id]` had horizontal scrollbar at 1440px | Open `/skill/private-doc-review` at 1440×900 — no horizontal scrollbar. |
| B5 | Mobile header had no nav links (only Connect button) | At 375×812, hamburger menu opens with the full nav list. |
| B6 | Studio fonts were system-sans + Times New Roman | Inspect any heading: `font-family: 'Outfit'`; italic accents are `'Instrument Serif'`; mono is `'JetBrains Mono'`. |
| B7 | Card radii were 4-8px (vs brand's 14-16px) | DevTools computed style on any card: `border-radius` is from the brand token range (`10px`, `14px`, `16px`, `20px`). Buttons are pill-shaped (`999px`). |
| B8 | Body foreground was `#1a1a1a` (vs `#0a0a0a`) | DevTools `:root` computed style: `--color-ink: #0a0a0a`. |
| B9 | Cards had box-shadow only (no `translateY` lift) on hover | Hover any card: `transform: translateY(-2px)` + tinted border + larger shadow. |

## Observability Wiring State

| Item | State | Test |
|---|---|---|
| Sentry DSN slot | `SENTRY_DSN` env var documented in `.env.production.template` (commented out) — actual wiring NOT implemented in Studio source yet. | `grep -ri 'sentry' apps/studio/src/` returns 0 hits today. Mark `PENDING` against `§B-V2-26` (production error capture). When wired, test: a deliberate runtime error in `/api/run` produces an entry in the Sentry dashboard within 60s. |
| Vercel runtime logs | Live. | `vercel logs ivaronix-<deploy-id>` returns runtime errors with stack traces. Already tested in OG-image diagnosis. |
| Upstash Redis rate-limit observability | Live (when configured). | Hit `/api/run` from multiple IPs; confirm bucket increments are visible in Upstash dashboard. |
| Correlation ID across UI / CLI / logs | `PENDING` (`§ Observability And Debuggability` table mentions "if available"). | If a receipt id (or a separate request id) links UI ↔ CLI ↔ server log lines, capture an example. If not, mark `PENDING`. |

## Specific Studio Affordances (planning-002 W1 + W6, Tier-4)

These small affordances make the demo work end-to-end. Plan must verify each.

| # | Affordance | Where | Test |
|---|---|---|---|
| 1 | **"Use sample contract →" one-click** | Studio `/` RunPanel (planning-002 W1 · single-click demo) | Click the button on a fresh load. Sample text + question + skill pre-fill correctly. Hit Run → real receipt anchored. Crucial for the 90-second Step 3 in JUDGE_GUIDE. |
| 2 | **`?storage=<rootHash>` cross-machine fallback** | `/data-room/[id]?storage=<rootHash>` (planning-002 W6) | Open the URL on a clean machine (no local manifest). Page falls back to fetching from 0G Storage and renders the room. This is the cross-machine fix for the §3 OPEN disclosure. |
| 3 | **Print / save-as-PDF button** | `/r/<id>` (Tier 4 · 4A · paper-artifact) | Click Print on a real receipt page. The print stylesheet renders a clean, paper-quality artifact (no header chrome, no nav). Save as PDF and confirm: receipt id, tx hash, key fingerprint, TIER chip all readable on paper. |
| 4 | **`/r/<id>/print` standalone route** | The print-optimized variant of the receipt page | Open directly; renders identically to print preview from `/r/<id>` but without the toolbar interfering. |
| 5 | **Faucet link prompt** | When wallet balance < threshold | UI surfaces a link to `https://faucet.0g.ai` with the user's address and the exact amount needed. Tested via deliberately near-empty Wallet B. |
| 6 | **Embed iframe sizing** | `/embed/r/<id>` | Renders at multiple viewport sizes (400×300, 800×600, 1200×800). No clipping, no horizontal scroll. |

## Mainnet-Redeploy-Day Test Rows (the 4 contracts still on V1)

Today (testnet), only `ReceiptRegistry` and `AgentPassportINFT` have V2 deployed. The other 4 (`CapabilityRegistry`, `MemoryAccessLog`, `SkillRegistry`, `SubscriptionEscrow`) are still V1. When each V2 redeploys, these rows must run.

| Contract V2 | Reference | Test on redeploy day |
|---|---|---|
| `CapabilityRegistryV2` (§B-V2-15) | Closes social-graph leak + K-22 `consumeRead` DoS | After deploy: `consumeRead` rate-burst test (rejects floods); memory grants/revokes work identically to V1; existing V1 grants remain readable (or are migrated cleanly). |
| `MemoryAccessLogV2` (§B-V2-16) | Closes log-spoofing | After deploy: Wallet B's writes to Wallet A's namespace revert; existing V1 logs remain readable. |
| `SkillRegistryV2` (§B-V2-17) | Closes squatter risk | After deploy: cannot re-register an already-claimed skill name; existing V1 skills remain readable. |
| `SubscriptionEscrowV2` (§B-V2-18) | Adds AGENT_AUTO accountability | After deploy: drain without agent-address claim reverts; `subscription_skill_exec` receipts (type slot 9) start producing. |

On each V2 redeploy, also add the new address to `contracts/deployments/testnet.json` and `KNOWN_RECEIPT_REGISTRIES` in `@ivaronix/core` per the CLAUDE.md §15 bookkeeping rule.

## Submission-Day Smoke (final 30-minute reproducer)

The submission portal moment. Tester runs this final pass right before clicking "Submit."

| Step | Action | Pass condition |
|---|---|---|
| 1 | Confirm CI on `main` HEAD is `● success` | `gh run list --limit=2` shows both workflows green. |
| 2 | Confirm Vercel deploy is `● Ready` and aliased to `ivaronix.vercel.app` | `vercel ls ivaronix` + curl the URL. |
| 3 | Run JUDGE_GUIDE 5-min walkthrough on a fresh machine | Stopwatch ≤ 5 min; every claim in JUDGE_GUIDE.md verified. |
| 4 | Run `ivaronix demo` from a fresh shell | One receipt anchors in ~3-5s; prints proof URL + explorer URL + verify command. |
| 5 | Open the proof URL in incognito | Page renders FULLY VERIFIED ✓ without auth. |
| 6 | Run `ivaronix receipt verify <new-id> --tee-independent` | Returns FULLY VERIFIED ✓. |
| 7 | Open chainscan tx link from the demo | Tx exists, calling contract is V2, signer is operator. |
| 8 | Confirm README + PITCH + JUDGE_GUIDE numeric claims match `numbers.json` | `pnpm numbers:check && pnpm docs:check`. |
| 9 | Confirm `pnpm wording-lint && pnpm brand:check && pnpm receipt-types:check` | All green. |
| 10 | Submit via the OG APAC portal with: live URL, GitHub repo, demo video link, proof pack folder, fresh CLI verify output | Submission accepts. |

If any step fails, DO NOT submit. Fix the failure, re-run the smoke from step 1.

## Final Mainnet-Ready Checklist

Run this only after testnet QA is green.

| Check | Wallets | Expected Result |
|---|---:|---|
| Mainnet env values | 0 | RPC, chain ID, explorer URLs, contract addresses, and API URLs are correct. |
| Mainnet wallet funded | 1 | Operator/user wallet has enough 0G for deploy and receipt anchoring. |
| Mainnet contracts deployed | 1 | Contract addresses are recorded and ChainScan links open. |
| Mainnet receipt run | 1 | One real action creates one real mainnet receipt. |
| Mainnet proof page | 0 | Public receipt page opens and links to mainnet explorer. |
| Mainnet CLI verify | 0 | `ivaronix receipt verify <mainnet-id>` passes. |
| Storage proof | 1 | Storage root is real AND round-trip verified (download the blob back, byte-diff against the original). |
| Demo video | 1 | Final 3-minute demo shows product, user flow, and 0G usage. |
| README/docs | 0 | Docs explain how to reproduce and verify without hype. |

## Honest Known Limitations To Watch

The deploy is live and functional, but the following items are not closed yet. Mark each one in `QA_TEST_PROGRESS.md` with the listed status — do not retest with a different expectation.

| Item | Status | Where |
|---|---|---|
| OG-image / social-card routes | `BLOCKED` (Vercel-specific font asset issue · graceful 503) | `docs/USER_TODO.md §B-V2-2` — 4 attempted fixes documented + 4 remaining strategies. Blocks no feature. |
| Memory MiniLM embedder on Vercel | `PENDING` (uses hashing-trick fallback by design — sharp + onnxruntime would blow the 250 MB function cap) | Architectural — needs a hosted embeddings API or WASM-only model. Memory recall still works; just less semantic. |
| Storage upload + retrieve round-trip | `PENDING` (code wired; round-trip not yet verified live) | Punch-list item #26 — fetch the `evidenceRoot` back from the indexer and byte-diff. |
| Mainnet (Aristotle, chainId 16661) deploy | `PENDING` (operator-action — fund deployer wallet) | `docs/USER_TODO.md §A-2` + `§A-V2-*` redeploys. |
| Telegram bot live | `BLOCKED` (BotFather token required from operator) | `docs/USER_TODO.md`. |
| MCP server in Claude Desktop / Cursor | `BLOCKED` (UI required) | `docs/USER_TODO.md`. |
| Go reference verifier in CI | `BLOCKED` (Go runtime not installed on runner) | `docs/USER_TODO.md §A-V2-K15-Go`. |

For every other tested feature, the bar is the new one stated in this plan — no green without proof, no fake fallback, full UI ↔ CLI ↔ chain agreement.

The wording "Studio evidence upload still needs full production wiring" from earlier drafts is now **STALE** — `/api/run` uploads to 0G Storage on every anchor since commit `7b1addc` (`packages/runtime/src/pipeline.ts` `anchorReceipt`). Storage should be green by default; pending is the exception.

## Final Tester Sign-Off

The tester should only mark Ivaronix ready when:

1. The main user flow works from UI.
2. The same proof can be verified from CLI.
3. Wallet and chain actions are real.
4. Screenshots/videos/receipt links are saved.
5. No visible page feels broken or unfinished.
6. Any future or pending feature is clearly labeled.

Final standard:

> Function, proof, UX, and testing must all land together.
