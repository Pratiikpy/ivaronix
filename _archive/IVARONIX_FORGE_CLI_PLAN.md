# Ivaronix Forge CLI Plan

## Purpose

This document defines the best buildable version of the Ivaronix CLI after studying:

- `ivaronix_final_prd.md`
- `OG integration.md`
- local 0G resources under `oglabs resources/`
- OpenCode
- Hermes Agent
- Octogent
- awesome-claude-skills
- claude-mem

The goal is not to copy one CLI. The goal is to build the 0G-native developer agent runtime that combines the strongest proven patterns:

> OpenCode-style coding UX + Octogent-style orchestration + Hermes-style long-running agent life + claude-mem-style memory + portable skills + 0G proof receipts.

Final CLI name:

# Ivaronix Forge

One-line CLI pitch:

> Ivaronix Forge is the 0G-native coding and agent CLI where agents read code/docs, remember project context, use permissioned skills, run consensus review, burn secrets, and create verifiable 0G action receipts.

## Final Recommendation

Build Ivaronix Forge as a TypeScript/Node CLI first.

Reason:

- OpenCode is TypeScript and already proves a strong provider-agnostic coding agent/TUI shape.
- Octogent is TypeScript and proves local PTY orchestration, worktrees, scoped context folders, and UI/API separation.
- claude-mem is TypeScript and proves lifecycle hooks, SQLite/FTS memory, worker daemon, and progressive disclosure.
- 0G Storage and many 0G examples are TypeScript-friendly.
- The web app/API will likely be TypeScript, so the CLI can share SDKs, receipt schemas, policy schemas, and 0G adapters.

Hermes is extremely valuable, but mostly as architecture inspiration rather than direct code reuse because it is Python-heavy and much larger than the first CLI should be.

## License Reality

The open-source repos are usable, but not all the same way:

- OpenCode: MIT. Patterns and code can be adapted with license preservation.
- Hermes Agent: MIT. Patterns and code can be adapted with license preservation.
- Octogent: MIT. Patterns and code can be adapted with license preservation.
- awesome-claude-skills: Apache-2.0. Skills and patterns can be reused with license compliance.
- claude-mem: AGPL-3.0. Be careful. Do not copy AGPL code into Ivaronix unless we are ready to comply with AGPL obligations. Use it mainly as a design reference unless we intentionally make that component AGPL-compatible.

Practical rule:

> Copy concepts freely. Copy MIT/Apache code only with notices. Avoid copying claude-mem code directly unless we accept AGPL constraints.

## What Each Repo Teaches Us

### OpenCode

What matters most:

- Provider-agnostic model runtime.
- OpenAI-compatible provider support.
- TUI-first developer workflow.
- Read-only `plan` mode and full-access `build` mode.
- Tool rendering for read/write/edit/shell/search/task/skill actions.
- Permission system with allow, deny, and ask behavior.
- Skills discovery from `SKILL.md`.
- MCP support.
- Client/server architecture.
- LSP and project awareness.
- Session storage, event streaming, and local HTTP API.

What Ivaronix should copy conceptually:

- `plan` and `build` agent separation.
- Provider adapter layer with 0G Router as a first-class provider.
- Permission rules before shell, file write, network, wallet, memory, and skill actions.
- TUI action stream that clearly shows every tool call.
- Skills loaded progressively from `SKILL.md`.
- Local server API so future web/desktop/mobile clients can drive the same agent.

What not to copy first:

- Full desktop app.
- Enterprise cloud console.
- Every provider integration.
- Full theme/plugin surface.

### Octogent

What matters most:

- Durable job context is stored in files, not only chat.
- A scoped workspace folder contains `CONTEXT.md`, `todo.md`, and notes.
- Multiple terminals can attach to one scoped context.
- Child agents are spawned from todo items.
- Parent agent coordinates workers.
- Optional git worktrees isolate parallel edits.
- Channel messages coordinate live agents, while durable handoff goes into markdown files.
- Local API manages PTYs, lifecycle, transcripts, and websocket transport.

What Ivaronix should copy conceptually:

- Scoped workspaces for different parts of a repo.
- Todo-driven swarm execution.
- Parent/worker model.
- Worktree-backed execution for risky parallel tasks.
- Durable markdown context files as the source of truth.

What Ivaronix should improve:

- Add 0G receipts for each worker task.
- Add skill permissions before workers run skills.
- Add memory access logs.
- Add chain-anchored final swarm receipt.

### Hermes Agent

What matters most:

