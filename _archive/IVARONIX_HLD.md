# Ivaronix HLD

## Testnet-First High-Level Design

## Purpose

This is the high-level architecture for building Ivaronix on 0G Galileo testnet first.

Ivaronix is the 0G-native Agent OS where users and developers create private AI agents that can remember, use permissioned skills, ask multiple models, burn sensitive sessions, and prove important actions through 0G receipts.

This HLD is based on:

- `ivaronix_final_prd.md`
- `OG integration.md`
- `IVARONIX_FORGE_CLI_PLAN.md`
- `IVARONIX_FORGE_0G_DOC_GAPS.md`
- `oglabs resources/`
- `CLI Open Source Project/`

The build rule:

> Build everything on 0G Galileo testnet first. Prove the full trust loop before touching mainnet.

## Final MVP Target

The first working system should prove this flow end-to-end:

```text
Connect wallet
-> create private agent
-> upload private doc/code
-> encrypt and store artifact on 0G Storage
-> ask 0G Router model
-> run consensus/review flow
-> create action receipt
-> store receipt on 0G Storage
-> anchor receipt hash on 0G Chain
-> show agent passport update
-> verify receipt from web and CLI
```

The first demo command:

```bash
ivaronix doc ask contract.pdf "Find risky clauses and explain them simply" \
  --model qwen/qwen-2.5-7b-instruct \
  --burn \
  --consensus \
  --verify-tee \
  --receipt
```

## MVP Non-Goals

Do not build these first:

- full marketplace
- payments
- teams
- 100 skills
- full Direct Compute funding/subaccount UI
- fine-tuning
- image generation
- audio transcription
- DA event publishing
- ERC-7857 marketplace
- mobile app
- browser extension

Design hooks for them, but keep the first build focused on the private docs/code trust loop.

## System Surfaces

### 1. Ivaronix Workspace

The web app.

Used by normal users, teams later, and demo judges.

Main screens:

- wallet login
- create agent
- private chat
- private document/code room
- memory vault
- skill permission screen
- action receipt viewer
- agent passport
- developer/API settings

### 2. Ivaronix Forge

The CLI.

Forge is the developer surface of Ivaronix.

It should feel like:

```text
OpenCode-style CLI
+ Octogent-style orchestration
+ Hermes-style memory and skills
+ 0G-native receipts and verification
```

Forge commands should share backend APIs, schemas, receipts, 0G adapters, memory logic, and skills with the web app.

### 3. Ivaronix API

The backend API used by the web app and CLI.

It exposes:

- auth/session APIs
- agent APIs
- document upload APIs
- model routing APIs
- consensus APIs
- skill APIs
- receipt APIs
- memory APIs
- 0G Storage/Chain APIs

### 4. Ivaronix Worker

Background job runtime.

Used for:

- document processing
- code snapshotting
- memory extraction
- consensus fan-out
- receipt creation
- 0G Storage uploads
- 0G Chain anchoring
- future watch/scheduled jobs

### 5. Ivaronix Contracts

Minimal 0G Chain contracts.

MVP contract:

- `ReceiptRegistry`

Later contracts:

- `AgentPassportRegistry`
- `SkillRegistry`
- `PolicyRegistry`
- `CreatorPayments`
- `AgenticID/ERC-7857` integration

## Testnet Network Profile

All first builds use Galileo testnet.

```env
OG_NETWORK=testnet
OG_CHAIN_ID=16602
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_EXPLORER=https://chainscan-galileo.0g.ai
OG_STORAGE_EXPLORER=https://storagescan-galileo.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api-testnet.integratenetwork.work/v1
OG_DEFAULT_MODEL=qwen/qwen-2.5-7b-instruct
```

Important:

- Use chain ID `16602` for Galileo.
- Warn if old `16601` config appears.
- Never expose `OG_PRIVATE_KEY`.
- Never expose `OG_ROUTER_API_KEY`.
- Router API key must stay server-side.

## High-Level Architecture

