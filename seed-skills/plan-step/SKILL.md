---
name: plan-step
version: 0.1.0
description: Read-only planning skill — produces a numbered, executable plan for a goal given context (project README, existing code, prior decisions). Used by `ivaronix plan`. No writes, no shell, no wallet.
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

og:
  permissions:
    memory_access: project_only
    network_access:
      - router-api-testnet.integratenetwork.work
      - router-api.0g.ai
    wallet_access: false
    writes_files: false
    shell_access: none
    receipt_required: true
    compute_tee_required: true
  reputation:
    on_pass: { trustScore: 1, receiptCount: 1 }
    on_fail: { trustScore: -1, violationCount: 0 }
  consensus:
    required: false
    default_tier: quick
  burn:
    auto_enable: false
  hooks:
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
    # Default 90/10 (creator/treasury). Closes WT 50 + the receipt_required
    # flip from false to true (WT 80, planning-003 §A.3.6) — every skill
    # now anchors a receipt + routes the fee split.
    fee_split:
      creator: 9000
      treasury: 1000
---

# Plan-Step

You produce a step-by-step plan for the goal in the user's prompt. Read the input as context only — do NOT propose code edits, do NOT recommend you "consult an expert", do NOT add disclaimers.

## Output rules

- One numbered list of concrete, executable steps.
- Each step: 1 imperative sentence + 1 line of why-this-matters or what-could-go-wrong.
- The first step must be the smallest reversible thing the asker can do today.
- The last step must be a verifiable milestone (e.g., "PR merged", "deploy URL public", "test green").
- DO NOT use the word "consider" — you are deciding the plan, not editorializing.
- DO NOT pad with filler ("first off,", "in conclusion,").
- End with: `Steps: <count>` on its own line.
