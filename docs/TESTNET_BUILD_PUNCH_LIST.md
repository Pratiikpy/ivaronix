# Testnet build punch-list · cron-driven · final-plan.md §1.6

> Source of truth: `C:\Users\prate\Downloads\final-plan.md` §1.6 (Phase 1 testnet build queue · 30-35 dev-days). Cron `a5ec057e` fires every minute and continues this list. Each cron fire reads `final-plan.md` first, then picks up the highest-priority item with status ≠ DONE.

## State as of 2026-05-14

| Day | Item | Status | Owner | Acceptance |
|---|---|---|---|---|
| **1-3** | **Receipt page rewrite** — hero + "Process verified" copy + signer/skill/model/confidence + retry CTA | 🟢 SHIPPED commit `86eb50e` | cron | hero renders summary when present + honest fallback when absent · 4-light below the answer · tier badge + confidence visible |
| 4 | **Schema bump** — `summary` field + `ARCHIVED` state + tier + confidence + `acceptableModels[]` on skill manifest | 🟡 DEFERRED to coordinated polyglot sweep | cron | requires TS+Py+Rust mirror + 29 vectors re-pinned + pipeline-side summarizer · single-fire scope too tight; queued as one focused fire after Day 5-9 |
| 5-9 | **Home page rewrite** — H1/H2 + 5-step loop + 12-/14-module grid + live receipt feed + sovereignty circle + animated four-light + personas + big numbers + manifesto + builder rail + honest roadmap + final CTA | 🟢 SHIPPED `e21aad6 · f57abac · d31f595 · 3a9180a · 589661d · 70849cc · bbbb77f · 219dad0` | cron | 14-section landing live · every module card LIVE or honest ROADMAP · pre-commit gates green |
| 10-12 | **`/learn` page** — 7 explainer sections with anchor IDs for home-card deep-links | 🟢 SHIPPED `3a9180a` | cron + subagent B | 1220 lines · animated four-light · sovereignty rings · trust-gradient · receipt anatomy · consensus table · burn-mode · FAQ |
| 13-17 | **0G DA full pipeline** OR honest runbook | 🟡 preflight done · pipeline PENDING | cron | either (a) batch 10 → 1 anchor + 10 retrievable + cost delta documented, OR (b) `docs/0G_DA_INTEGRATION.md` Day-1 runbook + Phase 2 demote |
| 18 | **pc.0g.ai adapter** in `og-router` | 🟢 SHIPPED `70cb2df` | cron + subagent C | 234 lines + 214 lines test (30/30 PASS) · threat-model JSDoc · OpenAI-compat shape · backwards-compatible RouterCredential.kind |
| 19-22 | **Content gaps** — before/after + manifesto + why-now + `/faq` page | 🟢 SHIPPED `589661d · 70849cc · 1d4ac82` | cron + subagent D | /faq 690 lines · 3 before/after cards · manifesto block · personas serve as why-now |
| 23-26 | **Mobile-first pass** — receipt @ 375×812 · OG cards 1200×630 + 1080×1080 · PWA · sticky CTA | 🟡 partial | cron | every page §17.7-inspected at 375×812 · OG previewable in WhatsApp/iMessage/X |
| 27-28 | **Bilingual README + 90s demo video** | 🟡 README partial · video stale | cron | EN + 中文 README · `tour.webm` against POST-rewrite UI |
| 29-30 | **Marketplace + Memory + Passport multi-wallet UI proof** | 🟡 chain-side proven via burner (4 harnesses · 52/52 outcomes) · UI-side incomplete | cron | every multi-wallet row PASS in `MATRIX_AUDIT.md` · video for flows >3 clicks |
| 31 | **`docs/UI_HALF_BAKED_AUDIT.md`** + best-version audit | 🟢 SHIPPED `3a9180a · 44d5130` + best-version audit in flight (subagent H) | cron + subagent H | 6 of 7 half-baked items closed · only Storage body fetch fallback remains |
| 32-35 | **QA sweep + final polish** — Lighthouse 95+ · WCAG AA · empty/error/loading · reduced-motion · dark mode · Cloudflare WAF · Priority 20 external reviewer | 🟡 partial | cron + external reviewer | external reviewer signoff in `QA_PROOF_PACK/priority-20/` |
| 36 | **Claims-vs-built audit** — every UI/README claim traces to shipped feature or roadmap | 🔴 NOT STARTED | cron | `QA_PROOF_PACK/claims-audit/findings.md` one row per claim |

## Cron operating rules

1. **Every fire reads `C:\Users\prate\Downloads\final-plan.md` first** (per user directive).
2. **Don't add scope beyond final-plan.md §1.6.** No bonus pages, no nice-to-haves, no rebuilds of already-DONE items.
3. **Burner-wallet pattern** for chain-side testing (Pattern C · `ethers.Wallet.createRandom()` · no MM driving for fast testnet iteration). Real MetaMask reserved for mainnet promotion phase.
4. **Acceptance gate before claim of `done`**: each item's "Acceptance" column must be fully proven with linked evidence in `QA_PROOF_PACK/`.
5. **Half-baked audit before testing**: when build is complete (Day 31), run the §1.7 QA gate sweep BEFORE testing iteration starts.
6. **Marketplace = 3 wallets** (creator + buyer + treasury/admin). Memory = 2 wallets (operator + delegate).
7. **Mainnet (§2) is operator-funding-gated** — chain code is ready, deploy waits on ~0.15 OG on `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` via CEX bridge.

## Foundation already proven (don't redo)

- 15 contracts deployed on Galileo · 232/232 forge tests under `via_ir=true`
- Receipts anchored at scale across V1+V2+V3 (current count auto-derived in `docs/numbers.json`)
- Polyglot canonical hash byte-equal across TS+Python+Rust (29 vectors · CI-gated)
- 13/13 mainnet readiness checklist green on testnet
- 4 burner harnesses (`burner-3-wallet-flow` · `burner-all-features` · `burner-outcomes-deep` · `burner-cross-machine`) covering 52/52 outcome assertions + 14/14 cross-machine surface checks
- All 21 packages typecheck clean
- 93 source-file regressions pass on every commit

## Next cron fire

Starts work on **Day 1-3: Receipt page rewrite**. Reads `apps/studio/src/app/r/[id]/page.tsx`, diffs against final-plan.md §1.6 Day 1-3 acceptance, ships the rewrite in small commits per fire (read current → identify gaps → edit → screenshot-inspect → commit).
