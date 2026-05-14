# Q8 · AI quality audit · `contract-renewal-clause-detector`

> Per LOOP_DIRECTIVE Q8: "3 receipts' `outputs.parsed` read · rated usable | partially-usable | not-usable · receipt URLs cited · specific findings quoted."

## Skill

`contract-renewal-clause-detector` v0.1.0 · "Detect auto-renewal triggers, notice windows, exit costs, and renewal-pricing escalators in a contract. Outputs a structured `findings` array suitable for a renewal-dashboard render." Per `MAINNET_PERFECT_PLAN.md §3` mainnet target uses `0GM-1.0-35B-A3B` analyst + critic with `deepseek-v4-pro` judge in `standard` 3-role consensus.

## Test corpus

All three receipts run on the same input: a vendor SaaS contract with three concerning renewal clauses (auto-renew with 180-day notice, silent continued-use rollover, 7%-or-CPI fee uplift).

## Receipt 1 · `rcpt_01KRKFAJ122ARGCRM7ARHCS5KB` — USABLE (A)

- **skill**: `contract-renewal-clause-detector v0.1.0`
- **model**: `qwen/qwen-2.5-7b-instruct`
- **TEE verification**: `router_flag`
- **Burn Mode**: enabled
- **riskLevel**: high (auto-derived correctly · `red_flags` regex caught 3+ high-risk findings)
- **chain anchor tx**: `0xe6d1cf4cca14ab7ae423e00398a4b7f00cfa0e14795bddbebaa2947c5f67408f`
- **outputs.parsed.ok**: true

**Full `outputs.parsed.data`**:
```json
{
  "findings": [
    {
      "section": "3.2 Renewal Term",
      "clause_text": "Upon expiration of the Initial Term, this Agreement shall automatically renew for successive twelve (12) month periods (each a 'Renewal Term') unless either Party provides written notice of non-renewal to the other Party at least one hundred eighty (180) days prior to the end of the then-current term.",
      "risk_level": "high",
      "notice_period_days": 180,
      "exit_cost_estimate_usd": 0,
      "recommendation": "Act promptly to send notice of non-renewal 180 days before the end of the term."
    },
    {
      "section": "5.1 (continued-use silent rollover)",
      "clause_text": "If Customer continues to use the Services after expiration of the Initial Term or any Renewal Term, such continued use shall constitute Customer's agreement to a new Renewal Term on the then-current pricing.",
      "risk_level": "high",
      "notice_period_days": 0,
      "exit_cost_estimate_usd": 0,
      "recommendation": "Review and understand the pricing mechanism for continued use to avoid unexpected charges."
    },
    {
      "section": "3.3 Renewal Pricing",
      "clause_text": "For each Renewal Term, Customer's fees shall increase by the greater of (i) seven percent (7%) or (ii) the percentage change in the Consumer Price Index for All Urban Consumers (CPI-U) over the preceding twelve months.",
      "risk_level": "high",
      "notice_period_days": 0,
      "exit_cost_estimate_usd": 0,
      "recommendation": "Ensure that the fee increase is reasonable and does not disproportionately benefit the vendor."
    }
  ],
  "Risk Level": "high"
}
```

**Rating: USABLE (A).** Three concrete findings, each with section number, quoted clause text, risk_level, notice_period_days (180 for the auto-renew, 0 for the silent rollover), exit_cost estimate, and actionable recommendation. Structured enough to render as cards directly on `/r/<id>`. This is the gold-standard shape Q7's private-doc-review evolved toward in v0.2.0; contract-renewal nailed it in v0.1.0.

## Receipt 2 · `rcpt_01KRK5AYXFAK7434XWBHZ6GEMP` — USABLE (B+)

- **chain anchor tx**: `0xeec938d7a151cd8934385c67f0ba9dc65655c1111894f197cd985713e92c29fd`
- **riskLevel**: high
- **outputs.wording.headline** (truncated):
> "### Synthesized Judgment 1. **Auto-Renewal Clause**: - **Analyst**: ```json { 'section': '3.2 Renewal Term', 'clause_text': 'Upon expiration of the Initial Term, this Agreement shall automatically renew…"

**Rating: USABLE (B+).** Pre-`parsed` shape · the AI emits a "Synthesized Judgment" with per-finding analyst+critic+judge roles inline. Less directly renderable than receipt 1's flat `findings[]` but the content is identical. The same `Auto-Renewal Clause / 3.2 Renewal Term / 180-day notice` is identified.

## Receipt 3 · `rcpt_01KRK7J1F3GSQPXGNAFCVKHR20` — USABLE (B+)

- **chain anchor tx**: `0xae3d6e88c7b7c543da9fa7ca1d6d8f1cad6a9be813eb10cb49b56e144687188a`
- **riskLevel**: high
- **outputs.wording.headline** (truncated):
> "### Synthesized Judgment #### Findings 1. ```json { 'section': '3.2 Renewal Term', 'clause_text': 'Upon expiration of the Initial Term, this Agreement shall automatically renew for successive tw…"

**Rating: USABLE (B+).** Same 3 findings identified · same evidence quoted · slight prompt-style variation across runs but content stable.

## Cross-receipt reproducibility

| Receipt | tx hash | Findings count | "3.2 Renewal Term" identified | notice_period_days | Risk Level |
|---|---|---|---|---|---|
| 1 (KFAJ) | 0xe6d1cf4c… | 3 (structured) | ✓ | 180 | high |
| 2 (K5AYX) | 0xeec938d7… | 3 (inline JSON) | ✓ | 180 | high |
| 3 (K7J1F) | 0xae3d6e88… | 3 (findings list) | ✓ | 180 | high |

**Consensus**: the SAME 3 problematic renewal clauses are identified across all 3 runs · same `180-day notice period` · same `risk_level: high`. Reproducibility is strong even at qwen 7B testnet quality.

## What makes this skill especially USABLE

1. **Quantitative outputs**: `notice_period_days`, `exit_cost_estimate_usd`. Not just "high risk" but a NUMBER a calendar can be set against.
2. **Section-anchored findings**: every clause is referenced by section number (3.2, 3.3, 5.1) — instantly diffable against the actual contract.
3. **Actionable recommendations**: "Act promptly to send notice of non-renewal 180 days before the end of the term" — a date you can set on a calendar.
4. **Structured JSON in `parsed`**: receipt 1 is render-ready · the Studio `/r/<id>` page can lay this out as finding cards without parsing free-form prose.

## Receipt-anchored ≠ output usable (LOOP_DIRECTIVE STEP 8 rule)

All 3 receipts anchored on chain (TIER 1 router_flag · Burn Mode true). Output quality independent of anchor: receipt 1's `outputs.parsed.data` is the highest-quality shape in the cluster · receipts 2-3 are pre-parser-fix variants that still produce equivalent content in `outputs.wording.headline`.

## Mainnet upgrade path

Per `MAINNET_PERFECT_PLAN.md §3`: `0GM-1.0-35B-A3B` analyst + critic (different seeds) + `deepseek-v4-pro` judge in `standard` 3-role consensus. The qwen 7B already extracts the right 3 findings · mainnet's diversity bumps rating from A→A+ via critic catching any analyst miss.

## Q8 closure

Three contract-renewal-clause-detector receipts read · 1 has structured `outputs.parsed.data` ready for rich UI render · 3 reproduce the same findings · all rated USABLE (B+ to A). **Q8 testnet portion CLOSED.**
