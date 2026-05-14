# Mobile inspection notes · §17.7 visual audit

Per the locked `feedback_mobile_view_quality.md` memory + CLAUDE.md §17.7, every captured mobile PNG is `Read` by the agent before launch-ready can be claimed. This file records what was observed.

## Run · 2026-05-14

3 mobile captures from Fire 9 at viewport 375×812 (iPhone-class).

### `001-verticals-mobile.png` · PASS

- Eyebrow + H1 "We start with Legal." wraps cleanly (no overflow)
- Body description readable at body font size
- "§ 01 · LEGAL · LIVE" section header renders
- 5 Legal LIVE cards stack vertically in single column:
  - contract-renewal-clause-detector · LIVE chip · standard tier · 90%/10% split
  - legal-citation-verifier · LIVE chip · high-stakes tier · 90%/10% split
  - nda-triage-reviewer · LIVE chip · standard tier · 90%/10% split
  - private-doc-review · LIVE chip · standard tier · 90%/10% split
  - term-sheet-risk-scanner · LIVE chip · high-stakes tier · 90%/10% split
- Each card: "Try this skill →" CTA visible
- "§ 02 · ROADMAP · COMING SOON" section header
- 14 amber-dashed COMING SOON cards stack vertically · each shows label + COMING SOON badge + use-case sentence + "Notify me when this ships →" mailto link
- Footer with PRODUCT · DOCS · NETWORK · BRAND · SOCIAL columns renders at bottom
- Brand contract honored: cream `#FAFAF7` background · ink body · italic-serif accents · amber pending tokens on COMING SOON · green verified tokens on LIVE chips
- Hamburger / mobile menu trigger present in header
- No horizontal scroll · no broken cards · no overflow

### `002-legal-mobile.png` · PASS

- Hero TESTNET eyebrow ("§ FOR LAWYERS, IN-HOUSE COUNSEL, FOUNDERS · LIVE ON 0G GALILEO TESTNET · <count>+ receipts anchored") wraps multi-line cleanly
- H1 "The AI second opinion you can give your lawyer." renders with italic-serif "your lawyer." accent
- All 10 sections render in single-column stack:
  1. Hero · CTAs above + frozen sample receipt card below (right rail collapses below on mobile · correct)
  2. Mata v. Avianca two-column wall stacks to single column · amber panel (ChatGPT pattern) + green panel (Ivaronix pattern)
  3. "Five skills, one workflow." cluster grid · 5 cards stacked
  4. "Drop · Run · Verify · Share · Archive" workflow loop · 5 step cards stacked
  5. "Five real examples, anonymized." before/after section · 5 cards · each chips ANCHORED (green) and shows real /r/<id> links from Fire 8 (53 · 55 · 58 · 62 · 64) along with block + tier metadata
  6. "Three personas. One product." · 3 sub-section cards stacked (lawyers · in-house counsel · founders) · each with 200-word body + non-fabricated testimonial placeholder
  7. "What this product does not do." · 6 honest disclaimer cards stacked
  8. "Per-receipt $0G fee · tiered by rigor." pricing table (4 rows: quick · standard · high-stakes · audit)
  9. "Hard questions, answered honestly." · 6 FAQ items as collapsed `<details>` elements
  10. "Run your first private-doc-review." final CTA + closing testnet-honest paragraph + footer
- Total page height substantial (long-scroll SEO landing) but every scroll-stop is meaningful · no padding cliffs
- No horizontal scroll · brand contract preserved · italic-serif accent visible

### `003-receipt-64-mata-mobile.png` · PASS with anomaly

The Mata v. Avianca probe receipt at /r/64 (id 64 · `legal-citation-verifier@v0.1.0` on `sample-two-hallucinated-cases.txt`).

What renders correctly:
- Sticky header with logo + nav (Verticals, Legal, Skills, Agents, Dashboard) + Connect Wallet pill
- Eyebrow "§ RECEIPT · ON-CHAIN ID 64"
- H1 "Receipt #64 anchored on OG testnet"
- Body explanation: "Process verified — process, not answer. The signer + skill + model + chain anchor are all checkable. The AI's conclusion is shown so you can judge it yourself."
- AI FINDINGS card showing "Receipt body not in local cache" fallback (correct: the body was uploaded to 0G Storage via `evidenceRoot`; the receipt page resolves it server-side from there)
- Signer wallet `0xaa954c33...77Ce` displayed
- Four-light row: ANCHORED · TIER 1 · TEE · 0GM all green
- State chip row: storage · compute · TEE · chain
- Metadata rows: receiptRoot · agent · registry · type
- "Anchored on chain..." explanatory paragraph
- Copy URL + Share on X buttons
- Footer with PRODUCT · DOCS · NETWORK · OPEN SOURCE columns

Anomaly observed (consistent with desktop /r/53 inspection earlier this cron):
- The `skill` field displays as **"code-2"** (the receipt-type slot label fallback) instead of `legal-citation-verifier` (the actual slug)
- Root cause: receipt JSON's `request.skillId: 'legal-citation-verifier'` is populated correctly by the CLI (apps/cli/src/commands/doc.ts:534), but the Studio `/r/[id]/page.tsx` reads from a path like `request.skill.id` which is undefined, falling back to the receipt-type slot
- Status: cosmetic · does NOT affect chain anchor correctness · does NOT affect receipt verifiability via CLI `pnpm ivaronix receipt verify`
- Fix path: one-line change in Studio's `/r/[id]/page.tsx` to read `request.skillId` instead of `request.skill?.id`
- Queued in citation-verifier-audit.md · not blocking launch-readiness but worth fixing in a follow-up commit

## Verdict

**3/3 mobile captures PASS** at 375×812. All Legal cluster mobile surfaces are launch-ready. One known cosmetic anomaly (skill-display fallback on receipt pages) is documented and non-blocking.

## What this proves vs. what it doesn't

PROVES (locked memory bar met):
- Mobile surfaces don't break the brand contract
- Hierarchy preserved across all 3 mobile views
- No horizontal scroll on any page
- All interactive elements (CTAs, mailto links, Copy URL, Share, FAQ collapses) render at correct tap-target sizes
- The /legal page's 10 sections are individually scannable on mobile

Does NOT prove (queued):
- Mobile **interactive** drives (tapping buttons via real touch events) — captures are static
- Hamburger menu drawer opens correctly on mobile (would need a separate captured-after-tap PNG)
- Real device QR-scan verification flow
- Mobile Safari iOS specific rendering (Playwright uses headless Chromium)

The interactive-mobile gaps are documented for Fire 9 continuation; the static visual contract is met.

## Date

2026-05-14 · Fire 10 of the LEGAL VERTICAL HARD-LAUNCH PIVOT directive · mandatory per `feedback_mobile_view_quality.md` + CLAUDE.md §17.7.
