---
name: code-edit
version: 0.1.0
description: Propose minimal code changes for a task given source files. Outputs a unified diff that the user can apply. Does not actually write to disk — `build` mode emits the diff and the user (or follow-up tooling) applies it.
license: Apache-2.0
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
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
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
