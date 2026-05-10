# Ivaronix 0G Technical Integration Plan

## Purpose

This document is the implementation map for making Ivaronix a real 0G-native product instead of a normal AI app with a few hashes stored on-chain.

The goal is simple:

> Every important Ivaronix feature should have a clear 0G role: compute, storage, chain, identity, receipts, verification, and eventually data availability and agent economy.

This document is based on:

- `ivaronix_final_prd.md`
- local 0G docs/resources under `oglabs resources/`
- the tested 0G Galileo wallet and 0G Private Computer testnet setup
- the current working testnet inference result saved in `0G_TESTNET_NOTES.md`

## Current Verified Testnet Facts

### 0G Galileo Testnet

Use the current local docs value, not older examples:

- Network name: `0G-Galileo-Testnet`
- Chain ID: `16602`
- RPC: `https://evmrpc-testnet.0g.ai`
- Explorer: `https://chainscan-galileo.0g.ai`
- Storage explorer: `https://storagescan-galileo.0g.ai`
- Faucet: `https://faucet.0g.ai`
- Storage indexer: `https://indexer-storage-testnet-turbo.0g.ai`
- Current test wallet: `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`
- Last checked wallet balance: `10.5 OG`

Important correction:

- Older examples may show chain ID `16601`.
- The current local 0G AI context and the Private Computer testnet UI use `16602`.
- Ivaronix should standardize on `16602` for Galileo unless a newer official doc changes it.

### 0G Private Computer / Router Testnet

The local Router docs confirm:

- Testnet UI: `https://pc.testnet.0g.ai`
- Testnet base URL: `https://router-api-testnet.integratenetwork.work/v1`
- Chat completions endpoint: `POST /chat/completions`
- OpenAI-compatible request/response shape
- Router-specific response field: `x_0g_trace`
- Router extension: `verify_tee: true`

The tested model:

- `qwen/qwen-2.5-7b-instruct`

The test request worked and returned:

- assistant response: `0G test OK`
- `x_0g_trace.provider`
- `x_0g_trace.request_id`
- `x_0g_trace.billing`

Current visible model pricing:

- Input: `0.0500 OG` per `1,000,000` tokens
- Output: `0.1000 OG` per `1,000,000` tokens

Budget estimate:

- `0.1 OG` is enough for roughly 1,250 small development calls around 1,000 input tokens and 300 output tokens.
- `10 OG` is enough for roughly 125,000 similar small development calls.
- Real cost depends on prompt size, output size, consensus fan-out, retries, and whether long documents are sent directly instead of chunked.

## High-Level 0G Architecture

Ivaronix should use 0G in five layers:

1. 0G Compute Router / Private Computer for model inference and TEE-verifiable responses.
2. 0G Storage for encrypted documents, memory artifacts, receipts, code snapshots, and skill packages.
3. 0G Chain for receipt registries, agent passport hashes, skill registry state, permission commitments, and later payments.
4. AgenticID / ERC-7857 later for ownable agents, transferable agents, cloning, and authorized usage.
5. 0G DA later for high-volume agent event logs, batched receipts, marketplace activity, and appchain-scale events.

The MVP should focus on:

- 0G Router testnet inference
- 0G Storage encrypted uploads
- 0G Chain receipt anchoring
- wallet login
- agent passport hash
- proof receipt verification

Do not force 0G DA or full ERC-7857 into the first working demo. Mention them as roadmap unless implemented.

## Recommended Environment Variables

Ivaronix should separate public client config from server secrets.

### Server Secrets

```env
OG_PRIVATE_KEY=
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16602
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api-testnet.integratenetwork.work/v1
OG_ROUTER_API_KEY=
OG_DEFAULT_MODEL=qwen/qwen-2.5-7b-instruct
OG_VERIFY_TEE=true
```

### Public Client Config

```env
NEXT_PUBLIC_OG_CHAIN_ID=16602
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_OG_EXPLORER=https://chainscan-galileo.0g.ai
NEXT_PUBLIC_OG_STORAGE_EXPLORER=https://storagescan-galileo.0g.ai
```

Important:

- Never expose `OG_PRIVATE_KEY`.
- Never expose `OG_ROUTER_API_KEY`.
- API keys pasted into chat or logs must be rotated.
- Client-side wallet actions should use user wallet signatures, not the project private key.

## Core Data Model

### Agent

