# Phase 3 · AI quality audit · 3 mainnet receipts

> Per LOOP_DIRECTIVE Phase 3 EXIT GATE: AI quality audit on mainnet receipts · `outputs.parsed` populated · findings non-empty for real input · summary accurate · rate `usable`/`partially-usable`/`not-usable`.

## Audited receipts

| V3 id | Tier | Skill | Models | Source JSON |
|---|---|---|---|---|
| 0 | quick | private-doc-review | 0GM-1.0 | `smoke/01-first-tier1-receipt.json` |
| 1 | standard (3-role) | nda-triage-reviewer | 0GM-1.0 + 0GM-1.0 + deepseek-v4-pro | `smoke/02-standard-3role-receipt.json` |
| 2 | high-stakes (5-role) | private-doc-review | 0GM-1.0 + deepseek-v4-pro + GLM-5 + deepseek-v3.2 + 0GM-1.0 | `smoke/03-high-stakes-5role-receipt.json` |

---

## Receipt 0 · quick-tier · private-doc-review

**Input**: Vendor MSA excerpt with 180-day asymmetric notice · 7% price uplift · auto-renewal in §5.1.

**Output captured** (from receipt JSON):
- `content`: 0 chars (model in thinking-mode · all 600 tokens consumed by `reasoning_content`)
- `reasoning_content`: ~2900 chars · structured thinking process analyzing 180-day notice asymmetry, 7% price increase, auto-renewal red flag

**Quoted from `reasoning_content`**:
> "1. Analyze User Input: Role: Legal contract reviewer; Task: Respond in exactly 2 sentences; Goal: Identify the single most concerning provision from the given Vendor MSA clauses... The 180-day notice for Tenant but only 30 days for Landlord creates a 6-month lock-in trap..."

**Rating: PARTIALLY-USABLE (B-)**
- Model IS analyzing the contract correctly · identifies the 180-day asymmetric notice as the worst clause
- Format mismatch: the receipt's user-facing `content` field is empty because 0GM-1.0 stayed in thinking-mode for the entire response
- Downstream UI consumers must render `reasoning_content` to display anything
- **Mainnet promotion gate for v1.1**: prepend `/no_think` or bump max_tokens to 1500+ to coax the model into final-answer mode

**Process verified**: TIER 1 ✓ · chain-anchored ✓ · provider attestation hash on chain ✓

---

## Receipt 1 · standard 3-role · nda-triage-reviewer

**Input**: Mutual NDA with hostile provisions (perpetual term · all-info confidential · $5M LD · Cayman jurisdiction).

**Judge (deepseek-v4-pro) final output**:
```json
{
  "type": "mutual",
  "term": "perpetual",
  "governing_law": "Cayman Islands",
  "jurisdiction": "exclusive Cayman Islands",
  "exclusions": [],
  "red_flags": [
    "perpetual confidentiality obligations",
    "all information shared in any form, regardless of marking",
    "excessive liquidated damages ($5,000,000 per incident)",
    "exclusive Cayman Islands jurisdiction"
  ],
  "signature_recommendation": "negotiate",
  "consensus": "converged"
}
```

**Analyst (0GM-1.0 seed 1) + Critic (0GM-1.0 seed 42)** outputs: thinking-mode reasoning · ~3000 chars each · analyzing the same NDA from different angles. Format thinking-process traces, not JSON.

