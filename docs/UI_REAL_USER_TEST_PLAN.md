# Ivaronix UI Real-User Test Plan

> Use every shipped UI feature like a real user. Prove the product feels clear, works end-to-end, and shows honest outcomes. No DOM-only testing. Real browser, real MetaMask, real clicks, real screenshots, real videos.

**Test order locked**: UI (this doc) â†’ CLI (light cross-check inside UI) â†’ MCP (smallest surface) â†’ cross-machine replay (the kill-shot).

**Non-negotiable rule**: do not miss even one UI feature. Every item ends as `PASS` / `FAIL` / `NOT UI-SHIPPED` / `EXTERNAL-ONLY` with evidence. Real wallet features require real MetaMask, real account switching, real signatures, real tx popups.

---

## How to run this plan

### Fail rule (the no-compromise rule)

If any item fails:
1. **Stop** â€” do not continue to the next priority.
2. **Fix in the proper way** â€” read the code, the docs, the resources, the project context. No quick patches, no fake green, no skip.
3. **Re-run** the failing item AND any earlier item the fix could have affected (regression sweep).
4. Only after the failing item is `PASS` with fresh evidence can the next priority start.

### Artefact organization (the proof folder rule)

Every test produces evidence under `QA_PROOF_PACK/ui/`:

```
QA_PROOF_PACK/ui/
â”œâ”€â”€ P0-setup/
â”‚   â”œâ”€â”€ desktop/                  # 1440x900 screenshots
â”‚   â”œâ”€â”€ mobile/                   # 375x812 screenshots
â”‚   â”œâ”€â”€ video/                    # full session .webm files
â”‚   â””â”€â”€ notes.md                  # per-item PASS/FAIL + 1-sentence inspection note
â”œâ”€â”€ P1-landing/...
â”œâ”€â”€ P2-demo/...
...
â””â”€â”€ DAILY_CHECKPOINT.md            # daily summary updated as priorities close
```

Naming convention per screenshot:
`<priority>-<sub-id>-<step>-<state>.png`
Example: `P3-run-04-mm-confirm-popup.png` Â· `P5-marketplace-09-payouts-after-withdraw.png`

### Definition of evidence (minimum for PASS)

A test is `PASS` only when ALL of these exist:
- Screenshot at every meaningful state transition (pre-action, MM popup, post-confirm, final state)
- For any flow longer than 3 clicks: full session video (`.webm`)
- For chain-write actions: chainscan link recorded in `notes.md`
- Agent inspects each screenshot via `Read` and writes 1-sentence visual confirmation in `notes.md` (per CLAUDE.md Â§17.7)
- Operator-confirmation loop: agent sends screenshot paths back to operator for spot-check before declaring `PASS`

### Daily checkpoint format

Update `QA_PROOF_PACK/ui/DAILY_CHECKPOINT.md` at end of each test day:

```markdown
## 2026-MM-DD (Day N)

| Priority | Status | Items pass/total | Blocker / next step |
|---|---|---|---|
| P0 Setup | DONE | 6/6 | â€” |
| P1 Landing | DONE | 7/7 | â€” |
| P2 Demo | IN PROGRESS | 3/5 | demo wallet OOF fallback flow next |
| P3 Run | NOT STARTED | 0/9 | â€” |
...
```

This is the only stop/resume contract â€” when restarting, read this file and pick up from the highest `IN PROGRESS` priority.

### Regression rule

When a fix lands mid-test, re-run:
1. The failing item itself
2. Any priority earlier in the order that touches the same code path
3. The pre-commit regression suite (93 source-file regressions + wording-lint)

If 1-3 all green, continue. If any go red, repeat the fix-and-rerun.

---

## UI Inventory Gate (do this BEFORE Priority 0)

Create / update `QA_PROOF_PACK/ui/UI_INVENTORY.md` from the actual app routes, nav links, buttons, forms, toggles, menus, modals, tx buttons, and public links. Goal: nothing is invisible to the test.

| Inventory item | Required action |
|---|---|
| Every route under `apps/studio/src/app/**/page.tsx` | Open on desktop AND mobile, or mark dynamic route with real sample id/handle. |
| Every nav/header/footer link | Click, confirm correct route/state. |
| Every CTA / button | Click, or prove disabled state correct. |
| Every form input | Type valid AND invalid values. |
| Every toggle / checkbox / select / tab | Change state, confirm UI + data outcome. |
| Every wallet action | Use real MetaMask popup; screenshot before/during/after. |
| Every transaction | Confirm tx AND reject tx; open explorer link. |
| Every public proof/share link | Open logged-out / no-wallet / incognito. |
| Every loading / error / empty state | Trigger honestly via network/app state â€” no fake green. |

Current Studio route inventory:

`/`, `/0g`, `/admin/treasury`, `/agent/[handle]`, `/agents`, `/brand`, `/dashboard`, `/data-room/[id]`, `/delegate/[id]`, `/docs`, `/embed/r/[id]`, `/global`, `/marketplace`, `/marketplace/[skillId]`, `/marketplace/new`, `/marketplace/payouts`, `/memory`, `/onboard`, `/privacy`, `/r/[id]`, `/r/[id]/print`, `/skill/[id]`, `/skill/new`, `/skills`, `/terms`, `/test-wallet`, `/thesis`.

Dynamic routes must use real known ids:
- `/r/[id]`: fresh receipt from this test run + one canonical sample (rec_1004).
- `/marketplace/[skillId]`: real marketplace skill id (publish one in P5 if none exist).
- `/agent/[handle]`: real minted passport handle.
- `/data-room/[id]` + `/delegate/[id]`: real generated test ids OR mark `NOT UI-SHIPPED` if no real UI-created id exists.

---

## Priority 0 Â· Setup

Establishes the test environment. PASS gates the rest of the plan.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open live Studio at `https://ivaronix.vercel.app` desktop 1440Ã—900 | 0 | Page loads fast (FCP < 2s feel), no broken layout, no console crash. |
| Open Studio on mobile 375Ã—812 | 0 | No horizontal overflow, text fits, CTAs visible. |
| Connect MetaMask Â· operator wallet | 1 | Wallet connects, address appears, disconnect works. |
| Switch / add 0G Galileo network | 1 | Network state clear; wrong-network state guides user. |
| Account switching in MetaMask | 2-3 | UI updates when switching A/B/C; no stale wallet state. |
| Sign message Â· SIWE | 1+ | Signature prompt appears; result updates UI. Reject path also works. |
| Cold-load timing | 0 | Time to first paint < 2s; full hydration < 4s. Record in notes. |
| Fresh-install path | 0 | Clear localStorage; reload; verify onboarding still works (no stale session crashes). |
| Reload mid-tx | 1 | Refresh while tx pending; UI recovers cleanly (shows pending or repromtps). |

---

## Priority 1 Â· Landing Page

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Hero first viewport | 0 | Persona-first h1 ("A founder reviewing a term sheet shouldn't have to trust the AI") legible at 1440Ã—900 AND wraps cleanly at 375Ã—812 (no overflow, no cut-off). |
| Independent-verify chip in hero | 0 | The monospaced `$ pnpm ivaronix receipt verify rec_1004 --tee-independent â†’ FULLY VERIFIED âœ“` block renders inside the hero; mobile keeps horizontal scroll inside the chip, not the page. |
| Live receipt-count pulse | 0 | Green chip "X receipts on-chain Â· live" pulses smoothly; number is non-zero; pulse continues without stutter. |
| Primary CTA â†’ /?demo=true | 0-1 | Click goes to demo path. |
| "Run on my own doc" â†’ /onboard | 0-1 | Click goes to onboarding flow. |
| "Why Ivaronix" â†’ /thesis | 0 | Opens thesis page with clear product story. |
| "BUILT ON 0G PROOF STACK" band | 0 | Says "0G PROOF STACK" (not "full OG stack"); DA shows "(integration documented)" qualifier, not as live. |
| Stat row (3 numbers) | 0 | Receipts/passports/skills render; First-party skills card reads from `verifiedSkillsCount` (NOT hardcoded). |
| Footer links | 0 | Every link works; no broken route. |


