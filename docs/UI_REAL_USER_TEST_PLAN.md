# Ivaronix UI Real-User Test Plan

> Use every shipped UI feature like a real user. Prove the product feels clear, works end-to-end, and shows honest outcomes. No DOM-only testing. Real browser, real MetaMask, real clicks, real screenshots, real videos.

**Test order locked**: UI (this doc) → CLI (light cross-check inside UI) → MCP (smallest surface) → cross-machine replay (the kill-shot).

**Non-negotiable rule**: do not miss even one UI feature. Every item ends as `PASS` / `FAIL` / `NOT UI-SHIPPED` / `EXTERNAL-ONLY` with evidence. Real wallet features require real MetaMask, real account switching, real signatures, real tx popups.

---

## How to run this plan

### Fail rule (the no-compromise rule)

If any item fails:
1. **Stop** — do not continue to the next priority.
2. **Fix in the proper way** — read the code, the docs, the resources, the project context. No quick patches, no fake green, no skip.
3. **Re-run** the failing item AND any earlier item the fix could have affected (regression sweep).
4. Only after the failing item is `PASS` with fresh evidence can the next priority start.

### Artefact organization (the proof folder rule)

Every test produces evidence under `QA_PROOF_PACK/ui/`:

```
QA_PROOF_PACK/ui/
├── P0-setup/
│   ├── desktop/                  # 1440x900 screenshots
│   ├── mobile/                   # 375x812 screenshots
│   ├── video/                    # full session .webm files
│   └── notes.md                  # per-item PASS/FAIL + 1-sentence inspection note
├── P1-landing/...
├── P2-demo/...
...
└── DAILY_CHECKPOINT.md            # daily summary updated as priorities close
```

Naming convention per screenshot:
`<priority>-<sub-id>-<step>-<state>.png`
Example: `P3-run-04-mm-confirm-popup.png` · `P5-marketplace-09-payouts-after-withdraw.png`

### Definition of evidence (minimum for PASS)

A test is `PASS` only when ALL of these exist:
- Screenshot at every meaningful state transition (pre-action, MM popup, post-confirm, final state)
- For any flow longer than 3 clicks: full session video (`.webm`)
- For chain-write actions: chainscan link recorded in `notes.md`
- Agent inspects each screenshot via `Read` and writes 1-sentence visual confirmation in `notes.md` (per CLAUDE.md §17.7)
- Operator-confirmation loop: agent sends screenshot paths back to operator for spot-check before declaring `PASS`

### Daily checkpoint format

Update `QA_PROOF_PACK/ui/DAILY_CHECKPOINT.md` at end of each test day:

```markdown
## 2026-MM-DD (Day N)

| Priority | Status | Items pass/total | Blocker / next step |
|---|---|---|---|
| P0 Setup | DONE | 6/6 | — |
| P1 Landing | DONE | 7/7 | — |
| P2 Demo | IN PROGRESS | 3/5 | demo wallet OOF fallback flow next |
| P3 Run | NOT STARTED | 0/9 | — |
...
```

This is the only stop/resume contract — when restarting, read this file and pick up from the highest `IN PROGRESS` priority.

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
| Every loading / error / empty state | Trigger honestly via network/app state — no fake green. |

Current Studio route inventory:

`/`, `/0g`, `/admin/treasury`, `/agent/[handle]`, `/agents`, `/brand`, `/dashboard`, `/data-room/[id]`, `/delegate/[id]`, `/docs`, `/embed/r/[id]`, `/global`, `/marketplace`, `/marketplace/[skillId]`, `/marketplace/new`, `/marketplace/payouts`, `/memory`, `/onboard`, `/privacy`, `/r/[id]`, `/r/[id]/print`, `/skill/[id]`, `/skill/new`, `/skills`, `/terms`, `/test-wallet`, `/thesis`.

Dynamic routes must use real known ids:
- `/r/[id]`: fresh receipt from this test run + one canonical sample (rec_1004).
- `/marketplace/[skillId]`: real marketplace skill id (publish one in P5 if none exist).
- `/agent/[handle]`: real minted passport handle.
- `/data-room/[id]` + `/delegate/[id]`: real generated test ids OR mark `NOT UI-SHIPPED` if no real UI-created id exists.

---

