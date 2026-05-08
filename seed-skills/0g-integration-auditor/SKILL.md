---
name: 0g-integration-auditor
version: 0.1.0
description: Audit a GitHub repo's 0G integration quality. Checks chain ID correctness, SDK version pinning, encryption pattern, receipt usage, and 0G primitive coverage. Used by the Day-21 automation that anchors 100 mainnet receipts against public 0G OSS repos.
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
tests:
  - tests/sample-package-json.json

og:
  permissions:
    memory_access: project_only
    network_access:
      - api.github.com
      - github.com
      - router-api-testnet.integratenetwork.work
      - router-api.0g.ai
    wallet_access: false
    writes_files: false
    shell_access: none
    receipt_required: true
    compute_tee_required: true
  reputation:
    on_pass: { trustScore: 2, receiptCount: 1 }
    on_fail: { trustScore: -1, violationCount: 0 }
  consensus:
    required: false
    default_tier: quick
  burn:
    auto_enable: false
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
---

# 0G Integration Auditor

You are auditing a GitHub repository for the *quality* of its 0G integration. The asking party is either the project's maintainer (wants to fix gaps before submission) or a grant judge (wants a quick scoring signal).

## What to find

Score each dimension 0-2:

1. **Chain ID hygiene** — does the repo pin to `16602` (testnet) or `16661` (mainnet)? Flag any references to stale `16601` or wrong `16600`.
2. **SDK version pinning** — are `@0glabs/0g-ts-sdk` / `@0gfoundation/0g-compute-ts-sdk` / `@0glabs/0g-serving-broker` pinned to recent versions?
3. **Solidity & EVM target** — are contracts at `0.8.20` or higher with `evmVersion: "cancun"`?
4. **Encryption pattern** — is sensitive data encrypted before 0G Storage upload (AES-256-GCM ideally)?
5. **Receipt usage** — does the repo produce verifiable Action Receipts (RECEIPTS_SPEC-compatible) for important operations?
6. **0G primitive coverage** — how many of {Compute, Storage, Chain, KV, INFT, Sealed Inference} does the repo use? More = higher score.
7. **TEE attestation** — does the repo independently verify TEE attestations via `broker.inference.processResponse`, or stop at `verify_tee: true`?

## Output rules

- One section per dimension (1-2 sentences + score 0-2).
- Cite specific files / lines / package versions when present in the input.
- DO NOT invent versions or APIs that aren't shown in the input.
- DO NOT say "great use of 0G" — be specific about what's good.
- End with two lines:
  - `Total Score: NN / 14`
  - `Verdict: PASS / WEAK / FAIL` (PASS ≥10, WEAK 5-9, FAIL <5)
