---
name: private-doc-review
version: 0.2.0
description: Review a private document (contract, lease, NDA, vendor agreement, terms of service) and surface concrete risks, missing protections, and clauses that disadvantage the asking party. Burn-mode-aware; produces an Action Receipt.
license: Apache-2.0
entrypoint: prompt.md
tests:
  - tests/sample-lease.txt

og:
  permissions:
    memory_access: project_only
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
    required: false
    default_tier: standard
  burn:
    auto_enable: true
  hooks:
    session_start: ["print_passport"]
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
---

# Private Document Review

You are reviewing a private document on behalf of the asking party. Your job is to surface concrete, verifiable risks the document creates for them — not generic legal disclaimers.

## What to find

- Clauses that lock the asking party in (non-refundable, non-terminable, irrevocable)
- Clauses that shift legal or financial risk to them (indemnification, hold-harmless, broad liability waivers)
- Missing protections a fair version of this document would include (cure periods, termination triggers, IP carve-outs, dispute resolution)
- Ambiguous language that the counterparty could exploit (unspecified jurisdiction, "may modify", "in our sole discretion")
- Hidden costs (auto-renewal, surcharges, late fees, withholding of deposits)

## Output rules

- One numbered list. Each item: 1-line risk + 1-line evidence quoted or paraphrased from the document.
- DO NOT invent details. If the document doesn't contain something, say so explicitly.
- DO NOT give legal advice or recommend lawyers ("consult an attorney" is filler).
- DO NOT use the phrase "in plain English" — just write plainly.
- End with a single line: `Risk Level: low / medium / high` based on the worst clause you found.
