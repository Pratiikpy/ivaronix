# Phase 1.5 · ISSUE-B · legal-citation-verifier · honestly marked PARTIAL

> Per operator directive 2026-05-15: "either make runtime CourtListener/Cornell verification real and tested, OR remove it from 'live/full' surfaces and mark it clearly partial/roadmap."

## TL;DR · Option B shipped (clear PARTIAL marking on every Studio surface)

Implementing Option A (real runtime web_fetch enforcement) is a code-change in `apps/cli/src/commands/doc.ts` plus model size constraint (Qwen 2.5 7B testnet model doesn't reliably emit tool_calls). Option B (mark PARTIAL clearly) was the faster honest path. All Studio surfaces that previously claimed live CourtListener / Cornell LII verification are now explicitly labeled testnet-PARTIAL with the mainnet-promotion gate documented.

## What was wrong

The Q9 audit already established the gap honestly in `QA_PROOF_PACK/testnet/ai-quality/legal-citation-verifier.md`:
- PARSING works (B+)
- CASE-EXISTENCE verification does NOT work (model doesn't emit web_fetch tool_calls)
- Receipt 64 anchored with parsed citations but no actual HTTP cross-check

But Studio's `/legal` page (the highest-traffic legal-vertical surface) still presented citation-verifier as if it was live-fetching CourtListener · creating a half-baked-as-LIVE situation.

## 3 fixes on apps/studio/src/app/legal/page.tsx

### Fix 1 · §2 "Mata v. Avianca comparison wall" (line 150)

Before: "Ivaronix · legal-citation-verifier · Skill HTTP-fetches CourtListener + Cornell LII for every citation."

After: "Ivaronix · legal-citation-verifier (architecture) · Architecture routes each cite through HTTP to CourtListener + Cornell LII via the web_fetch builtin. Testnet caveat: Qwen 2.5 7B does not yet reliably emit tool_calls; runtime web_fetch enforcement is queued as this skill's mainnet-promotion gate — testnet verdicts are heuristic parsing only."

The arrow of value (Architecture survives every model upgrade · external-DB-as-ground-truth is the right design) is preserved · but the testnet limit is now explicit in the body.

### Fix 2 · §5 "Before/after" example for citation-verifier (line 808)

Before: heading "legal-citation-verifier" · After-paragraph claimed "Each citation routed through web_fetch to CourtListener and Cornell LII"

After: heading "legal-citation-verifier · PARTIAL (testnet)" · After-paragraph explicitly says "Citation PARSING works (B+); CASE-EXISTENCE verification is queued as this skill's mainnet-promotion gate. Testnet receipt 64 captures the parsed citation set but the Qwen 2.5 7B model did not emit web_fetch tool_calls — verdicts are heuristic."

ReceiptDescription updated to "TESTNET PARTIAL · runtime web_fetch enforcement queued".

### Fix 3 · §6 "DONTS / honest disclaimers" (line 844)

Before: "We do not verify legal holdings" (vague claim of partial verification still implied)

After: "legal-citation-verifier is PARTIAL on testnet today" · explicit paragraph stating parsing works (B+) · Qwen 2.5 7B doesn't reliably emit tool_calls · runtime enforcement is the mainnet-promotion blocker · we surface it openly per CLAUDE.md §1 rather than ship a hallucination-prone verdict as LIVE.

Citation: Q9 audit file path included so users / judges can read the full audit.

## Other surfaces audited (no half-baked-as-LIVE claims found elsewhere)

- `/verticals` — grep'd · doesn't reference citation-verifier specifically · just lists 5 skills generically · skill manifest description (v0.1.3 · already honest) is the source
- `/marketplace/legal-citation-verifier` — renders skill manifest description (already honest)
- `/skill/legal-citation-verifier` — renders skill manifest description (already honest)
- Skill manifest at `seed-skills/legal-citation-verifier/SKILL.md` v0.1.3 description (already honest): "Parse a legal brief or memo for citations and produce best-effort structured output. Architecture routes case-existence checks through HTTP to CourtListener and Cornell LII via the web_fetch builtin; however, on Galileo testnet (Qwen 2.5 7B) the model does not yet consistently emit web_fetch tool_calls, so verdicts are heuristic until the runtime enforcement gate ships."

Grep confirmed only 2 files mention citation-verifier specifically: `apps/studio/src/app/legal/page.tsx` (the 3 edits above) and `apps/studio/src/lib/first-party-skills.ts` (just a slug in a list · no claim).

## What the production user / judge sees now

Open `https://ivaronix.vercel.app/legal`:
1. §2 comparison wall — bullets explicitly say "Architecture routes... testnet caveat: model doesn't emit tool_calls · runtime enforcement queued"
2. §3 cluster grid — shows skill manifest description (already honest)
3. §5 before/after — heading reads "legal-citation-verifier · PARTIAL (testnet)" · after-paragraph quotes the audit verdict
4. §6 disclaimers — explicit "legal-citation-verifier is PARTIAL on testnet today" with the fix path documented

No claim that the skill is live-verifying citations exists in production Studio. Every claim that exists points at the architecture + the testnet caveat + the mainnet promotion gate.

## Re-run regression (Rule C)

- `pnpm --filter @ivaronix/studio test` — source-file regressions stay green
- `pnpm -r typecheck` — no type errors from the page edits

## ISSUE-B closure

Option B shipped. The skill stays present in the legal cluster (the Mata v. Avianca pitch is the strongest one we have · we don't want to lose it) but every Studio surface honestly says PARTIAL on testnet with the mainnet promotion gate documented. The manifest description was already honest; the gap was specifically on `/legal` page · now fixed.

Option A (real runtime web_fetch enforcement) stays queued as the mainnet-promotion blocker for THIS specific skill · documented at `QA_PROOF_PACK/testnet/ai-quality/legal-citation-verifier.md`.