- Long-running agent runtime.
- Persistent memory and user profile.
- Session search.
- Skills as procedural memory.
- Agent-created and agent-improved skills.
- Cron/scheduled tasks.
- Multiple provider support.
- Messaging gateways.
- Terminal backends: local, Docker, SSH, Modal, Daytona, Vercel Sandbox, etc.
- Toolsets and plugin system.
- Approval and command safety.

What Ivaronix should copy conceptually:

- Skills are not only marketplace items; they are procedural memory.
- Background/watch mode should exist, but not in MVP.
- Provider routing should be unified across CLI, API, web app, and future scheduled jobs.
- Toolsets should be explicit: code, docs, web, wallet, storage, chain, memory, skills.
- A future gateway daemon can run scheduled monitors.

What not to build first:

- 20 messaging gateways.
- Voice.
- Full plugin economy.
- RL/training environments.
- Full serverless terminal backend system.

### awesome-claude-skills

What matters most:

- Skills are folders with `SKILL.md`, YAML frontmatter, optional `scripts/`, `references/`, and `assets/`.
- Progressive disclosure keeps context small.
- Skills are workflows, not API endpoints.
- MCP/tools provide actions, while skills provide the procedure.
- Scripts should be black-box helpers where deterministic behavior matters.
- Skills can cover docs, code review, GitHub, Playwright testing, MCP building, PDF/DOCX/PPTX/XLSX, security, project management, and SaaS automation.

What Ivaronix should copy conceptually:

- Portable skill format.
- Skill install from GitHub repo path.
- Skill inspect before install.
- Skill permission manifest added by Ivaronix.
- Skill scan and sandbox before execution.
- First-party skill packs:
  - `private-doc-review`
  - `github-audit`
  - `smart-contract-review`
  - `web3-research`
  - `receipt-verifier`
  - `0g-integration-auditor`

What not to do:

- Do not import 1000 skills blindly.
- Do not allow a random skill to run commands, touch wallet state, read private memory, or post to external services without permissions.

### claude-mem

What matters most:

- Memory should capture observations from real work, not just chat text.
- Lifecycle hooks can capture session start, user prompt, file read, tool use, stop, and summary.
- Local SQLite + FTS5 gives fast search.
- Optional vector search improves semantic recall.
- Progressive disclosure is the right memory UX:
  - show cheap index first
  - fetch timeline/details only when relevant
  - show retrieval cost
- Private tags prevent sensitive content from entering persistent storage.
- Worker service plus local HTTP API gives a strong memory daemon design.

What Ivaronix should copy conceptually:

- Observation-based memory.
- Session summaries.
- Local-first SQLite memory.
- Search, timeline, get-details workflow.
- Private/burn tags before persistence.
- Memory viewer later.
- Memory as agent context, not only user-facing search.

What Ivaronix should improve with 0G:

- Encrypt memory snapshots before upload to 0G Storage.
- Anchor memory roots in action receipts.
- Let users choose local-only, 0G-encrypted, or burn-session memory.
- Add wallet ownership and permission grants.
- Add receipt for every memory access.

## Buildability With 0G

This CLI is buildable on current 0G testnet if we scope correctly.

Already verified locally:

- Galileo testnet chain ID: `16602`
- RPC: `https://evmrpc-testnet.0g.ai`
- 0G Router testnet base URL: `https://router-api-testnet.integratenetwork.work/v1`
- Chat endpoint: `POST /chat/completions`
- Model tested: `qwen/qwen-2.5-7b-instruct`
- `verify_tee: true` can be requested.
- Router returns `x_0g_trace` with provider, request ID, billing, and TEE-related trace fields.
- Current test funds are enough for full dev testing.

0G Storage is buildable for:

- encrypted document uploads
- encrypted code snapshots
- receipt JSON uploads
- memory snapshot uploads
- skill package uploads
- root-hash based verification

0G Chain is buildable for:

- receipt hash anchoring
- passport hash anchoring
- skill manifest hash anchoring
- memory root commitment anchoring

0G Compute/Router is buildable for:

- OpenAI-compatible model calls
- testnet inference
- TEE verification metadata where supported
- consensus fan-out by calling multiple models/providers when available

Roadmap-only for CLI MVP:

- 0G DA for high-volume logs.
- ERC-7857 / AgenticID for transferable agents.
- paid skill marketplace.
- agent-to-agent payments.
- fine-tuning.

## Product Shape

Ivaronix Forge should have three surfaces:

1. Direct commands for scripts and demos.
2. Interactive TUI for daily coding.
3. Local daemon/API for memory, worker sessions, receipts, and future UI.

Command examples:

```bash
ivaronix
ivaronix init
ivaronix doctor
ivaronix login
ivaronix compute test
ivaronix storage test
ivaronix chain test

ivaronix plan "ship wallet login"
ivaronix code "fix this bug"
ivaronix audit repo --receipt
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt

ivaronix memory index
ivaronix memory search "what did we decide about receipts?"
ivaronix memory timeline <id>
ivaronix memory get <id>

ivaronix skill search github-audit
ivaronix skill install github.com/org/repo/path/to/skill
ivaronix skill inspect github-audit
ivaronix skill scan github-audit
ivaronix skill run github-audit --receipt

ivaronix receipt verify <receipt-id-or-hash>
ivaronix receipt open <receipt-id>
ivaronix passport show

ivaronix workspace create backend
ivaronix swarm run todo.md --worktree --receipt
ivaronix watch repo --daily
```

## CLI Modes

### Plan Mode

Read-only. No file edits. No shell actions without approval. Used for repo understanding, architecture planning, audits, and scoped task breakdown.

This maps directly to OpenCode's `plan` mode.

### Build Mode

Can edit files and run commands, but must obey policy. Every meaningful file edit, shell command, skill run, or external call can become part of an action receipt.

### Audit Mode

Security and code review only. No file edits by default. Produces issue list, severity, evidence, and optional receipt.

### Doc Mode

Private document/code review. Supports burn mode, citations, consensus, receipt, and encrypted 0G Storage.

### Swarm Mode

Octogent-style multi-agent execution. Reads scoped workspaces and todo items. Can use worktrees for isolation. Produces per-worker receipts and a final parent receipt.

### Watch Mode

Hermes-style scheduled/background agents. Not MVP-first, but design now. Examples: repo daily audit, dependency risk watcher, wallet monitor, docs change watcher.

### Receipt Mode

Verifies local, storage, and chain receipts. This must work even without running a model.

## `.ivaronix/` Project Layout

The CLI should create a durable local project folder:

```text
.ivaronix/
  config.json
  AGENT.md
  MEMORY.md
  policies/
    default.json
    skills.json
    network.json
    wallet.json
  receipts/
    local/
    pending/
    anchored/
  skills/
    github-audit/
    private-doc-review/
    smart-contract-review/
  workspaces/
    backend/
      CONTEXT.md
      todo.md
      notes.md
    frontend/
      CONTEXT.md
      todo.md
      notes.md
    docs/
      CONTEXT.md
      todo.md
      notes.md
  memory/
    ivaronix.db
    index/
    snapshots/
    burn/
  graph/
    episodes/
    facts/
  snapshots/
    code/
    docs/
  worktrees/
  traces/
    0g-router/
    tools/
  storage-roots.json
  chain-anchors.json
```

Why this matters:

- Agents can read files instead of relying only on chat history.
- Users can inspect what the agent knows.
- Receipts can be verified without trusting the UI.
- Workspaces can be delegated safely.
- Memory can be local-first and later encrypted to 0G.

## Core Architecture

Recommended monorepo packages:

```text
apps/cli
packages/core
packages/models
packages/og
packages/receipts
packages/skills
packages/memory
packages/policy
packages/orchestrator
packages/tui
packages/local-api
packages/sdk
```

### `packages/models`

Responsibilities:

- Provider abstraction.
- 0G Router adapter.
- External provider adapter.
- Local model adapter.
- Model labels: local, external, 0G router, 0G verified.
- Token/cost tracking.
- Streaming support.

0G Router config:

```env
OG_ROUTER_BASE_URL=https://router-api-testnet.integratenetwork.work/v1
OG_DEFAULT_MODEL=qwen/qwen-2.5-7b-instruct
OG_VERIFY_TEE=true
```

### `packages/og`

Responsibilities:

- 0G Chain client.
- 0G Storage client.
- 0G Router client.
- Network config.
- Testnet health checks.
- Explorer links.
- Storage root helpers.
- Chain anchor helpers.

Commands:

```bash
ivaronix compute test
ivaronix storage test
ivaronix chain test
ivaronix og status
```

### `packages/receipts`

Responsibilities:

- Generate receipt JSON.
- Hash inputs/outputs/artifacts.
- Attach `x_0g_trace`.
- Upload receipt to 0G Storage.
- Anchor receipt hash on 0G Chain.
- Verify local receipt, storage root, and chain tx.

