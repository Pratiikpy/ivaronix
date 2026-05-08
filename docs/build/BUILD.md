# Ivaronix — Build & Operational Guide

> **Status:** v3 (full Nexus vision, locked 2026-05-07).
> **Companion docs:** `PRD.md`, `HLD.md`, `RECEIPTS_SPEC.md`, `REFERENCE_PATTERNS.md`, `PITCH.md`.
> **Rule:** this doc is what the dev agent reads during implementation. Network constants, SDK quirks, command map, build order, deploy steps. **Single source of truth for operational details.**

---

## 1. Build Order — 30-Day Plan, Two Phases

**Strategy (locked):** build the FULL product on Galileo testnet (16602) first. Studio + CLI + API + 50-skill marketplace + every contract + every layer. Test end-to-end. Hit a green CI matrix. **Only then promote to mainnet (16661)** as a single, deliberate event.

> Don't compromise. Build everything that can be built on testnet. Mainnet is a promotion, not a deploy step.

| Phase | Purpose | Days | Network |
|---|---|---|---|
| **A. Testnet-Complete Sprint** | Build & test entire product end-to-end | Day 1 → Day 22 | Galileo testnet 16602 |
| **B. Mainnet Promotion** | Re-deploy contracts, switch RPC, anchor first batch of mainnet receipts, ship submission | Day 23 → Day 30 | Aristotle mainnet 16661 |

### Phase A — Testnet-Complete Sprint (Day 1-22)

**Goal:** by end of Day 22, every feature in `PRD.md §7` works end-to-end on testnet. Studio is beautiful. 50+ skills installable. ≥100 testnet receipts anchored.

#### Day 1 — Scaffold + Network
- `pnpm create turbo@latest ivaronix` + Turborepo workspace
- `apps/cli`, `apps/forge-daemon`, `apps/studio` (Next.js 15), `contracts/` (Foundry)
- `packages/og-router`, `packages/og-storage`, `packages/og-chain` (ethers v6), `packages/og-kv`
- `packages/core` with ULID + canonical JSON
- `ivaronix doctor --network --router --storage` all green on testnet 16602
- Deployer wallet funded (≥ 5 OG testnet from faucet)

**Gate:** `ivaronix doctor` all-green on testnet.

#### Day 2 — Receipt Skeleton + Canonical Schema
- `packages/receipts`: canonical JSON, hashing per `RECEIPTS_SPEC.md §3`
- JSON-schema validation against `schemas/receipt-v1.json`
- Sign with `eth_personal_sign` (viem on Studio side, ethers on daemon side)
- Verify with `ecrecover`
- "Hello world" receipt locally without chain anchor

**Gate:** receipt schema valid + signed + reproducible hash + 9 receipt types defined.

#### Day 3 — ReceiptRegistry on Testnet
- Deploy `ReceiptRegistry.sol` to testnet 16602 via Foundry
- Verify on `chainscan-galileo.0g.ai`
- `ivaronix receipt anchor` works
- `ivaronix receipt verify <id>` shows `CLAIMED → ANCHORED`

**Gate:** first testnet anchor with full verify.

#### Day 4 — Burn Mode + doc-ask (CLI)
- AES-256-GCM session keys with destruction + fingerprint
- `ivaronix doc ask <pdf> --burn --receipt` end-to-end on testnet
- `peekHeader`-detected encryption type
- Storage upload with proof download verification
- Local cleanup verification (zero buffer, vacuum tmp dir)

**Gate:** doc-ask + burn + receipt fully verified on testnet, zero plaintext leakage in receipt.

#### Day 5 — Tiered Consensus + Independent TEE Verify
- `packages/consensus`: tiered orchestrator with 3 tiers — Quick (1 model), **Standard (3 roles: analyst/critic/judge — DEFAULT)**, High-Stakes (5 roles, opt-in via `--high-stakes`)
- Pre-flight 7-gate fail-fast (MUSASHI pattern)
- Convergence scoring via embeddings cosine similarity
- `broker.inference.processResponse()` integration for per-role independent TEE verify
- `ivaronix receipt verify <id> --tee-independent` shows all attestations independently
- Cost shown upfront: ~$0.02 / ~$0.10 / ~$0.25 per run for Quick / Standard / High-Stakes
- Studio drop-zone exposes the tier picker; CLI uses `--quick` / `--consensus` / `--high-stakes` flags

**Gate:** Standard 3-role consensus + independent TEE on testnet works; verify shows `FULLY VERIFIED`. High-stakes 5-role tested but not default.