## Priority 0 · Setup

Establishes the test environment. PASS gates the rest of the plan.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open live Studio at `https://ivaronix.vercel.app` desktop 1440×900 | 0 | Page loads fast (FCP < 2s feel), no broken layout, no console crash. |
| Open Studio on mobile 375×812 | 0 | No horizontal overflow, text fits, CTAs visible. |
| Connect MetaMask · operator wallet | 1 | Wallet connects, address appears, disconnect works. |
| Switch / add 0G Galileo network | 1 | Network state clear; wrong-network state guides user. |
| Account switching in MetaMask | 2-3 | UI updates when switching A/B/C; no stale wallet state. |
| Sign message · SIWE | 1+ | Signature prompt appears; result updates UI. Reject path also works. |
| Cold-load timing | 0 | Time to first paint < 2s; full hydration < 4s. Record in notes. |
| Fresh-install path | 0 | Clear localStorage; reload; verify onboarding still works (no stale session crashes). |
| Reload mid-tx | 1 | Refresh while tx pending; UI recovers cleanly (shows pending or repromtps). |

---

## Priority 1 · Landing Page

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Hero first viewport | 0 | Persona-first h1 ("A founder reviewing a term sheet shouldn't have to trust the AI") legible at 1440×900 AND wraps cleanly at 375×812 (no overflow, no cut-off). |
| Independent-verify chip in hero | 0 | The monospaced `$ pnpm ivaronix receipt verify rec_1004 --tee-independent → FULLY VERIFIED ✓` block renders inside the hero; mobile keeps horizontal scroll inside the chip, not the page. |
| Live receipt-count pulse | 0 | Green chip "X receipts on-chain · live" pulses smoothly; number is non-zero; pulse continues without stutter. |
| Primary CTA → /?demo=true | 0-1 | Click goes to demo path. |
| "Run on my own doc" → /onboard | 0-1 | Click goes to onboarding flow. |
| "Why Ivaronix" → /thesis | 0 | Opens thesis page with clear product story. |
| "BUILT ON 0G PROOF STACK" band | 0 | Says "0G PROOF STACK" (not "full OG stack"); DA shows "(integration documented)" qualifier, not as live. |
| Stat row (3 numbers) | 0 | Receipts/passports/skills render; First-party skills card reads from `verifiedSkillsCount` (NOT hardcoded). |
| Footer links | 0 | Every link works; no broken route. |

---

## Priority 2 · One-Click Demo

Main flow first; out-of-funds fallback is lower-priority below.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open `/?demo=true` | 0 | Demo panel loads without wallet friction. |
| Click `Run review` | 0 | Real run starts; loading state clear. |
| Wait for receipt | 0 | Receipt anchors; redirects to proof page within 30s. |
| Demo-subsidised badge | 0 | UI honestly says operator-subsidised; receipt's `billing.payment.subsidised: true`. |
| Operator-wallet address visible | 0 | Receipt shows operator paid; user wasn't asked to fund anything. |
| Refresh after success | 0 | Receipt/proof page still works after reload. |
| **(Lower priority — after main flow proven)** Demo wallet out-of-funds fallback | 0 | Drain demo wallet OR set `OUT_OF_FUNDS` flag manually. `/?demo=true` shows "Demo paused — connect your wallet" with working `[Connect]` button; no fake "demo running" state. |

---

## Priority 3 · Normal Private Review Flow (with payment)

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Upload/paste private document | 1 | Input accepted; no layout jump; file/text state visible. |
| Choose skill: private-doc-review | 1 | Skill selected; price/tier shown if paid. |
| Toggle Burn Mode | 1 | UI explains encrypted/private outcome, not vague hype. |
| Choose consensus tier (quick/standard/high-stakes) | 1 | Preview updates; price/time-estimate reflect tier. |
| Click run/pay → 402-style estimate | 1 | `/api/run/estimate` returns `{needsPayment, amount, paymentContract, ...}`; UI shows the estimate clearly before tx. |
| Sign payment in MM | 1 | MM popup shows correct gas + amount + recipient (paymentContract). |
| Confirm payment tx | 1 | Tx submits; UI waits and explains status. |
| `/api/run/confirm` server-side verify | 1 | Server runs the 5-check verifier (tx exists, to=paymentContract, from=payer, value=amount, event.receiptRoot=draftReceiptRoot). |
| Receipt creation | 1 | Proof page opens with receipt id, tx hash, model, TEE state, payment block. |
| **Payment-tx binding verification** | 1 | Receipt body MUST contain `billing.payment` block: `txHash` matches the on-chain tx, `creator` + `creatorBps` + `treasuryBps` match the SkillRunPaid event. Receipt's `verify` chip shows FULLY VERIFIED ✓ on this evidence. |
| Reject tx | 1 | UI recovers cleanly; no fake receipt; clear "tx rejected" state. |
| Insufficient funds | 1 | Wagmi pre-check OR clear error toast; no stuck spinner. |
| File size limit | 1 | Try a 100KB+ doc — accepted or clear "too large" error. |