```ts
type Agent = {
  id: string;
  ownerWallet: `0x${string}`;
  name: string;
  role: string;
  modelPolicy: ModelPolicy;
  memoryRoot?: string;
  passportHash?: `0x${string}`;
  latestPassportStorageRoot?: `0x${string}`;
  createdAt: string;
  updatedAt: string;
};
```

### Memory Object

```ts
type MemoryObject = {
  id: string;
  agentId: string;
  ownerWallet: `0x${string}`;
  namespace: "personal" | "project" | "legal" | "code" | "team" | string;
  plaintextNeverStoredServerSide?: boolean;
  encryptedPayloadRoot: `0x${string}`;
  contentHash: `0x${string}`;
  sourceReceiptId?: string;
  version: number;
  previousMemoryHash?: `0x${string}`;
  createdAt: string;
};
```

### Skill Manifest

```ts
type SkillManifest = {
  name: string;
  version: string;
  description: string;
  creatorWallet?: `0x${string}`;
  permissions: string[];
  memoryAccess: "none" | "session" | "project" | "personal" | "team";
  networkAccess: string[];
  walletAccess: boolean;
  writesFiles: boolean;
  runsCommands: boolean;
  receiptRequired: boolean;
  sourceUri?: string;
  sourceHash: `0x${string}`;
};
```

### AI Action Receipt

```ts
type ActionReceipt = {
  schemaVersion: "ivaronix.receipt.v1";
  receiptId: string;
  receiptType:
    | "ai_action"
    | "document_review"
    | "code_review"
    | "skill_execution"
    | "memory_access"
    | "consensus"
    | "burn"
    | "passport_update";
  agentId: string;
  ownerWallet: `0x${string}`;
  actorWallet?: `0x${string}`;
  model: {
    label: string;
    providerType: "0g_verified" | "0g_router" | "external" | "local";
    providerAddress?: `0x${string}`;
    requestId?: string;
    teeVerified?: boolean | null;
  };
  inputHash: `0x${string}`;
  outputHash: `0x${string}`;
  memoryRootsUsed: `0x${string}`[];
  documentRootsUsed: `0x${string}`[];
  skillManifestHash?: `0x${string}`;
  policyDecision: {
    allowed: boolean;
    approvalRequired: boolean;
    approvedBy?: `0x${string}`;
    reason?: string;
  };
  toolsUsed: string[];
  billing?: {
    inputCostNeuron?: string;
    outputCostNeuron?: string;
    totalCostNeuron?: string;
  };
  storage: {
    receiptRoot?: `0x${string}`;
    artifactRoots: `0x${string}`[];
  };
  chain: {
    registryAddress?: `0x${string}`;
    txHash?: `0x${string}`;
    chainId: number;
  };
  createdAt: string;
};
```

## Receipt Philosophy

The receipt must never overclaim.

It proves:

- which model/provider was used
- which input/output hashes were generated
- which memory/document roots were touched
- which skill manifest was used
- which permissions were approved
- what 0G Storage roots exist
- what 0G Chain transaction anchored the receipt
- whether Router TEE verification was requested and returned true/false/null

It does not prove:

- the AI answer is correct
- legal/medical/financial advice is safe to follow without human review
- external/local model calls were private
- deleted blockchain data

## 0G Compute Integration

### Use Router First

For Ivaronix MVP, use Router because local docs say it is best for:

- server-side apps
- agents
- prototypes
- one API key
- unified balance
- automatic provider routing/failover
- OpenAI-compatible calls

This is ideal for the web app and API.

### Router Request

```ts
const response = await fetch(`${process.env.OG_ROUTER_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.OG_ROUTER_API_KEY}`,
  },
  body: JSON.stringify({
    model: "qwen/qwen-2.5-7b-instruct",
    messages,
    stream: false,
    verify_tee: true,
    temperature: 0.2,
    max_tokens: 1200,
  }),
});
```

### What To Store From Response

Persist in the receipt:

- `response.id`
- `response.model`
- `response.usage`
- `response.x_0g_trace.request_id`
- `response.x_0g_trace.provider`
- `response.x_0g_trace.billing.input_cost`
- `response.x_0g_trace.billing.output_cost`
- `response.x_0g_trace.billing.total_cost`
- `response.x_0g_trace.tee_verified` when present
- hash of final answer

### TEE Verification Modes

Ivaronix should support three levels:

1. `off`: no `verify_tee`, cheapest/fastest.
2. `router_verified`: send `verify_tee: true`, trust Router result.
3. `independent_verified`: use `@0gfoundation/0g-compute-ts-sdk` and `processResponse(provider, chatID)` for independent verification.

MVP:

- Use `verify_tee: true`.
- Record `tee_verified` in the receipt.

Later:

- Read `ZG-Res-Key` response header.
- Use provider address from `x_0g_trace.provider`.
- Call `broker.inference.processResponse(providerAddress, chatID)`.
- Store independent verification result in the receipt.

### Model Labels

Every UI output should show one of:

- `0G Verified`: Router or direct 0G inference with `tee_verified: true`
- `0G Router`: 0G Router used, but TEE verification not requested or absent
- `External`: OpenAI, Anthropic, Gemini, OpenRouter, etc.
- `Local`: Ollama, LM Studio, vLLM, llama.cpp, local server
- `Mixed Consensus`: multiple model/provider routes used

Never label external/local models as 0G verified.

### Consensus With 0G Compute

Consensus can be implemented with one model first, using different roles:

- Analyst
- Risk Reviewer
- Evidence Checker
- Red-Team Critic
- Final Judge

For full 0G-native demo, each role should call 0G Router and store separate traces:

```ts
type ConsensusTrace = {
  role: "analyst" | "risk_reviewer" | "evidence_checker" | "critic" | "judge";
  model: string;
  providerAddress?: string;
  requestId?: string;
  teeVerified?: boolean | null;
  inputHash: string;
  outputHash: string;
  billing: unknown;
};
```

Cost control:

- keep role prompts short
- chunk documents before consensus
- send summaries to critic/judge, not full raw files
- cap outputs
- use caching for repeated document chunks

## 0G Storage Integration

### What Goes To 0G Storage

Use 0G Storage for:

- encrypted uploaded documents
- encrypted code snapshots
- AI Action Receipt JSON
- Burn Receipt JSON
- Consensus Trace bundles
- Agent Passport JSON
- Skill package tarballs or manifests
- memory graph artifacts
- memory snapshots
- source citation maps
- long audit reports

Do not store:

- plaintext sensitive documents
- plaintext private memory
- private keys
- API keys
- raw secrets
- unredacted logs

### Storage SDK Path

Use:

```bash
npm install @0gfoundation/0g-storage-ts-sdk ethers
```

File upload pattern:

1. Create `ZgFile`.
2. Call `file.merkleTree()` before upload.
3. Read `tree.rootHash()`.
4. Upload through `Indexer`.
5. Save root hash and upload tx.
6. Close file handles.

Important local-doc caveat:

- `merkleTree()` must be called before upload because it populates internal state.
- root hashes must be saved because they are required for download.
- `indexer.download()` with `withProof=true` enables Merkle proof verification.

### Browser Uploads

For browser uploads:

- use SDK `Blob` alias to avoid collision with native `Blob`
- use MetaMask/user signer where appropriate
- beware SDK imports Node modules at load time
- use the starter kit Vite polyfill approach if needed

Browser download caveat:

- `indexer.download()` does not work in browsers because it uses filesystem APIs.
- for encrypted browser download, use `downloadToBlob()`.
- for manual browser downloads, fetch storage node segments and reassemble in memory.

### Encryption

0G docs support client-side encryption:

- AES-256 for session-key encryption
- ECIES for recipient public-key encryption

Use AES-256 for Burn Mode session vaults:

```ts
const sessionKey = crypto.getRandomValues(new Uint8Array(32));
await indexer.upload(file, rpcUrl, signer, {
  encryption: { type: "aes256", key: sessionKey },
});
```

Use ECIES for wallet-recipient encrypted persistent memory:

```ts
await indexer.upload(file, rpcUrl, signer, {
  encryption: { type: "ecies", recipientPubKey },
});
```

Critical caveat from docs:

- Wrong key may not throw during encrypted download.
- It can return raw ciphertext.
- Call `peekHeader` first if unsure whether a file is encrypted.
- For encrypted files, always use `downloadToBlob()`.

### Storage Structure

Recommended artifact naming:

```text
ivaronix/
  agents/<agentId>/passport/<version>.json
  agents/<agentId>/memory/<namespace>/<version>.json.enc
  agents/<agentId>/receipts/<receiptId>.json
  agents/<agentId>/documents/<documentId>.bin.enc
  agents/<agentId>/skills/<skillId>/<version>.tar
  agents/<agentId>/consensus/<runId>.json
```

