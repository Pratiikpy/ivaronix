---
name: ivaronix
version: 0.0.1
description: Install Ivaronix as an OpenClaw skill. Gives any OpenClaw agent the ability to produce verifiable Action Receipts anchored on 0G Chain, run consensus audits, and read/write encrypted memory with on-chain capability grants.
license: Apache-2.0
entrypoint: README.md
homepage: https://ivaronix.app
repository: https://github.com/Pratiikpy/ivaronix

# OpenClaw native contract (skills-install reads this).
# Schema: src/agents/skills/types.ts → SkillInstallSpec.kind ∈ brew|node|go|uv|download.
metadata:
  openclaw:
    emoji: "🦞"
    homepage: https://ivaronix.app
    os: ["darwin", "linux", "win32"]
    requires:
      bins: ["ivaronix"]
      env: ["EVM_PRIVATE_KEY", "ZG_API_SECRET", "ZG_SERVICE_URL"]
    install:
      - id: node
        kind: node
        package: "@ivaronix/cli"
        bins: ["ivaronix"]
        label: "Install Ivaronix CLI (npm/pnpm/yarn/bun -g)"
      - id: github-release
        kind: download
        url: "https://github.com/Pratiikpy/ivaronix/releases/latest/download/ivaronix-cli.tar.gz"
        archive: "tar.gz"
        extract: true
        stripComponents: 1
        bins: ["ivaronix"]
        label: "Install Ivaronix CLI (GitHub release tarball)"

# Ivaronix-native extension (read by our runtime; OpenClaw ignores unknown keys).
og:
  permissions:
    memory_access: project_only
    network_access:
      - router-api-testnet.integratenetwork.work
      - router-api.0g.ai
      - evmrpc-testnet.0g.ai
      - evmrpc.0g.ai
    wallet_access: true
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
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
---

# Ivaronix — for OpenClaw

Ivaronix turns any AI action into a verifiable receipt anchored on 0G Chain. This OpenClaw skill exposes the Ivaronix runtime so OpenClaw agents can:

- **Ask any installed skill** → get an answer + signed receipt
- **Verify a receipt** → resolve by on-chain id / receiptRoot, report `pending` / `verified` / `mismatch`
- **Read passport state** → trust score, receipt count, agent profile
- **List the catalog** → 80+ first-party + ported skills

## Install

```bash
openclaw skills install ivaronix
```

## Use

```bash
# Run a skill (default: testnet 16602)
openclaw run ivaronix.ask \
  --skill private-doc-review \
  --question "what is the worst clause" \
  --content @lease.txt

# Verify a receipt
openclaw run ivaronix.verifyReceipt --id 18

# Show a passport
openclaw run ivaronix.passportShow --wallet 0xaa954c33810029a3eFb0bf755FEF17863E8677Ce
```

## Configuration

`.env` (loaded from cwd or any parent):

```
EVM_PRIVATE_KEY=0x…           # Wallet that signs receipts
ZG_API_SECRET=…               # 0G Router API key
ZG_SERVICE_URL=…              # 0G Router endpoint
OG_COMPUTE_PROVIDER=…         # Compute provider address
OG_NETWORK=testnet            # flip to `mainnet` after USER_TODO §B-V2 redeploy lands
```

## Why Ivaronix is different

Other agent runtimes give you outputs. Ivaronix gives you **outputs + a receipt**. Every receipt carries:

- The skill id + version + on-chain manifest hash
- The TEE attestation reference for the inference
- The convergence score from multi-role consensus
- A signature recoverable to the calling wallet
- An anchor on 0G Chain (block, tx, on-chain id)

You can hand a receipt URL to anyone — they verify it themselves with `ivaronix receipt verify --tee-independent` (no daemon, no Ivaronix login). That's the "**proof of provenance**" baseline OpenClaw + Ivaronix gives every action.

## What ships in v0.0.1

- 5 first-party skills (private-doc-review, github-audit, 0g-integration-auditor, plan-step, code-edit)
- 75 imports from awesome-claude-skills (composio + curated top-level)
- 5 MCP tools so non-OpenClaw agents (Claude Desktop, Cursor, Codex) can also call into the runtime
- Studio web app at /global / /skills / /r/<id> / /agent/<wallet> for human-readable proof URLs