Receipt must never claim that the AI answer is true. It proves provenance, trace, permission, hashes, storage roots, and chain anchors.

CLI receipt fields:

```ts
type ForgeActionReceipt = {
  schemaVersion: "ivaronix.forge.receipt.v1";
  receiptId: string;
  command: string;
  mode: "plan" | "build" | "audit" | "doc" | "swarm" | "watch";
  projectRootHash: string;
  agentId: string;
  ownerWallet?: string;
  model: {
    providerType: "0g_verified" | "0g_router" | "external" | "local";
    model: string;
    providerAddress?: string;
    requestId?: string;
    teeVerified?: boolean | null;
    trace?: unknown;
  };
  inputHash: string;
  outputHash: string;
  filesRead: string[];
  filesModified: string[];
  commandsRun: string[];
  skillsUsed: {
    name: string;
    version?: string;
    manifestHash: string;
  }[];
  memory: {
    observationsRead: string[];
    memoryRootsUsed: string[];
    newMemoryRoot?: string;
  };
  documents: {
    localPathHash?: string;
    storageRoot?: string;
    burned: boolean;
  }[];
  policyDecision: {
    allowed: boolean;
    approvalRequired: boolean;
    approvedBy?: string;
    reason?: string;
  };
  storage: {
    receiptRoot?: string;
    artifactRoots: string[];
  };
  chain: {
    chainId: 16602;
    registryAddress?: string;
    txHash?: string;
  };
  createdAt: string;
};
```

### `packages/memory`

Responsibilities:

- Local SQLite memory.
- FTS5 search.
- Optional vector search later.
- Observation capture.
- Session summary generation.
- Memory index injection.
- Private/burn tag filtering.
- 0G encrypted memory snapshot export.
- Memory access receipts.

Use claude-mem's best idea:

> Show a cheap index first, then let the agent fetch timeline/details only when needed.

Memory retrieval commands:

```bash
ivaronix memory index
ivaronix memory search "auth receipt bug"
ivaronix memory timeline obs_123
ivaronix memory get obs_123 obs_124
ivaronix memory export --encrypted --storage
```

Memory storage modes:

- `local`: saved only in `.ivaronix/memory/ivaronix.db`
- `encrypted-0g`: encrypted snapshot uploaded to 0G Storage
- `burn`: usable in current session, then key destroyed and no persistent plaintext remains

Privacy syntax:

```text
<private>
Do not store this content in memory.
</private>

<burn>
Use this for the current task only. Create a burn receipt after the session.
</burn>
```

### `packages/skills`

Responsibilities:

- Discover `SKILL.md` folders.
- Install from GitHub.
- Inspect skill metadata.
- Add Ivaronix permission manifests.
- Scan scripts for dangerous behavior.
- Sandbox skill scripts.
- Execute skills with receipt.
- Publish first-party skill packs.

Skill folder:

```text
skill-name/
  SKILL.md
  manifest.ivaronix.json
  scripts/
  references/
  assets/
```

Ivaronix manifest:

```json
{
  "name": "github-audit",
  "version": "0.1.0",
  "permissions": ["read_repo", "run_tests"],
  "memoryAccess": "project_only",
  "networkAccess": ["github.com"],
  "walletAccess": false,
  "writesFiles": false,
  "runsCommands": true,
  "receiptRequired": true
}
```

First-party MVP skills:

- `private-doc-review`
- `github-audit`
- `receipt-verifier`
- `0g-integration-auditor`

Soon after:

- `smart-contract-review`
- `web3-research`
- `dependency-risk`
- `playwright-webapp-test`
- `mcp-builder`

### `packages/policy`

Responsibilities:

- Permission prompts.
- Allow/deny/ask rules.
- Command allowlist/blocklist.
- Network domain allowlist.
- Skill permission approval.
- Wallet access approval.
- Memory access approval.
- File write approval.

Policy examples:

```json
{
  "shell": {
    "default": "ask",
    "deny": ["rm -rf", "git reset --hard", "curl * | sh"],
    "allow": ["npm test", "pnpm test", "git status"]
  },
  "skills": {
    "github-audit": "ask",
    "receipt-verifier": "allow"
  },
  "memory": {
    "personal": "ask",
    "project": "allow",
    "burn": "deny_persist"
  },
  "wallet": {
    "sign": "ask",
    "sendTransaction": "ask",
    "transfer": "deny"
  }
}
```

### `packages/orchestrator`

Responsibilities:

