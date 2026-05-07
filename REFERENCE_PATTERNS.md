# Ivaronix Reference Patterns

> Source-of-truth catalog of concrete, copy-grade patterns extracted from 0G showcase winners and grant-track entries.
> Every other Ivaronix planning doc references this one. **Do not duplicate patterns into other docs — link here.**

Last verified against repos in `entries/` and `og-projects-showcase/` on 2026-05-07.

---

## 0. The Winning Formula (one paragraph)

A 0G grant-winning project ships **3-5 mainnet contracts** (ERC-7857 INFT + CapabilityRegistry + AccessLog + an attestation/receipt registry), an **OpenClaw skill** that exposes the same primitives via `openclaw skills install <name>`, **a CLI binary or skill** with at least 8-10 first-class commands, **uses free public APIs** only (no paid keys at MVP), publishes a **README with real metrics** (TX count, uptime, accuracy, ELO), and ships an **independent TEE verification path** that does not trust the Router flag. Everything else is theatre.

---

## 1. Network Constants (frozen — do not redefine elsewhere)

```env
# Galileo Testnet (current)
OG_NETWORK=testnet
OG_CHAIN_ID=16602
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_EXPLORER=https://chainscan-galileo.0g.ai
OG_STORAGE_EXPLORER=https://storagescan-galileo.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api-testnet.integratenetwork.work/v1

# Aristotle Mainnet
OG_NETWORK=mainnet
OG_CHAIN_ID=16661
OG_RPC_URL=https://evmrpc.0g.ai
OG_CHAIN_EXPLORER=https://chainscan.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api.0g.ai/v1
```

**Sources:** `oglabs resources/0g-doc/docs/ai-context.md:20,46`, `mainnet-overview.md:25`, `testnet-overview.md:26`.

**Stale values that appear in the wild and MUST be flagged by `ivaronix doctor`:**
- `16601` — old testnet ID (Galileo legacy)
- `16600` — never valid as mainnet (`0G_OFFICIAL_LINKS.md:23` is wrong)
- Hex `0x40EA` (16,618) and `0x4125` (16,677) — appear in some docs but conflict with the canonical decimal values 16602/16661. **Trust decimal, distrust hex when in doubt.**

---

## 2. Contract Patterns (mainnet-shaped)

### 2.1 Receipt / Attestation Registry — *Provus pattern*

**Why copy:** Provus runs a 15-second loop: `recordVolatility()` + `attest()`. 30,000+ TXs on mainnet 16661. Every signal cryptographically verifiable. Block timestamp = proof of pre-event existence.

**Minimum interface (Solidity 0.8.24, OpenZeppelin v5):**

```solidity
contract ReceiptRegistry is Ownable2Step, Pausable {
    struct Receipt {
        bytes32 receiptRoot;        // keccak256 of canonical receipt JSON
        bytes32 storageRoot;        // 0G Storage Merkle root
        address agentAddress;       // wallet that owns the receipt
        uint64 timestamp;           // block.timestamp
        uint8 receiptType;          // 0=doc, 1=audit, 2=consensus, 3=burn
        bytes32 attestationHash;    // TEE attestation hash (Router or independent)
    }

    event ReceiptAnchored(uint256 indexed id, bytes32 indexed receiptRoot, address indexed agent);

    mapping(uint256 => Receipt) public receipts;
    uint256 public nextId;

    function anchor(
        bytes32 receiptRoot,
        bytes32 storageRoot,
        uint8 receiptType,
        bytes32 attestationHash
    ) external whenNotPaused returns (uint256 id) {
        id = nextId++;
        receipts[id] = Receipt({
            receiptRoot: receiptRoot,
            storageRoot: storageRoot,
            agentAddress: msg.sender,
            timestamp: uint64(block.timestamp),
            receiptType: receiptType,
            attestationHash: attestationHash
        });
        emit ReceiptAnchored(id, receiptRoot, msg.sender);
    }
}
```

**Storage layout rule (Provus):** pack receipt fields into ≤4 storage slots per record. Keep getters O(1). Cache reputation aggregates separately.

**Gas cost benchmark (Provus mainnet):** ~0.008 OG per cycle (2 txns). At ~$5/OG that's $0.04/cycle vs ~$50 on Ethereum L1.

### 2.2 Reputation Engine — *Provus + MUSASHI pattern*