```text
Web App
  |
  | HTTPS
  v
Backend API ---------------------- Forge CLI
  |                                  |
  | shared schemas/SDK               | local TUI, local workspace
  v                                  v
Worker Queue / Job Runtime       .ivaronix/
  |
  |-----------------------------------------------|
  |                                               |
0G Router / Private Computer                  0G Storage
  |                                               |
TEE model inference                              encrypted docs
model traces                                     memory snapshots
billing trace                                    receipts
                                                   code snapshots
  |
  v
0G Chain
ReceiptRegistry
passport hashes
skill/policy hashes later
```

## Recommended Tech Stack

### Frontend

- Next.js / React
- TypeScript
- wallet connection through EVM wallet libraries
- Tailwind or existing project styling system
- no secrets in frontend

### Backend

- Node.js / TypeScript
- API server: Next API routes, Hono, Fastify, or Nest-style modular server
- OpenAI-compatible client for 0G Router
- ethers for 0G Chain
- 0G Storage TS SDK
- queue system for worker jobs

### CLI

- Node.js / TypeScript
- TUI inspired by OpenCode and Hermes
- local project state under `.ivaronix/`
- shared packages with web/backend

### Database

Use a normal database for product indexing and UX.

Recommended for MVP:

- PostgreSQL, Supabase, Neon, or local SQLite for CLI-only mode

Use the database for:

- users
- agents
- sessions
- receipts index
- storage root mappings
- memory metadata
- skill installs
- policy records
- job status

Do not store private document plaintext in the database.

### Contracts

- Solidity
- Hardhat or Foundry
- 0G Galileo testnet first
- compile with modern EVM settings such as Cancun where needed

## 0G Integration Architecture

### 0G Router / Private Computer

Use Router for MVP inference.

Why Router first:

- OpenAI-compatible API
- one API key
- unified testnet payment balance
- model/provider abstraction
- TEE verification flag
- easier CLI/web/backend integration

Endpoint:

```text
POST https://router-api-testnet.integratenetwork.work/v1/chat/completions
```

MVP model:

```text
qwen/qwen-2.5-7b-instruct
```

Request pattern:

```json
{
  "model": "qwen/qwen-2.5-7b-instruct",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "verify_tee": true,
  "provider": {
    "sort": "latency",
    "allow_fallbacks": true
  }
}
```

Persist from every response:

- model ID
- provider address
- request ID
- `x_0g_trace`
- `tee_verified`
- billing cost
- token usage
- `ZG-Res-Key` header if available

### 0G Storage

Use 0G Storage for:

- encrypted uploaded docs
- encrypted code snapshots
- memory snapshots
- action receipt JSON
- burn receipt JSON
- agent passport JSON
- skill package snapshots later

Use TypeScript SDK:

```bash
npm install @0gfoundation/0g-storage-ts-sdk ethers
```

Use:

- `ZgFile.fromFilePath()` for local files
- `MemData` for in-memory receipt JSON
- `file.merkleTree()` before upload
- `Indexer.upload()`
- proof download for verification
- SDK encryption for private artifacts
- `peekHeader()` for encrypted file inspection

Burn mode:

- encrypt with AES session key
- process in memory or temporary encrypted workspace
- destroy session key
- delete local temp/cache/embedding artifacts
- create Burn Receipt

Correct claim:

> Burn Mode destroys the key, not the blockchain data.

### 0G Chain

Use 0G Chain for:

- receipt hash anchoring
- agent passport hash anchoring
- later skill registry
- later policy registry
- later creator/payment flows

MVP contract:

```solidity
contract ReceiptRegistry {
    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        bytes32 indexed agentId,
        address indexed owner,
        string receiptStorageRoot,
        string receiptType,
        uint256 timestamp
    );
}
```

MVP contract storage can be minimal:

- event-first design
- optional mapping from receipt hash to metadata
- no private data on-chain

### 0G DA

Not MVP.

Use later for:

- high-volume agent event logs
- swarm event streams
- batched receipts
- marketplace activity
- appchain/rollup-style event availability

Reason to defer:

- official docs require DA client/encoder/retriever infra
- too heavy for first product
- Storage + Chain is enough for first trust loop

