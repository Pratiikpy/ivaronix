# Ivaronix — Final Product Requirements Document

## Final Product Name

# Ivaronix

## Tagline

**The 0G-native Agent Operating System for private AI work.**

## One-Line Pitch

**Ivaronix is the 0G-native operating system where AI agents get private memory, permissioned skills, consensus review, burn mode, action receipts, identity, payments, and reputation.**

## Simple Pitch

**AI agents that remember privately, use skills safely, take action with permission, and prove what they did on 0G.**

## Final Positioning

Ivaronix is not just an AI chat app, not just a CLI coding agent, not just a skill marketplace, not just a memory vault, and not just a 0G demo.

Ivaronix is one operating system for trustworthy AI agents.

The product combines:

- private AI chat
- private docs/code workspace
- wallet-owned memory
- AI consensus
- burn mode
- permissioned skills
- action receipts
- agent passport
- developer CLI
- developer API
- team trust layer
- skill registry
- agent economy
- 0G Compute, Storage, Chain, DA, Router, and AgenticID

The rule is:

> Big architecture. Narrow insane demo.

The full platform is large, but the first demo must be simple, clear, and powerful.

---

# 1. Product Thesis

AI is moving from chat to action.

Agents will not only answer questions. They will:

- read documents
- audit code
- review contracts
- monitor wallets
- summarize communities
- call APIs
- create reports
- draft posts
- run scheduled jobs
- coordinate subagents
- eventually transact and pay other agents

But action creates risk.

Users, developers, teams, and companies need to know:

- What data did the agent access?
- Which model answered?
- Which skill ran?
- Did it touch private memory?
- Did it call an API?
- Did it edit files?
- Did it access a wallet?
- Was permission granted?
- Can sensitive data be destroyed after use?
- Can the output be traced?
- Can the agent build reputation over time?

Ivaronix answers this with one system:

> Memory + Skills + Permissions + Consensus + Burn Mode + Receipts + Identity + Economy.

The core belief:

> A blockchain transaction has a receipt. An AI action should have one too.

---

# 2. Final Product Shape

Ivaronix has five product surfaces.

## 2.1 Ivaronix Workspace

The main web app for users, teams, and companies.

Users can:

- create private agents
- upload confidential docs/code
- ask questions
- use consensus mode
- use burn mode
- install skills
- set permissions
- view action receipts
- view agent passports
- manage memory

Main wedge:

> Private docs/code agent with consensus, burn mode, skills, and 0G receipts.

## 2.2 Ivaronix Forge CLI

The developer terminal product.

Positioning:

> OpenCode + Octogent + Hermes + Graphiti + 0G Proof.

Meaning:

- OpenCode-style coding UX
- Octogent-style multi-agent orchestration
- Hermes-style persistent agent memory, skills, automations, gateways
- Graphiti-style temporal memory graph
- 0G-native storage, receipts, identity, and verification

The CLI is not only `ivaronix code`.

It is a developer workspace where coding agents remember, coordinate, use skills, and prove work.

## 2.3 Ivaronix API

OpenAI-compatible API with Ivaronix extensions.

Developers can:

- call models
- attach memory
- run skills
- enable consensus
- apply policies
- create receipts
- verify receipts
- use 0G proof where supported

## 2.4 Ivaronix Skill Registry

A verified skill registry for agents.

Not “random GitHub skills imported blindly.”

Instead:

> Ivaronix supports portable agent skills from GitHub and lets developers install, inspect, audit, permission, sandbox, and run them safely.

## 2.5 Ivaronix Trust Layer

The team/enterprise layer.

It provides:

- policy engine
- approval gates
- memory access control
- audit logs
- team workspaces
- agent fleet management
- spend limits
- compliance exports
- action receipt history

---

# 3. The Seven Core Layers

## 3.1 Agent Identity Layer

Every agent gets a passport.

### Agent Passport Includes

- owner wallet
- agent ID
- agent name
- agent avatar
- agent role
- agent personality
- model history
- memory root
- installed skills
- permission profile
- verified action history
- failed actions
- policy violations
- trust score
- receipts
- earnings later

### Future Extension

