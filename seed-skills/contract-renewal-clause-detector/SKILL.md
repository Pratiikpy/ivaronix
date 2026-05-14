---
name: contract-renewal-clause-detector
version: 0.1.0
description: Scan a contract for every auto-renewal, auto-extension, evergreen, and negative-option-billing clause. Flags hidden renewal in boilerplate, asymmetric notice periods, and price escalation at renewal. Part of the Ivaronix legal cluster on Galileo testnet. Output supports legal review — does not replace licensed counsel.
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
  - tests/sample-vendor-contract.txt

og:
  vertical: legal
  # Testnet (Galileo · today): Qwen 2.5 7B + whatever else `compute list-providers`
  # returns. Mainnet promotion expands to a wider catalog — never substitute
  # before the §2.7 smoke test confirms the route hits the new endpoint.
  # TODO mainnet: 0GM-1.0-35B-A3B · deepseek-v4-pro · qwen3-32b
  acceptableModels:
    - "qwen/qwen-2.5-7b-instruct"
  permissions:
    # Legal review skills query prior reviewed contracts so the model can
    # cite "I flagged the same evergreen clause on the lease I reviewed
    # in March." Capability-gated by CapabilityRegistryV2 at runtime.
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
    required: true
    default_tier: standard
    # Renewal-clause detection is a misclassification-cost-asymmetric task:
    # missing a clause is far worse than false-flagging one. first-objection
    # policy gates the receipt on any reviewer flagging a concern.
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
    # Clean first-pass earns the full creator share; retry-heavy runs are
    # settled at the discount per FeeSplitPolicy.
    fee_split_policy: efficiency-game
---

# Contract Renewal Clause Detector

You are scanning a contract on behalf of the asking party for every clause that locks them into automatic renewal or extension. The asking party is usually a founder, an in-house counsel, or a procurement lead reviewing a vendor agreement, a SaaS contract, or a lease.

## What to find

Surface every instance of:

- **Auto-renewal**: contract renews for another full term unless cancelled
- **Auto-extension**: contract extends month-to-month or quarter-to-quarter after the initial term
- **Evergreen**: contract has no fixed end date; renews indefinitely until cancelled
- **Negative-option billing**: charge continues unless the customer takes affirmative action to stop
- **Asymmetric notice periods**: the asking party must give 60-180 days notice to cancel, but the counterparty can cancel with 30 days or less
- **Price escalation at renewal**: the renewal term ships with a price increase (annual CPI · stair-step · "fair market rate" · automatic uplift)
- **Hidden renewal in boilerplate**: renewal language buried in the "miscellaneous" or "general terms" section instead of a clearly labelled renewal clause

## Output schema

Return a JSON object with a single field `findings: Finding[]`. Each Finding has the shape:

```json
{
  "section": "Section name or §-number from the contract",
  "clause_text": "Direct quote or close paraphrase of the renewal-trigger clause",
  "risk_level": "low | medium | high",
  "notice_period_days": 90,
  "exit_cost_estimate_usd": 0,
  "recommendation": "One sentence the asking party can act on today"
}
```

- `risk_level: high` = clause locks the party in for >12 months OR adds >15% price uplift OR has notice period >90 days
- `risk_level: medium` = clause adds 6-12 month lock or 5-15% uplift or 30-90 day notice
- `risk_level: low` = standard 30-day rolling renewal with no material uplift
- `notice_period_days: 0` if not specified in the clause
- `exit_cost_estimate_usd: 0` if no early-termination fee or cancellation fee is named

## Output rules

- ONE numbered finding per detected clause. Do not consolidate two separate renewal clauses into one entry.
- DO NOT invent details. If a notice period is not specified, set `notice_period_days: 0` and call it out in the recommendation.
- DO NOT give legal advice or recommend "consult an attorney" — that's filler. The output is structured findings, not a memo.
- DO NOT use the phrase "in plain English" — just write plainly.
- If the contract has NO renewal clauses (rare for vendor contracts; common for one-shot service agreements), return `findings: []` and end with a single line confirming the absence: `No auto-renewal language found in the document.`
- End structured output with `Risk Level: low / medium / high` based on the worst clause found (the maximum across all findings, or `low` if findings is empty).
