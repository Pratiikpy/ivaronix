# Ivaronix

## Simple Explanation

Ivaronix is a private AI workroom for important documents, code, and agent actions.

Think of it like this:

Normal AI tools can answer a question.

Ivaronix answers the question, records what happened, signs the result, and gives you a receipt that other people can verify.

The main idea is:

> Private AI agents for sensitive work. Every important action leaves a receipt.

This means Ivaronix is useful when the work is too important for "trust me bro." Examples:

- reviewing a private contract
- checking risky clauses in a legal document
- auditing code
- reviewing a GitHub repo
- checking a 0G integration
- running a verified skill
- proving that an AI action happened
- showing proof without exposing the private file

The product has two main parts:

1. **Ivaronix Studio**
   - the web app
   - used by normal users, founders, teams, and judges

2. **Ivaronix CLI / Forge**
   - the terminal app
   - used by developers and technical users

Both are connected by the same trust system:

- AI runs
- receipts
- 0G Compute
- 0G Chain
- 0G Storage support
- Agent Passport
- skills
- memory
- proof pages

---

## Why Ivaronix Exists

AI agents are starting to do real work.

They can read files, use tools, call models, write code, remember context, and make decisions.

But there is a problem:

How do we know what the AI actually did?

How do we know which model was used?

How do we know which skill was used?

How do we know if the result was changed later?

How do we share proof without showing the private document?

Ivaronix solves this with **AI Action Receipts**.

An AI Action Receipt is like a bill or transaction receipt, but for an AI action.

It can show:

- who ran the action
- which skill was used
- which model was used
- what type of action happened
- whether 0G Compute was used
- whether TEE verification was requested
- the receipt hash
- the chain transaction
- the agent passport
- the cost
- the proof link

Simple line:

> ChatGPT can answer. Ivaronix can prove what happened.

---

## Current Honest Status

Ivaronix has strong testnet functionality.

Current verified testnet numbers from project docs:

- 1600+ receipts anchored on 0G Galileo testnet
- 8 deployed contracts on Galileo
- 150+ skills in the catalog
- 160+ Foundry contract tests passing
- 20+ workspace packages typecheck-clean
- Studio routes tested
- CLI commands tested
- receipt verification tested
- burn-mode receipt tested
- 0G Compute TEE verification tested
- Agent Passport tested
- memory grant/revoke tested

Important honest note:

0G Chain and 0G Compute are used in the core proof flow today.

0G Storage is wired end-to-end in both the CLI and Studio paths. Every receipt anchor — Studio `/api/run` and `ivaronix run` alike — goes through `runPipeline` → `anchorReceipt` (`packages/runtime/src/pipeline.ts`), which uploads the evidence blob to 0G Storage (Burn-Mode ciphertext when burn is on, plaintext context bytes when off) via `@0gfoundation/0g-ts-sdk`'s `Indexer` against `indexer-storage-testnet-turbo.0g.ai`, and writes the returned Merkle root onto the receipt's `storage.evidenceRoot`.

When the storage indexer is unreachable, the receipt honestly omits `evidenceRoot` (no fake root, no silent retry), and RunPanel's Storage light stays pending instead of going green — the trust gradient is visible to the operator and reader.

What is NOT yet done: end-to-end verification of the upload + retrieve round-trip against the live testnet indexer. Code path is wired; the live verification is punch-list item #26.

---

## How One Ivaronix Action Works

Imagine a founder uploads a contract and asks:

> Find risky clauses before I sign this.

Ivaronix does this:

1. The user uploads or pastes the document.
2. The user chooses a skill, like private document review.
3. Ivaronix sends the task to AI.
4. If using the trusted path, the model runs through 0G Compute / Router.
5. The result comes back with model and attestation data.
6. Ivaronix creates a receipt.
7. The receipt is signed by the operator or user flow.
8. The receipt hash is anchored on 0G Chain.
9. The Agent Passport can update its receipt count and trust state.
10. The user gets a public proof page.

The user can share the proof page without sharing the original private document.