Later, Agent Passport can connect to:

- ERC-7857 / AgenticID
- iNFT agent ownership
- agent transfer
- agent cloning
- authorized usage
- agent marketplace

### Why It Matters

Agent identity makes agents persistent, portable, reputational, and eventually economic.

Without identity, agents are disposable sessions.

With identity, agents become long-lived digital workers.

---

## 3.2 Memory Layer

Memory is one of the biggest moats.

Ivaronix memory is not normal chat history.

It is a private, wallet-owned, encrypted, temporal memory system.

### Memory Features

- wallet-owned memory vault
- encrypted memory on 0G Storage
- memory graph
- memory ledger
- memory version history
- memory access logs
- memory diff
- memory source provenance
- project memory
- personal memory
- team memory later
- skill-specific memory
- memory personas
- memory import/export
- memory burn sessions
- memory permissions
- memory root stored on 0G

### Memory Personas

Users can separate memory into:

- work
- personal
- crypto
- legal
- research
- project
- company
- team

### Memory Actions

Users can:

- approve memory
- edit memory
- delete memory
- burn memory
- export memory
- import memory
- search memory
- ask memory
- view memory graph
- see which agent/skill accessed memory

### Core Line

> Your AI should remember you without owning you.

### Memory Permission Center

Ivaronix should include a clear Memory Permission Center.

This is the user-facing control panel for private memory access. Users can grant, deny, or revoke memory access by agent, skill, project, session, namespace, document collection, and later team workspace.

Every memory access should be visible:

- who accessed it
- when it was accessed
- why it was accessed
- which skill/model used it
- which receipt recorded it

This is the better version of "memory follows you": users do not only own memory; they actively govern it.

---

## 3.3 Skill Runtime Layer

Skills are apps for agents.

But random skills are dangerous.

So Ivaronix does not only provide a skill marketplace. It provides a permissioned skill runtime.

### Every Skill Has

- manifest
- permission labels
- memory access scope
- network/tool limits
- wallet access flag
- file write flag
- sandbox test
- scan result
- receipt requirement
- version history
- trust score
- creator identity
- pricing later

### Skill Manifest Example

```json
{
  "name": "github-audit",
  "permissions": ["read_repo", "run_tests"],
  "memoryAccess": "project_only",
  "networkAccess": ["github.com"],
  "walletAccess": false,
  "writesFiles": false,
  "receiptRequired": true
}
```

### First Skill Categories

- Legal / Risk Audit Skill
- GitHub Audit Skill
- Web3 Research Skill
- Smart Contract Review Skill
- Telegram / Discord Community Skill
- Wallet / Token Monitor Skill
- Content Creator Skill
- Private Document Skill

### Skill Safety Features

- permission labels before running
- sandbox testing
- skill risk scanner
- prompt injection warning
- suspicious URL warning
- secret/key leakage warning
- wallet-drain risk warning
- excessive permission warning
- malicious command warning
- version history
- provenance
- report malicious skill
- quarantine suspicious skill

### Agent Safety Guard

Every important agent action should pass through an Agent Safety Guard before execution.

The guard checks:

- file access
- memory access
- wallet access
- network access
- shell command access
- external posting
- private document access
- chain transaction access
- skill permissions

The user should see a plain permission prompt before risky actions:

```text
GitHub Audit Skill wants:
- read this repo
- inspect package files
- run tests
- create a receipt

It will not:
- access wallet funds
- post externally
- read personal memory
```

This is the Ivaronix version of an AI firewall: not only "AI can act", but "AI can act within visible limits."

### Important Wording

Do not claim:

> “Ivaronix guarantees this skill is safe.”

Say:

> “Ivaronix scans, sandboxes, labels, and limits skill risk before execution.”

---

## 3.4 Action / Workflow Layer

Agents should not only chat. They should act.

### Actions Agents Can Take

- read documents
- ask questions from docs
- audit code
- review contracts
- monitor wallets
- summarize Telegram/Discord
- generate reports
- run scheduled jobs
- call APIs
- draft posts
- draft PRs
- write tests
- write docs
- execute multi-step workflows

### Safe Autonomy Slider

Users control how much freedom an agent has.