#### Day 6 — ERC-7857 Agent Passport
- Deploy `Erc7857Verifier.sol` to testnet
- Deploy `AgentPassportINFT.sol` (ERC-7857) to testnet
- `ivaronix passport mint` mints a real INFT on testnet
- Encrypted metadata blob on 0G Storage; pointer in 0G KV (`passport:{wallet}:latest`)
- Passport `recordReceipt(tokenId, receiptId)` updates `trustScore` + `receiptCount`
- `ivaronix passport restore --wallet 0x...` restores from chain + KV

**Gate:** passport mint, restore, transfer, clone all work on testnet.

#### Day 7 — CapabilityRegistry + MemoryAccessLog
- Deploy `CapabilityRegistry.sol` and `MemoryAccessLog.sol` to testnet
- `ivaronix memory grant <grantee> --scope project --ttl 7d`
- `ivaronix memory revoke <grantId>`
- Every memory access emits `MemoryAccessLog` event
- `MemoryAccessReceipt` type added to receipt builder

**Gate:** grant + revoke + access-log on testnet.

#### Day 8 — Hybrid Memory Engine
- `packages/memory`: SQLite + FTS5 (claude-mem pattern)
- `all-MiniLM-L6-v2` embeddings via `transformers.js`
- HNSW vector index via `hnswlib-node`
- Temporal graph (Graphiti-inspired JSON-LD on SQLite)
- 0G KV manifest pointers (`memory:{agentId}:manifest`)
- Memory query fuses vector top-K + FTS top-K + temporal graph facts → reranked top-N with provenance
- Memory snapshot upload to 0G Storage with KV pointer update

**Gate:** memory query returns provenance + relevance; consolidate triggers Storage upload + KV update.