### AgenticID / ERC-7857

Not MVP as a full marketplace.

Use later for:

- ownable agents
- agent cloning
- authorized usage
- transfer of encrypted agent metadata
- agent marketplace

MVP alternative:

- Agent Passport JSON on 0G Storage
- passport hash anchored on 0G Chain
- later upgrade to ERC-7857 / INFT

## Core Components

### Auth And Wallet Layer

Responsibilities:

- wallet login
- nonce signing
- session creation
- owner wallet mapping
- permissions based on wallet ownership
- operator-paid onboarding mode

MVP:

- SIWE-style wallet login
- JWT/session cookie
- wallet address as primary identity
- server pays selected testnet gas/compute for demo flows

### Operator Pays Mode

Purpose:

- reduce onboarding friction
- let users test without understanding Router deposits or gas
- keep user wallet as identity while the Ivaronix backend pays controlled testnet costs

MVP rules:

- only enabled for allowlisted demo actions
- strict spend limit per wallet/session
- no unrestricted chain writes
- all operator-paid actions create receipts
- UI must show "paid by Ivaronix operator" in receipt metadata

Later:

- bring-your-own Router key
- bring-your-own wallet payer
- team billing account
- prepaid credits

### Agent Layer

Responsibilities:

- create agent
- update agent config
- choose model policy
- attach memory roots
- attach skills
- update passport

Agent config:

```ts
type Agent = {
  id: string;
  ownerWallet: string;
  name: string;
  role: string;
  instructions: string;
  modelPolicy: ModelPolicy;
  memoryRoot?: string;
  passportStorageRoot?: string;
  passportHash?: string;
};
```

### Model Router Layer

Responsibilities:

- call 0G Router
- list models
- inspect model capabilities
- route by latency/price/provider
- estimate cost
- retry safely
- capture traces
- normalize responses

Commands/API:

```bash
ivaronix compute test
ivaronix compute balance
ivaronix compute usage --today
ivaronix models list
ivaronix models inspect <model>
ivaronix providers list --model <model>
```

### Document And Code Room

Responsibilities:

- upload docs/code
- chunk and index content
- encrypt before storage
- ask questions against docs/code
- include source citations
- run consensus
- support burn mode
- create receipt

MVP supported inputs:

- PDF
- TXT/MD
- selected repo folder or zip
- smart contract file
- legal contract text

### Memory Layer

Responsibilities:

- extract useful memory after sessions
- store encrypted memory snapshots on 0G Storage
- query memory for future tasks
- track provenance from receipt IDs
- support memory namespaces
- grant and revoke memory access

MVP memory:

- simple encrypted JSON memory file per agent/project
- source receipt references
- local/searchable index in DB
- permission records by agent, skill, project, and session

Later memory:

- Graphiti-style temporal graph
- fact validity windows
- source episodes
- memory diff/versioning

### Memory Permission Center

Responsibilities:

- show all memory namespaces
- show which agents can access each namespace
- show which skills can access each namespace
- grant memory access
- revoke memory access
- show memory access history
- create Memory Access Receipts

MVP controls:

- personal memory: off by default
- project memory: allowed per project agent
- session memory: temporary, can be burned
- skill memory: must be approved per skill

This should be a visible UI surface, not a hidden settings page.

### Skill Runtime

Responsibilities:

- install skills
- inspect skill files
- parse permission manifest
- sandbox/check before execution
- run skill with limited context
- record skill execution receipt

MVP first-party skills:

- private-doc-review
- github-audit
- smart-contract-review
- receipt-verifier
- 0g-integration-auditor

Skill manifest:

```ts
type SkillManifest = {
  name: string;
  version: string;
  description: string;
  permissions: string[];
  memoryAccess: "none" | "session" | "project" | "personal";
  networkAccess: string[];
  walletAccess: boolean;
  writesFiles: boolean;
  runsCommands: boolean;
  receiptRequired: boolean;
  sourceUri?: string;
  sourceHash: string;
};
```

### Policy And Permission Layer

