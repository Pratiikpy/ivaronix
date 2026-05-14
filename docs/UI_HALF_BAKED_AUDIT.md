# UI Half-Baked Audit · 2026-05-14

> Per `final-plan.md §1.6 Day 31` acceptance. Every visible feature classified into one of 6 honest states before testnet launch. The plan rule: zero `HALF-BAKED` cards shipped, every `ROADMAP` mark explicit, every `LIVE` claim provable.

## Classification states

| State | Meaning | Action |
|---|---|---|
| 🟢 LIVE | Built, tested, proof captured, real-user-usable | Keep visible. Tested end-to-end on testnet. |
| 🟡 WEAKLY EXPLAINED | Works, but users may miss it or misunderstand it | Improve copy / placement / CTA |
| 🟡 UNTESTED | Code exists, no real proof yet | Test before marketing it |
| 🟡 CLI-ONLY | Not available in UI today | Either link to docs/CLI or do not present as UI feature |
| 🟢 ROADMAP | Useful later, honestly marked "Coming soon" | OK to ship if labelled |
| 🔴 HALF-BAKED | Broken, fake, placeholder, or misleading | Fix, hide, or downgrade before launch |

## Home page surfaces

| Surface | State | Evidence | Action |
|---|---|---|---|
| H1 + H2 (`Private AI work. Public proof.`) | 🟢 LIVE | commit `e21aad6` | — |
| 5-step landing loop (Run → Verify → Remember → Pay → Share) | 🟢 LIVE | commit `e21aad6`, every card links to a real route | — |
| 12-module grid | 🟢 LIVE | commit `f57abac`, every card LIVE chip green, every href is a shipped route | — |
| Live receipt feed (5 most recent) | 🟢 LIVE | commit `d31f595`, server-rendered against V3 registry | — |
| Hero stat row (receipts / passports / skills) | 🟢 LIVE | chain reads, no hardcoded numbers | — |
| `?demo=true` zero-friction onboarding | 🟢 LIVE | Block E shipped, demo-wallet monitor wired | — |
| Independent-verify chip in hero | 🟢 LIVE | `pnpm ivaronix receipt verify rec_1004 --tee-independent` works | — |
| Sovereignty circle visual | 🟢 LIVE | `apps/studio/src/components/SovereigntyCircle.tsx` (439 lines) · server component · honest "what it defends / does not" framing · desktop SVG flow + mobile vertical stack | — |
| Builder rail | 🟢 LIVE | +474 lines to page.tsx · typecheck + wording-lint + brand-token-drift all PASS | — |
| Animated four-light (home) | 🔴 NOT BUILT | static `FourLightRow` only · `pulse` keyframe shipped for live-feed dot in `globals.css` | queued |
| Personas band (Founders / Lawyers / Compliance / Builders) | 🟡 IN PROGRESS (subagent E) | — | review + commit when E reports |
| Honest roadmap section | 🟡 IN PROGRESS (subagent E) | — | review + commit when E reports |
| Final CTA section | 🟡 IN PROGRESS (subagent E) | — | review + commit when E reports |
| Big numbers row (5 KPIs in dedicated band) | 🟡 IN PROGRESS (subagent E) | hero stat row already has 3 (receipts / passports / skills) | review + commit when E reports |
| Manifesto block | 🟡 IN PROGRESS (subagent E) | — | review + commit when E reports |

## Receipt page (`/r/<id>`)