- Workspace creation.
- Todo parsing.
- Worker spawning.
- Parent/worker task assignment.
- Worktree creation.
- Inter-agent messages.
- Worker receipt collection.
- Final parent receipt.

Ivaronix workspace is Octogent's tentacle idea without the branding:

```text
.ivaronix/workspaces/backend/CONTEXT.md
.ivaronix/workspaces/backend/todo.md
.ivaronix/workspaces/backend/notes.md
```

Swarm receipt:

- one receipt per worker
- one parent receipt
- final combined storage root
- optional chain anchor

### `packages/tui`

Responsibilities:

- Interactive terminal UI.
- Agent mode switcher.
- Model selector.
- Skill selector.
- Permission prompts.
- Tool call stream.
- Receipt panel.
- Memory search panel.
- 0G status panel.

OpenCode should inspire this directly, but MVP can start with command-line output before full TUI.

### `packages/local-api`

Responsibilities:

- Local HTTP API.
- Session events.
- Memory search endpoints.
- Receipt endpoints.
- PTY worker lifecycle.
- SSE or WebSocket stream.
- Future desktop/web local viewer.

This combines OpenCode client/server, Octogent local API, and claude-mem worker daemon patterns.

## 0G Integration By CLI Feature

### `ivaronix compute test`

Uses 0G Router:

- calls `/chat/completions`
- sends `verify_tee: true`
- prints model response
- stores trace locally
- optionally creates a test receipt

### `ivaronix doc ask --burn --receipt`

Uses:

- local encryption for doc/session key
- 0G Router for inference
- optional consensus fan-out
- 0G Storage for encrypted receipt/artifacts
- 0G Chain for receipt anchor
- burn receipt after key destruction

Important truth:

> Burn mode does not delete blockchain or storage data. It encrypts first, then destroys the key.

### `ivaronix audit repo --receipt`

Uses:

- local repo scan
- optional code snapshot hash
- 0G Router model call
- first-party `github-audit` skill
- receipt with files read, issues found, output hash
- optional Storage upload and Chain anchor

### `ivaronix swarm run --receipt`

Uses:

- local workspaces/todos
- worktrees for isolation
- multiple workers
- one receipt per worker
- final parent receipt
- optional storage bundle and chain anchor

### `ivaronix memory export --encrypted --storage`

Uses:

- local SQLite summaries/observations
- encrypted snapshot
- upload to 0G Storage
- store root in `storage-roots.json`
- optionally anchor memory root on chain

### `ivaronix skill run --receipt`

Uses:

- skill manifest hash
- policy approval
- sandbox run logs
- model trace if model used
- storage root for receipt
- chain anchor if requested

## MVP Scope

The first CLI demo must be narrow and strong.

Build this first:

1. `ivaronix init`
2. `.ivaronix/` project scaffold
3. `ivaronix compute test`
4. 0G Router adapter using OpenAI-compatible API
5. local receipt generation
6. `ivaronix receipt verify`
7. local SQLite memory with search/index
8. private/burn tag stripping before memory persistence
9. `ivaronix doc ask <file> <question> --burn --receipt`
10. upload receipt JSON to 0G Storage
11. anchor receipt hash on 0G Chain
12. `ivaronix audit repo --receipt`
13. first-party `private-doc-review` and `github-audit` skills

This proves:

- CLI works.
- 0G inference works.
- receipt works.
- burn mode works.
- memory works.
- skill permission works.
- storage proof works.
- chain proof works.

## What Not To Build First

Do not build these in MVP:

- full marketplace
- payments
- teams
- 100 skills
- messaging gateways
- desktop app
- mobile app
- full autonomous scheduled agents
- full multi-provider catalog
- full worktree swarm UI
- DA event stream
- AgenticID/iNFT ownership
- fine-tuning

Saved product rule:

> Big architecture. Narrow insane demo.

## Strongest Demo Flow

### Demo 1: Private Contract Review

```bash
ivaronix doc ask contract.pdf "find risky clauses and explain them simply" --burn --consensus --receipt
```

Output:

- answer
- clause references
- risk level
- model agreement
- burn receipt
- 0G Router trace
- 0G Storage receipt root
- 0G Chain tx hash

### Demo 2: Repo Audit

```bash
ivaronix audit repo --skill github-audit --receipt
```

Output:

- architecture summary
- security issues
- test gaps
- files read
- skill manifest hash
- receipt hash
- optional storage root and chain tx

### Demo 3: Memory Recall