Responsibilities:

- decide what an agent/skill can access
- require user approval for sensitive actions
- block wallet/file/network/memory actions when not allowed
- log policy decision into receipts
- score action risk before execution
- show plain-language permission prompts

Permission categories:

- read document
- read memory
- write memory
- run model
- run skill
- read repo
- write files
- run shell
- network access
- wallet access
- chain transaction

### Agent Safety Guard

The Agent Safety Guard is the runtime gate before any risky action.

It evaluates:

- action type
- skill manifest
- requested memory scope
- requested files
- requested network domains
- requested shell commands
- wallet/chain transaction access
- whether a receipt is required

Possible decisions:

- allow
- ask user
- deny
- allow with reduced scope
- quarantine skill

This is required for Ivaronix to feel safe when agents use skills, repos, private docs, wallets, or shell tools.

### Consensus Layer

MVP:

- ask multiple roles, possibly same model with different prompts if budget matters
- analyst
- critic
- evidence checker
- final judge

Output:

- final answer
- agreement summary
- disagreement summary
- risk level
- sources/citations
- receipt

Important:

Do not overclaim "truth". Say:

- model agreement
- evidence coverage
- risk level
- proof of execution

### Receipt Layer

Every important action creates an Action Receipt.

Receipt proves:

- what was run
- which agent ran it
- which model/provider was used
- what input/output hashes exist
- what storage roots were used
- what policy decision happened
- what skill ran
- what cost was paid
- what 0G Chain anchor exists

Receipt does not prove:

- the answer is correct
- the AI is legally reliable
- private plaintext was put on-chain

MVP receipt flow:

```text
Action completes
-> normalize action metadata
-> hash input/output/private artifacts
-> build receipt JSON
-> upload receipt JSON to 0G Storage
-> anchor receipt hash/root on 0G Chain
-> update Agent Passport
```

### Proof Explorer

Responsibilities:

- display receipt metadata
- show 0G Storage root
- show 0G Chain transaction
- show model/provider and TEE status
- show skill used
- show memory/document roots without plaintext
- show cost and operator/user payer mode
- verify receipt hash against Storage and Chain
- provide shareable proof URL

MVP pages:

- Action Receipt Page
- Burn Receipt Page
- Document Review Receipt Page
- Code Audit Receipt Page

Privacy rule:

Proof Explorer must never reveal private document text, private memory content, raw prompts, secrets, or decrypted files.

### Receipt-Based Reputation

Responsibilities:

- calculate agent trust from real receipts
- count successful verified actions
- count failed, blocked, or denied actions
- count policy violations
- count TEE verified runs
- track skill execution success
- expose reputation on Agent Passport

MVP reputation should be simple counters, not a complex token or staking system.

### Agent Passport Layer

MVP passport:

- JSON document
- stored on 0G Storage
- hash anchored on 0G Chain

Passport includes:

- owner wallet
- agent ID
- name/role
- model policy
- memory root
- installed skill hashes
- latest receipt roots
- trust/reputation counters

Later:

- ERC-7857 / INFT upgrade

### Team Workspace Layer

Not required for the first demo, but it should be designed as the first serious business expansion.

Responsibilities:

- create team workspace
- invite members
- assign roles
- manage shared company memory
- manage shared private docs
- configure approval policies
- view audit logs
- view receipt history
- set spend limits
- control skill allowlist/blocklist

Why it matters:

Teams are likely to pay for private AI agents that remember company context and produce audit trails. This is the clearest commercial version of Ivaronix after the MVP trust loop works.

## Main Data Flows

### Flow 1: Create Agent

```text
User connects wallet
-> backend verifies wallet signature
-> user creates agent config
-> backend creates Agent record
-> backend creates passport JSON
-> passport JSON uploaded to 0G Storage
-> passport hash optionally anchored on 0G Chain
-> UI shows Agent Passport
```

### Flow 2: Private Document Review

