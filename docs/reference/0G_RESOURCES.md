# 0G Builder Hub — Canonical Reference

> **Status:** locked 2026-05-08. Sourced directly from `build.0g.ai` (Builder Hub) plus official `docs.0g.ai`.
> **Purpose:** ONE place to find every URL, CLI command, contract address, repo, and SDK name. Stop re-fetching from the user.

---

## 1. Network Config (frozen)

### Galileo Testnet (Phase A default)
| Field | Value |
|---|---|
| Network name | `0G-Galileo-Testnet` |
| Chain ID | `16602` |
| RPC URL | `https://evmrpc-testnet.0g.ai` |
| Block Explorer | `https://chainscan-galileo.0g.ai` |
| Storage Indexer | `https://indexer-storage-testnet-turbo.0g.ai` |
| Router base URL (legacy/generic) | `https://router-api-testnet.integratenetwork.work/v1` |
| **Confirmed provider URL (per-provider, from `get-secret`)** | `https://compute-network-6.integratenetwork.work/v1/proxy` (Qwen 2.5 7B — Wallet `0x1Be5...` 2026-05-08) |
| **Auth header** | `Authorization: Bearer app-sk-<SECRET>` |
| Currency | `0G` |
| Faucet | `https://faucet.0g.ai` (0.1 0G/day) |

### Aristotle Mainnet (Phase B)
| Field | Value |
|---|---|
| Network name | `0G Mainnet` |
| Chain ID | `16661` |
| RPC URL | `https://evmrpc.0g.ai` |
| Block Explorer | `https://chainscan.0g.ai` |
| Storage Indexer | `https://indexer-storage-turbo.0g.ai` |
| Router base URL | `https://router-api.0g.ai/v1` |
| Currency | `0G` |

### Stale values to flag (doctor must reject)
- `16601` — old testnet (Galileo legacy)
- `16600` — never valid mainnet (Old `0G_OFFICIAL_LINKS.md` had wrong value)

---

## 2. 0G Compute (Inference) — Full CLI Bootstrap

> One-shot: provision account, get API key, all from CLI. No browser needed.

### Install (two packages — DIFFERENT names, BOTH used)

```bash
# Node 20+ required

# Global CLI: provides `0g-compute-cli` (used to generate API keys)
npm install @0glabs/0g-serving-broker -g
# OR (alternate package name some docs show — same CLI binary)
# pnpm add @0gfoundation/0g-compute-ts-sdk -g

# In-app SDK: in your application code (broker SDK + types)
npm install @0gfoundation/0g-compute-ts-sdk

# OpenAI client (for chat completions)
npm install openai
```

**Note on the dual-org naming confusion:** 0G has two GitHub orgs (`0gfoundation` and `0glabs`) and two npm scopes (`@0gfoundation` and `@0glabs`). Both publish related packages. The CLI is officially `@0glabs/0g-serving-broker` per latest docs; the in-app SDK is `@0gfoundation/0g-compute-ts-sdk`. Use both.

### Provision (Day 1 commands — confirmed sequence)
```bash
# set PRIVATE_KEY in shell env first (testnet wallet funded via faucet.0g.ai)
0g-compute-cli setup-network
0g-compute-cli login
0g-compute-cli deposit --amount 5              # 5 OG (3 minimum, 5 recommended for headroom)
0g-compute-cli inference list-providers        # note a provider address

# OPTIONAL: verify provider attestation report before trusting them
0g-compute-cli inference verify --provider 0xa48f01287233509FD694a22Bf840225062E67836
```

### Provider + API Key (per provider)
```bash
# Confirmed Qwen 2.5 7B testnet provider:
export PROVIDER=0xa48f01287233509FD694a22Bf840225062E67836

# transfer-fund auto-acknowledges provider (newer flow); explicit acknowledge step optional
0g-compute-cli transfer-fund --provider $PROVIDER --amount 5
# or, if needed: 0g-compute-cli inference acknowledge-provider --provider $PROVIDER

0g-compute-cli inference get-secret --provider $PROVIDER
# Output: app-sk-<base64-payload> secret + per-provider service URL
# Example output (2026-05-08, our wallet 0x1Be5...):
#   service URL: https://compute-network-6.integratenetwork.work/v1/proxy
#   secret:      app-sk-eyJhZGRyZXNz... (decodes to: { address, provider, timestamp, nonce, ... })
```

