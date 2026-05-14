# legal-citation-verifier · transcript audit (Fire 9 finding)

> Honest scope audit per CLAUDE.md §1 "surface the half-baked, always" + the locked feedback_test_phase_priority_one.md memory ("verify AI is behaving exactly how we want").

## The question

The `legal-citation-verifier` skill's central design choice (per `seed-skills/legal-citation-verifier/SKILL.md` and the directive Task 1 §3 text) is:

> The 7B model is used only to PARSE the brief (find citation strings) and NORMALIZE the matched results · NOT to determine if a case exists. Case-existence verification routes through real HTTP via the `web_fetch` builtin tool against CourtListener and Cornell LII.

This audit asks: **Did the 3 anchored receipts (ids 63, 64, 65 from Fire 8) actually call `web_fetch`, or did the model hallucinate "verified" verdicts from training memory?**

## Method

Read each of the 3 citation-verifier receipt JSONs on disk (`apps/cli/.ivaronix/receipts/anchored/rcpt_01KRK5Z1HADXKTGTFJARQ2VMB3.json`, `rcpt_01KRK61QHJZKBJTNV4RV472G33.json`, `rcpt_01KRK64E04MNAJ4W43HXVWSXTR.json`). For each, count occurrences of the string `web_fetch` across the entire receipt JSON. Inspect `outputs.citations` (the manifest-declared structured-output schema) and `outputs.wording` (the model's prose).

## Findings

| Receipt | On-chain id | `web_fetch` mentions | `outputs.citations` array length | `outputs.wording` content |
|---|---|---|---|---|
| `rcpt_01KRK5Z1H...` | 63 | **0** | 0 (empty) | Synthesized judgment prose only |
| `rcpt_01KRK61QH...` | 64 (Mata probe) | **0** | 0 (empty) | "The document correctly cites..." — claims citations are correct without external verification |
| `rcpt_01KRK64E0...` | 65 | **0** | 0 (empty) | Synthesized judgment prose only |

The "CourtListener" + "Cornell" string mentions inside the receipts (9-19 hits per receipt) are URL strings the model WROTE into its prose output — not records of actual HTTP calls. The `execution.toolCalls` field is `None` on all 3.

## Verdict

**Runtime did NOT make HTTP requests.** Across 3 receipts × multiple roles in the high-stakes consensus tier (analyst + critic + risk-reviewer + evidence-checker + judge), the Qwen 7B model emitted ZERO `tool_call` messages to `web_fetch`. Instead it produced a free-text "synthesized judgment" that claims to verify citations against legal databases.

This is the **Mata v. Avianca failure mode** the skill exists to prevent — except occurring inside the very skill that promises to prevent it.

## What is and isn't real

What IS real (chain side):
- 3 receipts anchored on `ReceiptRegistryV2 0xf675d4…` (ids 63, 64, 65)
- Real tx hashes, real blocks, real signer recovery
- Receipt URLs resolve on prod Vercel (HTTP 200 on all 3)
- Four-light row renders ANCHORED + TIER 1 + TEE + 0GM
- Polyglot canonical hash byte-equal across TS/Py/Rust

What is NOT real (AI output side):
- The model's claim "verified citations" against external databases
- The skill manifest's promise that case-existence flows through HTTP, not training memory
- Any structured `citations: Citation[]` output (the field is empty list across all 3)

## Why this happened

Two contributing factors:

1. **Qwen 7B's tool-calling reliability**: smaller models hallucinate tool-call decisions. The 7B chose to output prose answers rather than emit a `tool_call` request even though the system prompt forbids verifying from memory.

2. **No runtime enforcement gate**: the manifest declares `og.tools.builtins: ['web_fetch']`, but the runtime doesn't fail-closed when a citation-bearing skill produces no `web_fetch` invocations. The skill ANCHORED a receipt that should have FAILED CLOSED.

## Fix path (queued for next fire)

### Option A · runtime enforcement gate (preferred)

In `apps/cli/src/commands/doc.ts` receipt-assembly path: before signing the receipt, if the loaded skill's `og.tools.builtins` includes `web_fetch` AND the consensus transcript has zero `tool_call` messages to `web_fetch`, fail the run with a clear error message and DO NOT anchor on chain. This is the architectural fix.

### Option B · honest scope disclaimer (immediate)

Update `seed-skills/legal-citation-verifier/SKILL.md` description to add:

> Honest scope (testnet): the Qwen 2.5 7B model on Galileo testnet does not consistently emit web_fetch tool calls. Until the runtime enforcement gate ships (Fire 10), this skill's output is best-effort and should be treated as parsing assistance, not as verified citation-existence proof.

### Option C · pull from live cluster cards

Per the no-fake-cards rule (user-thinking.md §O.4), this skill could be moved from LIVE to a special "🟡 RUNTIME GAP" state on `/verticals` + `/legal` until Option A lands. This is the most-aggressive interpretation of "no fake green."

## Recommendation

Ship Option B immediately + queue Option A as the next concrete code change. Option C is a fallback if the runtime gate takes longer than expected.

The receipts ARE real chain anchors and the skill DOES produce some value (parsing + structuring) even without HTTP enforcement — but the page must NOT claim the Mata v. Avianca protection that the runtime doesn't currently enforce.

## Receipts referenced

- `https://chainscan-galileo.0g.ai/tx/0x609dc0ca60aeb0552273c8a3b4ea5564ebdb6bfd674df035737f33feb32b7109` (id 63 · all-real-citations probe)
- `https://chainscan-galileo.0g.ai/tx/0xec028e74c381b5894e5fbf059065ae0cec911a77f50329bea01b8c8c30a4d5c4` (id 64 · Mata probe)
- `https://chainscan-galileo.0g.ai/tx/0x7cdd79b67772ce4df60682fd87a82ae383b3471c1d6612bc8845724ed2198e15` (id 65 · partial-match probe)

## Date

2026-05-14 · Fire 9 of the LEGAL VERTICAL HARD-LAUNCH PIVOT directive · audit performed during the testing phase mandated by feedback_test_phase_priority_one.md memory.

---

## Update · v0.1.2 prompt-strengthening result (2026-05-14, post-publish + re-run)

After committing the "CRITICAL · YOUR FIRST OUTPUT MUST BE A TOOL CALL" prompt rewrite in v0.1.2 (commit `e4d95a9`) and publishing it on-chain (tx `0xad4974ec…` · block 33277694), re-ran the Mata-probe golden vector. New receipt anchored at on-chain id 67 (tx `0x83a322458d…` · block 33277914 · `rcpt_01KRK8PZKEQW7VRGG5BESA8BND`).

Audit of the v0.1.2 receipt:

| Metric | v0.1.0 (id 64) | v0.1.2 (id 67) | Delta |
|---|---|---|---|
| `web_fetch` prose mentions | 0 | 8 | +8 |
| `execution.toolCalls` | null | null | unchanged |
| `outputs.citations` array length | 0 | 0 | unchanged |
| Model role outputs reference web_fetch | no | yes ("Emit `web_fetch` for…") | better |

**Verdict:** prompt-strengthening moved the conversation but did NOT close the runtime gap. The 7B is now writing prose ABOUT emitting web_fetch instead of EMITTING the tool_call. The runtime never invokes the tool, never gets a tool_result, never loops.

## The deeper architectural gap (now identified)

The `apps/cli/src/commands/doc.ts` `doc ask` consensus pipeline uses a single chat-completion call per role (no tool-call loop). Even when the model emits a `tool_call` message, the runtime doesn't:

1. Detect the `tool_calls` field in the response
2. Execute the tool (despite `webFetchTool` existing at `apps/cli/src/lib/chat-tools.ts:238`)
3. Send the `tool_result` back to the model
4. Loop until the model emits no more `tool_call` messages

This is the same single-pass pattern that the interactive `chat` REPL (which DOES have tool-loop support per `apps/cli/src/lib/chat-tools.ts`) escapes. The `doc ask` consensus path needs the same loop wiring.

## Proper-fix path (revised)

The complete fix is a runtime extension across 3-4 files:

1. `packages/runtime/src/inference.ts` (or equivalent in consensus runner) — extend the chat-completion call to pass `tools: ToolDef[]` when the active skill declares `og.tools.builtins`. Handle the `tool_calls` field in the response.

2. `apps/cli/src/lib/chat-tools.ts` — export the tool-execution loop helper from the chat REPL so the consensus runner can reuse it.

3. `packages/receipts/src/build.ts` (or doc.ts receipt-assembly) — add a `toolCallTrace: ToolCallRecord[]` field to receipts when tool_calls were invoked during inference. Records timestamp + tool name + arguments + response hash per call.

4. `seed-skills/legal-citation-verifier/SKILL.md` — once runtime supports tool-loops, the existing v0.1.2 prompt becomes architecturally enforceable.

5. Re-run the 3 golden vectors against v0.1.2 (now backed by tool-loop runtime); confirm `execution.toolCalls.length > 0` AND `outputs.citations` is populated. Both signals must be true for the architecture to be considered closed.

## Honest position for testnet launch

The other 4 skills in the legal cluster (private-doc-review, contract-renewal-clause-detector, nda-triage-reviewer, term-sheet-risk-scanner) work end-to-end on the current runtime — they produce structured outputs without needing tool-call loops. The legal-citation-verifier is the only one architecturally dependent on tool-loops.

For testnet launch-readiness:
- 4 of 5 legal skills work fully end-to-end
- legal-citation-verifier currently produces parse-only output (no external verification); description in v0.1.2 SKILL.md states this honestly
- Mainnet promotion ships the runtime tool-loop extension alongside the larger model catalog

This is the honest position. Not "fully launch-ready" — "4/5 launch-ready · 1/5 architecturally documented with proper-fix runtime work queued."

## Receipts referenced (updated)

- v0.1.0 receipts: ids 63, 64, 65 (Fire 8 anchors · failure mode present)
- v0.1.2 receipt: id 67 (this audit's re-run · same failure mode after prompt-level fix · proper fix is runtime not prompt)