```text
User uploads document
-> backend creates encrypted session
-> file encrypted locally/server-side before storage
-> encrypted file uploaded to 0G Storage
-> document chunks extracted for task context
-> model call goes through 0G Router with verify_tee
-> consensus roles run
-> answer generated with citations
-> receipt JSON created
-> receipt uploaded to 0G Storage
-> receipt hash anchored on 0G Chain
-> UI shows result + proof links
```

### Flow 3: Burn Mode

```text
User enables Burn Mode
-> session AES key generated
-> document/cache/temp embeddings encrypted or kept ephemeral
-> model task runs
-> answer and hashes captured
-> temporary plaintext/cache removed
-> AES session key destroyed
-> Burn Receipt created
-> Burn Receipt stored on 0G Storage
-> Action Receipt links Burn Receipt
```

### Flow 4: Forge CLI Repo Audit

```text
Developer runs ivaronix audit repo --receipt
-> Forge scans repo
-> creates .ivaronix workspace
-> creates code snapshot hash
-> optional encrypted snapshot upload to 0G Storage
-> runs 0G Router model
-> optional consensus roles
-> creates audit report
-> creates receipt
-> uploads receipt to 0G Storage
-> anchors receipt on 0G Chain
```

### Flow 5: Skill Execution

```text
User installs skill
-> skill manifest parsed
-> skill source hashed
-> permission screen shown
-> user approves
-> skill runs in limited context
-> model/tool calls recorded
-> receipt created
```

## Database HLD

### Tables

`users`

- id
- wallet_address
- created_at

`agents`

- id
- owner_wallet
- name
- role
- instructions
- model_policy_json
- passport_storage_root
- passport_hash
- created_at
- updated_at

`documents`

- id
- owner_wallet
- agent_id
- filename
- mime_type
- content_hash
- storage_root
- encrypted
- burn_mode
- created_at

`memories`

- id
- agent_id
- namespace
- memory_hash
- storage_root
- source_receipt_id
- version
- created_at

`skills`

- id
- name
- version
- source_uri
- source_hash
- manifest_json
- storage_root
- created_at

`agent_skills`

- agent_id
- skill_id
- permission_policy_json
- installed_at

`receipts`

- id
- receipt_hash
- receipt_type
- agent_id
- owner_wallet
- storage_root
- chain_tx_hash
- model_id
- provider_address
- tee_verified
- total_cost_neuron
- created_at

`jobs`

- id
- type
- status
- owner_wallet
- agent_id
- input_json
- result_json
- error
- created_at
- updated_at

## Contract HLD

### ReceiptRegistry

Purpose:

- anchor receipt hashes
- emit searchable events
- avoid private data leakage

Functions:

```solidity
function anchorReceipt(
    bytes32 receiptHash,
    bytes32 agentId,
    string calldata receiptStorageRoot,
    string calldata receiptType
) external;
```

Events:

```solidity
event ReceiptAnchored(
    bytes32 indexed receiptHash,
    bytes32 indexed agentId,
    address indexed owner,
    string receiptStorageRoot,
    string receiptType,
    uint256 timestamp
);
```

### AgentPassportRegistry Later

Purpose:

- anchor latest passport hash
- keep agent identity public without revealing private memory

### SkillRegistry Later

Purpose:

- register verified skills
- store source hash
- store creator wallet
- store permission manifest hash

## Forge CLI HLD

### `.ivaronix/` Layout

```text
.ivaronix/
  AGENT.md
  config.json
  policies/
    default.json
  receipts/
    <receipt-id>.json
  skills/
    <skill-name>/
      SKILL.md
      manifest.json
  workspaces/
    backend/
      CONTEXT.md
      todo.md
      notes.md
    frontend/
      CONTEXT.md
      todo.md
      notes.md
  memory/
    project-memory.json
    index.sqlite
  snapshots/
  worktrees/
```

### Forge Commands

```bash
ivaronix init
ivaronix code "fix this bug"
ivaronix plan "ship wallet login"
ivaronix audit repo --receipt
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
ivaronix memory search "what did we decide about pricing?"
ivaronix skill install github:user/repo/path
ivaronix skill inspect <skill>
ivaronix receipt verify <receipt-id>
ivaronix compute balance
ivaronix models list
ivaronix doctor
```

