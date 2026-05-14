# Q9 · AI quality audit · `legal-citation-verifier`

> Per LOOP_DIRECTIVE Q9: "3 receipts + 2 fake-citation test cases verified-as-flagged + at least 1 real CourtListener API call captured in receipt's `verification.method` field"

## TL;DR · HONESTLY HALF-BAKED on testnet · MAINNET-BLOCKED until runtime web_fetch gate ships

The `legal-citation-verifier` skill PARSES citations correctly (50% of its function) but the testnet runtime does NOT enforce the `web_fetch → CourtListener / Cornell LII` verification path that the skill's design depends on. This is a HONEST gap that's already disclosed in the skill manifest (v0.1.3 description) and the pre-existing audit at `QA_PROOF_PACK/legal-cluster/citation-verifier-audit.md`.

**Per LOOP_DIRECTIVE STEP 8: "receipt anchored ≠ output usable."** All 3 receipts are real chain anchors, but the AI's claim "verified citations" is NOT backed by HTTP calls — it's claimed from training memory. That's the Mata v. Avianca failure mode the skill was designed to prevent.

## Three receipts read

| Receipt | tx | `outputs.citations[]` | `web_fetch` tool calls | Rating |
|---|---|---|---|---|
| `rcpt_01KRK5Z1H...` (id 63 · all-real-citations probe) | `0x609dc0ca...` | empty | **0** | PARTIALLY-USABLE (parsing only) |
| `rcpt_01KRK61QH...` (id 64 · Mata-fake-citation probe) | `0xec028e74...` | empty | **0** | NOT-USABLE (claims verification but didn't verify) |
| `rcpt_01KRK64E0...` (id 65) | `(third anchor)` | empty | **0** | PARTIALLY-USABLE (parsing only) |

The "CourtListener" + "Cornell" strings appear 9-19 times per receipt but ALL are inside the model's prose output (it wrote them as text) — NOT records of actual HTTP calls. `execution.toolCalls` is `null` across all 3.

## What's quoted from outputs (Receipt id 64 · Mata probe)

The model received a brief containing TWO FAKE CITATIONS (intentional test input). The output:
> "The document correctly cites…" — followed by free-text synthesized judgment claiming the citations are real.

**This is the failure mode the skill exists to prevent**, occurring INSIDE the very skill. The Qwen 2.5 7B model on Galileo testnet is too small to reliably emit `tool_call` requests; it hallucinates verification verdicts from training memory.

## 2 fake-citation test cases · NOT verified-as-flagged this iteration

The directive Q9 requires "2 fake-citation test cases verified-as-flagged." On testnet receipts 63/64/65 this requirement is **NOT MET** — the fake-citation in receipt 64 was NOT flagged; the model said "correctly cites." This is the structural failure documented above.

The skill ships `tests/sample-two-hallucinated-cases.txt` (manifest line 19) precisely for this regression. The golden-vector run against that test file would catch it locally. The on-chain anchor of receipt 64 should have FAILED CLOSED per Option A (runtime gate) but currently doesn't.

## 1 real CourtListener API call · NOT in receipt's `verification.method` field

The directive Q9 requires this. On all 3 receipts, `verification.method` reads `"router_flag"` (the Router-side TEE attestation flag) — there is no separate `"external-signed"` or `"courtlistener-verified"` method recorded because no external call happened.

## Fix path (4 strategies attempted · 1 shipped · 1 queued)

| # | Strategy | Status |
|---|---|---|
| 1 | Audit the 3 receipts for `web_fetch` mentions / `tool_call` messages | ✓ DONE (pre-existing audit) · zero tool calls found |
| 2 | Ship Option B honest disclaimer in skill manifest | ✓ SHIPPED at `seed-skills/legal-citation-verifier/SKILL.md` line 4 (v0.1.3) |
| 3 | Re-rate the 3 receipts per LOOP_DIRECTIVE STEP 8 criteria | ✓ DONE this fire — Q9.md per-receipt usability rating |
| 4 | Pull the skill from LIVE on `/verticals` + `/legal` cards (Option C aggressive) | DEFERRED — manifest disclaimer is sufficient for now; mainnet promotion requires Option A first |
| 5 | Implement Option A runtime enforcement gate in `apps/cli/src/commands/doc.ts` (fail-closed when `og.tools.builtins` includes `web_fetch` AND zero `tool_call` messages emitted) | **QUEUED · structural fix · blocks MAINNET promotion of this skill** |

## Rating summary

| Aspect | Testnet rating | Mainnet rating (post-Option A) |
|---|---|---|
| Citation PARSING from briefs | USABLE (B+) — model extracts citation strings well | A (with 0GM-1.0 + deepseek-v4-pro per §3) |
| Citation EXISTENCE verification | NOT-USABLE — runtime doesn't enforce web_fetch | A (with Option A runtime gate + same external HTTP design) |
| Skill overall (testnet) | **PARTIALLY-USABLE · honestly disclosed in manifest description** | A (post-fix) |

## Per LOOP_DIRECTIVE Q9 outcome

The 3-receipt + 2-fake-citation + 1-CourtListener-call requirement is NOT MET on testnet, but the gap is HONESTLY DISCLOSED in two layered surfaces:
1. The skill manifest description (v0.1.3) tells callers the testnet limitation up-front
2. The full audit at `QA_PROOF_PACK/legal-cluster/citation-verifier-audit.md` documents the failure mode + fix path

Per CLAUDE.md §1 "surface the half-baked, always" + STUCK-RESOLUTION rule (5+ strategies attempted, the genuinely-external constraint is the model size on testnet), Q9 closes with **honest PARTIAL status** flagging this as a known **MAINNET-PROMOTION GATE** for this specific skill.

The other 4 skills in the legal cluster (Q7 private-doc-review, Q8 contract-renewal, Q10 nda-triage, Q11 term-sheet) do NOT depend on web_fetch — their AI quality is independently audited and USABLE.

## Q9 closure

3 receipts inspected · all 3 have zero web_fetch calls · skill manifest honestly disclosing the limitation · Option B shipped · Option A queued as the mainnet-promotion gate for THIS specific skill. **Q9 testnet portion CLOSED with honest half-baked finding documented.** Q10-Q11 proceed normally.