### P1b · Post-green landing capability upgrade

Do this only after the current UI test pass is green and all existing UI flows are proven. Do not interrupt testing to redesign the landing page.

If testing shows the landing page makes Ivaronix feel like only "private doc review + receipts", add a useful section: **"What you can do in Ivaronix"**.

No half-baked cards. Every module must link to a real shipped UI page and be tested after implementation.

| Module | Link target | Expected outcome |
|---|---|---|
| Private reviews | `/`, `/onboard`, or `/?demo=true` | User understands they can run private contract/code/doc review. CTA starts a real flow. |
| Verified receipts | `/r/<real-id>` | User sees proof explorer with tx, model, TEE, payment, storage status. |
| Paid skills marketplace | `/marketplace` | User sees buy/run skills and creator earning path. |
| Private memory permissions | `/memory` | User sees grant/revoke memory access workflow. |
| Agent passports | `/agents` and `/dashboard` | User sees agent identity, trust, receipt history. |
| Independent verification | `/r/<real-id>` or `/docs` | User sees `ivaronix receipt verify <id> --tee-independent` clearly. |
| 0G stack proof | `/0g` | User sees Compute, Storage, Chain, Agent ID, KV/memory, and honest DA status. |

Acceptance rule after adding it:

- Every card has a real link.
- Every link is clicked on desktop and mobile.
- Every linked page loads and supports the claim.
- No placeholder "coming soon" card unless explicitly marked roadmap.
- No fake product claim that only exists in CLI/backend.
- Screenshots/video prove the landing page communicates the full product: reviews, receipts, marketplace, memory, passports, dashboard, 0G stack, and independent verification.

---

## Priority 2 Â· One-Click Demo

Main flow first; out-of-funds fallback is lower-priority below.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open `/?demo=true` | 0 | Demo panel loads without wallet friction. |
| Click `Run review` | 0 | Real run starts; loading state clear. |
| Wait for receipt | 0 | Receipt anchors; redirects to proof page within 30s. |
| Demo-subsidised badge | 0 | UI honestly says operator-subsidised; receipt's `billing.payment.subsidised: true`. |
| Operator-wallet address visible | 0 | Receipt shows operator paid; user wasn't asked to fund anything. |
| Refresh after success | 0 | Receipt/proof page still works after reload. |
| **(Lower priority â€” after main flow proven)** Demo wallet out-of-funds fallback | 0 | Drain demo wallet OR set `OUT_OF_FUNDS` flag manually. `/?demo=true` shows "Demo paused â€” connect your wallet" with working `[Connect]` button; no fake "demo running" state. |

---

## Priority 3 Â· Normal Private Review Flow (with payment)

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Upload/paste private document | 1 | Input accepted; no layout jump; file/text state visible. |
| Choose skill: private-doc-review | 1 | Skill selected; price/tier shown if paid. |
| Toggle Burn Mode | 1 | UI explains encrypted/private outcome, not vague hype. |
| Choose consensus tier (quick/standard/high-stakes) | 1 | Preview updates; price/time-estimate reflect tier. |
| Click run/pay â†’ 402-style estimate | 1 | `/api/run/estimate` returns `{needsPayment, amount, paymentContract, ...}`; UI shows the estimate clearly before tx. |
| Sign payment in MM | 1 | MM popup shows correct gas + amount + recipient (paymentContract). |
| Confirm payment tx | 1 | Tx submits; UI waits and explains status. |
| `/api/run/confirm` server-side verify | 1 | Server runs the 5-check verifier (tx exists, to=paymentContract, from=payer, value=amount, event.receiptRoot=draftReceiptRoot). |
| Receipt creation | 1 | Proof page opens with receipt id, tx hash, model, TEE state, payment block. |
| **Payment-tx binding verification** | 1 | Receipt body MUST contain `billing.payment` block: `txHash` matches the on-chain tx, `creator` + `creatorBps` + `treasuryBps` match the SkillRunPaid event. Receipt's `verify` chip shows FULLY VERIFIED âœ“ on this evidence. |
| Reject tx | 1 | UI recovers cleanly; no fake receipt; clear "tx rejected" state. |
| Insufficient funds | 1 | Wagmi pre-check OR clear error toast; no stuck spinner. |
| File size limit | 1 | Try a 100KB+ doc â€” accepted or clear "too large" error. |

---

## Priority 4 Â· Receipt / Proof Explorer

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open `/r/<id>` | 0 | Receipt renders publicly without login. |
| Verification status chip | 0 | Shows VERIFIED / ANCHORED / PAID / INVALID honestly. |
| Payment block | 0 | Shows payer, creator, treasury, amount, tx hash if paid. |
| TEE / model block (0GM badge Â· Block G) | 0 | Shows TIER 1 + 0GM chip (green) for 0G runs; external = amber. `execution.model.source` enum displayed. |
| Storage evidence block | 0 | Shows evidence root/status; pending labeled pending. |
| **Burn Mode evidence** (Block F) | 0 | When receipt has `execution.burnMode: true`: receipt page shows `storage.encryption.keyFingerprint` (sha256 of the destroyed session key) â€” proves the session key once existed and is now destroyed. |
| **EIP-712 anchor signature recovery** (Block K-2 fix Â· V2/V3) | 0 | Verifier passes: ECDSA signature recovers to `agent.ownerWallet`; `agentAddress` on chain matches recovered signer (NOT msg.sender). |
| Chain / explorer links | 0 | Every tx/address link opens the correct 0G chainscan. |
| Share button | 0 | Share text/link correct; copy-to-clipboard puts the right URL. |
| Print page `/r/<id>/print` | 0 | Readable, professional; print preview looks clean. |
| **OG image** at `/r/<id>/opengraph-image` | 0 | Open URL directly â†’ returns 1200Ã—630 PNG. Paste `/r/<id>` URL into Twitter card validator + Slack + Discord â€” preview shows correct title/description/image. |
| **Embed view** at `/embed/r/<id>` | 0 | Renders a compact embeddable card; works iframed in another HTML page. |
| **Stranger-replays in incognito on different machine** | 0 | Open `/r/<id>` in fresh incognito on a non-Ivaronix machine; FULLY VERIFIED âœ“ renders without auth/wallet. |
| **V3 receipt slots 10/11/12** | 1+ | Verify receipts with `receiptType` slot 10 (doc_room_create), 11 (doc_room_read), 12 (memory_consolidation) anchor on `ReceiptRegistryV3` and render correctly on `/r/<id>` (V2 capped at slot 9; V3 admits these). |
| Invalid receipt id | 0 | 404/error state is clean and helpful. |

---

## Priority 5 Â· Marketplace 3-Wallet Flow

