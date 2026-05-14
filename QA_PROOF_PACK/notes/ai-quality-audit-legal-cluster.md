# AI Quality Audit · Legal Cluster · 2026-05-14

Per the locked `feedback_test_phase_priority_one.md` memory + the operator's hard rule "Receipt anchored ≠ output usable. Flag bad outputs in QA_PROOF_PACK/notes/ before claiming the skill ready."

Audited the actual AI output on 3 Fire 8 receipts (one per non-citation legal skill). Findings honest, not flattering.

## Methodology

Read `outputs.wording.headline` (the AI's prose) and `outputs.citations` / `outputs.findings` (the manifest-declared structured-output schema) on the disk receipt JSON for each ULID:

- `contract-renewal-clause-detector` · receipt id 55 · rcpt_01KRK5DZPFJDS0K80CDSMJZVGY
- `nda-triage-reviewer` · receipt id 58 · rcpt_01KRK5J1H8RDA9RR0KZZ1NMGXY (aggressive Cayman one-way probe)
- `term-sheet-risk-scanner` · receipt id 62 · rcpt_01KRK5WMBM0V9QW81P0XZANRG7 (aggressive Series B probe)

Compared model output against the SKILL.md "Output schema" section that names the exact JSON shape the skill should produce.

## Findings · ALL 3 SKILLS · same pattern

| Skill | Receipt | Output format | Structured array length | Findings rating |
|---|---|---|---|---|
| contract-renewal-clause-detector | /r/55 | Prose-first ("### Synthesized Judgment" header) + JSON-like blocks embedded as text | `outputs.findings`: 0 (empty) | ⚠ USABLE FOR HUMANS · NOT MACHINE-PARSEABLE |
| nda-triage-reviewer | /r/58 | Prose-first ("### Synthesized Judgment" + "**Type**: one-way" etc.) | `outputs.citations`: 0 (empty) | ⚠ USABLE FOR HUMANS · NOT MACHINE-PARSEABLE |
| term-sheet-risk-scanner | /r/62 | Mixed · starts with markdown JSON code-block, contains structured-ish content | `outputs.findings`: 0 (empty) | ⚠ USABLE FOR HUMANS · NOT MACHINE-PARSEABLE |

In all 3 cases: `outputs.riskLevel: "low"` regardless of what the AI actually wrote. That's a bug — `deriveRiskLevel` (from `@ivaronix/runtime`) is either hardcoded or defaulting · not reading the AI's actual risk classification.

## What the AI actually said (for each receipt · in prose)

### /r/55 · contract-renewal · sample-vendor-contract.txt

The AI's prose: identifies the §3.2 auto-renewal clause + §3.3 CPI/7% uplift correctly. References "Synthesized Judgment" then names "Auto-Renewal Clause" with section reference. **Did NOT identify §5.1 negative-option (the buried-in-Miscellaneous clause that was the deliberate probe).** Surface clauses found · buried clause missed.

Rating: **B for surface, F for hidden** · which matches the manifest's own honest-scope statement ("Testnet output may miss subtle clauses, production-grade scanning needs a larger model on mainnet"). 7B does what 7B does.

### /r/58 · nda-triage · sample-aggressive-one-way-nda.txt

The AI's prose: "**Type**: one-way · **Term years**: 0 · **Governing law**: Cayman Islands · **Jurisdiction**: Cayman Islands (no specific court mentioned) · **Exclusions list**: [] · **Red f[lags]:** [continues...]". 

Rating: **B+** · correctly identifies one-way, perpetual term (0 years = "no fixed end" per manifest convention), Cayman jurisdiction, empty exclusions list. The structure is reasonable; just not parseable JSON.

**Did NOT see the explicit "signature_recommendation: refuse" verdict** in the first 800 chars — would need full prose read to confirm. But the structured analysis is there in prose form.

### /r/62 · term-sheet · sample-aggressive-series-b.txt

The AI's prose starts with a markdown JSON code-block: `{ "findings": [ { "type": "liquidation_pref", "term": "In the event of any Liquidation Event, the holders of Series B Preferred Stock shall be entitled to receive, prior to a[...]"` — so the AI DID produce JSON-shaped output, but the runtime didn't parse the markdown-wrapped JSON into `outputs.findings`.

Rating: **A- for content quality, F for schema enforcement** · the model's actual JSON content is real; the runtime just can't extract it.

## Honest verdict

For **human readers** on /r/<id> who can scroll the prose: the AI's analysis is mostly correct, surface-level for the 7B. Usable for the persona it targets.

For **machine consumers** (downstream CLM/Zapier/Notion integrations that the marketplace pitches): the JSON output schema is NOT populated. `outputs.findings: []` is structurally empty for the 3 skills audited. Any downstream automation that reads `receipt.outputs.findings` to extract verdicts gets an empty array, not the AI's analysis.

This is a real launch-readiness gap if the product claims "structured AI output" anywhere on `/legal`, `/verticals`, or skill descriptions. Per the skill manifests:

- contract-renewal-clause-detector SKILL.md "Output schema" section says: "Return a JSON object with `findings: Finding[]`. Each Finding has the shape: {section, clause_text, risk_level, notice_period_days, exit_cost_estimate_usd, recommendation}"
- nda-triage SKILL.md says: "Return a JSON object with this exact shape: {type, term_years, governing_law, jurisdiction, exclusions_list, red_flags, standard_or_aggressive, signature_recommendation}"
- term-sheet-risk-scanner SKILL.md says: "Return a JSON object with `findings: Finding[]`."

The manifests promise structured output. The runtime doesn't enforce or parse it. The receipt's structured fields are empty across all 3 audited skills.

## Same shape as the Mata v. Avianca gap

This is the SAME runtime gap as legal-citation-verifier — manifest declares output contract, runtime doesn't enforce it. Different surface, same root cause: the consensus runner has no parser that extracts the model's structured output into the receipt's schema fields.

Proper fix path (similar shape to the tool-loop runtime extension):

1. **Add an output-parser to the receipt-assembly path** that extracts JSON from the AI's prose (looking for ```json ... ``` blocks or top-level JSON objects)
2. **Validate** the parsed JSON against a Zod schema declared per-skill (or generic) before writing into `outputs.findings` / `outputs.citations`
3. **Fail-closed if mandatory** — if the manifest declares an output schema and the model produced no parseable JSON, reject the run pre-anchor (same gate pattern as the web_fetch gate)
4. Fix `deriveRiskLevel` to actually read the AI's risk_level finding rather than defaulting to "low"

## What stays GREEN

- Chain anchor: green across all 4 audited skills (contract-renewal 55, nda-triage 58, term-sheet 62, citation-verifier 64). Receipts are real, signature-bound, on-chain.
- TEE attestation: green (0G Compute provider attested)
- Human-readable output on /r/<id>: usable (the prose IS the AI's analysis)
- Burner-wallet end-to-end drive: proven (Fire 9 receipt 66 + Fire 10 marketplace 3-wallet)
- Brand contract, mobile rendering: PASS

## What's NOT GREEN

- Structured output schema population: RED across the cluster (4/5 audited)
- `deriveRiskLevel` accuracy: RED (always "low")
- Machine-consumability of receipts: RED for downstream automation

## Recommendation

The skill manifests should be honest: either declare "prose output with embedded structured data, see receipt page for AI analysis" OR the runtime should parse + validate the output. Today the manifest promises structure that doesn't ship.

Honest move for testnet launch:
1. Update SKILL.md output sections to say "Output renders as prose on the receipt page. Structured JSON parsing is queued for mainnet promotion." (disclaimer · safety-net)
2. Queue a runtime parser as the proper fix (similar arc to the tool-loop extension)
3. Either fix `deriveRiskLevel` or remove `outputs.riskLevel` from the schema (it's lying)

## Date

2026-05-14 · Fire 10 of the LEGAL VERTICAL HARD-LAUNCH PIVOT directive · audit performed per the new priority order item #4 (AI quality audits are not optional · receipt anchored ≠ output usable).