1. Observe only
2. Suggest
3. Draft
4. Act with approval
5. Act automatically within limits

### Policy Engine Under The Slider

The slider is simple UX. Underneath, we need real policy.

Policy controls include:

- file allowlist/blocklist
- network allowlist/blocklist
- API allowlist/blocklist
- memory access scope
- wallet access scope
- max spend
- approval before posting externally
- approval before writing files
- approval before sending transactions
- dry-run mode
- incident log
- emergency stop

### Future Workflow DAGs

Later, workflows can become DAGs:

```text
Step 1 → Step 2 → Approval Gate → Tool Call → Receipt → Rollback / Retry
```

This makes Ivaronix useful for larger agent workflows and teams.

---

## 3.5 Consensus / Verification Layer

This is one of the biggest wow features.

Do not make it only “ask many models.”

The better version is:

# Adjudicated Consensus

For important tasks, Ivaronix runs multiple specialist agents.

### Consensus Roles

- Analyst
- Risk Reviewer
- Evidence Checker
- Red-Team Critic
- Final Judge

### Consensus Output

- model agreement
- model disagreement
- evidence coverage
- risk level
- final answer
- citations/sources
- receipt

### Use Cases

- confidential contract review
- private code audit
- smart contract review
- legal/business document review
- investment research
- token/project analysis
- security audit
- important decisions

### Important Wording

Do not say:

> “Truth score.”

Say:

> “Agreement score, disagreement summary, evidence coverage, risk level, and execution proof.”

### Simple Line

> Ivaronix does not ask one AI. It asks a council of models and shows where they agree, disagree, and why.

---

## 3.6 Receipt / Proof Layer

This is the most 0G-native layer.

Every important AI action creates an AI Action Receipt.

### Receipt Includes

- agent ID
- owner wallet
- model/provider
- verified/external/local label
- skill manifest hash
- memory root used
- input hash
- output hash
- files/docs touched
- tools used
- policy decision
- approval status
- cost
- 0G Storage root
- 0G Chain transaction
- optional TEE / Compute proof

### Receipt Types

- AI Action Receipt
- Consensus Receipt
- Burn Receipt
- Memory Access Receipt
- Skill Execution Receipt
- Code Change Receipt
- Document Review Receipt
- Agent Passport Update Receipt

### What Receipt Proves

A receipt proves:

- what happened
- what data was touched
- what model/skill was used
- what permissions were granted
- what hashes/results were produced
- where the proof is stored

A receipt does not prove:

- that the AI answer is definitely correct
- that no human should review legal/medical/financial decisions
- that external model providers are private unless explicitly verified

### Core Line

> A blockchain transaction has a receipt. An AI action should have one too.

### Proof Explorer

Ivaronix should have a public/shareable Proof Explorer for receipts.

Each important receipt should have a share page showing:

- receipt type
- agent ID
- owner wallet
- model/provider
- skill used
- memory/document roots used
- input/output hashes
- 0G Storage root
- 0G Chain transaction
- cost
- TEE verification status when available
- burn receipt link when relevant

The Proof Explorer should never reveal private plaintext. It should prove the action trail without leaking the underlying private document, memory, or prompt.

### Receipt-Based Reputation

Agent reputation should come from verified actions, not fake ratings.

Reputation signals should include:

- number of completed receipts
- successful verified actions
- failed or blocked actions
- policy violations
- skill execution history
- TEE verified runs
- user approvals and rejections
- dispute flags later

This creates real agent trust over time.

---

## 3.7 Economy Layer

Economy is not MVP-first, but the data model should be designed now.

### Future Economy Features

- agent wallet
- skill creator profile
- pay-per-run skills
- subscriptions
- agent payments
- skill-to-skill payments
- agent-to-agent payments
- escrow
- invoices
- revenue splits
- bounties
- refunds for failed jobs
- reputation-based pricing
- agent marketplace
- skill marketplace

### Why It Matters

If agents use skills, skills need payments.

If agents do work, work needs escrow.

If creators publish skills, creators need revenue.

If agents build reputation, reputation should affect pricing.

---

# 4. Killer MVP Workflow

The MVP should be one clear workflow.

