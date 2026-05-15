# Ivaronix Product Flow

Ivaronix is a verifiable AI workroom. Users run sensitive AI tasks, keep the source private when needed, and receive a receipt that can be checked later by another person, another machine, or the CLI.

Core idea:

> Private AI work. Public proof.

Ivaronix has two main surfaces:

- **Studio**: the web app for normal users, teams, skill creators, and reviewers.
- **CLI**: the developer/operator tool for running, verifying, auditing, and automating Ivaronix flows.

---

## 1. What The Product Does

Ivaronix helps users run important AI work with proof.

Examples:

- review a private document
- audit a GitHub repo
- check a 0G integration
- run a paid verified skill
- create a receipt for an AI action
- verify a receipt from another machine
- grant or revoke memory permissions
- inspect an agent passport and trust history

The product does **not** claim the AI answer is always correct. It proves the process:

- what skill ran
- which model/provider was used
- what tier/mode was selected
- whether TEE/private-compute proof exists
- whether evidence was stored
- which chain transaction anchored the receipt
- whether a payment happened
- whether anyone can verify the receipt later

---

## 2. Studio Web App Flow

Studio is the main user-facing product.

### A. Landing / Product Overview

The landing page should make the full product clear:

1. **Run** private AI work.
2. **Verify** every important action with a receipt.
3. **Remember** through controlled memory permissions.
4. **Pay** for verified skills when needed.
5. **Share** proof publicly without exposing private source data.

Main modules shown in Studio:

- Workroom
- Proof Explorer
- Burn Mode
- Consensus Mode
- Skills Marketplace
- Memory Center
- Agent Passport
- Dashboard / Global feed
- Developer verification layer

### B. Workroom / Run Flow

User flow:

1. User opens Studio.
2. User chooses a skill, such as private document review or GitHub audit.
3. User provides text, a file, or a prompt.
4. User chooses mode/tier:
   - quick
   - standard
   - high-stakes
   - audit
5. Optional: user enables Burn Mode for private evidence handling.
6. Ivaronix runs the AI workflow.
7. Ivaronix returns:
   - AI answer
   - model/tier metadata
   - storage evidence root when available
   - chain transaction
   - receipt ID
   - public proof URL

Expected result:

- User gets a useful AI response.
- User gets a receipt proving the process.
- User can open `/r/<id>` to inspect and share the proof.

### C. Consensus Mode

Consensus Mode runs multiple reviewer roles instead of one simple AI answer.

Example roles:

- analyst
- critic
- risk reviewer
- evidence checker
- judge

The UI should show:

- final answer
- agreement score
- objections or disagreements
- cost
- latency
- selected tier
- receipt proof

This is useful for high-stakes work where a single AI answer is not enough.

### D. Burn Mode

Burn Mode is for sensitive inputs.

Flow:

1. User enables Burn Mode.
2. Input is handled as private evidence.
3. The receipt proves the action happened.
4. The public proof page does not expose the original source file.

The UI should make this clear:

- input private
- proof public
- source hidden
- receipt still verifiable

### E. Proof Explorer

Every receipt has a public page at `/r/<id>`.

The proof page should show:

- receipt status
- skill used
- model/provider used
- tier/mode
- TEE/private-compute status
- 0G Storage evidence root
- 0G Chain transaction
- payment details if paid
- verifier result
- share/copy/print actions

The receipt page is one of the most important product surfaces because it is what other people will open when a user shares proof.

### F. Skills Marketplace

The marketplace lets users run verified skills and lets creators earn from paid runs.

Creator flow:

1. Creator opens `/marketplace/new`.
2. Creator publishes a skill.
3. Creator sets price and fee split.
4. Skill appears in marketplace.

Buyer flow:

1. Buyer opens `/marketplace`.
2. Buyer selects a skill.
3. Buyer connects wallet or uses the supported testnet wallet flow.
4. Buyer pays in OG for the skill run.
5. Skill runs.
6. Buyer receives a receipt with payment proof.

Creator payout flow:

1. Creator opens `/marketplace/payouts`.
2. Creator sees pending earnings.
3. Creator withdraws earnings.

Admin/treasury flow:

1. Admin opens treasury page.
2. Admin sees protocol fee balance.
3. Admin withdraws treasury balance.

A real marketplace test requires three roles:

- creator wallet
- buyer wallet
- admin/treasury wallet

### G. Memory Center

Memory Center controls what agents can remember or access.

User flow:

1. User opens `/memory`.
2. User grants memory access by agent, skill, project, or session.
3. User can revoke access later.
4. Grant/revoke actions are reflected in chain state and audit logs.

Expected result:

- User understands who has access.
- Revoked memory is visibly revoked.
- Access state can be verified.

### H. Agent Passport

Agent Passport gives an agent an identity and trust history.

The UI should show:

- agent identity
- owner wallet
- receipt count
- trust score
- authorized capabilities
- history of verified actions

The purpose is to make agents accountable over time, not anonymous black boxes.

---

## 3. CLI Flow

The CLI is for developers, operators, and power users.

Main CLI jobs:

- run AI tasks
- audit repos
- ask questions about documents
- create receipts
- verify receipts
- manage skills
- manage memory
- inspect passports
- run demos
- serve local tools

Important CLI examples:

```bash
ivaronix demo
ivaronix doc ask file.pdf "find the risks"
ivaronix receipt verify <id> --tee-independent
ivaronix skill list
ivaronix memory grant ...
ivaronix passport show ...
```

### CLI Verification

The most important CLI feature is independent receipt verification.

Expected behavior:

```bash
ivaronix receipt verify <id> --tee-independent
```

The CLI should verify:

- schema
- canonical hash
- signature
- chain anchor
- TEE/private-compute proof where available
- payment binding where applicable

This proves the receipt is not only a web-app display.

---

## 4. MCP / SDK / Developer Layer

Ivaronix also exposes developer surfaces.

### MCP

MCP allows tools like Claude Desktop or Cursor to call Ivaronix functions.

Expected MCP tool types:

- list skills
- run a skill
- verify a receipt
- show receipt details
- inspect passport status

### SDK / Toolkit

The SDK/toolkit should help developers add receipts to their own AI apps.

Developer promise:

> Add verifiable receipts to your AI workflow without rebuilding the whole proof pipeline.

The developer docs should explain:

- how to run a skill
- how to create a receipt
- how to verify a receipt
- how to embed proof
- how 0G Chain, Storage, Compute, and Agent ID are used

---

## 5. 0G Components Used

Ivaronix uses 0G as the proof and execution stack.

### 0G Chain

Used for:

- receipt anchoring
- contract state
- skill registry
- payment proof
- memory grant/revoke state
- agent passport records

### 0G Storage

Used for:

- receipt evidence
- private/burn-mode evidence roots
- persistent proof data

### 0G Compute / Private Compute

Used for:

- AI inference
- TEE/private-compute proof path when available
- model/provider verification metadata

### Agent ID / ERC-7857

Used for:

- agent identity
- passport ownership
- trust history
- verified action history

### 0G KV / Memory Layer

Used for:

- portable memory access layer
- encrypted memory snapshots or pointers
- wallet-linked memory state

Current production stance:

- Ivaronix may operate the gateway/sidecar.
- 0G public hosted KV endpoint should not be claimed unless verified live.

### 0G DA

DA is useful for future high-volume receipt batching.

Current honest stance:

- v1 proof loop is Chain + Storage + Compute + Agent ID.
- DA should be used when batching many receipts creates real product value.
- Do not force DA only as a checkbox.

---

## 6. End-To-End Product Loop

The full Ivaronix loop:

1. User runs an AI task.
2. Ivaronix executes the selected skill.
3. Evidence is stored or represented through 0G Storage.
4. Compute/model metadata is captured.
5. Receipt is signed and anchored on 0G Chain.
6. User gets AI output plus public proof.
7. Anyone can verify the receipt later.
8. If paid, marketplace payment and creator earnings are linked to the receipt.
9. If memory is used, permissions are controlled and auditable.
10. Agent passport records long-term identity and trust.

Short version:

> Run → Verify → Remember → Pay → Share

---

## 7. What Must Be Tested

To claim Ivaronix is ready, testing must prove both mechanics and outcomes.

### UI

Use every visible feature:

- landing
- run flow
- receipt page
- Burn Mode
- Consensus Mode
- marketplace
- payouts
- memory
- passport
- dashboard
- global feed
- docs/developer pages
- mobile and desktop

### Outcomes

For every core skill, verify AI output quality:

- relevant
- useful
- specific
- well structured
- matches selected skill and mode

Testnet models may be weaker than mainnet models, so judge output with that context, but bad or irrelevant output still means the feature needs improvement.

### Proof

Verify:

- real testnet tx hashes
- real receipts
- chain reads
- storage/proof state
- CLI receipt verification
- 2-wallet flows where required
- 3-wallet flows for marketplace/payment

---

## 8. Simple Explanation

Ivaronix is like a workroom for important AI tasks.

Normal AI tools give you an answer.

Ivaronix gives you:

- the answer
- the receipt
- the proof trail
- the privacy controls
- the agent identity
- the option to pay creators for verified skills

That is the product.