### Forge Shared Packages

Recommended monorepo packages:

```text
packages/
  core/
  api-client/
  model-router/
  og/
  storage/
  receipts/
  memory/
  skills/
  policy/
  cli/
  web/
  contracts/
```

## What To Reuse From CLI Open Source Project

The repos are not just inspiration; some can provide code patterns or direct reusable components depending on license.

### OpenCode

License: MIT.

Use for:

- TUI-first coding UX
- plan/build agent modes
- provider adapter design
- OpenAI-compatible provider handling
- permission prompts
- tool/action rendering
- local client/server architecture
- session/event streaming ideas
- skill discovery pattern
- MCP integration pattern

Copy/adapt carefully:

- TUI interaction patterns
- provider abstraction concepts
- permission architecture
- command/session lifecycle

Do not copy blindly:

- full product structure
- all provider integrations
- desktop app
- unrelated cloud/console pieces

### Octogent

License: MIT.

Use for:

- scoped workspaces
- durable `CONTEXT.md`, `todo.md`, `notes.md`
- parent/worker orchestration
- local PTY lifecycle
- web UI + local API separation
- git worktree isolation
- child-agent handoff model

Copy/adapt carefully:

- `.ivaronix/workspaces/<scope>/` design
- todo-driven worker prompts
- local API and terminal lifecycle ideas
- worktree orchestration

Improve with Ivaronix:

- add receipt per worker
- add memory access logs
- add 0G Storage snapshot roots
- add chain-anchored final swarm receipt

### Hermes Agent

License: MIT.

Use for:

- long-running agent runtime ideas
- persistent memory behavior
- skill self-improvement concepts
- scheduled/cron agents
- toolsets
- multi-provider model selection
- messaging gateways later
- terminal backend ideas later

Copy/adapt carefully:

- memory/skill lifecycle concepts
- scheduler/watch mode concepts
- toolset separation
- provider configuration ideas

Do not build first:

- all gateways
- voice
- RL/training
- full serverless terminal backend system

### awesome-claude-skills

License: Apache-2.0.

Use for:

- portable skill folder format
- `SKILL.md` structure
- progressive disclosure
- scripts/references/assets pattern
- first-party skill packs

Copy/adapt carefully:

- useful skill structures
- skill writing conventions
- scripts as deterministic helpers

Add Ivaronix layer:

- permission manifest
- source hash
- sandbox report
- receipt requirement
- memory/network/wallet/file access labels

### claude-mem

License: AGPL-3.0.

Use mainly as design reference unless we accept AGPL obligations.

Use for:

- lifecycle hook ideas
- memory worker process
- SQLite/FTS indexing idea
- private observation capture
- progressive memory retrieval

Do not directly copy AGPL code into closed/proprietary Ivaronix modules unless we are ready to comply with AGPL.

### 0G Resources

Use directly:

- `0g-doc` for current official network/API behavior
- `0g-compute-ts-sdk` for Direct/verification and future advanced compute
- `0g-compute-ts-starter-kit` for compute examples
- `0g-compute-skills` for 0G compute-specific coding guidance
- `0g-storage-ts-sdk` for Storage integration
- `0g-storage-ts-starter-kit` for Node scripts and SDK usage
- `0g-storage-web-starter-kit` for browser upload/download patterns
- `0g-storage-client` for CLI feature reference such as upload/download/diff-dir/KV
- `0g-kit` for simple examples
- `0g-memory` for memory patterns
- `agenticID-examples` for later ERC-7857/AgenticID
- `fine-tuning-example` later, not MVP
- `0g-da-rust-sdk` later, not MVP
- `0g-deployment-scripts` for deployment reference

## Security HLD

### Secrets

Never expose:

- private key
- Router API key
- encryption keys
- wallet seed phrase

Server-only:

- `OG_PRIVATE_KEY`
- `OG_ROUTER_API_KEY`

Frontend-safe:

- chain ID
- explorer URLs
- public contract addresses

