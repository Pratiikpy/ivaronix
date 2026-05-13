# Ivaronix · Final-Build Test Plan

> The complete UI test catalogue. Gated by CLAUDE.md §17.10 priority order.
> **Priority A must be fully PASS before any Priority B test runs. Priority B must be fully PASS before any Priority C test runs.**
> Written 2026-05-13 alongside `FINAL_BUILD_PLAN.md`.

---

## 0 · How to use this document

1. For every UI flow shipped (see `FINAL_BUILD_PLAN.md §4` Block list), walk every Priority A row below against that flow.
2. Each row produces a PASS / FAIL / PENDING status with a proof-artefact path (screenshot / video / chainscan link).
3. Aggregate the per-flow status into the per-block acceptance criteria.
4. A block is DONE only when every Priority A row for its flows is PASS.
5. Move to Priority B only when all Priority A is green.
6. Move to Priority C only when all Priority B is green (Priority C is post-launch v1.1 backlog by default; only attempt if A+B are early).

---

## Priority A — submission blockers (every row PASS before submission)

### A.1 · Error-state realism (9 failure modes per shipped flow)

Every UI flow must explicitly test every failure mode below. Driver: real browser + real wallet + real network. No mocking the failure; either trigger the real failure or use Playwright's network/route interception to inject the failure honestly.

| ID | Failure mode | How to trigger | Expected UX | Proof artefact |
|---|---|---|---|---|
| A.1.1 | Compute returns 500 | Playwright `route.fulfill({status: 500})` on `/v1/chat/completions` | Inline error: "Inference provider unavailable. Try again or switch model." Retry button. Receipt not anchored. No payment taken (or refunded). | screenshot + console log |
| A.1.2 | Storage indexer 504 | Playwright route `evmrpc-testnet.0g.ai` or indexer URL → 504 | Inline error: "Storage upload failed. Retrying in 5s..." 3 retry attempts visible. After 3 fails: option to anchor without evidence (with explicit "evidence pending" badge on receipt). | screenshot + retry log |
| A.1.3 | Wallet rejects tx | User clicks "Reject" in MM popup | Inline: "Payment cancelled. No receipt was created. No OG was charged." Clean return to pre-flow state. NOT a generic "Transaction failed". | screenshot |
| A.1.4 | Tx times out (>60s no confirm) | Submit with low gas; wait | Inline: "Payment pending — check MM for status. [Tx hash: 0x...]" Refresh button. NOT a hang. | screenshot + tx hash |
| A.1.5 | Network switched mid-flow | User clicks MM "Switch to Ethereum" while pipeline running | Inline: "Network changed to Ethereum. Switch back to Galileo to continue. [Switch Network]" Button triggers MM popup. | screenshot + MM popup |
| A.1.6 | SIWE session expires mid-flow | Wait 24h+ in localStorage OR force-clear session cookie | On next action: redirect to re-auth flow. State preserved (the doc / skill selection / draft survives the re-auth). | screenshot + session log |
| A.1.7 | Galileo halts mid-anchor | Real halt OR Playwright network down on RPC | Inline: "Chain unreachable. Anchor queued. Will retry every 60s." Visible queue. CLI verify shows "anchoring..." not "anchored". | screenshot + queue state |
| A.1.8 | Insufficient balance for Router (<1.1 OG) | Drain demo wallet OR connect a wallet with <1.1 OG | Inline: "Compute requires 1.1+ OG deposited to Router. [Deposit OG]" button → opens Router deposit flow. NOT generic "transaction failed". | screenshot |
| A.1.9 | Wallet locked / closed mid-flow | User closes MM while we await signature | Inline: "Wallet disconnected. [Reconnect]" Click → MM popup unlock. State preserved. | screenshot |

**Coverage matrix** (every cell must be filled per Block):