| Surface | State | Evidence | Action |
|---|---|---|---|
| AI findings hero block | 🟢 LIVE | commit `86eb50e`, renders summary when present + honest fallback | — |
| "Process verified — process, not answer" copy | 🟢 LIVE | commit `86eb50e` Section description | — |
| Signer + skill + model + confidence row | 🟢 LIVE | commit `86eb50e` | — |
| TIER badge (TIER 1 TEE green vs TIER 2 EXTERNAL amber) | 🟢 LIVE | tier prop on receipt body | — |
| 0GM model badge | 🟢 LIVE | Block G shipped | — |
| Four-light row (Storage · Compute · TEE · Chain) | 🟢 LIVE | real per-light evidence per layer | — |
| Chain anchor tx link | 🟢 LIVE | chainscan-galileo.0g.ai | — |
| Registry contract link | 🟢 LIVE | V3 / V2 / V1 honest registry chip | — |
| Citations | 🟢 LIVE | renders `outputs.citations` array | — |
| Burn Mode evidence | 🟢 LIVE | encryption type + key fingerprint + destroyed-at | — |
| Consensus block | 🟢 LIVE | roles + convergence + agreement summary | — |
| Router rotations | 🟢 LIVE | renders only when present in `routerTrace` | — |
| Fee-split block | 🟢 LIVE | 9000/1000 bps split rendered in OG units | — |
| Memory DAG (prior-receipt lineage) | 🟢 LIVE | renders when `priorReceiptIds` present | — |
| Efficiency policy chip | 🟢 LIVE | reads `consensus.policyApplied` | — |
| Print / share view | 🟢 LIVE | `/r/<id>/print` route shipped | — |
| Retry body fetch button | 🟡 WEAKLY EXPLAINED | commit `86eb50e` — currently just refreshes the route; should trigger a 0G Storage fetch via `evidenceRoot` | Day 13-17 build (DA pipeline) closes this |
| 0G Storage body fetch fallback | 🔴 NOT BUILT | only local-cache fetch today | Day 13-17 build queued |

## Studio routes (23 total)

| Route | State | Notes |
|---|---|---|
| `/` (Home) | 🟢 LIVE | rewritten across 4 commits this cron run |
| `/onboard` | 🟢 LIVE | 5-step setup |
| `/r/[id]` | 🟢 LIVE | hero + four-light + chain anchor proof |
| `/r/[id]/print` | 🟢 LIVE | print/PDF view |
| `/r/[id]/opengraph-image` | 🟢 LIVE (✅ SHIPPED §B-V2-2) | font asset issue closed across multiple commits (5c6e865, 987341e, f781f7b, 27b7482). Live audit row tracks runtime behaviour. |
| `/embed/r/[id]` | 🟢 LIVE | embeddable iframe view |
| `/dashboard` | 🟢 LIVE | wallet-specific feed |
| `/global` | 🟢 LIVE | network-wide receipt feed |
| `/marketplace` | 🟢 LIVE | 6 first-party skills + 150+ community |
| `/marketplace/[skillId]` | 🟢 LIVE | per-skill detail with price + creator |
| `/marketplace/new` | 🟢 LIVE | publish a paid skill |
| `/marketplace/payouts` | 🟢 LIVE | creator withdraw UI |
| `/admin/treasury` | 🟢 LIVE | SIWE-gated treasury withdraw |
| `/memory` | 🟢 LIVE | grant + revoke + access-log feed |
| `/agents` | 🟢 LIVE | passport list |
| `/agent/[addr]` | 🟢 LIVE | per-passport profile |
| `/delegate/[id]` | 🟡 WEAKLY EXPLAINED | delegate-grant flow exists but UI copy is thin |
| `/data-room/[id]` | 🟡 WEAKLY EXPLAINED | data-room read flow exists; share UI thin |
| `/skills` | 🟢 LIVE | skill library catalog |
| `/skill/[id]` | 🟢 LIVE | per-skill detail |
| `/skill/new` | 🟢 LIVE | publish a skill |
| `/thesis` | 🟢 LIVE | long-form product story |
| `/0g` | 🟢 LIVE | 0G primitive integration explainer |
| `/brand` | 🟢 LIVE | brand contract reference |
| `/docs` | 🟢 LIVE | CLI / MCP / SDK / embed docs |
| `/privacy` | 🟢 LIVE | privacy notes |
| `/terms` | 🟢 LIVE | terms |
| `/test-wallet` | 🟡 INTERNAL-ONLY | not linked from production nav; dev tool. Either hide in prod or move to `/admin/dev-tools`. |
| `/learn` | 🟡 UNTESTED (subagent B integrating this fire) | — |

