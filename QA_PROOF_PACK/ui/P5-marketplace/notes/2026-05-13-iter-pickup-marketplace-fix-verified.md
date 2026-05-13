# P5 marketplace re-verify after fix · 2026-05-13

After the second-opinion agent caught the marketplace half-bake (hardcoded SAMPLE_CONTENT + setTimeout(6000)), I shipped 4 commits and re-captured the surface against the live Vercel deploy. Per CLAUDE.md §17.7 I `Read`'d each screenshot and noted what I saw.

## Commits driving this re-verify

| Commit | Fix |
|---|---|
| f35b2e2 | BuyAndRunButton: real file drop + textarea + question + Burn Mode + viem waitForTransactionReceipt + non-JSON response handling + SIWE handshake |
| 87382c2 | NewSkillForm + CreatorPayoutsPanel + AdminTreasuryPanel: setTimeout(6000) → viem waitForTransactionReceipt with revert detection |
| e3f61ed | BuyAndRunButton: rename `burnMode` → `burn` in API payloads to match Zod schemas |
| 06923ad | MemoryPanel: refetch-on-tx-confirmed side effect moved into useEffect (was bare render call · re-render thrash risk) |

## Visual inspection (every captured screenshot)

### Desktop 1440×900

- **001-marketplace-browse.png** — Skill browser loads. 4 skill cards visible. private-doc-review NOT listed by slug text (the cards show shortened skillId hashes, expected). Stats row shows "X skills available · native 0G settlement · data source: direct chain reads (no SUBGRAPH_URL)".
- **002-marketplace-mid.png + 003-marketplace-bottom.png** — Scroll positions of same page; "How it works" 5-step ordered list visible at the bottom; payouts link present.
- **004-skill-detail-hash.png** — `/marketplace/<0x0934cfc2…>` detail page. Pricing card showing skillId, creator 0xaa954c33…, price 0.005 OG, split 90% creator / 10% treasury, "creator receives ~0.004500 OG per run". Run-this-skill card visible with the NEW dropzone + textarea (top half visible in this shot).
- **005-skill-detail-mid.png** — KEY SHOT. Full "Run this skill" card visible:
  - dropzone "Drop a file or click to browse · or paste text below"
  - textarea "Paste contract, code, doc, or any text up to 256 KB…"
  - question input "Your question · e.g. 'Which clause is most risky?'"
  - Burn Mode checkbox + honest copy "encrypt input with a session key the operator destroys after the run"
  - bytes counter "0 / 262,144 bytes · drop content + question to enable"
  - **disabled** "Run with payment · 0.005000 OG →" button + "Connect your wallet (top right) to enable" guidance
  - Recent runs honestly says "No runs yet" with subgraph disclosure
- **006-skill-detail-bottom.png** — bottom of skill detail; Back to marketplace link visible.
- **007-skill-detail-slug.png** — `/marketplace/private-doc-review` (by slug, not hash). 404 / "Skill not found" — expected, the route matches by skillId hex, not slug. Acceptable for v1.
- **008-marketplace-new-gated.png** — `/marketplace/new` publish form. Inputs visible: skill slug, version, description, price (OG/run), creator share (bps). Submit button disabled (no wallet connected).
- **009-marketplace-payouts-gated.png** — `/marketplace/payouts`. "Connect your wallet (top right) to see your creator balance" empty state.
- **010-admin-treasury-gated.png** — `/admin/treasury`. "Connect your wallet (top right) to access the admin panel" empty state.

### Mobile 375×812

Same 10 screenshots at mobile viewport. Layout adapts cleanly:
- Cards reflow vertically
- Hero text wraps without overflow
- Form inputs span full width
- Touch targets remain ≥ 44px

## What's PROVEN by this capture

✅ Marketplace fix is deployed to Vercel (87382c2 deploy is live, e3f61ed + 06923ad CI in-flight)
✅ The new input UI renders identically to my code (file drop + textarea + question + burn-mode + correct gating)
✅ Disabled state when wallet not connected — correct per §17 "every disabled state honest"
✅ Mobile viewport at 375×812 doesn't break layout
✅ Honest empty states ("No runs yet · Recent-runs feed requires the Goldsky subgraph")
✅ All 5 marketplace routes return HTTP 200 (curl smoke test)

## What's NOT YET PROVEN

⏳ Real-MM end-to-end paid run from `/marketplace/<skillId>` (operator-at-keyboard required per CLAUDE.md §16.1 + §17.5 — MM popup driving is the operator-action gate)
⏳ Subgraph-down → chain-fallback path (need DevTools network block which is operator-at-keyboard)
⏳ Free-skill (priceWei=0) run (no free first-party skill on chain today)
⏳ Refund flow (admin-only · gated on Block N treasury ops)

These items move from PENDING to PASS when the operator drives the marketplace buy button through a real MM popup and produces a real on-chain receipt for this skill.

## P5 status after this iteration

| Sub-item | Before iter | After iter |
|---|---|---|
| /marketplace browse | PASS (capture) | PASS (re-capture) |
| /marketplace/[skillId] detail | PENDING (hardcoded input found) | **PASS (real input UI verified)** |
| Free-skill flow | NOT_UI_SHIPPED | NOT_UI_SHIPPED (no free skill priced) |
| Buy-and-run end-to-end via MM | PENDING | **STILL PENDING** (needs operator MM click) |
| /marketplace/new publish | PASS (capture) | PASS (re-capture) |
| /marketplace/payouts | PASS (capture) | PASS (re-capture) |
| /admin/treasury | PASS (capture) | PASS (re-capture) |
| Mobile @ 375×812 | PASS | PASS (re-capture) |

The half-bake is closed in code. The end-to-end PASS still gates on the operator clicking through a real MM popup to settle a paid run.
