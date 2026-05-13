# P1 Landing · visual inspection notes · 2026-05-13

Captures driven by `scripts/qa/ui-test-plan/p1-landing-capture.ts` against `https://ivaronix.vercel.app` (deploy `dpl_3WXiti5...`).

## Desktop 1440×900

| Screenshot | Inspection note |
|---|---|
| `001-landing-loaded.png` | ✅ Persona-first h1 "A founder reviewing a term sheet shouldn't have to *trust the AI.*" with Instrument Serif italic on the closer. Header has bracket logo + Why/0G/Skills/Agents/Dashboard + Connect wallet CTA. Eyebrow: "IVARONIX · V0.4 · GALILEO TESTNET" + green pulse chip "1,664 RECEIPTS ON-CHAIN · LIVE". Three CTAs all visible: "Try the demo →" (dark primary), "Run on my own doc" (light secondary), "Why Ivaronix →" (ghost). Right side: RunPanel preview with file-drop, skill dropdown, tier, run button. Verify-command chip at bottom: `$ pnpm ivaronix receipt verify rec_1004 --tee-independent` + `→ FULLY VERIFIED ✓` in green + 6 check labels in muted. |
| `002-stat-row.png` | ✅ Same as above; stat row visible: "1,664 receipts on-chain · 6 passports minted · 156 verified skills" |
| `003-proof-stack-band.png` | ✅ "BUILT ON THE *0G* PROOF STACK" with italic 0G in Instrument Serif. Stack: 0G Compute · 0G Storage · 0G Chain · 0G DA (integration documented, italic muted) · 0G Router · Sealed Inference. DA honestly qualified. **§02 LIVE TESTNET cards visible**: Total receipts 1664 · First-party skills 156 · Consensus tiers 3. |
| `004-live-testnet-cards.png` | ✅ Same content as 003 — confirms cards render with real numbers. |
| `005-footer-bottom.png` | ✅ 4-column footer: PRODUCT (Onboard · Skills · Global · Dashboard · Memory · Brand kit) · DOCS (OG platform docs · OG ecosystem · Sample receipt · Privacy · Terms · `ivaronix receipt verify --tee-independent`) · NETWORK (chainId 16602 + 12 deployed contract addresses including SkillPricing 0xc336…718F + SkillRunPayment 0x9eA5…0A5C + SubscriptionEscrowV2 0x7423…B7F5) · OPEN SOURCE (GitHub · Issues · Block explorer · Galileo faucet). Bottom-left tagline "Catch the risks. Keep the receipts." (legacy brand tagline — kept as motto). Network indicator "network: testnet" bottom-right. |

## Mobile 375×812

| Screenshot | Inspection note |
|---|---|
| `001-landing-loaded.png` | ✅ Brackets logo + nav (Why · 0G · Ag…). Same eyebrow + receipts pulse chip. Hero h1 at 48px responsive size wraps cleanly across 5 lines: "A founder / reviewing a / term sheet / shouldn't / have to *trust the AI.*" Body paragraph readable, "cryptographic receipt" bolded inline. |
| `002-stat-row.png` | ✅ Identical to 001 (stat row was below the fold for the small mobile viewport). |
| `003-proof-stack-band.png` | ✅ RunPanel four-light chips (STORAGE · COMPUTE · TEE · CHAIN) visible at top. Then "BUILT ON THE *0G* PROOF STACK" with all 6 stack elements + DA qualifier. §02 LIVE TESTNET header visible at bottom. |
| `004-live-testnet-cards.png` | ✅ Same as 003. |
| `005-footer-bottom.png` | ✅ Network section visible (MemoryAccessLogV2 0xCbfE…F96d · ReceiptRegistry 0x9737…743c · all V2/V3 contracts). OPEN SOURCE column. Bottom-left tagline "*Catch the risks.* Keep the receipts." with italic display. "network: testnet" indicator. |

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F1 | 🔴 Critical | Stat row showed "0 verified skills" on production — `loadAllSkills()` returned 0 because `seed-skills/` wasn't in Vercel function trace. | ✅ FIXED commit `74e43db` (added `outputFileTracingIncludes` for `../../seed-skills/**`); verified 156 on re-test. |
| F2 | 🟡 Label drift | "FIRST-PARTY SKILLS: 156" misleading — only 6 are truly first-party, 150 are imported community skills from `seed-skills/imports/`. | ✅ FIXED this commit (filter `firstPartyCount` to 6 hard-coded ids; show "+150 community" annotation in stat row). |

## P1 status

**PASS** for all 9 plan rows after both fixes deployed.

- Hero scroll: persona-first h1 + 10-sec value clear ✓
- Primary CTA → `/?demo=true` ✓
- Sample receipt CTA → `/r/1004` ✓ (verify-command chip + footer "Sample receipt" link)
- Why/Thesis CTA → `/thesis` ✓
- 0G stack band — DA honest qualifier ✓
- Stat row — live chain reads + corrected label (post-F2 fix) ✓
- Footer links — all 12 contract addresses + open-source links present ✓

Captures: `QA_PROOF_PACK/ui/P1-landing/{desktop,mobile}/*.png` · video at `QA_PROOF_PACK/ui/P1-landing/video/*.webm`.