**Why copy:** Provus uses chess-standard ELO (K-factor 32) with current ELO 847. MUSASHI uses conviction-weighted strikes with 97% rejection rate.

**Two viable models — pick one:**

**A. ELO (continuous, fits real-time loops):**
```solidity
function updateElo(uint256 strategyId, bool win, uint256 opponentElo) external {
    Reputation storage r = reps[strategyId];
    uint256 expected = 1e18 / (1 + 10 ** ((opponentElo - r.elo) / 400));
    int256 delta = int256(K_FACTOR * (uint256(win ? 1e18 : 0) - expected) / 1e18);
    r.elo = uint256(int256(r.elo) + delta);
}
```

**B. Conviction Strikes (discrete, fits research/analysis):**
```solidity
struct Strike {
    bytes32 evidenceRoot;   // 0G Storage Merkle root of evidence JSON
    uint8 convictionScore;  // 0-100, only ≥80 publishable
    uint64 timestamp;
    int128 realizedReturn;  // basis points, settled later
    bool resolved;
}
```

**Ivaronix should use Strike model** because action receipts are discrete events, not continuous signals. Add `realizedOutcome` for delayed settlement (was the audit accurate? did the doc summary hold up?).

### 2.3 Capability Registry — *SealedMind pattern* (CRITICAL — currently unused by PRD)

**Why copy:** SealedMind ships a `CapabilityRegistry` that lets users authorize external apps/agents to access their memory, plus a `MemoryAccessLog` audit trail. This is the on-chain backbone of Ivaronix's "Memory Permission Center" which currently exists only as UI in the PRD.

```solidity
contract CapabilityRegistry {
    struct Grant {
        address grantee;        // agent or external app
        bytes32 scopeHash;      // hash of allowed scope (memory namespace, skill ID, etc.)
        uint64 expiresAt;
        bool revoked;
    }

    mapping(address owner => mapping(bytes32 grantId => Grant)) public grants;

    event GrantIssued(address indexed owner, address indexed grantee, bytes32 indexed grantId);
    event GrantRevoked(address indexed owner, bytes32 indexed grantId);

    function grant(address grantee, bytes32 scopeHash, uint64 ttl) external returns (bytes32 grantId) {
        grantId = keccak256(abi.encode(msg.sender, grantee, scopeHash, block.timestamp));
        grants[msg.sender][grantId] = Grant(grantee, scopeHash, uint64(block.timestamp) + ttl, false);
        emit GrantIssued(msg.sender, grantee, grantId);
    }

    function revoke(bytes32 grantId) external {
        grants[msg.sender][grantId].revoked = true;
        emit GrantRevoked(msg.sender, grantId);
    }
}
```

**MemoryAccessLog** is even simpler — append-only event emitter, no storage:
```solidity
event MemoryAccessed(
    address indexed agent,
    bytes32 indexed grantId,
    bytes32 indexed memoryRoot,
    uint8 accessType  // 0=read, 1=write, 2=delete
);
```

### 2.4 ERC-7857 Agent Passport (INFT) — *Aishi + MUSASHI + SealedMind pattern*

**Why copy:** Every showcase/grant winner mints an INFT. SealedMind's `SealedMindNFT`, MUSASHI's `MusashiINFT` (`0x74BC82d4...`), Aishi's `AishiAgent` (`0x6Ea891A7...`). PRD originally deferred this to Phase 4 — **promoted to MVP (testnet-first, mainnet at promotion).** Day 6 of `BUILD.md §1`.

**Minimum interface (subset of ERC-7857 sufficient for MVP):**

```solidity
contract AgentPassportINFT is ERC721, ERC7857DataPointer {
    struct AgentData {
        bytes32 metadataRoot;       // 0G Storage root of encrypted metadata blob
        bytes32 memoryRoot;         // current memory state root
        bytes32 skillManifestRoot;  // installed skills manifest
        uint64 receiptCount;        // verified action receipts
        uint64 violationCount;      // policy violations
        int128 trustScore;          // signed reputation
    }

    mapping(uint256 tokenId => AgentData) public agents;

    function mint(bytes32 metadataRoot) external returns (uint256 tokenId) { ... }

    // ERC-7857: secure re-encryption on transfer
    function authorizeTransfer(uint256 tokenId, address to, bytes calldata teeProof) external { ... }

    // ERC-7857: authorized usage without ownership transfer
    function authorizeExecutor(uint256 tokenId, address executor, uint64 ttl) external { ... }

    function clone(uint256 tokenId) external returns (uint256 newTokenId) { ... }
}
```