### Private Data

Private docs should be:

- encrypted before storage
- never written to public chain
- referenced by hash/root only
- deleted from local temp after burn sessions

### Skill Safety

Before a skill runs, show:

- file access
- memory access
- network access
- wallet access
- command execution
- external posting
- receipt requirement

### Receipt Honesty

Receipts must say exactly what they prove.

They prove:

- model/provider used
- input/output hashes
- skill/tool metadata
- policy decision
- storage roots
- chain anchor
- TEE status if available

They do not prove:

- answer correctness
- legal truth
- financial safety
- deleted blockchain data

## Deployment HLD

### Local Development

Use local environment first:

- local web app
- local API
- local worker
- local DB
- 0G testnet Router
- 0G testnet Storage
- 0G Galileo contracts

### Testnet Deployment

Deploy:

- web app on Vercel
- backend API server on Vercel/serverless or separate Node host
- worker on separate long-running host if needed
- database on Supabase/Neon
- contracts on 0G Galileo

Important:

- Vercel is fine for web and API routes.
- Long-running jobs or CLI orchestration may need a separate worker.
- Router API key must live in backend env only.

### Mainnet Later

Move only after:

- testnet full flow works
- receipt verification works
- storage proof flow works
- contract anchoring works
- burn mode wording and implementation are correct
- cost estimates are reliable

## Implementation Phases

### Phase 0: Foundation

- repo structure
- shared TypeScript schemas
- env config
- wallet login
- operator pays mode guardrails
- DB setup
- 0G testnet config
- ReceiptRegistry contract skeleton

### Phase 1: 0G Router

- model call through testnet Router
- `verify_tee: true`
- capture `x_0g_trace`
- balance/usage command/API
- model list/inspect

### Phase 2: 0G Storage

- upload encrypted document
- upload receipt JSON with `MemData`
- download proof check
- storage root mapping

### Phase 3: Receipt Loop

- create Action Receipt
- store receipt on 0G Storage
- anchor receipt hash on 0G Chain
- Proof Explorer basic receipt page
- receipt verifier
- receipt-based reputation counters

### Phase 4: Private Docs/Burn

- doc upload
- doc chunking
- private question answer
- burn mode session key
- Burn Receipt

### Phase 5: Agent Passport

- create agent
- create passport JSON
- store passport on 0G Storage
- update passport after receipts
- show reputation counters

### Phase 6: Forge CLI MVP

- `ivaronix init`
- `ivaronix doc ask`
- `ivaronix audit repo`
- `ivaronix audit repo --receipt --verify-tee`
- `ivaronix receipt verify`
- `.ivaronix/` workspace
- local receipt files

### Phase 7: Skills

- first-party `private-doc-review`
- first-party `github-audit`
- skill manifest
- Agent Safety Guard permission screen
- skill receipt

### Phase 8: Consensus

- role-based review
- agreement/disagreement
- risk level
- consensus receipt

### Phase 9: Team Workspace Alpha

- team workspace
- shared team memory
- role-based access
- approval workflows
- audit logs
- receipt history
- skill allowlist/blocklist

## Open Questions For LLD

These should be solved in the LLD:

- exact DB provider
- exact API framework
- exact queue/worker provider
- exact receipt JSON schema v1
- exact ReceiptRegistry storage/event design
- exact encryption key lifecycle
- exact doc chunking strategy
- exact memory storage/indexing strategy
- exact skill sandbox mechanism
- exact CLI TUI library
- exact Vercel/server worker split

## Final Architecture Decision

Build Ivaronix as a testnet-first 0G Agent OS with one sharp MVP:

```text
Private docs/code agent
+ 0G Router inference
+ encrypted 0G Storage artifacts
+ burn mode
+ action receipts
+ 0G Chain anchoring
+ Forge CLI verification
```

This is stronger than a normal AI wrapper because the user can inspect what happened, verify where artifacts live, and anchor important AI actions on 0G.

This is also stronger than building a marketplace first because it proves the core trust primitive:

> AI agents can remember, act, and prove work on 0G.