Roles: A = creator Â· B = buyer Â· C = treasury/admin.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/marketplace` browse | 0 | Skills list loads from subgraph (Goldsky v1.0.0) + chain-fallback. No fake empty state. |
| Open skill detail `/marketplace/[skillId]` | 0 | Skill price, creator, bps split, recent receipts shown clearly. |
| **Subgraph-down fallback** | 0 | Block Goldsky URL in DevTools network panel â†’ marketplace still loads via chain reads (slower but functional). |
| Creator publishes skill `/marketplace/new` | A | 2 MM popups (publish + setPrice); skill appears in marketplace within 1 block. |
| **Skill price editing** | A | Creator updates `priceWei` via setPrice; new price reflects in marketplace within 1 block. |
| Buyer buys/runs skill | B | MM payment tx opens; tx confirms; receipt anchors. |
| Payment-split display | B/C | Receipt shows buyer paid, creator share, treasury share; bps match `SkillRunPaid` event. |
| **Free skill (priceWei=0)** | B | Skill with price=0 runs without payment popup; receipt has no `billing.payment` block. |
| Creator payouts `/marketplace/payouts` | A | Creator earnings appear; withdraw button works. |
| Creator withdraw | A | MM popup â†’ confirm â†’ tx â†’ creator receives funds; balance updates. |
| Treasury / admin `/admin/treasury` | C | SIWE-gated; treasury amount visible; admin-only controls. |
| Wrong-wallet admin access | B | Buyer cannot access `/admin/treasury` (403). |
| Wrong-wallet withdraw | B | Buyer cannot withdraw creator OR treasury funds. |
| **Refund flow (admin)** | C | Admin calls `refundFailedRun(receiptRoot)`; payer receives refund; receipt updates `refunded: true`. |
| **Filter / sort controls** | 0 | Sort by price / popularity / recent / trust. Filters apply correctly. |
| Failed payment | B | No receipt claim; UI explains retry/cancel. |

---

## Priority 6 Â· Memory / Permission 2-Wallet Flow

Roles: A = memory owner Â· B = grantee/reader.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/memory` as owner | A | Existing grants/memory state loads OR clean empty state. |
| **KV server down fallback** | A | When `KV_REMOTE_URL` not set OR EverMemOS unreachable: UI uses `InMemoryKvClient` (dev fallback) with clear "memory is session-only" banner. No silent data loss. |
| Grant memory to Wallet B | A+B | MM tx opens; grant appears with scope/session/project. |
| View as Wallet B | B | Granted memory visible/usable only within allowed scope. |
| **Cross-session persistence** | A | Write memory â†’ close browser â†’ reopen â†’ verify memory persisted (only with real KV `KV_REMOTE_URL` set). |
| **Multi-user isolation** | A+B | Wallet A writes memory item; Wallet B's `/memory` view does NOT show it without an explicit grant. |
| Revoke grant | A | Revoke tx confirms; status changes to revoked. |
| Try access after revoke | B | Access denied cleanly; no stale memory leak. |
| Invalid grantee address | A | Button stays disabled OR shows clear validation error. |

---

## Priority 7 Â· Agent / Passport / Dashboard

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/onboard` connect wallet | 1 | Connected state clear; SIWE handshake completes. |
| Mint / claim passport | 1 | MM tx opens; passport state appears after confirm. |
| Passport mint cost visible | 1 | Gas estimate shown before signing. |
| `/dashboard` | 1 | Balance, passport, trust, receipts, schedules render. |
| `/agents` | 0 | Agent list / leaderboard loads. |
| `/agent/<handle>` | 0 | Agent profile + receipt history readable. |
| **TrustScore update** | 1+ | When an authorized recorder bumps reputation, dashboard reflects new score within 1 block. |
| **Delegate creation** from `/agent/<handle>` | 1 | Delegate flow opens; child passport mints; receipt anchors with delegated agent address. |
| No-passport state | 1 | UI explains next step, no blank crash. |

---

## Priority 8 Â· Skill Pages

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/skills` | 0 | Skills load; search/filter works if present. |
| `/skill/<id>` | 0 | Skill details, permissions, pricing, model/tier clear. |
| `/skill/new` OR `/marketplace/new` | 1 | Creator form works; client-side Zod validation prevents bad data. |
| Save / publish skill | 1 | Tx or API result clear; new skill appears where expected. |
| **Hook configuration** | 1 | Pre/post-consensus hook list (`redact_pii`, `balance_check`, etc.) renders correctly in skill detail. |
| **Tier-default UI** | 1 | Default consensus tier from skill manifest pre-selects in the run flow. |

---

## Priority 9 Â· Data Room / Delegate Flows

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open data-room page | 1-2 | Room details, encrypted evidence, read-receipt UI render. |
| **Data room keyFingerprint visible** | 1-2 | The room's encryption keyFingerprint (sha256 of the destroyed session key) shown on `/data-room/<id>`. |
| **doc_room_create receipt (V3 slot 10)** | 1 | Creating a data room anchors a receipt with `receiptType: 10` on `ReceiptRegistryV3`. |
| Reader access | 2 | Allowed reader can view permitted info only. |
| **doc_room_read receipt (V3 slot 11)** | 2 | Reader's access anchors a receipt with `receiptType: 11`; reader's wallet recorded. |
| Denied reader | 2 | Denied state clear; no sensitive data shown. |
| Delegate page | 1-2 | Delegate identity, permissions, signer boundary clear. |
| **Erc7857Verifier attestor flow** | 1 | If UI surfaces attestor-signature flow: add attestor â†’ attestor signs attestation â†’ verifier confirms. If no UI: mark `NOT UI-SHIPPED` (Erc7857 attestation is checked at receipt-verify time via the deployed contract; the verifier is a chain primitive, not a Studio surface). |
| Delegate receipt link | 0 | Receipt proves delegate signer correctly. |

---