**Encrypted metadata blob (stored on 0G Storage, root in `metadataRoot`):**
```json
{
  "agentId": "did:0g:passport:0x...:1",
  "ownerWallet": "0x...",
  "name": "ivaronix-default",
  "personality": { "style": "concise", "risk": "balanced" },
  "modelHistory": ["qwen/qwen-2.5-7b-instruct"],
  "skillsInstalled": ["private-doc-review", "0g-integration-auditor"],
  "permissionProfile": "default-strict",
  "memoryRoot": "0x...",
  "receiptList": ["0x...", "0x..."],
  "createdAt": 1715000000
}
```

**Re-encryption requirement:** ERC-7857 transfer must re-encrypt metadata to the new owner's pubkey via TEE-attested oracle. Use the official `0g-doc/docs/developer-hub/building-on-0g/inft/integration.md` flow. Don't shortcut.

### 2.5 Verifier Contract — *Aishi + SealedMind pattern*

**Why copy:** Both ship a verifier alongside the INFT (e.g., `AishiVerifier 0x978a566B...`). Verifies ERC-7857 sealed data integrity on-chain so transfers and clones can be permissionless.

Ship a minimal `Erc7857Verifier` that exposes `verifyDataIntegrity(bytes32 metadataRoot, bytes calldata teeAttestation) returns (bool)`.

---

## 3. 0G Storage Patterns

### 3.1 Encrypted-by-default uploads — *Burn Mode*

**Why copy:** SealedMind uses AES-256-GCM with per-user key derivation. SDK detail: `peekHeader(rootHash)` lets clients detect the encryption mode without downloading. Wrong key may return ciphertext (not throw) — must verify decrypted payload format.

**Burn-Mode upload sequence (the "kill the key, keep the proof" pattern):**

1. Generate session key `K_session` (256-bit random).
2. AES-256-GCM encrypt payload locally → ciphertext + nonce + auth-tag.
3. `ZgFile.fromFilePath()` → `file.merkleTree()` → capture root hash.
4. `indexer.upload(file, RPC_URL, signer)` → capture txn hash.
5. **Destroy `K_session` from memory + every cache** (zero buffer, vacuum tmp dir).
6. Receipt records: rootHash, encryption type, key fingerprint (SHA-256 of `K_session` BEFORE destruction), key destruction timestamp, local cleanup status.

**Wording rules — important for grant pitch credibility:**
- ✅ "session key was destroyed; ciphertext on 0G Storage is now unreadable"
- ❌ "deleted from blockchain"
- ❌ "deleted from 0G Storage"
- ❌ "burnt off-chain"

### 3.2 0G Storage KV — *OpenClaw + AIsphere pattern* (CRITICAL — currently unused by PRD)

**Why copy:** OpenClaw uses 0G KV for `latest-manifest` pointer. AIsphere uses Storage-KV for working state. **Almost no competitor uses KV well; using it gives "uses every 0G primitive" claim at near-zero dev cost.**

**Use cases for Ivaronix:**

| Key | Value | Why KV not Storage |
|---|---|---|
| `passport:{wallet}:latest` | latest passport metadata root hash | mutable pointer, frequent reads |
| `memory:{agentId}:manifest` | latest memory manifest hash | mutable, every action updates it |
| `skills:{wallet}:installed` | JSON array of installed skill IDs + versions | small, frequently mutated |
| `receipts:{wallet}:cursor` | last receipt ID + block height | mutable, high-write |

**Rule:** anything that's a *mutable pointer to a Storage root* belongs in KV. Anything that's *the root itself or its content* belongs in Storage.

### 3.3 Memory snapshot pattern — *MUSASHI evidence archive*

MUSASHI uploads full pipeline output as Merkle-verifiable JSON to 0G Storage. Anyone can download and verify tampering.

**Ivaronix should adopt:** every `ivaronix doc ask`, `ivaronix audit`, `ivaronix swarm` invocation produces a sealed `evidence.json` uploaded to 0G Storage. The receipt's `storageRoot` points to it. CLI verify command downloads + verifies Merkle proof.

---

## 4. 0G Compute Patterns

### 4.1 Independent TEE verification — *MUSASHI + SealedMind + Provus pattern*