---

## Priority 4 · Receipt / Proof Explorer

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open `/r/<id>` | 0 | Receipt renders publicly without login. |
| Verification status chip | 0 | Shows VERIFIED / ANCHORED / PAID / INVALID honestly. |
| Payment block | 0 | Shows payer, creator, treasury, amount, tx hash if paid. |
| TEE / model block (0GM badge · Block G) | 0 | Shows TIER 1 + 0GM chip (green) for 0G runs; external = amber. `execution.model.source` enum displayed. |
| Storage evidence block | 0 | Shows evidence root/status; pending labeled pending. |
| **Burn Mode evidence** (Block F) | 0 | When receipt has `execution.burnMode: true`: receipt page shows `storage.encryption.keyFingerprint` (sha256 of the destroyed session key) — proves the session key once existed and is now destroyed. |
| **EIP-712 anchor signature recovery** (Block K-2 fix · V2/V3) | 0 | Verifier passes: ECDSA signature recovers to `agent.ownerWallet`; `agentAddress` on chain matches recovered signer (NOT msg.sender). |
| Chain / explorer links | 0 | Every tx/address link opens the correct 0G chainscan. |
| Share button | 0 | Share text/link correct; copy-to-clipboard puts the right URL. |
| Print page `/r/<id>/print` | 0 | Readable, professional; print preview looks clean. |
| **OG image** at `/r/<id>/opengraph-image` | 0 | Open URL directly → returns 1200×630 PNG. Paste `/r/<id>` URL into Twitter card validator + Slack + Discord — preview shows correct title/description/image. |
| **Embed view** at `/embed/r/<id>` | 0 | Renders a compact embeddable card; works iframed in another HTML page. |
| **Stranger-replays in incognito on different machine** | 0 | Open `/r/<id>` in fresh incognito on a non-Ivaronix machine; FULLY VERIFIED ✓ renders without auth/wallet. |
| **V3 receipt slots 10/11/12** | 1+ | Verify receipts with `receiptType` slot 10 (doc_room_create), 11 (doc_room_read), 12 (memory_consolidation) anchor on `ReceiptRegistryV3` and render correctly on `/r/<id>` (V2 capped at slot 9; V3 admits these). |
| Invalid receipt id | 0 | 404/error state is clean and helpful. |

---

## Priority 5 · Marketplace 3-Wallet Flow