## Priority 10 Â· Docs / 0G / Legal Pages

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/0g` | 0 | Shows real 0G components used; no fake DA/live claims. |
| `/docs` | 0 | Redirect or docs route works intentionally. |
| `/privacy` | 0 | Privacy story matches product behavior. |
| `/terms` | 0 | Terms page loads. |
| `/brand` | 0 | Brand page matches visual system. |
| `/thesis` | 0 | Product story clear and non-technical enough. |

---

## Priority 11 Â· Mobile + Visual Polish

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Landing mobile | 0 | Hero readable, CTA visible, no overflow. |
| Run flow mobile | 1 | Buttons reachable; MM popup flow not confusing on mobile. |
| Receipt mobile | 0 | Proof details readable; long hashes wrap. |
| Marketplace mobile | 0-3 | Cards, payment, payout screens usable. |
| Memory mobile | 1-2 | Grant/revoke forms fit screen. |
| **Touch targets â‰¥ 44px** | 0 | Every clickable element â‰¥ 44Ã—44px (WCAG AA minimum). |
| **Keyboard hides input on iOS** | 1 | Input fields near bottom of form remain visible above the keyboard. |
| **Landscape orientation** | 0 | Rotating phone doesn't break layout. |
| Dark / black surfaces | 0 | Text contrast good; no overlap. |
| Loading states | any | Every long action shows progress. |
| Error states | any | Every failure explains next step. |
| Empty states | any | No blank page; clear next step. |

---

## Priority 12 Â· Final UI Pass

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Every nav item | 0-1 | Route opens, active state correct. |
| Every button / CTA | varies | Real use OR removed/disabled honestly. |
| Every form | varies | Validation, submit, success, failure all work. |
| Every transaction | varies | MM opens, tx confirms/rejects cleanly, explorer link works. |
| Every public proof link | 0 | Works without wallet/login. |
| Full screen recording | varies | A human can watch and understand the product. |

---

## Priority 13 Â· Cross-tool consistency (CLI cross-check inside UI testing)

Goal: prove UI + CLI + chain + subgraph all agree on the same receipt. Light CLI usage inside the UI test phase â€” not full CLI testing (that's the next phase).

| What to use | Wallets | Expected outcome |
|---|---:|---|
| UI anchors receipt â†’ CLI verifies | 1 | After UI run produces `rec_<id>`: run `pnpm ivaronix receipt verify <id> --tee-independent` from terminal. Result: FULLY VERIFIED âœ“ all 5 checks (schema, hash, signature, anchor, payment, TEE). |
| UI displays receipt â†’ CLI shows match | 1 | `pnpm ivaronix receipt show <id>` displays the same payer/creator/bps/tx hash that the UI's `/r/<id>` page shows. Cross-tool byte-equal. |
| Subgraph indexes receipt â†’ UI marketplace refresh | A+B | After a `SkillRunPaid` event: subgraph query at the Goldsky endpoint returns the new Payment entity within ~1 block; marketplace UI refresh shows the updated lifetime earnings. |
| Chain-fallback path | 0 | With Goldsky blocked in DevTools: marketplace UI falls back to direct chain reads; same data appears (slower). |

PASS gates the move to dedicated CLI testing phase.

---

## Priority 14 Â· Performance baseline

Establish numbers before launch so post-launch regressions are visible.

| What to measure | Tool | Threshold |
|---|---|---|
| Landing FCP (First Contentful Paint) | Lighthouse / Chrome DevTools | < 2s desktop; < 3s mobile |
| Landing LCP (Largest Contentful Paint) | Lighthouse | < 2.5s desktop; < 4s mobile |
| Time to first receipt (cold start `?demo=true`) | Stopwatch | < 30s (per CLAUDE.md product SLA) |
| Receipt page render `/r/<id>` | Stopwatch | < 1s for cached receipt; < 3s cold |
| Lighthouse score (5 key pages) | Lighthouse | Performance â‰¥ 80, Accessibility â‰¥ 90 |
| Bundle size first-load JS | `next build` output | < 300 KB gzip for landing |

Record numbers in `QA_PROOF_PACK/ui/P14-performance/numbers.md`.

---

## Priority 16 Â· Data freshness Â· read-after-write Â· cross-user propagation Â· real-source binding

Catches the 5 UX bug classes that lower-priority tests miss systematically:

1. Something I did on-chain, the frontend should update but doesn't.
2. Something I did, another user should receive â€” they don't.
3. Data not updating after an action that should trigger an update.
4. UI not backing from a real source (showing stale / mocked / hardcoded data).
5. Race conditions, double-submit, navigation-mid-tx UX failures.

**This priority runs AFTER P0-P12 so every shipped flow has already been driven once. Then sweep this matrix against every action that mutates state.**

### A Â· Read-after-write per chain write

For EVERY action that produces an on-chain tx, prove the UI surface that should reflect it actually updates. Galileo block-time ~3s; allow 1-2 block buffer.

| Action | UI surface that must update | Max wait |
|---|---|---|
| Anchor receipt (any flow) | Home receipt count Â· `/dashboard` receipts list Â· `/r/<id>` page Â· `/agent/<addr>` history | ~1 block |
| `SkillRegistryV2.publish` | `/marketplace` list Â· `/skill/<id>` detail | ~1 block |
| `SkillPricing.setPrice` | `/marketplace/<skillId>` price display Â· `/marketplace/new` form pre-fill | ~1 block |
| `SkillRunPayment.paySkillRun` | `/r/<id>` payment block Â· `/marketplace/payouts` lifetime earnings Â· `/admin/treasury` accumulator | ~1 block |
| `SkillRunPayment.withdrawCreator` | `/marketplace/payouts` balance â†’ 0 Â· creator wallet balance increased | ~1 block |
| `SkillRunPayment.withdrawTreasury` | `/admin/treasury` balance â†’ 0 Â· treasury wallet balance increased | ~1 block |
| `SkillRunPayment.refundFailedRun` | `/r/<id>` receipt shows `refunded: true` Â· payer wallet refunded | ~1 block |
| `AgentPassportINFTV2.mint` | `/dashboard` passport state Â· `/agent/<handle>` profile | ~1 block |
| `AgentPassportINFTV2.recordReputation` | `/dashboard` trustScore Â· `/agent/<handle>` trustScore | ~1 block |
| `CapabilityRegistryV2.grant` | A's `/memory` shows grant Â· B's `/memory` shows received grant | ~1 block |
| `CapabilityRegistryV2.revoke` | A's `/memory` grant marked revoked Â· B's next read fails 403 | ~1 block |
| `MemoryAccessLogV2.logAccess` | Activity dashboard shows the access event | ~1 block |

PASS = the UI surface updates within the max wait OR a clear "indexer catching up" state is shown (no fake stale data).

### B Â· Cross-user propagation

For every action that affects a DIFFERENT user, verify the second user's view updates.

| Action by Wallet A | Wallet B's UI must show |
|---|---|
| A publishes skill | B's `/marketplace` list shows the new skill |
| A updates skill price | B's `/marketplace/<id>` shows new price (NOT the old cached one) |
| A grants memory to B | B's `/memory` shows the new grant |
| A revokes B's grant | B's next read attempt â†’ access denied |
| A pays B's skill (B = creator) | B's `/marketplace/payouts` shows incremented lifetime earnings + withdrawable balance |
| A anchors receipt referencing B (delegate flow) | B's `/agent/<handle>` history shows the receipt |

PASS = open Wallet B's view in a SEPARATE browser session (different incognito window OR different machine) and verify the update arrived within ~1 block of A's tx.

### C Â· Real-source binding sweep

For every UI surface that displays a count, list, balance, or status â€” verify the value comes from chain/subgraph, NOT a hardcoded number or stale stub.

| Surface | Must read from |
|---|---|
| Home "X receipts on-chain Â· live" chip | `unifiedNextId()` (chain) |
| Home stat row Â· receipts | `unifiedNextId()` (chain) |
| Home stat row Â· passports | `livePassportCount()` (chain) |
| Home stat row Â· "First-party skills" | `loadAllSkills().length` (manifest count) â€” NOT hardcoded "5" (fixed `0e46e7d`) |
| `/thesis` stat grid | Same as home â€” chain + manifest |
| `/dashboard` balance | `provider.getBalance()` (chain) |
| `/dashboard` receipts list | `unifiedFindByAgent()` (chain) |
| `/marketplace` skill list | Goldsky subgraph + chain-fallback |
| `/marketplace/<id>` recent receipts | Goldsky subgraph |
| `/marketplace/payouts` lifetime earned | `SkillRunPayment.creatorLifetimeEarned[creator]` (chain) |
| `/marketplace/payouts` withdrawable balance | `SkillRunPayment.creatorBalance[creator]` (chain) |
| `/admin/treasury` accumulator | `SkillRunPayment.treasuryBalance()` (chain) |
| `/agent/<handle>` profile | Passport contract reads (chain) |
| `/r/<id>` chip status | Verifier output (computed from on-chain + storage state) |

**Method:** for each surface, open DevTools network panel and verify the RPC/GraphQL call is fired. If a value renders from `numbers.json` instead of live chain â€” that's a fail unless the surface is explicitly labeled "snapshot from <date>" (e.g. README auto-rendered numbers).

PASS = every dynamic number/list/state on every page is traceable to a real chain or subgraph call in the network tab.

### D Â· UX race + edge cases

| Edge case | Expected behavior |
|---|---|
| Double-click submit button mid-tx | Second click ignored OR shows "already submitting"; never produces 2 txs |
| Click button â†’ navigate away â†’ tx still pending | Returning to the page shows the resolved state (success/fail); no lost result |
| Tx in flight â†’ switch wallet in MM | UI prompts to reconnect; doesn't claim the new wallet's address paid the previous tx |
| Form submit â†’ page reload | Reload doesn't resubmit (browser back/forward addressed in DT-4) |
| Receipt anchored mid-page-view | If user is on `/marketplace` when the tx confirms, the list updates without manual refresh (or shows a "new receipt â€” refresh?" toast) |
| Subgraph indexer lag (~1-2 blocks behind) | UI shows the chain-direct value with a "indexer catching up" hint, NOT a fake "no data" |

PASS = every edge case behaves predictably; no silent loss of action, no two-txs-for-one-click, no claim-other-wallet's-action.

### Why this priority exists

The lower-priority flows test individual happy paths. Priority 16 is the SWEEP that catches "did the action propagate to every place it should." Without it, a bug like "marketplace shows old price after creator updates it" would only surface if a specific lower priority happened to drive that exact flow. P16 is the systematic answer: every chain write Ã— every UI surface that should reflect it.

---

## Priority 15 Â· Vercel production verification

Prove the live deployment at `https://ivaronix.vercel.app` is actually serving the latest committed code, not a stale build.