Storage itself is content-addressed by root hash. The app database should map friendly IDs to root hashes.

## 0G Chain Integration

### What Goes On-Chain

Put minimal commitments on-chain:

- receipt hash
- receipt storage root
- agent ID
- owner wallet
- receipt type
- timestamp/block number
- passport hash update
- skill manifest hash
- optional burn receipt hash

Do not put full private data on-chain.

### MVP Contracts

Use three simple contracts first:

1. `ReceiptRegistry`
2. `AgentPassportRegistry`
3. `SkillRegistry`

### ReceiptRegistry

```solidity
struct ReceiptRecord {
    address owner;
    bytes32 agentId;
    bytes32 receiptId;
    bytes32 receiptHash;
    bytes32 storageRoot;
    bytes32 receiptType;
    uint256 createdAt;
}
```

Functions:

```solidity
function anchorReceipt(
    bytes32 agentId,
    bytes32 receiptId,
    bytes32 receiptHash,
    bytes32 storageRoot,
    bytes32 receiptType
) external;

function getReceipt(bytes32 receiptId) external view returns (ReceiptRecord memory);
```

Events:

```solidity
event ReceiptAnchored(
    address indexed owner,
    bytes32 indexed agentId,
    bytes32 indexed receiptId,
    bytes32 receiptHash,
    bytes32 storageRoot,
    bytes32 receiptType
);
```

### AgentPassportRegistry

Store current passport commitment:

```solidity
struct PassportRecord {
    address owner;
    bytes32 agentId;
    bytes32 passportHash;
    bytes32 storageRoot;
    uint256 version;
    uint256 updatedAt;
}
```

Events:

```solidity
event PassportUpdated(
    address indexed owner,
    bytes32 indexed agentId,
    bytes32 passportHash,
    bytes32 storageRoot,
    uint256 version
);
```

### SkillRegistry

Store skill metadata commitments:

```solidity
struct SkillRecord {
    address creator;
    bytes32 skillId;
    bytes32 manifestHash;
    bytes32 storageRoot;
    uint256 version;
    bool active;
}
```

MVP should not implement payments here. Just registry and verification.

### Chain Tooling

Use standard EVM tooling:

- Hardhat or Foundry
- RPC: `https://evmrpc-testnet.0g.ai`
- Chain ID: `16602`
- Explorer: `https://chainscan-galileo.0g.ai`

Local docs show 0G is EVM-compatible, so normal Ethereum tools work.

## Wallet Login

Use wallet login for:

- user identity
- agent ownership
- receipt ownership
- passport ownership
- skill creator identity

Recommended:

- SIWE-style login
- nonce generated by backend
- wallet signs nonce
- backend verifies address
- session stored server-side

Do not require wallet signatures for every chat message. Use session auth for UX and only require signing for ownership-critical actions.

## Private Document / Code Room Integration

### Flow

1. User connects wallet.
2. User uploads document or repo snapshot.
3. Browser/server encrypts file before 0G upload.
4. Upload encrypted artifact to 0G Storage.
5. Save root hash in app DB.
6. Generate document hash and metadata.
7. Run 0G Router inference with `verify_tee: true`.
8. Generate citations and risk output.
9. Generate receipt JSON.
10. Upload receipt JSON to 0G Storage.
11. Anchor receipt hash/root on 0G Chain.
12. Update Agent Passport.

### Codebase Upload

For code:

- never upload `.env`
- ignore `node_modules`, `.git`, build output, lockfile copies if too large
- hash every file
- create a manifest:

```json
{
  "repoName": "example",
  "commit": "optional",
  "files": [
    { "path": "src/app.ts", "sha256": "..." }
  ]
}
```

Upload:

- encrypted source snapshot if user approves
- plaintext file hashes in receipt
- audit report on 0G Storage
- receipt root on-chain

## Burn Mode / Ephemeral Session Vault

### Correct Meaning

Burn Mode means:

- data is encrypted before storage
- a temporary session key is used
- local temp files are deleted
- embeddings/cache are deleted
- the encryption key is destroyed
- a Burn Receipt is created

Burn Mode does not mean:

- deleting blockchain data
- deleting decentralized storage replicas
- guaranteeing no external model saw data if external model was used

### Burn Receipt

```ts
type BurnReceipt = {
  receiptType: "burn";
  sessionId: string;
  encryptedRoots: string[];
  destroyedKeyHash: string;
  tempFilesDeleted: boolean;
  embeddingsDeleted: boolean;
  cacheDeleted: boolean;
  modelProviderType: "0g_verified" | "external" | "local";
  createdAt: string;
};
```

