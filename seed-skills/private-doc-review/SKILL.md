---
name: private-doc-review
version: 0.4.0
description: Review a private document (contract, lease, NDA, vendor agreement, terms of service) and surface concrete risks, missing protections, and clauses that disadvantage the asking party. Anchor of the Ivaronix legal cluster on Galileo testnet. Output supports legal review — does not replace licensed counsel.
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
      # Lead with canonical IVARONIX_* per packages/runtime/src/env.ts; legacy aliases still resolve.
      env: ["IVARONIX_SIGNER_KEY", "IVARONIX_WALLET_ADDRESS", "IVARONIX_ROUTER_KEY"]
entrypoint: prompt.md
tests:
  - tests/sample-lease.txt

og:
  vertical: legal
  # Testnet (Galileo · today): Qwen 2.5 7B + whatever else `compute list-providers`
  # returns. Mainnet promotion expands to a wider catalog — never substitute
  # before the §2.7 smoke test confirms the route hits the new endpoint.
  # TODO mainnet: 0GM-1.0-35B-A3B · deepseek-v4-pro · qwen3-32b
  acceptableModels:
    - "qwen/qwen-2.5-7b-instruct"
  permissions:
    # planning-003 §A.4.8: doc-review queries the user's prior memory for
    # related context (e.g. "I reviewed a similar lease 3 months ago and
    # flagged the same auto-renew clause"). The encrypted MemoryEngine
    # gates by-grant via CapabilityRegistry, so 'all' is the breadth this
    # skill needs at the manifest layer; the actual capability check
    # happens at runtime against the caller's scope.
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
    required: false
    default_tier: standard
    # planning-003 §A.4.4 zer0Gig Efficiency Game: legal-review is the
    # canonical "any reject blocks" surface. Studio Run panel can still
    # override this per-run via the "How strict?" dropdown.
    policy: first-objection
  burn:
    auto_enable: true
  hooks:
    session_start: ["print_passport"]
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
    # Track 3 (Agentic Economy) settlement: 90% of every doc-review fee
    # routes to the creator, 10% to the protocol treasury. Recorded on
    # every skill_exec receipt as `billing.feeSplit` (BigInt-precise).
    fee_split:
      creator: 9000
      treasury: 1000
    # planning-003 §A.4.4: opt into the efficiency-game policy so a
    # clean first-pass earns the full creator share (95% of declared)
    # while a retry-heavy run is settled at 85%, and a failed run
    # routes 100% to treasury. Inverts the incentive — skills get
    # paid for being right the first time.
    fee_split_policy: efficiency-game
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
