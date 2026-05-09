# Ivaronix · Half-Baked Punch List

> Brutal-honest audit assembled by 5 parallel subagents on 2026-05-09.
> Standard: this should look like Linear, Stripe, Vercel — not a hackathon submission.
> Scope: full codebase, not just planning docs. Findings outside `planning-01.md` and `planning-002.md`.
>
> **HIGH** = a judge will catch this · **MED** = a senior reviewer will catch this · **LOW** = cosmetic.
>
> Ranked HIGH → LOW within each section. File:line citations throughout.

---

## A · Real bugs that compromise correctness or safety (HIGH)

These are not polish. These are claims the codebase makes that the code does not enforce.

### A-1 · `compute_tee_required` security guard is a dead branch
- **`packages/skills/src/sandbox.ts:67`** — gate is `if (p.compute_tee_required && false /* placeholder */)`. The `&& false` makes this check permanently skipped.
- **Effect:** any skill that declares `compute_tee_required: true` runs on a non-TEE provider with **zero enforcement**. The sandbox advertises a security property it does not provide.
- **Fix:** delete `&& false`. Either trust consensus's TEE check (then remove this branch entirely) or wire `modelCapabilities.teeVerified` from the gate input as the real guard. One-line change.

### A-2 · `StubKvClient` is the only KV implementation in production
- **`packages/og-kv/src/index.ts:35-37`** — `createKvClient()` unconditionally returns an in-process `Map<string, string>`. Comment from line 10: "Real implementation lands in Day 8."
- **Effect:** every "hybrid memory" claim, every `passport:{wallet}:latest` pointer, every `memory:{agentId}:manifest` reference is fictional. Reset the process and all KV state vanishes.
- **Fix:** implement `RealKvClient` against the 0G memory KV server (spec at `oglabs resources/0g-memory-kv-server/`). Gate on `IVARONIX_KV_URL`; fall back to stub only in tests.

### A-3 · `attestationHash: null` on every TIER 1 receipt
- **`packages/consensus/src/index.ts:174`** — `attestationFromRaw` always sets `attestationHash: null`. The field is never populated anywhere downstream.
- **Effect:** the on-chain `anchor()` call passes `0x000…000` for the attestation hash slot of every receipt. The `--tee-independent` re-verifier still works (it re-runs `broker.processResponse`), but the on-chain attestation field is useless.
- **Fix:** populate from `raw.x0gTrace?.tee_attestation_hash` or derive `keccak256(zgResKey)` for TIER 1. Five lines.

### A-4 · `/r/[id]` shows green "Storage" light when no storage upload happened
- **`apps/studio/src/app/r/[id]/page.tsx:151`** — `Storage: hasLocalBody ? 'verified' : 'pending'`. Any receipt with a local JSON file shows a green Storage light, even if `evidenceRoot` is absent.
- **Effect:** receipts that never touched 0G Storage display "all four lights green." Misleading at first paint.
- **Fix:** `Storage: local?.storage?.evidenceRoot ? 'verified' : 'pending'`. One line.

### A-5 · `RunPanel` Storage light is green at click, not on result
- **`apps/studio/src/components/RunPanel.tsx:113`** — `setLayers({ Storage: 'verified', ... })` runs immediately on click, before any upload.
- **Effect:** the Storage light goes green visually before any upload happens; stays green on error. UX lies during the live demo.
- **Fix:** start all four lights as `'pending'`. Set Storage to `'verified'` only when `data.ok && data.scan?.matches`.

### A-6 · `delegate run` mutates `process.env` then forces `exitCode = 0`
- **`apps/cli/src/commands/delegate.ts:469-488`** — sets `process.env.EVM_PRIVATE_KEY = delegateKey`, calls `docCommand.parseAsync`, restores in `finally`. Same `finally` resets `process.exitCode = 0` unconditionally.
- **Effect:** (1) Race-unsafe — concurrent async ops between set and restore see the wrong key. (2) Exit code masking — child run failures return exit 0 to scripted callers.
- **Fix:** spawn `docCommand` in a child process with the delegate's env vars set on the subprocess. Remove the `process.exitCode = 0` from `finally`.

### A-7 · `chat-v2` import may reference a non-existent file
- **`apps/cli/src/bin/ivaronix.ts:41`** — `import { chatV2Command } from '../commands/chat-v2.js'`.
- **Effect:** if the source `chat-v2.ts` doesn't exist, every `ivaronix` invocation throws on startup.
- **Fix:** verify `apps/cli/src/commands/chat-v2.ts` exists. If not, remove the import and the `program.addCommand(chatV2Command)` call.

### A-8 · `/onboard` falls back to `local-sha256` and mints anyway
- **`apps/studio/src/app/api/onboard/metadata/route.ts:72-83`** — when 0G Storage upload fails, returns `method: 'local-sha256'`, browser proceeds to `AgentPassportINFT.mint(localSha256Root)`.
- **Effect:** passport is minted with a non-Merkle-root in `metadataRoot`. There is no way to distinguish a fallback mint from a real one by reading on-chain state.
- **Fix:** when fallback fires, return 503 `{ error: '0G Storage unavailable; retry after a moment' }`. Do not mint with degraded identity.