Important:

- store only hash of destroyed key, never the key
- if using 0G Compute with TEE, include `teeVerified`
- if using external models, warn that the data was sent externally

## Memory Vault Integration

### Memory Storage

Persistent memory should use:

- encrypted payloads on 0G Storage
- memory index in app DB
- root hash registry in Agent Passport
- access receipts for sensitive reads

Memory object categories:

- fact
- preference
- project decision
- user profile
- source document summary
- skill-generated memory
- team memory

### Graphiti-Style Memory

Implement memory as temporal graph later:

- entities
- facts/edges
- validity windows
- episodes/provenance
- source receipt IDs
- superseded facts instead of overwriting

0G Storage role:

- store memory graph snapshots
- store episode payloads
- store memory diff bundles

0G Chain role:

- anchor memory root updates
- anchor passport updates
- optionally log memory access receipts

### Memory Access Receipts

Create a receipt when:

- skill accesses private memory
- agent accesses another persona namespace
- team memory is read
- memory is exported
- memory is burned

Receipt should include:

- memory root before access
- memory namespace
- skill ID if used
- policy decision
- output hash

## Skill Runtime Integration

### Skill Sources

Supported:

- local skills
- `SKILL.md` folders
- GitHub skill repos
- MCP servers
- official 0G agent skills
- Hermes/OpenClaw-style skills later

### Skill Storage

For verified skills:

1. Download/ingest skill.
2. Compute manifest hash.
3. Scan permissions.
4. Package skill.
5. Upload package/manifest to 0G Storage.
6. Register manifest hash and storage root on 0G Chain.
7. Require receipt for every execution.

### Skill Execution Receipt

Include:

- skill name/version
- manifest hash
- source hash
- permissions requested
- permissions approved
- memory roots accessed
- files touched
- commands run
- network domains accessed
- model calls made
- output hash
- storage root
- chain tx

### Skill Scanner

Scanner should check:

- secret leaks
- `.env` access
- wallet/private key access
- suspicious shell commands
- broad file writes
- unbounded network access
- prompt injection instructions
- package install scripts
- exfiltration URLs

Do not claim guarantee of safety. Claim risk labeling, sandboxing, and permission limits.

## Agent Passport Integration

### Passport JSON

Store full passport JSON on 0G Storage:

```json
{
  "schema": "ivaronix.passport.v1",
  "agentId": "...",
  "ownerWallet": "0x...",
  "name": "...",
  "modelPolicy": "...",
  "memoryRoot": "0x...",
  "skills": [],
  "receiptStats": {
    "total": 0,
    "verified": 0,
    "failed": 0
  },
  "trustScore": 0,
  "latestReceiptIds": []
}
```

Anchor:

- passport hash
- passport storage root
- version

on `AgentPassportRegistry`.

### Trust Score

Trust score should not be arbitrary. Compute from:

- verified receipts
- failed receipts
- policy violations
- skill risk levels
- successful burn receipts
- user approvals
- TEE verified ratio
- disputed outputs later

## API Integration

### Internal API Routes

```text
POST /api/chat
POST /api/documents/upload
POST /api/documents/ask
POST /api/consensus/run
POST /api/skills/install
POST /api/skills/run
POST /api/receipts/create
GET  /api/receipts/:id
POST /api/receipts/verify
GET  /api/agents/:id/passport
POST /api/burn
```

### OpenAI-Compatible Ivaronix API

Later:

```text
POST /v1/chat/completions
POST /v1/ivaronix/run
POST /v1/ivaronix/consensus
POST /v1/ivaronix/receipts/verify
```

Extra headers:

```text
X-Ivaronix-Agent-ID
X-Ivaronix-Memory: true
X-Ivaronix-Receipt: true
X-Ivaronix-Burn: true
X-Ivaronix-Verify-TEE: true
```

## CLI Integration

### CLI Commands That Need 0G

```bash
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
ivaronix receipt verify <hash>
ivaronix passport show
ivaronix storage upload ./file.pdf --encrypt
ivaronix compute test
ivaronix skill install github-audit --register
```

### Local `.ivaronix/` State

```text
.ivaronix/
  config.json
  AGENT.md
  MEMORY.md
  receipts/
  skills/
  policies/
  storage-roots.json
  compute-traces.json
```