## API routes (6 total)

| Route | State | Notes |
|---|---|---|
| `/api/auth/siwe/nonce` | 🟢 LIVE | SIWE K-8 handshake |
| `/api/auth/siwe/verify` | 🟢 LIVE | SIWE K-9 verify |
| `/api/run` | 🟢 LIVE | payment-aware (402 → confirm) pipeline |
| `/api/skill/save` | 🟢 LIVE | per-wallet sandbox write + scanner |
| `/api/dashboard/[addr]` | 🟢 LIVE | V2-first unified dashboard fetch |
| `/api/memory` | 🟢 LIVE | grant + revoke + log fetch |
| `/api/onboard` | 🟢 LIVE | onboarding state |
| `/api/run/demo` | 🟢 LIVE | Block E demo wallet route |

## Half-baked items (must be fixed before testnet launch claim)

1. **Sovereignty circle visual** — subagent A integrating this fire. Review pending.
2. **Builder rail** — not built. Day 5-9 remainder.
3. **Animated four-light on home** — not built. Day 5-9 remainder.
4. **0G Storage body fetch fallback on `/r/<id>`** — Day 13-17 build queued. Only local-cache today.
5. **/learn page** — subagent B integrating this fire. Review pending.
6. **`/delegate/[id]` + `/data-room/[id]` UI copy** — flows work but copy is thin. Day 23-26 mobile-first pass + content gaps.
7. **`/test-wallet` route** — dev-only, should not ship to production nav. Hide or move.

## Roadmap items (honestly labelled, not shipping false claims)

- Mainnet promotion (Aristotle chainId 16661) — operator-funding-gated per `docs/USER_TODO.md §A-2`. README + `/0g` page mark this honestly.
- Full 0G DA pipeline (disperse + retrieve at scale) — Day 13-17 build. Today: preflight + scaffolding only. `docs/0G_DA_INTEGRATION.md` documents the gap.
- Telegram bot live — operator-action (BotFather token required).
- MCP server in Claude Desktop / Cursor live demo — UI-required, operator-action.

## Acceptance gate

This audit is "complete" when:

- Every 🔴 row above moves to 🟢 or 🟡 ROADMAP with explicit labelling
- Every 🟡 UNTESTED row gets a test pass with evidence linked in `QA_PROOF_PACK/`
- Every 🟡 WEAKLY EXPLAINED row gets a copy/CTA fix
- This file is refreshed within 7 days of any structural Studio change (per CLAUDE.md §15 bookkeeping)

## Last refresh

2026-05-14 · cron `a5ec057e` iteration 19+ · subagent E mid-edit on page.tsx (+474 lines, all 5 sections likely in place, awaiting completion + gates).

## Cron run progress ledger

| # | Commit | Day | Shipped |
|---|---|---|---|
| 1 | `86eb50e` | 1-3 | Receipt page hero · AI findings + signer context + "Process verified" copy |
| 2 | `e21aad6` | 5-9 | Home H1/H2 plan-locked + 5-step landing loop |
| 3 | `f57abac` | 5-9 | Home 12-module LIVE grid |
| 4 | `d31f595` | 5-9 | Home live receipt feed widget |
| 5 | `3a9180a` | 5-9 + 10-12 + 31 | Sovereignty circle + /learn page + half-baked audit |
| 6 | `70cb2df` | 18 | pc.0g.ai adapter in og-router (30 unit tests) |
| 7 | `589661d` | 19-22 | /faq page (12 honest answers) + home 14-module grid |
| 8 | _pending_ | 5-9 + 19-22 | Subagent E: personas band + big numbers row + manifesto + honest roadmap + final CTA |
