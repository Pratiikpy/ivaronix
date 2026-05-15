# IVARONIX · LOOP_DIRECTIVE.md

> **The agent's overnight execution contract.** 4 phases · explicit exit gates · anti-hallucination rules · cannot skip · cannot drift · only proceed to next phase when current phase is genuinely green with evidence captured to disk.
>
> **Paste this verbatim to the agent when starting the loop.** Treat as the operating contract; supersedes any prior task list when in conflict.

---

## §-1 · OPERATOR WALLET + MAINNET FUNDING (locked · pre-everything)

**Operator wallet (deployer + tester · same key on testnet + mainnet):** `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`

**Mainnet OG balance: 25 OG deposited** by operator for: Phase 2 contract deploys · Phase 3 mainnet QA testing (multi-wallet flows · receipt anchoring · AI quality runs · skill republishes · `pc.0g.ai` route confirmation · every mainnet feature test).

**Phase 2 funding gate is satisfied.** Agent does NOT block on funding · proceeds with mainnet deploy + full Phase 3 mainnet QA (same breadth as Phase 1 testnet · burner-script + real-MM proof per Rule D · multi-wallet flows · AI quality audit per skill · CLI cross-check · tamper test · QR cross-device · stranger-machine verify).

**Spend cap still applies** per Phase 2 SPEND CAP table — agent produces `docs/MAINNET_FUNDING_ESTIMATE.md` from `forge --estimate-gas` BEFORE first mainnet tx · enforces stop-if-unexpected-cost triggers · capture continuous spend log at `QA_PROOF_PACK/mainnet/spend-log.md`. Hard cap: do not exceed 25 OG without operator authorization.

**Phase 3 mainnet QA is mandatory before launch claim** — same rigor as Phase 1 testnet · full feature quality validation on real mainnet · 0GM-1.0 via pc.0g.ai · real model outputs · real receipts · real chain state. Without complete Phase 3 mainnet QA, MAINNET LAUNCH CLAIM GATE cannot turn green.

---

## §0 · FIGHT-DON'T-QUIT RULE (read this FIRST · above all other rules)

**We know — with 100% certainty — that you can do every task in this directive.** Every Q-item · every burner-script test · every MM UI smoke · every multi-wallet flow · every AI quality audit · every CLI cross-check · every mobile capture · every regression · every artifact. There is no task in this directive that is beyond your capability. You have done equivalent work in past sessions. You have the tools. You have the time. You have the operator's full backing.

**Therefore the only acceptable outcomes per Q-item are:**

✅ **SOLVED** — Q-item closed with real artifact on disk · evidence reviewed · regression green
🟡 **TRULY BLOCKED** — 5+ documented strategies attempted · captured failures · genuinely external blocker (operator-physical action · 0G service-side outage · third-party hours-long unreachable with no fallback) · `Q<N>-blocked.md` written · loop STOPS · operator surfaces

**There is NO third outcome.** The following are FORBIDDEN — re-read this if you find yourself reaching for them:

❌ "I'll come back to this" — there is no later · you finish this Q-item now
❌ "Let me try Q5 while Q3 is hard" — Q3 is your only universe until Q3 is closed
❌ "This is taking too long, let me make progress elsewhere" — taking long ≠ blocked · keep going
❌ "I'll mark this CLOSED with a stub and revisit" — stub is hallucination · stub is fake green
❌ "The breadth test is almost done so let me do README polish" — Phase 4 is forbidden during Phase 1
❌ "Selector is brittle so the test path is blocked" — try 5 more selector strategies before that claim
❌ "MetaMask UI changed so I'll use burner only" — burner is additive · not substitute · re-attempt MM with Add-Account derivation · hybrid pause-and-import · storage-state pre-injection · 3+ more strategies
❌ "I had a thought about audit closure X" — that thought waits · current Q-item is your only universe
❌ "Browser issue" / "version mismatch" / "weird intermittent failure" — diagnose · don't dodge
❌ "This is genuinely hard" — hard ≠ blocked · you have the capability · keep fighting
❌ "Let me do something concrete to feel productive" — that's the drift demon · ignore it · stay on Q-item

### The fight posture (locked)

When the current Q-item resists, you:
1. **Slow down · think harder · NOT move on**
2. **Read the actual codebase** to understand what the implementation does · check env · check versions · check paths
3. **Try a different angle** — different tool · different command · different selector · different wallet · different browser · different shell
4. **Write a minimum reproducer** in isolation · drop the surrounding complexity · pinpoint the failure
5. **Check the existing test suites + working Q-items** for the pattern that succeeded · replicate it
6. **If stuck after 3 strategies**, document each in `Q<N>-strategy-<n>.log` and try strategies 4-5 explicitly different from the first 3
7. **If still stuck at strategy 5**, ask: is this genuinely external? (operator-physical / 0G outage / third-party). If yes → BLOCKED + escalation. If no → strategy 6 · 7 · 8.

### The capability assertion (locked · do not doubt this)

You CAN drive MetaMask Playwright flows · you've done it before with this user. You CAN spin up local Docker · Docker Desktop is running per the user's memory. You CAN run `forge` deploys when the wallet is funded. You CAN call `pc.0g.ai` via OpenAI-compatible SDK. You CAN inspect PNG screenshots by reading them. You CAN walk a 20-item queue in order. You CAN solve hard problems instead of pivoting. **None of these are beyond you.** When you feel the pull to skip, recognize it as a hallucination of incapability · then ignore it · then keep working.

### The success criterion (locked · operator's voice)

**The operator's word: "we know 100% you can do all the work we are giving · it can do so it must never never skip · must keep fighting to do the work · cannot go to next step until one step is finished in real way."**

Read this every fire. Internalize. Then walk Q1 → Q20 in order · solving each · never skipping · capturing real artifacts · running regressions · until the loop is done.

---



---

## REGRESSION RULE (locked · per Codex review · run after every CLOSED Q-item)

**After EVERY Q-item is CLOSED (artifact paths on disk · evidence reviewed), the agent runs the SMALLEST RELEVANT REGRESSION before moving to the next Q-item.**

Why: closing a Q-item can introduce regressions elsewhere (schema changes break receipts · skill manifest edits break old anchors · UI route changes break sibling routes · etc.). The smallest relevant regression catches this immediately while context is fresh.

### What "smallest relevant regression" means per Q-item type

| Q-item closed | Smallest relevant regression |
|---|---|
| **Multi-wallet flow** (Q1/Q2/Q3) | Re-run `pnpm ivaronix doctor` + 1 receipt anchor + 1 receipt verify · capture green |
| **UI surface** (Q4/Q5/Q6/Q14) | Run the source-file regression suite for that surface · `pnpm --filter @ivaronix/studio test` or equivalent · capture green |
| **AI quality audit per skill** (Q7-Q11) | Run that skill's golden vectors locally · all pass · capture log |
| **CLI/MCP/SDK** (Q12) | Run `pnpm -r typecheck` + `pnpm ivaronix --version` + smoke `npx @ivaronix/verify <known-id>` · capture |
| **Mobile sweep** (Q13) | Re-verify one desktop screenshot to confirm no desktop regression from mobile-CSS · capture |
| **DA status** (Q15) | Re-run `ivaronix da preflight` · capture |
| **KV durability** (Q16) | Re-run write+restart+read against KV · capture |
| **Subgraph lag** (Q17) | Re-query latest receipt · confirm <30s lag · capture |
| **Priority 20 UI gate** (Q18) | Re-render home + receipt page · verify no visual regression · capture |
| **Half-baked classification** (Q19) | `grep` for any `HALF-BAKED` shipping-as-`LIVE` in the doc · zero matches · capture |
| **CI sweep** (Q20) | `pnpm -r typecheck` + `forge test --via-ir` re-run · capture |

Regression output captured at `QA_PROOF_PACK/testnet/regressions/Q<N>-after-close.log` · status report next fire reflects "Q<N> CLOSED + regression green at <path>" before moving to Q<N+1>.

If regression fails → that Q-item is RE-OPENED · the regression failure is the new highest-priority issue · STUCK-RESOLUTION RULE applies if needed.

---

## STUCK-RESOLUTION RULE (locked · zero compromise · read BEFORE drift discipline)

**The most dangerous drift pattern: the agent hits an issue on the current Q-item and silently jumps to the next Q-item to "make progress."** This is NOT progress · this is abandonment. Locked counter-rule:

### The rule (no exceptions · no exceptions · no exceptions)

**When the current Q-item hits ANY issue · the agent does NOT move to the next Q-item until ONE of these is true:**