CLI should work even when offline for local analysis, then sync receipts/artifacts to 0G when online.

## Vercel Deployment Plan

Vercel is good for:

- frontend
- dashboard
- API routes
- receipt viewer
- wallet auth
- calling 0G Router
- light document parsing
- metadata APIs

Vercel is not ideal for:

- long-running repo analysis
- large file processing
- local model inference
- background agents
- heavy PDF parsing
- persistent workers

Recommended stack:

- Web: Vercel
- DB: Supabase or Neon
- Queue/worker: Railway, Fly, Render, Modal, or VPS
- Storage/proofs: 0G Storage
- Chain anchoring: 0G Galileo
- Inference: 0G Router testnet first, external/local fallback only if needed

## MVP Build Order For 0G Integration

### Step 1: Fix Config

- Set chain ID to `16602`.
- Store Router testnet base URL.
- Store storage indexer URL.
- Store explorer links.

### Step 2: Compute Adapter

- Build OpenAI-compatible adapter for 0G Router.
- Add `verify_tee: true`.
- Capture `x_0g_trace`.
- Add small test route: `/api/compute/test`.

### Step 3: Receipt Generator

- Hash input/output.
- Include compute trace.
- Write receipt JSON locally.

### Step 4: 0G Storage Upload

- Upload receipt JSON.
- Save root hash.
- Verify download with proof where possible.

### Step 5: ReceiptRegistry Contract

- Deploy simple registry.
- Anchor receipt hash/root.
- Display explorer link.

### Step 6: Private Document Flow

- Upload encrypted doc.
- Ask question through 0G Router.
- Generate answer.
- Generate receipt.
- Upload receipt.
- Anchor receipt.

### Step 7: Burn Receipt

- Encrypt with session key.
- Destroy session key.
- Create Burn Receipt.
- Anchor it.

### Step 8: Agent Passport

- Generate passport JSON.
- Upload to 0G Storage.
- Anchor latest passport hash/root.

### Step 9: CLI Demo

- CLI calls same backend or direct Router.
- CLI verifies receipt.
- CLI prints storage root and chain tx.

## Winning Demo Script

Use a short confidential contract or small code repo.

Demo:

1. Connect wallet.
2. Create agent.
3. Upload file.
4. Enable Burn Mode.
5. Run Risk Audit Skill.
6. Use 0G Router with `verify_tee: true`.
7. Show answer with citations.
8. Show `tee_verified`.
9. Show receipt root on 0G Storage.
10. Show receipt tx on 0G Chain.
11. Show Agent Passport updated.
12. Run CLI receipt verification.

Judges should see:

- real 0G Compute
- real 0G Storage
- real 0G Chain
- real wallet ownership
- real receipt
- honest privacy wording

## Common Mistakes To Avoid

1. Using old chain ID `16601` in production config.
2. Forgetting to rotate leaked Router API keys.
3. Calling external models and labeling them 0G verified.
4. Uploading plaintext documents to decentralized storage.
5. Storing private keys or API keys in client code.
6. Forgetting `merkleTree()` before storage upload.
7. Not saving root hashes.
8. Using `indexer.download()` for encrypted/browser downloads instead of `downloadToBlob()`.
9. Treating `tee_verified: true` as proof that the AI answer is correct.
10. Claiming Burn Mode deletes blockchain/decentralized storage data.
11. Building DA integration before receipts/storage/chain are working.
12. Building full marketplace before first-party skill receipts work.

## Source Files Used

Local 0G references checked:

- `oglabs resources/0g-doc/docs/ai-context.md`
- `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/compute-network/router/overview.md`
- `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/compute-network/router/features/chat-completions.md`
- `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution.md`
- `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/storage/sdk.md`
- `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/storage/storage-cli.md`
- `oglabs resources/OG_LABS_RESOURCES_GUIDE.md`
- `0G_TESTNET_NOTES.md`

## Final Integration Thesis

The 0G-native version of Ivaronix is not:

> AI app plus blockchain hash.

It is:

> A trust runtime where model execution, private memory, document artifacts, skill packages, receipts, and agent identity all become verifiable 0G-backed objects.

The MVP should prove this with one flow:

```text
Private document/code
-> encrypted 0G Storage artifact
-> 0G Router TEE inference
-> skill/policy execution
-> receipt JSON
-> 0G Storage receipt root
-> 0G Chain receipt anchor
-> Agent Passport update
-> CLI/API verification
```