### A-9 · `/api/run` has zero rate limiting
- **`apps/studio/src/app/api/run/route.ts`** — anonymous POST. No `X-Api-Key`, no per-IP throttle, no quota. Only guard is `maxDuration = 60` Vercel cap.
- **Effect:** a single anonymous caller can exhaust the operator's OG balance, NVIDIA NIM quota, and 0G Compute credits in minutes. Live demo can run out of gas mid-presentation.
- **Fix:** add Upstash rate-limit or simple in-memory IP token-bucket in `middleware.ts`. 1-4h.

### A-10 · No HTTP security headers
- **`next.config.ts`** — no `headers()` config. Missing `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.
- **Effect:** any XSS becomes cookie theft. Clickjacking is trivial. The `/embed/r/[id]` route is designed to be iframed but has no `frame-ancestors` policy controlling who can embed Ivaronix.
- **Fix:** add `headers()` to `next.config.ts`. Under 1h.

### A-11 · No production error capture
- **No Sentry, LogRocket, or any error telemetry anywhere.**
- **Effect:** a `/api/run` 500 during the live demo is invisible. No alert, no aggregated view. Flying blind.
- **Fix:** `@sentry/nextjs`, one config file. Under 1h.

### A-12 · Trust-layer policy engine is built but never called
- **`packages/trust-layer/src/policy.ts`** — `evaluatePolicy()` and `defaultPolicySet()` exist, exported, with mainnet-high-stakes-requires-approval rules. **Zero callers** in `runPipeline` or anywhere else.
- **Effect:** "Phase 3 enterprise spend limits / approval gates" is advertised but the rule set fires on nothing.
- **Fix:** either call `evaluatePolicy()` in `runPipeline()` before consensus, or document it as "design only, not yet wired" so judges who read the package don't assume enforcement.

### A-13 · `compute verify-tee` is a stub that no-ops
- **`apps/cli/src/commands/compute.ts:69-77`** — prints "forwarding to receipt verify" and exits without actually calling `receipt verify`.
- **Effect:** a user running `ivaronix compute verify-tee` expecting verification gets nothing.
- **Fix:** either delete the command and document the alias in `compute --help`, or actually invoke `receipt verify --tee-independent` via `parseAsync`.

### A-14 · CI silently passes broken Studio builds
- **`.github/workflows/ci.yml:56`** — Studio `next build` step has `continue-on-error: true` with a "platform-specific issue" comment.
- **Effect:** the CI badge lies. A broken production build silently passes CI green.
- **Fix:** either fix the underlying issue (font preload) or split into a separate non-blocking optional job with a clear label.

### A-15 · `/global` reaches into private fields via `as unknown as`
- **`apps/studio/src/app/global/page.tsx:44`** — casts `MemoryAccessLogClient` to access its private `.contract` field, then calls `.queryFilter()` directly.
- **Effect:** if `MemoryAccessLogClient` renames or encapsulates `contract`, the global page breaks at runtime with no compile error.
- **Fix:** add `queryRecentAccessEvents(fromBlock)` method to `MemoryAccessLogClient` in `packages/og-chain/`. Use it.

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
| `docs/QA_FULL_PRODUCT_REPORT.md:175` | "seamless" | In a summary table — replaceable with concrete pass/fail. |
| `docs/QA_LOOP_BRIEF.md:36, 195` | "seamless", "empower" | Inside pasted external text. Fix: wrap external text in attributed `>` blockquote. |
| `docs/reference/0G_RESOURCES.md:348` | "state-of-the-art" | Quoted from OpenAdapter without attribution. Fix: prefix with source. |
| `seed-skills/imports/skill-share/SKILL.md:4, 107` | "seamless", "leverages" | Imported skill, upstream-owned copy. Fix: mark `source: imported` and document upstream voice. |

### Missing professional sections in repo-root README (HIGH)

The root `README.md` has **no** License section, **no** Contributing section, **no** Security Policy, **no** Code of Conduct, **no** Support/Contact beyond a one-liner. GitHub's community standards checklist will flag these. Three sentences each is fine for a solo project; zero is not production-ready.

### Voice scores per doc (lower = needs work)

| Doc | Score | Highest-priority fix |
|---|---|---|
| `docs/JUDGE_GUIDE.md` | **5/10** | Title + body addresses hackathon judges; receipt-count drift vs README. |
| `seed-skills/0g-integration-auditor/SKILL.md` | **5/10** | "Day-21 automation" in user-facing description field. |
| `README.md` | **6/10** | 1,330+ vs 1,165 vs 1,071 vs 1,400+. Plus missing License/Contributing/Security. |
| `docs/PITCH.md` | **6/10** | "A judge can read this in five minutes." Strip judge-addressed framing. |
| `docs/QA_FULL_PRODUCT_REPORT.md` | **7/10** | "seamless flow" — replace with concrete evidence row. |
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
