---
name: term-sheet-risk-scanner
version: 0.1.1
description: Scan a Series A/B term sheet for liquidation preferences, participation rights, anti-dilution, option pool expansion, founder vesting reset, drag-along, MFN, pay-to-play, and protective provisions. Returns structured findings with founder-impact estimates. Testnet output may miss subtle terms — production-grade scanning requires a larger model on mainnet; this skill validates the pipeline today and ships with upgraded models on mainnet promotion. Output supports legal review — does not replace licensed counsel.
license: Apache-2.0
metadata:
  openclaw:
    install:
      - kind: node
        package: "@ivaronix/cli"
        bins: ["ivaronix"]
        os: ["linux", "darwin", "win32"]
        label: "Install Ivaronix CLI to run this skill"
    requires:
      env: ["IVARONIX_SIGNER_KEY", "IVARONIX_WALLET_ADDRESS", "IVARONIX_ROUTER_KEY"]
entrypoint: prompt.md
tests:
  - tests/sample-yc-safe.txt
  - tests/sample-standard-series-a.txt
  - tests/sample-aggressive-series-b.txt

og:
  vertical: legal
  # Testnet (Galileo · today): Qwen 2.5 7B + whatever else `compute list-providers`
  # returns. Mainnet promotion expands to a wider catalog — never substitute
  # before the §2.7 smoke test confirms the route hits the new endpoint.
  # The honest-note in the description above reflects that 7B-tier output will
  # miss subtle terms (e.g., the difference between weighted-average broad-based
  # and full-ratchet anti-dilution sometimes reads as the same word to a small
  # model). Production-grade scanning waits for the mainnet model upgrade.
  # TODO mainnet: 0GM-1.0-35B-A3B · deepseek-v4-pro · qwen3-32b
  acceptableModels:
    - "qwen/qwen-2.5-7b-instruct"
  # Sibling skills in the legal cluster (Galileo testnet · 2026-05-14).
  related_skills:
    - "private-doc-review"
    - "contract-renewal-clause-detector"
    - "nda-triage-reviewer"
    - "legal-citation-verifier"
  # Output schema · B-V2-46 closure. Receipt anchors with
  # `validationFailed: true` if the model emits the wrong shape.
  output_schema:
    required_keys:
      - findings
    fail_closed: false
  permissions:
    # Term-sheet review pulls the founder's prior cap-table conversations
    # from memory so the model can flag dilution drift across rounds
    # ("Series A had a 1x non-participating pref; Series B asks for 3x
    # participating — that's a 12x change in payout asymmetry"). Capability-
    # gated by CapabilityRegistryV2 at runtime.
    memory_access: all
    network_access: ["router-api-testnet.integratenetwork.work", "router-api.0g.ai"]
    wallet_access: false
    writes_files: false
    shell_access: none
    receipt_required: true
    compute_tee_required: true
    passport_min_trust: 0
  reputation:
    on_pass: { trustScore: 1, receiptCount: 1 }
    on_fail: { trustScore: -2, violationCount: 0 }
    on_violation: { trustScore: -10, locked: true }
  consensus:
    # Term sheet review is one of the directive's "required: true" skills:
    # founder-impact estimates carry multi-million-dollar consequences, so
    # consensus is non-negotiable. 5-role high-stakes tier composition
    # (analyst + critic + risk-reviewer + evidence-checker + judge) gives
    # the multi-perspective critique the dilution math actually needs.
    required: true
    default_tier: high-stakes
    # Term-sheet review is misclassification-cost-asymmetric in the same
    # shape as contract-renewal: missing a 3x participating pref is worse
    # than flagging a benign 1x non-participating clause. first-objection
    # blocks the receipt on any reviewer concern.
    policy: first-objection
  burn:
    auto_enable: true
  hooks:
    session_start: ["print_passport"]
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
    fee_split:
      creator: 9000
      treasury: 1000
    fee_split_policy: efficiency-game
---

# Term Sheet Risk Scanner

You are reviewing a Series A or Series B venture term sheet on behalf of a founder. The founder is weighing the offer against the alternative of walking away, raising at a different valuation, or pushing back on individual terms. Your output is the structured pre-counsel scan that a founder uses to decide which clauses are worth negotiating, which are deal-breakers, and which are market-standard.

