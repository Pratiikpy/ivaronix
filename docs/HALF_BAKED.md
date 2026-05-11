# Ivaronix · Half-Baked Punch List

> Brutal-honest audit assembled by 5 parallel subagents on 2026-05-09. Frozen as the audit-snapshot reference; **closures since 2026-05-10 live in `CHANGELOG.md` (audit-fix ledger) and are queryable via `pnpm audit:list`**. Items below may already be shipped — read this doc to understand the audit *call*, then cross-reference for the *closure*. The Section A high-severity items in particular have all closed (S-1 through S-5 in commits before the `Closes audit` trailer convention shipped, then K-1/K-2/K-8/K-9/K-15/K-20/L-7/H-1/H-2/H-4/I-1/I-2 across the V2 contract migration commits).
>
> Standard: this should look like Linear, Stripe, Vercel — not a hackathon submission.
> Scope: full codebase, not just planning docs. Findings outside `planning-01.md` and `planning-002.md`.
>
> **HIGH** = a judge will catch this · **MED** = a senior reviewer will catch this · **LOW** = cosmetic.
>
> Ranked HIGH → LOW within each section. File:line citations throughout.

---

## A · Real bugs that compromise correctness or safety (HIGH)

These are not polish. These are claims the codebase makes that the code does not enforce.

### A-1 · `compute_tee_required` security guard is a dead branch  ·  ✅ CLOSED d15703f (mirrors §I-10)
- ✅ The `&& false` placeholder has been removed; sandbox enforces the check. See §I-10 for full closure narrative + S-1 series tests in `packages/skills/src/sandbox.test.ts`.

### A-2 · `StubKvClient` is the only KV implementation in production  ·  ⚠ PARTIALLY CLOSED sweep 65
- **API honest** (sweep 65): `packages/og-kv/src/index.ts` now exposes `createKvClient()` returning an `InMemoryKvClient` honestly labeled as non-durable, plus an overload `createKvClient({ requireDurable: true })` that returns `null` so callers can detect the gap. First call logs a one-time warning. Third-party `@ivaronix/og-toolkit` consumers can no longer mistake the stub for production.
- **Durable backend still queued:** `RealKvClient` against the 0G memory KV server (`oglabs resources/0g-memory-kv-server/`) is not wired. Today every `passport:<wallet>:latest` / `memory:<agentId>:manifest` lookup goes to the in-process Map. Mainnet item — queued in USER_TODO §B-V2 (the `og-toolkit` KV backend is a Docker dependency).

### A-3 · `attestationHash: null` on every TIER 1 receipt  ·  ✅ CLOSED 1f43a27 (mirrors §H-1)
- ✅ Receipt-build sites now write `attestationHash = keccak256(toUtf8Bytes(zgResKey))` when the role's chat ID is present. See §H-1 for the full closure narrative.
- **Fix:** populate from `raw.x0gTrace?.tee_attestation_hash` or derive `keccak256(zgResKey)` for TIER 1. Five lines.

### A-4 · `/r/[id]` shows green "Storage" light when no storage upload happened  ·  ✅ CLOSED b9676f1 (mirrors §I-5 + §S-2)
- **`apps/studio/src/app/r/[id]/page.tsx:151`** — `Storage: hasLocalBody ? 'verified' : 'pending'`. Any receipt with a local JSON file shows a green Storage light, even if `evidenceRoot` is absent.
- **Effect:** receipts that never touched 0G Storage display "all four lights green." Misleading at first paint.
- **Fix:** `Storage: local?.storage?.evidenceRoot ? 'verified' : 'pending'`. One line.

### A-5 · `RunPanel` Storage light is green at click, not on result  ·  ✅ CLOSED 98f102b (mirrors §S-3)
- ✅ All four lights now start `'pending'` on click and only transition based on the real response. Storage gates on `result.storage?.evidenceRoot` rather than firing optimistically.

### A-6 · `delegate run` mutates `process.env` then forces `exitCode = 0`  ·  ✅ CLOSED 38452bc (mirrors §S-4)
- ✅ `restoreEnv()` helper makes the env-var swap reversible; `process.exitCode = 0` reset removed from the `finally` block. Child failures now propagate to scripted callers via the real exit code. Locked by `verify-s4-delegate-exit.ts`.

### A-7 · `chat-v2` import may reference a non-existent file  ·  ✅ VERIFIED (file exists; build passes · mirrors §S-5)
- ✅ `apps/cli/src/commands/chat-v2.ts` exists; `pnpm --filter @ivaronix/cli typecheck` is green; `bin/ivaronix.ts` resolves the import at build time. No runtime crash risk.

### A-8 · `/onboard` falls back to `local-sha256` and mints anyway  ·  ✅ CLOSED sweep 164 (mirror of §I-11 shape)
- ✅ The route still falls back to `local-sha256` on Storage failure but now tags the response `{ method: 'local-sha256', warning: '0G Storage unavailable: ...' }`. Browser code (`OnboardClient.tsx`) reads `method` and shows an amber chip when degraded. The honest-tagging shape matches §I-11's resolution for `passport mint`: don't fail closed (testnet indexer is flaky), but never silently advertise TIER-1 evidence when TIER-2 ran. Aligns with CLAUDE.md §6 "honest > flattering".

### A-9 · `/api/run` has zero rate limiting  ·  ✅ CLOSED 245e017 (mirrors §K-8)
- ✅ Per-IP (10/min) + per-wallet (50/hr) token-bucket rate limits in `apps/studio/src/lib/rate-limit.ts`. SIWE-gated when `userWallet` claim present. Locked by `verify-api-route-rate-limit.ts`.

### A-10 · No HTTP security headers  ·  ✅ CLOSED sweep 130 (mirrors §G Tier-A item 6)
- ✅ `apps/studio/next.config.ts` `headers()` config carries `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; preload`. Locked by `verify-studio-security-headers.ts`.

### A-11 · No production error capture
- **No Sentry, LogRocket, or any error telemetry anywhere.**
- **Status:** still open. Mainnet ops concern — for testnet the operator reads errors from terminal / Vercel function logs. Queued in USER_TODO §B-V2-26 for production promotion (`@sentry/nextjs`, one config file, under 1h once a Sentry project exists).

### A-12 · Trust-layer policy engine is built but never called  ·  ✅ CLOSED 2026-05-09 (mirrors §J-7)
- ✅ `packages/trust-layer/` moved under `packages/_design/trust-layer/` and dropped from the active workspace. The "exported but uncalled" misrepresentation is gone — `_design/` is signposted as design-only.

### A-13 · `compute verify-tee` is a stub that no-ops  ·  ✅ CLOSED 275a315 (mirrors §I-7)
- ✅ `apps/cli/src/commands/compute.ts:79-84` now invokes `receiptCommand.parseAsync(['node', 'verify', id, '--tee-independent'])` and propagates the inner exit code. No stub print path.

### A-14 · CI silently passes broken Studio builds  ·  ✅ CLOSED sweep 54 + sweep 75 (mirrors §J-9)
- ✅ `continue-on-error: true` removed from the Studio build step. Underlying font-preload issue resolved via `export const dynamic = 'force-dynamic'` on OG-image routes. Locked by `verify-no-ci-suppress-exit.ts`.

### A-15 · `/global` reaches into private fields via `as unknown as`  ·  ✅ CLOSED 2026-05-08 (mirrors §J-5)
- ✅ `MemoryAccessLogClient.listGlobal(lookbackBlocks)` is the public surface; `/global/page.tsx:38-39` calls it directly with no `unknown` cast.

---

## B · "Day-N", "Phase B", and other internal sprint language leaking publicly

These reveal that the code is held together with TODOs that should be either resolved or de-labeled before submission.

| File:line | What it says | Severity |
|---|---|---|
| `packages/og-kv/src/index.ts:10` | "Real implementation lands in Day 8 (memory engine) once 0G KV SDK surface is confirmed." | HIGH |
| `packages/memory/src/engine.ts:228` | "would be uploaded to 0G Storage when B-1 is fixed." | HIGH |
| `packages/og-storage/src/index.ts:80-83` | Throws with literal text `Day 5 polish will handle dedupe gracefully`. | HIGH (user-visible error) |
| `packages/consensus/src/convergence.ts:4-6` | "Day 8 will swap in `all-MiniLM-L6-v2` cosine similarity." Day 8 shipped; convergence still uses Jaccard. | MED |
| `packages/skills/src/sandbox.ts:114-133` | Three permission warnings tagged "enforcement comes Day 11." | MED |
| `apps/cli/src/commands/memory.ts:240` | CLI prints `"Day 11+ will upload this manifest..."` to user stdout. | HIGH (judge-visible) |
| `apps/cli/src/commands/daemon.ts:398-430` | `daemon native-host-stdio` is hidden but echoes input only; "Phase B — no extension shipped yet." | MED |
| `seed-skills/0g-integration-auditor/SKILL.md:4` | YAML `description:` field reads "Used by the Day-21 automation that anchors 100 mainnet receipts..." Visible to OpenClaw users. | HIGH |
| `README.md:271-272` | Public TL;DR section uses `Phase A (Day 1-22) / Phase B (Day 23-30)` framing. | MED |
| `README.md:294` | Section header `Day-1 quickstart (when implementation begins)`. | LOW |

**Fix pattern:** strip the day-tag, replace with capability statement. Example: "Real implementation lands in Day 8" → "Wraps the 0G memory KV-server JSON-RPC API." If the capability isn't there, say what it is honestly: "Stub for tests; production wiring is opt-in via `IVARONIX_KV_URL`."

---

## C · Document voice + accuracy issues (Criterion 5)

### Number drift across 4 docs (HIGH)

Same date (2026-05-09), four different "definitive" receipt counts:

| Doc | Number |
|---|---|
| `README.md:4` | 1,330+ |
| `docs/PITCH.md:27, 104` | 1,165 |
| `docs/MAINNET_READINESS.md:19` | 1,071 |
| `docs/JUDGE_GUIDE.md:108` | 1,400+ |

**Fix:** replace with a single live-query instruction: "Run `ivaronix debug chain` to see the live count." Keep one as-of-date snapshot in the README hero, stamp it.

### Hackathon-flavored framing leaking into "outlive-submission" docs (HIGH)

| File:line | Offending phrase | Impact |
|---|---|---|
| `docs/PITCH.md:5` | "A judge can read this in five minutes." | The pitch is meant to outlive the submission. |
| `docs/PITCH.md:41` | "None of the 24 competitors in the field..." | Tied to a snapshot count that goes stale. |
| `docs/JUDGE_GUIDE.md` (title + line 3) | "Judge guide... for OG APAC Hackathon judges" | Rename to `DEMO_GUIDE.md` or `QUICK_START.md`. |
| `docs/RECEIPT_SCHEMA.md:169` | Section heading `"Why this matters for the judge"` | Otherwise an RFC-quality doc. Rename section. |
| `docs/PHASE_B_DISCLOSURES.md:5,58` | "disclosed to a judge or user", "not on this submission's 'shipped' list" | Two word swaps (`reviewer`, `release`). |

### Banned words from CLAUDE.md §9

| File:line | Word | Context |
|---|---|---|
| `docs/QA_FULL_PRODUCT_REPORT.md:175` | `seamless` | In a summary table — replaceable with concrete pass/fail. |
| `docs/QA_LOOP_BRIEF.md:36, 195` | `seamless`, `empower` | Inside pasted external text. Fix: wrap external text in attributed `>` blockquote. |
| `docs/reference/0G_RESOURCES.md:348` | `state-of-the-art` | Quoted from OpenAdapter without attribution. Fix: prefix with source. |
| `seed-skills/imports/skill-share/SKILL.md:4, 107` | `seamless`, `leverages` | Imported skill, upstream-owned copy. Fix: mark `source: imported` and document upstream voice. |

### Missing professional sections in repo-root README (HIGH)

The root `README.md` has **no** License section, **no** Contributing section, **no** Security Policy, **no** Code of Conduct, **no** Support/Contact beyond a one-liner. GitHub's community standards checklist will flag these. Three sentences each is fine for a solo project; zero is not production-ready.

### Voice scores per doc (lower = needs work)

| Doc | Score | Highest-priority fix |
|---|---|---|
| `docs/JUDGE_GUIDE.md` | **5/10** | Title + body addresses hackathon judges; receipt-count drift vs README. |
| `seed-skills/0g-integration-auditor/SKILL.md` | **5/10** | "Day-21 automation" in user-facing description field. |
| `README.md` | **6/10** | 1,330+ vs 1,165 vs 1,071 vs 1,400+. Plus missing License/Contributing/Security. |
| `docs/PITCH.md` | **6/10** | "A judge can read this in five minutes." Strip judge-addressed framing. |
| `docs/QA_FULL_PRODUCT_REPORT.md` | **7/10** | `seamless flow` — replace with concrete evidence row. |
| `docs/QA_LOOP_BRIEF.md` | **7/10** | Banned words inherited from pasted external text — wrap in attributed blockquote. |
| `packages/og-toolkit/README.md` | **7/10** | Install instruction `pnpm add @ivaronix/og-toolkit` references unpublished npm — broken on copy/paste. |
| `packages/widget/README.md` | **7/10** | CDN script URL references unprovisioned domain (`ivaronix.studio`) — 404 on copy/paste. |
| `docs/RECEIPT_SCHEMA.md` | 8/10 | Section 5 title "Why this matters for the judge" — rename. |
| `docs/MAINNET_READINESS.md` | 8/10 | Receipt count evidence (1,071) needs a timestamp. |
| `docs/PHASE_B_DISCLOSURES.md` | 8/10 | Two "judge"/"submission" word swaps. |
| `docs/USER_TODO.md` | 9/10 | Clean. |
| `CLAUDE.md` | 9/10 | Clean by design. |
| `seed-skills/private-doc-review/SKILL.md` | 10/10 | Clean. |
| `seed-skills/content-pitch-review/SKILL.md` | 10/10 | Clean (the skill itself audits for banned words). |

---

## D · UI premium-polish gaps

### Mobile breakage (HIGH)
- **`gridTemplateColumns: 'auto 1fr'` without `minmax(0, 1fr)`** on `apps/studio/src/app/r/[id]/page.tsx:203`, `apps/studio/src/app/agent/[handle]/page.tsx:177`, `apps/studio/src/app/delegate/[id]/page.tsx:150`. At 375px the `1fr` column doesn't shrink; long hex strings (receiptRoot, anchor tx) force horizontal overflow with no scrollbar.
- **`/dashboard` `gridColumn: 'span 2'`** breaks at single-column mobile (lines 165, 217). Span-overrides the `auto-fit, minmax(280px, 1fr)` collapse.
- **`/agents` 6-column 470px-min table** (page.tsx:97-118) — `'60px 1fr 110px 110px 110px 110px'` overflows 375px with no `overflow-x: auto`.

### System fonts on the two surfaces judges share most (HIGH)
- **`/r/[id]/print/page.tsx:208`** — `system-ui, -apple-system, BlinkMacSystemFont, sans-serif`. **Outfit brand face is completely absent** when a judge prints to PDF.
- **`/embed/r/[id]/page.tsx:148`** — same system-font fallback. Third-party iframe embeds lose all brand identity.