```bash
ivaronix memory search "what did we decide about burn mode?"
ivaronix memory timeline obs_42
```

Output:

- cheap index
- timeline context
- full observation only if requested
- receipt if memory was accessed for an AI action

## Why This Can Beat Other 0G Projects

Most 0G projects show one layer:

- memory
- payment
- marketplace
- audit
- sealed inference
- agent identity
- workflow

Ivaronix Forge combines the developer workflow layers:

```text
coding agent + private docs + memory + skills + permissions + consensus + 0G receipts
```

The key difference:

> It is not only using 0G. It makes 0G visible in every important AI action.

For judging, this scores well on:

- 0G technical integration depth: Compute, Storage, Chain, receipts, memory roots, TEE traces.
- Innovation: AI action receipts, burn mode, skill permissions, memory access receipts, swarm receipts.
- Technical completeness: CLI commands can be demonstrated end-to-end.
- Product value: developers already love CLI agents, but none have 0G-native proof and private memory.
- Market potential: starts with devs and private docs/code, expands to teams, skills, and trust layer.

## Implementation Order

### Phase 0: CLI Core

- TypeScript CLI scaffold.
- Config loader.
- `.ivaronix/` scaffold.
- `doctor`, `init`, `login`.
- local receipt schema.
- local receipt verification.

### Phase 1: 0G Adapter

- 0G Router adapter.
- `compute test`.
- parse and store `x_0g_trace`.
- 0G Chain client.
- 0G Storage client.
- testnet status command.

### Phase 2: Receipt MVP

- hash input/output.
- generate receipt JSON.
- upload receipt to 0G Storage.
- anchor receipt hash on 0G Chain.
- verify chain tx and storage root.

### Phase 3: Private Docs/Burn

- file ingestion.
- local encryption.
- `<private>` and `<burn>` filters.
- doc ask flow.
- burn key deletion.
- burn receipt.

### Phase 4: Memory

- SQLite database.
- observations table.
- summaries table.
- FTS5 search.
- memory index injection.
- search/timeline/get commands.
- encrypted 0G memory snapshot export.

### Phase 5: Skills

- `SKILL.md` loader.
- install from local path/GitHub.
- manifest generator.
- permission scanner.
- first-party skill pack.
- skill execution receipt.

### Phase 6: Coding Agent

- plan/build modes.
- file read/edit tools.
- shell tool.
- repo map.
- LSP later.
- TUI later if time.

### Phase 7: Orchestration

- workspaces.
- todo parser.
- worker spawning.
- worktree isolation.
- parent/worker receipts.

### Phase 8: Watch/Gateway Later

- scheduled jobs.
- repo monitor.
- wallet monitor.
- Telegram/Discord later.

## Technical Risks

### Risk: Trying to build all viral features at once

Mitigation:

- Build receipt-first CLI.
- Add memory and skills second.
- Add swarm/TUI after core proof flow works.

### Risk: 0G API changes

Mitigation:

- Keep `packages/og` isolated.
- Centralize network config.
- Add `ivaronix doctor`.
- Store testnet facts in docs.

### Risk: Burn mode overclaiming

Mitigation:

- Always say encrypted data may remain, but key is destroyed.
- Create burn receipt.
- Do not claim blockchain deletion.

### Risk: Skill supply-chain attacks

Mitigation:

- Inspect before install.
- Manifest permissions.
- Script scan.
- Sandbox.
- Deny wallet by default.
- Ask before shell/network/file write.

### Risk: Memory leaks secrets

Mitigation:

- `<private>` stripping before persistence.
- `<burn>` stripping before persistence.
- secret scanner.
- `.env` denylist.
- local-only default.
- encrypted 0G export only after approval.

### Risk: AGPL contamination from claude-mem

Mitigation:

- Use claude-mem as design reference.
- Do not copy implementation files unless legal strategy accepts AGPL.

## Final Build Decision

Yes, this is the best CLI direction for Ivaronix.

The CLI should not be a normal "Claude Code clone on 0G." That would be too shallow.

The best version is:

> A 0G-native agent workbench where every serious developer action can be remembered, permissioned, verified, burned, and receipted.

The MVP should prove only one thing extremely well:

> Private docs/code reviewed by an agent through 0G inference, with burn mode, memory, skill permissions, and a verifiable 0G action receipt.

After that works, expand into the full Forge CLI:

```text
OpenCode UX
+ Octogent orchestration
+ Hermes agent life
+ claude-mem memory
+ portable skills
+ 0G receipts
= Ivaronix Forge
```