**Why copy:** Router's `verify_tee: true` is convenient but trusts the Router. Winners verify the provider signature *after the fact* via SDK. PRD currently flags this in `IVARONIX_FORGE_0G_DOC_GAPS.md:27-66` but defers actual implementation.

**Implementation (TypeScript via `@0gfoundation/0g-compute-ts-sdk`):**

```typescript
import { createBroker } from '@0gfoundation/0g-compute-ts-sdk';

async function verifyTeeIndependent(receipt: Receipt) {
  const broker = await createBroker({ rpcUrl: OG_RPC_URL, signer });
  const valid = await broker.inference.processResponse(
    receipt.routerTrace.providerAddress,
    receipt.routerTrace.zgResKey,        // chatID from response header
  );
  return {
    independentVerified: valid,
    verificationMethod: 'compute_sdk_process_response',
    verifiedAt: Date.now(),
  };
}
```

**Capture from every Router call:**
- response header `ZG-Res-Key`
- `x_0g_trace.provider` → providerAddress
- `x_0g_trace.tee_verified` → routerVerified flag (separate from independent)
- model ID

**Receipt schema fields (canonical):** see `RECEIPTS_SPEC.md` §3.

### 4.2 Sealed Inference for sensitive payloads — *SealedMind pattern*

SealedMind uses 0G Sealed Inference (Intel TDX + NVIDIA H100 TEE) for both "remember" (TEE fact extraction) and "recall" (TEE synthesis with attestation). The attestation hash is recorded with every operation.

**For Ivaronix Burn Mode:** when running consensus on a private doc, the inference call MUST be sealed (TEE), and the resulting attestation hash MUST be in the receipt. Otherwise "Burn Mode" is theatre — the Router could leak the doc to a non-TEE provider.

### 4.3 Provider routing — *Router-native pattern*

```bash
ivaronix doc ask deck.pdf --provider-sort latency      # fast mode
ivaronix audit repo --provider-sort price              # cheap mode
ivaronix doc ask doc.pdf --provider 0xabc...           # pinned mode
ivaronix doc ask doc.pdf --allow-fallbacks             # resilient mode
```

Receipt MUST capture `requestedSort`, `requestedProvider`, `allowFallbacks`, `finalProvider` so users can audit "did I really get the cheap provider I asked for?"

### 4.4 Pre-flight model capability check

Before any expensive call, query `GET /v1/models` and `GET /v1/providers?model=<id>` and cache:

```json
{
  "model": "qwen/qwen-2.5-7b-instruct",
  "contextLength": 32768,
  "maxOutputTokens": 8192,
  "capabilities": { "toolCalling": true, "jsonMode": true, "teeVerified": true, "reasoning": false },
  "providerCount": 1
}
```

**Why:** consensus mode runs 3-5 model calls; without capability checks Forge will silently fail when a provider doesn't support tools. Estimate cost before launching.

---

## 5. CLI Architecture Patterns

### 5.1 Plan/Build/Audit/Doc/Swarm/Watch/Receipt mode — *OpenCode + Octogent pattern*

OpenCode separates `plan` (read-only) from `build` (full-access). Octogent runs scoped workspaces with `CONTEXT.md`, `todo.md`, `notes.md`. Ivaronix should expose 7 modes:

| Mode | Purpose | Permissions |
|---|---|---|
| `plan` | read-only repo/doc analysis | read-only, no shell, no wallet |
| `build` | full coding | read+write+shell+skill, ask before wallet/network |
| `audit` | scoped review with receipt | read+memory+receipt, no write |
| `doc` | private document Q&A | read-private + receipt + burn-mode + consensus |
| `swarm` | parent/worker on todo list | parent dispatches, workers worktree-isolated |
| `watch` | long-running daemon | wakes on file change / cron / channel |
| `receipt` | verify/inspect existing receipts | read-only chain + storage |

### 5.2 Scoped workspace — *Octogent `.octogent/` pattern*

```
.ivaronix/
├── CONTEXT.md           # human-editable scope description
├── todo.md              # swarm mode reads tasks from here
├── notes.md             # agent's working notes
├── memory/              # local memory cache
│   ├── manifest.json    # mirrors 0G KV pointer
│   └── observations.db  # SQLite + FTS5 (claude-mem pattern)
├── skills/              # installed skills
│   └── <skill-id>/SKILL.md
├── receipts/            # local receipt cache (mirrors chain)
└── .session/            # PTY transcripts, event stream
```