Roles: A = creator · B = buyer · C = treasury/admin.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/marketplace` browse | 0 | Skills list loads from subgraph (Goldsky v1.0.0) + chain-fallback. No fake empty state. |
| Open skill detail `/marketplace/[skillId]` | 0 | Skill price, creator, bps split, recent receipts shown clearly. |
| **Subgraph-down fallback** | 0 | Block Goldsky URL in DevTools network panel → marketplace still loads via chain reads (slower but functional). |
| Creator publishes skill `/marketplace/new` | A | 2 MM popups (publish + setPrice); skill appears in marketplace within 1 block. |
| **Skill price editing** | A | Creator updates `priceWei` via setPrice; new price reflects in marketplace within 1 block. |
| Buyer buys/runs skill | B | MM payment tx opens; tx confirms; receipt anchors. |
| Payment-split display | B/C | Receipt shows buyer paid, creator share, treasury share; bps match `SkillRunPaid` event. |
| **Free skill (priceWei=0)** | B | Skill with price=0 runs without payment popup; receipt has no `billing.payment` block. |
| Creator payouts `/marketplace/payouts` | A | Creator earnings appear; withdraw button works. |
| Creator withdraw | A | MM popup → confirm → tx → creator receives funds; balance updates. |
| Treasury / admin `/admin/treasury` | C | SIWE-gated; treasury amount visible; admin-only controls. |
| Wrong-wallet admin access | B | Buyer cannot access `/admin/treasury` (403). |
| Wrong-wallet withdraw | B | Buyer cannot withdraw creator OR treasury funds. |
| **Refund flow (admin)** | C | Admin calls `refundFailedRun(receiptRoot)`; payer receives refund; receipt updates `refunded: true`. |
| **Filter / sort controls** | 0 | Sort by price / popularity / recent / trust. Filters apply correctly. |
| Failed payment | B | No receipt claim; UI explains retry/cancel. |

---

## Priority 6 · Memory / Permission 2-Wallet Flow

Roles: A = memory owner · B = grantee/reader.

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/memory` as owner | A | Existing grants/memory state loads OR clean empty state. |
| **KV server down fallback** | A | When `KV_REMOTE_URL` not set OR EverMemOS unreachable: UI uses `InMemoryKvClient` (dev fallback) with clear "memory is session-only" banner. No silent data loss. |
| Grant memory to Wallet B | A+B | MM tx opens; grant appears with scope/session/project. |
| View as Wallet B | B | Granted memory visible/usable only within allowed scope. |
| **Cross-session persistence** | A | Write memory → close browser → reopen → verify memory persisted (only with real KV `KV_REMOTE_URL` set). |
| **Multi-user isolation** | A+B | Wallet A writes memory item; Wallet B's `/memory` view does NOT show it without an explicit grant. |
| Revoke grant | A | Revoke tx confirms; status changes to revoked. |
| Try access after revoke | B | Access denied cleanly; no stale memory leak. |
| Invalid grantee address | A | Button stays disabled OR shows clear validation error. |

---

## Priority 7 · Agent / Passport / Dashboard

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