# Ivaronix Private Agent Workspace

## Ask private docs/code with consensus, burn mode, skills, and 0G receipts.

### Demo Flow

1. User connects wallet.
2. User creates a private agent.
3. User uploads a confidential contract or codebase.
4. User turns on Burn Mode.
5. User installs Legal/Risk Audit Skill or GitHub Audit Skill.
6. Skill shows permission labels.
7. User approves the skill.
8. Multiple models/specialist agents review the document/code.
9. Ivaronix gives:
   - plain-English summary
   - risky clauses / code issues
   - missing terms / security risks
   - source citations
   - model disagreement
   - agreement score
   - risk level
10. Ivaronix burns the session key.
11. Action Receipt is stored on 0G Storage.
12. Receipt hash is anchored on 0G Chain.
13. Agent Passport updates.
14. Same task is shown from CLI.

### CLI Version

```bash
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
```

### Why This Demo Wins

This one workflow proves:

- private docs
- private memory
- AI consensus
- burn mode
- skills
- permission labels
- receipts
- 0G Storage
- 0G Chain
- agent passport
- CLI
- developer story
- full 0G-native thesis

Do not demo 20 random features.

Demo one insane workflow that proves the entire OS.

---

# 5. Ivaronix Forge CLI

## Final CLI Positioning

# Ivaronix Forge

**OpenCode + Octogent + Hermes + Graphiti + 0G Proof**

### What That Means

- OpenCode-style coding agent UX
- Octogent-style multi-agent orchestration
- Hermes-style persistent agent life, skills, automations, gateways
- Graphiti-style temporal memory graph
- 0G-native storage, receipts, identity, and verification

### CLI Product Sentence

> Ivaronix Forge is an OpenCode-style AI agent workspace where coding agents remember projects, install skills, coordinate subagents, and prove their work on 0G.

---

## CLI Commands

```bash
ivaronix init
ivaronix code "fix this bug"
ivaronix code "explain this repo"
ivaronix audit "review this repo"
ivaronix plan "ship wallet login"
ivaronix swarm run todo.md
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
ivaronix memory search "what did we decide about pricing?"
ivaronix skill install github-audit
ivaronix skill inspect github-audit
ivaronix skill permissions github-audit
ivaronix policy edit
ivaronix receipt verify <hash>
ivaronix passport show
ivaronix watch repo --daily
```

---

## `.ivaronix/` Folder Design

```text
.ivaronix/
  AGENT.md
  MEMORY.md
  policies/
    default.json
  receipts/
    <receipt-id>.json
  skills/
    github-audit/
    contract-review/
  workspaces/
    backend/
      CONTEXT.md
      todo.md
      notes.md
    frontend/
      CONTEXT.md
      todo.md
      notes.md
  graph/
    episodes/
    facts/
  snapshots/
  worktrees/
```

### Why This Matters

Agents can read project files instead of relying only on chat history.

This makes the CLI:

- durable
- inspectable
- team-friendly
- debuggable
- composable
- better for long-running projects

---

## CLI Agent Modes

```text
plan      read-only analysis
build     edit files with approval
audit     security/code review only
doc       private document analysis
swarm     multi-agent execution
watch     scheduled/background monitoring
receipt   verification mode
```

---

## CLI Must-Have Features

- TUI like OpenCode
- provider-agnostic models
- 0G verified model route
- plan/build modes
- LSP/repo awareness
- local project memory
- temporal memory graph
- skill install/run
- permission prompts
- multi-agent swarm from todo.md
- scoped workspaces
- inter-agent messages
- git worktree isolation
- action receipts
- receipt verification
- 0G Storage upload for memory/receipts
- 0G Chain anchoring for receipt hashes
- burn mode for docs/secrets
- consensus mode for audits

---

# 6. Ivaronix API

## API Positioning

> Use Ivaronix like OpenAI, but with memory, skills, consensus, policy, receipts, and 0G proof.

### Example API Call

```ts
await ivaronix.run({
  model: "qwen",
  input: "Analyze this repo",
  memory: true,
  skill: "github-audit",
  consensus: true,
  receipt: true
})
```

