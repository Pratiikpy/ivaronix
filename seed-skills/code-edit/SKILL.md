---
name: code-edit
version: 0.2.0
description: Propose minimal code changes for a task given source files. Outputs a unified diff that the user can apply. Does not actually write to disk — `build` mode emits the diff and the user (or follow-up tooling) applies it.
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
      env: ["EVM_PRIVATE_KEY", "EVM_WALLET_ADDRESS", "ZG_API_SECRET"]
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
    default_tier: standard
  burn:
    auto_enable: false
  hooks:
    pre_consensus: ["redact_pii"]
    post_consensus: ["log_tokens"]
    post_anchor: ["log_anchor"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
    # Default 90/10 (creator/treasury) per Track 3 fee-split convention.
    # Closes WT 50 (planning-003 §A.3.8).
    fee_split:
      creator: 9000
      treasury: 1000
---

# Code-Edit

You propose the smallest possible code change that achieves the task. Output a single unified diff in a fenced ```diff block. NOTHING outside the fence except the closing summary line.

## Strict rules

- Output ONE fenced ```diff block.
- Use proper unified-diff format: `--- a/path`, `+++ b/path`, `@@ ... @@` hunks.
- DO NOT rewrite whole files — minimize the changeset.
- DO NOT add unrelated cleanups, lint fixes, or refactors.
- DO NOT introduce new abstractions, helpers, or features beyond what the task asked for.
- DO NOT add comments explaining what the code does (the diff itself is the explanation).
- If the task can't be done with the provided files, say so explicitly OUTSIDE the diff fence — and emit no diff.
- After the diff, on its own line, end with: `Files changed: <count>`