## Priority 8 · Skill Pages

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/skills` | 0 | Skills load; search/filter works if present. |
| `/skill/<id>` | 0 | Skill details, permissions, pricing, model/tier clear. |
| `/skill/new` OR `/marketplace/new` | 1 | Creator form works; client-side Zod validation prevents bad data. |
| Save / publish skill | 1 | Tx or API result clear; new skill appears where expected. |
| **Hook configuration** | 1 | Pre/post-consensus hook list (`redact_pii`, `balance_check`, etc.) renders correctly in skill detail. |
| **Tier-default UI** | 1 | Default consensus tier from skill manifest pre-selects in the run flow. |

---

## Priority 9 · Data Room / Delegate Flows

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Open data-room page | 1-2 | Room details, encrypted evidence, read-receipt UI render. |
| **Data room keyFingerprint visible** | 1-2 | The room's encryption keyFingerprint (sha256 of the destroyed session key) shown on `/data-room/<id>`. |
| **doc_room_create receipt (V3 slot 10)** | 1 | Creating a data room anchors a receipt with `receiptType: 10` on `ReceiptRegistryV3`. |
| Reader access | 2 | Allowed reader can view permitted info only. |
| **doc_room_read receipt (V3 slot 11)** | 2 | Reader's access anchors a receipt with `receiptType: 11`; reader's wallet recorded. |
| Denied reader | 2 | Denied state clear; no sensitive data shown. |
| Delegate page | 1-2 | Delegate identity, permissions, signer boundary clear. |
| **Erc7857Verifier attestor flow** | 1 | If UI surfaces attestor-signature flow: add attestor → attestor signs attestation → verifier confirms. If no UI: mark `NOT UI-SHIPPED` (Erc7857 attestation is checked at receipt-verify time via the deployed contract; the verifier is a chain primitive, not a Studio surface). |
| Delegate receipt link | 0 | Receipt proves delegate signer correctly. |

---

## Priority 10 · Docs / 0G / Legal Pages

| What to use | Wallets | Expected outcome |
|---|---:|---|
| `/0g` | 0 | Shows real 0G components used; no fake DA/live claims. |
| `/docs` | 0 | Redirect or docs route works intentionally. |
| `/privacy` | 0 | Privacy story matches product behavior. |
| `/terms` | 0 | Terms page loads. |
| `/brand` | 0 | Brand page matches visual system. |
| `/thesis` | 0 | Product story clear and non-technical enough. |

---

## Priority 11 · Mobile + Visual Polish

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Landing mobile | 0 | Hero readable, CTA visible, no overflow. |
| Run flow mobile | 1 | Buttons reachable; MM popup flow not confusing on mobile. |
| Receipt mobile | 0 | Proof details readable; long hashes wrap. |
| Marketplace mobile | 0-3 | Cards, payment, payout screens usable. |
| Memory mobile | 1-2 | Grant/revoke forms fit screen. |
| **Touch targets ≥ 44px** | 0 | Every clickable element ≥ 44×44px (WCAG AA minimum). |
| **Keyboard hides input on iOS** | 1 | Input fields near bottom of form remain visible above the keyboard. |
| **Landscape orientation** | 0 | Rotating phone doesn't break layout. |
| Dark / black surfaces | 0 | Text contrast good; no overlap. |
| Loading states | any | Every long action shows progress. |
| Error states | any | Every failure explains next step. |
| Empty states | any | No blank page; clear next step. |

---

## Priority 12 · Final UI Pass

| What to use | Wallets | Expected outcome |
|---|---:|---|
| Every nav item | 0-1 | Route opens, active state correct. |
| Every button / CTA | varies | Real use OR removed/disabled honestly. |
| Every form | varies | Validation, submit, success, failure all work. |
| Every transaction | varies | MM opens, tx confirms/rejects cleanly, explorer link works. |
| Every public proof link | 0 | Works without wallet/login. |
| Full screen recording | varies | A human can watch and understand the product. |

---

## Priority 13 · Cross-tool consistency (CLI cross-check inside UI testing)

Goal: prove UI + CLI + chain + subgraph all agree on the same receipt. Light CLI usage inside the UI test phase — not full CLI testing (that's the next phase).

| What to use | Wallets | Expected outcome |
|---|---:|---|
| UI anchors receipt → CLI verifies | 1 | After UI run produces `rec_<id>`: run `pnpm ivaronix receipt verify <id> --tee-independent` from terminal. Result: FULLY VERIFIED ✓ all 5 checks (schema, hash, signature, anchor, payment, TEE). |
| UI displays receipt → CLI shows match | 1 | `pnpm ivaronix receipt show <id>` displays the same payer/creator/bps/tx hash that the UI's `/r/<id>` page shows. Cross-tool byte-equal. |
| Subgraph indexes receipt → UI marketplace refresh | A+B | After a `SkillRunPaid` event: subgraph query at the Goldsky endpoint returns the new Payment entity within ~1 block; marketplace UI refresh shows the updated lifetime earnings. |
| Chain-fallback path | 0 | With Goldsky blocked in DevTools: marketplace UI falls back to direct chain reads; same data appears (slower). |

PASS gates the move to dedicated CLI testing phase.

---

## Priority 14 · Performance baseline

Establish numbers before launch so post-launch regressions are visible.

| What to measure | Tool | Threshold |
|---|---|---|
| Landing FCP (First Contentful Paint) | Lighthouse / Chrome DevTools | < 2s desktop; < 3s mobile |
| Landing LCP (Largest Contentful Paint) | Lighthouse | < 2.5s desktop; < 4s mobile |
| Time to first receipt (cold start `?demo=true`) | Stopwatch | < 30s (per CLAUDE.md product SLA) |
| Receipt page render `/r/<id>` | Stopwatch | < 1s for cached receipt; < 3s cold |
| Lighthouse score (5 key pages) | Lighthouse | Performance ≥ 80, Accessibility ≥ 90 |
| Bundle size first-load JS | `next build` output | < 300 KB gzip for landing |

Record numbers in `QA_PROOF_PACK/ui/P14-performance/numbers.md`.

---

## Priority 15 · Vercel production verification

Prove the live deployment at `https://ivaronix.vercel.app` is actually serving the latest committed code, not a stale build.