### API Endpoints

- `/chat`
- `/run`
- `/documents/ask`
- `/consensus`
- `/skills/run`
- `/memory/query`
- `/receipts/create`
- `/receipts/verify`
- `/agents`
- `/policies`

### API Features

- OpenAI-compatible API
- TypeScript SDK
- Python SDK
- API keys
- usage dashboard
- model routing
- private mode
- proof mode
- memory API
- skill API
- consensus API
- receipt API
- policy API
- webhooks later

### Model Labels

Every model/output should be labeled clearly:

- 0G Verified
- 0G Private Compute
- External Provider
- Local Model
- Not Verified
- Consensus Mode

Important:

> 0G verified inference only applies when using a real 0G Compute / Private Computer / TEE path. External and local models must be labeled honestly.

---

# 7. Burn Mode / Ephemeral Session Vault

## Better Name

# Ephemeral Session Vault

## Simple Meaning

Use sensitive data once, then destroy the key so it becomes unreadable.

## How It Works

1. Encrypt first.
2. Use session key.
3. Process document/code.
4. Delete local temp files.
5. Delete cache.
6. Delete embeddings.
7. Destroy key.
8. Create Burn Receipt.

## Use Cases

- confidential contracts
- legal docs
- private code
- investor decks
- financial docs
- medical docs
- wallet/security analysis
- private chat
- company strategy docs

## Critical Wording

Do not say:

> “We delete from blockchain.”

Say:

> The encrypted data may remain stored, but the key is destroyed, making it unreadable.

---

# 8. Private Document / Code Room

This is the best first PMF wedge.

## Features

- upload contract
- upload repo/codebase
- upload PDF
- upload pitch deck
- upload legal/business docs
- ask private questions
- get plain-English answer
- get source/clause citations
- run consensus review
- use burn mode
- use skills
- generate action receipt
- share proof without exposing private document

## Example Questions

- “Find risky clauses.”
- “Explain this contract simply.”
- “What obligations do I have?”
- “Compare these two versions.”
- “Find security issues in this repo.”
- “What files handle wallet login?”
- “What is the biggest business risk here?”
- “Which part of this code can break?”
- “What is missing from this agreement?”

## Why This Is The First Wedge

It is easier to sell than a generic AI marketplace.

People understand:

> I have sensitive docs/code. I want AI help. I do not want to leak it. I want multiple-model review. I want the data burned after use. I want proof of what happened.

---

# 9. Skill Registry

## Correct Positioning

Do not say:

> “We import all GitHub skills.”

Say:

> Ivaronix supports portable agent skills from GitHub and lets developers install, inspect, audit, permission, sandbox, and run them safely.

## Skill Commands

```bash
ivaronix skill search github-audit
ivaronix skill add github.com/user/repo/path/to/skill
ivaronix skill inspect github-audit
ivaronix skill permissions github-audit
ivaronix skill run github-audit --receipt
```

## Supported Skill Types

- SKILL.md skills
- GitHub repo skills
- MCP servers
- local skills
- official 0G agent skills
- OpenCode-compatible commands
- Hermes-style skills later
- OpenClaw-style skills later

## Skill Registry Features

- permission manifest
- safety scan
- sandbox
- provenance
- version history
- reputation
- verified runs
- receipt history
- creator profile
- pricing later

---

# 10. 0G Integration

## 10.1 0G Compute

Use for:

- private/verifiable inference
- AI consensus
- skill execution
- evaluator agents
- future fine-tuning
- model/provider routing where supported

## 10.2 0G Storage

Use for:

- encrypted memory
- documents
- code snapshots
- skill packages
- receipts
- logs
- traces
- burn-mode encrypted sessions
- knowledge base
- memory graph artifacts

## 10.3 0G Chain

Use for:

- receipt registry
- agent identity
- skill registry
- reputation
- payment settlement
- revenue splits
- passport hashes
- burn receipts

## 10.4 0G DA

Use later for:

- high-volume logs
- batched receipts
- action/event streams
- agent marketplace activity
- appchain/rollup scale

Do not force DA into MVP.

## 10.5 Router

Use where possible for:

- one API key
- routing/failover
- unified billing
- OpenAI-compatible flows
- easier server-side integration

## 10.6 AgenticID / ERC-7857

Use later for:

- ownable agents
- transferable agents
- cloning
- authorized usage
- iNFT marketplace
- agent ownership economy

Do not make NFTs the MVP headline.

---

# 11. Feature Priority

## Must Build First

1. Wallet login
2. Create private agent
3. Choose model
4. Private Document / Code Room
5. Memory Vault
6. Memory Permission Center
7. Ask My Docs
8. AI Consensus
9. Burn Mode
10. One skill: Legal/Risk Audit or GitHub Audit
11. Agent Safety Guard and skill permission labels
12. Action Receipt
13. Proof Explorer basic receipt page
14. 0G Storage proof
15. 0G Chain anchoring
16. Agent Passport
17. Receipt-based reputation counters
18. Operator Pays Mode for onboarding/testnet demo
19. Ivaronix Forge CLI demo
20. Forge CLI Proof Mode
21. Ivaronix API demo

## Build Soon

1. Memory graph
2. Web3 Research Skill
3. GitHub Audit Skill
4. Smart Contract Review Skill
5. Telegram / Discord Skill
6. Wallet Monitor Skill
7. Skill scanner
8. Skill sandbox
9. Advanced Receipt Explorer
10. Developer dashboard
11. Repo memory
12. Consensus code review
13. Team workspace alpha
14. Shared team memory
15. Team audit logs

## Build Later

1. Full marketplace
2. Creator earnings
3. Full team workspace
4. Advanced approval workflows
5. Full marketplace
6. Agent payments
7. Escrow
8. Agent-to-agent hiring
9. Browser extension
10. Mobile app
11. Fine-tuning
12. iNFT marketplace
13. Agent staking/insurance
14. Full enterprise compliance suite

---

# 12. What To Cut From MVP

Cut these from MVP:

- full mobile app
- voice chat
- full marketplace
- 100 skills
- full enterprise dashboard
- full payments
- agent-to-agent economy
- NFT marketplace
- insurance/staking
- own LLM training from scratch
- public-sector/city AI product first
- full browser extension
- DAO governance
- fine-tuning platform

These are roadmap items, not first demo.

---

# 13. Strategic Differentiators From 0G Ecosystem Research

These seven features should be treated as core Ivaronix advantages because they combine the best patterns seen across hackathon entries and showcase projects.

## 13.1 Proof Explorer

Inspired by BuildProof, AlphaTrace, ChainShield, Provus, FX Risk Agent, and YieldBoost.

Ivaronix should make every important AI action inspectable through a clean proof page. Users should be able to share proof without leaking private content.

## 13.2 Memory Permission Center

Inspired by SealedMind, MindVault, Synapse, Aishi, and 0G OpenClaw.

Ivaronix should make memory ownership practical: grant memory to an agent, revoke memory from a skill, separate project/personal/team memory, and show memory access receipts.

## 13.3 Team Workspace First-Class

Inspired by AgentHub, ChainShield, BuildProof, and enterprise AI governance needs.

Teams need shared company memory, shared private docs, role-based access, approval workflows, audit logs, policy controls, and proof receipts. This is likely the strongest paid-user expansion after the MVP.

## 13.4 Agent Safety Guard

Inspired by Don't Get Drained, AgentHub, ChainShield, VeilSolver, and BlindMarket.

Every skill/action should show risk and request permission before touching files, memory, wallet, network, shell, private docs, or external services.

## 13.5 Forge CLI Proof Mode

Inspired by OpenCode, Octogent, Hermes, MUSASHI, 0G OpenClaw, and developer workflows.

Forge should become viral among developers because it can do:

```bash
ivaronix audit repo --receipt --verify-tee
```

That proves what repo was audited, which model reviewed it, what skill ran, what output was produced, what 0G Storage root exists, and what 0G Chain transaction anchored it.

## 13.6 Receipt-Based Reputation

Inspired by POD, BuildProof, zer0Gig, Agentra, and Agent Passport concepts.

Agent reputation should come from verified actions: successful receipts, policy-safe behavior, skill history, user approvals, and verified model runs.