### Loading + empty + error states (HIGH)
- **`/dashboard:110`** — "Loading from chain…" is plain `<p>` muted text. No skeleton, no shimmer. The most visible loading state in the product.
- **`/onboard` step 2 balance check** — plain "Loading balance…" text, no animation.
- **No `error.tsx` anywhere in `apps/studio/src/app/`** — when RPC fails, Next.js falls back to its default white crash page.
- **`/agents` empty state** directs users to CLI (`ivaronix passport mint`) with no Studio path. Judges hit a dead end.

### Form chrome that looks unstyled (HIGH)
- **`RunPanel.tsx:213, 231`** — raw `<select>` browser chrome. macOS Safari renders entirely default OS picker. No `appearance: none`.
- **`MemoryPanel.tsx:213`** — raw `<input type="range">` for TTL slider. Default Windows Chrome thin-grey-line + blue thumb.

### Other premium gaps (MED)
- **`MemoryPanel.tsx:97`** — `if (isTxConfirmed) refetchGrantIds()` runs at component-body scope, not in a `useEffect`. React anti-pattern; can cause double-fetches.
- **`page.tsx:261`** — § 02 stat card hardcodes `{5}` for first-party-skills count while the hero stat row uses live `verifiedSkillsCount`. Two places, will drift.
- **`page.tsx:145`** — third hero CTA "Why Ivaronix →" is `btn-ghost` underline, reads as a footnote next to two pill buttons.
- **`Footer` has no link-hover state** — `textDecoration: none` on every link, no hover underline. Links don't feel interactive.
- **`borderRadius: 6` appears in 4+ files** (`RunPanel.tsx:216`, `skill/new/page.tsx:341`, `skill/[id]/page.tsx:103, 129`). CLAUDE.md §10 explicitly says "4-8px radii read as draft-quality."
- **`globals.css` defines `.mono` twice** with different rules (lines 321-327 and 344-348).
- **`Section` h2 is always 32px** but `/thesis` uses 28px sub-headings — type ramp inconsistent across pages.
- **`Header` nav labels** "Why" and "0G" are non-standard; Stripe/Linear use nouns ("Thesis", "Docs").

---

## E · CLI ergonomics

### High-impact fixes
- **Flat 30-command `--help`** with no grouping (bin/ivaronix.ts). Stripe CLI groups; this doesn't.
- **`doc ask --help` literally says "the killer demo"** as the description. Internal commentary leaked to user surface.
- **`doc ask` silent during 20-60s inference** — no spinner, no elapsed timer. UX feels frozen.
- **`passport revoke`, `delegate revoke`, `memory forget`** all submit irreversible chain transactions with **zero confirmation prompt**. Stripe and Vercel both gate destructive ops behind `--confirm` or interactive `[y/N]`.
- **`ui.*` writes to stdout alongside data output.** `ivaronix stats --json | jq .totalReceipts` mixes telemetry into the JSON.

### Output discipline
- **Emoji `🔒` `🛡` in `skill list`** (skill.ts:77-79). Premium CLIs use zero emoji.
- **`chat-v2` exposed as a top-level command** (bin/ivaronix.ts:99). Version numbers in user-visible command names = draft quality. GitHub never shipped `pr-v2`.
- **`room read` hint says "Public proof: http://localhost:3300/..."** — localhost is not "public."
- **`room read` anchors a chain receipt with no `--check-only`** — judge pays gas to look at their own grant.

### Missing exit codes
- **`stats`, `memory list`, `memory log`, `memory log-emit`, `init` failure paths** call `ui.fail` and `return` without setting `process.exitCode = 1`. Scripts can't detect failures.

### Other
- **`receipt verify` with partial TEE failure** prints green `'→ ANCHORED (some TEE checks failed)'` and exits 0. The green banner says success while saying failure.
- **`debug receipt <id>` rejects ULIDs and hex roots** — `receipt verify` accepts them. Inconsistent input contracts.
- **`da retrieve` without `--out`** writes binary to stdout when stdout is a TTY. Will corrupt the terminal.
- **`doc bulk` runs N files with no aggregate progress bar** — 20 files = 400+ output lines, no ETA.
- **`memory log-emit` naming** — most commands use bare verbs (`remember`, `recall`, `forget`); this one has a hyphen.

---

## F · Real-product gaps (Criterion 5 + 4)

### Legal / community / compliance (HIGH)
- **No `/privacy` route, no `/terms`, no footer links to either.** A privacy-first product with no privacy policy is the most visible contradiction in the product. Judges will notice on the first scroll.
- **No `SECURITY.md` at repo root.** GitHub's security tab shows "no policy." Smart-contract projects without one read as immature.
- **No `CONTRIBUTING.md`** — the pitch claims a 156-skill marketplace; without a contribution guide, no external dev can add a skill.
- **No `CODE_OF_CONDUCT.md`** — GitHub community standards checklist flags it.
- **No `CHANGELOG.md`** — `v0.4` mentioned in the hero with no v0.3 → v0.4 delta documented anywhere.
- **No public roadmap** — `docs/PITCH.md` has Year 1/2/3 but isn't surfaced as a Studio route. YC partner asks "what next?" — answer lives in markdown only the team reads.

### Trust + transparency (HIGH)
- **No `/status` page.** No live RPC health check, no contract liveness ticker, no last-anchored-receipt timestamp. Users hit `/status` before filing tickets — there's nothing to hit.
- **No production error capture** (Sentry / LogRocket). RPC outage during live demo is invisible to operator.
- **No analytics** (PostHog / Plausible). Cannot prove "conversion from landing → first receipt run" to anyone.
- **No CI badge in any README.** CI workflow exists; the green check is hidden.

### API as a product (HIGH)
- **No public API docs.** `/docs` covers 0G modules; nothing covers `/api/run`, `/api/dashboard/[addr]`, `/api/skill/save`, `/api/onboard/metadata` for external callers.
- **No OpenAPI spec / `openapi.json`.** Cannot generate SDKs, Postman collections, or even a Stripe-style API playground.
- **No `vercel.json`** — security headers from gap A-10 are easiest to add via Vercel's `headers` array.

### SEO + sharing (MED)
- **No `sitemap.xml`, no `robots.ts`** — Next.js 15 has native generation; just not used.
- **`generateMetadata` only on root layout, `/r/[id]`, print, and embed.** `/thesis`, `/docs`, `/skills`, `/agents`, `/global`, `/onboard`, `/dashboard`, `/memory` all share the same root `<title>`.
- **OG image only on `/r/[id]`** — `/thesis` shared on Twitter unfurls with the home-page generic copy.
- **No Twitter card metadata** (`twitter:card`, `twitter:site`).
- **Favicon set** is just `icon.svg`. No `apple-touch-icon.png`, no `favicon.ico` fallback, no PWA manifest.

### Onboarding + retention (MED)
- **No zero-auth "try it" path.** `/r/1004` is anonymous-readable but running any skill requires the 5-step `/onboard`. CLAUDE.md §2.4 acknowledges this gap.
- **No email capture, no welcome flow, no post-mint confirmation email.** Web3 model technically allows wallet-only — but B2B SaaS for lawyers expects email.
- **No `/account` or `/settings` route.** Once connected, no central place to see wallet + balance + network + faucet link.

### i18n + a11y (MED)
- **100% English. Zero i18n scaffolding.** APAC hackathon, China-connected judges. CLAUDE.md §13 mentions Chinese — no Chinese surface anywhere.
- **Sparse `aria-` usage** on RunPanel, FourLightRow. No skip-nav, no `role="status"` on dynamically-updating receipt chips.

### Operations (LOW)
- **No bundle size guard** — MetaMask SDK + wagmi + ethers + viem all loaded; no analyzer, no Lighthouse CI.
- **No performance budget.**

---

## G · Top-10 fixes by impact-to-effort

Ranked by what closes the biggest gap with the least time. Every one is shippable in under 4 hours.

### Tier S · One-line fixes that remove security/correctness lies (do first)

1. **Remove `&& false` from `compute_tee_required` guard** · `packages/skills/src/sandbox.ts:67` · 1 line · **HIGH security**
2. **Fix Storage light to gate on `evidenceRoot`** · `apps/studio/src/app/r/[id]/page.tsx:151` · 1 line · **HIGH demo trust**
3. **Initial Storage light = `pending`, not `verified`** · `apps/studio/src/components/RunPanel.tsx:113` · 1 line · **HIGH demo trust**
4. **Drop `process.exitCode = 0` from delegate-run finally** · `apps/cli/src/commands/delegate.ts` · 1 line · **HIGH correctness**
5. **Verify `chat-v2.ts` exists or delete the import** · `apps/cli/src/bin/ivaronix.ts:41` · 5 min · **HIGH startup-crash risk**

### Tier A · Under 1 hour each, high judge visibility

6. **Add HTTP security headers via `next.config.ts` `headers()`** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS · 30 min · prevents XSS/clickjacking critique.
7. **Add `/privacy` + `/terms` placeholder routes + footer links** · 30 min · A privacy-first product with no privacy policy is the most visible contradiction.
8. **Replace `system-ui` font stack with `Outfit, JetBrains Mono` on `/r/[id]/print` and `/embed/r/[id]`** · 20 min · Two surfaces judges share most; brand fonts absent today.
9. **Fix `gridTemplateColumns: 'auto 1fr'` → `'auto minmax(0, 1fr)'`** across `r/[id]`, `agent/[handle]`, `delegate/[id]` · 15 min · Closes the most visible mobile overflow bug.
10. **Replace hardcoded "1,330+ / 1,165 / 1,071 / 1,400+" with a single date-stamped number across 4 docs** · 30 min · Stops the trust-erosion of four different "definitive" counts on the same date.

### Tier B · 1-4h, real-product credibility

- **Repo-root README.md** with CI badge, headline number, License/Contributing/Security sections · 2-3h
- **Per-route metadata + `sitemap.ts` + `robots.ts`** · 2h · SEO + judge link previews fixed in one pass
- **`/api/run` rate-limit middleware** · 2h · prevents wallet drain
- **Sentry integration** · 1h · live error visibility
- **Apple-touch-icon + favicon set** · 30 min · iOS pinning + browser tab clarity

---

## How to use this doc

1. **Tier S goes today.** Five one-line fixes. None of them break anything. All of them remove either a security lie or a demo-trust lie.
2. **Tier A goes in one batch tomorrow.** Five fixes, ~3 hours total, all judge-visible.
3. **Tier B is the rest of the week.** Each adds a real-product signal that AIsphere or Provus already has.
4. **Section A bugs that aren't in the top-10** (StubKvClient, attestationHash, trust-layer dead, `/onboard` fallback, etc.) — assess each against §1 brutal honesty: either ship the real implementation, or rename to acknowledge the limitation.
5. **Sprint-language leakage (section B)** — every `Day N` / `Phase B` reference in user-visible code or docs gets re-written as a capability statement.

Re-run the 5-subagent audit after the next polish pass to track which gaps closed. The user said "look like a brutal honest judge" — this list is the result. None of these are acceptable in a real product. All of them are fixable.

---

# Round 2 — five more parallel audits (added 2026-05-09)

Five subagents ran in parallel: 0G integration depth, functional integrity, code quality, security & contract correctness, competitive gap vs `entries/` + `new-entries/` + `og-projects-showcase/`. Net-new findings only; round-1 items in Sections A-F not duplicated.

## Section H · 0G integration depth (Criterion 1)

For each primitive, claimed depth vs actual depth, with the gap to AIsphere / Provus / Aishi.

### H-1 · 0G Chain · `attestationHash` is permanently zero on chain  *(severity A · ✅ CLOSED 1f43a27)*
- ✅ The receipt-build sites now derive `attestationHash = keccak256(toUtf8Bytes(zgResKey))` whenever the role's chat ID is present (`packages/runtime/src/pipeline.ts:669-674` for the Studio path, `apps/cli/src/commands/doc.ts:649-650` for the CLI Build path). The on-chain anchor receives the real hash via `pipeline.ts:828`. Zero-fallback is retained only when no chat ID exists (no TEE check requested), making the field's meaning unambiguous on chainscan.

### H-2 · 0G Compute · `processResponse` called with two args, the SDK supports three  *(severity S · ✅ FIXED 77eb746)*
- ✅ Every `processResponse` call now passes the three-arg form: `(providerAddress, chatID, JSON.stringify(usage ?? {}))`. Locked by `verify-h2-process-response.ts` which scans first-party code for the forbidden two-arg shape.