| What to check | Method | Expected |
|---|---|---|
| Latest commit deployed | `vercel inspect ivaronix.vercel.app` or check Vercel dashboard | Commit SHA matches `git log --oneline -1` on `main`. |
| Env vars set in Vercel | Vercel dashboard → Settings → Environment Variables | `IVARONIX_*` canonical vars present; `SUBGRAPH_URL` set to Goldsky endpoint. |
| OG image route serves PNG | `curl -I https://ivaronix.vercel.app/r/1004/opengraph-image` | Returns 200 + `content-type: image/png`. |
| API routes respond | `curl https://ivaronix.vercel.app/api/dashboard/<addr>` | Returns 200 + valid JSON. |
| Custom domain (post-promotion) | DNS resolves | Custom domain points at Vercel; HTTPS valid. |

---

## Pass Rule (no fake green)

UI is done only when EVERY shipped UI feature has:

- A real-user action performed via real MetaMask + real browser
- The expected outcome observed and recorded
- Screenshot AND/OR video evidence under `QA_PROOF_PACK/ui/<priority>/`
- Wallet count proven where needed (per CLAUDE.md §16: 1-wallet / 2-wallet / 3-wallet)
- No fake state, no dead CTA, no hidden broken mobile layout
- Each screenshot inspected by the agent (per CLAUDE.md §17.7) with 1-sentence visual confirmation
- Operator spot-check completed on the captured proof
- Cross-tool consistency check (P13) green for the same flow

If a flow cannot be proven from UI: mark it `NOT UI-SHIPPED` and move it out of the product claim. Don't fake it.

---

## Order of execution (the canonical sequence)

```
UI Inventory Gate
  ↓
P0 Setup
  ↓
P1 Landing → P2 Demo → P3 Run → P4 Receipt
  ↓
P5 Marketplace → P6 Memory → P7 Agent → P8 Skills
  ↓
P9 Data Room → P10 Docs → P11 Mobile → P12 Final UI Pass
  ↓
P13 Cross-tool (CLI light) → P14 Performance → P15 Vercel
  ↓
UI DONE → move to dedicated CLI test phase
```

When a priority's items all `PASS`, mark it `DONE` in the daily checkpoint and move to the next. When a single item fails: stop, fix properly per the fail rule, re-test, then continue.

---

## Feature → priority coverage matrix

Every shipped feature mapped to the test priority that exercises it. Goal: prove no feature is missed.