## 13.7 Operator Pays Mode

Inspired by ZeroViza.

Users should not need to understand gas, compute deposits, or Router payment flows just to try Ivaronix. For onboarding, the user connects wallet for identity while Ivaronix pays testnet gas/compute where appropriate. Power users can later bring their own key/wallet/payment setup.

---

# 14. Why Ivaronix Beats Other 0G Projects

Most projects are strong in one lane.

Examples:

- MindVault / SealedMind = memory
- AgentPay = payments
- Agent0G = marketplace/workflow builder
- ChainShield = audit/proof
- Don’t Get Drained = safety/firewall
- AlphaDawg = consensus/debate
- Aishi = agent identity/personality
- 0GClaw = scheduled autonomous agents
- ShadowFlow = workflow DAGs

Ivaronix wins by combining:

```text
Memory + Identity + Skills + Permissions + Consensus + Receipts + CLI/API + Economy
```

But it demos through one clear workflow:

```text
Private docs/code → consensus review → burn mode → action receipt → agent passport
```

That is the difference.

---

# 15. Product Roadmap

## Phase 0 — Hackathon / Grant Demo

Build:

- web app
- private document room
- memory vault
- memory permission center
- one skill
- agent safety guard
- consensus
- burn mode
- receipt
- proof explorer basic receipt page
- chain proof
- operator pays mode for testnet onboarding
- CLI mini demo
- Forge proof mode
- API mini demo

## Phase 1 — Developer Wedge

Build:

- Ivaronix Forge CLI
- repo memory
- code audit
- skill install
- receipt verify
- OpenAI-compatible API
- docs
- SDK basics

## Phase 2 — Skill Runtime

Build:

- skill registry
- skill scanner
- permission manifests
- sandbox
- public skill pages
- first-party skill packs
- creator profiles

## Phase 3 — Team Trust Layer

Build:

- shared workspaces
- team memory
- approval policies
- audit dashboard
- spend limits
- compliance export
- role-based permissions

## Phase 4 — Agent Economy

Build:

- agent wallets
- payments
- pay-per-run skills
- escrow
- revenue splits
- agent marketplace
- AgenticID / iNFT support

---

# 16. Web App Pages

## Public Website

- Landing Page
- Product Overview
- Use Cases
- 0G Integration Page
- CLI Page
- API Page
- Docs Page
- Pricing / Waitlist
- Demo Video Page

## App Pages

- Dashboard
- Create Agent
- Private Document / Code Room
- Chat / Ask Docs
- Memory Vault
- Memory Graph
- Skill Store
- Skill Detail Page
- Consensus Result Page
- Burn Receipt Page
- Action Receipt Page
- Agent Passport Page
- CLI Setup Page
- API Keys Page
- Developer Dashboard

## Docs Pages

- Quickstart
- CLI Install
- API Quickstart
- 0G Storage Setup
- 0G Compute Setup
- 0G Chain Receipt Setup
- Skill Manifest Docs
- Policy Docs
- Receipt Verification Docs
- Burn Mode Explanation
- Model Labels Explanation
- Example Apps

---

# 17. Repository / Organization Structure

Create a GitHub Organization:

```text
github.com/ivaronix
```

Start with one monorepo:

```text
ivaronix/ivaronix
```

## Monorepo Structure

```text
ivaronix/
  apps/
    web/
    api/
    cli/
    docs/
  packages/
    core/
    memory/
    consensus/
    receipts/
    policy/
    skills/
    og/
    sdk-js/
    sdk-python/
  contracts/
    ReceiptRegistry/
    AgentPassport/
    SkillRegistry/
  examples/
    private-doc-agent/
    github-audit-agent/
    smart-contract-review/
    telegram-agent/
  docs/
  .github/
```

## Why Monorepo First

- faster team coordination
- shared types
- shared SDK logic
- one CI/CD
- one issue tracker
- easier hackathon/grant demo
- easier refactoring

Later, split repos only if needed:

- `ivaronix-cli`
- `ivaronix-sdk-js`
- `ivaronix-contracts`
- `ivaronix-skills`
- `ivaronix-docs`

---

# 18. Team Build Split