| What to check | Method | Expected |
|---|---|---|
| Latest commit deployed | `vercel inspect ivaronix.vercel.app` or check Vercel dashboard | Commit SHA matches `git log --oneline -1` on `main`. |
| Env vars set in Vercel | Vercel dashboard â†’ Settings â†’ Environment Variables | `IVARONIX_*` canonical vars present; `SUBGRAPH_URL` set to Goldsky endpoint. |
| OG image route serves PNG | `curl -I https://ivaronix.vercel.app/r/1004/opengraph-image` | Returns 200 + `content-type: image/png`. |
| API routes respond | `curl https://ivaronix.vercel.app/api/dashboard/<addr>` | Returns 200 + valid JSON. |
| Custom domain (post-promotion) | DNS resolves | Custom domain points at Vercel; HTTPS valid. |

---

## Pass Rule (no fake green)

UI is done only when EVERY shipped UI feature has:

- A real-user action performed via real MetaMask + real browser
- The expected outcome observed and recorded
- Screenshot AND/OR video evidence under `QA_PROOF_PACK/ui/<priority>/`
- Wallet count proven where needed (per CLAUDE.md Â§16: 1-wallet / 2-wallet / 3-wallet)
- No fake state, no dead CTA, no hidden broken mobile layout
- Each screenshot inspected by the agent (per CLAUDE.md Â§17.7) with 1-sentence visual confirmation
- Operator spot-check completed on the captured proof
- Cross-tool consistency check (P13) green for the same flow

If a flow cannot be proven from UI: mark it `NOT UI-SHIPPED` and move it out of the product claim. Don't fake it.

---

## Order of execution (the canonical sequence)

```
PART 1 Â· UI (P0â€“P16)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
UI Inventory Gate
  â†“
P0 Setup
  â†“
P1 Landing â†’ P2 Demo â†’ P3 Run â†’ P4 Receipt
  â†“
P5 Marketplace â†’ P6 Memory â†’ P7 Agent â†’ P8 Skills
  â†“
P9 Data Room â†’ P10 Docs â†’ P11 Mobile â†’ P12 Final UI Pass
  â†“
P13 Cross-tool (CLI light) â†’ P14 Performance â†’ P15 Vercel
  â†“
P16 Data freshness Â· read-after-write Â· cross-user Â· real-source binding
  â†“
PART 1 DONE âœ“

PART 2 Â· CLI + MCP + Cross-machine
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
P17 CLI test phase (every ivaronix command, every behavior, every outcome)
  â†“
P18 MCP test phase (Claude Desktop + Cursor, every tool, every behavior)
  â†“
P19 Cross-machine receipt replay (fresh machine, the kill-shot)
  â†“
PART 2 DONE âœ“

POST-TEST (gated externally)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Mainnet smoke (after Block K operator funds deployer)
  â†“
Demo rehearsal (Block M Â· 3 intervention-free dry-runs at 1440Ã—900 + 375Ã—812)
  â†“
3-tester PMF gate (Block N Â· recruit 3 unaffiliated humans)
  â†“
HackQuest submission
```

When a priority's items all `PASS`, mark it `DONE` in the daily checkpoint and move to the next. When a single item fails: stop, fix properly per the fail rule, re-test, then continue.

**Part 2 starts ONLY after Part 1 is fully `PASS` on every priority.**

---

## Feature â†’ priority coverage matrix

Every shipped feature mapped to the test priority that exercises it. Goal: prove no feature is missed.

| Shipped feature | Block | Priority covering it | Notes |
|---|---|---|---|
| `SkillRunPayment.sol` (pull-pattern fee split) | A | **P3** (payment-tx binding) + **P5** (marketplace buy â†’ withdraw â†’ refund) | 3-wallet flow exercises creator/buyer/treasury |
| `SkillPricing.sol` (per-skill price storage) | A.1 | **P5** (skill detail price display + price editing) | Price editing covered explicitly |
| Receipt schema Â· `billing.payment` block | B | **P3** + **P4** + **P13** | Payment block visible on `/r/<id>` |
| Receipt verifier Â· 5-check payment binding | B | **P3** (UI display) + **P13** (CLI cross-check) | Tampered txHash fails closed |
| Receipt schema Â· `execution.model.source` enum | B/G | **P4** (TEE/model block Â· 0GM badge) | Green chip for 0G; amber for external |
| Receipt schema Â· `og.da.batched` reserved field | B | (not user-visible Â· roadmap) | DA integration documented, not shipped |
| Studio `/api/run/estimate` + `/api/run/confirm` (402-style) | C | **P3** (estimateâ†’confirm flow + 5 distinct error messages) | New payment-aware flow |
| CLI payment (`--pay` / `--subsidise` / `--no-payment`) | D | **P13** (cross-tool consistency) | Light CLI cross-check |
| Studio `/?demo=true` zero-friction | E | **P2** (main flow + OOF fallback) | Both paths covered |
| Demo wallet monitor + OOF fallback UX | E | **P2** (lower priority within P2) | After main flow proven |
| 0G KV self-host (Docker stack + HttpKvClient + chain-grant) | F | **P6** (cross-session persistence + multi-user isolation + KV-down fallback) | All 3 sub-conditions |
| 0GM model first-class display | G | **P4** (model block) | Source enum honest tagging |
| IETF AAT export (`--format aat`) | H | **P13** (CLI cross-check) | `pnpm ivaronix receipt verify <id> --format aat` |
| Marketplace 5 routes (browse/detail/new/payouts/admin) | I | **P5** (entire priority) | All 5 routes |
| 3-wallet UI flow scaffold | J | **P5** (3-wallet creator/buyer/treasury sub-flow) | Per CLAUDE.md Â§16 |
| Mainnet deploy prep | K | (deferred Â· gated on operator OG bridge) | Tested post-deploy |
| README persona-first hero + thesis + SECURITY + CONTRIBUTING | L | **P1** (landing) + **P10** (legal/docs/thesis) | Hero verify chip + persona h1 wrap |
| `docs/JUDGE_REPLAY.md` + `demo-fallback.ts` | M | **P15** (Vercel verify) + cross-machine replay | Tested on clean clone |
| Goldsky subgraph (v1.0.0 wizard Â· 3 events) | O | **P5** (subgraph + chain-fallback) | v2.0.0 multi-contract via CLI pending |
| ReceiptRegistryV3 slots 10/11/12 | (B-V2-32) | **P4** + **P9** (data_room_create Â· data_room_read Â· memory_consolidation) | Slots beyond V2 cap |
| AgentPassportINFTV2 (K-1+K-4+K-6 fix) | (planning-003) | **P7** (passport mint + trustScore) | Authorized recorders only |
| CapabilityRegistryV2 (memory grants) | (B-V2) | **P6** (grant â†’ revoke â†’ access denied) | Chain-grant authoritative |
| MemoryAccessLogV2 (self-log + grant-backed log) | (B-V2) | **P6** (multi-user isolation) | V2 enforcement |
| Erc7857Verifier (passport attestor signatures) | (planning-003) | **P9** (if UI surfaces; else `NOT UI-SHIPPED`) | Chain primitive, not Studio surface |
| Burn Mode AES-256-GCM (session key destruction) | (K-20 fix) | **P3** (Burn Mode toggle) + **P4** (keyFingerprint on receipt) + **P9** (data room keyFingerprint) | Threat-model defended end-to-end |
| EIP-712 anchor signature recovery (V2/V3) | (K-2 fix) | **P4** (verifier passes; agentAddress matches recovered signer) | Implicit in FULLY VERIFIED âœ“ |
| Canonical hash (polyglot byte-equality) | (core) | **P13** (CLI cross-check verifies same hash) | TS+Python+Rust |
| `SubscriptionEscrowV2.sol` | (B-V2) | **NOT UI-SHIPPED** (no Studio route) | Contract deployed; marketplace copy explicitly says "No subscriptions" for v1; v1.1 if needed |