| Shipped feature | Block | Priority covering it | Notes |
|---|---|---|---|
| `SkillRunPayment.sol` (pull-pattern fee split) | A | **P3** (payment-tx binding) + **P5** (marketplace buy → withdraw → refund) | 3-wallet flow exercises creator/buyer/treasury |
| `SkillPricing.sol` (per-skill price storage) | A.1 | **P5** (skill detail price display + price editing) | Price editing covered explicitly |
| Receipt schema · `billing.payment` block | B | **P3** + **P4** + **P13** | Payment block visible on `/r/<id>` |
| Receipt verifier · 5-check payment binding | B | **P3** (UI display) + **P13** (CLI cross-check) | Tampered txHash fails closed |
| Receipt schema · `execution.model.source` enum | B/G | **P4** (TEE/model block · 0GM badge) | Green chip for 0G; amber for external |
| Receipt schema · `og.da.batched` reserved field | B | (not user-visible · roadmap) | DA integration documented, not shipped |
| Studio `/api/run/estimate` + `/api/run/confirm` (402-style) | C | **P3** (estimate→confirm flow + 5 distinct error messages) | New payment-aware flow |
| CLI payment (`--pay` / `--subsidise` / `--no-payment`) | D | **P13** (cross-tool consistency) | Light CLI cross-check |
| Studio `/?demo=true` zero-friction | E | **P2** (main flow + OOF fallback) | Both paths covered |
| Demo wallet monitor + OOF fallback UX | E | **P2** (lower priority within P2) | After main flow proven |
| 0G KV self-host (Docker stack + HttpKvClient + chain-grant) | F | **P6** (cross-session persistence + multi-user isolation + KV-down fallback) | All 3 sub-conditions |
| 0GM model first-class display | G | **P4** (model block) | Source enum honest tagging |
| IETF AAT export (`--format aat`) | H | **P13** (CLI cross-check) | `pnpm ivaronix receipt verify <id> --format aat` |
| Marketplace 5 routes (browse/detail/new/payouts/admin) | I | **P5** (entire priority) | All 5 routes |
| 3-wallet UI flow scaffold | J | **P5** (3-wallet creator/buyer/treasury sub-flow) | Per CLAUDE.md §16 |
| Mainnet deploy prep | K | (deferred · gated on operator OG bridge) | Tested post-deploy |
| README persona-first hero + thesis + SECURITY + CONTRIBUTING | L | **P1** (landing) + **P10** (legal/docs/thesis) | Hero verify chip + persona h1 wrap |
| `docs/JUDGE_REPLAY.md` + `demo-fallback.ts` | M | **P15** (Vercel verify) + cross-machine replay | Tested on clean clone |
| Goldsky subgraph (v1.0.0 wizard · 3 events) | O | **P5** (subgraph + chain-fallback) | v2.0.0 multi-contract via CLI pending |
| ReceiptRegistryV3 slots 10/11/12 | (B-V2-32) | **P4** + **P9** (data_room_create · data_room_read · memory_consolidation) | Slots beyond V2 cap |
| AgentPassportINFTV2 (K-1+K-4+K-6 fix) | (planning-003) | **P7** (passport mint + trustScore) | Authorized recorders only |
| CapabilityRegistryV2 (memory grants) | (B-V2) | **P6** (grant → revoke → access denied) | Chain-grant authoritative |
| MemoryAccessLogV2 (self-log + grant-backed log) | (B-V2) | **P6** (multi-user isolation) | V2 enforcement |
| Erc7857Verifier (passport attestor signatures) | (planning-003) | **P9** (if UI surfaces; else `NOT UI-SHIPPED`) | Chain primitive, not Studio surface |
| Burn Mode AES-256-GCM (session key destruction) | (K-20 fix) | **P3** (Burn Mode toggle) + **P4** (keyFingerprint on receipt) + **P9** (data room keyFingerprint) | Threat-model defended end-to-end |
| EIP-712 anchor signature recovery (V2/V3) | (K-2 fix) | **P4** (verifier passes; agentAddress matches recovered signer) | Implicit in FULLY VERIFIED ✓ |
| Canonical hash (polyglot byte-equality) | (core) | **P13** (CLI cross-check verifies same hash) | TS+Python+Rust |
| `SubscriptionEscrowV2.sol` | (B-V2) | **NOT UI-SHIPPED** (no Studio route) | Contract deployed; marketplace copy explicitly says "No subscriptions" for v1; v1.1 if needed |

### Multi-wallet interaction coverage

| Interaction shape | Priority | Sub-conditions per CLAUDE.md §16 |
|---|---|---|
| 1-wallet (operator-only flows) | P0, P3, P7, P8 | (a) real on-chain tx · (b) UI in MM · (c) CLI cross-check |
| 2-wallet (memory grant: A owner + B grantee) | P6 | (a) tx from A · (b) UI as A AND B · (c) CLI matches · (d) chainscan |
| 2-wallet (data room: owner + reader) | P9 | (a) tx from owner · (b) UI as owner AND reader · (c) CLI · (d) chainscan |
| 2-wallet (delegate: principal + delegate) | P9 | (a) tx from principal · (b) UI as principal AND delegate · (c) receipt shows delegate signer |
| **3-wallet (marketplace: A creator + B buyer + C treasury)** | P5 | (a) 4 distinct txs · (b) UI as A AND B AND C · (c) CLI cross-check · (d) chainscan shows 3 senders |

Every shipped feature has at least one priority covering it. Every multi-wallet shape has its 4 sub-conditions explicit. No feature is invisible to the plan.

---

## Reference

- CLAUDE.md §16 — multi-wallet rules (1/2/3 wallet PASS criteria)
- CLAUDE.md §17 — UI testing no-skip rule, visual inspection rule
- CLAUDE.md §17.10 — Priority A/B/C tiering (this doc fulfills A; B is deferred — see `docs/EXTRATESTING.md`)
- `docs/EXTRATESTING.md` — explicitly-deferred test scope (cross-browser sweep, network failure injection, full accessibility, multi-tab/back-button, wallet auto-network-switch feature)
- `docs/BUILD_COMPLETE_AUDIT.md` — what's built vs gated vs needs-test

---

*2026-05-13 · Canonical UI test plan. No compromise. No half-baked. Real MetaMask. Real chain. Real proof.*