### Anatomy of an `app-sk-...` secret
The token is base64-encoded JSON with structure:
```json
{
  "address": "0x1Be5...",        // wallet that generated the secret
  "provider": "0xa48f...",        // bound to this provider
  "timestamp": 1778178822801,     // creation time
  "expiresAt": 0,                 // 0 = no expiration
  "nonce": "...",                 // randomness
  "generation": 0,
  "tokenId": 0
}
```
Plus a signature appended after a `|` separator. Same format as JWT-ish bearer tokens.

### Local self-hosted gateway alternative
```bash
# Start a local proxy that translates OpenAI calls to 0G Compute calls
0g-compute-cli inference serve --provider $PROVIDER

# Then call localhost (no api_key needed)
curl http://127.0.0.1:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{ "model": "qwen/qwen-2.5-7b-instruct", "messages": [...] }'
```
Useful for daemon mode (`ivaronix serve` could optionally proxy through this).

### Use it (OpenAI-compatible)
```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: `${process.env.ZG_SERVICE_URL}/v1/proxy`,
  apiKey: process.env.ZG_API_SECRET,    // app-sk-... from get-secret
})

const completion = await client.chat.completions.create({
  model: 'qwen/qwen-2.5-7b-instruct',
  messages: [{ role: 'user', content: 'Hello, frontier.' }],
})
```

### Wallet-based auth alternative (broker SDK direct, no API key)
```typescript
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk'

const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai')
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
const broker = await createZGComputeNetworkBroker(wallet)

const { endpoint, model } = await broker.inference.getServiceMetadata(PROVIDER_ADDRESS)
const headers = await broker.inference.getRequestHeaders(PROVIDER_ADDRESS)

const res = await fetch(`${endpoint}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Hello!' }] }),
})
```

### Balance check
```bash
0g-compute-cli get-account
# OR dashboard: https://compute-marketplace.0g.ai
```

### Cost
- Ledger setup: 3 OG one-time deposit
- Per provider: 1 OG transfer
- Total to bootstrap one provider: 4 OG
- We have 70 OG → easily bootstrap 5+ providers if needed

### Reference repos
- Starter kit: `https://github.com/0gfoundation/0g-compute-ts-starter-kit`
- SDK: `npm install @0gfoundation/0g-compute-ts-sdk`
- Fine-tuning example: `https://github.com/0gfoundation/fine-tuning-example`

---

## 3. 0G Storage — TypeScript SDK

### Install
```bash
npm install @0gfoundation/0g-storage-ts-sdk ethers
```

### Initialize (Day 1)
```typescript
import { Indexer } from '@0gfoundation/0g-storage-ts-sdk'
import { ethers } from 'ethers'

const RPC_URL = 'https://evmrpc-testnet.0g.ai'
const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai'

const provider = new ethers.JsonRpcProvider(RPC_URL)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider)
const indexer = new Indexer(INDEXER_RPC)
```

### Upload (in-memory or file)
```typescript
import { MemData, ZgFile } from '@0gfoundation/0g-storage-ts-sdk'

// In-memory:
const file = new MemData(new TextEncoder().encode('hello 0G'))

// File on disk:
// const file = new ZgFile.fromFilePath('./contract.pdf')

const [rootHash, uploadErr] = await indexer.upload(file, RPC_URL, signer)
if (uploadErr) throw uploadErr
console.log('root hash:', rootHash)
```

### Download (with Merkle verification)
```typescript
const err = await indexer.download(rootHash, './hello.txt', true)  // 3rd arg = withProof
if (err) throw err
```

### Verify on Storage Scan
- Testnet: `https://storagescan-galileo.0g.ai`
- Mainnet: `https://storagescan.0g.ai`

### Reference repos / SDKs
- TS SDK: `npm install @0gfoundation/0g-storage-ts-sdk`
- Go SDK: `go get github.com/0gfoundation/0g-storage-client`
- Rust SDK: `git clone https://github.com/0gfoundation/0g-storage-sdk-rust`
- Web starter kit: `https://github.com/0gfoundation/0g-storage-web-starter-kit`
- TS starter kit: `https://github.com/0gfoundation/0g-storage-ts-starter-kit`
- Go starter kit: `https://github.com/0gfoundation/0g-storage-go-starter-kit`
- Storage Scan tool (browser UI, no code): `https://storagescan.0g.ai`