## Frontend Team

- landing page
- web app
- create agent flow
- private doc room
- memory UI
- consensus UI
- receipt UI
- agent passport UI

## Backend Team

- document ingestion
- inference routing
- consensus orchestration
- memory extraction
- burn mode logic
- skill runner
- receipt generation
- API endpoints

## Blockchain / 0G Team

- 0G Storage integration
- encrypted upload/download
- receipt registry contract
- agent passport contract
- skill registry contract
- chain anchoring
- transaction proof UI

## CLI Team

- terminal UI
- project scanner
- repo memory
- code agent
- skill install/run
- receipt verify
- doc ask
- consensus command

## Product / GTM Team

- pitch deck
- demo video
- docs
- 0G ecosystem outreach
- grant applications
- developer examples
- launch copy

---

# 19. Risk Wording / Claims To Avoid

## Avoid

- “We delete blockchain data.”
- “AI consensus proves truth.”
- “Proof receipt proves the answer is correct.”
- “Every model is 0G verified.”
- “Private AI is always private.”
- “Skill scanner guarantees safety.”
- “We are importing all GitHub skills.”
- “NFT marketplace is the core product.”

## Use Instead

- “Burn Mode destroys the encryption key, making encrypted data unreadable.”
- “Consensus shows agreement, disagreement, evidence coverage, and risk level.”
- “Receipts prove provenance and execution trace.”
- “0G Verified applies only to supported 0G/private compute paths.”
- “External/local models are labeled honestly.”
- “Skill scanner reduces and labels risk.”
- “Ivaronix supports portable skills and lets users inspect, permission, sandbox, and run them safely.”
- “AgenticID/iNFT is a future ownership layer, not the MVP headline.”

---

# 20. Final Positioning By Audience

## For Users

> Private AI agents that read your docs, remember your context, burn secrets, and prove what they did.

## For Developers

> OpenCode-style AI agent workspace with 0G memory, skills, consensus, and receipts.

## For Teams

> Govern AI agents before they touch files, tools, wallets, code, customers, or private memory.

## For Creators

> Publish trusted skills and earn when agents use them.

## For 0G Labs

> Ivaronix turns 0G Compute, Storage, Chain, DA, AgenticID, Router, and skills into one daily-use Agent OS.

---

# 21. Final YC Pitch

> AI agents are moving from chat to action. But action creates risk: agents read private data, run skills, touch code, call APIs, access wallets, and make decisions without proof. Ivaronix is the 0G-native Agent OS that gives agents private memory, permissioned skills, consensus review, burn mode, action receipts, identity, CLI/API, and payments. We start with private docs/code agents and expand into the trust layer for all action-taking AI agents.

---

# 22. Final 0G Labs Pitch

> 0G built the infrastructure for decentralized AI. Ivaronix is the product that makes it useful every day. 0G Compute powers private/verifiable inference. 0G Storage stores encrypted memory, docs, skills, logs, and receipts. 0G Chain anchors receipts, agent identity, reputation, and payments. 0G DA scales event availability later. Ivaronix is where 0G agents remember, act, prove, and earn.

---

# 23. Final Product Sentence

# Ivaronix
## The 0G Agent Operating System

> Users create private agents. Agents get memory. Users install permissioned skills. Agents ask many models for consensus. Sensitive data can burn after use. Every important action gets a proof receipt. Developers use it through CLI/API. Teams govern it. Creators earn from skills. 0G powers the compute, storage, identity, receipts, and economy.

---

# 24. Final Build Instruction

If the team only has money as the blocker, build Ivaronix in this order:

1. **Private Document / Code Room**
2. **Memory Vault**
3. **Consensus Review**
4. **Burn Mode**
5. **Action Receipts**
6. **Agent Passport**
7. **Ivaronix Forge CLI**
8. **Ivaronix API**
9. **First-Party Skills**
10. **Skill Registry**
11. **Team Trust Layer**
12. **Marketplace + Payments**

Do not start by building everything equally.

Start with one workflow that proves the whole OS:

```text
Private docs/code → consensus review → burn mode → action receipt → agent passport → CLI/API proof
```

That is the final product.