#### Day 9 — Three First-Party Skills
- `private-doc-review` — confidential PDF/DOCX review with citations
- `0g-integration-auditor` — audits any GitHub repo's 0G integration quality (used by automation in Day 21)
- `github-audit` — general code-quality + security audit
- Each skill has `SKILL.md`, `manifest.json`, `prompt.md`, `tests/` with sample fixtures
- Manifest hash anchored on chain (Day 10's SkillRegistry)

**Gate:** all three first-party skills run end-to-end producing verified receipts on testnet.

#### Day 10 — SkillRegistry + Scanner + Sandbox
- Deploy `SkillRegistry.sol` to testnet; anchor first-party skill manifest hashes
- `packages/skills/scanner`: prompt-injection vectors, secret-leak regex, wallet-drain risk, excessive permissions
- `packages/skills/sandbox`: PATH allowlist, cwd jail, network allowlist from manifest
- `ivaronix skill install/inspect/permissions/scan` all work
- `ivaronix skill registry sync` crawls + re-anchors

**Gate:** skill install with scanner + sandbox + permission gate working.

#### Day 11 — Lifecycle Hooks
- `.ivaronix/hooks.yml` → daemon dispatcher
- `PreToolUse / PostToolUse / SessionStart / SessionEnd / PreCompact / UserPromptSubmit` working
- Daemon writes hook-execution receipts (debug mode)
- Failed hook = blocked action with clear CLI error

**Gate:** hooks fire automatically; observation extraction triggered post-skill-exec; memory snapshots auto-uploaded on PreCompact.

#### Day 12 — All 7 CLI Modes Wired
- `plan / build / audit / doc / swarm / watch / receipt` all working with real backend
- Octogent-style scoped workspaces, parent/worker swarm with git worktrees
- Hermes-style `watch` mode with cron-like scheduling
- TUI polish via `ink`
- All modes produce receipts when applicable

**Gate:** every mode has end-to-end test passing on testnet.

#### Day 13 — Studio Scaffold
- `apps/studio` Next.js 15 + React 19 + Tailwind v4 + shadcn/ui on Vercel preview
- WalletConnect (wagmi + viem) for auth
- SIWE backend session
- Routes: `/`, `/skills`, `/r/<id>`, `/@<handle>`, `/memory`, `/global`, `/dashboard`, `/skill/<id>`
- Layout + nav + theme (dark mode default)
- Connect-wallet flow → mint passport → land on `/dashboard`

**Gate:** Studio deploys to Vercel preview; wallet auth works; first deploy URL shareable.

#### Day 14 — Studio: Drop-Zone Hero + Run Flow
- Drop-zone hero with `react-dropzone` + shadcn Card
- File staged → skill picker (3 first-party skills) → run config (Burn Mode toggle, Consensus toggle)
- Calls daemon API (or apps/api proxy in cloud mode)
- Loading state with progress
- Result: audit report card with severity-colored findings + "Verify on Chain" buttons

**Gate:** end-to-end Studio flow: drop file → run skill → see live audit report → click verify-on-chain → see explorer.

#### Day 15 — Studio: Public Proof URLs + Passport Profile
- `/r/<receipt-id>` page renders any receipt with 3-state verification UI
- Reads from chain + Storage; zero backend dependency on daemon
- Citations + sanitized headlines + public-only fields
- Share button (copy URL + Twitter X intent)
- `/@<handle>` agent passport profile: trust score, receipt count, recent activity, badges

**Gate:** public Proof URL renders on a different machine without auth; SEO-tag-ready (OG image, title, description).

#### Day 16 — Studio: Skill Browser + Skill Detail
- `/skills` browse page: cards with name, description, permissions, scanner-passed badge, install button, run button
- Filter by category, sort by trust score
- `/skill/<id>` detail page: manifest, sample input/output, version history, on-chain hash, reputation, install button

**Gate:** skill browser feels like an app store; install button mints a passport-bound install receipt.

#### Day 17 — Studio: Memory Permission Center + Global Stats
- `/memory` Memory Permission Center (auth required): grants list, revoke buttons, scope picker, TTL slider, audit log feed
- `/global` global stats dashboard: total receipts, total OG spent, top skills, top agents, live updates via on-chain reads
- Public dashboard refreshes every 60s

**Gate:** Memory PC issues grants on-chain; global page reads from on-chain `MemoryAccessLog` events.

#### Day 18 — Studio: Polish + Demo GIF
- Full visual polish pass: typography (per typography skill), shadows, micro-interactions, mobile-friendly responsive layout
- Empty states + loading states + error states
- Demo GIF / 60-second screencast embedded in `/`
- README screenshots

**Gate:** Studio looks beautiful enough to put in a grant application. Lighthouse > 90 across categories.

#### Day 19 — Mass Port 50+ awesome-claude-skills
- `scripts/port-awesome-claude-skills.ts` parses each `awesome-claude-skills/<skill>/SKILL.md`
- Generates Ivaronix manifest with conservative permissions
- Runs scanner on each
- Anchors manifest hashes on testnet `SkillRegistry`
- Mass-imports into `seed-skills/`
- Studio `/skills` page displays all 50+ ports

**Gate:** ≥50 skills visible in Studio Skill Browser; sample run on at least 5 of them succeeds.

#### Day 20 — OpenClaw Skill + MCP Server + apps/api + `@ivaronix/og-toolkit`
- `apps/openclaw-skill`: `openclaw skills install ivaronix` works on testnet
- `apps/mcp-server`: 5 tools (`ivaronix.ask`, `ivaronix.verifyReceipt`, `ivaronix.searchMemory`, `ivaronix.installSkill`, `ivaronix.passportShow`)
- `apps/api`: OpenAI-compatible HTTP endpoints + Nexus extensions (deployed to Vercel)
- **`packages/og-toolkit` published to npm as `@ivaronix/og-toolkit`** — clean DX wrappers around `@0gfoundation/0g-storage-ts-sdk` + `@0gfoundation/0g-compute-ts-sdk` + `@0glabs/0g-serving-broker`. One import: `createOg({ network: "testnet" })`. New 0G builders use this because it's nicer than raw SDKs, and it defaults to producing receipts. Quiet long-term moat.
- All four wrap the same `packages/sdk` (and `og-toolkit` is consumed by `packages/sdk`)

**Gate:** Claude/Codex/Cursor can call Ivaronix via MCP; OpenClaw users install Ivaronix as a skill; cloud users hit apps/api; new 0G builders can `pnpm add @ivaronix/og-toolkit` for one-line testnet bring-up.

#### Day 21 — Testnet Receipt Automation + ENGINEERING_DEBUG_LOG
- `scripts/automate-receipts-testnet.ts` runs `0g-integration-auditor` against 100 public 0G OSS repos at 1/hour
- Public dashboard auto-updates from on-chain `ReceiptAnchored` events
- `ENGINEERING_DEBUG_LOG.md` started with ≥3 documented incidents (Provus playbook)
- CI matrix green: schema validation, wording-lint, receipt-verify roundtrip, contract tests

**Gate:** automation kicked off; ≥4-12 testnet receipts visible by EOD; CI all green.

#### Day 22 — Phase A End-to-End Test + Buffer
- Full E2E test pass: Studio drop-zone → daemon → Router → consensus → TEE verify → burn → receipt → chain anchor → passport update → public Proof URL
- Skill marketplace test: install random ported skill, run it, see receipt
- CLI parallel test: same flows from terminal
- Memory grant/revoke + access log audit
- Hooks firing automatically
- README with testnet addresses + screenshots + demo GIF
- ≥100 testnet receipts confirmed

**Gate:** Phase A complete. Full product runs on testnet. Ready for mainnet promotion.

---

### Phase B — Mainnet Promotion (Day 23-30)

**Goal:** zero-surprise re-deployment to mainnet 16661, with the first batch of mainnet receipts and submission ready.

#### Day 23 — Mainnet Contract Deploy
- Fund deployer wallet on mainnet (~2 OG total budget for all contracts + buffer)
- Foundry deploy: `ReceiptRegistry`, `Erc7857Verifier`, `AgentPassportINFT`, `CapabilityRegistry`, `MemoryAccessLog`, `SkillRegistry` to mainnet 16661
- Verify all on `chainscan.0g.ai`
- Update `.env.mainnet` and CLI config
- README: mainnet addresses block (Provus pattern, see §5.6)

**Gate:** all 6 contracts live + verified on mainnet 16661.

#### Day 24 — Mainnet End-to-End Smoke Test
- `ivaronix doctor --network mainnet` all green
- Mint first mainnet passport
- Re-anchor 3 first-party skills + sample of ported skills on mainnet `SkillRegistry`
- Run `ivaronix doc ask` with `--burn --consensus --receipt` on mainnet
- `ivaronix receipt verify <id> --tee-independent` shows `FULLY VERIFIED` on mainnet
- First mainnet receipt fully verified

**Gate:** first mainnet receipt fully verified on a live judge-clickable URL.

#### Day 25 — Studio Switches to Mainnet
- Studio defaults to mainnet 16661; testnet receipts filterable
- Hub pages (/r, /@, /skill, /global) read from mainnet contracts
- Update README "verify it yourself" instructions for mainnet
- Confirm SEO tags work

**Gate:** Studio runs on mainnet; testnet remains accessible for archived receipts.

#### Day 26 — Mainnet Receipt Automation Kicked Off
- Re-run `scripts/automate-receipts-mainnet.ts` on mainnet
- Targeting ≥100 mainnet receipts before submission
- Dashboard auto-updates from mainnet `ReceiptAnchored` events
- Twitter/X thread drafted (per `PITCH.md`)

**Gate:** automation running; first 4-12 mainnet receipts visible.

#### Day 27-28 — Soak / Buffer / Audit Application
- Let mainnet automation accumulate (≥100 receipts target)
- Apply for ChainGPT free audit (per `REFERENCE_PATTERNS.md §9`)
- Polish README live metrics block (real numbers from on-chain)
- Polish Studio Lighthouse scores
- Update `ENGINEERING_DEBUG_LOG.md` with any incidents from Phase B

**Gate:** ≥100 mainnet receipts anchored; audit application submitted; README polished.

#### Day 29 — Submission Pre-Flight
- Final `PITCH.md §8` checklist sweep
- Demo GIF / 60-second screencast finalized
- README: live metric block with real TX count, uptime, latency, cost-per-receipt
- Twitter/X thread published (visibility for grant judges who lurk)
- Final wording-lint check (no banned phrases anywhere)
- Final receipt-verify roundtrip check

**Gate:** all submission criteria green per `PITCH.md §8`.

#### Day 30 — Submission Day
- Submit OG Labs grant form
- Cross-link: mainnet contract addresses, Proof Explorer URL, demo command, ChainGPT audit application reference
- Twitter announcement

**Gate:** submission filed. By this point: ≥100 mainnet + ≥100 testnet receipts, all features working, audit applied for, README claim is verifiable.

---

### Why this 30-day plan beats the original 17-day plan

- **Studio is real.** 6 dedicated days (13-18) for a product surface that *judges click*. Cutting Studio to "Phase 2" was the biggest mistake I almost made.
- **50+ skills out of the box.** Day 19 mass-port turns Ivaronix into the only 0G project shipping with a full Skill Marketplace at MVP. Single biggest differentiation.
- **No mainnet surprises.** Every contract is battle-tested on testnet for 6+ days before any mainnet OG is spent.
- **Total OG cost:** ~5 OG testnet (free from faucet) + ~2 OG mainnet (≈$10) = essentially free in capital.
- **Submission credibility:** "100 mainnet + 100 testnet receipts, 50+ skills installable, beautiful Studio, 6 mainnet contracts, full feature surface" beats every entry currently in `entries/`.

---

## 2. Network Profiles (frozen — single source of truth)

```env
# === Galileo Testnet (default for early dev) ===
OG_NETWORK=testnet
OG_CHAIN_ID=16602
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_EXPLORER=https://chainscan-galileo.0g.ai
OG_STORAGE_EXPLORER=https://storagescan-galileo.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api-testnet.integratenetwork.work/v1
OG_DEFAULT_MODEL=qwen/qwen-2.5-7b-instruct
OG_FAUCET=https://faucet.0g.ai

# === Aristotle Mainnet (deploy + grant submission) ===
OG_NETWORK=mainnet
OG_CHAIN_ID=16661
OG_RPC_URL=https://evmrpc.0g.ai
OG_CHAIN_EXPLORER=https://chainscan.0g.ai
OG_STORAGE_EXPLORER=https://storagescan.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api.0g.ai/v1

# === Stale values doctor must flag ===
# 16601 — old testnet ID (Galileo legacy)
# 16600 — never valid as mainnet (0G_OFFICIAL_LINKS.md was incorrect)
```

Sources verified against `oglabs resources/0g-doc/docs/ai-context.md:20,46`, `mainnet-overview.md:25`, `testnet-overview.md:26`. Live testnet wallet + pricing in `0G_TESTNET_NOTES.md`.

**`ivaronix doctor --network` MUST:**
1. Read `OG_CHAIN_ID` from env
2. Call `eth_chainId` on `OG_RPC_URL` and confirm match
3. Refuse to run if `OG_CHAIN_ID ∈ {16601, 16600}` — print clear migration message
4. Confirm `OG_STORAGE_INDEXER` reachable via HTTP HEAD
5. Confirm `OG_ROUTER_BASE_URL` returns 200 on `/v1/models`

---

## 3. SDK Quirks (DO NOT FORGET)

These are operational gotchas extracted from official 0G docs that have bitten projects.

### 3.1 0G Storage TS SDK
- Use `@0gfoundation/0g-storage-ts-sdk`.
- `ZgFile.fromFilePath()` for file uploads.
- `MemData` for in-memory buffers (receipt JSON, memory snapshots).
- **Always call `file.merkleTree()` before upload** — captures the root hash.
- `indexer.upload(file, RPC_URL, signer)`.
- **Always close file handles after upload** (file descriptor leak otherwise).
- `indexer.download(rootHash, outputPath, true)` for proof downloads.
- **For encrypted files, use `downloadToBlob()` with decryption options.** `indexer.download()` does NOT support decryption.
- `peekHeader(rootHash)` detects encryption mode — call before download.
- **Wrong decryption key may return ciphertext rather than throwing** — verify decrypted payload format manually.

### 3.2 0G Compute / Router
- API key tied to wallet — spends deposited 0G balance.
- **Never expose Router API key to browsers.** Daemon process only (or apps/api proxy with server-side env).
- API keys currently behave like full inference keys (will be split in future).
- `402 insufficient_balance` → produce clear CLI message, not generic failure.
- **Router and Direct Compute balances are independent** — never confuse them in UX.
- MVP uses Router only; Direct Compute is post-MVP.

### 3.3 TEE Independent Verification (the differentiator)
- Router's `verify_tee: true` returns `x_0g_trace.tee_verified: true`. Convenient but trusts Router.
- Independent path: `broker.inference.processResponse(providerAddress, chatID)` from `@0gfoundation/0g-compute-ts-sdk`.
- Capture from every Router response: `ZG-Res-Key` header (chatID), `x_0g_trace.provider` (providerAddress), `x_0g_trace.tee_verified` (Router-flag), model ID.
- Receipt fields per `RECEIPTS_SPEC.md §2`: `teeVerification` block separates `routerVerified` from `independentVerified`.

### 3.4 Rate Limits & Retries
- Capture headers: `X-RateLimit-Limit-Requests`, `X-RateLimit-Remaining-Requests`, `X-RateLimit-Reset-Requests`, `Retry-After`.
- Backoff on `429`. Optional retry on `502`. **Never** blind-retry `400/401/402/403`.
- Swarm queue throttling: never launch >N parallel workers if Router rate-limiting account.

### 3.5 Storage Encryption
- Burn Mode uses AES-256-GCM session keys.
- Capture key fingerprint (SHA-256 of key bytes) BEFORE destruction.
- Zero key buffer in memory + vacuum tmp dirs.
- Wording rules locked in `RECEIPTS_SPEC.md §5`.

### 3.6 Contract Deployment
- Solidity 0.8.24, OpenZeppelin v5.
- `evmVersion: "cancun"` in Foundry config.
- ChainScan contract verification: `chainscan.0g.ai/api` (mainnet) or `chainscan-galileo.0g.ai/api` (testnet).
- **Verify immediately after deploy** — don't ship unverified.

### 3.7 ERC-7857 Specifics
- Encrypted metadata blob on 0G Storage; pointer in 0G KV.
- Secure re-encryption on transfer requires TEE-attested oracle.
- Authorized usage without ownership transfer is a first-class flow (see `0g-doc/docs/developer-hub/building-on-0g/inft/integration.md`).
- Don't shortcut — the verifier contract is what makes ERC-7857 trustworthy.

### 3.8 Studio / Browser-side
- **Never put Router API key in browser bundle.** Studio talks to apps/api proxy or local daemon only.
- WalletConnect requires HTTPS in production (Vercel handles this).
- Server actions for mutations; client components for interactive views.
- Don't use `localStorage` for receipt drafts — use SQLite via daemon, sync to 0G KV.

---

## 4. Skill Catalog

### 4.1 First-party skills (3, MVP)

| Skill | Purpose | Permissions |
|---|---|---|
| `private-doc-review` | Confidential PDF/DOCX/Markdown review with consensus, citations, risk flags | read_doc, network: 0g-router, receipt, burn, consensus. NO write/wallet/shell. |
| `0g-integration-auditor` | Audit any GitHub repo's 0G integration quality (used by automation) | read_repo, network: github+0g-router, receipt. NO write/shell/wallet. |
| `github-audit` | General code-quality + security audit on a public GitHub repo | read_repo, run_tests (sandbox), network: github+0g-router, receipt. NO wallet. |

### 4.2 Ported skills (50+, mass-port Day 19)

Source: `CLI Open Source Project/awesome-claude-skills/`. Examples:
- `code-review`, `security-audit`, `comment-analyzer`
- `type-design-analyzer`, `silent-failure-hunter`
- `pr-test-analyzer`, `pr-review-toolkit`
- `threat-modeling`, `cloud-devops`, `architecture`
- `frontend-design`, `aesthetic`, `ui-styling`
- `tdd`, `e2e`, `webapp-testing`
- `solana-dev`, `solidity-security`, `api-security-best-practices`
- `event-sourcing-architect`, `microservices-patterns`
- `terraform-infrastructure`, `kubernetes-deployment`, `docker-expert`
- ... (50+ total)

Mechanical port: parse `SKILL.md` → infer permissions conservatively (read-only by default; flag any shell/network needs) → run scanner → register on-chain.

### 4.3 Anti-list (do NOT ship at MVP)

`legal-risk`, `smart-contract-review` (1st-party), `wallet-monitor`, `telegram-summary`, `discord-summary`, `web3-research`, `content-creator`. These are Phase 3+.

---

## 5. Contract Deployment Steps

### 5.1 Pre-flight
```bash
ivaronix doctor --network --router --storage --chain
# Need: ≥ 0.5 OG on deployer wallet (testnet from faucet OR mainnet ~2 OG total)
# Need: ≥ 0.1 OG on Router balance for testing
```

### 5.2 Deploy order (each contract verified immediately)
```bash
# 1. Erc7857Verifier (deps for AgentPassportINFT)
forge create contracts/src/Erc7857Verifier.sol:Erc7857Verifier \
  --rpc-url $OG_RPC_URL --private-key $OG_DEPLOY_KEY \
  --evm-version cancun \
  --verify --verifier-url $OG_CHAIN_EXPLORER/api

# 2. ReceiptRegistry
forge create contracts/src/ReceiptRegistry.sol:ReceiptRegistry \
  --rpc-url $OG_RPC_URL --private-key $OG_DEPLOY_KEY \
  --evm-version cancun \
  --verify --verifier-url $OG_CHAIN_EXPLORER/api

# 3. AgentPassportINFT (depends on Verifier)
forge create contracts/src/AgentPassportINFT.sol:AgentPassportINFT \
  --rpc-url $OG_RPC_URL --private-key $OG_DEPLOY_KEY \
  --evm-version cancun \
  --constructor-args "Ivaronix Agent Passport" "IVAP" $VERIFIER_ADDR \
  --verify --verifier-url $OG_CHAIN_EXPLORER/api

# 4. CapabilityRegistry
forge create contracts/src/CapabilityRegistry.sol:CapabilityRegistry \
  --rpc-url $OG_RPC_URL --private-key $OG_DEPLOY_KEY \
  --evm-version cancun \
  --verify --verifier-url $OG_CHAIN_EXPLORER/api

# 5. MemoryAccessLog
forge create contracts/src/MemoryAccessLog.sol:MemoryAccessLog \
  --rpc-url $OG_RPC_URL --private-key $OG_DEPLOY_KEY \
  --evm-version cancun \
  --verify --verifier-url $OG_CHAIN_EXPLORER/api

# 6. SkillRegistry
forge create contracts/src/SkillRegistry.sol:SkillRegistry \
  --rpc-url $OG_RPC_URL --private-key $OG_DEPLOY_KEY \
  --evm-version cancun \
  --verify --verifier-url $OG_CHAIN_EXPLORER/api
```

### 5.3 Post-deploy sanity
```bash
ivaronix doctor --chain                    # all 6 contracts reachable + ABI matches
ivaronix passport mint                     # mints a test passport
ivaronix doc ask test.pdf "..." --receipt  # full flow
ivaronix receipt verify <id>               # confirms anchored
ivaronix skill registry sync               # confirms SkillRegistry reachable
ivaronix memory grant 0xtest --scope project --ttl 1d  # confirms CapabilityRegistry
```

### 5.4 README addresses block (Provus pattern)
```markdown
## On-Chain Contracts (Mainnet · Chain ID 16661)
| Contract | Address | Verified |
|---|---|---|
| ReceiptRegistry | `0x...` | [✓ ChainScan](https://chainscan.0g.ai/address/0x...) |
| AgentPassportINFT | `0x...` | [✓ ChainScan](https://chainscan.0g.ai/address/0x...) |
| Erc7857Verifier | `0x...` | [✓ ChainScan](https://chainscan.0g.ai/address/0x...) |
| CapabilityRegistry | `0x...` | [✓ ChainScan](https://chainscan.0g.ai/address/0x...) |
| MemoryAccessLog | `0x...` | [✓ ChainScan](https://chainscan.0g.ai/address/0x...) |
| SkillRegistry | `0x...` | [✓ ChainScan](https://chainscan.0g.ai/address/0x...) |
```

---

## 6. The "100 Mainnet Receipts" Automation

Pseudocode for `scripts/automate-receipts-mainnet.ts` (testnet variant identical, different network env):

```typescript
import { runIvaronix } from '@ivaronix/sdk';

const targets = [
  // 100 public 0G OSS projects from awesome-0g + showcase + entries
  'https://github.com/0gfoundation/0g-storage-client',
  'https://github.com/0gfoundation/0g-da-client',
  // ...
];

for (const repoUrl of targets) {
  await sleep(3600_000);  // 1 hour between runs (rate-limit + presents as live activity)
  try {
    const receipt = await runIvaronix({
      command: 'audit',
      args: [repoUrl, '--skill', '0g-integration-auditor', '--receipt'],
      network: 'mainnet',
    });
    await dashboard.publish(receipt);
    console.log(`[${new Date().toISOString()}] Receipt anchored: ${receipt.id}`);
  } catch (e) {
    console.error(`Skipping ${repoUrl}:`, e.message);
  }
}
```

**Cost budget:** 100 receipts × 0.01 OG = 1 OG (~$5 at $5/OG) for `0g-integration-auditor` skill (no consensus required). If automation is run with Standard 3-role consensus, multiply by ~5x; with High-Stakes 5-role, ~12x. Default automation uses no consensus to keep cost minimal.
**Time budget:** 100 hours = ~4.2 days running. Start testnet automation Day 21 (completes Day 22). Mainnet automation Day 26 (completes Day 30).
**Dashboard:** Studio's `/global` page reads from `ReceiptRegistry` and renders the table. Updates auto via 0G Chain RPC every 60s.

**GitHub rate limits:** unauth = 60 req/h, auth = 5000 req/h. Use auth token; flagged in `BUILD.md §3.2`.

---

## 7. Doctor Command Specification

```
$ ivaronix doctor

╭─ Ivaronix · doctor ────────────────────────────────────────╮
│ Network                                                    │
│   network              mainnet                             │
│   chainId              16661  (matches eth_chainId ✓)      │
│   rpc                  https://evmrpc.0g.ai  (200 ok ✓)    │
│                                                            │
│ Router                                                     │
│   balance              0.428 OG                            │
│   rateLimit.remaining  4980 / 5000 req/min                 │
│   default model        qwen/qwen-2.5-7b-instruct           │
│   teeVerifiable        true                                │
│                                                            │
│ Storage                                                    │
│   indexer              indexer-storage-turbo.0g.ai (200 ✓) │
│   uploadRoundtrip      842 ms (16 KB sample)               │
│                                                            │
│ Chain (6 contracts)                                        │
│   ReceiptRegistry      0x...   (verified ✓, owner ✓)       │
│   AgentPassportINFT    0x...   (verified ✓)                │
│   Erc7857Verifier      0x...   (verified ✓)                │
│   CapabilityRegistry   0x...   (verified ✓)                │
│   MemoryAccessLog      0x...   (verified ✓)                │
│   SkillRegistry        0x...   (verified ✓, 53 skills)     │
│                                                            │
│ Studio                                                     │
│   url                  https://ivaronix.com                │
│   lighthouse           94 / 96 / 100 / 100                 │
│                                                            │
│ Metrics (live)                                             │
│   receiptsAnchored     127                                 │
│   skillsInstalled      53                                  │
│   uptime               99.4%   (last 24h)                  │
│   avgLatency           12.3s   (full receipt anchor)       │
│   totalCost            1.21 OG (≈$6.05 at $5/OG)           │
│                                                            │
│ Status: ✅ ALL SYSTEMS GO                                   │
╰────────────────────────────────────────────────────────────╯
```

This output is the README's hero shot. Treat it like a product surface — tune until it looks great.

---

## 8. CLI Command Map (canonical, see HLD §6)

See `HLD.md §6` for the full canonical map. **Don't duplicate the list — link.**

When in doubt about a flag or argument, the rule is:
1. Match Router/Storage/Compute SDK terminology when it's the underlying primitive (`--provider-sort`, `--encrypt aes`)
2. Match OpenCode terminology for agent ergonomics (`plan`, `build`)
3. Match Octogent terminology for orchestration (`worktree`, `swarm`)
4. Match awesome-claude-skills terminology for skills (`SKILL.md`, manifest hash)

---

## 9. Wording Lock (CI-enforced)

Before any string lands in CLI output, README, Studio copy, or receipt JSON, run `scripts/wording-lint.ts` which fails CI on any of:

- `truth score`
- `verified by AI`
- `deleted from blockchain`
- `burnt off-chain`
- `guaranteed safe`
- `100% private` (we cannot guarantee — providers + Router are involved)
- `decentralized AI` (overclaim — Router routes; only TEE inference is sealed)
- `AI proofs` (vague; say "AI Action Receipts")
- `plain-text deletion` (ambiguous)

Replace with the approved phrasings in `PRD.md §16`.

---

## 10. Doc-Source Crosswalk

What changed from the original docs and where the content went (vs. `_archive/`):

| Original doc | Section | New home |
|---|---|---|
| `ivaronix_final_prd.md` §1-2 (positioning, surfaces) | Compressed + restructured | `PRD.md §1-3` |
| `ivaronix_final_prd.md` §3 (7 layers) | Per-layer best-of-class with citations | `PRD.md §4` |
| `ivaronix_final_prd.md` §4 (killer MVP) | Updated for 5-role consensus + Studio version | `PRD.md §6` |
| `ivaronix_final_prd.md` §5 (Forge CLI commands) | Moved | `HLD.md §6` |
| `ivaronix_final_prd.md` §11 (21 must-haves) | Restructured into 37 testnet+mainnet items | `PRD.md §7` |
| `ivaronix_final_prd.md` §13 (7 differentiators) | Absorbed into layers + new Studio surface | `PRD.md §3, §4` |
| `IVARONIX_HLD.md` §System Surfaces | Updated to 5 surfaces with Studio primary | `HLD.md §1, §2` |
| `IVARONIX_HLD.md` §Tech Stack | Locked + extended for Studio | `HLD.md §13` |
| `IVARONIX_FORGE_CLI_PLAN.md` §`.ivaronix/` layout | Updated with hybrid memory dirs | `HLD.md §7` |
| `IVARONIX_FORGE_CLI_PLAN.md` §Receipt schema | Replaced | `RECEIPTS_SPEC.md` (canonical) |
| `IVARONIX_FORGE_0G_DOC_GAPS.md` §SDK quirks | Kept | `BUILD.md §3` |
| `IVARONIX_FORGE_0G_DOC_GAPS.md` §Network profile | Frozen | `BUILD.md §2` |
| `IVARONIX_BUILD_FOCUS.md` §Core Rule | Updated | `PRD.md §10` (rule), `BUILD.md §1` (sequence) |
| `IVARONIX_BUILD_FOCUS.md` §First Build / Soon / Later | Cleaned | `PRD.md §7, §8` |
| `0G_OFFICIAL_LINKS.md` (incl. wrong 16600) | Inlined + corrected | `BUILD.md §2`, `PITCH.md §6` |

---

## 11. Locked Engineering Defaults

These are settled. Day 1 starts with these picks. If reality forces a change, update this section first, then code.

### 11.1 Chain client (daemon side): **ethers v6** (locked)
Required by official 0G TypeScript SDKs. viem would force carrying both libraries.

### 11.2 Daemon HTTP: **Hono** (locked)
Small (~12 KB), TS-native, edge-portable.

### 11.3 Memory store: **better-sqlite3 + FTS5** (locked)
Sync API; claude-mem precedent.

### 11.4 Default model: **`qwen/qwen-2.5-7b-instruct`** with `--model` override (locked)
Confirmed TEE-verifiable per `0G_TESTNET_NOTES.md`. Per-role override allowed in consensus.

### 11.5 Daemon lifecycle: **auto-start with transparent logs** (locked)
First-time UX = type one command, it works. Failures visible via tail-streamed startup logs. Logs at `~/.ivaronix/logs/daemon.log` (rotating).

### 11.6 Build / package manager: **pnpm + Turborepo** (locked)
Strict node_modules; workspace protocol; CI cache.

### 11.7 Solidity toolchain: **Foundry** (locked)
0.8.24 / OZ v5 / evmVersion `cancun`.

### 11.8 Studio framework: **Next.js 15 + React 19 + Tailwind v4 + shadcn/ui** (locked)
Provus stack precedent. Vercel hosted.

### 11.9 Wallet (browser side): **viem + wagmi + walletconnect** (locked)
Ethers stays daemon-side only.

---

**End of BUILD.** When ground reality differs from this doc, update the doc *first*, then implement.