---

## 4. 0G Chain — Solidity Deployment

### Solidity version (CONFIRMED — fixes prior 0.8.24 mistake)
**Solidity 0.8.19** + `evmVersion: "cancun"` + optimizer enabled (200 runs).

> **Gotcha from official docs:** "Pin your toolchain to evmVersion: cancun and Solidity 0.8.19. Newer EVM versions may not verify on the explorer."

### Hardhat config
```typescript
// hardhat.config.ts
export default {
  solidity: {
    version: "0.8.19",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    testnet: {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: [process.env.PRIVATE_KEY!],
    },
    mainnet: {
      url: "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
}
```

### Foundry deploy (per contract)
```bash
forge create --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $PRIVATE_KEY \
  --evm-version cancun \
  src/MyContract.sol:MyContract
```

### Verify on Chain Scan
- Testnet: `https://chainscan-galileo.0g.ai/verify-contract`
- Mainnet: `https://chainscan.0g.ai/verify-contract`

### Reference repo
- Deployment scripts (verified Hardhat + Foundry configs for testnet + mainnet): `https://github.com/0gfoundation/0g-deployment-scripts`
  - **Use this as the base for our `contracts/` workspace** — it's official, verified, ready-to-run.

### Third-party RPC (production)
- QuickNode
- Ankr

---

## 5. 0G Agentic ID (ERC-7857)

### Live pre-deployed testnet contract
**`0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F`** on Galileo testnet 16602.

> **Use this for early Studio dev** before our own `AgentPassportINFT` is deployed (Day 6). Lets us prototype passport-mint UI on Day 13-14 against a real contract before Day 6 finishes.

### Examples repo
`https://github.com/0gfoundation/agenticID-examples` — three progressive examples:
1. `01-mint-and-manage` — Next.js + RainbowKit web app (mint, manage, transfer, authorize)
2. `02-authorization-and-delegation` — CLI script for per-token + batch authorization, hot-wallet delegation, cloning, revocation
3. `03-marketplace-trading` — EIP-712 signed orders, partner/creator royalties, escrow, atomic trade execution

### Reference (production)
**`https://github.com/0gfoundation/0g-agent-nft`** — the reference implementation with real TEE/ZKP proof verification. **Use this as base for our `AgentPassportINFT.sol`.** The examples repo has a simplified version; production uses 0g-agent-nft.

### Core ERC-7857 functions
```solidity
// Mint with encrypted intelligent data
function mint(
  address to,
  string calldata encryptedURI,
  bytes32 metadataHash
) external onlyOwner returns (uint256);

// Authorize executor (no ownership transfer)
function authorizeUsage(
  uint256 tokenId,
  address executor,
  bytes calldata permissions
) external;
// Up to 100 authorized users per token
// Revoke: revokeAuthorization(tokenId, executor)

// Transfer with TEE/ZKP re-encryption
function iTransferFrom(
  address from,
  address to,
  uint256 tokenId,
  bytes calldata sealedKey,
  bytes calldata proof
) external;
// Authorizations cleared on transfer for security
```

### Optional: WalletConnect
- `https://cloud.walletconnect.com` for `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (mobile wallet support in Studio)

---

## 6. Official Tools

### Essential
- Faucet: `https://faucet.0g.ai`
- Storage Scan: `https://storagescan.0g.ai`
- Chain Scan (mainnet): `https://chainscan.0g.ai`
- Chain Scan (testnet): `https://chainscan-galileo.0g.ai`
- Compute Marketplace: `https://compute-marketplace.0g.ai`

### Infrastructure
- Validator Dashboard (testnet)
- QuickNode RPC (third-party)
- Ankr RPC (third-party)

### Community
- **OpenAdapter** — access 70+ state-of-the-art open-source AI models through a single endpoint across any coding editor. *Worth investigating as alt provider for Phase 2 multi-model consensus.*

---

## 7. Official SDKs / Starter Kits (full list)