### Multi-wallet interaction coverage

| Interaction shape | Priority | Sub-conditions per CLAUDE.md Â§16 |
|---|---|---|
| 1-wallet (operator-only flows) | P0, P3, P7, P8 | (a) real on-chain tx Â· (b) UI in MM Â· (c) CLI cross-check |
| 2-wallet (memory grant: A owner + B grantee) | P6 | (a) tx from A Â· (b) UI as A AND B Â· (c) CLI matches Â· (d) chainscan |
| 2-wallet (data room: owner + reader) | P9 | (a) tx from owner Â· (b) UI as owner AND reader Â· (c) CLI Â· (d) chainscan |
| 2-wallet (delegate: principal + delegate) | P9 | (a) tx from principal Â· (b) UI as principal AND delegate Â· (c) receipt shows delegate signer |
| **3-wallet (marketplace: A creator + B buyer + C treasury)** | P5 | (a) 4 distinct txs Â· (b) UI as A AND B AND C Â· (c) CLI cross-check Â· (d) chainscan shows 3 senders |

Every shipped feature has at least one priority covering it. Every multi-wallet shape has its 4 sub-conditions explicit. No feature is invisible to the plan.

---

# =================================================================
# PART 2 Â· CLI + MCP + Cross-machine (after Part 1 UI is fully DONE)
# =================================================================

> Part 1 (P0â€“P16 above) is the UI sweep. **Part 2 starts only after Part 1 returns PASS on every priority** with full evidence in `QA_PROOF_PACK/ui/`.
>
> Same no-compromise rules: real CLI invocations, real Claude Desktop / Cursor sessions, real receipts, real on-chain side effects, real proof. Every command produces evidence; every behavior is verified; every outcome is checked like a real user / developer using the product.

## Priority 17 Â· CLI test phase (every `pnpm ivaronix <cmd>`)

Goal: prove the CLI is feature-equivalent to the UI. Every flow exercised from the terminal produces a receipt byte-equal to what the UI produced for the same flow.

### A Â· Demo + run commands

| Command | Args / state | Expected outcome |
|---|---|---|
| `pnpm ivaronix demo` | (default Â· operator key) | Anchors a receipt on Galileo Â· prints receipt id + chainscan link Â· receipt schema-valid |
| `pnpm ivaronix demo --pay private-doc-review` | (1 wallet Â· funded) | 5-check payment flow runs Â· receipt has `billing.payment` block with real txHash Â· creator + treasury bps match `SkillRunPaid` event |
| `pnpm ivaronix demo --subsidise` | (operator key) | Receipt anchors with `billing.payment.subsidised: true` Â· payer = operator wallet |
| `pnpm ivaronix demo --no-payment` | (free skill or no SkillPricing entry) | Runs without payment leg Â· receipt has NO `billing.payment` block |
| `pnpm ivaronix demo --pay <skill> --consensus high-stakes` | (1 wallet) | High-stakes consensus tier triggered Â· receipt records consensus.tier correctly |
| `pnpm ivaronix demo --pay <skill> --burn` | (1 wallet) | Burn Mode enabled Â· `execution.burnMode: true` Â· keyFingerprint present Â· session key destroyed (verify ciphertext is unreadable after run) |
| `pnpm ivaronix demo` Â· insufficient funds | (wallet â‰¤ price Â· or operator < 0.001 OG) | Clear error Â· no half-anchored receipt Â· exit code non-zero |
| `pnpm ivaronix demo` Â· invalid skill id | `--pay nonexistent-skill` | Clear "skill not found" error Â· exit code non-zero Â· no chain write |
| `pnpm ivaronix run <skillId> <inputFile> --pay` | (1 wallet) | Explicit paid run Â· same receipt shape as `demo --pay` |

### B Â· Receipt commands

| Command | Args / state | Expected outcome |
|---|---|---|
| `pnpm ivaronix receipt show <id>` | (valid id) | Pretty-prints receipt body Â· payer Â· creator Â· treasury Â· payment block Â· TEE state Â· chainscan link Â· matches UI `/r/<id>` byte-for-byte |
| `pnpm ivaronix receipt show <id>` | (invalid id) | Clear error Â· exit code non-zero |
| `pnpm ivaronix receipt verify <id>` | (valid id Â· no flag) | Runs schema + hash + signature + anchor checks Â· prints state machine (`ANCHORED` / `PAID` / etc.) Â· exit code 0 if PASS |
| `pnpm ivaronix receipt verify <id> --tee-independent` | (the kill-shot) | Re-runs `broker.processResponse` against actual 0G Compute provider Â· returns FULLY VERIFIED âœ“ all 5 checks Â· prints attestation summary |
| `pnpm ivaronix receipt verify <id> --tee-independent` | (TIER 2 receipt Â· NVIDIA/external) | Returns ANCHORED âœ“ (not TIER 1) Â· clearly marks external-signed Â· honest tier disclosure |
| `pnpm ivaronix receipt verify <id> --tee-independent` | (tampered receipt body) | Fails closed Â· INVALID state Â· clear error message Â· exit code non-zero |
| `pnpm ivaronix receipt verify <id> --tee-independent` | (fake payment.txHash) | Fails closed at PAID gate Â· "tx not found" or "binding mismatch" Â· no false positive |
| `pnpm ivaronix receipt verify <id> --format aat` | (any receipt) | Outputs valid AAT JSON per `draft-rosenberg-aat-01` Â· 34 fields populated Â· validates against the draft schema via `ajv` |
| `pnpm ivaronix receipt verify <id> --format aat | jq .aat_spec` | Returns `"draft-rosenberg-aat-01"` |

### C Â· Skill commands

| Command | Args / state | Expected outcome |
|---|---|---|
| `pnpm ivaronix skill list` | (no args) | Lists all first-party + on-chain skills Â· matches UI `/skills` count |
| `pnpm ivaronix skill show <id>` | (valid skill) | Prints manifest Â· permissions Â· hooks Â· creator Â· price (if set) |
| `pnpm ivaronix skill publish <path-to-SKILL.md>` | (1 wallet Â· funded) | 2 chain writes (SkillRegistry.publish + optional SkillPricing.setPrice) Â· skill appears in marketplace within ~1 block |
| `pnpm ivaronix skill publish <bad-manifest>` | (invalid Zod schema) | Clear validation error Â· no chain write |

### D Â· Passport + identity commands

| Command | Args / state | Expected outcome |
|---|---|---|
| `pnpm ivaronix passport show` | (1 wallet) | Prints passport id Â· trustScore Â· receipt count Â· creator stats |
| `pnpm ivaronix passport mint` | (1 wallet Â· no passport) | Mints AgentPassportINFTV2 Â· prints tokenId Â· chainscan link |
| `pnpm ivaronix passport mint` | (1 wallet Â· already minted) | Clear "already minted" Â· no double-mint Â· exit code non-zero |

### E Â· Memory commands