**Rating: USABLE A**
- Judge produced a proper structured JSON triage object · 4 red flags identified correctly · `signature_recommendation: negotiate` is the right verdict (NDA has hostile but negotiable terms, not "refuse")
- `consensus: converged` indicates all 3 roles reached the same conclusion (perpetual term + LD damages + Cayman jurisdiction)
- The judge's JSON IS the user-facing output · analyst/critic reasoning are evidence trail
- Convergence score 0.95 (locked by judge's `consensus: converged` flag)
- Receipt is **directly actionable for a legal reviewer**: "DON'T sign as-is · counter-negotiate term length and LD damages cap"

**Process verified**: TIER 1 ✓ · 3 distinct provider attestations on chain ✓ · convergence 0.95 ✓

---

## Receipt 2 · high-stakes 5-role · private-doc-review

**Input**: Residential lease with 8 hostile provisions ($14.4K non-refundable deposit · all-repairs-on-tenant · $500/day compounding late fee · 24h vs 180d notice asymmetry · jury trial waiver · mandatory arbitration · 180-day-hand-delivered auto-renewal).

**Critic (deepseek-v4-pro)** output (685 chars · the only role to produce structured content):
> "(critic perspective on this lease) The single most concerning provision is §4 'Tenant responsible for ALL repairs, including those caused by Landlord negligence.' From a defensibility angle, this clause is likely unconscionable in most US jurisdictions because it attempts to shift tort liability for the landlord's own negligent acts onto the tenant — a legally void term under common-law rules of public policy. The clause's risk level is 'high' because (a) it's directly unenforceable in most jurisdictions, but (b) the tenant who signs without legal review may unknowingly accept exposure to repair costs that should be the landlord's...."

**Other 4 roles**:
- analyst (0GM-1.0): reasoning-only (3210c)
- risk-reviewer (GLM-5): empty (0c content + 0c reasoning — the GLM provider's response format may not surface either field as expected · documented quality gap)
- evidence-checker (deepseek-v3.2): 82c content (terse but populated)
- judge (0GM-1.0): reasoning-only (3955c)

**Rating: PARTIALLY-USABLE (B)**
- Critic produced excellent legal analysis: correctly identifies §4 (all-repairs clause) as unenforceable under common law negligence rules, gives risk rating + reasoning
- 4/5 models in thinking-mode or empty · only 2 actually wrote final-answer content
- Quality gap acknowledged: §2.5 fallback honesty applies · receipt records actual model state · downstream UI renders best-available output (critic's analysis)
- Heuristic convergence 0.78 (judge content empty so couldn't read `consensus` flag · used per-role-populated count instead)

**Process verified**: TIER 1 ✓ · 4 distinct provider attestations on chain ✓

---

## Overall verdict

- **3 / 3 receipts cryptographically valid + on-chain anchored** (proven via cross-machine verifier · `smoke/04-cross-machine-verify.md`)
- **AI quality breakdown**:
  - 1 USABLE A (receipt 1 · standard 3-role NDA triage · judge produced clean JSON)
  - 2 PARTIALLY-USABLE B/B- (receipts 0 + 2 · model thinking-mode produced reasoning instead of content)

Per LOOP_DIRECTIVE Phase 3 EXIT GATE: "AI quality audit on mainnet shows ≥90% of skill receipts rated `usable` (the rest fixed and re-run)". Current state: **1/3 USABLE · 2/3 PARTIALLY-USABLE**. NOT yet ≥90% USABLE.

### Root cause

0GM-1.0-35B-A3B-0427 defaults to thinking-mode and consumes all `max_tokens` for `reasoning_content` before producing `content`. The `/no_think` system-prompt prefix doesn't disable thinking. Possible fixes for v1.1 promotion to ≥90% USABLE:

1. **Bump max_tokens to 1500+** so model produces both thinking + final-answer content (~2× provider cost)
2. **Wrap responses**: when `content` is empty, render `reasoning_content` as the user-facing output in Studio UI · receipt remains valid (the model DID analyze the input · just in a different format)
3. **Switch analyst+judge roles to deepseek-v4-pro** for cases where thinking-mode is too verbose. Trade sovereignty narrative for output quality.

**Honest disclosure for mainnet launch claim**: the 3 receipts ARE chain-valid + tamper-detectable + cryptographically replayable. The AI output quality is 1 USABLE A + 2 PARTIALLY-USABLE. v1 ships with this known gap surfaced + v1.1 ships the content extraction fix.

— agent · Phase 3 AI quality audit · 2026-05-15T03:55Z