### Official SDKs
| Package | Lang | Install |
|---|---|---|
| `@0gfoundation/0g-storage-ts-sdk` | TS | `npm install @0gfoundation/0g-storage-ts-sdk` |
| `@0gfoundation/0g-compute-ts-sdk` | TS | `npm install @0gfoundation/0g-compute-ts-sdk` |
| `0g-da-rust-sdk` | Rust | `cargo add 0g-da-rust-sdk` |
| `0g-storage-sdk-rust` | Rust | `git clone github.com/0gfoundation/0g-storage-sdk-rust` |
| `0g-storage-client` (Go) | Go | `go get github.com/0gfoundation/0g-storage-client` |
| **`0g-memory`** | TS | `git clone github.com/0gfoundation/0g-memory` — **see §10 conflict** |

### Official starter kits (clone & run)
- `0g-compute-ts-starter-kit` — Compute end-to-end TS
- `0g-storage-web-starter-kit` — Storage browser TS
- `0g-storage-ts-starter-kit` — Storage Node TS
- `0g-storage-go-starter-kit` — Storage Go
- `agenticID-examples` — ERC-7857 (3 examples)
- `0g-deployment-scripts` — Hardhat + Foundry configs
- `fine-tuning-example` — fine-tuning end-to-end TS

### Community SDKs (NOT officially maintained)
- `0g-py-sdk` (Python) by `mandatedisrael` — Compute + Storage
- **`0g-kit`** (TS) by `mandatedisrael` — "Ultra-minimal TypeScript wrappers for 0G Inference and Storage. Two-line integrations for fast prototyping." — **see §10 conflict**

---

## 8. Documentation Map (docs.0g.ai)

### Getting Started
- Quick Start
- Understanding 0G
- Vision & Mission
- Testnet Overview / Mainnet Overview

### Concepts
- Chain
- Compute
- Storage
- Data Availability
- AI Alignment
- Agentic ID
- Deploy Contracts

### Deep dives
- Compute Network Overview, Inference, Fine-tuning
- Storage SDK, Storage CLI
- DA Integration, DA Deep Dive
- Agentic ID Overview, Agentic ID Integration Guide, ERC-7857 Standard

### Top-level URL
`https://docs.0g.ai`

---

## 9. Showcase Projects Built on Each Stack

### Built with Compute (active examples)
- Shawarma Orchestrate, Alpha Dawg, Don't Get Drained, Croisette.cc, Orchestra, CaaS — all ETHGlobal Cannes 2026

### Built with Storage
- Same set largely, plus storage-heavy projects

### Built with Chain
- Same set, plus Finoma (prediction markets)

### Built with Agentic ID
- DIVE, Orchestra, CaaS, Genie, GhostFi, AgentExpo

**Pattern:** ETHGlobal Cannes 2026 cohort dominates the showcase. Most use 2-3 0G primitives. None use all 4 deeply. **Ivaronix's "uses every primitive" claim still holds.**

---

## 10. ⚠️ CONFLICTS WITH OUR PLAN — needs decision

### Conflict A: `0g-memory` already exists (official 0G product)

**What it is:** `https://github.com/0gfoundation/0g-memory` — "Persistent memory for AI coding assistants. Conversations auto-stored, indexed, and retrieved across sessions on 0G decentralized storage."

**Overlap with us:** our `packages/memory` is also wallet-bound persistent memory on 0G Storage. We add capability registry + temporal graph + lifecycle hooks (claude-mem pattern).

**Options:**
1. **Adopt + extend** — fork or depend on `0g-memory` for the storage primitive, layer our capability registry + access log + temporal graph on top. Less code to write; aligned with official direction; harder to differentiate.
2. **Build parallel + cite** — build `packages/memory` independently with our hybrid (vector + graph + FTS + KV). Keep our differentiation (4-way hybrid, no other project has it). Acknowledge `0g-memory` as related work.
3. **Drop our memory layer** — use `0g-memory` directly, focus our energy on receipts + skills + studio.

**My take:** option 2. Our 4-way hybrid memory (vector + temporal + FTS + KV) is genuinely best-of-class per the cross-folder analysis. `0g-memory` is convenient but appears to be storage-only (not vector/graph hybrid). We don't lose differentiation by going parallel.

### Conflict B: `0g-kit` already does what `@ivaronix/og-toolkit` was supposed to do

**What it is:** `https://github.com/mandatedisrael/0g-kit` — community-built. "Ultra-minimal TypeScript wrappers for 0G Inference and Storage. Two-line integrations for fast prototyping."