## What to find

Surface every instance of each named risk category that appears in the term sheet:

- **liquidation_pref** — the multiple and structure of preferred-share payout at exit. Look for: "1x non-participating", "2x participating", "3x participating with no cap", "1x non-participating with a participation cap of 3x"
- **participation** — whether preferred shares both take the pref AND share in the remainder. "Non-participating" means pref OR common; "participating" means pref AND common; "capped participation" caps the upside
- **anti_dilution** — what triggers when the next round is a down-round. Look for: "weighted-average broad-based" (founder-friendly · market-standard), "weighted-average narrow-based" (less friendly), "full-ratchet" (founder-hostile)
- **option_pool** — size of the option pool and whether it expands the pre-money (dilutive to founders) or post-money (dilutive to investors). "10% pre-money option pool" is dilutive to founders specifically
- **founder_vesting** — vesting acceleration, single-trigger vs double-trigger, founder vesting reset clauses on any new round. "4-year with a 1-year cliff and single-trigger acceleration on change of control" is founder-friendly; "4-year reset with no acceleration" is investor-friendly
- **drag_along** — investors' right to force founders to sell in a future round. Market-standard requires majority preferred consent; aggressive versions let any single lead investor force the sale
- **mfn** — "most-favored-nation" clauses extending later-round terms backward to this round. Common on SAFE notes; rare on Series A/B
- **pay_to_play** — penalties (typically conversion of preferred to common) for investors who don't participate in future rounds. Founder-friendly because it prevents passive existing investors from blocking dilutive rounds the founder needs
- **protective_provisions** — list of decisions that require preferred consent (board composition · option pool · debt · M&A). Standard is a short list; aggressive versions include hiring decisions and budget thresholds

## Output schema

Return a JSON object with `findings: Finding[]`. Each Finding has the shape:

```json
{
  "type": "liquidation_pref | participation | anti_dilution | option_pool | founder_vesting | drag_along | mfn | pay_to_play | protective_provisions",
  "term": "Direct quote from the term sheet",
  "comparison_to_standard": "where this sits vs market norms · use the exact words 'founder-friendly' | 'standard' | 'investor-friendly' | 'founder-hostile'",
  "founder_impact_estimate": "$1.2M payout reduction at a $50M exit · 4% dilution at the next round · 18 months added to liquidity timeline · one-line concrete estimate",
  "negotiation_recommendation": "one-line action: 'push back on participation cap' | 'accept as market-standard' | 'deal-breaker · walk if not changed'"
}
```

- `comparison_to_standard` MUST be one of the four named values. "Slightly aggressive" is not allowed; pick the closest of the four.
- `founder_impact_estimate` MUST contain at least one concrete unit ($, %, months). "Unfavorable" without a number is filler.
- `negotiation_recommendation` MUST start with an imperative verb (push, accept, walk, reject, redline).

End structured output with `Worst term: <type>` naming the single most-founder-hostile clause found, or `Worst term: none` if every clause is founder-friendly or standard.

## Output rules

- DO NOT invent details. If a term sheet doesn't specify a participation cap, write `"comparison_to_standard": "standard"` and call it out in the recommendation — do not assume "uncapped."
- DO NOT give legal advice. Output is structured findings, not a memo.
- DO NOT use "in plain English" or "consult an attorney" as filler.
- DO NOT add fields not in the schema. Extra fields break downstream UI parsing.
- If the term sheet is a SAFE (no Series A/B structure): only `mfn`, `option_pool` if mentioned, and `protective_provisions` if mentioned are applicable. Return findings for those; for the remaining categories return nothing (do not invent SAFE-incompatible findings).

## Honest scope (testnet · Qwen 2.5 7B)

The 7B model catches obvious aggressive terms — 3x participating, full-ratchet, broad protective provisions. It will miss subtle ones: the difference between weighted-average broad-based and narrow-based anti-dilution sometimes reads as the same word to a small model, and clauses buried in protective-provisions schedules (rather than the main term sheet body) are easy to miss. When the testnet model misses a finding, the receipt is honest about it — the manifest's `description` field carries the testnet-output-limitation disclaimer that the UI surfaces alongside every receipt for this skill. Production-grade scanning ships on mainnet promotion with a larger model.