| Command | Args / state | Expected outcome |
|---|---|---|
| `pnpm ivaronix memory snapshot --upload` | (1 wallet Â· KV_REMOTE_URL set) | Uploads memory snapshot Â· returns snapshot root Â· persists across CLI restart |
| `pnpm ivaronix memory recall <id>` | (1 wallet Â· prior snapshot) | Returns same content that was written Â· cross-session persistence proven |
| `pnpm ivaronix memory recall <id>` | (KV_REMOTE_URL unset) | Falls back to in-memory client Â· clear "not durable" warning |
| `pnpm ivaronix memory grant <bytes32-id> <addr>` | (1 wallet) | Calls CapabilityRegistryV2.grant Â· returns tx hash Â· cross-check on chain |
| `pnpm ivaronix memory revoke <bytes32-id> <addr>` | (1 wallet) | Calls CapabilityRegistryV2.revoke Â· returns tx hash Â· grantee's next read fails |

### F Â· System commands

| Command | Args / state | Expected outcome |
|---|---|---|
| `pnpm ivaronix doctor` | (no args) | ALL GREEN check on every dependency: wallet balance Â· RPC reachable Â· contracts deployed Â· Router credential active Â· KV server (if configured) Â· subgraph (if configured) |
| `pnpm ivaronix doctor balance` | (no args) | Prints operator wallet balance in OG |
| `pnpm ivaronix doctor` | (broken env Â· no IVARONIX_SIGNER_KEY) | Clear error pointing at missing env var Â· exit code non-zero |

### G Â· Cross-tool consistency (UI vs CLI byte-equality)

| Action | Compare | Expected |
|---|---|---|
| Anchor a receipt via UI `/?demo=true` | Run `pnpm ivaronix receipt show <id>` on the resulting id | Byte-equal output to UI `/r/<id>` display |
| Anchor a receipt via CLI `demo --pay` | Open `/r/<id>` in browser | Byte-equal display to CLI `receipt show` |
| Verify same receipt in UI chip + CLI `verify --tee-independent` | Both return same state | UI chip "FULLY VERIFIED âœ“" iff CLI exit code 0 |
| AAT export | `verify --format aat` from CLI | Validates against `draft-rosenberg-aat-01` schema; UI doesn't ship AAT export (CLI-only feature) |

### H Â· CLI evidence rule

Each CLI command run produces:
- Terminal screenshot OR captured output in `QA_PROOF_PACK/cli/<command>/<test-id>-stdout.txt`
- For chain-write commands: chainscan link captured
- For receipt-producing commands: cross-check the receipt id against UI `/r/<id>`
- For multi-step commands: full session asciinema or screen recording

PASS = every command above is exercised with valid AND invalid args; output matches expected; exit code matches expected; cross-tool consistency held with UI for the same flow.

---

## Priority 18 Â· MCP test phase (Claude Desktop / Cursor integration)

The Model Context Protocol surface (`packages/mcp-server`) exposes Ivaronix as a tool to AI assistants. Test from BOTH Claude Desktop AND Cursor (they each consume MCP slightly differently).

### A Â· Setup

| Step | Expected outcome |
|---|---|
| Add Ivaronix MCP server to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS; equivalent on Windows) | Server appears in Claude Desktop's MCP server list Â· status: connected |
| Restart Claude Desktop | MCP tools become available in the chat tools list |
| Add same server to Cursor (Settings â†’ MCP) | Server connects Â· tools visible |

### B Â· Tool exercise (every tool, real Claude/Cursor session)

| MCP tool | Test prompt to Claude/Cursor | Expected outcome |
|---|---|---|
| `list_skills` | "Show me all Ivaronix skills" | AI calls `list_skills` Â· returns same skill list as `pnpm ivaronix skill list` Â· AI presents it readably |
| `run_skill` | "Use Ivaronix's private-doc-review skill on this contract: [paste]" | AI calls `run_skill` Â· receipt anchors Â· AI shows receipt id + proof link |
| `verify_receipt` | "Verify Ivaronix receipt 1004" | AI calls `verify_receipt` Â· returns FULLY VERIFIED âœ“ Â· presents the 5 checks |
| `show_receipt` | "Show me receipt 1004 details" | AI calls `show_receipt` Â· presents payer/creator/payment block readably |
| `passport_info` (if exposed) | "What's my Ivaronix passport status?" | AI calls the tool Â· returns trustScore + receipt count |

### C Â· Cross-tool consistency

| Action | Compare |
|---|---|
| Skill run via MCP | Receipt id matches what UI + CLI would produce for same input |
| `verify_receipt` via MCP | Same FULLY VERIFIED âœ“ state as UI chip + CLI `verify` |
| `list_skills` via MCP | Same count + names as `pnpm ivaronix skill list` + UI `/skills` |

### D Â· Error states (real-user testing)

| Scenario | Expected |
|---|---|
| Claude tries to call `run_skill` with no wallet funded | Tool returns clear error Â· AI surfaces "need funded wallet" |
| Tool call times out (RPC slow) | AI shows timeout Â· doesn't claim false success |
| Invalid skill name passed | Tool returns "skill not found" Â· AI re-asks user |

### E Â· MCP evidence rule

Each MCP tool call produces:
- Screenshot of the Claude Desktop / Cursor chat showing the AI's call + result
- Tool-call audit log from the MCP server (`packages/mcp-server` should log every invocation)
- For tools that produce on-chain side effects: chainscan link captured

PASS = every tool exercised from BOTH Claude Desktop AND Cursor with valid + invalid inputs; outputs match UI/CLI equivalents.

---

## Priority 19 Â· Cross-machine receipt replay (the kill-shot)

The CLAUDE.md Â§17.3a baseline: a stranger on a never-touched-Ivaronix machine can re-verify any production receipt in under 10 seconds. This proves the receipt model isn't relying on local state.

### A Â· Setup (clean machine)

| Step | Expected outcome |
|---|---|
| Use a different physical machine OR fresh Docker container OR fresh VM | No shared state Â· no Ivaronix install Â· no cached RPC |
| `git clone https://github.com/Pratiikpy/ivaronix.git && cd ivaronix` | Repo cloned |
| `pnpm install` | All deps install Â· no node_modules from prior machine |
| Copy `.env.example` to `.env` and fill ONLY `IVARONIX_SIGNER_KEY` (any random funded wallet â€” Galileo faucet works) | Env minimal Â· no operator secrets reused |

### B Â· Replay every receipt class

| Receipt to verify | Command | Expected |
|---|---|---|
| Canonical demo receipt (rec_1004) | `pnpm ivaronix receipt verify 1004 --tee-independent` | FULLY VERIFIED âœ“ all 5 checks |
| Fresh receipt anchored during this test run | `pnpm ivaronix receipt verify <fresh-id> --tee-independent` | FULLY VERIFIED âœ“ |
| Burn Mode receipt | `pnpm ivaronix receipt verify <burn-id> --tee-independent` | FULLY VERIFIED âœ“ Â· keyFingerprint matches |
| Payment receipt with full `billing.payment` block | `pnpm ivaronix receipt verify <paid-id> --tee-independent` | FULLY VERIFIED âœ“ Â· 5 payment-tx-binding checks pass |
| TIER 2 (external NVIDIA) receipt | `pnpm ivaronix receipt verify <ext-id> --tee-independent` | ANCHORED âœ“ but NOT TIER 1 Â· honestly marked external-signed |
| Multi-wallet 3-party flow receipt | Same | FULLY VERIFIED âœ“ from each of A/B/C's view |

### C Â· Public-proof-URL replay (zero install)

| Step | Expected |
|---|---|
| Open `https://ivaronix.vercel.app/r/1004` in incognito on the clean machine | Receipt renders without auth/wallet Â· all chips green |
| Open same URL in a different browser (Firefox/Safari on the same fresh machine) | Same render Â· no browser-specific failure |
| Right-click â†’ Copy link â†’ paste in another chat app | URL is the canonical public proof URL Â· works in any context |