| Block | A.1.1 | A.1.2 | A.1.3 | A.1.4 | A.1.5 | A.1.6 | A.1.7 | A.1.8 | A.1.9 |
|---|---|---|---|---|---|---|---|---|---|
| C · /api/run payment | □ | □ | □ | □ | □ | □ | □ | □ | □ |
| E · ?demo=true | □ | □ | □ | □ | □ | □ | □ | □ | □ |
| I · /marketplace | □ | □ | □ | □ | □ | □ | □ | □ | □ |
| I · /marketplace/new | □ | □ | □ | □ | □ | □ | □ | □ | □ |
| I · /marketplace/payouts | n/a | n/a | □ | □ | □ | □ | □ | □ | □ |
| J · 3-wallet flow | □ | □ | □ | □ | □ | □ | □ | □ | □ |
| F · /memory grant flow | □ | □ | □ | □ | □ | □ | □ | □ | □ |

### A.2 · Stranger-replays-receipt (the central proof)

The product's entire claim is "anyone can verify on any machine." If this isn't tested, the product story doesn't exist.

| ID | Test | How | Pass condition | Proof |
|---|---|---|---|---|
| A.2.1 | `/r/<id>` works in incognito | Open production URL in Chrome incognito with no extensions, no auth | Page renders. Receipt body visible. TIER 1 chip green (or amber if TIER 2). Payment leg visible. Anchor tx + payment tx both linked to chainscan. | screenshot from incognito |
| A.2.2 | `/r/<id>` works in different browser | Same URL in Firefox + Safari + Edge + mobile WebKit (375×812) — different browsers, never seen Ivaronix | Page renders correctly in all 4 browsers. No console errors. Mobile reads cleanly without overflow. | 4 browser screenshots |
| A.2.3 | `/r/<id>` works on different machine | Different physical machine OR fresh VM | Same as A.2.1 | screenshot from VM |
| A.2.4 | CLI verify works on never-installed machine | `git clone` + `pnpm install` + `pnpm ivaronix receipt verify <id> --tee-independent` on a machine with no `.env`, no profile, nothing pre-cached | Exit code 0. FULLY VERIFIED ✓ printed. All 5 checks (schema, hash, signature, anchor, payment, TEE) green. | terminal screenshot or log file |
| A.2.5 | OG image renders for receipt URL | `curl /r/<id>/opengraph-image` from a fresh IP | Returns 200 PNG. Image shows receipt id + TIER chip + brand. NOT a 503 (the iter-150-era bug). | image file in proof pack |
| A.2.6 | The receipt URL is shareable via raw text | Copy URL → paste into a fresh email / Telegram / Slack / Twitter draft | URL is canonical (not `localhost:3300`, not `Vercel preview URL`, the production URL with the canonical ID). | screenshot of paste |

### A.3 · State recovery

Real users behave non-linearly. The product must survive.

