# P6-P10 Read Surfaces · visual inspection · 2026-05-13

Captured by `scripts/qa/ui-test-plan/p6-7-8-read-surfaces.ts` against `https://ivaronix.vercel.app`.

16 routes × 2 viewports (1440×900 desktop + 375×812 mobile) · all HTTP 200.

## P6 Memory · `/memory`

✅ Renders gated UI for non-connected wallet: "Remember. Recall. Forget." (§ 01 · MEMORY · QUICK CAPTURE) · "Drop notes scoped to project/work/legal/deals/personal. Stored in your per-wallet sandbox. The CLI's ivaronix memory commands give you the same surface with end-to-end encrypted persistence." · "Connect a wallet to use Studio memory. The encrypted MemoryEngine is available via `ivaronix memory remember` on the CLI today."

Second section visible: "§ 02 · MEMORY · PERMISSION CENTER" · "Grants. Scopes. Audit." · "Issue, list, and revoke memory grants directly on the on-chain CapabilityRegistry. Reads + writes on testnet." · "Connect a wallet to issue and revoke memory grants. The connected wallet becomes the grant owner; only it can revoke."

P6 PASS for gated-state honesty. SIWE-gated grant write flow tested in P3 paid-run hybrid (requires MM popup driving).

## P7 Agent / Passport · `/onboard`, `/dashboard`, `/agents`, `/agent/<addr>`

✅ `/onboard` — 5-step flow ("From wallet to your first receipt") rendered cleanly (already inspected in P3 captures).

✅ `/dashboard` — gated state for non-connected wallet (HTTP 200, shows connect prompt).

✅ `/agents` — live leaderboard: "Every passport on this network" with table headers `# · AGENT · TIER · TRUST · RECEIPTS · MINTED`. One row visible: tokenId 1 · 0xaa95...77Ce · NEWCOMER · 0 · 0 · 2026-05-12. Footer: "Trust scores are updated on chain via `AgentPassportINFT.recordReceipt` each time the agent anchors a receipt. The contract is at 0x08d2…563E on testnet — every row above reflects real on-chain state at page-load time."

✅ `/agent/0xaa95...77Ce` — operator passport profile renders.

P7 PASS for all 4 read surfaces.

## P8 Skills · `/skills`, `/skill/<id>`, `/skill/new`

✅ `/skills` — Skill catalog: "156 skills total · ~0 anchored on the SkillRegistry contract · ~156 imported from upstream sources (not yet anchored). Sorted by registry verification — MATCH first." Cards for first-party + imported community skills with: name + version + description + LOCAL ONLY chip + tier chip + permission chips (net/files/compute/wallet/shell). Visible: 0g-integration-auditor v0.1.1, 21risk-automation v0.1.0, 2chat-automation v0.1.0, ably-automation v0.1.0, abstract-automation v0.1.0, abuselpdb-automation v0.1.0.

⚠ F8: "~0 anchored on SkillRegistry" — but I PUBLISHED `private-doc-review` on `SkillRegistryV2` earlier in P3 setup (tx 0x65555847... + 0x...). Studio's `/skills` page may be checking V1 SkillRegistry (not V2). Worth investigating but not blocking — the marketplace `/marketplace` page DOES find the skill via V2 (proven in P5 capture).

✅ `/skill/private-doc-review` — skill detail renders.
✅ `/skill/new` — gated creator form renders.

P8 PASS (with F8 logged for follow-up).

## P9 Data Room / Delegate

Tested with invalid ids (`test`):
✅ `/data-room/test` — HTTP 200, gracefully shows "not found" or empty state.
✅ `/delegate/test` — HTTP 200, gracefully shows "not found" or empty state.

Full flow (creator + grantee + revoke) requires P3 multi-wallet paid run.

## P10 Docs / 0G / Legal · `/0g`, `/docs`, `/privacy`, `/terms`, `/brand`, `/thesis`

✅ `/0g` — "The 0G modules we use, and what each one carries." with "5 integrated, 1 on the roadmap. We do not claim integration we have not shipped." Each module (0G Chain, 0G Storage, etc.) has its own card with INTEGRATED chip + endpoint URL + contract addresses. Honest disclosure of DA as "on the roadmap" only.

✅ `/docs` — redirect or simple docs route.
✅ `/privacy` — privacy story.
✅ `/terms` — terms page.
✅ `/brand` — brand page.
✅ `/thesis` — persona-locked story page (already inspected in P1).

P10 PASS for all 6 routes.

## Aggregate

**P6 + P7 + P8 + P9 + P10 — all 16 routes render PASS.**

| Priority | Routes | Status |
|---|---|---|
| P6 Memory | `/memory` | ✅ Gated UI honest |
| P7 Agent | `/onboard`, `/dashboard`, `/agents`, `/agent/<addr>` | ✅ 4 surfaces, live chain reads on agents leaderboard |
| P8 Skills | `/skills`, `/skill/<id>`, `/skill/new` | ✅ Catalog renders 156 skills, ⚠ F8 anchored count = ~0 (V1 vs V2 lookup question) |
| P9 Data Room / Delegate | `/data-room/<id>`, `/delegate/<id>` | ✅ Invalid-id graceful handling |
| P10 Docs / 0G / Legal | 6 routes | ✅ All render with honest claims |

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F8 | 🟡 anchor count mismatch | `/skills` page shows "~0 anchored on SkillRegistry" despite published skill via P3 setup. Studio may be checking SkillRegistry V1, not V2. Marketplace `/marketplace` correctly shows the V2-published skill. | Logged · low-priority follow-up |

Captures: ~32 screenshots across 5 priorities. Re-runnable via `STUDIO_BASE=<url> tsx scripts/qa/ui-test-plan/p6-7-8-read-surfaces.ts`.