### D Â· Cross-machine evidence rule

| Artefact | Where saved |
|---|---|
| Terminal recording of `pnpm ivaronix receipt verify <id> --tee-independent` on the fresh machine | `QA_PROOF_PACK/cross-machine/<machine-id>/verify-output.txt` |
| Screenshot of incognito browser showing `/r/<id>` rendered | `QA_PROOF_PACK/cross-machine/<machine-id>/incognito-render.png` |
| Hardware fingerprint (`uname -a` or `systeminfo`) proving distinct machine | `QA_PROOF_PACK/cross-machine/<machine-id>/machine-info.txt` |

PASS = a stranger could literally clone, install, and verify in under 10 minutes. No Ivaronix-specific local state required.

---

## Priority 20 · Post-green product UI upgrade gate

After all functional UI tests are green, do **not** stop immediately. First audit whether the UI presents Ivaronix as the best full product version, not as a narrow private-doc-review demo.

This is a product-quality gate, not a copy pass. The agent must inspect every visible feature and ask:

- Is this feature shown in the best possible UI version for a real product?
- Is the user flow obvious without explanation from the builder?
- Is the feature useful, complete, and connected to the rest of the workroom?
- Does the landing page show the full product clearly and professionally?
- Does anything feel like a hackathon placeholder instead of production software?

If the answer is weak, improve the UI before claiming launch-ready.

### A · Product version the UI must communicate

Ivaronix is the **verifiable AI workroom for teams, agents, and skill creators**.

The product should feel like one complete workspace:

| Module | UI must show clearly | Real destination |
|---|---|---|
| Workroom | Run private AI tasks: document review, repo audit, contract review, 0G integration check | `/`, `/onboard` |
| Consensus Mode | Multiple AI reviewers, agreement score, objections, final answer, cost, latency | Run panel + `/r/<id>` |
| Burn Mode | Private input, encrypted evidence, destroyed key, public receipt | Run panel + `/r/<burn-id>` |
| Proof Explorer | Model, skill, TEE status, Storage root, Chain tx, payment, verifier result | `/r/<id>` |
| Skills Marketplace | Browse real verified skills, pay in OG, run skill, creator earns, treasury fee tracked | `/marketplace`, `/marketplace/<skillId>`, `/marketplace/payouts` |
| Memory Center | Grant/revoke memory by agent, skill, project, or session | `/memory` |
| Agent Passport | Agent identity, trust score, receipt history, violations, authorized skills | `/agents`, `/agent/<handle>`, `/dashboard` |
| Team Workspace | Shared receipts, shared memory, audit logs, role-based access | data-room/delegate/team UI if shipped; otherwise label as roadmap, not live |
| Developer Layer | CLI verify, MCP tools, SDK/docs, embed widget | `/docs`, `/embed/r/<id>`, CLI/MCP docs |

Landing page loop:

**Run → Verify → Remember → Pay → Share**

Landing headline direction:

> Private AI work. Public proof. Paid skills. Controlled memory.

### B · Landing page audit after testing

When tests are green, review the landing page like a first-time judge with 3 minutes:

| Check | Expected outcome |
|---|---|
| The first viewport says what Ivaronix is in plain English | User understands the product without knowing TEE/JCS/internal terms |
| The page shows all real modules above | Product feels full, not like only doc review |
| Every module links to a real tested page | No dead button, no placeholder as live feature |
| Claims match actual test evidence | No feature is marketed stronger than its proof |
| Marketplace appears as a real product path | User sees browse → buy/run → receipt → creator payout |
| Memory/passport/proof/CLI are visible | Full product depth is not hidden 5 clicks deep |
| Mobile landing still explains the full product | Same story at 375×812, no cropped/overlapping module cards |

### B2 · Every-feature best-version UI audit

After landing page audit, inspect every feature page as a product designer and real user. Do not only confirm "it works"; confirm it is the best reasonable version for launch.

| Feature area | Best-version requirement |
|---|---|
| Run panel / Workroom | User immediately understands what to upload, what skill to choose, what mode does, what result they will receive |
| Consensus Mode | Agreement, objections, policy, cost, latency, and final decision are readable and useful, not hidden logs |
| Burn Mode | Privacy promise is clear; encrypted evidence/destroyed key/public receipt are visible in the flow and receipt |
| Proof Explorer | Receipt is useful to a non-builder: tx, Storage, model, TEE, skill, payment, and verify status are understandable |
| Marketplace | Browse, price, creator, buy/run, payment tx, receipt, creator earnings, and payout all feel like one real commerce flow |
| Memory Center | Grant/revoke permissions are understandable by agent, skill, project, and session; revoked state is obvious |
| Agent Passport | Identity, trust score, receipt count, capabilities, and history are clearly explained through UI, not only raw addresses |
| Team/data-room/delegate | Shared access, roles, invitations, audit logs, and wallet requirements are clear; roadmap parts are not presented as live |
| Dashboard/global feed | Shows useful product activity and next actions, not empty stats or decorative numbers |
| Developer/docs/embed | A developer can understand CLI verify, MCP, SDK, and embed usage without reading source code |
| Mobile | Every feature remains usable, readable, and non-overlapping at 375×812 |
| Error/loading/empty states | Every feature has professional states that tell the user what happened and what to do next |

PASS = every visible feature is not only functional, but presented with clear purpose, connected outcome, professional UI state, and honest proof.

### C · Half-baked feature audit

Before claiming launch-ready, inspect every visible feature and classify:

| Status | Meaning | Required action |
|---|---|---|
| Live | Built, tested, proof captured | Keep visible |
| Live but weakly explained | Works, but users may miss it | Improve copy/layout/CTA |
| Built but untested | Code exists, no real proof yet | Test before marketing it |
| CLI/backend-only | Not available in UI | Either link to docs/CLI or do not present as UI feature |
| Roadmap | Useful later, not live | Mark clearly as roadmap |
| Half-baked | Broken, fake, placeholder, or misleading | Fix, hide, or downgrade before launch |

No stopping condition is valid if the landing page undersells the product, any feature is shown in a weak/unclear UI version, the product feels narrower than the system actually is, the strongest proof loop is hidden, or a half-baked UI surface remains visible.

PASS = functional tests green + landing/product UI presents the full Ivaronix system clearly + every visible module is either tested live or honestly marked.

---

## Part 2 stop condition

UI test plan (Part 1), Part 2 (P17 + P18 + P19), AND Priority 20 all PASS with full evidence = product is **end-to-end provably correct from every surface** and presented as the strongest product version.

After Part 2 complete:
- Mainnet smoke test (when Block K deploys)
- Demo rehearsal (Block M Â· 3 intervention-free dry-runs at 1440Ã—900 + 375Ã—812)
- 3-tester PMF gate (Block N Â· recruit 3 unaffiliated humans)
- Submit to HackQuest

---

## Reference

- CLAUDE.md Â§16 â€” multi-wallet rules (1/2/3 wallet PASS criteria)
- CLAUDE.md Â§17 â€” UI testing no-skip rule, visual inspection rule
- CLAUDE.md Â§17.10 â€” Priority A/B/C tiering (this doc fulfills A; B is deferred â€” see `docs/EXTRATESTING.md`)
- `docs/EXTRATESTING.md` â€” explicitly-deferred test scope (cross-browser sweep, network failure injection, full accessibility, multi-tab/back-button, wallet auto-network-switch feature)
- `docs/BUILD_COMPLETE_AUDIT.md` â€” what's built vs gated vs needs-test

---

*2026-05-13 Â· Canonical UI test plan. No compromise. No half-baked. Real MetaMask. Real chain. Real proof.*