### 5.3 Lifecycle hooks — *claude-mem pattern* (CRITICAL — currently missing)

claude-mem went viral on Claude because of `SessionStart`/`Stop`/`PreCompact` hooks. Ivaronix needs:

```yaml
# .ivaronix/hooks.yml
PreToolUse:
  - match: "wallet.*"
    run: "ivaronix safety-check wallet"
PostToolUse:
  - match: "shell|file_write"
    run: "ivaronix observation extract"
SessionEnd:
  - run: "ivaronix memory consolidate && ivaronix receipt close"
PreCompact:
  - run: "ivaronix memory snapshot --upload"
```

Without hooks, memory is opt-in and shallow. With hooks, every action gets observed → extracted → stored → eventually proved.

### 5.4 Skill format — *awesome-claude-skills pattern*

```
skills/private-doc-review/
├── SKILL.md             # human-readable skill description
├── manifest.json        # machine-readable: id, version, permissions, hashes
├── prompt.md            # system prompt fragment
├── tools/               # optional helper scripts
└── tests/               # expected behavior fixtures
```

**Manifest hash** must match what's recorded in passport's `skillManifestRoot`. Skill registry stores `(skillId, version) → contentHash` on 0G Chain.

### 5.5 OpenClaw skill ship-alongside — *MUSASHI + SealedMind + AIsphere + AlphaTrace pattern* (FREE WIN)

```bash
openclaw skills install ivaronix
```

**Cost:** ~1 dev day. Just wrap the CLI in OpenClaw's skill format with `openclaw.json` config. Read-only mode needs no wallet; on-chain operations need `OG_CHAIN_PRIVATE_KEY`, `OG_STORAGE_RPC`, `OG_STORAGE_INDEXER`.

**Value:** signals 0G ecosystem citizenship. Every grant winner does this.

### 5.6 MCP server — *AIsphere pattern* (FREE WIN)

AIsphere ships an MCP server with 10 tools. Lets every Claude/Codex/Cursor user compose Ivaronix without leaving their IDE.

Minimum tools to expose:
- `ivaronix.ask(doc, question, options)` — runs doc-ask flow, returns receipt ID
- `ivaronix.verifyReceipt(receiptId)` — verifies a receipt end-to-end
- `ivaronix.searchMemory(query, scope)` — searches local + 0G Storage memory
- `ivaronix.installSkill(githubUrl)` — sandboxed skill installer
- `ivaronix.passportShow()` — current passport state

---

## 6. Pipeline Patterns (multi-agent)

### 6.1 Adversarial debate — *MUSASHI + AlphaDawg pattern*

MUSASHI uses Bull/Bear agents arguing opposite sides; only 3-4 convergence scores reach STRIKE.
AlphaDawg uses Analyst/Critic/Judge.

**Ivaronix consensus implementation:**

```typescript
const roles = ['analyst', 'critic', 'judge'] as const;
const responses = await Promise.all(
  roles.map(role => routerCall({ model, systemPrompt: prompts[role], userPrompt }))
);
const convergence = computeConvergence(responses);  // semantic similarity 0-1
const judgement = await routerCall({
  model, systemPrompt: prompts.judge,
  userPrompt: `Analyst: ${responses[0]}\nCritic: ${responses[1]}\nDecide.`,
});
return { responses, convergence, judgement, attestations: responses.map(r => r.attestationHash) };
```

**Receipt records:** all three responses, attestations, convergence score, final judgement. Independent TEE verify each one separately.

### 6.2 Gate-based fail-fast — *MUSASHI 7-gate pattern*

Sequential elimination with cheap gates first, expensive gates last. 97% rejection at gate level means 97% of tokens never burn the expensive 4-specialist pipeline.

**Ivaronix doc-audit gates (proposed):**
1. File type / size sanity
2. Sensitive-content detection (PII, secrets) → triggers Burn Mode automatically
3. Token budget vs context window
4. Model capability match
5. Provider availability
6. Wallet balance sufficient
7. Receipt registry not paused

Run gates in order, fail fast, log gate-N failure to receipt.

### 6.3 Self-calibration — *MUSASHI judge pattern*

MUSASHI's judge reads past strikes + outcomes before every decision. Ivaronix's audit/consensus agents should read past receipts + realized outcomes (was the audit accurate? did the doc summary hold?) before issuing new ones. Closes the reputation loop.