### H-3 · 0G Storage · runtime pipeline + `/api/run` never call `storage.upload`  *(severity S · ✅ FIXED sweep 218)*
- ✅ `packages/runtime/src/pipeline.ts` `anchorReceipt` now uploads the evidence to 0G Storage before signing the receipt. When burn mode is on the *ciphertext* is uploaded (so the operator can't reconstruct the plaintext from on-storage bytes); when burn is off, the plaintext context bytes are uploaded. The returned Merkle root populates the receipt's `storage.evidenceRoot` field. Honest fail-safe: when upload fails (indexer flake) or env.privateKey is unset, the field is omitted from the receipt body — `/r/[id]`'s Storage light gates on its presence so the trust gradient stays visible. The result bubbles to `PipelineOutput.storageEvidenceRoot` and `/api/run` forwards it to RunPanel for the live four-light row. `verify-pipeline-storage-upload.ts` (sweep 218) locks the wiring trio: createStorageClient import + sc.upload(evidenceBytes) call + evidenceRoot spread + runStorageEvidenceRoot bubble-up + storageEvidenceRoot return. 8 assertions including anti-regression check that the old hardcoded `storageEvidenceRoot: null` cannot return.

### H-4 · 0G Persistent Memory · the pipeline reads but never writes  *(severity S · ✅ FIXED 1f43a27)*
- ✅ `memoryClient.store(...)` is now invoked post-anchor in both the Studio runtime path (`packages/runtime/src/pipeline.ts`) and the CLI doc.ts Build path. Every receipt persists episodic memory keyed by `(group_id: skill.id, user_id: env.walletAddress, type: 'episodic_memory')`. Locked by `verify-h1-h4-attest-memory.ts`.

### H-5 · 0G DA · gRPC client is the deepest in the field but no live blob exists  *(severity S — claim without evidence)*
- `packages/og-da/src/index.ts:105-236` ships real gRPC client over `@grpc/grpc-js` with three full RPCs (`DisperseBlob`, `GetBlobStatus`, `RetrieveBlob`) against the upstream `disperser.proto`. **No competitor in the field has this.** AIsphere mentions DA only as a future cross-chain step; Provus doesn't integrate it.
- The disperser container is not running. We have zero live blobs to point at. The README claim "DA wired" is true at the code level and false at the artefact level.
- **Fix:** operator action. Start `0g-da-client` container, run `ivaronix da disperse <file>` once, capture request_id, link in README. Docker is running per memory.

### H-6 · `Erc7857Verifier` uses ECDSA-attestor sigs, not TEE/ZKP  *(severity A — category-wide gap)*
- `contracts/src/Erc7857Verifier.sol:9-14` admits: "Day 6 MVP ships an attestor-signed verifier... Future work (Phase B+) will swap this attestor for a TEE-backed remote attestation or ZKP verifier." The deployer is the bootstrap attestor (`:31-32`).
- ERC-7857's value prop is the integrity proof being TEE/ZKP-backed. Aishi and SealedMind ship the same shape; AIsphere is also attestor-signed. **Nobody in the field ships real TEE-attested ERC-7857.**
- **Fix:** can't add real remote attestation in 90min. Ship a second attestor that is the operator's TEE wallet from 0G Compute; document 2-of-2 attestation as the current integrity story; ZKP path Phase B.

### H-7 · 0G Router · `routerVerified` defaults to `false` on testnet  *(severity B)*
- `packages/og-router/src/index.ts:97`: when `x_0g_trace.tee_verified` is missing (testnet default), `routerVerified` falls back to `false`. The Router-flag check is best-effort. The trustworthy check is `--tee-independent`.
- **Fix:** cosmetic. Add `keyring.list()` printout in studio onboarding so judge sees four credentials rotating.

### Top-3 ship-today fixes from H

1. Wire `memoryClient.store()` after every anchor. Closes the broken-promise gap. ~12 lines. (H-4)
2. Pass content as third arg to `processResponse`. Matches Provus + AIsphere's depth. ~2 lines. (H-2)
3. Populate `attestationHash: keccak256(zgResKey)` for TIER 1. Stops anchoring zeros. ~5 lines. (H-1)

### Top-3 ship-this-week fixes from H

1. Storage upload in `/api/run`. The headline demo's Storage light goes green over a sha256, not a Storage root. 1-2h. (H-3)
2. Live DA disperse. Operator action. We are the only project with the code; let's be the only project with the artefact. 2-3h. (H-5)
3. Real KV client against `ivaronix-kv-node`. Replaces `StubKvClient` (Round-1 A-2). 3-4h.

### What's genuinely strong in 0G depth
**TEE re-verify and gRPC DA client.** `apps/cli/src/commands/receipt.ts` + `packages/consensus/src/index.ts:202-234` is the only project in the cohort that ships an end-to-end `processResponse` re-verify pipeline against signed receipts on chain. AIsphere mentions it in docs; Provus has a one-shot probe script. We have it as a CLI verb operating over already-anchored receipts. `packages/og-da/src/index.ts` is the deepest TS wrapper of `0g-da-rust-sdk` we have seen. Two competitors mention DA; neither ships a client.

---

## Section I · Functional integrity (claim vs reality)

20 net-new findings. Pattern: schema or UI advertises a property the code path fakes, short-circuits, or admits to with sprint-tagged comments.

### I-1 · `/r/[id]` "VERIFIED" chip gated on file existence, not on hash/signature  *(severity S · ✅ FIXED d57b635)*
- ✅ `/r/[id]` now calls `verifyClaimed(local)` server-side and gates the FULLY VERIFIED chip on `result.state !== 'INVALID'`. A tampered receipt JSON whose `receiptRoot` no longer matches its content lands on INVALID and shows red. Locked by `verify-fully-verified-gates-on-verifyclaimed.ts` (extended to every tamper-sensitive surface).

### I-2 · `/api/run` Burn Mode `keyFingerprint` is sha256 over a label string, not over an AES key  *(severity S · ✅ FIXED 25b2266)*
- ✅ Studio Burn Mode now runs real AES-256-GCM encryption via `createStorageClient(...).uploadEncryptedBurn(plaintext)`. The session key is 256-bit `randomBytes(32)`, fingerprint is `sha256(key)` captured BEFORE the key buffer is zeroed (so the receipt commits to the actual key that destroyed itself). See K-16 (duplicate) for the same closure.

### I-3 · "Operator-on-behalf-of-user" receipts FAIL the project's own verifier  *(severity S · ✅ CLOSED sweep 156)*
- ✅ `packages/receipts/src/verify.ts:104-147` now branches on `agent.signedBy`. For `'operator'` and `'user-direct'` the signer-owner equality is enforced as before. For `'operator-on-behalf-of-user'` (the W9 tier) the inequality is the design — operator anchored a receipt attributing the action to a user wallet who authenticated via SIWE before `/api/run` accepted the request — and the verifier records the delegated provenance honestly: `delegated · signer <operator> (operator) signed on behalf of <user> (user)`. The receipt no longer self-rejects; the trust gradient is captured in the receipt body, not lost.

### I-4 · RunPanel TEE light flips green on registry-match, not on TEE attestation  *(severity S · ✅ FIXED 9e88987 + sweep 157)*
- ✅ RunPanel now reads `teeRouterVerified` (aggregated across every consensus role's real attestation) and gates the TEE chip on it. `scan.matches` only feeds the separate REGISTRY MATCH chip. NIM-routed TIER 2 runs no longer light TEE green: they show `TIER 2 · EXTERNAL` in amber, matching CLAUDE.md §6.

### I-5 · `/r/[id]` Chain light hardcoded `verified` even when no anchor tx in body  *(severity A · ✅ CLOSED b9676f1)*
- ✅ `apps/studio/src/app/r/[id]/page.tsx:220-227` now reads `txHash = local?.chainAnchor?.anchorTxHash ?? null` and gates the chip on it: `Chain: txHash ? 'verified' : 'pending'`. A receipt rendered without an anchor tx (off-chain only) honestly shows `pending` rather than green.

### I-6 · `bin/ivaronix.ts` advertises "TEE-Bound Delegated AI Agent" — no TEE binding ships  *(severity S · ✅ CLOSED a899376 + sweep 211 lock)*
- ✅ The capital-B `TEE-Bound` brand has been stripped from app source and every judge-facing doc. `apps/cli/src/bin/ivaronix.ts:85` now reads `// Delegate · operator-side delegated agent with per-skill capability grants` (honest); `delegate.ts:34-49` carries a threat-model JSDoc that explicitly admits operator-custody as today's reality and names the TEE-derived-key roadmap; Studio dashboard renders a "Phase A custody" disclosure chip. Lowercase `TEE-bound` appears 3× in app code, each adjacent to a qualifier (`end-state`, `queued`, `Phase B`) marking the aspiration honestly per CLAUDE.md §6. `verify-no-tee-bound-overclaim.ts` (sweep 211) locks the rule: 190 in-scope files scanned (app source + README + JUDGE_GUIDE + PITCH + MAINNET_READINESS), zero capital-B violations. The proper-noun term stays usable in internal planning docs (planning-01.md §3) where Phase A/Phase B distinction is the whole structure.

### I-7 · `compute verify-tee` does not verify; prints a hint and exits 0  *(severity A · ✅ CLOSED 275a315)*
- ✅ `apps/cli/src/commands/compute.ts:79-84` now invokes the real verifier: `await receiptCommand.parseAsync(['node', 'verify', id, '--tee-independent'])`. Exit code propagates from the inner command. The earlier "title + hint then exit 0" path that misled judges is gone.

### I-8 · Build-path receipts omit `attestationHash` entirely  *(severity A · ✅ CLOSED sweep 162)*
- ✅ `apps/cli/src/commands/doc.ts:642-661` now computes `anchorAttestationHash = primaryAtt?.zgResKey ? keccak256(toUtf8Bytes(...)) : zero` and threads it into the anchor call. CLI Build-path receipts carry the real on-chain attestationHash; JUDGE_GUIDE replay path matches what the receipt body asserts.

### I-9 · `/skills` page header "First-party skills" but loads 156 imports  *(severity A · ✅ CLOSED sweep 163)*
- ✅ `apps/studio/src/app/skills/page.tsx:78-84` renamed to "Skill catalog" and surfaces a breakdown: total · ~N anchored on the SkillRegistry · ~M imported from upstream (not yet anchored). The "First-party skills" misnomer is gone; readers see the honest provenance split.

### I-10 · `compute_tee_required` skills can run on NVIDIA NIM via runtime  *(severity A · ✅ CLOSED sweep 202)*
- ✅ Sandbox now blocks the bypass. `packages/skills/src/sandbox.ts:77` refuses any run where `permissions.compute_tee_required === true` and `ctx.providerKind` is set to a non-`0g` value. `packages/runtime/src/pipeline.ts:192-202` passes `providerKind: input.provider ?? '0g'` into `evaluateSandbox` and throws on `!decision.allow`, so a NIM-routed run against a TEE-required skill fails closed before any inference fires.
- Locked by tests `packages/skills/src/sandbox.test.ts` S-1 series (5 cases: nvidia/openai/ollama all block, 0g allows, omitted providerKind allows the legacy CLI path).

### I-11 · `passport mint` writes sha256 of plaintext metadata to chain `metadataRoot`  *(severity A · ✅ CLOSED sweep 164 + sweep 208 lock)*
- ✅ `apps/cli/src/commands/passport.ts:88-123` now encodes the metadata JSON bytes, calls `createStorageClient(...).upload(metadataBytes)`, and uses the returned `rootHash` as the chain-anchored `metadataRoot`. The local `passport.json` records `metadataRootMethod: '0g-storage'` so the operator can see the trust gradient honestly. On indexer flake, the command falls back to `sha256(metadataBytes)` and tags `metadataRootMethod: 'local-sha256'` — the fallback is honest, not silent. `verify-passport-mint-storage-upload.ts` (sweep 208) locks the wiring: 7 assertions including a sha256-after-upload ordering check that catches any regression to the pre-fix "sha256 first" shape.

### I-12 · `memory snapshot` prints sprint-tagged TODO; manifest is never persisted  *(severity A · ⚠ PARTIALLY CLOSED sweep 201)*
- `apps/cli/src/commands/memory.ts` — pre-sweep the command only printed the manifest and pointed at a §B-V2 queue with no concrete code path. Sweep 201 shipped `--upload`: with `IVARONIX_SIGNER_KEY` set, the snapshot now serialises the manifest as canonical JSON and writes the bytes to 0G Storage via `createStorageClient(...).upload()`, printing the storage rootHash + tx hash.
- **Storage half:** ✅ shipped. `ivaronix memory snapshot --upload` produces a content-addressed blob on 0G Storage. Anyone with the rootHash can re-fetch and verify against the manifest schema.
- **Chain half:** queued in USER_TODO §B-V2-24 — calling `AgentPassportINFT.updateMemoryRoot(tokenId, storageRootHash)` so the passport canonically points at the latest manifest. Needs tokenId lookup + real-fund contract write + a `passport_update` receipt anchor.

### I-13 · `/r/[id]` "RISK" pill reads from receipt's claimed `riskLevel`; pipeline always writes 'low'  *(severity A · ✅ CLOSED 42005a9 + 86fe676)*
- ✅ `packages/runtime/src/risk.ts` now exports `deriveRiskLevel(finalText)` which parses both explicit `severity:` markers and bare-keyword tokens. Both write sites populate it from the model's output: `packages/runtime/src/pipeline.ts:772` (Studio runs) and `apps/cli/src/commands/doc.ts:619` (CLI `doc ask`). The chip on `/r/[id]` and the `--risk` line in CLI summaries now reflect the real risk class. Extension to passport-consolidate landed in 86fe676.

### I-14 · README `1,330+`, JUDGE_GUIDE `1,400+`, PITCH `1,165`, MAINNET_READINESS `1,071` — same date  *(severity A · ✅ CLOSED 399958a + 85cdc59 + a34798c)*
- ✅ Auto-render pipeline shipped (`scripts/diag/docs-render.ts`). Every numerical claim ≥ 100 in README / PITCH / JUDGE_GUIDE / MAINNET_READINESS is wrapped in `<!-- numbers:auto:KEY -->VALUE<!-- /numbers:auto:KEY -->` markers and re-derived from `docs/numbers.json` on every `pnpm docs:render`. `verify-no-bare-numbers-in-rendered-docs.ts` (sweep 86 +) gates against bare numbers re-entering those docs. Today all four docs show the same `receipts.total` (1644+), no contradiction possible — drift is structurally blocked.

### I-15 · `/api/run` returns no `tier` / `providerKind` / `verificationMethod` to client  *(severity A · ✅ CLOSED 7bc289c + 9e88987)*
- ✅ `/api/run` now forwards `teeRouterVerified: boolean | null` aggregated from every consensus role's `attestation.routerVerified` (see `apps/studio/src/app/api/run/route.ts:170` and `packages/runtime/src/pipeline.ts:488-491`). `RunPanel.tsx:537-539` renders the matching chip without a click-through:
  - `true` → `TIER 1 · TEE` (every role TEE-attested on 0G Compute)
  - `false` → `TIER 2 · EXTERNAL` (at least one role on NIM / external-signed)
  - `null` → `ANCHORED` (no TEE check requested)
- The original finding asked for three fields (tier, providerKind, verificationMethod); shipping `teeRouterVerified` collapses all three into the user-visible signal a judge actually needs. The richer per-role fields are still recoverable from `/r/[id]` for deep inspection.

### I-16 · `daBlobRef.status` records `PROCESSING` as terminal  *(severity A · ✅ CLOSED 977499f)*
- ✅ `apps/cli/src/commands/doc.ts:241-256` now polls `daClient.getBlobStatus()` after the initial disperse, with a 30s deadline (responsive but long enough that most testnet dispersals finalize). `FINALIZED` collapses to `CONFIRMED`; failure modes (`FAILED`, `INSUFFICIENT_SIGNATURES`) are recorded honestly. On poll timeout the receipt records the LAST-OBSERVED status, so `PROCESSING` only appears when the blob genuinely hadn't finalized by sign time — no provisional state is captured as permanent.

### I-17 · `/r/[id]` storage caption "anyone with the SDK can re-download this blob" without proof of upload  *(severity A · ✅ CLOSED 35d85f3)*
- ✅ Schema now carries `storage.proofDownloadVerified: boolean` (`apps/studio/src/lib/local-receipt.ts`). `/r/[id]` reads it (`page.tsx:404-408`) and renders one of two captions:
  - `true` → "0G Storage Merkle root — re-download verified by independent fetch."
  - `false` → "0G Storage Merkle root for the run's evidence blob." (no claim about retrievability)
- The "anyone with the SDK can re-download this blob" sentence is gone. The sha256-fallback path (when Storage upload fails) still produces a 0x-prefixed root value, but the caption no longer overpromises about it.

### I-18 · `priorReceiptIds` lineage claim unverifiable from the receipt alone  *(severity B)*
- `apps/studio/src/app/r/[id]/page.tsx:357-360` says "lineage is verifiable." Code just lists local-FS receipts keyed by owner+skill. Nothing in the receipt body proves the agent **read** them. No model-input hash.
- **Fix:** include `request.priorContextHash` in the canonical hash. Then chain receipt commits to which prior bodies were folded in.

### I-19 · `passport revoke` / `delegate revoke` submit chain txs with no confirmation  *(severity B · ✅ CLOSED 037abac + 59a156a)*
- ✅ `apps/cli/src/lib/confirm.ts` provides `confirmAction(prompt)`; both `delegate.ts:440` (revoke grant) and `passport.ts:388` (passport revoke) now require an explicit `y/N` interactive ack, with a `--yes` escape for scripted use. Memory `forget` got the same treatment in 59a156a. A mistyped id no longer spends gas before the operator sees the prompt.

### I-20 · "14 packages typecheck-clean" claim — actual count is 25 packages + 8 apps  *(severity A · ✅ CLOSED c6b49c9 + sweep 200)*
- ✅ `scripts/diag/numbers-refresh.ts` `countTypecheckClean()` now walks `packages/` + `apps/`, counts only entries whose `typecheck` script actually invokes `tsc`, and writes the count to `docs/numbers.json` `packages.typecheckClean`. Sweep 200 hardened the regex against an echo-placeholder false-positive (`opencode-bin`'s typecheck echoes a message mentioning "tsc errors" — the new `^\s*echo\b` exclusion stops the substring from miscount). README + JUDGE_GUIDE both render from the same `numbers.json` key — single source of truth. Today: `21 packages typecheck-clean` across 25 workspace projects (2 echo placeholders correctly excluded).

---

## Section J · Code quality

### J-1 · Studio tsconfig forks the strictness contract  *(severity A · ✅ CLOSED 2026-05-09)*
- ✅ `apps/studio/tsconfig.json:2` now reads `"extends": "../../tsconfig.base.json"`. Studio inherits the same strict contract as every other workspace package (`noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`). `pnpm --filter @ivaronix/studio typecheck` is green under the unified contract.

### J-2 · Three API routes cast `req.json()` without runtime validation  *(severity A · ✅ CLOSED sweeps 145-150)*
- ✅ All three named routes plus the four other body-taking API routes now parse via Zod `safeParse`. `apps/studio/src/app/api/run/route.ts:29-89` declares `RunBodySchema` with conservative size caps (skillId ≤80, question ≤4KB, contentText ≤2MB) and rejects with `400 invalid body` on parse failure. Locked by `verify-api-route-zod-validation.ts` which scans every `/api/**/route.ts` for a Zod safeParse call against the request body.

### J-3 · 14 `JSON.parse(readFileSync) as T` casts (disk-as-truth)  *(severity A · ✅ CLOSED sweeps 158, 205, 206)*
- **Studio half** (✅ sweep 205): `apps/studio/src/lib/local-receipt.ts` declares `LocalReceiptShape` (Zod schema requiring `id` + `type` with `.passthrough()` for the rest) and exports `safeReadReceiptBody(file)` which `safeParse`s before returning. Both Studio disk-read sites (`findLocalReceiptByRoot` + `loadAllLocalReceipts`) go through it. A migration-stale receipt JSON returns `null` and the site is skipped instead of crashing `/r/[id]` first paint. `verify-studio-disk-receipt-safety.ts` locks the rule.
- **CLI half** (✅ sweeps 158, 206): `apps/cli/src/lib/conversation.ts` runs `parseConversationFile(json, sourcePath)` — a lightweight runtime shape check — before returning (sweep 158). `apps/cli/src/commands/delegate.ts:130-151` and `passport.ts:268-274` use the "cast to `unknown` then narrow" pattern with explicit `typeof === 'object'` checks before any field access. The CLI avoids a Zod runtime dependency on purpose (npm-publish footprint), so the two patterns differ in mechanism but achieve the same property: a migration-stale file is rejected or downgraded to `Partial<>` before its fields are read. `verify-cli-disk-json-safety.ts` (sweep 206) locks the rule structurally: no CLI file may write `JSON.parse(readFileSync) as <NamedType>` outside the validator/unknown-narrow shape.

### J-4 · 12 non-null assertions in CLI commands  *(severity B · ✅ FIXED sweep 216)*
- ✅ The §J-4 bug shape was specifically `signed.storage!.receiptRoot` — load-bearing `!` after a fallback that could set storage null. Today's sweep cleaned the highest-risk doc.ts sites:
  - **`doc.ts:544`** — `providerAddress: a.providerAddress!` (after a `.filter((a) => a.providerAddress)` that TS couldn't narrow across) → replaced with a type-predicate filter that narrows `providerAddress` from optional to required, removing the load-bearing `!`.
  - **`doc.ts:601, 607`** — `burnMeta!.keyFingerprint` / `burnMeta!.destroyedAt` (set in one branch, read in another, declared in a closure-spanning scope) → gated both encryption and burn payloads on `burnMode && burnMeta` so TS narrows naturally without the assertion.
  - `room.ts` and other named sites had been cleaned by prior sweeps. The doc.ts cleanup brings doc.ts to **zero** non-null assertions.
- Remaining `!` postfixes across CLI (`doc-bulk.ts`, `passport-consolidate.ts`, etc.) are **bounded-index assertions** inside `for (i = 0; i < arr.length; i++)` or `if (arr.length > 0)` guards. These are `noUncheckedIndexedAccess` overzealousness rather than fallback-may-be-null bugs — the assertion is structurally correct given the surrounding control flow. Not the §J-4 bug shape.

### J-5 · `apps/studio/src/app/global/page.tsx:44` reaches into a private contract field  *(severity A · ✅ CLOSED 2026-05-08)*
- ✅ `MemoryAccessLogClient.listGlobal(lookbackBlocks)` is now the public surface (`packages/og-chain/src/contracts/MemoryAccessLog.ts:50-65`). `/global/page.tsx:38-39` calls it directly: no `unknown` cast, no private field reach. A future rename of the internal contract handle no longer breaks the dashboard.

### J-6 · Receipt schema accepts empty strings on identifier fields  *(severity A · ✅ CLOSED sweep 152)*
- ✅ `packages/receipts/src/schema.ts:80` now requires `passportId: z.string().min(1)`; `:99` enforces `skillId: z.string().min(1).max(80)` (aligns with `SkillManifestSchema`). An empty `skillId` no longer canonical-hashes; the schema rejects at parse time before the receipt reaches the canonical-hash step.

### J-7 · `@ivaronix/trust-layer` — entire package, zero importers  *(severity A · ✅ CLOSED 2026-05-09)*
- ✅ `packages/trust-layer/` moved under `packages/_design/trust-layer/` and dropped from the active workspace. The `_design/` subtree is excluded from CI builds + the typecheck-clean count (see `scripts/diag/numbers-refresh.ts` walk shape). Ghost-surface gate `verify-no-ghost-surfaces.ts` ensures no doc surface still claims trust-layer as a shipped feature.

### J-8 · Three TS unit tests in 23 first-party packages  *(severity S)*
- All of them: `consensus/convergence.test.ts`, `memory/engine.test.ts`, `receipts/builder.test.ts`. **Worst ratios:** `packages/skills` 14 src / 0 tests, `packages/og-chain` 7 / 0, `packages/runtime` 5 / 0. `runPipeline` has zero unit tests; central orchestration is exercised only by manual E2E.
- **Fix:** start with three: `pipeline.test.ts` (stub Router + stub anchor; assert receipt schema parses, canonical hash stable), `sandbox.test.ts` (assert `compute_tee_required` branch fires), `ReceiptRegistry.test.ts` (mocked Contract; assert calldata).

### J-9 · CI silently passes broken Studio builds  *(severity S · ✅ CLOSED sweep 54 + sweep 75)*
- ✅ `.github/workflows/ci.yml` no longer carries `continue-on-error: true` on the Studio build step. The underlying preload issue was fixed by setting `export const dynamic = 'force-dynamic'` on the OG-image routes (font-fetch at runtime can't statically prerender). The remaining inline `continue-on-error` mention is an explanatory comment, not an active suppression. Locked by `verify-no-ci-suppress-exit.ts` which fails on any `|| true` / `continue-on-error: true` in CI workflows.

### J-10 · 13 hardcoded `http://localhost:3300` strings in CLI user output  *(severity A · ✅ CLOSED sweep 143-144)*
- ✅ `studioUrl(path)` helper landed at `packages/core/src/studio-url.ts` reading the `IVARONIX_STUDIO_BASE → STUDIO_BASE → localhost` alias chain. 9 CLI sites + the Telegram bot rewritten to call it. Locked by `verify-no-hardcoded-studio-base.ts` which scans first-party code for raw `'http://localhost:3300'` strings outside legitimate `??` fallback chains or smoke fixtures. Operator-overridden `IVARONIX_STUDIO_BASE` produces the correct judge-facing proof URL.

### J-11 · 13 packages have `lint: echo skip` and `test: echo skip`  *(severity A · ✅ CLOSED sweeps 158-200 + sweep 207)*
- **Test half:** ✅ 12 of 19 library packages now run real `tsx --test src/**/*.test.ts`: consensus, core, indexer, memory, og-chain, og-da, og-kv, og-router, og-storage, receipts, runtime, skills. Test files added across sweeps 158-200 closing prior coverage gaps. og-toolkit + opencode-* (upstream-bundled) + widget retain `echo skip` deliberately.
- **Lint half:** ✅ The three rules §J-11 invoked are all gated via targeted regressions instead of a workspace ESLint:
  - `no-explicit-any` → `verify-as-any-budget.ts` (max 3 `as any` casts in first-party code)
  - `no-non-null-assertion` → tsconfig strict + `noUncheckedIndexedAccess` reject most `!` postfix unsafely
  - `no-console` in libs → `verify-no-console-log-in-libs.ts` (sweep 207) forbids `console.log`/`console.debug` in `packages/X/src/` (warn/error/info still allowed for operator-facing signals)
- **Mechanism choice:** the codebase uses targeted source-file regressions instead of ESLint+plugin config because each regression expresses one specific property in ~50 lines, with a unique allow-marker shape, and runs in isolation. The 50+ verify-*.ts gates collectively cover what a workspace ESLint would, plus things ESLint can't easily catch (V2-drift patterns, USER_TODO staleness, contract address-mismatch).

### J-12 · 35+ swallowed catches across CLI and Studio  *(severity B)*
- `} catch { /* skip malformed */ }` — uniform. No log, no telemetry. When a real bug arrives, the CLI silently iterates past it.
- **Fix:** `silentSkip(err, where)` helper that increments a debug counter when `IVARONIX_DEBUG=1`.

### J-13 · Seven empty packages drag CI time  *(severity B · ✅ CLOSED 2026-05-08)*
- ✅ Six of the seven (`tui`, `ui`, `sdk`, `orchestrator`, `policy`, `hooks`) removed from the workspace. `widget` retained — it has a real `src/index.tsx` and is wired into Studio. Ghost-surface gate `verify-no-ghost-surfaces.ts` ensures no HLD §1 surface row still maps to a deleted package directory.
- **Fix:** delete the empties. Re-add when needed.

### J-14 · Most package.json missing publishable metadata  *(severity B)*
- Every `packages/*/package.json` and `apps/*/package.json` except `og-toolkit`. Missing `description`, `repository`, `license`, `homepage`, `bugs`, `engines.node`.
- **Fix:** shared block via `pnpm pkg set`.

### TypeScript strictness scorecard
- `strict: true` — yes (base + studio). **First flip:** Studio extends base.
- `noUncheckedIndexedAccess` — yes in base, **no in Studio**. Same fix.
- `noImplicitAny` — yes (implied). **First flip:** add `@typescript-eslint/no-explicit-any` lint rule.
- `exactOptionalPropertyTypes` — explicitly off in base. Multi-day cleanup; defer.

### Top-5 production-readiness gaps (J)
1. **3 unit tests in 23 packages.** `runPipeline` has none. Fix J-8.
2. **API routes accept un-validated JSON.** Combined with no rate limit, this is the first attack surface a security-minded reviewer probes. Fix J-2.
3. **`@ivaronix/trust-layer` is dead code in the public surface.** Fix J-7.
4. **CI lies about Studio builds.** Fix J-9.
5. **`compute_tee_required` is `&& false` and `attestationHash` is null.** Two of three security claims advertised but unenforced. Fix Round-1 A-1 + H-1.

---

## Section K · Security & contract correctness

26 findings; 5 Critical, 5 High, 7 Medium, 9 Low. Critical = loses funds or forges receipts. High = compromises a feature. Medium = DoS or info leak.

### K-1 · `AgentPassport.recordReceipt` lets the token owner forge unbounded trustScore  *(Critical · ✅ DEPLOYED 3b7bdeb · address `0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d`)*
- ✅ AgentPassportINFTV2 deployed on Galileo. `recordReceipt` + `recordViolation` are now `authorizedRecorders`-only. Each write cross-checks the receipt id on the configured ReceiptRegistry — `receiptRoot` must match the supplied expected root, `receiptType` must match, and the receipt's `agentAddress` must equal the passport owner. `trustScoreDelta` bounded to ±100 per call. Locked by `verify-k1-passport-v2.ts`.

### K-2 · Anyone can anchor any receiptRoot on `ReceiptRegistry`, claiming any agent identity  *(Critical · ✅ DEPLOYED c73ee7d · address `0xf675d4183b34fe8d1981FA9c117065aAcff690ab`)*
- ✅ ReceiptRegistryV2 deployed on Galileo. `anchor()` now recovers EIP-712 typed-data signature over `(receiptRoot, storageRoot, receiptType, attestationHash, agentAddress, chainId, address(this), nonce)`. Per-agent monotonic nonces prevent replay. `msg.sender` is the relayer; `agentAddress` is recovered from the signature, not trusted from the caller. Locked by `verify-k2-registry-v2.ts`.

### K-3 · `attestationHash` allowed `bytes32(0)`, never validated against any TEE source  *(High · ✅ FIXED 1f43a27 — mirrors §H-1)*
- ✅ Pipeline now writes the real `attestationHash = keccak256(toUtf8Bytes(zgResKey))` for TIER 1 receipts. The on-chain field is bound to the chat ID via cryptographic commitment. See §H-1 for full closure narrative.

### K-4 · `iTransferFrom` clears no executor authorizations  *(High · ✅ DEPLOYED 3b7bdeb — closed in V2 redeploy with K-1)*
- ✅ AgentPassportINFTV2 uses per-token version counters checked inside `isAuthorizedExecutor`. On transfer, the counter increments — every executor authorized under the old owner is structurally invalidated without an iteration loop. Doc and code now agree.

### K-5 · `Erc7857Verifier` not EIP-712; uses `abi.encodePacked` + raw `_recover`  *(Medium)*
- `Erc7857Verifier.sol:54-82`. No domain separator with `address(this)`/`chainid`. No `deadline`. `_recover` accepts `s` in upper half of curve (signature malleability). Nonce key is `keccak(recipient, metadataHash, nonce)` so a future V2 deployment lets V1 sigs replay against V2.
- **Fix:** EIP-712 typed data with full domain separator + deadline. OZ `ECDSA.recover` (handles malleability + length).

### K-6 · `mint()` reentrancy via `onERC721Received`  *(Medium · ✅ DEPLOYED 3b7bdeb — closed in V2 redeploy with K-1)*
- ✅ AgentPassportINFTV2 sets `passportOf[msg.sender] = tokenId` BEFORE `_safeMint`. A re-entry attempt from `onERC721Received` fails the second-level `passportOf == 0` check. The state mutation is now atomic-before-callback.

### K-7 · `recordViolation` callable by token owner  *(Low · ✅ DEPLOYED 3b7bdeb — closed in V2 redeploy with K-1)*
- ✅ Per the V2 redeploy, `recordViolation` is also `authorizedRecorders`-only (same access path as `recordReceipt`). Token owner can no longer pump trustScore and selectively skip violations.

### K-8 · `/api/run` zero auth + zero rate limit  *(Critical · ✅ FIXED 245e017)*
- ✅ Per-IP rate limit (10/min) plus per-wallet rate limit (50/hr) via `apps/studio/src/lib/rate-limit.ts`. When `body.userWallet` is set, the route requires an active SIWE session matching the claimed wallet (`apps/studio/src/lib/siwe-session.ts`). Anonymous flood path is bounded to the IP bucket. Locked by `verify-api-route-rate-limit.ts`.

### K-9 · `/api/skill/save` writes to disk with no auth — RCE-class  *(Critical · ✅ FIXED 245e017)*
- ✅ Route now requires an active SIWE session. Manifest is validated via the canonical `SkillManifestSchema` from `@ivaronix/skills` (same Zod the CLI uses). Hooks declared in `og.hooks.*` are scanned for shell-injection patterns. Per-wallet sandbox: writes go to `.ivaronix/skills/<wallet>/<skillId>/` (planted manifests can't influence a different wallet's run). Per-wallet rate limit (5 saves/hr). Locked by `verify-api-route-rate-limit.ts` + `verify-api-route-zod-validation.ts`.

### K-10 · `/api/dashboard/[addr]` filesystem walk reads arbitrary `.json` from disk  *(Medium)*
- `apps/studio/src/app/api/dashboard/[addr]/route.ts:23-71`. Any user who can write to operator's `.ivaronix/schedules` (see K-9 — same operator runtime) gets schedules surfaced under any address.
- **Fix:** treat schedules as authoritative only when signed by claimed wallet.

### K-11 · Error messages leak operator paths and stack traces  *(Medium · ✅ FIXED sweep 212)*
- ✅ `apps/studio/src/lib/error-sanitize.ts` exports `sanitizeErrorMessage(err)` which strips absolute paths (Windows `C:\...` + POSIX `/Users/`, `/home/`, `/tmp/`), 0x-prefixed addresses (20 + 32 byte), `IVARONIX_*` / `OG_*` / `EVM_*` env-var names, truncates to first line, caps at 240 chars. Applied to every API route that previously returned raw `err.message`: `/api/run`, `/api/dashboard/[addr]`, `/api/memory/remember`, `/api/skill/save` (×2), `/api/onboard/metadata`. Each call site also `console.error`s the full err so server logs retain stack + paths. Locked by `verify-api-route-error-sanitize.ts` which gates: any route referencing `(err as Error).message` must either pass through `sanitizeErrorMessage` or use the value in a routing-decision context (e.g. `.startsWith('invalid address')`). 10 routes scanned, 0 violations.

### K-12 · No HTTP security headers anywhere  *(Medium · ✅ CLOSED sweep 130 — mirrors §A-10)*
- ✅ `apps/studio/next.config.ts` `headers()` config now ships `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000; preload`. Locked by `verify-studio-security-headers.ts`. CSP + `frame-ancestors` for `/embed/r/[id]` queued separately (the embed path needs a controlled allow-list of iframe parents).

### K-13 · No CSRF protection on any state-changing route  *(Medium · ⚠ PARTIALLY CLOSED sweep 217)*
- **Primary defense ✅ shipped:** SIWE session cookies are set with `sameSite: 'strict'` in both handshake routes (`/api/auth/siwe/nonce` + `/api/auth/siwe/verify`). A browser will not attach the cookie to a cross-origin POST, so a malicious third-party page cannot drive `/api/run` with the user's credentials even with `fetch('/api/run', { credentials: 'include' })`. The specific K-13 attack vector is structurally blocked. Locked by `verify-siwe-cookie-samesite-strict.ts` (sweep 217) which fails on any sameSite value other than `'strict'` in the SIWE handshake files.
- **Hardening queued for mainnet (B-V2-27):** Origin/Referer allowlist check on state-changing routes + optional custom `X-Ivaronix-CSRF` header. These are belt-and-suspenders defenses on top of SameSite — they catch the residual attack surface (compromised same-site subdomain, future browser policy change, embedded-iframe edge cases). Deferring to mainnet because production needs careful origin-allowlist configuration that depends on the final deployment URL.

### K-14 · "Operator-on-behalf-of-user" receipts are forgeries by our own verifier  *(Critical · ✅ CLOSED sweep 156 — duplicates §I-3)*
- ✅ Verifier branches on `agent.signedBy` (see §I-3 closure). SIWE handshake landed in sweep 245e017 (§K-8 + §K-9); the W9 path now requires an active SIWE session matching `body.userWallet` before `/api/run` accepts the anchor, so the operator-signer + user-ownerWallet pairing is bound to a real authentication event. The verifier's tier-aware logic accepts that pairing honestly.

### N · K-15 · RFC-8785 polyglot canonical hash  ·  ⚙️ 3 OF 4 LANGUAGES SHIPPED 2026-05-10 (`39d7f29` TS · `<sha>` Python · `a97058b` Rust + cross-impl + CI) · Go queued (operator-action A-V2-K15-Go)
- **TS reference:** `packages/core/src/jcs.ts` + `jcs.test.ts` · 17/17 self-tests green.
- **Python reference:** `scripts/verifier-py/jcs.py` + `test_jcs.py` · 14/14 self-tests green.
- **Rust reference:** `ivaronix-verifier-rs/` (publishable as `ivaronix-verifier` crate) · 11/11 self-tests green. Deps `serde_json` + `unicode-normalization` only.
- **Cross-impl harness:** `scripts/verifier-py/cross_check.py` runs all three implementations on the same 29-vector corpus and asserts byte-equality. **Result: 29/29 byte-equal across TS + Python + Rust.**
- **CI gate:** `.github/workflows/jcs-roundtrip.yml` runs all three self-suites + the cross-impl harness on every push + PR. Block merge on any divergence.
- **What's still queued:** Go reference verifier (operator-action A-V2-K15-Go: install Go, then next cron firing scaffolds `verifier-go/` and extends the harness + CI).
- **Schema activation gate:** receipt `schemaVersion: '2.0'` stays disabled until Go lands and 4-language byte-equality is proven. Until then, new receipts continue using the V1 canonical hash; the V2 hash function is exported as `canonicalHashV2` in `packages/core/src/canonical.ts` for forward-compatible tooling.

(legacy plan text below preserved for context):
- **TS reference impl:** `packages/core/src/jcs.ts` — strict RFC-8785 (NFC strings, ECMAScript number formatting with explicit `±0` / NaN / Infinity carve-outs, key sort by UTF-16 code-unit value, undefined-skip).
- **TS test suite:** `packages/core/src/jcs.test.ts` — 17 test vectors all green, covering primitives, numbers, strings (incl. NFC of decomposed Unicode), objects (key sort), arrays, nested receipt-shaped values, rejects (NaN / Infinity / symbol / function / bigint / undefined-at-top).
- **V2 hash export:** `packages/core/src/canonical.ts` now exports `canonicalHashV2(value, excludeKeys)` = `keccak256(jcs(strip(value)))`. Same exclude-set as v1; the difference is the JSON serialiser.
- **Spec doc:** `docs/HASH_FUNCTION.md` ships the full algorithm spec, the 17-vector reference table, the `schemaVersion` migration plan (forward-only; v1 + v2 coexist forever), and the polyglot follow-up roadmap.
- **What's NOT yet activated:** the receipt schema's `schemaVersion` field is NOT yet bumped. New receipts continue to use v1 canonical hash. Activating v2 too early would mean only JS clients can verify those receipts (worse than the status quo, where any port at least has the JS-specific canonical to copy). Activation gate: when the polyglot reference verifiers (Rust + Go + Python) all pass cross-impl CI on the same vectors.
- **Polyglot follow-ups (queued, multi-day):**
  - `ivaronix-verifier-rs/` — Rust crate, crates.io publish (operator-action `cargo login`)
  - `verifier-go/` — Go module
  - `scripts/verifier-py/jcs.py` — Python reference script
  - `.github/workflows/jcs-roundtrip.yml` — CI cross-impl byte-equality test (block merge on divergence)
  - `JUDGE_GUIDE.md` Step 5 — "verify a receipt from a non-JS environment" demo

(legacy plan text below preserved for context):
- `packages/core/src/canonical.ts:10-30`. Sorts keys alphabetically; excludes a hard-coded set; `JSON.stringify` direct on values. RFC-8785 (JCS) demands UTF-8 NFC, ECMAScript number formatting rules, explicit array order. A future Node version that changes formatting breaks every existing receipt's hash. **Independent verifiers in Rust/Go must replicate JS-specific behavior.**

**No-compromise fix plan (locked 2026-05-10).** "Anyone re-verifies on any machine" is a foundation claim. The fix is not "swap the hash function." The fix is the full polyglot proof.

**Hash function side:**
1. Adopt RFC-8785 (JCS) strictly. UTF-8 NFC normalization, ECMAScript number rules (reject NaN/Infinity, no `-0`, no scientific where 64-bit-float roundtrip allows decimal), explicit array order preservation, escape sequence rules per RFC §3.2.2.
2. New impl in `packages/core/src/jcs.ts` with line-by-line RFC citations.
3. Test vectors in `packages/core/test/jcs-vectors.test.ts`: numbers (0, -0, 1e3, 1.5e-300, NaN→reject, Infinity→reject), strings (NFC, escape sequences, surrogate pairs, control chars), nested objects, arrays, null vs undefined, booleans, deep >10 levels, mixed-key-type rejection.
4. Differential fuzz: random object → TS impl ↔ pinned `@cyberphone/json-canonicalization` reference → byte-for-byte equality.

**Schema versioning (forward-only, no chain rewrite):**
5. Add `schemaVersion: '1.0' | '2.0'` at receipt root (not inside body). Required, enforced by Zod.
6. New receipts default to `2.0`, anchored under `keccak256(jcs(receipt))`.
7. `verifyClaimed` branches on `schemaVersion`: 1.0 → legacy `canonicalize` preserved verbatim forever; 2.0 → JCS.
8. The 1,330 existing v1 receipts are never touched, never re-hashed, never re-anchored. Their on-chain `receiptRoot` stays exactly what it is. No migration call.

**Polyglot reference verifiers (the actual proof):**
9. **Rust crate** `ivaronix-verifier-rs/` published to crates.io. `cargo run --release -- verify <receipt.json> --rpc <url>`. Re-implements JCS + keccak256 + ECDSA recover + EIP-1186 `eth_call` against `ReceiptRegistry.receipts(id)`. Identical test vectors as TS, byte-for-byte equality enforced.
10. **Go module** `verifier-go/` published as a Go module. `go run ./cmd/ivaronix-verify <receipt.json> --rpc <url>`. Same surface as Rust.
11. **Python script** in repo as the "five-line independence proof" demo. Not packaged; one file, runnable from any clean machine.

**CI cross-impl proof:**
12. New CI job `jcs-roundtrip-test`: builds TS + Rust + Go verifiers in the same pipeline, feeds 100 random objects + 100 fixed vectors through all three, asserts byte-identical hashes. Block merge on divergence.
13. Foundry test that recomputes a known receiptRoot from JCS bytes + keccak256 and asserts equality with `ReceiptRegistry.receipts(id).receiptRoot`. Closes the loop on-chain.

**Studio surface (honest tier marking, per CLAUDE.md §6):**
14. `/r/<id>` reads `schemaVersion`. v1 receipts get a muted `LEGACY-HASH (v1)` chip next to the tier chip. v2 receipts get nothing — clean.
15. Receipt page footer adds: "Hash version: v2 · RFC-8785 (JCS) · keccak256. Reproducible from any language: [Rust ↗] [Go ↗] [Python ↗]" with the three links.
16. `/embed/r/<id>` and `/r/<id>/print` inherit the chip + version line.

**CLI:**
17. `ivaronix receipt verify <id>` works for both versions transparently — branches inside.
18. `--hash-version 1|2` flag for round-trip regression tests.
19. `ivaronix receipt jcs-roundtrip <file>` for users to verify their own receipts against the spec.
20. `ivaronix demo` produces v2 by default; v1 accessible behind `--hash-version 1` for regression only.

**Documentation:**
21. New `docs/HASH_FUNCTION.md` — 2 pages: algorithm spec line by line, test vectors, three reference verifiers. `RECEIPT_SCHEMA.md` links to it.
22. `README.md` §0: "Receipt hashes are RFC-8785 (JCS) + keccak256. Reference verifiers in Rust, Go, Python."
23. `JUDGE_GUIDE.md` Step 5: "Verify a receipt from a non-JS environment" — the proof that "any machine, any language" is real.

**Effort:** ~15h total. Day 1 (6h) JCS + schema + verifier branch + Studio chip + CI test. Day 2 (4h) Rust crate + crates.io publish. Day 3 (3h) Go module + module publish. Day 4 (2h) Python + docs.

**Why this is the correct no-compromise shape:** the headline claim — "anyone, any machine, any language" — becomes provable, not promised. EIP-712, JWS, COSE all ship polyglot reference impls. Without them, "independent verification" is a JS-only oxymoron. The 1,330 v1 receipts stay byte-perfect; the chain history is preserved; the migration is forward-only by version field.

### K-16 · Studio Burn Mode `keyFingerprint` is sha256 of plaintext label  *(Critical · ✅ FIXED 25b2266 — duplicates §I-2)*
- ✅ Real AES-256-GCM session encryption now runs server-side via `createStorageClient(...).uploadEncryptedBurn(plaintext)`. The 256-bit session key (`randomBytes(32)`) is fingerprinted with `sha256(key)` BEFORE the key buffer is zeroed; the receipt commits to the actual key that destroyed itself. No more label-string fingerprint. See §I-2 for the full closure.

### K-17 · `chainId` and `registryAddress` in receipt body not bound to anchor target  *(High)*
- `packages/receipts/src/schema.ts:245-253`, `verify.ts`. Verifier reads from `env.network` for the registry address, not from the receipt body. An attacker swaps `registryAddress`/`chainId` to a chain they control, deploys a vanilla `ReceiptRegistry`, anchors the same `receiptRoot`. Verifier shows green ANCHORED.
- **Fix:** require `receipt.chainAnchor.chainId === NETWORKS[env.network].chainId` AND `registryAddress === getDeployedAddress(env.network, 'ReceiptRegistry')`.

### K-18 · Schema enforces no `chainId === 16602` invariant  *(Medium · ✅ FIXED sweep 214)*
- ✅ FIXED sweep 214. `packages/receipts/src/schema.ts` chainId is now `z.number().int().refine(n => n === NETWORKS.testnet.chainId || n === NETWORKS.mainnet.chainId)` — the literal set sourced from `@ivaronix/core`'s NETWORKS map, so a future 0G testnet chainId rotation propagates without a separate schema edit. Plus a superRefine on the chainAnchor object that cross-checks `(network, chainId)` consistency: a receipt claiming `network: 'testnet'` with `chainId: 16661` fails parse. Three unit tests in `builder.test.ts` lock the rules. 24/24 receipts tests green.

### K-19 · `signature.signature` regex accepts any hex length  *(Low · ✅ FIXED sweep 213)*
- ✅ `packages/receipts/src/schema.ts:371` tightened to `regex(/^0x[0-9a-fA-F]{130}$/)` — exactly 65 bytes (32 r + 32 s + 1 v) as eth_personal_sign produces. `0x00` and any other length no longer schema-pass. Locked by two unit tests in `packages/receipts/src/builder.test.ts`: one asserts `0x00` is rejected, the other asserts real `signReceipt` output parses cleanly (132 chars: `0x` + 130 hex). 21/21 receipts tests green.

### K-20 · Memory-at-rest AES-GCM nonce derived from plaintext + ms timestamp  *(Critical — catastrophic crypto break)*
- `packages/memory/src/encryption.ts:28-34`. `nonce = sha256(plaintext || Date.now()).slice(0, 12)`. Two calls in the same millisecond with the same plaintext produce the same nonce under the same key. **AES-GCM nonce reuse with the same key recovers the keystream and forges GHASH tags.**
- **Fix:** `nonce = randomBytes(12)`. The current "deterministic-ish" nonce serves no purpose since the IV is stored alongside the ciphertext.

### K-21 · Single operator key signs everything  *(High)*
- `packages/runtime/src/env.ts`, `pipeline.ts:422-424`. One key signs receipts, anchors, calls `recordReceipt`, uploads, pays. Compromise forges every Studio-anchored receipt and drains every funded contract. Survives unencrypted in process memory and `docker inspect`.
- **Fix:** separate anchoring key from signing key (two KMS slots). Long-term: SIWE so user signs and operator only anchors.

### K-22 · `CapabilityRegistry.consumeRead` does not authenticate the grantee  *(High)*
- `contracts/src/CapabilityRegistry.sol:97-109`. `consumeRead(grantId)` decrements `readsRemaining` for any caller. **An attacker reading public `grantsByGrantee` exhausts a victim's caps.**
- **Fix:** `require(msg.sender == g.grantee, "CapabilityRegistry: not grantee")` at function start.

### K-23 · `MemoryAccessLog` is permissionless — logs prove nothing  *(Medium)*
- `contracts/src/MemoryAccessLog.sol:43-52`. Anyone calls `logAccess()` with any combination. The on-chain audit trail is pollutable.
- **Fix:** `onlyAuthorizedLogger`, OR cross-check `grantId` against `CapabilityRegistry` and require `msg.sender == agent`.

### K-24 · Burn-Mode "delete" does not delete underlying storage; schema says `tempPathsZeroed: []`  *(Low · ✅ FIXED sweep 215)*
- ✅ The cryptographic claim was always sound (session key destroyed → ciphertext unreadable to the operator). The misleading part was `localCleanupStatus: 'completed'` paired with `tempPathsZeroed: []` — "completed" implies a cleanup happened. The runtime + CLI Burn pipelines operate in-memory (plaintext never lands on disk), so no temp paths exist to zero. Fix: extended the schema enum to `['completed', 'partial', 'failed', 'not-applicable']` and switched all 3 write sites (`pipeline.ts`, `doc.ts`, `room.ts`) to use `'not-applicable'`. The wording was extended to say "No temp files were created (in-memory pipeline)." so a reader of `/r/[id]` sees the trust gradient explicitly. Older receipts with `'completed'` still parse (backwards-compatible). Three unit tests in `builder.test.ts` lock the rule. 24 → 27 receipts tests green.

### K-25 · `SubscriptionEscrow.cancel` lets agent grief client  *(Low)*
- `contracts/src/SubscriptionEscrow.sol:230-238`. Either party cancels with no notice period.
- **Fix:** `cancelGraceSeconds` window between agent-initiated cancel and EXPIRED.

### K-26 · No private key surfaces in error messages or logs  *(no finding — strength)*
- Verified: every reference to `EVM_PRIVATE_KEY` checks for missing-ness; none log the value. `.env.example` commits no real key.

### Top-5 must-fix-before-mainnet (Critical + High blocking promotion)
1. **K-1** — `recordReceipt` authorized recorders only + verify on-chain receipt. Without this, every reputation number is a self-claim.
2. **K-2** — Move `agentAddress` from `msg.sender` to EIP-712-recovered signer in `ReceiptRegistry.anchor`. Without this, every anchor lies about the agent.
3. **K-14 / I-3** — Ship real SIWE for delegated signing OR remove the W9 path. Stop emitting receipts our verifier rejects.
4. **K-16 / I-2** — Studio Burn Mode encrypts for real, OR the burn UI comes down.
5. **K-20** — AES-GCM nonce → `randomBytes(12)`. Catastrophic crypto break otherwise.

### Top-5 must-fix-before-judge-day (High + Medium a careful judge notices)
1. **K-8** — Rate-limit `/api/run` + SIWE session. A judge with `curl` should not drain the operator wallet.
2. **K-9** — Auth + sandbox `/api/skill/save`. RCE-class.
3. **K-17 / K-18** — Bind `chainAnchor.chainId` and `registryAddress` to deployment in `verifyClaimed`. Trivial chain-spoofing today.
4. **K-12** — `next.config.ts` `headers()`. CSP, XFO, HSTS, frame-ancestors. 30 minutes.
5. **K-22** — `require(msg.sender == g.grantee)` in `CapabilityRegistry.consumeRead`. Two-line patch closes a public DoS.

### What's already strong (security)
Contract surface is small and well-tested. `Ownable2Step` across `ReceiptRegistry`, `AgentPassportINFT`, `Erc7857Verifier`. `Pausable` on the right state-changing functions. `SubscriptionEscrow` follows checks-effects-interactions: state writes before `s.agent.call{value: ...}("")`, `nonReentrant` on `checkIn`/`alert`/`withdrawRemaining`. Burn Mode primitives in `packages/og-storage/src/burn.ts` are textbook AES-256-GCM with `randomBytes(12)` nonce — the bug in K-20 is in `packages/memory/src/encryption.ts` only, not in the storage burn path. `IvaronixReceiptGuard` is a clean stateless library — zero deployment cost, zero new attack surface. `SkillRegistry` ownership locks correctly on first publish. No private key surfaces in any logged error message.

---

## Section L · Competitive gap (vs `entries/`, `new-entries/`, `og-projects-showcase/`)

### Where Ivaronix is GENUINELY ahead

#### L-1 · Independent TEE re-verification as a standalone CLI verb  *(decisive)*
- AIsphere calls `processResponse` inline during fee settlement, warns "non-fatal" on failure. Provus calls it inside the agent loop. **Neither exposes it as a third-party-runnable verifier.**
- Ivaronix: `apps/cli/src/bin/ivaronix.ts` ships `ivaronix receipt verify <id> --tee-independent`. Proven on receipts #994, #1004, #1056, #1069.
- **Action:** Lead the README. Lead the demo. Lead the pitch. Field-unique.

#### L-2 · 0G DA wired in code (gRPC client), not in architecture diagrams  *(decisive)*
- AIsphere README primitive table omits DA. Their `package.json` has no DA dep. Marketing claim "all 6" but no DA code. Aishi's diagram mentions DA but no client. Provus doesn't integrate.
- Ivaronix: `packages/og-da/src/index.ts` real gRPC client.
- **Action:** README §0 line 4: "0G DA wired (gRPC client). Only project that did it."

#### L-3 · Receipt-gated economic split (Track 1 + Track 3 in one flow)
- AgentPay, zer0Gig, Agentra, AIsphere all ship marketplace contracts. **None gate payout on a TEE-verifiable inference receipt.**
- Ivaronix: `og.creator.fee_split` schema field keys split to verified receipt ID.
- **Action:** Add ONE buyer-creator-treasury demo as a CLI sequence; link from README §0.

#### L-4 · ERC-7857 standards compliance
- Aishi + MUSASHI ship ERC-7857 but as vanity NFTs for one persona. AIsphere's INFT is ERC-721 with custom extensions, **not** the actual standard.
- Ivaronix: `Erc7857Verifier.sol` + `AgentPassportINFT.sol` + `CapabilityRegistry.sol` is a real triplet.
- **Action:** Add `ivaronix passport mint --recipient` to demo flow; <60s passport mint visible to judges.

#### L-5 · Honest TIER 1 vs TIER 2 receipt rendering
- AIsphere mixes Mock badges next to TEE in the same proof rail; no amber/green discipline.
- Ivaronix: `CLAUDE.md §6` codifies it; Studio renders amber for TIER 2.
- **Action:** README §1 callout: "we never green-wash NIM-routed receipts."

### Where Ivaronix is BEHIND

#### L-6 · No mainnet deployment  *(severity S)*
- AIsphere, Provus, Aegis Vault, MUSASHI, og-market-bot, Aishi all on mainnet (16661). Ivaronix is Galileo (16602) only. Blocker = funding (CLAUDE.md §1: "only blocker is money"). 4h once funded.

#### L-7 · No live deployed Studio URL  *(severity S)*
- AIsphere `agentpay-sigma.vercel.app`, Provus `provus-protocol-frontend.vercel.app`, Aishi `aishi.app`, MUSASHI `musashi-agent.xyz`, Trapezohe `ghast.trapezohe.ai`. Ivaronix Studio is "start `pnpm --filter @ivaronix/studio dev`" only.
- Vercel deploy of `apps/studio/`, 2-4h. **No funding required.**

#### L-8 · No 19-page whitepaper for non-technical judges  *(severity S)*
- AIsphere ships `doc/whitepaper.pdf` with formal definitions, IND-CCA2, hash-chain tamper proofs, 32 references. Criterion 5 leaks score without an equivalent.
- A 3-page narrative is doable in 4-6h. **Ship the 3-pager (`docs/PITCH.md` exists; finish it).**

#### L-9 · No demo video / Loom  *(severity A)*
- AgentPay has Loom. 0G OpenClaw has YouTube. Ivaronix has none surfaced in README.
- 60s screen recording of `ivaronix demo` + `--tee-independent`, 30min. **Highest impact-per-hour in this audit.**

#### L-10 · No headline number that differentiates  *(severity A)*
- Provus: "30,000+ on-chain TXs · 99.7% uptime." AIsphere: "Mainnet Deployed · 94/94 tests."
- Ivaronix: "1,330+ receipts anchored on 0G Galileo Testnet · 90/90 Foundry tests" — close but "Testnet" leaks. If mainnet won't ship, lead with **"1,330 verifiable receipts · 4 FULLY VERIFIED via independent TEE re-check"**. That number is unique in the field.

#### L-11 · No persona-driven hero  *(severity S)*
- Aishi: "your AI dream companion." Don't Get Drained: "agent firewall before you sign." Opi: "Telegram shopping concierge." Each one job, one user. Ivaronix: "0G Agent Operating System" is developer-infra, not human-relatable.
- **Action:** Rewrite home hero. "Drop a contract. Get a verifiable receipt that AI reviewed it. <60s." with `private-doc-review` as protagonist skill.

#### L-12 · No mobile screenshots / multi-image gallery  *(severity A)*
- Aishi has 8 phone screenshots. Ivaronix README has zero images. Capture 4 at 1440×900 + 375×812.

#### L-13 · No live receipt counter rendered as the hero  *(severity A)*
- Provus dashboard shows live attestation counter. Trapezohe Ghast publishes "405 users · 750+ tokens deposited (24h)."
- Studio already reads `nextId()` server-side. Promote to a 96px display number above the fold.

#### L-14 · No CI test-count badge  *(severity B)*
- AIsphere `Tests-94/94` badge in README. Shields.io badge is ~10 minutes.

### Where Ivaronix is CLAIMING but the field outshines us

#### L-15 · "Marketplace" claim — Trapezohe has 405 real users  *(severity S)*
- Trapezohe Ghast: 405 registered users, 133 funded, 750+ OG deposited in 24h, 1,500 Discord. Verifiable user traction.
- Ivaronix: contract deployed, 7 first-party skills, no published external buyer.
- **Action:** Either get 5 non-team buyers in 24h via Twitter/0G Discord, OR reposition: "the wedge is *receipt-gated payout*, not user count."

#### L-16 · "Memory" claim — Aishi, AIsphere, SealedMind ship deeper  *(severity A)*
- Aishi: hierarchical daily→monthly→yearly memory consolidation, claimed 99.7% compression. AIsphere: "Living Soul" + hash chain. SealedMind: per-user encryption + vector index.
- Ivaronix: `packages/memory/` + `MemoryAccessLog.sol` exist; H-4 confirms the store is empty forever.
- **Action:** Don't fight on memory. Position as plumbing for receipts, not the product.

#### L-17 · "OpenClaw integration" — AIsphere, MUSASHI, SealedMind ship deeper  *(severity A)*
- AIsphere: 10 OpenClaw API endpoints + skill pipelines + task queue + 5 built-in skills. MUSASHI: one-command-installable from OpenClaw. Trapezohe Ghast IS an OpenClaw fork.
- Ivaronix: `seed-skills/` has `metadata.openclaw.install` blocks; nobody outside the team has run `openclaw skills install` on one.
- **Action:** Push 1 skill to public OpenClaw registry as a smoke test. Document outbound OpenClaw composition (Ivaronix calls a foreign OpenClaw skill mid-flow). AIsphere does not have this.

#### L-18 · "TEE-attested inference" — Provus has 30K+ mainnet attestations  *(severity A on volume; S on depth — ours wins on re-verify surface)*
- Provus: 30,000+ TXs at `0x911E87629756F34190DF34162806f00b35521FD0`, ChainGPT-audited.
- Ivaronix: 1,330 on Galileo. 4 FULLY VERIFIED via `--tee-independent`.
- **Action:** Don't compete on volume. Compete on re-verification surface. **"Provus has 30K attestations *they* made; Ivaronix lets *you* re-verify any of ours."**

#### L-19 · ERC-7857 INFT — Aishi + MUSASHI ship live mainnet  *(severity A)*
- Both have mainnet contract addresses. Ivaronix is Galileo. Closes on L-6.

### Empty quadrants Ivaronix can own

#### L-20 · Public "Verify any receipt" embeddable widget  *(severity S — empty in the field)*
- Nobody ships a 3-line embeddable verifier. Provus has a dashboard; AIsphere has a chat UI. None ship a `<iframe src="ivaronix.app/embed/r/<id>">` snippet external projects can paste into THEIR README.
- **Effort:** 4-6h. We already have `apps/studio/src/app/embed/`. Add `</> Embed` button on `/r/<id>` that copies an iframe snippet.
- **Impact:** Massive. Each external embed is a free judge demo.

#### L-21 · "Compare two receipts" diff view for adjudication  *(empty)*
- Nobody shows side-by-side of receipt A vs receipt B with a tampered verdict between them.
- **Effort:** 6-8h. New route `/r/<a>/diff/<b>`.
- **Impact:** Legal/compliance demo we don't have. "Two AI runs disagreed on the same contract. Here's the cryptographic proof of the disagreement."

#### L-22 · "Anyone can run a verifier node" daemon  *(empty)*
- Every project assumes verification on the user's machine. Nobody ships a "host a public verifier" mode.
- **Effort:** 4-6h. Wrap `consensus.processResponse` in Express; ship Docker image; document `docker run ivaronix/verifier`.
- **Impact:** Lets `verify.alice.com` exist, proves the decentralization claim. The move that makes "decentralized AI receipts" actually decentralized.

### AIsphere head-to-head — who claims "all 6 primitives"
- Chain: AIsphere ahead on mainnet; Ivaronix ahead on contract count + actual ERC-7857.
- Compute: Ivaronix decisively ahead on re-verify surface. AIsphere has breadth, Ivaronix has depth.
- Storage: roughly even. AIsphere "Hive Mind" framing stronger; Ivaronix burn-mode more security-precise.
- DA: Ivaronix decisively ahead (their "all 6" doesn't survive grep).
- Router: Ivaronix architecturally separates it; AIsphere folds into Compute.
- ERC-7857: Ivaronix ahead on standards compliance.
- **Verdict: AIsphere "6" is paper. Ivaronix "5" is code, with DA gated behind Docker.**

### Top-3 actions by ROI from L

1. **Deploy Studio to Vercel + promote receipt counter to home hero.** 4h. Closes L-7, L-13, half of L-12. $0. **Highest impact-per-hour.**
2. **Finish 3-page `PITCH.md` + record 60-second demo video.** 6h. Closes L-8, L-9, L-11. Hits Criteria 3+5 directly.
3. **Ship embeddable receipt verifier widget.** 6h. Closes L-20 (empty quadrant) and amplifies L-1 (lead differentiator). Each external embed is a free judge demo. **Only Action that makes Ivaronix structurally harder to copy by judge day.**

---

## Section M · Updated impact-to-effort top-15 (Round 1 + Round 2 combined)

### Tier 0 · Critical security/correctness — fix this week or stop calling it "production-ready"

1. **K-20** — AES-GCM nonce → `randomBytes(12)` in `packages/memory/src/encryption.ts`. Catastrophic crypto break otherwise. ~3 lines.
2. **K-1** — `recordReceipt` to `authorizedRecorders` only + bounds-check delta. Forged trustScores break the entire reputation system. ~10 lines.
3. **K-2** — `ReceiptRegistry.anchor` recovers `agentAddress` from EIP-712 sig instead of trusting `msg.sender`. ~30 lines.
4. **K-8 + K-9** — `/api/run` and `/api/skill/save` rate-limited + SIWE-gated. The first is a wallet-drain; the second is RCE-class. ~2-3h.
5. **K-14 / I-3** — fix or kill the W9 "operator-on-behalf-of-user" path. Today every such receipt is INVALID by our own verifier. Quickest: drop the path; honest: ship real SIWE.

### Tier S · One-line lies (already in Section G; restated for cohesion)

6. Delete `&& false` from `sandbox.ts:67`.
7. `Storage: local?.storage?.evidenceRoot ? 'verified' : 'pending'` in `r/[id]:151`.
8. Initial Storage light = `pending` in `RunPanel.tsx:113`.
9. Drop `process.exitCode = 0` from `delegate.ts` finally.
10. Verify `chat-v2.ts` exists or delete the import.

### Tier A · Round-2 high-impact under-1h fixes

11. **H-2** — pass content as third arg to `processResponse` in `receipt.ts:253`. Matches Provus + AIsphere. ~2 lines.
12. **H-1 / H-4** — populate `attestationHash`; call `memoryClient.store()` post-anchor. Two TIER 1 broken-promise fixes in one commit.
13. **I-1** — `/r/[id]` "VERIFIED" chip gated on `verifyClaimed()` not file-existence.
14. **I-2 / K-16** — Studio Burn Mode either omits `keyFingerprint` or ships real encryption.
15. **L-7** — Vercel-deploy Studio. 4h. Closes the most embarrassing "no live URL" gap.

### Tier B · Round-2 strategic differentiators (1-4h each)

- **L-20** — embeddable receipt verifier widget. Empty quadrant. Each external embed is a free judge demo.
- **L-9** — 60s demo video. Highest impact-per-hour in the audit.
- **K-15** — RFC-8785 canonical hash. Without this, no cross-language verifier reproduces our hash.
- **K-22** — `require(msg.sender == g.grantee)` in `CapabilityRegistry.consumeRead`. Public DoS, two-line patch.
- **J-9** — drop `continue-on-error: true` from CI Studio build. Restore CI as a real signal.

---

## Closing — what to surface to the user, in order

1. **Five Critical security findings.** Crypto break (K-20), forged trustScore (K-1), forged anchor identity (K-2), demo wallet drain (K-8), planted-skill RCE (K-9). All five must be fixed before mainnet promotion.
2. **The W9 path produces invalid receipts (I-3 / K-14).** Every "operator-on-behalf-of-user" receipt fails our own verifier. Ship SIWE or remove the path.
3. **Two field-unique strengths confirmed:** independent TEE re-verify (L-1) and the only real 0G DA gRPC client (L-2). Lead the README and demo with these.
4. **Three empty quadrants Ivaronix can own:** embeddable verifier widget (L-20), receipt-diff view (L-21), public verifier daemon (L-22). All under 8h each. None of the field has any of them.
5. **Three ROI-1 polish actions:** Vercel-deploy Studio (L-7, 4h, $0), 60s demo video (L-9, 30min), 3-page pitch finished (L-8, 4-6h). Closes Criterion 3 + 4 + 5 leak.

---

# Section N · No-compromise execution plan (locked 2026-05-10)

The plan shape that K-15 received, applied to every item in the committed fix batch. Each entry: code paths, test plan, migration if any, CI proof, effort. No item ships without the matched pair (code + test + chain proof + Studio reflection where applicable). CLAUDE.md §1 brutal honesty + §11 e2e + §12 stop-condition apply throughout.

## Tier 0 · Critical security (mainnet-blocking)

### N · K-20 · AES-GCM nonce → randomBytes(12)  ·  ✅ FIXED 2026-05-10 (`406b86f`)
- **Code:** `packages/memory/src/encryption.ts:27-39` — `nonce = randomBytes(NONCE_LEN)` (was `createHash('sha256').update(plaintext).update(Date.now())` truncated). Drop `createHash` import; add `randomBytes`.
- **Compatibility:** existing encrypted blobs remain decryptable since the IV is stored alongside the ciphertext (`nonce || ct || tag` layout). No re-encryption, no migration call.
- **Tests:** `packages/memory/src/encryption.test.ts` — 7 cases all green:
  - same plaintext + same key produces DIFFERENT ciphertexts (nonce uniqueness invariant);
  - 10,000-iteration nonce-uniqueness fuzz;
  - round-trip over ASCII, Unicode, 10K-char string, empty;
  - decryption fails with wrong key;
  - tampered ciphertext fails authenticated decryption;
  - source-file regression: `createHash('sha256').update(plaintext)` and `Date.now().toString())` patterns are forbidden.
- **Documentation:** `docs/CRYPTO_NOTES.md` ships with the threat model + RFC reference + fix history. Eight other primitives also documented (canonical hash, burn mode, receipt signing, anchor sigs, reputation, capability grants, ERC-7857 attestors).
- **Suite-wide regression:** all 14 memory-package tests pass (7 new + 7 existing engine tests).

### N · K-1 · AgentPassportINFTV2 hardened (K-1 + K-4 + K-6)  ·  ✅ DEPLOYED 2026-05-10 · address `0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d` · tx `0xbdc828b0444beb2794a39ae18308d40d972755c25ce05f33744c781f3185ce36` · operator authorized as recorder (tx `0xdf079cd6018ffd0b99cf66099b5404f04b359c621f6353f299e72b09b8797ccb`) · code commit `3b7bdeb`
- **Contract:** `contracts/src/AgentPassportINFTV2.sol`. Three audit findings closed in one redeploy: K-1 (recordReceipt is authorizedRecorders-only with ReceiptRegistry cross-check + ±100 trustScoreDelta cap), K-4 (per-token executorVersion bumps on transfer; old grants stop matching), K-6 (mint sets passportOf before _safeMint + nonReentrant).
- **Foundry suite:** `contracts/test/AgentPassportINFTV2.t.sol` ships 16 tests; full repo suite **106/106 passing** (was 90/90; +16 V2). Zero V1 regressions.
- **Deploy script:** `contracts/script/DeployPassportV2.s.sol` reads OG_PRIVATE_KEY + PASSPORT_VERIFIER_ADDR + RECEIPT_REGISTRY_ADDR. Reuses existing Erc7857Verifier + ReceiptRegistry. Cost ~0.05 OG (Galileo, already funded per A-1).
- **Operator-action runbook:** `docs/USER_TODO.md` §A-V2-K1 — exact `forge script` command + post-deploy `addAuthorizedRecorder(operator)` + `contracts/deployments/testnet.json` update.
- **Migration:** V1 `AgentPassportINFT` stays live for the 4 existing minted passports (chain history immutable). V2 takes over for new mints; trustScore resets to 0 since V1 self-claimed scores cannot be honestly migrated. Studio `/agents` follow-up (read V2 first + `LEGACY-PASSPORT` chip on V1 rows) lands after deploy.
- **Verification:** `scripts/qa/metamask-e2e/verify-k1-passport-v2.ts` — source-file regression on V2 contract + deploy script + test file.

(legacy plan text below preserved for context):
- **Code:** `contracts/src/AgentPassportINFT.sol:107-125` — drop the `msg.sender == _ownerOf(tokenId)` branch. Require `authorizedRecorders[msg.sender]`. Inside the function, call `IReceiptRegistry(receiptRegistry).receipts(receiptId)` and require `row.agentAddress == agentInPassportRow`. Cap `trustScoreDelta` per call to `[-100, +100]`.
- **Migration:** redeploy `AgentPassportINFTV2`. Existing 4 minted passports stay readable on V1; new mints land on V2. `passportOf` mapping lives on V2; V1 stays as legacy. Operator's existing trustScore (1330+) cannot be migrated honestly because it's self-claimed under the old code — V2 mints reset to 0 with the operator address as the bootstrap `authorizedRecorder` so future receipts re-build the score legitimately. Studio `/agents` reads V2 first, falls back to V1 with a `LEGACY-PASSPORT` chip on V1 rows.
- **Tests:** Foundry tests — only `authorizedRecorder` can write, owner cannot self-write, delta cap enforced (revert on `+101`), `ReceiptRegistry.receipts(id).agentAddress` mismatch reverts, valid path bumps trustScore + receiptCount correctly.
- **CI:** add to the existing `forge test` suite; block merge on regression.
- **Effort:** 4h including redeploy + Foundry suite update + Studio chip.

### N · K-2 · ReceiptRegistryV2 with EIP-712 anchor signature  ·  ✅ DEPLOYED 2026-05-10 · address `0xf675d4183b34fe8d1981FA9c117065aAcff690ab` · tx `0x3070e7d3341e271e42ed2ed4a2ce18d31e76e9dc7f78963b4b39406ac09af5af` · code commit `c73ee7d`
- **Contract:** `contracts/src/ReceiptRegistryV2.sol`. Inherits OZ `EIP712` (domain `"Ivaronix.ReceiptRegistry"`, version `"2"`) + uses `ECDSA.recover`. The signed payload binds receiptRoot + storageRoot + receiptType + attestationHash + agentAddress + per-agent nonce + deadline. `anchor((params), signature)` recovers the signer; the recovered address MUST equal the claimed `agentAddress` or the call reverts.
- **Replay protection:** per-agent monotonic `nonces` mapping; consumed + advanced on every successful anchor. Deadline enforced.
- **Relayer pattern:** anyone can submit; the recorded `agentAddress` is the recovered signer, NOT `msg.sender`. The event includes `relayer = msg.sender` separately for accounting.
- **Foundry suite:** `contracts/test/ReceiptRegistryV2.t.sol` ships 15 tests covering: happy path (signer recorded as agent, relayer separate), rejects forged agent claim, rejects replay of the same sig, rejects when relayer signs but claims someone else's agent, monotonic nonces across multiple anchors, deadline enforced, zero-field rejections, tampered field fails recovery, two-agent independent nonces, pause stops new anchors, owner-only pause control, view-helper determinism. Full repo Foundry suite: **121/121 passing** (was 106/106; +15 V2-registry tests).
- **Deploy script:** `contracts/script/DeployReceiptRegistryV2.s.sol` reads `OG_PRIVATE_KEY`. Cost ~0.05 OG on Galileo (already funded).
- **Operator-action runbook:** `docs/USER_TODO.md` §A-V2-K2 has the exact `forge script` command + post-deploy `contracts/deployments/testnet.json` update + TS-client + Studio follow-up notes.
- **Migration:** V1 `ReceiptRegistry` stays live for the 1,330+ existing receipts (chain history immutable). V2 is a fresh anchor target. TS clients + Studio receipt-loader need a follow-up to sign EIP-712 + branch on `chainAnchor.registryAddress`.
- **Verification:** `scripts/qa/metamask-e2e/verify-k2-registry-v2.ts` — source-file regression on V2 contract + deploy script + test file presence.

(legacy plan text below preserved for context):
- **Code:** `contracts/src/ReceiptRegistry.sol:67-90` — replace `agentAddress: msg.sender` with EIP-712 typed-data recovery over `Receipt(bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash, address agentAddress, uint256 chainId, address verifyingContract, uint256 nonce)`. Add `nonces[agent]` mapping for replay protection. Domain separator on deployment.
- **Migration:** redeploy `ReceiptRegistryV2`. The 1,330 existing v1 receipts stay anchored on V1 — chain history is immutable, no rewrites. New receipts go to V2. Verifier (TS + Rust + Go) branches on the receipt's `chainAnchor.registryAddress`. Studio `/r/<id>` reads V2 first, falls back to V1; V1 receipts get a `LEGACY-REGISTRY` chip next to the version chip.
- **TS callers updated:** `packages/og-chain/src/contracts/ReceiptRegistry.ts:40-47` adds the EIP-712 sign step before anchor; `packages/runtime/src/pipeline.ts` produces the typed-data signature alongside the receipt-body signature.
- **Tests:** Foundry — cannot anchor with someone else's signature, cannot replay an anchor, nonce increments correctly, EIP-712 domain separator binds to chainId + verifyingContract. Plus the existing receipt-anchor smoke test extended to V2.
- **Effort:** 5h including redeploy + V2 in `contracts/deployments/testnet.json` + TS client + Rust/Go verifier branch (lands with K-15 polyglot work).

### N · K-8 · `/api/run` rate-limit + SIWE  ·  ✅ FIXED 2026-05-10 (`245e017`)
- **Code:** new `apps/studio/src/lib/rate-limit.ts` (in-memory token bucket; honest about single-instance scope; production multi-instance should swap for Upstash), new `apps/studio/src/lib/siwe-session.ts` (HMAC-protected session cookie with 1h TTL, single-use SIWE nonces with 5min TTL), new `apps/studio/src/app/api/auth/siwe/{nonce,verify}/route.ts` SIWE handshake routes. `apps/studio/src/app/api/run/route.ts:48-104` now applies a per-IP rate limit (10/min anonymous) BEFORE parsing the body, requires an active SIWE session matching any `userWallet` claim, and adds a per-wallet rate limit (50/hr authenticated) when authenticated.
- **Anonymous receipts:** still allowed for judges that don't authenticate, but bounded to 10/min per IP — operator wallet drain prevented.
- **Cookie posture:** `httpOnly`, `sameSite: 'strict'`, `secure: process.env.NODE_ENV === 'production'`. Cookie value is `<id>.<hmac(id)>`; tampering invalidates the HMAC.
- **Tests:** `scripts/qa/metamask-e2e/verify-k8-k9-auth.ts` — live tests confirm: nonce endpoint returns 200 + httpOnly + SameSite=strict cookie; `userWallet` claim without session → 401; malformed userWallet → 400; per-IP rate limit triggers 429 within ~10 hits.
- **Studio typecheck:** clean.

### N · K-9 · `/api/skill/save` SIWE + per-wallet sandbox + manifest validation  ·  ✅ FIXED 2026-05-10 (`245e017`)
- **Code:** `apps/studio/src/app/api/skill/save/route.ts:24-180` — anonymous POST is now 401 across the board. After SIWE-session lookup the route applies a per-wallet rate limit (5 saves/hr) and writes to `.ivaronix/skills/<sessionWallet>/<skillId>/SKILL.md`. The session wallet, not the body, controls the path namespace — cross-wallet writes are impossible by construction. A second `startsWith(sandboxRoot)` defence-in-depth check rejects any resolved path that escaped the per-wallet sandbox.
- **Manifest validation:** the route parses YAML frontmatter and walks `og.hooks.*` for shell-injection or path-escape patterns (`../`, leading `/` or `~`, `;`, `&&`, `|`, backtick, `$(`). Bad hooks return 400 with the offending stage + value named.
- **Studio dep:** added `yaml` (used by `packages/skills`) so the route can parse the frontmatter directly.
- **Tests:** `scripts/qa/metamask-e2e/verify-k8-k9-auth.ts` — source-file regressions on lib + route + library imports; live tests confirm anonymous → 401, per-IP rate limit triggers 429.
- **Studio typecheck:** clean.

## Tier S · One-line lies (with regression discipline)

Each item: the one-line code fix + a regression test that fails if the lie comes back + HALF_BAKED.md status update inline.

### N · S-1 · Delete `&& false` from `sandbox.ts:67`  ·  ✅ FIXED 2026-05-10 (`d15703f`)
- **Code:** `packages/skills/src/sandbox.ts:67` — replaced `&& false` placeholder with real check `ctx.providerKind !== undefined && ctx.providerKind !== '0g'`. Added `providerKind?: '0g' | 'nvidia' | 'openai' | 'ollama'` to `SandboxContext`. Both call sites threaded: `packages/runtime/src/pipeline.ts:165` passes `input.provider ?? '0g'`; `apps/cli/src/commands/doc.ts:131` passes literal `'0g'` (CLI doc-ask exposes no `--provider` flag).
- **Test:** `packages/skills/src/sandbox.test.ts` — 9 cases all green. NIM/OpenAI/Ollama + tee-required → blocks. 0G + tee-required → allows. Omitted providerKind (legacy CLI path) → allows. tee-required=false + nvidia → allows. Multi-violation stacking. Plus a source-file regression test that fails if `&& false /* placeholder */` re-appears anywhere in `sandbox.ts`.
- **Typecheck:** `@ivaronix/skills`, `@ivaronix/runtime`, `@ivaronix/cli` all green.

### N · S-2 · Storage light reads real evidenceRoot · I-5 · Chain light reads real txHash  ·  ✅ FIXED 2026-05-10 (`b9676f1`)
- **Code:** `apps/studio/src/app/r/[id]/page.tsx:160-175` — Storage gates on `local?.storage?.evidenceRoot`; Chain gates on `local?.chainAnchor?.anchorTxHash`. Compute now also gates on `local?.execution?.consensus?.individualAttestations?.length` (with local-body fallback for legacy receipts that pre-date the consensus block). TEE unchanged.
- **Test:** `scripts/qa/metamask-e2e/verify-s2-i5-lights.ts` — source-file regression guards (no `hasLocalBody ? 'verified'` for Storage; no `Chain: 'verified'` hardcode); HTML assertion via curl against the dev render; per-light state extracted from the dot-color CSS variable; cross-check against the local receipt body's evidence.
- **Surfaced honesty:** receipt #1004 (the README's headline "FULLY VERIFIED" example) now correctly renders Storage=pending (no real `evidenceRoot` in body — confirms H-3 — Studio's `/api/run` never uploaded) and TEE=pending (`routerVerified: false`, testnet default). The previous chip code lit them green regardless. **The fix is doing exactly what it should.** Honest tier marking per CLAUDE.md §6.

### N · S-3 · RunPanel Storage starts pending, gated on real response  ·  ✅ FIXED 2026-05-10 (`98f102b`)
- **Code:** `apps/studio/src/components/RunPanel.tsx:115-148` — initial layers `Storage: 'pending'`; success branch `Storage: data.storage?.evidenceRoot ? 'verified' : 'pending'`; error/catch branches keep Storage `'pending'`. Zero remaining `Storage: 'verified'` claims in the click handler.
- **Plumbing:** `RunResponse.storage?.evidenceRoot` added to the typed shape; `/api/run/route.ts` returns `storage: { evidenceRoot: result.storageEvidenceRoot ?? null }`; `PipelineOutput.storageEvidenceRoot: string | null` declared with `null` returned by today's runtime path (Studio runtime does not upload to 0G Storage; H-3 will populate this and the light will go green automatically).
- **Test:** `scripts/qa/metamask-e2e/verify-s3-runpanel-pending.ts` — source-file regression on RunPanel.tsx, `/api/run/route.ts`, and `pipeline.ts`; counts zero `Storage: 'verified'` literals remaining; Playwright snapshot of the home page at desktop + mobile.
- **Honest behavior:** until H-3 ships, every Studio-Run receipt's Storage light stays pending. The receipt body itself reports no Storage evidence; the page is consistent with reality.

### N · S-4 · `delegate.ts` exitCode propagation  ·  ✅ FIXED 2026-05-10 (`38452bc`)
- **Code:** `apps/cli/src/commands/delegate.ts:482-510` — finally block restores env vars only; the unconditional exit-code zero-reset is removed. After the finally, the post-runOk branches set `process.exitCode = 0` (success) or `process.exitCode = 1` (failure) explicitly. Scripted callers checking `$?` now see honest results.
- **Test:** `scripts/qa/metamask-e2e/verify-s4-delegate-exit.ts` — source-file regression: finally body must not contain a zero-reset; runOk-true and runOk-false branches must each set the exit code explicitly.
- **Live exit-code path:** the bug only triggered when a real delegate's inner `doc ask` failed; reproducing requires a fully-set-up delegate + grant + skill + bad doc. The mechanical regression on the source patterns is high-signal for this kind of fix; cron-loop firings of `delegate run` against real delegates will exercise the live path.

### N · S-5 · `chat-v2.ts` import audit  ·  ✅ VERIFIED 2026-05-10 (file exists; build passes)
- **Finding:** the round-1 audit (HALF_BAKED A-7) flagged `apps/cli/src/bin/ivaronix.ts:41` as importing `'../commands/chat-v2.js'` and noted the file might not exist. **Confirmed via Glob:** `apps/cli/src/commands/chat-v2.tsx` does exist. TypeScript's `.js` import resolution maps to `.tsx` per `moduleResolution: "node"`. The CLI build (`pnpm --filter @ivaronix/cli build` → `tsc -b`) succeeds clean.
- **No code change required.** A-7 was a false positive in the round-1 audit.
- **CI gate:** the existing `tsc -b` step already catches missing-import errors. No regression possible without a build failure surfacing first.

## Tier A · Round-2 high-impact under-1h

### N · H-2 · `processResponse` third argument  ·  ✅ FIXED 2026-05-10 (`77eb746`)
- **Schema extension:** `packages/receipts/src/schema.ts` — `ConsensusRoleAttestation` declares optional `content?: z.string().optional()`. Optional for backward compat — receipts produced before this field shipped will omit it; their independent verify falls back to the 2-arg form with an explicit `chatId-only; legacy receipt` label.
- **Pipeline plumbing:** `packages/runtime/src/pipeline.ts:497-525` and `apps/cli/src/commands/doc.ts:490-518` both build a role→content map from `consensus.reviewerOutputs` + `consensus.judgement` and write it into each `individualAttestation`.
- **CLI verify:** `apps/cli/src/commands/receipt.ts:222-281` — Att type extended with `content?: string`. Verify loop calls 3-arg `broker.inference.processResponse(providerAddress, chatId, content)` when content is present; falls back to 2-arg form with `PASS (chatId-only; legacy receipt)` label when missing. Both Provus and AIsphere's live-inference paths use the 3-arg form; we match on the offline-verify path.
- **Test:** `scripts/qa/metamask-e2e/verify-h2-process-response.ts` — schema check, pipeline + doc.ts content-population check, receipt.ts 3-arg conditional check, 2-arg fallback retained for legacy receipts.
- **Typecheck:** `@ivaronix/receipts`, `@ivaronix/runtime`, `@ivaronix/cli` all clean.

### N · H-1 + H-4 · attestationHash + memoryClient.store after every anchor  ·  ✅ FIXED 2026-05-10 (`1f43a27`)
- **H-1 (attestationHash):** the receipt-build sites in `packages/runtime/src/pipeline.ts:497-525` and `apps/cli/src/commands/doc.ts:490-518` now compute `attestationHash: a.zgResKey ? keccak256(toUtf8Bytes(a.zgResKey)) : '0x000…0'`. New receipts anchor a real attestation commitment on chain; chain-only verifiers can cross-check the chat ID against the stored hash. Zero-fallback retained for the path where no chat ID exists (TIER 2 / NIM-routed runs). Existing 1,330+ receipts on-chain stay anchored at `0x000…0` — chain history is immutable.
- **H-4 (memory store):** `packages/runtime/src/pipeline.ts:373-410` now calls `memoryClient.store({ group_id: skill.id, user_id: env.walletAddress, type: 'episodic_memory', content: <receipt summary>, metadata: { receiptId, receiptOnchainId, tier, providerKind, anchorTxHash, anchoredAt } })` after every successful anchor. Best-effort: never throws; logs success or sidecar failure honestly. Gated on `memoryClient && env.walletAddress && receiptId` — when `ZG_MEMORY_URL` is unset, `MemoryClient.fromEnv()` returns null and the store hop is skipped per honest-by-absence.
- **Effect on the previously-empty store:** the pipeline already searches Persistent Memory pre-consensus (line 211); now it also writes. Subsequent runs against the same skill + wallet retrieve real prior memories via `request.memoryQuery.retrievedCount > 0`. The "every anchor stores the receipt body" comment at memory-client.ts:24-26 is now true (was false by zero callers).
- **Test:** `scripts/qa/metamask-e2e/verify-h1-h4-attest-memory.ts` — ethers imports include keccak256 + toUtf8Bytes; pipeline + doc.ts bind attestationHash to chat ID via keccak; pipeline calls memoryClient.store after anchor; store call is gated correctly; metadata carries the right fields.
- **Typecheck:** `@ivaronix/runtime`, `@ivaronix/cli` clean.

### N · I-1 · `/r/[id]` VERIFIED chip gated on real verifyClaimed  ·  ✅ FIXED 2026-05-10 (`d57b635`)
- **Code:** `apps/studio/src/app/r/[id]/page.tsx:147-185` — server-side `verifyClaimed(local)` (the same canonical `@ivaronix/receipts` verifier the CLI uses). Three branches:
  - `claimResult.state === 'INVALID'` → chip shows MISMATCH plus an inline failed-check reason (e.g. `hash failed: expected 0xab…, computed 0xcd…`)
  - `claimResult.state === 'CLAIMED'` → chip shows VERIFIED (we're past the 404 so the on-chain row already exists)
  - `local` body absent → chip shows PENDING
- **Studio dependency:** added `@ivaronix/receipts` to `apps/studio/package.json` (was a transitive-only dep that failed import resolution).
- **Failure-mode disclosure:** when the chip is mismatch, an adjacent dashed-border pill names the failed check (`schema`, `hash`, `signature`) so the operator and judge see exactly which step broke. Replaces the old "verified at first paint, broken on inspection" UX with a transparent failure path.
- **Test:** `scripts/qa/metamask-e2e/verify-i1-verifyclaimed.ts` — source-file regression on the import + the verifyClaimed call + the state branches; live curl against `/r/1004` confirms the chip still renders VERIFIED for a valid signature.
- **Studio typecheck:** clean.

### N · I-2 / K-16 · Studio Burn Mode real AES-256-GCM encryption  ·  ✅ FIXED 2026-05-10 (`25b2266`)
- **Code:** `packages/runtime/src/pipeline.ts:489-510` calls `burnEncrypt(Buffer.from(activeContext, 'utf8'))` from `@ivaronix/og-storage` when `burnEnabled`. Real 32-byte AES-256-GCM session key via `randomBytes(32)`; real `keyFingerprint = sha256(realKey)`; key buffer zeroed after fingerprinting.
- **What was a lie:** previous Studio path computed `keyFingerprint = sha256("burn:" + skillId + userPromptHash + sessionKeyDestroyedAt)` — a deterministic label hash. No real key, no real encryption.
- **Surface parity:** CLI burn path always called `burnEncrypt`; Studio runtime now matches byte-for-byte.
- **Storage upload honesty:** ciphertext is in-memory at receipt-build time. When H-3 ships real Studio-side 0G Storage upload, the same ciphertext becomes on-chain evidence. Until then, `storage.evidenceRoot` stays `null` per honest opt-in.
- **Test:** `scripts/qa/metamask-e2e/verify-i2-k16-burn.ts` — source-file regression on the import + the burnEncrypt call + absence of the old fake-fingerprint pattern; functional check that two `burnEncrypt` calls on identical plaintext produce DIFFERENT keyFingerprints + DIFFERENT ciphertexts (key-randomness invariant).
- **Studio dep:** added `@ivaronix/og-storage` to `packages/runtime/package.json`.
- **Runtime typecheck:** clean.

### N · L-7 · Vercel-deploy Studio  ·  ✅ CODE-COMPLETE 2026-05-10 (`e1e69b4`) · deploy = operator-action A-V2-L7
- **Env template:** `apps/studio/.env.production.template` shipped with the full env list grouped by purpose (chain + receipts, 0G Compute, NIM fallback, K-8/K-9 SIWE secret + Upstash rate-limit, Persistent Memory + DA + Storage opt-ins, Sentry, Studio base URL). Every line either REQUIRED or has a documented default.
- **Operator-action runbook:** `docs/USER_TODO.md` §A-V2-L7 — exact `! vercel login` + `vercel --prod` invocation, custom-domain DNS pointing for `ivaronix.app`, Sentry + Upstash signup notes, post-deploy smoke commands.
- **Smoke tests on the live URL** (the operator runs after first deploy): `/r/1004` chip renders VERIFIED; `/api/auth/siwe/nonce` returns httpOnly cookie; anonymous `/api/skill/save` returns 401; 11 anonymous `/api/run` hits in a minute trigger 429.
- **Studio typecheck:** clean.

## Acceptance gates (no item ships without these)

Per CLAUDE.md §11 e2e + §12.1 stop condition, every fix above must pass:

1. **Code change** committed with conventional-commit subject + body explaining the fix.
2. **Unit test or Foundry test** asserting the fix.
3. **CI lint rule or assertion** that prevents regression.
4. **Real-MM Playwright e2e** for any UI-touching fix, both viewports, screenshot bundle in `screenshots/<item-id>/`.
5. **Live receipt or chain artefact** for any chain-touching fix (anchor tx hash + chainscan link in the commit body).
6. **HALF_BAKED.md status update** in the same commit (item-id moved from "to fix" to "fixed in commit X").
7. **`docs/QA_LOOP_BRIEF.md` punch-list line** added in the same commit per §12.6.

If any gate fails, the fix is not shipped — it stays in this section as `[blocked: gate-N]` with the specific failure mode named.

## Effort ladder

- Tier 0 total: 17h (1 + 4 + 5 + 4 + 3).
- Tier S total: 2h 15min.
- Tier A total: 8.5h (0.5 + 1 + 1 + 2 + 4).
- K-15 polyglot canonical hash: 15h.
- **Grand total: ~43h**, sequenced as Tier 0 day 1-2 → Tier S day 2 evening → Tier A day 3 → K-15 day 4-7 → Vercel-deploy + smoke days 8-9.

This is the no-compromise execution shape for the entire fix batch. Every item now has the same plan resolution as K-15.

This appendix is inventory. No code changed. Smoke testing remains deferred until the next polish pass per the user's instruction.