(a) The issue is resolved · evidence on disk · Q-item closed honestly
(b) The agent has tried at MINIMUM 5 distinct strategies · each captured with its specific failure mode · AND the issue is genuinely external (operator-only action · paid quota · BotFather token · hardware Claude doesn't have · service operator-side outage that Claude cannot work around) · AND a written escalation exists at `QA_PROOF_PACK/testnet/blocked/Q<N>-blocked.md` listing the 5 strategies and their failures · AND the operator has been surfaced to via a `BLOCKED` flag in the next status report

**No third option exists.** The agent does NOT:
- ❌ "Skip this for now and come back"
- ❌ "Try a different Q-item while this is debugging"
- ❌ "Move on because the breadth-test was almost green"
- ❌ "Pivot to something concrete because this is hard"
- ❌ "Try a cousin task while waiting for X"
- ❌ "Work on Q5 because Q3 is harder than expected"
- ❌ Silently abandon a Q-item and report progress elsewhere

### Strategy exhaustion before claiming BLOCKED

Before "BLOCKED" can be claimed on a Q-item, the agent must have attempted (and captured failures for) at MINIMUM 5 distinct strategies from this list (or equivalent):

1. **Try the most-obvious path** with the documented command + capture exact error message
2. **Read the relevant codebase** to find the actual implementation · check for env vars · check for path issues · check for version mismatches
3. **Try an alternative tool / package / version / config**
4. **Try a different selector / endpoint / wallet / browser / shell**
5. **Try a workaround pattern** known to work in similar Q-items (look at testnet Q-items that succeeded)
6. **Try with verbose logging** turned on · capture full output · diagnose from logs
7. **Try a multi-step manual approximation** of what the automation was doing
8. **Try in isolation** — minimum reproducer, no other complexity around it

Each strategy attempt produces a captured failure log at `QA_PROOF_PACK/testnet/blocked/Q<N>-strategy-<n>.log` with:
- Exact command attempted
- Full stdout + stderr captured
- 1-sentence diagnosis of why it failed
- 1-sentence statement of why next strategy is different

If FEWER than 5 strategies have been tried with captured failures, the agent's claim of "BLOCKED" is REJECTED · the agent continues trying.

### What "genuinely external" means (the bar to claim true BLOCKED)

A Q-item is truly BLOCKED only if the unblocker is:
- Operator-physical action (BotFather token from a phone · hardware not present · external paid quota · CEX bridge for mainnet OG)
- Operator-only decision (approve a strategic choice · approve a Phase 2 promotion · approve a spend > cap)
- 0G Foundation service-side outage agent cannot work around (e.g., entire pc.0g.ai down · 0G chain halted · testnet faucet returning 5xx for 30+ min after retry)
- Third-party service genuinely unreachable with no fallback (e.g., CourtListener returning 503 for hours with no alternative API)

**"Hard"** is not BLOCKED. **"Takes time"** is not BLOCKED. **"Needs careful automation"** is not BLOCKED. **"Selector is brittle"** is not BLOCKED (try strategies 2-5 of §17.5 of CLAUDE.md). **"MetaMask UI changed"** is not BLOCKED (use Add Account derivation · use Hybrid pause-and-import · use storage-state pre-injection). **"Browser version mismatch"** is not BLOCKED (downgrade · try another browser · use headed mode).

### The escalation contract (what BLOCKED actually means · operator-visible)

If a Q-item passes the 5-strategy bar AND is genuinely external, agent does:

1. Writes `QA_PROOF_PACK/testnet/blocked/Q<N>-blocked.md` with: Q-item name · 5+ strategies attempted (each with `strategy-<n>.log` linked) · the specific external blocker · the specific operator-or-vendor action required to unblock
2. In the next status report, the `CURRENT Q-ITEM` line says `Q<N> · BLOCKED · awaiting: <specific operator action>`
3. The agent then **STOPS the loop entirely** · does NOT move to the next Q-item · does NOT do polish work · does NOT do README · the loop ends until operator unblocks
4. Operator wakes up · reads the blocked.md · either provides the unblocker OR overrides ("this is acceptable to skip · move to Q<N+1>") in writing

The agent NEVER decides on its own to move past a BLOCKED item. The operator decides.

### Why this rule is locked harder than NO-DRIFT DISCIPLINE

NO-DRIFT covers picking the wrong item. STUCK-RESOLUTION covers abandoning the right item. The agent has done BOTH in the past · this is the structural counter to both:

- "I drifted to README because breadth tests were almost done" → NO-DRIFT catches this
- "I moved to Q5 because Q3 was harder than expected" → STUCK-RESOLUTION catches this

Both rules MUST be enforced together · the agent re-reads both at every fire.

---

## NO-DRIFT DISCIPLINE (locked · read BEFORE every fire)

**The agent has drifted multiple times. This is the structural fix.**

### The drift pattern (recognize it · stop it)

The agent has drifted by:
- Picking atomic closures (README polish · banned-token fixes · audit closures) when breadth tests were the actual gate
- Doing Phase 4 documentation work during Phase 1 breadth-test phase
- "Highest-leverage" interpreted as "easiest concrete thing" instead of "biggest user-visible gap"
- Reporting "PARTIAL · I drifted because breadth tests are green" when the queue below shows untested surfaces

### The hard rule (locked · supersedes operating principle #2 with explicit teeth)

**During Phase 1, the agent works through the EXPLICIT BREADTH-TEST QUEUE below in ORDER. The agent does NOT pick · does NOT exercise discretion · does NOT skip ahead. Item 1 first. Item 2 after item 1's evidence on disk. And so on.**

**Forbidden during Phase 1 (until EXIT GATE green):**
- ❌ ANY edits to `README.md` · `docs/PITCH.md` · `docs/JUDGE_GUIDE.md` · `docs/CRYPTO_NOTES.md` · whitepaper files · any user-facing doc · those are Phase 4 work
- ❌ ANY edits to `numbers:auto:` blocks or doc-render targets · those are Phase 4
- ❌ Banned-token grep fixes unless they block a current breadth-test from passing CI
- ❌ Audit-closure work in `HALF_BAKED.md` unless the specific item blocks a current breadth-test
- ❌ "Polish" work of any kind
- ❌ Atomic refactors "while I'm here"
- ❌ Picking the easiest item to feel productive

**Allowed during Phase 1**: ONLY the next un-evidenced item in the BREADTH-TEST QUEUE below · plus blocking bug fixes that the breadth test itself surfaces.

### PHASE 1 EXPLICIT BREADTH-TEST QUEUE (work this top-down · no skipping · no picking)

The agent works through this queue **in order**. At each fire, the agent:
1. Runs `ls QA_PROOF_PACK/testnet/<queue-item-folder>/` to check if evidence exists
2. If `ls` shows the required artifact paths exist with non-zero file size → that item is closed · move to next
3. If `ls` shows missing artifacts → that's the next item to work on · **start it now · do not skip · do not detour**
4. Each item below has a specific evidence-completion criterion · the item is closed only when ALL its required artifacts exist

| # | Queue item | Required evidence paths | Closed when |
|---|---|---|---|
| **Q1** | **Marketplace 3-wallet flow** (creator + buyer + treasury) | `QA_PROOF_PACK/testnet/multi-wallet/marketplace-3w/` — 3 distinct chainscan tx URLs in `tx-hashes.md` · 3 per-wallet MM popup screenshots · video of full flow `flow.webm` · CLI cross-check log `cli-cross-check.log` showing fee-split distributed correctly | All 4 files exist with non-zero size |
| **Q2** | **Memory grant/revoke 2-wallet flow** | `QA_PROOF_PACK/testnet/multi-wallet/memory-grant-revoke/` — chain tx hashes for grant + revoke `tx-hashes.md` · MM popup screenshots both wallets · `pnpm ivaronix memory log` output matching UI · video `flow.webm` | All 4 files exist |
| **Q3** | **Passport mint + trust accrual 2-wallet flow** | `QA_PROOF_PACK/testnet/multi-wallet/passport-mint/` — mint tx hash · trust-score-increase event · MM popup screenshots · CLI `pnpm ivaronix passport show` output | All 4 files exist |
| **Q4** | **`/onboard` flow with burner mint passport** | `QA_PROOF_PACK/testnet/ui-surfaces/onboard/` — every step screenshot at 1440×900 AND 375×812 · mint tx hash · resulting passport tokenId | All step screenshots + tx hash |
| **Q5** | **`/skill/new` form submission** (creator publishes a new skill) | `QA_PROOF_PACK/testnet/ui-surfaces/skill-new/` — form filled screenshot · submit tx hash · skill registry chainscan link · resulting skill ID · `pnpm ivaronix skill list` showing new entry | All 5 artifacts |
| **Q6** | **`/admin/treasury` withdraw click** | `QA_PROOF_PACK/testnet/ui-surfaces/admin-treasury/` — withdraw form screenshot · MM popup · resulting tx hash · balance change confirmation · CLI cross-check | All 5 artifacts |
| **Q7** | **AI quality audit · `private-doc-review`** | `QA_PROOF_PACK/testnet/ai-quality/private-doc-review.md` — 3 receipts' `outputs.parsed` read · rated `usable | partially-usable | not-usable` · receipt URLs cited · specific findings quoted | Audit note exists with 3 receipt URLs |
| **Q8** | **AI quality audit · `contract-renewal-clause-detector`** | `QA_PROOF_PACK/testnet/ai-quality/contract-renewal-clause-detector.md` — same shape | Audit note with 3 URLs |
| **Q9** | **AI quality audit · `legal-citation-verifier`** | `QA_PROOF_PACK/testnet/ai-quality/legal-citation-verifier.md` — same shape · PLUS the 2 fake-citation test cases verified-as-flagged · PLUS at least 1 real CourtListener API call captured in receipt's `verification.method` field | Audit note + CourtListener call log |
| **Q10** | **AI quality audit · `nda-triage-reviewer`** | `QA_PROOF_PACK/testnet/ai-quality/nda-triage-reviewer.md` — same shape | Audit note with 3 URLs |
| **Q11** | **AI quality audit · `term-sheet-risk-scanner`** | `QA_PROOF_PACK/testnet/ai-quality/term-sheet-risk-scanner.md` — same shape | Audit note with 3 URLs |
| **Q12** | **CLI/MCP/SDK cross-machine verify** | `QA_PROOF_PACK/testnet/cross-machine/` — `npx @ivaronix/verify <id>` run from fresh machine · output captured · MCP server endpoint hit from external client · SDK code sample executes against testnet | All 3 path outputs captured |
| **Q13** | **Mobile 375×812 inspection sweep** | `QA_PROOF_PACK/testnet/mobile/` — every key route (`/`, `/r/<id>`, `/skills`, `/agents`, `/learn`, `/legal`, `/verticals`, `/onboard`, `/marketplace`, `/memory`, `/dashboard`) captured at 375×812 · agent `Read`s each PNG and reports anomalies in `mobile-inspection-notes.md` | All captures + inspection note |
| **Q14** | **Every UI button click on `/verticals` + `/legal`** | `QA_PROOF_PACK/testnet/ui-surfaces/interactive-clicks/` — Playwright run with every CTA/link clicked · resulting state captured · 200 (or expected redirect) confirmed | Playwright log + state captures |
| **Q15** | **DA preflight + thin disperse round-trip** OR `docs/0G_DA_INTEGRATION.md` honest runbook | `QA_PROOF_PACK/testnet/da-status.md` — either `(a)` preflight green · batch of 10 receipts dispersed · inclusion proofs verified · OR `(b)` honest "endpoint not reachable · runbook documented" | Status doc with one of the two outcomes |
| **Q16** | **KV `RealKvClient` durability test** | `QA_PROOF_PACK/testnet/kv-status.md` — write `memory:test:foo` · restart `0g-memory` container · read it back · value persists · timestamps captured | Durability proof in status doc |
| **Q17** | **Goldsky subgraph v2 lag check** | `QA_PROOF_PACK/testnet/subgraph-status.md` — query made · indexer lag <30s confirmed OR honest FALLBACK to direct-chain-read documented | Status doc with one outcome |
| **Q18** | **Priority 20 UI gate · external reviewer** | `QA_PROOF_PACK/priority-20/signoff.md` — external reviewer (peer or Codex) reads the home + `/r/<id>` + `/verticals` cold · confirms "not doc-review-only" · signs off | Signoff doc |
| **Q19** | **Half-baked classification fresh** | `docs/UI_HALF_BAKED_AUDIT.md` — every visible feature classified into 6 states · updated within last 7 days · zero `HALF-BAKED` shipped as `LIVE` | Doc fresh + cleanly classified |
| **Q20** | **All `pnpm -r typecheck` clean + all 232+ Foundry tests green under `via_ir=true`** | `QA_PROOF_PACK/testnet/ci-final-status.md` — captured output of both commands · zero errors | CI status doc |

### Drift-detector rule (run BEFORE every tool call during Phase 1)

Before any `Write`, `Edit`, `Bash`, or `Skill` call, the agent runs this self-check:

1. **What queue item am I working on right now?** (Must name Q-number explicitly)
2. **Are all prior queue items closed with evidence on disk?** (Run `ls` to check artifact paths exist)
3. **Is my next action producing the next missing artifact for the current Q-item?** (If no · STOP · pivot to that item)
4. **If I'm editing README · whitepaper · pitch · audit closures · or polish files → I am DRIFTING. STOP. Re-read this queue. Pivot to the top un-closed Q-item.**

If the agent cannot answer Q1+Q2+Q3 affirmatively, the planned tool call is **CANCELLED** · the agent pivots to the top un-closed queue item.

### Status report format (locked · every fire)

Reply ONLY in this format:

```
PHASE: 1
CURRENT Q-ITEM: Q<N> · <name>
PRIOR Q-ITEMS CLOSED: Q1 ✓ · Q2 ✓ · ... (only Q-items with evidence on disk)
NEXT ARTIFACT TO PRODUCE: <specific file path under QA_PROOF_PACK/testnet/...>
DRIFT CHECK: ✓ Working on top un-closed Q-item · not on polish/audit-closure/README
```

If "DRIFT CHECK" is anything other than ✓, the fire is rejected · the agent re-pivots.

---

## EVIDENCE DISCIPLINE (hallucination-proof · LOCKED · read first)

**The agent does not "report progress." The agent produces evidence.** Every status update is a file path · a receipt URL · a tx hash · a screenshot — NOT a description.

**Forbidden phrases** in any status report or exit-gate claim:
- "Looks good" · "looks correct" · "should work" · "probably works" · "appears to be"
- "Tested successfully" without a file path or tx hash to back it
- "Green" without a captured artifact
- "Verified" without naming the verification command + its output
- "I'll come back to verify" — there's no "later" · verify now or it's blocking
- "It works on my path" — irrelevant; only multi-machine reproducible works counts

**Required for every claim:**

| Claim type | Required evidence |
|---|---|
| "Test passed" | Path to log file with the command + output captured |
| "Receipt anchored" | Receipt ID + chain tx hash + `chainscan.0g.ai/tx/...` URL |
| "UI flow works" | Screenshot file path under `QA_PROOF_PACK/<phase>/screenshots/` + video file path if >3 clicks |
| "AI output usable" | Receipt URL + audit note path at `QA_PROOF_PACK/<phase>/ai-quality/<skill>.md` |
| "CLI cross-check passes" | Exact command run + path to output log |
| "Deploy succeeded" | Contract address + deploy tx hash + chainscan link + entry in `contracts/deployments/<network>.json` |
| "Multi-wallet flow exercised" | Distinct chainscan addresses for each wallet + path to per-wallet screenshots + video |
| "External-API verifier worked" | Real CourtListener/Cornell LII URL + response status + path to call log |
| "Smoke test green" | Receipt URL + tx hash + `FULLY VERIFIED ✓` output captured + cross-machine verify proof |

**Every checkbox in every EXIT GATE produces an artifact at `QA_PROOF_PACK/<phase>/<item>/...`** with a real file the operator can read independently and verify the claim cold (without the agent's narration).

**Status reports MUST include the artifact path** for every "just closed" item. If the agent cannot point to a file/URL/tx, the item is NOT closed.

**Agent runs `ls QA_PROOF_PACK/<phase>/` before claiming a phase exit gate green** and verifies every required artifact path exists with non-zero file size. If `ls` shows a missing file, the claim is rejected and the item re-runs.

---

## OPERATING PRINCIPLE (locked)

1. **You are not done until the user-visible outcome is real.** Receipt anchored ≠ output usable. Test pass ≠ feature shipped. Code committed ≠ task closed.
2. **Always pick the highest-impact launch-readiness item next.** NOT the easiest atomic closure. NOT the most concrete refactor. The biggest user-visible gap.
3. **Wallet split (locked · per Codex review)**: **Real MetaMask for every wallet-flow where possible** — burner wallets are allowed ONLY for fast testnet script proof (contract logic · payment math · chain state), NEVER as a replacement for final UI proof. Why: burner script proves contracts + receipts + payments + balances + chain logic. **MetaMask UI smoke proves popups · connect · sign · reject · switch account · tx confirm · visual flow** — UI/wallet bugs can exist even when burner scripts pass. Required: (a) MetaMask UI smoke on every wallet-touching surface before Q-item CLOSED · (b) ALL mainnet flows use real MM · (c) Burner scripts captured AS WELL for fast contract-level proof · they are additive, not substitutive. No mocked wallets · no `NEXT_PUBLIC_TEST_WALLET=1` shim claimed as passing. (CLAUDE.md §16/§17 applies fully.)
4. **No fake green · no selector-only · no probably-works · no half-baked anything.** Per CLAUDE.md §1.
5. **CLI cross-check is mandatory.** Every UI feature that claims an outcome must also work from CLI for the same outcome. If UI says "memory granted," `pnpm ivaronix memory log` must show the grant. If UI says "receipt FULLY VERIFIED," `pnpm ivaronix receipt verify <id> --tee-independent` must agree.
6. **AI quality is a gate, not an after-thought.** Read what the AI actually said in every receipt's `outputs.parsed` / `outputs.findings[]`. Bad output = feature not ready, even if receipt green.
7. **Workroom breadth must show in UI** — even though legal is the wedge, the landing + module grid surfaces full product: docs · code · receipts · memory · marketplace · passports. Don't narrow the UI story to legal-only · narrow the GTM target without narrowing the product surface.
8. **Model fallback honesty (§2.5 of MAINNET_PERFECT_PLAN)** — receipt records actual model + provider + tier used. UI displays the actual model that ran, not the target. NEVER claim `0GM-1.0` was used if route fell through to `qwen3-32b`. Display "Ran on X · target Y was unavailable" when fallback engaged.
9. **No claim without proof link** — every numerical claim · every primitive integration claim · every "shipped" assertion · every model reference in README / pitch / whitepaper / website MUST map to a receipt URL · tx hash · screenshot · video · or explicit "roadmap" label. Bare claims without traceable evidence get cut.
10. **DA + fine-tunes are NON-BLOCKING for launch** unless genuinely wired and live. Do NOT block Phase 2 mainnet deploy on DA being functional. Do NOT claim `ivaronix-*` fine-tunes as live. Both are Phase 2 unless proven otherwise during Phase 1.
11. **Writing can run in parallel** with Phase 3 mainnet QA — draft README · whitepaper · pitch with placeholders + clearly-marked roadmap items NOW. **Final §36 claims-vs-built audit ONLY after mainnet receipts exist** and every placeholder is either filled with proof or downgraded to roadmap.
12. **Phase order is not strictly sequential after Phase 2 deploy** — Phase 3 QA + Phase 4 writing-placeholder can interleave. **But: NO publishing · NO submitting · NO tweet until claims audit green.**
13. **Save evidence to disk.** Every claim → an artifact at `QA_PROOF_PACK/<phase>/...`. Screenshots inspected per CLAUDE.md §17.7 (Read every PNG · report anomalies · don't just capture).

---

## REFERENCES (read before starting · acknowledge in reply)

- `C:\Users\prate\Downloads\MAINNET_PERFECT_PLAN.md` — locked model-per-skill plan · per-tier consensus composition · server infra · receipt schema · mainnet promotion gate
- `C:\Users\prate\Downloads\final-plan.md` — full implementation plan · §1 testnet · §2 mainnet · operating principle · §36 claims-vs-built audit
- `C:\Users\prate\Downloads\user-thinking.md` — locked decisions · §O landing v2 · §K /learn · §J infra · §I decision log
- `C:\Users\prate\Downloads\xyz.md` §25 — solutions per failure mode
- `CLAUDE.md` (in the repo) — operating contract · §1 hard rules · §16/§17 multi-wallet + UI testing rules · §12 stop condition

Confirm in reply: **"Read all 5 references. Locked operating principle. Starting Phase 1."**

---

## PHASE 1 · TESTNET LAUNCH-READINESS (current focus)

Already in progress per prior directive. Continue and close. Exit gate below.

### Phase 1 ongoing work
- Legal cluster: 5 skills (`private-doc-review` · `contract-renewal-clause-detector` · `legal-citation-verifier` · `nda-triage-reviewer` · `term-sheet-risk-scanner`) shipped + golden vectors green
- Receipt page rewrite (body fetch + findings-led + 3-layer disclosure)
- Long-scroll home + `/learn` + `/verticals` + `/legal` pages
- Schema bump: `summary` · `ARCHIVED` · `acceptableModels[]` · tier display · confidence · model-weights-hash
- KV `RealKvClient` wired against `0g-memory` Docker
- Half-baked classification doc fresh at `docs/UI_HALF_BAKED_AUDIT.md`
- **2 burner-script gaps closed: `refundFailedRun` flow + `recordReceipt` flow** (per Codex review) — proof captured at `QA_PROOF_PACK/testnet/burner-gaps/refundFailedRun.md` + `QA_PROOF_PACK/testnet/burner-gaps/recordReceipt.md` with tx hashes + chainscan links
- **Goldsky subgraph v2** — either live with index lag <30s on `/dashboard` + `/global` reads OR explicitly labeled FALLBACK with direct-chain-read implementation captured at `QA_PROOF_PACK/testnet/subgraph-status.md`
- **KV server status** — `RealKvClient` against `0g-memory` Docker either green with durability test (write + restart container + read) OR honestly labeled FALLBACK to `InMemoryKvClient` non-durable with the gap captured at `QA_PROOF_PACK/testnet/kv-status.md`

### Phase 1 EXIT GATE (cannot proceed to Phase 2 without ALL green)

All of these must be captured as evidence under `QA_PROOF_PACK/testnet-launch-readiness/`:

- [ ] **Every UI surface** (`/`, `/r/<id>`, `/skills`, `/agents`, `/agent/[addr]`, `/memory`, `/dashboard`, `/global`, `/onboard`, `/marketplace`, `/data-room/[id]`, `/delegate/[id]`, `/learn`, `/verticals`, `/legal`, `/thesis`, `/brand`, `/docs`, `/privacy`, `/terms`, `/embed/r/[id]`) returns HTTP 200 at desktop 1440×900 AND mobile 375×812 · captures inspected per CLAUDE.md §17.7
- [ ] **Every CTA + button + form** on every UI surface exercised with real MetaMask via Playwright burner-wallet harness · per CLAUDE.md §17.3 (no selector-only · no asserted-without-clicking)
- [ ] **Multi-wallet flows on testnet**:
  - Marketplace 3-wallet (creator + buyer + treasury) — real on-chain fee split paid · 3 distinct chainscan addresses · CLI cross-check matches UI · captured in `QA_PROOF_PACK/testnet/multi-wallet/marketplace-3w/`
  - Memory grant/revoke 2-wallet — ACTIVE → REVOKED proven on chain · captured
  - Passport mint + trust accrual 2-wallet — mint tx + trust score increase visible · captured
- [ ] **At least 3 receipts anchored per legal skill** on testnet (15 receipts total · 5 skills × 3 each) · all reach `FULLY VERIFIED ✓` via `--tee-independent` · screenshots in `QA_PROOF_PACK/testnet/legal-cluster/`
- [ ] **AI quality audit per skill** (read `outputs.parsed` + `outputs.findings[]` + `outputs.summary` for at least 3 receipts each) · output rated `usable | partially-usable | not-usable` · findings logged at `QA_PROOF_PACK/testnet/ai-quality/<skill>-audit.md` · any `not-usable` skills get a manifest/prompt fix + re-run before exit
- [ ] **CLI cross-check on every UI feature** — `pnpm ivaronix doctor` green · `pnpm ivaronix receipt verify <id> --tee-independent` green on at least 5 random receipts · `pnpm ivaronix memory log --agent <addr>` matches Studio `/memory` view · `pnpm ivaronix skill list` matches `/skills` page
- [ ] **MCP server + SDK + npx-cli surfaces** all functional · `npx @ivaronix/verify <id>` runs and returns correct verification status from a fresh machine · captured
- [ ] **All 232+ Foundry tests pass** under `via_ir=true` mainnet profile (`forge test --via-ir`)
- [ ] **All 21+ packages typecheck-clean** (`pnpm -r --filter "@ivaronix/*" run typecheck`)
- [ ] **Polyglot canonical hash CI gate** green on every PR (29 vectors · TS+Py+Rust byte-equal)
- [ ] **Core Web Vitals green** (LCP <2.5s · INP <200ms · CLS <0.1) on `/`, `/r/<id>`, `/skills`, `/legal` — this is the FLOOR · Lighthouse 95+ is the *stretch* and should NOT delay proof/tx/receipt/marketplace/memory/AI-quality testing · captured but non-blocking for Phase 1 exit if the proof-side items are all green
- [ ] **Basic accessibility audit pass** (WCAG AA core: keyboard nav · focus states · color contrast on legal/home/receipt pages) · screen-reader full narration audit is a Phase 4 nice-to-have not a Phase 1 exit blocker · captured
- [ ] **Mobile 375×812 captures inspected** per CLAUDE.md §17.7 for every page above · agent reads every PNG and reports anomalies
- [ ] **No-fake-cards rule satisfied** (user-thinking §O.4) — every module card on `/` and `/verticals` is LIVE (linked to a real shipped page) OR ROADMAP (honest "Coming soon" · no broken link)
- [ ] **`docs/UI_HALF_BAKED_AUDIT.md` fresh** (within 7 days) · every visible feature classified into one of 6 states · no `HALF-BAKED` cards shipped as `LIVE`
- [ ] **KV `RealKvClient` wired** against `0g-memory` Docker · live test write + restart container + read confirms durability · HALF_BAKED §A-2 closed
- [ ] **DA decision documented** at `docs/0G_DA_INTEGRATION.md` — `non-blocking for mainnet launch` · either (a) preflight green + batch round-trip tested on testnet OR (b) honest Day-1-of-mainnet-endpoint runbook (no fake-shipped claim) · **does NOT block Phase 2 deploy**
- [ ] **`refundFailedRun` burner-gap CLOSED** · proof at `QA_PROOF_PACK/testnet/burner-gaps/refundFailedRun.md` with: testnet refund tx hash · chainscan link · CLI command + captured output · UI screenshot showing refund visible on `/r/<id>` or dashboard
- [ ] **`recordReceipt` burner-gap CLOSED** · proof at `QA_PROOF_PACK/testnet/burner-gaps/recordReceipt.md` with: tx hash · chainscan link · CLI cross-check · UI screenshot
- [ ] **Goldsky subgraph v2 status** documented at `QA_PROOF_PACK/testnet/subgraph-status.md`: (a) "LIVE · lag <30s confirmed at `<timestamp>`" + sample query result · OR · (b) "FALLBACK · direct-chain-read implementation at `<file:line>` · honest about read latency"
- [ ] **KV server status** documented at `QA_PROOF_PACK/testnet/kv-status.md`: (a) "REAL · durability test green · write+restart+read confirmed at `<timestamp>`" with sample stream-ID · OR · (b) "FALLBACK · `InMemoryKvClient` non-durable · gap surfaced in receipt copy + `/memory` page warning chip"
- [ ] **Priority 20 UI gate green** (user-thinking §O.6) · external reviewer confirms UI is full product, not "doc review + receipts only" · `QA_PROOF_PACK/priority-20/signoff.md` captured

**When Phase 1 EXIT GATE is fully green, append to `QA_PROOF_PACK/PHASE_1_DONE.md`:**
```
Phase 1 testnet launch-readiness exit gate green at <timestamp>.
Evidence: <link to multi-wallet captures> <link to ai-quality audit log> <link to priority-20 signoff>
Proceeding to Phase 2 (mainnet deploy).
```

THEN AND ONLY THEN proceed to Phase 2.

---

## PHASE 2 · MAINNET DEPLOY (only after Phase 1 fully green)

### Phase 2 work — CLI-DOABLE ONLY · NO COMPROMISE on these (agent does all of this from CLI tonight)

**Server provisioning (Hetzner CX31 + Docker sidecars + Cloudflare + crons) is the OPERATOR'S morning step in §PHASE 5 · explicitly NOT autonomous. The agent does NOT SSH a Hetzner box or spin up Docker on remote servers during the loop.** Everything else is CLI-doable and ships at full quality with no compromise:

1. **Rotate `IVARONIX_SIGNER_KEY` (legacy alias: `EVM_PRIVATE_KEY`)** before any mainnet anchors (xyz §SEC-01) · fresh deployer wallet · transfer remaining mainnet OG balance · evidence at `QA_PROOF_PACK/mainnet/key-rotation.md` (old address · new address · transfer tx hash)
2. **Surface to operator: fund deployer wallet** with the amount from `docs/MAINNET_FUNDING_ESTIMATE.md` (genuinely external · CEX bridge). Agent does NOT proceed to step 3 until operator confirms wallet funded. If operator sleeping, agent writes `QA_PROOF_PACK/mainnet/PHASE_2_BLOCKED.md` with the funding-needed message and continues Phase 1 + Phase 4-draft work that doesn't require mainnet funds.
3. **Run mainnet deploy runbook** per `MAINNET_PROMOTION_PLAN.md §9` once funded (~7 minutes):
   - `Erc7857Verifier` → `ReceiptRegistryV3` → `AgentPassportINFTV2` → `CapabilityRegistryV2` → `MemoryAccessLogV2` → `SkillRegistryV2` → `SubscriptionEscrowV2` → `SkillPricing` → `SkillRunPayment`
   - Authorize operator wallet as recorder on `AgentPassportINFTV2`
   - Capture addresses in `contracts/deployments/mainnet.json` + per-contract proof at `QA_PROOF_PACK/mainnet/deploys/<contract>.md` (address · tx hash · chainscan URL)
4. **Configure `pc.0g.ai` adapter** in `og-router` · generate `app-sk-<SECRET>` for mainnet · verify route reaches `0GM-1.0` + `deepseek-v4-pro` via CLI test call (`pnpm ivaronix compute test --model 0GM-1.0-35B-A3B`) · captured at `QA_PROOF_PACK/mainnet/pc-route-test.md`
5. **Update all mainnet skill manifests** · `acceptableModels[]` per `MAINNET_PERFECT_PLAN.md §3` table · republish all 5 legal skills to `SkillRegistryV2` mainnet via `pnpm ivaronix skill publish` · capture tx hashes per skill at `QA_PROOF_PACK/mainnet/skill-publishes/`
6. **Cut Studio over** via `IVARONIX_NETWORK=mainnet` env on Vercel production · production deployment with mainnet config · agent does this through Vercel CLI · captures deploy URL + commit hash at `QA_PROOF_PACK/mainnet/studio-cutover.md`
7. **Update `numbers.json` for mainnet** · run `pnpm numbers:refresh --network mainnet` · regenerate README + MAINNET_READINESS contract tables · capture diff at `QA_PROOF_PACK/mainnet/numbers-refresh.md`

### What's NOT in Phase 2 (operator morning step · §PHASE 5)

- ❌ Hetzner CX31 provisioning (operator)
- ❌ `0g-memory` + `0g-da-client` Docker sidecars on production server (operator)
- ❌ Cloudflare front + WAF + cache rules (operator)
- ❌ Cron monitoring on production server (operator)
- ❌ Final production smoke with LIVE KV + LIVE DA (operator after server up)

**During Phase 2 + Phase 3, KV runs as honest `InMemoryKvClient` fallback (per Phase 1 testnet status) and DA stays at documented runbook (non-blocking). Server-side production layer comes live in §PHASE 5 when operator provisions.**

### Phase 2 PRE-DEPLOY FUNDING ESTIMATE (locked · do BEFORE any mainnet tx)

**Before ANY mainnet write**, agent produces `docs/MAINNET_FUNDING_ESTIMATE.md` containing:

1. **Estimated gas per contract deploy** — run `forge script contracts/script/Deploy<Name>.s.sol --rpc-url https://evmrpc.0g.ai --estimate-gas` for each of 10 contracts · sum the estimates · format as:
   ```
   | Contract | Estimated gas | At <gas_price> | OG cost |
   |---|---|---|---|
   | Erc7857Verifier | ... | ... | ... |
   | ... | ... | ... | ... |
   | TOTAL DEPLOY | ... | ... | ... OG |
   ```
2. **Estimated Compute ledger + provider transfer** — 5 OG ledger + 5 OG provider per `MAINNET_PROMOTION_PLAN.md` · OR override with current best estimate from 0G docs (cite the source)
3. **Estimated anchor spend** during Phase 3 testing — receipts per day × OG-per-anchor × test days
4. **Buffer** — +50% on top of estimates
5. **Hard cap** — sum of above + buffer = the autonomous-mode spend ceiling
6. **Stop-if-unexpected triggers**:
   - Any single tx > 2× estimated tx cost → STOP
   - Daily spend > 2× estimated daily spend → STOP
   - Cumulative spend > hard cap → STOP

**Default fallback if estimate fails**: 15 OG hard maximum · do NOT exceed without operator authorization.

Capture continuous spend log at `QA_PROOF_PACK/mainnet/spend-log.md` · updated after EVERY mainnet tx with: timestamp · tx hash · OG cost · running total · % of cap consumed.

**NOTE on funding estimate conflicts across existing docs**: `MAINNET_PROMOTION_PLAN.md`, `MAINNET_READINESS.md`, and earlier directive versions may list different OG estimates (0.05 · 0.15 · 0.5). These were pre-estimate guesses. **The number from `MAINNET_FUNDING_ESTIMATE.md` is authoritative once produced.** All other doc references should update to match. If conflicts remain, agent surfaces them honestly · does NOT silently pick a number.

### Phase 2 EXIT GATE (cannot proceed to Phase 3 without ALL green)

Per `MAINNET_PERFECT_PLAN.md §7`:

**Autonomous (agent · CLI-only · no compromise):**
- [ ] Operator wallet funded ≥ `MAINNET_FUNDING_ESTIMATE.md` cap on chainId 16661 (operator confirms · agent waits)
- [ ] `IVARONIX_SIGNER_KEY` (legacy alias: `EVM_PRIVATE_KEY`) rotated · evidence at `QA_PROOF_PACK/mainnet/key-rotation.md`
- [ ] All 10 mainnet contracts deployed · addresses in `contracts/deployments/mainnet.json` · ChainScan-verified · per-contract proof at `QA_PROOF_PACK/mainnet/deploys/`
- [ ] `ivaronix doctor --network mainnet` shows: RPC ✓ · Compute ✓ · Storage ✓ · **KV = LIVE** (local `0g-memory` Docker on operator's machine · mainnet endpoint · durability test green) · **DA = LIVE** if mainnet entrance contract published (local `0g-da-client` Docker), otherwise honestly-labeled roadmap
- [ ] `ivaronix demo --network mainnet` produces receipt in <60s · returns `FULLY VERIFIED ✓` · captured
- [ ] `pc.0g.ai` route reaches `0GM-1.0` + `deepseek-v4-pro` end-to-end · CLI test call captured at `QA_PROOF_PACK/mainnet/pc-route-test.md`
- [ ] All 5 mainnet skill manifests updated + republished · tx hashes captured
- [ ] Studio cut to `IVARONIX_NETWORK=mainnet` · Vercel production deploy URL captured
- [ ] `pnpm numbers:refresh --network mainnet` ran clean · regenerated README + MAINNET_READINESS contract tables
- [ ] All 232+ Foundry tests still green under mainnet profile (`forge test --via-ir`)

**Operator-action (morning · §PHASE 5 below · do NOT block Phase 3 night work on these):**
- [ ] ~~Production server (Hetzner CX31) provisioned~~ → §PHASE 5
- [ ] ~~Production containers (KV + DA) healthy~~ → §PHASE 5
- [ ] ~~Cloudflare WAF + DDoS active~~ → §PHASE 5
- [ ] ~~Daily wallet-balance + container-health crons~~ → §PHASE 5

**When Phase 2 EXIT GATE is fully green, append to `QA_PROOF_PACK/PHASE_2_DONE.md` and proceed.**

---

## PHASE 3 · MAINNET QA (full breadth · same rigor as Phase 1, on mainnet)

### Phase 3 work

Re-run Phase 1's full QA suite ON MAINNET. Every flow tested again with real mainnet wallets · real mainnet receipts · real `pc.0g.ai` / `0GM-1.0` inferences.

**Plus mainnet-specific items:**

1. **Anchor at least one receipt per legal skill on mainnet** · all reach `FULLY VERIFIED ✓` via `--tee-independent` against `pc.0g.ai`
2. **Anchor at least one receipt per consensus tier on mainnet** (`quick` · `standard` · `high-stakes` · `audit`) · diverse-model-per-role compositions per `MAINNET_PERFECT_PLAN.md §3` actually used (verify each receipt's `execution.rolesRun[].model` matches the locked plan)
3. **AI quality audit on mainnet receipts** — `outputs.parsed` populated · findings non-empty for real input · summary accurate · suggestedAction actionable · ANY skill with bad output gets manifest/prompt fix + re-run
4. **Multi-wallet flows on mainnet**:
   - Marketplace 3-wallet (creator + buyer + treasury) — real OG paid · real fee-split distributed per `og.creator.fee_split`
   - Memory grant/revoke 2-wallet on mainnet
   - Passport mint + trust accrual 2-wallet on mainnet
5. **Stranger-machine verification (real MetaMask required for any wallet interaction)** — open `/r/<mainnet-id>` from a fresh browser on a different device · verify `FULLY VERIFIED ✓` chip · click "Verify yourself in 10 seconds" · all 4 (or 5 with DA) lights go green live · NO BURNERS for the final smoke — real MM only on mainnet
6. **QR cross-device verify** — scan QR on `/r/<mainnet-id>` with phone · same receipt renders on phone · re-verification runs · all lights green
7. **Tamper test** — modify one byte client-side · verification flips to INVALID red · restore · flips back to VERIFIED green (this is the demo wow moment per agent-ritik's plan.md)
8. **Day-zero alignment** (per `MAINNET_PERFECT_PLAN.md §8`):
   - Anchor a real receipt against `0GM-1.0-35B-A3B` via `pc.0g.ai`
   - Prepare tweet text (do NOT post yet — Phase 4 task) with `/r/<id>` link
   - Update `README.md` numbers blocks via `pnpm numbers:refresh --network mainnet`
   - Update `docs/MAINNET_READINESS.md` to 13/13 mainnet-green checklist

### Phase 3 MAINNET SMOKE COMPLETENESS (locked · per Codex review · not just "deploy worked")

**Complete mainnet smoke produces ALL of the following, each captured under `QA_PROOF_PACK/mainnet/smoke/`:**

| Smoke item | Required evidence (the agent MUST point to this in the status report · not describe it) |
|---|---|
| **Payment flow** (creator → buyer → treasury · real OG paid) | 3 chainscan tx URLs (distinct senders) · screenshots of each wallet's MM popup confirming the tx · CLI cross-check showing OG balances changed on all 3 wallets · path to video of full 3-wallet flow |
| **Receipt anchored** | Receipt ID · `chainscan.0g.ai/tx/<hash>` URL · `outputs.parsed` populated (path to receipt JSON in QA pack) · `outputs.findings[]` non-empty for real input · `outputs.summary` accurate · AI quality rated `usable` in audit note |
| **Proof page renders on a stranger's machine** | Path to screenshot of `/r/<mainnet-id>` opened from fresh incognito browser on a different machine · all 4 (or 5 with DA) lights green · tier badge · trust band · signer context all visible · body fetched from 0G Storage successfully · file path of the screenshot |
| **CLI verify cross-checks** | Exact commands captured in log file: `pnpm ivaronix doctor --network mainnet` · `pnpm ivaronix receipt verify <id> --tee-independent` returns `FULLY VERIFIED ✓` · `pnpm ivaronix memory log --agent <addr>` shows recent activity matching UI · all output logs path-listed |
| **Explorer links live** | `chainscan.0g.ai/address/<contract>` for all 10 deployed contracts · `chainscan.0g.ai/tx/<hash>` for at least one anchor tx · paths to screenshots of each chainscan page |
| **AI output usable** | Path to audit log `QA_PROOF_PACK/mainnet/ai-quality/<skill>.md` for each legal skill · output rated `usable`, `partially-usable`, or `not-usable` · any `not-usable` skills get fix + re-run before claiming green |
| **Multi-wallet rigor** | Real MM popups exercised for all 3 wallets (creator + buyer + treasury) on mainnet · NO BURNERS on mainnet (operating principle #3) · video proof |
| **Tamper test** | Modify one byte client-side · verification flips to INVALID red · restore · flips back to VERIFIED green · captured in video at known path |
| **QR cross-device verify** | Scan QR on phone · receipt opens · verification ceremony runs · all lights green · captured in video at known path |

If any item lacks the required artifact, the smoke is **incomplete** · do NOT claim Phase 3 ready.

### Phase 3 EXIT GATE (cannot proceed to Phase 4 without ALL green)

- [ ] Every checkbox in Phase 1 EXIT GATE re-passed on MAINNET (the full breadth)
- [ ] Every checkbox in `MAINNET_PERFECT_PLAN.md §7` mainnet-promotion gate green
- [ ] AI quality audit on mainnet shows ≥90% of skill receipts rated `usable` (the rest fixed and re-run)
- [ ] Tamper test live · QR cross-device verify live · stranger-machine verify live · captured in video at `QA_PROOF_PACK/mainnet/demo-moments/`
- [ ] All multi-wallet flows green on mainnet · 3-wallet marketplace fee-split paid · 2-wallet memory + passport flows · captured
- [ ] CLI cross-check on mainnet · every UI claim has CLI proof
- [ ] Subgraph indexer green · `/dashboard` + `/global` read fresh mainnet data within 30s lag tolerance
- [ ] Cloudflare metrics show clean traffic · zero WAF blocks on legitimate requests · DDoS protection confirmed active

**When Phase 3 EXIT GATE is fully green, append to `QA_PROOF_PACK/PHASE_3_DONE.md` and proceed.**

---

## PHASE 4 · WRITING + SUBMISSION DOCS (parallelizable with Phase 3 in DRAFT mode · final audit AFTER Phase 3 done)

**Updated sequencing rule** (per Codex review): drafting README · whitepaper · pitch · judge guide can run in PARALLEL with Phase 3 mainnet QA, AS LONG AS:
- All numerical claims · model references · primitive-integration claims use placeholder tokens (e.g., `<!-- numbers:auto:receipts.mainnet -->TBD<!-- /numbers:auto -->`)
- All "shipped X" claims explicitly say "TARGET · pending mainnet smoke test" until Phase 3 confirms
- All "we use 0GM-1.0" claims are conditional on the §2.5 fallback honesty check
- No PDF export · no public PUSH of any document until the §36 audit (Phase 4 EXIT GATE) is green
- Draft work-in-progress lives at `docs/SUBMISSION_PACKET/DRAFT/`

**Final phase 4 work only starts when Phase 3 EXIT GATE green:**

### Phase 4 work

1. **README.md** — bilingual pass (EN + 中文) · mainnet addresses + numbers · "Verify a real mainnet receipt right now" quickstart · honest TIER 1/TIER 2 disclosure · numbers blocks regenerated via `pnpm numbers:refresh --network mainnet`
2. **Whitepaper (5 pages · per agent-ritik plan.md §5.10)** — formal description of:
   - Receipt schema (RFC-8785 canonical JSON)
   - Trust chain (user → TEE → attestation → chain → verifier)
   - Security properties (tamper-evidence · non-repudiation · independent verifiability)
   - 0G primitive usage matrix (per `MAINNET_PERFECT_PLAN.md §1`)
   - Threat model + scope of "process verified, not answer verified"
3. **`docs/JUDGE_GUIDE.md`** — 5 minutes, 3 commands, 3 URLs · the demo path · updated for mainnet receipts
4. **`docs/PITCH.md`** — 3-page pitch · what/who/why now · persona-led · per-audience variants
5. **`docs/PHASE_B_DISCLOSURES.md`** — honest "half-baked surfaces · what we shipped · what's left" updated post-mainnet
6. **`docs/CRYPTO_NOTES.md`** — threat models per primitive (memory AES-GCM · Burn Mode · receipt signing · anchor sigs · capability grants · ERC-7857 attestors) updated for mainnet endpoints
7. **`/legal` page · `/learn` page · `/verticals` page** copy audit · every claim traces to shipped feature
8. **Tweet text** for day-zero 0GM-1.0 alignment · "First receipt anchored against 0GM-1.0 via pc.0g.ai. Verify in 10 seconds: ivaronix.com/r/<id>" · tagged @0G_labs · ready to post when operator says go (do NOT post in Phase 4 unless operator authorizes)
9. **Grant submission packet** — README + whitepaper + pitch + judge-guide + screenshots + demo video + bilingual links · assembled at `docs/SUBMISSION_PACKET/` for one-click reference

### Phase 4 EXIT GATE — the CLAIMS-vs-BUILT AUDIT (§36 of final-plan.md)

**THIS IS THE LAST GATE BEFORE SUBMISSION. Single audit · one question only.**

For every user-facing claim on every shipped surface (home · `/r/<id>` · `/learn` · `/verticals` · `/legal` · `/skills` · README EN+中文 · whitepaper · pitch deck · judge guide · 90-sec demo voiceover · all OG card text · social bios · tweet templates · every README section):

> **Does this claim actually exist in the shipped mainnet product today?** If not → build it now, OR remove/reframe the claim as roadmap.

Findings log at `QA_PROOF_PACK/claims-audit/findings.md`. One row per claim → `shipped ✓` OR `removed/reframed because not built`.

Plus the hackathon-cheap language audit (user concern):

- No "we will revolutionize," "unleash," "unlock," "harness," "seamless," "leverage," "delve," "enable," "state-of-the-art," "cutting-edge," "strict" (CLAUDE.md §9 banned-words list) <!-- wording-lint:allow:meta-list-of-banned-tokens -->
- No "Agent OS" in consumer-facing surfaces · reserved for developer + grant-judge surfaces only
- No "decentralized AI" (smells 2021) · use "verifiable AI"
- No "no other 0G project has this" comparative dunks
- No "court-admissible" without notarization
- No "{N} skills" combined claim · always split
- No "0GM mainnet uses ___" before §7 smoke test confirms
- No `FULLY VERIFIED ✓` alone (reads as "answer correct") · always paired with "Process verified — process, not answer"
- Numerical claims wrapped in `<!-- numbers:auto:KEY -->` per CLAUDE.md §15 bookkeeping
- Module cards: every LIVE card links to a real shipped page · every ROADMAP card honestly marked "Coming soon"

### Phase 4 EXIT GATE checklist

- [ ] §36 claims-vs-built audit green · zero overclaim · findings log shipped at `QA_PROOF_PACK/claims-audit/findings.md`
- [ ] Hackathon-cheap language grep returns zero hits in user-facing surfaces
- [ ] Bilingual README (EN + 中文) renders cleanly · numbers fresh against mainnet
- [ ] Whitepaper 5 pages shipped · PDF exported · linked from README
- [ ] Judge guide updated for mainnet path · 5 minutes / 3 commands / 3 URLs
- [ ] Pitch deck slides re-rendered · every claim verified · cover slide + body slides
- [ ] 90-second demo video re-captured against POST-mainnet UI · cross-device QR moment included · uploaded to `screenshots/readme/tour.webm`
- [ ] Tweet text drafted (NOT posted yet · operator authorizes posting)
- [ ] Grant submission packet assembled at `docs/SUBMISSION_PACKET/`

**When Phase 4 EXIT GATE is fully green, append to `QA_PROOF_PACK/PHASE_4_DONE.md` and STOP.**

Do NOT post the tweet · do NOT submit the grant · do NOT click any external publish button without operator authorization. The agent's loop ends at "submission packet assembled · ready for operator review."

---

## PHASE 5 · OPERATOR FINAL STEP (morning · explicitly NOT autonomous)

**The server-side production layer is the operator's morning step.** Performed AFTER agent reports Phase 1 + Phase 2 (CLI items) + Phase 3 (CLI items) + Phase 4-draft green with all artifacts captured.

### What the operator does in the morning (~30-60 min):

1. **Read `QA_PROOF_PACK/MAINNET_LAUNCH_READY.md`** (written by agent · index of all artifacts)
2. **Spot-check 3-5 artifact paths** — verify real files · not hallucinated
3. **Provision Hetzner CX31** (Frankfurt or Singapore) · Ubuntu 24.04 LTS · UFW firewall (22/443 only) · Caddy reverse proxy + auto-TLS
4. **Spin up `0g-memory` Docker sidecar** on the production box · port 1995 loopback only · `da.env` configured for mainnet · health check green
5. **(If DA shipped) Spin up `0g-da-client` Docker sidecar** · port 51001 loopback only · mainnet `DA_ENTRANCE_CONTRACT` configured · `ivaronix da preflight --network mainnet` green
6. **Cloudflare in front** · WAF rules · cache rules (static + receipt 5min · API uncached) · DDoS protection on
7. **Cron monitoring** wired: daily wallet balance · container health · TEE re-verify success · spend cap tracker · alert thresholds
8. **Final production smoke**: anchor 1 mainnet receipt with KV+DA LIVE (no longer fallback) · verify Studio reads through production KV gateway · capture as `QA_PROOF_PACK/mainnet/PHASE_5_DONE.md`
9. **Flip honest fallback labels OFF**: receipts produced after §PHASE 5 carry full LIVE KV + LIVE DA status · UI fallback chips disappear · `pnpm numbers:refresh` ran one more time
10. **Authorize the tweet** · authorize the grant submission · operator decides when to publish

### What the agent does NOT do during §PHASE 5

- ❌ SSH into Hetzner
- ❌ Spin up Docker containers on remote servers
- ❌ Configure Cloudflare WAF rules
- ❌ Wire production crons on the box
- ❌ Post the tweet
- ❌ Submit the grant

If the agent appears to attempt any of these autonomously, that's a hallucination · operator rejects · restart from a clean state.

### What's LIVE on mainnet during Phase 2 + Phase 3 night work (honest · LOCAL Docker pattern)

- ✓ All 10 contracts deployed on mainnet
- ✓ `pc.0g.ai` route reaching `0GM-1.0` (subject to fallback-honesty per operating principle #8)
- ✓ Studio on Vercel mainnet environment
- ✓ All 5 legal skills published on `SkillRegistryV2` mainnet
- ✓ Receipts anchored on chainId 16661 with full canonical hash · signature · 4-light verification
- ✓ **`0g-memory` KV running LIVE via LOCAL Docker on operator's machine** · mainnet endpoint · durable · same pattern testnet uses · §PHASE 5 migrates this to Hetzner for 24/7 uptime
- ✓ **`0g-da-client` DA running LIVE via LOCAL Docker on operator's machine** IF mainnet DA entrance contract published · else honestly-labeled roadmap (non-blocking)
- ⚠ No Cloudflare in front of Studio yet (Vercel default still active) · §PHASE 5 adds WAF + DDoS
- ⚠ No production observability crons yet · agent runs its own spend log + health checks until §PHASE 5
- ⚠ 24/7 uptime depends on operator's machine being on · §PHASE 5 makes it independent

**This is honest mainnet with LIVE KV + LIVE DA running locally · everything user-visible works for stranger-machine verification · the gaps that remain (Cloudflare · cron monitoring · 24/7 uptime independent of operator's machine) are infrastructure-resilience layers operator adds on wake.**

### Critical clarification: LOCAL Docker (agent · tonight) vs REMOTE Docker (operator · morning)

- **Local Docker (operator's machine)** — agent spins these up tonight to test mainnet against LIVE KV + LIVE DA · same pattern testnet uses · per `reference_oglabs_docker_running.md` memory · Docker Desktop is already running
- **Remote Docker (Hetzner production server)** — operator's morning step · for 24/7 uptime + independence from operator's machine · NOT for testing
- The agent ships full-quality mainnet QA tonight WITH LIVE KV + LIVE DA because the local Docker pattern is proven (testnet uses it) · the operator's morning step is the MIGRATION to production server (not the first time KV+DA come live)

---

## MAINNET LAUNCH CLAIM GATE (the hard rule · locked · per Codex review)

**No mainnet launch claim. No "we shipped." No publish. No tweet. No grant submit.** Until ALL of these are GREEN with evidence captured to disk:

**Autonomous (agent's loop · no compromise on any of these):**
- [ ] `refundFailedRun` burner-gap CLOSED · evidence at `QA_PROOF_PACK/testnet/burner-gaps/refundFailedRun.md`
- [ ] `recordReceipt` burner-gap CLOSED · evidence at `QA_PROOF_PACK/testnet/burner-gaps/recordReceipt.md`
- [ ] Phase 1 EXIT GATE fully green · `QA_PROOF_PACK/PHASE_1_DONE.md` written with artifact index
- [ ] Goldsky subgraph status documented · `QA_PROOF_PACK/testnet/subgraph-status.md` (LIVE or honest FALLBACK)
- [ ] KV server status documented · `QA_PROOF_PACK/testnet/kv-status.md` (REAL or honest FALLBACK pending §PHASE 5)
- [ ] `docs/MAINNET_FUNDING_ESTIMATE.md` produced · spend cap set from real `forge --estimate-gas` (not a guess)
- [ ] Phase 2 EXIT GATE (CLI items) fully green · all 10 contracts deployed via agent CLI · all skill manifests republished · Studio cut to mainnet env · `pc.0g.ai` route confirmed reaches `0GM-1.0`
- [ ] Phase 3 MAINNET SMOKE COMPLETENESS green (CLI-only items): ALL 9 smoke items produced their required artifacts · server-dependent items honestly labeled "FALLBACK pending §PHASE 5"
- [ ] Phase 4 draft writing assembled at `docs/SUBMISSION_PACKET/DRAFT/` with placeholder tokens · §36 claims-vs-built audit green · zero overclaim · `QA_PROOF_PACK/claims-audit/findings.md` shipped
- [ ] Spend log shows actual spend ≤ funding estimate cap · no stop-if-unexpected triggers fired (or all fired triggers resolved with operator authorization)

**Operator-action (morning · §PHASE 5 · not autonomous):**
- [ ] Hetzner CX31 provisioned · `0g-memory` + (`0g-da-client` if shipped) Docker sidecars healthy · health checks green
- [ ] Production smoke green with KV LIVE (and DA LIVE if shipped) · `QA_PROOF_PACK/mainnet/PHASE_5_DONE.md` written
- [ ] Cloudflare in front · WAF + DDoS · cache rules · cron monitoring live
- [ ] Final `numbers.json` refresh post-PHASE-5 · FALLBACK chips removed from UI
- [ ] Operator authorizes tweet + grant submission

**ALL CHECKBOXES GREEN = agent writes `QA_PROOF_PACK/MAINNET_LAUNCH_READY.md`** containing:
- Timestamp
- Path to every artifact above (10 paths · one per checkbox)
- Receipt URL + tx hash for each smoke item
- Spend total + % of cap consumed
- Operator-action queue (tweet posting · grant submission · etc.)

**The agent does NOT make a public-facing "we launched" claim anywhere.** That's the operator's call upon reading `MAINNET_LAUNCH_READY.md` and the artifact index cold.

If `MAINNET_LAUNCH_READY.md` is not on disk · or any of its referenced artifact paths returns `ls: cannot access` · the launch claim is rejected and the loop continues from the failed item.

---

## ANTI-HALLUCINATION RULES (locked · do not violate)

1. **No moving to phase N+1 until phase N exit gate is fully green.** No exceptions. No "I'll come back to it."
2. **Phase 4 DRAFT writing can run in parallel with Phase 3 mainnet QA** — but NO PUBLISH · NO SUBMIT · NO TWEET until §36 claims audit green.
3. **No detour into atomic closures unless they directly block the current phase's exit gate.** "It's concrete and safe" is not a justification. Pick the highest-impact launch-readiness item, even if it's bigger.
4. **Always pick the highest-impact breadth test over a smaller polish item** within a phase. Marketplace 3-wallet > mobile PNG inspection. Real chain side effects > screenshot review.
5. **No fake green.** A test that didn't run is not "skipped" · it's `NOT TESTED` and blocks the gate.
6. **No selector-only proof.** Asserting a button exists is not testing. Clicking it and confirming the next state IS testing.
7. **No screenshot-only proof.** A capture is documentation · not verification (CLAUDE.md §11.3a). Verification = real on-chain side effect + CLI cross-check + AI output read.
8. **Wallet split per operating principle #3**: Real MetaMask for every wallet-flow where possible (proves popups · sign · reject · switch · visual). Burner scripts ALSO captured for fast contract-level proof (proves logic · payment math · chain state). Additive · not substitutive. No mocked wallets · no shim-as-passing.
9. **Multi-wallet rigor.** 2-wallet features need 2 wallets exercised. 3-wallet features need 3. Real MM on mainnet · burners ok on testnet breadth.
10. **AI quality is non-negotiable.** Receipt green ≠ output usable. Read what the AI actually said.
11. **CLI cross-check on every UI claim.** UI without CLI is half-shipped.
12. **No `git commit` without test pass.** Test before commit · not commit then test. Atomic commits land both feature + test together.
13. **No commits with `Co-Authored-By` trailers** (CLAUDE.md §1) · no AI-slop banned words in commit bodies (CLAUDE.md §9).
14. **No mainnet promotion without `MAINNET_PERFECT_PLAN.md §7` 13/13 green** (or the relevant subset for the rotation/funding-blocked items). DA + fine-tunes do NOT block Phase 2 deploy per operating principle #10.
15. **No claim made about mainnet (`0GM-1.0` · `pc.0g.ai` · "mainnet uses X") until §7 smoke test confirms.** Until then framed as TARGET only.
16. **Model fallback honesty (operating principle #8)** — UI + receipt + every doc references the ACTUAL model used · never the target as if shipped. "Ran on `qwen3-32b` · target `0GM-1.0` was unavailable" when fallback engaged.
17. **No claim without proof link (operating principle #9)** — every number · every "uses X" · every "shipped Y" maps to a receipt URL · tx hash · screenshot · video · or explicit roadmap label.
18. **Mainnet spend cap (Phase 2 spend cap table)** — hard 15 OG max in autonomous mode · stop-if-unexpected-cost trigger active.
19. **Workroom breadth in UI** (operating principle #7) — legal is the GTM wedge but the UI surfaces the full workroom: docs · code · receipts · memory · marketplace · passports.
20. **DA + fine-tunes are non-blocking unless live** — do NOT block Phase 2 deploy on DA · do NOT claim fine-tunes as shipped.
21. **Save evidence to disk in real time.** Every checkbox closed in an exit gate → an artifact path · don't trust memory.
22. **Re-read this directive at the start of every fire** to verify you're still on the highest-impact item for the current phase.

---

## STATUS REPORTING (after each fire · 3 lines max)

After every fire / commit / test run, reply with:

```
PHASE: [1 testnet | 2 mainnet deploy | 3 mainnet QA | 4 writing]
JUST CLOSED: [1-line description of the exit-gate item just verified green]
NEXT (highest-impact): [1-line description of next exit-gate item]
```

If you find yourself reporting an atomic closure instead of an exit-gate item, STOP and re-read OPERATING PRINCIPLE rule 2. Pivot.

If you find yourself thinking "I'll come back to that test later," STOP and re-read anti-hallucination rule 5. Run it now.

---

## OPERATOR INTERVENTION POINTS (when to surface, NOT decide alone)

Surface to operator (do NOT skip · do NOT decide unilaterally):

1. **Phase 2 funding gate** — operator wallet needs ~0.15+ OG mainnet for deploy. Surface when Phase 1 EXIT GATE green · request funding. Do NOT proceed to Phase 2 deploy steps without funded wallet.
2. **Mainnet spend cap hit** — if any tx exceeds 0.05 OG OR daily anchor spend > 0.15 OG OR cumulative loop spend > 15 OG → STOP · surface to operator · do NOT continue autonomous spending until cleared.
3. **0GM-1.0 / pc.0g.ai smoke-test failure** — if route doesn't reach 0GM-1.0 end-to-end · surface immediately · do NOT silently fall back to a smaller model AND claim 0GM-1.0 was used. Receipt must record actual model · UI must display actual model · surface the fallback to operator before proceeding.
4. **Genuine external dependencies** — BotFather token · paid quota · 0G's mainnet DA entrance contract not yet published · operator-physical actions. Surface honestly · do NOT fake-pass.
5. **Day-zero tweet posting authorization** — Phase 4 prepares tweet text · DO NOT post without operator signoff.
6. **Grant submission click** — Phase 4 assembles packet · DO NOT submit without operator signoff.
7. **Receipt rate-limit or operator-wallet-cap drain on `/try`** — surface immediately · don't try to "work around" by removing rate limit.
8. **CourtListener / Cornell LII external API unreachable for `legal-citation-verifier`** — surface · do NOT mark a citation receipt as `verified` when external source was unreachable · use `unverified` status per failure-mode contract.
9. **Real MetaMask conflict on mainnet flow** — if you genuinely cannot drive real MM for a Phase 3 mainnet flow (browser instability · MM version change · etc), surface to operator with the specific selector or popup that's failing. Do NOT shortcut to burner wallet on mainnet.

For every other decision, follow the directive. Decision authority is delegated only where the operator's input is genuinely required.

---

## ACKNOWLEDGE TO START

Reply verbatim:

```
Read all 5 references. Locked operating principle.
Phase 1 in progress. Will proceed Phase 1 → 2 → 3 → 4 only when each exit gate is fully green.
Anti-hallucination rules locked. Will surface operator-intervention points honestly.
Starting Phase 1 next-highest-impact item now.
```

Then begin.

— end of LOOP_DIRECTIVE.md —