---

## 7. Data-Source Patterns (zero-budget)

**Free sources used by winners — copy this list verbatim, no paid keys at MVP:**

| Source | Use |
|---|---|
| Public chain RPCs (Ethereum, BSC, Polygon, Arbitrum, Base, 0G) | wallet/contract metadata |
| Etherscan-class explorers (rate-limited but free) | tx history |
| GitHub REST API (unauth: 60 req/h, with token: 5000/h) | repo audit, skill discovery |
| GoPlus Security | contract safety |
| DexScreener / GeckoTerminal / DefiLlama / CoinGecko | token data (MUSASHI uses all 4) |
| Farcaster Hub | social signal |
| 0G's own indexers (Goldsky) | 0G chain queries |

**Rule:** if a source requires a paid key at MVP, drop it. Add later.

---

## 8. Metric Patterns (the "live numbers" that win grants)

The README that wins lists **real metrics**:

| Metric | Provus | MUSASHI | Adopt for Ivaronix |
|---|---|---|---|
| Total mainnet TXs | 30,000+ | strikes count | yes — `ivaronix doctor --metrics` shows live count |
| Uptime | 99.7% | n/a | yes — agent loop uptime |
| Latency | 247ms avg | n/a | yes — receipt anchoring latency |
| Accuracy / Acceptance | 79% signal | 97% rejection | yes — % of audits that hold up vs realized outcome |
| Reputation score | ELO 847 | conviction-weighted | yes — passport trustScore |
| Gas cost | 0.008 OG/cycle | per-strike | yes — per-receipt cost in OG |
| Audit | ChainGPT (April 2026) | n/a | aspirational — apply for free audit pre-grant |

**Action:** the day Ivaronix has its first mainnet receipt, start logging metrics to a public dashboard. Provus's playbook: 30K TXs by submission day = unbeatable credibility.

---

## 9. Audit Pattern — *Provus ChainGPT*

Provus got a free ChainGPT AI Audit (April 2026). No critical or high findings; low-severity all resolved in commit `85041b5`. They documented 5 production problems with root cause analysis in `ENGINEERING_DEBUG_LOG.md`.

**Ivaronix should:**
1. Apply for ChainGPT audit when contracts are stable.
2. Maintain a public `ENGINEERING_DEBUG_LOG.md` from day 1 — judges read it as a credibility signal.

---

## 10. What NOT to copy

These appear in some entries but are *anti-patterns* for the Ivaronix wedge:

- **Whale-fun**, **OGChain**, **ChainShield** (low-depth single-primitive entries) — single-primitive narrative loses to multi-primitive narrative.
- **Full marketplace UI at MVP** — every entry that built a marketplace under-shipped the core primitive. Build the primitive, marketplace is Phase 4.
- **Mobile app at MVP** — no winner needed one.
- **Voice chat / image gen / fine-tuning** — listed in 0G docs but unused by every winner; don't build for Phase 0.
- **Custom L1 / appchain on 0G DA** — heavy infra. DA is roadmap, not MVP.
- **"Operator pays mode" as a headline feature** (currently in `ivaronix_final_prd.md:1265`) — UX nicety, not differentiator. Mention briefly, don't lead with it.

---

## 11. Source Files (for verification)

| Pattern source | File |
|---|---|
| Network constants | `oglabs resources/0g-doc/docs/ai-context.md`, `mainnet-overview.md`, `testnet-overview.md` |
| Provus contracts/metrics | `entries/provus-protocol/ANALYSIS.md` |
| MUSASHI contracts/CLI/pipeline | `entries/musashi/ANALYSIS.md` |
| SealedMind capability registry | `entries/SealedMindMonoRepo/ANALYSIS.md` |
| Aishi INFT pattern | `og-projects-showcase/Aishi/SHOWCASE_ANALYSIS.md` |
| Storage SDK details | `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/storage/sdk.md` |
| Compute / Router | `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/compute-network/router/*` |
| INFT / ERC-7857 | `oglabs resources/0g-doc/docs/developer-hub/building-on-0g/inft/*` |
| Existing DOC_GAPS engineering detail | `IVARONIX_FORGE_0G_DOC_GAPS.md` (still authoritative for SDK quirks) |

---

**End. Do not duplicate these patterns elsewhere. Reference by anchor (e.g., `REFERENCE_PATTERNS.md §2.3`).**