| ID | Test | How | Pass condition | Proof |
|---|---|---|---|---|
| A.3.1 | Refresh mid-anchor | Click Run → page renders four-light row → F5 before chain anchor completes | Either: (a) the anchor completes and the resumed page shows the receipt, or (b) the page shows "Anchoring in progress... [Receipt id pending]" with a poll loop that resolves correctly. **NOT a stuck spinner or a lost receipt.** | screenshot + receipt id |
| A.3.2 | Close tab mid-wallet-popup | MM popup open for signing → user closes the Studio tab | MM popup persists (it's a separate window). User can either Approve (Studio reopens with the result via deep link / receipt URL) or Reject (no charge). | screenshot of MM popup post-close |
| A.3.3 | Browser back from /r/<id> | Anchor receipt → land on /r/<id> → click browser back | Returns to home page in clean state, NOT a stale "Anchoring..." view. Tab title updates. | screenshot |
| A.3.4 | Open /r/<id> from history | Anchor receipt → navigate elsewhere → 30 min later visit the receipt URL from history | Page renders correctly. Receipt data is the same as at anchor time (immutable). | screenshot + diff against pre-leave state |
| A.3.5 | Refresh /marketplace | Click around → F5 | Skill list re-fetches from subgraph; sort/filter state preserved in URL query params (or reset cleanly, but not into a half-state). | screenshot |
| A.3.6 | Refresh during payment popup | MM popup signing → F5 Studio | Studio resumes pre-popup state. Tx state is whatever MM did (if user confirmed, the receipt anchors via the confirm callback path; if rejected, Studio shows the cancel state). | screenshot |
| A.3.7 | History navigate to /admin/treasury without SIWE | Visit `/admin/treasury` via direct URL (no session) | Redirect to SIWE auth. Post-auth: lands on `/admin/treasury` if address matches `IVARONIX_ADMIN_WALLET`, else 403. | screenshot of redirect + 403 |

### A.4 · Receipt-as-shareable-artifact

The receipt is the product. People share it. Verify every channel:

| ID | Test | How | Pass condition | Proof |
|---|---|---|---|---|
| A.4.1 | Twitter card unfurls | Paste `/r/<id>` into Twitter compose (or use `https://cards-dev.twitter.com/validator`) | Title + description + OG image render. Image is 1200×630. Brand visible. | screenshot of Twitter preview |
| A.4.2 | Slack unfurl | Paste URL into a Slack message draft | Title + description + image render. No "Unable to load" error. | screenshot of Slack preview |
| A.4.3 | Discord unfurl | Paste URL into Discord message | Same as Slack. | screenshot of Discord preview |
| A.4.4 | LinkedIn unfurl | Paste URL into LinkedIn post draft (or use LinkedIn Post Inspector) | OG image renders; title + description correct. | screenshot of LinkedIn preview |
| A.4.5 | Telegram preview | Paste URL into Telegram chat | OG image renders inline. | screenshot |
| A.4.6 | Print receipt page | Open `/r/<id>` → Ctrl+P → "Save as PDF" | PDF renders cleanly: brand mark, receipt body, TIER chip, payment tx, signature block, anchor tx, chainscan QR code (if implemented), date/time. No broken layout. | PDF file in proof pack |
| A.4.7 | Right-click → Save Image As on OG image | Right-click the OG image, save as PNG | File saves. PNG is 1200×630. Visible content matches what social previews showed. | PNG file |
| A.4.8 | Mobile share intent | On mobile 375×812: tap share button on /r/<id> | Native share sheet opens with the canonical URL. Copy-link works. | screenshot |
| A.4.9 | OG image at the 3 scrapers | `curl -A "Twitterbot/1.0" /r/<id>/opengraph-image`, then `facebookexternalhit/1.1`, then `LinkedInBot/1.0` | All 3 return 200 PNG. | curl output + 3 image files |
| A.4.10 | Receipt URL works without trailing slash, with hash fragment, with query params | Visit `/r/<id>`, `/r/<id>/`, `/r/<id>#section`, `/r/<id>?ref=foo` | All render correctly. Query params don't break OG image fetch. | screenshots |

---

## Priority B — launch-ready blockers (after Priority A complete)

### B.1 · Accessibility (a11y)

| ID | Test | How | Pass condition | Proof |
|---|---|---|---|---|
| B.1.1 | Keyboard-only completion of demo flow | Tab + Enter + Esc only; no mouse | User can: navigate header, focus Run, trigger run, focus receipt link, navigate to receipt page. | screen recording with keyboard overlay |
| B.1.2 | Focus visible at every step | Tab through every interactive element | Visible focus ring on every focusable element. No element gets focus without an indicator. | screenshot of each focus state |
| B.1.3 | Focus trapped in modals | Open a modal (wallet connect, skill detail, share) → Tab through | Focus stays inside modal until close. Esc closes. | screen recording |
| B.1.4 | ARIA labels on non-text elements | Inspect chips, status indicators, copy buttons | Each has `aria-label` or visible text alternative. Screen reader announces correctly. | DOM snippets + screen-reader recording |
| B.1.5 | Color contrast WCAG AA | Run axe-core or pa11y against every Studio route | All text passes contrast: `body ink #0A0A0A` on `paper #FAFAF7` (passes); chips meet 4.5:1 for normal text or 3:1 for large; warning amber chip readable | axe report |
| B.1.6 | Screen-reader compatibility on /r/<id> | NVDA (Windows) or VoiceOver (mac/iOS) on receipt page | Announces: receipt id, status (FULLY VERIFIED), tier (TIER 1 TEE), payment amount, payer, creator, verification command. No "graphic" placeholders for meaningful content. | screen reader transcript |
| B.1.7 | Reduced-motion respected | Set system `prefers-reduced-motion: reduce` | Four-light row doesn't animate (or animates briefly without pulsing). Transitions reduced. | screen recording |
| B.1.8 | Semantic HTML | Inspect each route | Headings in order (h1 → h2 → h3, no jumps). Lists are `<ul>/<ol>`. Links are `<a>`, not `<div onclick>`. | axe / lighthouse a11y report |

### B.2 · Cross-browser

| ID | Test | Browser | Pass | Proof |
|---|---|---|---|---|
| B.2.1 | Safari iOS demo flow | Safari on iPhone 13+ at 375×812 | Full ?demo=true flow works. Wallet popup via WalletConnect or in-app browser. Receipt renders. | screen recording on real device |
| B.2.2 | Firefox demo flow | Firefox 120+ at 1440×900 | Full flow works. No CSS divergence vs Chromium. | screenshot |
| B.2.3 | Edge demo flow | Edge 120+ at 1440×900 | Full flow works. | screenshot |
| B.2.4 | Mobile WebKit /r/<id> | Safari iOS at 375×812 | Receipt page renders, chips legible, tap targets >=44px. | screenshot |
| B.2.5 | Mobile Chromium /r/<id> | Chrome Android at 412×915 | Same as Safari iOS. | screenshot |
| B.2.6 | OG images at all browser scrapers | `curl -A` with each browser's typical UA | Each returns 200 PNG. | curl outputs |

---

## Priority C — post-launch v1.1 backlog

Only attempt if Priority A AND Priority B are fully PASS for every flow. Otherwise queue in `docs/USER_TODO.md` for post-mainnet.

### C.1 · Performance / network-throttling

- C.1.1 Slow-3G demo flow under 8s render
- C.1.2 Large doc (50KB) input → handled with warning or graceful reject
- C.1.3 First-paint < 2s on broadband, < 5s on 3G
- C.1.4 Lighthouse performance score > 80 on all routes
- C.1.5 Bundle size budget enforced (~250KB initial JS, gzipped)

### C.2 · Internationalization / Unicode

- C.2.1 Paste CJK contract into demo doc field → model handles, receipt renders UTF-8
- C.2.2 Emoji in skill name survives canonical hash byte-equality
- C.2.3 RTL text (Arabic/Hebrew) → receipt page mirror layout
- C.2.4 Long input strings (10KB+) in form fields handled gracefully

### C.3 · Wallet edge cases

- C.3.1 User connects A → switches to B in MM mid-flow → Studio detects + prompts
- C.3.2 Two tabs open with different connected wallets → state doesn't conflict
- C.3.3 MM auto-lock during slow flow (~5 min idle) → graceful re-auth
- C.3.4 Permissions denied (clipboard) → receipt page still works
- C.3.5 Multiple wallet extensions installed (MM + Rabby + Phantom) → MM picked correctly

### C.4 · Devtools / extension interference

- C.4.1 Studio works with React DevTools open
- C.4.2 Works with uBlock Origin
- C.4.3 Works with Brave Shields enabled
- C.4.4 Works with HTTPS Everywhere
- C.4.5 Works with 1Password / LastPass autofill extensions

### C.5 · JS-disabled fallback

- C.5.1 `/r/<id>` with JS disabled renders static HTML version with receipt body + CLI verify command + chainscan link

### C.6 · Time-zone handling

- C.6.1 Receipt timestamps render in user's local TZ (or UTC, but consistently labelled)
- C.6.2 User in UTC+9 sees same UTC tx timestamp as user in UTC-5

---

## Aggregation: submission gate cross-reference

Per `FINAL_BUILD_PLAN.md §10 Definition of Done`, every Priority A row for every shipped flow must be PASS. Specifically:

- Block C (Studio /api/run payment-aware): A.1.1-A.1.9 + A.3.1, A.3.2, A.3.6 for the payment-confirm flow
- Block E (?demo=true): A.1.1-A.1.9 + A.2.1 + A.3.1, A.3.3, A.3.4 + A.4.1-A.4.10
- Block F (0G KV grant flow): A.1.1-A.1.9 (for /memory page) + A.3.7
- Block I (marketplace): A.1.1-A.1.9 for all 5 routes + A.3.4-A.3.7
- Block J (multi-wallet): A.1.1-A.1.9 × 3 wallets
- Block M (demo rehearsal): A.2.1-A.2.6 + A.4.1-A.4.10
- Block N (PMF gate): A.2.1-A.2.4 by each tester independently

Every Priority B row before mainnet promotion (B.1.1-B.1.8 + B.2.1-B.2.6).

---

## Proof-pack folder structure

```
QA_PROOF_PACK/
├── tests/
│   ├── priority-a/
│   │   ├── A.1-error-states/
│   │   │   ├── block-c-payment/A.1.1-compute-500.png
│   │   │   ├── block-c-payment/A.1.2-storage-504.png
│   │   │   └── ...
│   │   ├── A.2-stranger-replay/
│   │   │   ├── A.2.1-incognito-chrome.png
│   │   │   ├── A.2.2-firefox.png
│   │   │   ├── A.2.4-clean-machine-verify.log
│   │   │   └── ...
│   │   ├── A.3-state-recovery/
│   │   │   └── ...
│   │   └── A.4-shareable-artifact/
│   │       ├── A.4.1-twitter-preview.png
│   │       ├── A.4.6-receipt.pdf
│   │       └── ...
│   ├── priority-b/
│   │   ├── B.1-a11y/
│   │   └── B.2-cross-browser/
│   └── priority-c/ (post-launch)
└── matrix.md (this file's coverage matrix as live document)
```

---

## How an agent uses this document

1. Read CLAUDE.md §17.10 to confirm priority order is locked.
2. Pick a Block from `FINAL_BUILD_PLAN.md §4`.
3. Run every Priority A row that applies to the Block's flows. Per the priority rule, do NOT touch Priority B yet.
4. For each Priority A row: trigger the failure (or normal flow), capture screenshot, `Read` the screenshot per §17.7 visual-inspection rule, list findings, get operator spot-check.
5. Mark row PASS / FAIL / PENDING in the coverage matrix.
6. When ALL Priority A rows for the Block are PASS: Block is candidate for submission gate.
7. Move to Priority B only when all Priority A rows for ALL Blocks are PASS.
8. Priority C goes to post-launch `USER_TODO §B-V3-*` unless time allows.

**Forbidden shortcuts:**
- "Block C's A.1.1 happens to work the same as A.1.2 so I'll skip A.1.2" → no, every cell in the matrix is filled
- "I'll do Block E's A.1 in parallel with Block C's A.4" → fine within a Block, BUT no row marked PASS without proof
- "A.2.4 is a separate machine, hard to set up" → fine, but Priority A is not optional. Use a fresh VM or Docker container.
- "Priority B is so much more interesting" → no, A first. Always.

---

*— Written 2026-05-13. Locked by CLAUDE.md §17.10 priority order.*