That is the main magic.

---

## 0G Components Used

### 1. 0G Compute

0G Compute is used for AI inference.

In simple words:

It is where the AI model runs.

Ivaronix uses it so that AI actions can be tied to a trusted compute path.

When a receipt is TIER 1, it means:

- the action used the 0G Compute / Router path
- TEE verification is requested or supported
- the receipt can show stronger proof

Ivaronix can also use external models like NVIDIA NIM.

Those are marked honestly as TIER 2.

That means:

- the result is still signed
- the receipt is still anchored
- but it is not shown as TEE-verified 0G Compute

This matters because Ivaronix does not pretend external compute is the same as TEE compute.

### 2. 0G Chain

0G Chain is used to anchor receipts and manage identity-related proof.

In simple words:

The receipt hash is written to the blockchain.

This makes it hard to secretly change the receipt later.

Ivaronix uses contracts like:

- ReceiptRegistry
- ReceiptRegistryV2
- AgentPassportINFT
- AgentPassportINFTV2
- CapabilityRegistry
- MemoryAccessLog
- SkillRegistry
- Erc7857Verifier

The chain is used for:

- receipt anchors
- passport identity
- skill registry
- memory permission events
- receipt count
- trust updates
- public verification links

### 3. 0G Storage

0G Storage is meant to store evidence, encrypted files, receipts, and burn-mode ciphertext.

In simple words:

It is where the proof data can live outside a normal server.

Ivaronix has a storage package that can:

- upload bytes to 0G Storage
- return a root hash
- upload encrypted burn-mode data
- download by root hash
- check file locations

Current state:

The storage SDK is wired into the normal Studio run path via `runPipeline` → `anchorReceipt`. Every Studio `/api/run` anchor uploads to 0G Storage and the returned Merkle root lands on the receipt's `storage.evidenceRoot`. The Studio API only returns no root when the indexer was unreachable on that run — fail-open by design, never a fake root. Live indexer round-trip verification is queued (punch-list #26).

### 4. Agent ID / Agent Passport

Every serious agent needs an identity.

Ivaronix uses an Agent Passport concept.

In simple words:

An Agent Passport is like a profile card for an AI agent.

It can show:

- owner wallet
- token ID
- trust score
- receipt count
- violation count
- recent receipt activity
- authorized executors

This matters because AI agents should not be faceless.

If an agent does good verified work, its history should follow it.

### 5. 0G Memory / Persistent Memory Support

Ivaronix has memory features.

In simple words:

The agent can remember useful context and recall it later.

There are two memory levels:

1. Studio memory
   - lightweight notes in the web app
   - useful for demo and quick user memory
   - currently uses local `.ivaronix` files in the running environment

2. CLI memory
   - stronger developer memory path
   - encrypted memory engine
   - commands for remember, recall, grant, revoke, log, snapshot
   - can connect to memory sidecar / persistent memory paths when configured

Memory can also connect to on-chain permission events through:

- CapabilityRegistry
- MemoryAccessLog

### 6. 0G DA

0G DA is not a core active product path yet.

It is planned for future high-volume receipt and event batching.

In simple words:

If Ivaronix has many receipts and logs later, DA can help make that data available at scale.

Current status:

- there is a CLI `da preflight`
- public testnet endpoint availability is limited
- DA is future/deeper integration, not the main demo spine today

---

## Ivaronix Studio Features

Studio is the web app.

It is what a normal person sees in the browser.

### 1. Home Page

The home page explains the product and shows the main flow.

What it does:

- shows the Ivaronix brand
- shows the proof-first message
- shows live or configured receipt numbers
- gives users a place to start
- points people toward running an AI action

Why it matters:

The user should understand fast:

> I upload private work, AI reviews it, and I get proof.

### 2. Run Panel

The Run Panel is where the user runs an AI action from the browser.

What the user can do:

- choose a skill
- paste or upload content
- ask a question
- choose strictness or tier
- choose burn mode when available
- run the action
- get a receipt

How it works:

The browser sends the request to `/api/run`.

The API calls the shared runtime pipeline.

The runtime:

- loads the skill
- scans permissions
- checks the skill registry
- runs the model
- creates a receipt
- anchors the receipt if requested

0G used:

- 0G Compute for model execution on the trusted path
- 0G Chain for receipt anchoring
- Agent Passport for receipt identity updates
- 0G Storage for evidence — wired into the Studio `/api/run` path; live indexer round-trip verification queued (punch-list #26)

### 3. Proof Explorer

Proof Explorer is the public receipt page.

Route:

`/r/<id>`

What it shows:

- receipt ID
- action type
- skill used
- model used
- compute tier
- TEE status
- chain anchor
- transaction hash
- burn-mode evidence if used
- output hash
- fee split if present
- verification lights

Why it matters:

This is the page you share when someone asks:

> Did the AI really do this?

It does not need to expose the private document.

It shows the proof trail.

0G used:

- reads receipt data
- checks chain anchor
- shows ChainScan links
- shows TEE / 0G Compute status when available

### 4. Skills Page

Route:

`/skills`

What it does:

- lists available skills
- shows skill names
- shows descriptions
- shows permission and trust information
- gives users a way to inspect what a skill does

What a skill is:

A skill is a reusable AI capability.

Examples:

- private-doc-review
- github-audit
- 0g-integration-auditor
- code-edit
- plan-step
- content-pitch-review

Why it matters:

Users should not run random AI prompts blindly.

A skill should say:

- what it does
- what it can access
- what permissions it needs
- whether receipts are required
- whether burn mode is enabled
- how creator fee split works

0G used:

- SkillRegistry can anchor registered skills
- receipts record the skill ID and manifest hash
- fee splits can be recorded in receipt billing

### 5. Skill Detail Page

Route:

`/skill/<id>`

What it shows:

- skill details
- manifest information
- permission model
- creator information
- fee split
- safety and registry status

Why it matters:

Before using a skill, users should know what it is allowed to do.

This is like checking an app's permissions before installing it.

### 6. Skill Builder Page

Route:

`/skill/new`

What it does:

- lets a user create a new skill from the UI
- gives a live preview of the skill markdown
- saves a skill into the workspace skill folder

Why it matters:

This supports the future creator economy.

Creators can build skills, publish them, and later earn from verified runs.

Current note:

In production, saving skills should use proper persistent storage and permission rules, not rely only on local workspace files.

### 7. Memory Page

Route:

`/memory`

What it does:

- shows memory notes
- lets users remember notes
- lets users recall notes
- shows grant/revoke style memory permission state
- connects memory permissions to wallet identity

How it works:

Studio memory is lightweight.

It stores notes by wallet.

CLI memory is stronger and has encrypted memory features.

0G used:

- memory grants and access logs can be recorded on 0G Chain
- MemoryAccessLog records memory-related events
- CapabilityRegistry controls permission grants
- future full path can use 0G Storage / Persistent Memory more deeply

### 8. Agent Page

Route:

`/agent/<wallet-or-handle>`

What it shows:

- agent passport
- wallet identity
- token ID
- trust score
- receipt count
- violations
- recent activity
- links to receipts

Why it matters:

This is the agent's public reputation page.

Instead of fake ratings, trust comes from receipts.

0G used:

- AgentPassportINFT / AgentPassportINFTV2 on 0G Chain
- receipt count and trust data from chain-facing contracts

### 9. Agents Page

Route:

`/agents`

What it does:

- shows minted agent passports
- shows a leaderboard or list of agents
- shows which agents have receipt history

Why it matters:

This helps show the agent identity layer.

In the future, this can become part of an agent reputation system.

### 10. Dashboard Page

Route:

`/dashboard`

What it does:

- gives a summary view of the user's Ivaronix state
- can show receipts
- can show passport state
- can show memory and skill usage

Why it matters:

The dashboard helps users understand what their agent has done.

### 11. Global Page

Route:

`/global`

What it does:

- shows public/global platform activity
- can show receipts, agents, and network-level proof activity

Why it matters:

It makes Ivaronix feel like a live network, not only a single local tool.

### 12. Onboard Page

Route:

`/onboard`

What it does:

- helps new users start
- guides them through wallet connection
- helps create or view agent identity
- moves them toward first receipt

Why it matters:

People should not need to understand the whole system before using it.

Good onboarding should make the first useful receipt easy.

### 13. Brand Page

Route:

`/brand`

What it does:

- shows the Ivaronix visual identity
- keeps design consistent
- helps make the project look serious and polished

Why it matters:

The product should feel like a real company, not a weekend demo.

### 14. 0G Integration Page

Route:

`/0g`

What it should explain:

- how Ivaronix uses 0G Compute
- how receipts anchor on 0G Chain
- how storage roots and evidence should work
- how Agent Passport fits in
- how verification happens

Why it matters:

This page can work like a professional technical tutorial.

Instead of a boring document, it can show an interactive flow:

User action -> 0G Compute -> receipt -> 0G Chain -> proof page.

### 15. Docs Page

Route:

`/docs`

What it does:

- gives developer and product documentation
- links to API, proof, receipts, and architecture

Why it matters:

Judges and developers need a clean way to understand and reproduce the project.

### 16. Data Room

Route:

`/data-room/<id>`

What it is:

A private room for shared sensitive data or delegated access.

Why it matters:

This is useful for teams and multi-party workflows.

Example:

A founder shares one document with an auditor or agent, while keeping the proof trail controlled.

### 17. Delegate Page

Route:

`/delegate/<id>`

What it is:

A page for delegated agent access or handoff flows.

Why it matters:

AI agents sometimes need limited permission to act for someone else.

Delegation must be visible and controlled.

### 18. Embed Pages and Widget

Routes:

- `/embed`
- `/embed/r/<id>`

What they do:

- let other sites embed a receipt verification view
- help third-party projects show proof from Ivaronix

Why it matters:

This can make Ivaronix useful outside its own website.

Example:

A project can show an Ivaronix receipt inside its own docs or dashboard.

---

## Ivaronix CLI / Forge Features

The CLI is for developers.

It lets people use Ivaronix from the terminal.

The CLI is important because developers trust tools they can run, inspect, and verify.

### 1. Interactive Chat TUI

Command:

`ivaronix`

What it does:

- opens an interactive terminal chat
- supports slash commands
- can use active skills
- can save and resume sessions
- can show model, cost, memory, passport, and usage info

Slash commands include:

- `/help`
- `/cost`
- `/passport`
- `/skill`
- `/model`
- `/memory`
- `/history`
- `/resume`
- `/save`
- `/clear`
- `/retry`
- `/undo`
- `/usage`
- `/skills`
- `/exit`

Why it matters:

This is like an OpenCode-style terminal AI agent, but connected to Ivaronix receipts and 0G proof.

Current testing note:

The core CLI paths are tested.

The live keyboard feel of the TUI still benefits from human terminal testing, because actual keypress behavior is hard for an automated agent to fully judge.

### 2. Classic Chat

Command:

`ivaronix chat-classic`

What it does:

- provides a simpler readline chat fallback
- useful for SSH, scripts, or simpler environments

### 3. Demo Command

Command:

`ivaronix demo`

What it does:

- runs a sample AI action
- creates a receipt
- anchors it on 0G Chain
- prints proof links

Why it matters:

This is the quickest way to prove the system works.

0G used:

- 0G Compute for model call on trusted path
- 0G Chain for receipt anchor
- Agent Passport update when available

### 4. Document Ask

Command:

`ivaronix doc ask <file> <question>`

Example:

`ivaronix doc ask contract.pdf "find risky clauses" --burn --quick`

What it does:

- reads a document
- asks an AI skill to analyze it
- can use burn mode
- creates a receipt
- anchors proof on chain

Why it matters:

This is the killer first workflow.

Users can analyze private documents and keep proof.

0G used:

- 0G Compute for AI analysis
- 0G Chain for receipt anchor
- 0G Storage support for encrypted evidence paths

### 5. Bulk Document Review

Command:

`ivaronix doc bulk <dir>`

What it does:

- runs document analysis over many files
- useful for teams or large review jobs

### 6. Code, Audit, Plan, Watch, Swarm

Commands include:

- `ivaronix code`
- `ivaronix audit`
- `ivaronix plan`
- `ivaronix watch`
- `ivaronix swarm run <todo>`

What they do:

- code helps with coding tasks
- audit reviews code or projects
- plan helps plan work
- watch can monitor scheduled work
- swarm can run work from a todo file

Why it matters:

This makes Ivaronix useful for developer workflows, not only document review.

The long-term idea is:

OpenCode-style CLI + durable memory + skill system + 0G receipts.

### 7. Receipt Commands

Commands include:

- `ivaronix receipt verify <id-or-path>`
- `ivaronix receipt verify <id> --tee-independent`
- `ivaronix receipt anchor <signed-receipt>`
- `ivaronix receipt show <id>`
- `ivaronix receipt list`

What they do:

- verify receipt schema
- verify receipt hash
- verify signature
- verify chain anchor
- optionally verify TEE evidence through 0G Compute broker
- show receipt details
- list local receipts

Why it matters:

This is the core of Ivaronix.

Receipts are not just screenshots.

They can be checked again from another machine.

0G used:

- 0G Chain receipt registry
- 0G Compute TEE verification for TIER 1 receipts

### 8. Compute Commands

Commands include:

- `ivaronix compute test`
- `ivaronix compute balance`
- `ivaronix compute verify-tee <receipt>`
- `ivaronix compute warmup`

What they do:

- test compute setup
- check compute balance
- verify TEE evidence
- warm up the compute path

0G used:

- 0G Compute / Router

### 9. Model Commands

Commands include:

- `ivaronix model list-providers`
- `ivaronix model preflight`
- `ivaronix model deposit <amountOg>`
- `ivaronix model fund <provider> <amountOg>`
- `ivaronix model fine-tune <dataset>`
- `ivaronix model task <id>`
- `ivaronix model download <taskId> <outDir>`

What they do:

- list model providers
- check model setup
- manage compute payments or provider funding
- support future fine-tuning flows

0G used:

- 0G Compute marketplace / model provider system

### 10. Memory Commands

Commands include:

- `ivaronix memory remember <text>`
- `ivaronix memory recall <query>`
- `ivaronix memory stream-id [address]`
- `ivaronix memory snapshot`
- `ivaronix memory forget <id>`
- `ivaronix memory grant <grantee>`
- `ivaronix memory revoke <grantId>`
- `ivaronix memory list`
- `ivaronix memory log`
- `ivaronix memory log-emit`

What they do:

- save memory
- search memory
- generate stream IDs
- create memory snapshots
- grant memory access
- revoke memory access
- list grants
- show memory access logs

Why it matters:

AI should remember useful things, but the user should control the memory.

0G used:

- CapabilityRegistry for memory permissions
- MemoryAccessLog for memory activity
- future storage/persistent memory paths for durable memory

### 11. Passport Commands

Commands include:

- `ivaronix passport mint`
- `ivaronix passport show`
- `ivaronix passport restore`
- `ivaronix passport authorize <executor>`
- `ivaronix passport revoke <executor>`
- `ivaronix passport executor <executor>`
- `ivaronix passport consolidate`

What they do:

- create an agent passport
- show passport state
- restore passport metadata
- authorize an executor
- revoke an executor
- check executor state
- consolidate passport state

Why it matters:

Agents need identity and reputation.

0G used:

- AgentPassportINFT / AgentPassportINFTV2 on 0G Chain
- Erc7857Verifier support

### 12. Skill Commands

Commands include:

- `ivaronix skill list`
- `ivaronix skill inspect <id>`
- `ivaronix skill publish <id>`
- `ivaronix skill verify <id>`
- `ivaronix skill install <ref>`
- `ivaronix skill eval <id>`
- `ivaronix skill fee-split <id>`
- `ivaronix skill earn-history [id]`
- `ivaronix skill registry`
- `ivaronix skill export`
- `ivaronix skill schedule`

What they do:

- list skills
- inspect a skill manifest
- publish skills
- verify skill registry state
- install skills
- run skill evaluations
- show fee split
- show creator earnings from receipts
- export registry data
- schedule skill runs

Why it matters:

This is the base for the future verified skill economy.

Users should not pay for random prompts.

They should pay for verified runs with receipts.

0G used:

- SkillRegistry on 0G Chain
- receipts for every skill run
- creator fee split inside receipts

### 13. Delegate Commands

Commands include:

- `ivaronix delegate create`
- `ivaronix delegate list`
- `ivaronix delegate grant <delegateId>`
- `ivaronix delegate revoke <delegateId>`
- `ivaronix delegate run <delegateId> <doc>`

What they do:

- create a delegated agent
- list delegates
- grant permissions
- revoke permissions
- run delegated document tasks

Why it matters:

Teams and users may want controlled agents that can act with limited power.

0G used:

- wallet identity
- chain grants
- receipts for delegated actions

### 14. Room Commands

Commands include:

- `ivaronix room create`
- `ivaronix room list`
- `ivaronix room read <roomId>`

What they do:

- create data rooms
- list rooms
- read room state

Why it matters:

Data rooms are useful for private shared workflows.

### 15. Session Commands

Commands include:

- `ivaronix session list`
- `ivaronix session show <id>`
- `ivaronix session attach <id>`
- `ivaronix session prune`

What they do:

- list saved conversations
- show a saved session
- attach/resume a session
- clean old sessions

Why it matters:

Agents need durable work sessions, not one-off chats.

### 16. Serve Command

Command:

`ivaronix serve`

What it does:

- starts an API server
- exposes endpoints like health, skills, passport, and receipt lookup

Why it matters:

It lets other tools talk to Ivaronix without using the full Studio app.

### 17. Indexer Commands

Commands include:

- `ivaronix indexer backfill`
- `ivaronix indexer tail`
- `ivaronix indexer stats`
- `ivaronix indexer list`

What they do:

- index receipt history
- watch chain events
- show stats
- list indexed items

Why it matters:

As receipts grow, users need fast ways to search and inspect them.

### 18. DA Commands

Commands include:

- `ivaronix da preflight`
- `ivaronix da disperse <file>`
- `ivaronix da retrieve <storageRoot> <epoch> <quorumId>`

What they do:

- prepare for 0G DA use
- disperse data
- retrieve data

Current status:

DA is not the core active path because public endpoint support is limited.

This is a future scale path for receipt batches and event data.

### 19. Debug Commands

Commands include:

- `ivaronix debug receipt <id>`
- `ivaronix debug passport [address]`
- `ivaronix debug memory [address]`
- `ivaronix debug skill <skillId>`
- `ivaronix debug chain`
- `ivaronix debug storage`
- `ivaronix debug compute`
- `ivaronix debug startup`

What they do:

- help diagnose chain, compute, storage, memory, skill, and receipt issues

Why it matters:

A serious developer tool must explain what is broken.

### 20. Doctor Command

Command:

`ivaronix doctor`

What it does:

- checks whether the project is configured correctly
- checks wallet, RPC, compute, and other setup pieces

Why it matters:

It helps users fix setup problems fast.

### 21. PR Commands

Commands include:

- `ivaronix pr create`
- `ivaronix pr verify <pr-number>`

What they do:

- support pull request workflows
- verify PR-related proof

Why it matters:

This helps developer teams use receipts in code review workflows.

### 22. OpenClaw Command

Command:

`ivaronix openclaw verify <skillMdPath>`

What it does:

- verifies OpenClaw-style skill compatibility

Why it matters:

Ivaronix wants skills to be portable, not locked into one app.

### 23. Daemon Commands

Commands include:

- `ivaronix daemon start <path>`
- `ivaronix daemon stop`
- `ivaronix daemon status`
- `ivaronix daemon logs`
- `ivaronix daemon register-host`
- `ivaronix daemon unregister-host`
- `ivaronix daemon host-info`

What they do:

- run background service flows
- support native host/browser bridge style workflows

Why it matters:

This helps Ivaronix become more than one terminal command.

It can support background agent work later.

---

## First-Party Skills

Ivaronix has several first-party skills.

### 1. private-doc-review

What it does:

Reviews private documents and finds risks.

Best use:

- legal documents
- contracts
- investor docs
- private business docs

Why it matters:

This is the strongest first user story.

### 2. github-audit

What it does:

Reviews GitHub/code projects.

Best use:

- repo review
- code risk checks
- implementation quality check

### 3. 0g-integration-auditor

What it does:

Checks whether a project uses 0G properly.

Best use:

- hackathon projects
- 0G integration review
- judging preparation

### 4. code-edit

What it does:

Helps edit code with review and receipt support.

### 5. plan-step

What it does:

Breaks a task into clear next steps.

### 6. content-pitch-review

What it does:

Reviews product/pitch content.

Best use:

- landing page copy
- hackathon pitch
- X post
- submission text

---

## Receipt Types

Ivaronix supports many receipt types.

Examples:

- document question receipt
- audit receipt
- consensus receipt
- burn-mode receipt
- memory access receipt
- skill execution receipt
- code change receipt
- passport update receipt
- swarm/workflow receipt

Why this matters:

Different AI actions need different proof.

A code edit is not the same as a legal doc review.

A memory access is not the same as a skill run.

Receipts make each action easier to understand and verify.

---

## Burn Mode

Burn Mode is for sensitive work.

Simple explanation:

Ivaronix encrypts the input with a temporary key.

After the run, the key is destroyed.

The receipt records that the key was destroyed.

Important:

Burn Mode does not delete blockchain data.

It means the encrypted data may remain, but without the key it should be unreadable.

Why it matters:

This is useful for:

- private legal docs
- confidential business files
- private code
- investor decks
- sensitive research

0G used:

- 0G Compute can process the task
- 0G Chain anchors the burn-mode receipt
- 0G Storage support can store encrypted ciphertext when wired into the production path

---

## Consensus Mode

Consensus means more than one AI role checks the work.

Instead of one model answer, Ivaronix can use roles like:

- analyst
- critic
- judge
- risk reviewer
- evidence checker

Simple example:

One AI finds the issue.

Another AI challenges it.

A judge AI gives the final answer.

Why it matters:

This can reduce weak or lazy answers.

It also makes the receipt richer because it records more of the decision path.

---

## TIER 1 and TIER 2 Receipts

Ivaronix uses honest labels.

### TIER 1

TIER 1 means the action used the 0G Compute trusted path.

It can show TEE-related verification.

This is the strongest proof tier.

### TIER 2

TIER 2 means the action used an external model provider, like NVIDIA NIM.

It can still be signed and chain-anchored.

But it should not be shown as full TEE-verified 0G Compute.

Why this matters:

Ivaronix does not fake trust.

If the compute is external, the UI should say so.

---

## Marketplace and Economy Direction

Ivaronix should not be a random prompt marketplace.

The stronger idea is:

> Verified AI services marketplace.

Users do not buy "skills."

They buy verified outcomes.

Examples:

- review my contract
- audit my repo
- check my 0G integration
- review my grant submission
- monitor my wallet
- generate a weekly report

Creators can publish skills.

Users can run those skills.

Every paid run creates a receipt.

The receipt can record:

- who created the skill
- who ran it
- what it cost
- what fee split happened
- what proof was created
- whether the run was TIER 1 or TIER 2

Why this matters:

Normal GitHub skills are free, but they do not give:

- verified run history
- on-chain reputation
- creator payout proof
- permission manifest proof
- TEE labels
- receipt-based trust

Ivaronix can make skill payments more trustworthy because every run leaves proof.

---

## API and Developer Features

Ivaronix also has API-style features.

Important routes and surfaces include:

- `/api/run`
- `/api/auth/siwe/nonce`
- `/api/auth/siwe/verify`
- `/api/memory/remember`
- `/api/memory/recall`
- `/api/memory/list`
- `/api/memory/forget`
- `/api/skill/save`
- dashboard APIs
- public receipt pages

The CLI can also expose a local API through:

`ivaronix serve`

Why this matters:

Developers should be able to build on Ivaronix.

Studio is for users.

CLI is for developers.

API is for integrations.

---

## Security and Permissions

Ivaronix has a security-first mindset.

Important rules:

- no fake green status
- no screenshot-only proof
- no selector-only testing
- no feature without real use
- no claim without receipt/proof
- no half-baked wallet flow
- no half-baked permissions

Security features include:

- SIWE session checks for wallet claims
- rate limiting on `/api/run`
- wallet-scoped memory notes
- skill sandbox evaluation
- permission manifests
- receipt verification
- chain anchors
- honest TIER labels

Why this matters:

AI agents can be dangerous if they can touch files, memory, wallets, or tools without control.

Ivaronix tries to make those actions visible and provable.

---

## What Makes Ivaronix Different

Many projects do one thing:

- memory
- marketplace
- payment
- AI chat
- code assistant
- receipt proof
- agent identity

Ivaronix connects these into one trust system.

The strongest difference:

> Every important AI action becomes a receipt.

That receipt can connect:

- skill
- model
- wallet
- agent passport
- chain anchor
- compute tier
- burn mode
- fee split
- memory access
- proof page

This makes Ivaronix more than a chatbot.

It is a trust layer for AI agents.

---

## Best Simple Product Story

The best simple story is:

> Ivaronix is for founders, teams, and developers who use AI on private docs or code and need proof of what happened.

Even simpler:

> Private AI agents for sensitive work. Every action leaves a 0G receipt.

This story is better than only saying "Agent OS."

"Agent OS" is the long-term vision.

The first product should be easy to understand:

Upload private work.

Run the agent.

Get the answer.

Share the receipt.

---

## What A Non-Technical Judge Should Understand

If a judge is not technical, they should understand this:

1. AI agents are useful but hard to trust.
2. Ivaronix records what an AI agent did.
3. The record becomes a receipt.
4. The receipt is signed and anchored on 0G Chain.
5. 0G Compute helps make the AI run more verifiable.
6. Agent Passport gives agents identity and history.
7. Users can share proof without sharing private documents.
8. Creators can later earn from verified skills.

That is the full project in plain English.

---

## What Is Real Now vs Future

### Real Now

- Studio web app
- CLI / Forge
- receipt creation
- receipt verification
- 0G Chain anchoring
- 0G Compute path
- TEE-independent verify command
- Agent Passport contracts
- memory grant/revoke
- SkillRegistry
- first-party skills
- burn-mode receipt
- TIER 1/TIER 2 labels
- Proof Explorer
- API routes
- local skill builder
- embeddable receipt widget
- OpenClaw-compatible skill path

### Needs Production Hardening

- full Vercel production storage strategy
- remove dependence on local `.ivaronix` files for production state
- wire Studio evidence upload to 0G Storage for normal run path
- finish mainnet deployment after wallet funding
- verify TUI keyboard feel manually in a real terminal
- live Telegram bot requires BotFather token and phone testing

### Future / Roadmap

- full verified work marketplace
- creator payouts on mainnet
- team workspaces
- shared memory
- enterprise audit logs
- more skill packs
- browser extension
- stronger 0G DA batching
- agent-to-agent hiring
- more third-party integrations

---

## One-Sentence Pitch

Ivaronix lets people use AI agents on private docs and code, then prove what happened with 0G receipts.

## Better Marketing Line

AI agents, but with receipts.

## Best Serious Line

Private AI agents for sensitive work. Every action leaves a 0G receipt.

