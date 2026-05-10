# Ivaronix — High-Level Design

> **Status:** v3 (full Nexus vision, locked 2026-05-07).
> **Companion docs:** `PRD.md` (what & why), `docs/build/BUILD.md` (30-day plan), `RECEIPTS_SPEC.md` (canonical schema), `docs/reference/REFERENCE_PATTERNS.md` (patterns), `docs/pitch/PITCH.md`.
> **Rule:** this doc holds *architecture*. No re-statements of MVP scope (that's PRD). No SDK quirks (that's BUILD). No receipt-shape bikeshedding (that's RECEIPTS_SPEC).

---

## 1. System Surfaces

| # | Surface | Audience | Lives where |
|---|---|---|---|
| 1 | **Studio** (web app, primary) | Users, teams, judges | `apps/studio` (Next.js 15 on Vercel) |
| 2 | **Forge CLI** | Developers, power users | `apps/cli` (Node 20 + TypeScript binary) |
| 3 | **HTTP API** | Builders, integrators | `apps/api` (Next.js / Vercel) |
| 4 | **MCP server** | Claude Desktop, Cursor, OpenCode users | `apps/mcp-server` (stdio-mode tools) |
| 5 | **npx CLI shim** | One-shot reviewers, judges | `apps/npx-cli` (`npx @ivaronix/run`) |
| 6 | **OpenClaw skill** | OpenClaw users | `apps/openclaw-skill` (manifest + scripts) |
| 7 | **Telegram bot** | Mobile / chat-native users | `apps/telegram-bot` (long-poll worker) |
| 8 | **Skill Registry browser** | Skill creators, ecosystem | `apps/studio/app/skills/*` (page in Studio, no separate app) |

All surfaces are real today. There is no separate `apps/skill-store` (the registry lives inside Studio at `/skills`), no `apps/forge-daemon` (Studio talks to chain/storage/router directly via `packages/og-toolkit` + `packages/runtime` from server actions and route handlers), and no `apps/worker` (long-running jobs run via `scripts/wander-cycle/` for now and graduate to a worker app only when receipt volume justifies it). The shared SDK surface is `packages/og-toolkit` (chain/storage/router clients) + `packages/runtime` (`runPipeline`); the earlier `packages/sdk` ghost dir is gone.

---

## 2. Top-Level Architecture

```
┌────────────────────────┐         ┌────────────────────────┐
│      User Wallet       │         │   Skill Creator Wallet │
└─────────┬──────────────┘         └────────────┬───────────┘
          │ signs receipts                      │ publishes skills
          │                                     │
          ▼                                     ▼
┌────────────────────┐  ┌─────────────────┐ ┌────────────────┐
│  Studio (Next.js)  │  │   Forge CLI     │ │  OpenClaw +    │
│  - drop zone       │  │   - 7 modes     │ │  MCP server +  │
│  - skill browser   │  │   - TUI shell   │ │  Telegram +    │
│  - report viewer   │  │   - SDK in-proc │ │  npx CLI       │
│  - proof URLs      │  │                 │ │                │
│  - passport pages  │  │                 │ │                │
└─────────┬──────────┘  └────────┬────────┘ └────────┬───────┘
          │                      │                   │
          │ in-proc (server      │ in-proc           │ HTTP / stdio
          │ actions + SDK)       │                   │
          ▼                      ▼                   ▼
       ┌──────────────────────────────────────────────────┐
       │     packages/sdk + packages/runtime              │
       │  - skill runtime + sandbox                       │
       │  - policy engine + safety guard                  │
       │  - lifecycle hooks dispatcher                    │
       │  - 5-role consensus orchestrator                 │
       │  - hybrid memory engine (vector+graph+FTS+KV)    │
       │  - receipt builder + signer                      │
       │  - 0G Router / Storage / Chain clients           │
       └────┬───────────┬─────────────────┬───────────────┘
            │           │                 │
            ▼           ▼                 ▼
   ┌────────────┐ ┌────────────┐ ┌────────────────────────┐
   │ 0G Router  │ │ 0G Storage │ │ 0G Chain (mainnet 16661│
   │ TEE infer  │ │ encrypted  │ │  testnet 16602)        │
   │ + sealed   │ │ artifacts  │ │ - ReceiptRegistry      │
   │ inference  │ │ + receipts │ │ - AgentPassportINFT    │
   └────────────┘ │ + memory   │ │ - CapabilityRegistry   │
                  │ + skills   │ │ - MemoryAccessLog      │
                  │ + KV       │ │ - SkillRegistry        │
                  └────────────┘ │ - Erc7857Verifier      │
                                  └─────────────┬──────────┘
                                                │
                                                ▼
                                  ┌────────────────────────┐
                                  │  Hub / Public Pages    │
                                  │  (in apps/studio)      │
                                  │  - /r/<receipt-id>     │
                                  │  - /@<handle>          │
                                  │  - /skill/<id>         │
                                  │  - /global             │
                                  └────────────────────────┘
```

**Key invariants:**
- **The runtime never holds wallet keys.** Wallet signs in user's environment (Studio: WalletConnect/wagmi; CLI: keystore). The runtime orchestrates; the user's wallet attests.
- **Router API key stays server-side** (in `apps/api` / Studio server actions). Studio NEVER ships Router credentials to the browser — every Router call goes through a server route handler that holds the key.
- **Storage uploads & chain anchors are deterministic side-effects of receipt creation.** User issues one action → all artifacts produced.
- **Hub pages read from chain + storage**, never from a daemon. The /r/<id>, /@<handle>, /skill/<id>, /global pages each call `packages/og-chain` + `packages/og-storage` from server components. They keep working forever as long as the chain is up. SEO-friendly.
- **Studio and CLI share `packages/sdk`** so behavior is identical across surfaces.

---

## 3. Monorepo Layout

```
ivaronix/
├── apps/
│   ├── studio/                       # Next.js 15 web app — PRIMARY SURFACE
│   │   ├── app/                      # /, /r/<id>, /@<handle>, /skill/<id>, /global
│   │   ├── components/
│   │   │   ├── DropZone.tsx
│   │   │   ├── SkillBrowser.tsx
│   │   │   ├── AuditReportView.tsx
│   │   │   ├── ProofExplorer.tsx
│   │   │   ├── PassportProfile.tsx
│   │   │   └── MemoryPermissionCenter.tsx
│   │   └── lib/                      # uses packages/sdk
│   ├── cli/                          # `ivaronix` binary (Node 20 + TypeScript)
│   ├── api/                          # public OpenAI-compatible HTTP API + Nexus extensions
│   ├── mcp-server/                   # MCP tools (5+ tools, stdio mode)
│   ├── npx-cli/                      # `npx @ivaronix/run` one-shot shim
│   ├── openclaw-skill/               # `openclaw skills install ivaronix` package
│   └── telegram-bot/                 # long-poll Telegram bot worker
├── packages/
│   ├── core/                         # shared types, ULID, canonicalization
│   ├── og-chain/                     # 0G Chain client (ethers v6)
│   ├── og-storage/                   # 0G Storage TS SDK wrapper
│   ├── og-router/                    # 0G Router OpenAI-compatible client
│   ├── og-kv/                        # 0G Storage KV pointer helpers
│   ├── receipts/                     # build, sign, anchor, verify (RECEIPTS_SPEC)
│   ├── skills/                       # loader, sandbox, scanner, manifest validator
│   │   ├── adapters/
│   │   │   ├── awesome-claude-skills.ts  # parse SKILL.md → Ivaronix manifest
│   │   │   ├── mcp.ts                # MCP server → skill wrapper
│   │   │   └── openclaw.ts           # openclaw.json → manifest
│   │   ├── sandbox/                  # PATH allowlist, cwd jail, network filter
│   │   └── scanner/                  # prompt injection / secret leak / wallet drain detectors
│   ├── memory/                       # hybrid memory engine
│   │   ├── vector.ts                 # HNSW index
│   │   ├── temporal-graph.ts         # Graphiti-style temporal facts
│   │   ├── fts.ts                    # better-sqlite3 + FTS5
│   │   └── kv.ts                     # 0G KV pointer mirror
│   ├── consensus/                    # 5-role orchestrator + convergence + judge
│   ├── policy/                       # safety guard, allowlists, gates
│   ├── orchestrator/                 # plan/build/audit/doc/swarm/watch modes
│   ├── tui/                          # OpenCode-style terminal UI (ink)
│   ├── hooks/                        # lifecycle hooks dispatcher
│   ├── sdk/                          # public SDK consumed by Studio + CLI + API + OpenClaw + MCP
│   ├── og-toolkit/                   # clean DX wrappers around @0gfoundation/* + @0glabs/0g-serving-broker
│   │   │                              # — quiet moat: every 0G app eventually depends on these wrappers,
│   │   │                              # and our wrappers default to producing receipts
│   │   ├── storage.ts                # cleaner ZgFile + indexer.upload + peekHeader API
│   │   ├── compute.ts                # cleaner Router client + processResponse helper
│   │   ├── chain.ts                  # cleaner ethers v6 contract bindings + receipt helpers
│   │   └── index.ts                  # one-import surface: createOg({ network: "testnet" | "mainnet" })
│   └── ui/                           # shadcn/ui shared components for Studio
├── contracts/                        # Foundry workspace
│   ├── src/
│   │   ├── ReceiptRegistry.sol
│   │   ├── AgentPassportINFT.sol     # ERC-7857
│   │   ├── Erc7857Verifier.sol
│   │   ├── CapabilityRegistry.sol
│   │   ├── MemoryAccessLog.sol
│   │   └── SkillRegistry.sol
│   ├── test/                         # forge test
│   └── script/                       # forge script for deploys
├── schemas/
│   ├── receipt-v1.json               # JSON-schema (see RECEIPTS_SPEC)
│   └── skill-manifest-v1.json
├── seed-skills/                      # 50+ ports from awesome-claude-skills
│   ├── code-review/
│   ├── security-audit/
│   ├── contract-review/
│   ├── threat-modeling/
│   ├── type-design-analyzer/
│   ├── comment-analyzer/
│   ├── github-audit/
│   └── ... (50+ total)
├── scripts/
│   ├── deploy-testnet.ts
│   ├── deploy-mainnet.ts
│   ├── port-awesome-claude-skills.ts # day-14 mass-port script
│   ├── automate-receipts-testnet.ts  # 100 testnet receipts
│   └── automate-receipts-mainnet.ts  # 100 mainnet receipts
└── docs/                             # PRD/HLD/BUILD/RECEIPTS_SPEC/REFERENCE_PATTERNS/PITCH
```

**License posture:**
- OpenCode (MIT), Hermes (MIT), Octogent (MIT) → may copy code with attribution
- awesome-claude-skills (Apache-2.0) → port skills with notices preserved in `seed-skills/<skill>/LICENSE`
- claude-mem (AGPL-3.0) → **design reference only; do not copy code**

---

## 4. Studio Architecture (apps/studio)

The web app is the primary user surface. Treat polish as a first-class deliverable.

> **For visual design decisions** (colors, typography, spacing, logo, motion, a11y, responsive breakpoints, Playwright workflow): read `UI_UX_GUIDE.md` FIRST. The bundled `brand/Ivaronix.html` mockup is the visual source of truth — open it in a browser before writing any Studio code.
>
> **For per-component UX decisions** (drop-zone four-light row, audit report layout, skill browser permission pills, public Proof URL tile strip, etc.): read `COMPONENTS.md`.
>
> This section covers the structural skeleton; `UI_UX_GUIDE.md` and `COMPONENTS.md` are the sources of truth for "what should it look and feel like?"

### 4.1 Pages
| Route | Purpose | Component spec |
|---|---|---|
| `/` | Drop-zone hero with one input field; collapses to four-light status row on submit | `COMPONENTS.md §2` |
| `/onboard` | 5-row stepper (wallet → fund → handle → mint passport → first run) | `COMPONENTS.md §1` |
| `/skills` | Single-page browser, sticky left-rail categories, sandbox-preview button | `COMPONENTS.md §4` |
| `/skill/<id>` | Header → live demo box → receipt feed → reputation row → SKILL.md | `COMPONENTS.md §5` |
| `/r/<receipt-id>` | Public Proof URL; banner + input/output columns + 4-tile receipt strip; no-auth | `COMPONENTS.md §6` |
| `/@<handle>` | Passport profile: header + receipt feed + 6-axis radar + milestone log | `COMPONENTS.md §7` |
| `/memory` | Memory PC (auth): tabs for Memories / Permissions / Access Log | `COMPONENTS.md §8` |
| `/global` | Sparse honest dashboard: live counters, top-10 skills/agents, scrolling receipt ticker | `COMPONENTS.md §9` |
| `/dashboard` | User home (auth): recent receipts, installed skills, passport overview | (standard list/card) |

### 4.2 Cross-cutting visual language

**The Four-Light Row** — used everywhere the system is "doing 0G work":

```
[●─Storage─][●─Compute─][●─TEE─][●─Chain─]
```

Same chip set in CLI ANSI, Studio React, OG-images, Twitter cards, public Proof URL. Each chip can be:
- **Pending** — amber, dashed border
- **Active** — pulsing color (per layer: storage=teal, compute=violet, TEE=purple, chain=blue)
- **Verified** — solid green
- **Mismatch** — red with diff panel

This is `apps/studio/src/components/FourLightRow.tsx` (Studio uses it directly; the CLI ANSI rendering ports the same chip set in-place). **Used as a status surface, a verification surface, AND a hero animation.** One component, three uses.

**Receipt state chips** — exactly 3 states surfaced everywhere a receipt appears:

| State | Color | Meaning |
|---|---|---|
| Pending | amber, dashed | root computed, not yet anchored |
| Verified | solid green | storage + chain + TEE all verified |
| Mismatch | red, with diff panel | one of the three checks failed |

See `COMPONENTS.md §12` for the full verify-UX. CLI exit codes match: 0 / 1 / 2.

**Burn Mode visual delta** — when burn mode is on:
- Storage light = purple instead of teal
- TEE light pulses faster
- Status line says `burn · tee-sealed`
- Receipt page renders a red lock chip "Input not retained"
- Storage row reads `n/a — burn mode` instead of a hash

See `COMPONENTS.md §14`.

**Consensus output** — top banner (`Consensus 0.87 · Policy: 2-of-3 majority · 3 reviewers`) + per-reviewer card grid + bottom Disagreement Summary when score < 0.85. See `COMPONENTS.md §15`.

### 4.3 Component model
- shadcn/ui primitives (Button, Card, Dialog, Tabs, Toast, Toaster).
- Tailwind v4 with `@theme inline` for custom palette + dark mode (default).
- Cross-cutting components live in `apps/studio/src/components/` (`FourLightRow`, `ReceiptStateChip`, `PermissionPills`, `MemoryNotesPanel`, `MemoryPanel`, `RunPanel`, `ShareButton`, `Section`, `Header`, `Footer`, `MobileMenu`, `WalletConnect`, `Logo`). The earlier `packages/ui` directory was an empty placeholder; consolidating into `apps/studio/src/components/` reflects current reality.
- Drop zone: react-dropzone wrapped in shadcn Card; expands full-bleed; collapses to left-rail status pane on submit.
- Audit report: 3-stack layout (verdict banner → badge row → per-agent card grid).
- Public Proof URL page: print-friendly; OG-image auto-generates verdict banner.

### 4.4 State + auth
- WalletConnect (wagmi + viem) for wallet auth. SIWE for backend session.
- Server actions for all mutations (Next.js 15 native).
- Studio runs all chain/storage/router calls inside its own server actions and route handlers using `packages/sdk` directly. Power users hit the same code path through the CLI; cloud users hit it through Studio + `apps/api` route handlers. There is no separate forge-daemon process.
- 0G KV pointer (`passport:{wallet}:latest`) is the source of truth for passport state — Studio reads chain + KV directly without daemon dependency.

### 4.5 Onboarding flow (visual specification)

Per `COMPONENTS.md §1`, `/onboard` is a 5-row stepper that ends with the user's **first share-able receipt**, not just an empty profile:

1. Connect wallet (WalletConnect modal)
2. Auto-fund from faucet if balance < 0.05 OG (no leaving the app)
3. Pick handle (live uniqueness check via `AgentPassportINFT.handleTaken()`)
4. Mint Agent Passport — show mint tx hash as it confirms
5. Run first action — auto-loads sample 200 KB PDF and runs `doc summarize`, finishes with a Public Proof URL

Target: <90 seconds end-to-end.

### 4.6 Hosting
- Vercel for Studio + API.
- Daemon runs locally on power-user machines (auto-start with transparent logs per `BUILD.md §11.5`).
- For cloud users (no daemon), the Vercel-hosted apps/api proxies daemon-equivalent calls.

---

## 5. Forge CLI: Modes

7 modes; one binary; mode is the first positional after the subcommand or implied by command.

| Mode | Verb | Permissions | Default mode for |
|---|---|---|---|
| `plan` | read | read-only, no shell | `ivaronix plan "ship X"` |
| `build` | edit | read+write+shell, ask for wallet/network | `ivaronix code "fix Y"` |
| `audit` | review | read+memory+receipt, no write | `ivaronix audit repo` |
| `doc` | private-Q&A | read-private + receipt + burn | `ivaronix doc ask` |
| `swarm` | parent/worker | parent dispatches; workers worktree-isolated | `ivaronix swarm run todo.md` |
| `watch` | daemon | wakes on schedule/file/channel | `ivaronix watch repo --daily` |
| `receipt` | verify-only | read-only chain+storage | `ivaronix receipt verify <id>` |

OpenCode parallels: `plan`/`build`. Octogent parallels: `swarm` (parent/worker). Hermes parallels: `watch` (daemon). claude-mem parallels: lifecycle hooks (§9).

---

## 6. CLI Command Map (canonical)

```bash
# === Init / Doctor ===
ivaronix init                           # creates .ivaronix/, generates passport
ivaronix doctor                         # full health check
ivaronix doctor --network               # chain ID + RPC + explorer reachability
ivaronix doctor --router                # balance + rate limits + provider catalog
ivaronix doctor --storage               # indexer reachability + upload roundtrip
ivaronix doctor --chain                 # registry contract reachable + verified
ivaronix doctor --metrics               # live receipt count, latency, uptime

# === Modes ===
ivaronix plan "ship wallet login"
ivaronix code "fix this bug"
ivaronix audit repo --receipt
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
ivaronix swarm run todo.md --worktree --receipt
ivaronix watch repo --daily

# === Compute / Models ===
ivaronix compute balance
ivaronix compute usage --today
ivaronix compute usage --history
ivaronix compute test
ivaronix compute verify-tee <receipt-id>
ivaronix models list
ivaronix models inspect <model>
ivaronix providers list --model <model>

# === Storage ===
ivaronix storage upload file.pdf --encrypt aes
ivaronix storage upload receipt.json --mem
ivaronix storage download <root> --proof
ivaronix storage peek <root>
ivaronix storage snapshot repo --encrypt aes
ivaronix storage diff <old-root> <path>

# === Chain ===
ivaronix chain deploy-registry
ivaronix chain verify-contract <address>
ivaronix receipt anchor <receipt-root>
ivaronix receipt registry status

# === Receipts ===
ivaronix receipt verify <id>
ivaronix receipt verify <id> --tee-independent
ivaronix receipt show <id>
ivaronix receipt list --since 2026-05-01

# === Passport (ERC-7857 INFT) ===
ivaronix passport mint
ivaronix passport show
ivaronix passport restore --wallet 0x...
ivaronix passport authorize <agent-id> --executor <addr>
ivaronix passport transfer <agent-id> --to <wallet>
ivaronix passport clone <agent-id>

# === Memory ===
ivaronix memory search "what did we decide?"
ivaronix memory snapshot --upload
ivaronix memory grant <grantee> --scope project --ttl 7d
ivaronix memory revoke <grantId>
ivaronix memory diff <old-root>

# === Skills ===
ivaronix skill search github-audit
ivaronix skill install github-audit
ivaronix skill install github.com/user/repo/path/to/skill
ivaronix skill inspect <skill>
ivaronix skill permissions <skill>
ivaronix skill scan <skill>
ivaronix skill registry sync

# === Policy / Safety ===
ivaronix policy edit
ivaronix policy show
ivaronix safety-check <action>

# === Daemon ===
ivaronix serve                          # explicit start (auto-starts otherwise)
ivaronix serve --port 8787
ivaronix stop

# === Config ===
ivaronix config network testnet|mainnet
ivaronix config show
```

---

## 7. `.ivaronix/` Project Layout

```
.ivaronix/
├── config.json
├── AGENT.md                             # passport summary (mirror of on-chain state)
├── CONTEXT.md                           # current scope description
├── todo.md                              # swarm reads tasks here
├── notes.md                             # working notes
├── policies/
│   ├── default.json
│   ├── skills.json
│   ├── network.json
│   └── wallet.json
├── hooks.yml                            # lifecycle hooks (see §9)
├── receipts/
│   ├── local/                           # pre-anchor drafts
│   ├── pending/                         # signed, awaiting upload+anchor
│   └── anchored/                        # full receipts cached locally
├── skills/                              # installed skills
│   ├── private-doc-review/              # 1st-party
│   ├── 0g-integration-auditor/          # 1st-party
│   ├── github-audit/                    # 1st-party
│   ├── code-review/                     # ported from awesome-claude-skills
│   ├── security-audit/
│   └── ...                              # any installed skill from registry
├── workspaces/                          # Octogent-style scoped contexts
│   ├── backend/{CONTEXT.md, todo.md, notes.md}
│   └── frontend/{CONTEXT.md, todo.md, notes.md}
├── memory/
│   ├── ivaronix.db                      # SQLite + FTS5 (claude-mem pattern)
│   ├── manifest.json                    # mirrors 0G KV `memory:{agentId}:manifest`
│   ├── vector/                          # HNSW index
│   ├── graph/                           # Graphiti-style temporal facts
│   │   ├── episodes/
│   │   └── facts/
│   ├── snapshots/
│   └── burn/                            # transient, zeroed on burn
├── snapshots/                           # code/doc snapshots for diff
├── worktrees/                           # git worktrees for swarm workers
├── traces/                              # raw 0G Router traces (debug only)
└── kv-cache/                            # local mirror of 0G KV reads
```

**Cardinal rule:** the user can `cat .ivaronix/AGENT.md`, `cat .ivaronix/notes.md`, etc. and understand exactly what the agent knows. **No black boxes.**

---

## 8. Hybrid Memory Engine (`packages/memory`)

The memory engine combines four storage strategies — no single 0G entry has all four.

| Layer | Library | Purpose |
|---|---|---|
| **Vector index** | `hnswlib-node` + `all-MiniLM-L6-v2` via `transformers.js` | Similarity search over fact embeddings (SealedMind pattern) |
| **Temporal graph** | custom JSON-LD store on top of SQLite (Graphiti-style) | Causality + facts-over-time with provenance |
| **Full-text** | `better-sqlite3` + FTS5 | Plain-text search across all observations |
| **KV pointers** | 0G Storage KV | Manifest pointers — `memory:{agentId}:manifest`, `passport:{wallet}:latest`, etc. |

### 8.1 Memory pipeline

```
Observation → embedding (vector) + fact extraction (TEE) →
  → write to (vector, FTS, temporal graph) →
  → snapshot manifest hash → 0G Storage upload → 0G KV pointer update →
  → MemoryAccessLog event emitted
```

### 8.2 Memory query
```
Query → embedding → vector top-K +
        full-text top-K +
        temporal graph relevant facts (by time + topic) →
  fuse + rerank →
  return top-N with provenance
```

### 8.3 Capability checks
Before any memory read by skill X for agent Y, query `CapabilityRegistry.grants(owner, grantId)` to confirm grant exists and isn't revoked + isn't expired. Emit `MemoryAccessLog(grantee, grantId, memoryRoot, accessType)` event.

---

## 9. Lifecycle Hooks (`packages/skills/src/hooks/`)

claude-mem-pattern hook system, defined in `.ivaronix/hooks.yml`:

```yaml
PreToolUse:
  - match: "wallet.*"
    run: "ivaronix safety-check wallet"
  - match: "shell.*"
    run: "ivaronix safety-check shell"

PostToolUse:
  - match: "shell|file_write|skill_exec"
    run: "ivaronix observation extract"

SessionStart:
  - run: "ivaronix passport restore --wallet $WALLET"

SessionEnd:
  - run: "ivaronix memory consolidate"
  - run: "ivaronix receipt close"

PreCompact:
  - run: "ivaronix memory snapshot --upload"

UserPromptSubmit:
  - run: "ivaronix policy gate $PROMPT"
```

Hooks run via daemon. Failed hook = blocked action with a clear CLI error (per `BUILD.md §3.4` rate-limit pattern: never silently continue).

---

## 10. Skill System (`packages/skills`)

### 10.1 Skill format — the *real* moat (not transient)

Ivaronix's skill manifest is a **strict superset** of awesome-claude-skills `SKILL.md`, plus an `og:` block of 0G-native fields that have **no off-chain equivalent**. A forker who copies just the `name`/`description` gets nothing — to match Ivaronix's value-add, they'd need to deploy `SkillRegistry` + integrate ERC-7857 passport + run a scanner pipeline + build fee routing. **The 50-skill marketplace isn't the moat. The 0G-native manifest extension IS.**

```yaml
# === Vanilla awesome-claude-skills SKILL.md frontmatter (compatible) ===
---
name: github-audit
description: Audits a public GitHub repo for code-quality + security issues.
license: Apache-2.0
---

# === Ivaronix og: extension (the moat) ===
og:
  permissions:
    memory_access: "project_only"
    network_access: ["github.com", "api.github.com"]
    wallet_access: false
    writes_files: false
    shell_access: "sandbox-only"
    receipt_required: true
    storage_quota_per_run: "5MB"        # 0G Storage write cap
    storage_namespace: "audits/"        # restricted namespace
    compute_tee_required: true          # must use sealed inference
    chain_gas_budget: "0.01 OG"         # max gas per run
    passport_min_trust: 0               # min trustScore to install
  reputation:
    on_pass: { trustScore: +1, receiptCount: +1 }
    on_fail: { trustScore: -2, violationCount: +1 }
    on_violation: { trustScore: -10, locked: true }
  consensus:
    required: false
    default_tier: "standard"            # quick | standard | high-stakes
  burn:
    auto_enable: false                  # auto-enable burn mode for sensitive skills
  creator:
    passport: "did:0g:passport:0x..."
    fee_split: { creator: 70, treasury: 30 }   # % of OG fees flowing back
  scanner:
    last_scan_at: 1715000000
    score: 92                           # min 80 to publish
    warnings: []
  anchor:
    manifest_hash: "sha256:..."         # 0G Storage root of skill bundle
    registry_address: "0x..."           # SkillRegistry on chain
    token_id: 23
    tx_hash: "0x..."
```

**Why this is a real moat, not a transient one:**
- A vanilla SKILL.md fork can't carry `og.reputation.on_pass` — there's no on-chain registry tracking it.
- Can't carry `og.creator.fee_split` — there's no payment router routing it.
- Can't carry `og.permissions.compute_tee_required` — there's no Router + broker integration enforcing it.
- Can't carry `og.anchor.manifest_hash` — there's no `SkillRegistry` contract anchoring it.
- To replicate the `og:` block, a competitor must rebuild the entire 0G-native stack underneath. **That's the real moat.**

### 10.2 Adapters (`packages/skills/adapters/`)

- `awesome-claude-skills.ts` — parse SKILL.md + supporting files → Ivaronix manifest. **Used to mass-port 50+ skills on Day 14.**
- `mcp.ts` — wrap MCP server → manifest. Lets users install any MCP server as an Ivaronix skill.
- `openclaw.ts` — wrap `openclaw.json` config → manifest.

### 10.3 Sandbox (`packages/skills/sandbox/`)

Runs every skill in restricted env:
- `PATH` allowlist (no system-wide tools)
- `cwd` jail to `~/.ivaronix/skills/<id>/sandbox/`
- Network allowlist from manifest's `permissions.networkAccess`
- No wallet env unless `walletAccess: true`
- No shell unless `shellAccess: "sandbox-only"`

### 10.4 Scanner (`packages/skills/scanner/`)

Pre-install scan checks for:
- Prompt injection vectors (suspicious system-prompt overrides)
- Secret leakage patterns (API key regex, mnemonic word lists)
- Wallet drain risk (transfers to non-allowlisted addresses)
- Excessive permissions vs. stated purpose
- Suspicious URLs
- Malicious shell commands

Failed scan → install blocked + reason logged + creator's reputation decremented.

### 10.5 On-chain anchoring

`SkillRegistry.sol` stores `mapping(bytes32 skillId => mapping(uint256 version => bytes32 manifestHash))`. Skill creators pay tiny gas to register a new version; consumers verify hash on install.

---

## 11. Tiered Consensus Orchestrator + Multi-Key Rotation (`packages/consensus` + `packages/og-router`)

### 11.0 Multi-wallet / multi-API-key support

**Why:** the user has multiple testnet wallets (A: `0xaa95...` for contracts/receipts, B: `0x1Be5...` for current Compute API key). When one wallet's compute balance depletes, the daemon must auto-fail-over to another wallet's API key without interrupting the user.

**Implementation:** `packages/og-router/keyring.ts` holds an ordered array of `{ label, wallet, apiKey, serviceUrl, providerAddress, balance }` entries. Default ordering: most-recently-funded first.

```typescript
type RouterKey = {
  label: string;                 // 'B-current' | 'A-deployer' | etc.
  wallet: `0x${string}`;
  apiKey: string;                // app-sk-...
  serviceUrl: string;            // https://compute-network-X.integratenetwork.work/v1/proxy
  providerAddress: `0x${string}`;
  lastBalanceCheck?: { balance: number; at: number };
};

class Keyring {
  private keys: RouterKey[];

  async pickKey(): Promise<RouterKey> {
    // Prefer keys with known-positive balance
    for (const k of this.keys) {
      if (await this.hasBalance(k)) return k;
    }
    throw new Error('All Router keys depleted — top up one wallet');
  }

  async invalidate(key: RouterKey, reason: '402' | 'expired' | 'rate_limit') {
    // Move to back of queue or mark depleted
  }

  async tryCall<T>(fn: (key: RouterKey) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.keys.length; attempt++) {
      const key = await this.pickKey();
      try {
        return await fn(key);
      } catch (err: any) {
        if (err.status === 402) {
          await this.invalidate(key, '402');
          continue;
        }
        if (err.status === 429) {
          // Rate limit — try next key, don't permanently invalidate
          continue;
        }
        throw err;  // 4xx other than 402/429 = real error
      }
    }
    throw lastErr;
  }
}
```

**Daemon startup:** load all keys from `.env`. Each key entry: `OG_ROUTER_KEYS=B:0x1Be5...:app-sk-...:https://compute-network-6.../v1/proxy:0xa48f...,A:0xaa95...:app-sk-...:https://...:0xa48f...` (compact serialization). Better: a `keyring.json` file pointed at by `OG_KEYRING_PATH`.

**`ivaronix doctor --keyring`:** lists all keys, current balance per wallet, depleted/active state.

**Wallet roles (locked):**
- **Wallet A** (`0xaa95...`) — **canonical for contracts + receipts.** Deploys contracts, mints user passport, signs receipts, accumulates reputation. Has 70 OG.
- **Wallet B** (`0x1Be5...`) — **compute API key source.** Currently has the active `app-sk-...`. Used until balance depletes; daemon then rotates.
- **Generate Wallet A's API key** as a Day 1 task: `0g-compute-cli get-secret --provider $PROVIDER` from Wallet A → add as second keyring entry. Both kept in rotation.

### 11.1 Tiered consensus (unchanged from prior)

**Three tiers; user picks per run, with cost shown upfront.**

| Tier | Roles | Use case | Est. cost |
|---|---|---|---|
| **Quick** | 1 model | Quick draft, no consensus | ~$0.02 |
| **Standard** (default) | 3 (analyst / critic / judge) | Most audits and doc-asks | ~$0.10 |
| **High-Stakes** | 5 (analyst / critic / risk-reviewer / evidence-checker / judge) | Legal / contract / financial — opt-in via `--high-stakes` | ~$0.25 |

`--consensus` flag defaults to Standard. `--high-stakes` upgrades to 5-role. `--quick` drops to single-model.

```typescript
type ConsensusTier = 'quick' | 'standard' | 'high-stakes';

const ROLES_BY_TIER: Record<ConsensusTier, string[]> = {
  'quick': ['analyst'],
  'standard': ['analyst', 'critic', 'judge'],
  'high-stakes': ['analyst', 'risk-reviewer', 'evidence-checker', 'red-team-critic', 'judge'],
};

async function runConsensus(input: ConsensusInput): Promise<ConsensusReceipt> {
  // Pre-flight: 7-gate fail-fast (MUSASHI pattern)
  await runGates(input);

  const roles = ROLES_BY_TIER[input.tier ?? 'standard'];
  const judgeRole = roles.at(-1)!;
  const otherRoles = roles.slice(0, -1);

  // Run all roles except judge in parallel
  const responses = await Promise.all(
    otherRoles.map(role =>
      routerCall({
        model: input.model,
        systemPrompt: prompts[role](input.context),
        userPrompt: input.userPrompt,
        verify_tee: true,
      })
    )
  );

  // Independent TEE verify per role (post-hoc)
  const teeVerifications = await Promise.all(
    responses.map(r =>
      brokerProcessResponse(r.providerAddress, r.zgResKey)
    )
  );

  // Compute convergence (semantic similarity)
  const convergenceScore = await computeConvergence(responses);

  // Judge synthesizes (with cycle memory context)
  const cycleMemory = await loadRecentConsensusOutcomes();
  const judgement = await routerCall({
    model: input.model,
    systemPrompt: prompts.judge(input.context, cycleMemory),
    userPrompt: composeJudgePrompt(responses),
    verify_tee: true,
  });
  const judgeTee = await brokerProcessResponse(judgement.providerAddress, judgement.zgResKey);

  return buildReceipt({
    type: 'consensus',
    responses,
    teeVerifications,
    convergenceScore,
    judgement,
    judgeTee,
  });
}
```

---

## 12. Contract Architecture

| Contract | Layer | Phase | Source pattern |
|---|---|---|---|
| `ReceiptRegistry` | Receipt | MVP | `REFERENCE_PATTERNS.md §2.1` (Provus) |
| `AgentPassportINFT` | Identity | MVP | `REFERENCE_PATTERNS.md §2.4` (Aishi/MUSASHI/SealedMind) |
| `Erc7857Verifier` | Identity | MVP | `REFERENCE_PATTERNS.md §2.5` (Aishi) |
| `CapabilityRegistry` | Memory | MVP | `REFERENCE_PATTERNS.md §2.3` (SealedMind) |
| `MemoryAccessLog` | Memory | MVP | `REFERENCE_PATTERNS.md §2.3` (SealedMind) |
| `SkillRegistry` | Skill | MVP | OpenClaw + custom |
| `ReputationOracle` | Reputation | Phase 3 | `REFERENCE_PATTERNS.md §2.2` (extension) |
| `EscrowVault` | Economy | Phase 4 | (deferred — AgentPay/zer0Gig own this) |

All contracts: Solidity 0.8.24, OpenZeppelin v5, EVM `cancun`, deployed via Foundry. Verify on ChainScan immediately after deploy.

---

## 13. Tech Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| CLI runtime | Node.js 20+ / TypeScript | shared types with daemon; OpenCode/Octogent precedent |
| Package manager | pnpm + Turborepo | strict node_modules; workspace protocol; CI cache. See `BUILD.md §11.6` |
| TUI | `ink` (React for CLIs) | OpenCode uses similar |
| Daemon HTTP | Hono | small (~12 KB), TS-native, edge-portable. See `BUILD.md §11.2` |
| Wallet (browser side) | viem + wagmi + walletconnect | viem stable; modern DX |
| 0G Chain client (daemon side) | **ethers v6** | required by 0G TypeScript SDKs. See `BUILD.md §11.1` |
| 0G Storage SDK | `@0gfoundation/0g-storage-ts-sdk` | official |
| 0G Compute SDK | `@0gfoundation/0g-compute-ts-sdk` + `@0glabs/0g-serving-broker` | official; serving-broker handles TEE attestation |
| Memory: FTS | better-sqlite3 + FTS5 | sync API; claude-mem precedent |
| Memory: vector | hnswlib-node + transformers.js (`all-MiniLM-L6-v2`) | local, free, SealedMind precedent |
| Memory: temporal graph | custom JSON-LD on SQLite | Graphiti-inspired |
| Contracts | Foundry (forge / cast / anvil) | Provus/MUSASHI/SealedMind precedent. See `BUILD.md §11.7` |
| Solidity / OZ / EVM | 0.8.24 / v5 / `cancun` | locked |
| Default model | `qwen/qwen-2.5-7b-instruct` with `--model` override | confirmed TEE-verifiable. See `BUILD.md §11.4` |
| Studio framework | Next.js 15 + React 19 | Provus stack precedent. See `BUILD.md §11.8` |
| Studio styling | Tailwind v4 + shadcn/ui | clean theming with `@theme inline` |
| Hosting | Vercel (Studio + apps/api) | Provus precedent |
| Audit | apply for ChainGPT free audit during Phase B | Provus precedent |

---

## 14. Security Architecture

### 14.1 Key handling (non-negotiable)
- Wallet private key NEVER touches CLI/daemon process. Sign via wallet client (Studio: WalletConnect; CLI: keystore).
- Router API key lives ONLY in daemon's env. CLI/Studio request Router via daemon (or apps/api proxy).
- Session keys (Burn Mode AES-256-GCM) generated, used, fingerprinted, then zeroed.

### 14.2 Permission gates
- Agent Safety Guard runs PRE every: file write, shell exec, network call, wallet signature, memory access, skill install, external posting.
- Each gate decision recorded in receipt's `request.approvalChain`.

### 14.3 Skill sandbox
- Runs with restricted env (PATH allowlist, cwd jail, network filter from manifest).
- Scanner pre-install (§10.4).
- Reputation-based gating: skills with low trust score require explicit approval.

### 14.4 Wording lock
- See `RECEIPTS_SPEC.md §5` and `PRD.md §16`.
- CI-enforced via `BUILD.md §9` (banned phrase lint).

---

## 15. Performance Targets

| Operation | Target |
|---|---|
| `ivaronix doctor` cold start | < 1 s |
| Studio first paint | < 1.5 s |
| `ivaronix receipt verify <id>` (anchored) | < 5 s |
| `ivaronix receipt verify <id> --tee-independent` | < 15 s |
| `ivaronix doc ask` end-to-end (5-role consensus) | < 60 s |
| Daemon idle memory | < 100 MB |
| Receipt JSON size | 3–6 KB |
| Receipt total cost | < 0.02 OG / receipt |

---

## 16. Out of Scope (this doc)

These belong elsewhere:
- Network env vars / chain IDs / RPC URLs → `BUILD.md §2`
- SDK quirks (peekHeader, indexer.download decryption flag, rate-limit headers) → `BUILD.md §3`
- Receipt JSON shape, hashing rules → `RECEIPTS_SPEC.md`
- Competitor patterns / contract templates → `REFERENCE_PATTERNS.md`
- Grant pitch / bounty mapping → `PITCH.md`

---

**End of HLD.** Implementation steps in `BUILD.md`.