**Overlap with us:** `@ivaronix/og-toolkit` was supposed to be exactly this — clean DX wrappers around official SDKs. The "quiet moat" thesis was that every 0G app would adopt our wrappers.

**Options:**
1. **Drop og-toolkit; contribute to / adopt 0g-kit** — saves us 2 days, but kills the moat thesis. Phase B og-kit credibility instead.
2. **Build og-toolkit anyway, but with receipt defaults** — differentiate by making EVERY call to our toolkit produce a receipt by default (via daemon). 0g-kit is bare wrappers; ours is receipts-aware wrappers.
3. **Drop og-toolkit entirely** — focus energy on Studio, skills, contracts.

**My take:** option 2. The moat thesis only works if our wrappers do something theirs don't. Receipt-aware-by-default IS that something. 0g-kit can't add receipts without our daemon + receipt schema. Reframe: `@ivaronix/og-toolkit` = "0g-kit but every call produces a verifiable receipt."

### Both conflicts argue for the same response

**Stay differentiated by deepening 0G-native value-add (receipts + capability registry), not by reimplementing storage/inference primitives that already have community wrappers.** Don't compete with the foundation; build on top of them.

---

## 11. What this changes in our plan

| Change | Where |
|---|---|
| **Solidity version 0.8.24 → 0.8.19** | `BUILD.md §3.6`, `HLD.md §10`, deployment configs |
| **Add Compute CLI bootstrap to Day 1** | `BUILD.md §1` Day 1 — run `0g-compute-cli setup-network → login → deposit → list-providers → transfer-fund → acknowledge-provider → get-secret` and capture `ZG_SERVICE_URL` + `ZG_API_SECRET` to `.env` |
| **Use `0g-deployment-scripts` repo as `contracts/` base** | `BUILD.md §1` Day 1 |
| **Use `0g-agent-nft` reference impl as base for `AgentPassportINFT.sol`** | `BUILD.md §1` Day 6 |
| **Use pre-deployed `0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F` testnet ERC-7857 for Studio prototyping** | `BUILD.md §1` Day 13-14 (before Day 6 contract is ready) |
| **Reframe `@ivaronix/og-toolkit`** to "receipt-aware wrappers" (vs `0g-kit` bare wrappers) | `BUILD.md §1` Day 20 + `HLD.md §3` monorepo |
| **Reframe `packages/memory`** as 4-way hybrid (vs `0g-memory` storage-only) | `HLD.md §8` |
| **Add `OpenAdapter`** as Phase 2 alt provider for multi-model consensus | `PRD.md §4.5` Phase 2 note |

---

## 12. Quick Reference (for grep)

### URLs to bookmark
- Compute marketplace: `https://compute-marketplace.0g.ai`
- Storage Scan: `https://storagescan.0g.ai`
- Chain Scan testnet: `https://chainscan-galileo.0g.ai`
- Chain Scan mainnet: `https://chainscan.0g.ai`
- Faucet: `https://faucet.0g.ai`
- Builder Hub: `https://build.0g.ai`
- Docs: `https://docs.0g.ai`
- WalletConnect: `https://cloud.walletconnect.com`

### Repos to clone
- `github.com/0gfoundation/0g-compute-ts-starter-kit`
- `github.com/0gfoundation/0g-storage-ts-starter-kit`
- `github.com/0gfoundation/0g-storage-web-starter-kit`
- `github.com/0gfoundation/agenticID-examples`
- `github.com/0gfoundation/0g-agent-nft` (reference impl for ERC-7857)
- `github.com/0gfoundation/0g-deployment-scripts`
- `github.com/0gfoundation/fine-tuning-example`

### Provider addresses (testnet)
- Qwen 2.5 7B Instruct: `0xa48f01287233509FD694a22Bf840225062E67836`
  - Service URL (when acknowledged from wallet `0x1Be5...` 2026-05-08): `https://compute-network-6.integratenetwork.work/v1/proxy`
  - Service URLs may be per-(wallet × provider) tuple — re-run `get-secret` if you change wallets

### Pre-deployed contracts (testnet, free to use)
- ERC-7857 example: `0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F`

---

**End of 0G_RESOURCES.md.** This is the working catalog. Update it when 0G ships new SDKs or we discover new patterns. Other docs link here rather than restating.
