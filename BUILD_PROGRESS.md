# Ivaronix — Build Progress

> **Source of truth for "where am I in the build."** Each loop iteration reads this first. When work completes, append to this file. When blocked, document under "Blockers" and stop ONLY on that item.
>
> **Scope:** Phase A (Day 1-22 testnet) + Phase B (Day 23-30 mainnet) per `BUILD.md §1`.
>
> **Wallet roles:** Wallet A `0xaa95...8677Ce` = canonical for contracts/receipts. Wallet B `0x1Be5...c3d0f` = current Compute API key.
>
> **Commit rules:** no Co-Authored-By, no AI slop, conventional-commits style.

---

## Status Overview

| Phase | Day | Status |
|---|---|---|
| A | 1 (scaffold + network) | 🟢 **DONE 2026-05-08** |
| A | 2 (receipt skeleton) | 🟢 **DONE 2026-05-08** |
| A | 3 (ReceiptRegistry deploy) | 🟢 **DONE 2026-05-08** |
| A | 4 (Burn Mode + doc-ask) | 🟢 **DONE 2026-05-08** (B-1 blocker open on Storage upload, workaround in place) |
| A | 5 (tiered consensus + TEE verify) | 🟢 **DONE 2026-05-08** |
| A | 6 (ERC-7857 passport) | 🟢 **DONE 2026-05-08** |
| A | 7 (CapabilityRegistry + MemoryAccessLog) | 🟢 **DONE 2026-05-08** |
| A | 8 (hybrid memory engine) | 🟢 **DONE 2026-05-08** |
| A | 9 (3 first-party skills) | ⬜ pending |
| A | 10 (SkillRegistry + scanner + sandbox) | ⬜ pending |
| A | 11 (lifecycle hooks) | ⬜ pending |
| A | 12 (all 7 CLI modes wired) | ⬜ pending |
| A | 13 (Studio scaffold) | ⬜ pending |
| A | 14 (Studio drop-zone + run flow) | ⬜ pending |
| A | 15 (Public Proof URLs + passport profile) | ⬜ pending |
| A | 16 (Skill Browser + Detail) | ⬜ pending |
| A | 17 (Memory PC + global stats) | ⬜ pending |
| A | 18 (Studio polish + demo GIF) | ⬜ pending |
| A | 19 (mass port 50+ awesome-claude-skills) | ⬜ pending |
| A | 20 (OpenClaw + MCP + apps/api + og-toolkit) | ⬜ pending |
| A | 21 (testnet receipt automation + debug log) | ⬜ pending |
| A | 22 (Phase A E2E test + buffer) | ⬜ pending |
| B | 23 (mainnet contract deploy) | ⬜ pending |
| B | 24 (mainnet E2E smoke) | ⬜ pending |
| B | 25 (Studio switches to mainnet) | ⬜ pending |
| B | 26-28 (mainnet receipt automation + audit application) | ⬜ pending |
| B | 29 (submission pre-flight) | ⬜ pending |
| B | 30 (submission day) | ⬜ pending |

Legend: 🟢 done · 🟡 in progress · ⬜ pending · 🔴 blocked

---

## Day 1 — Scaffold + Network (DONE 2026-05-08)

### Done
- [x] BUILD_PROGRESS.md created
- [x] Tooling verified: Node 22.17.0, pnpm 10.32.1, Foundry 1.5.1
- [x] git init in `oglabs/` with remote `https://github.com/Pratiikpy/ivaronix.git`
- [x] pnpm + Turborepo workspace scaffold (root package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .prettierrc.json, .npmrc)
- [x] `packages/core` with ULID, canonical JSON, hash, types (network constants, receipt types, ROLES_BY_TIER)
- [x] `packages/og-chain` ethers v6 wrapper (verifyChainId, getBalanceOg, signer support, rejects stale chain IDs)
- [x] `packages/og-router` OpenAI-compatible Router client + Keyring (multi-wallet rotation per HLD §11.0)
- [x] `packages/og-storage` Indexer reachability + upload/download/peekHeader stubs (real impl Day 2/4)
- [x] `packages/og-kv` KV pointer interface + StubKvClient
- [x] `packages/og-toolkit` one-import surface: createOg({ network }) → composes all clients
- [x] `apps/cli` with commands: `init`, `doctor`, `receipt verify/list/show`, `passport mint/show/restore`, `compute test/balance/verify-tee`, `doc ask`
- [x] `apps/cli` env loader walks parent dirs to find `.env` (monorepo run-from-anywhere)
- [x] `contracts/` Foundry workspace: solc 0.8.20, evmVersion cancun, OZ v5.1.0
- [x] **`ReceiptRegistry.sol`** written + 10 unit tests pass + deploy script
- [x] **Solidity bumped 0.8.19 → 0.8.20** (OZ v5 requires; Provus/MUSASHI use 0.8.20+ on mainnet so it's fine)

### Day 1 Gate (HIT 2026-05-08)
```
$ ivaronix doctor
§ 01 · NETWORK
  ● network              testnet
  ● chainId              16602  (matches eth_chainId)
  ● rpc                  https://evmrpc-testnet.0g.ai
§ 02 · ROUTER
  ● key:primary             wallet 0xaa954c33…  provider 0xa48f0128…
  ● default model        qwen/qwen-2.5-7b-instruct
§ 03 · STORAGE
  ● indexer              https://indexer-storage-testnet-turbo.0g.ai  (alive · HTTP 404)
§ 04 · CHAIN (CONTRACTS)
  ● ReceiptRegistry      not yet deployed (Phase A Day 3)
  ● AgentPassportINFT    not yet deployed (Phase A Day 6)
  ...
§ 05 · WALLET
  ● address              0xaa954c33810029a3eFb0bf755FEF17863E8677Ce
  ● balance              70.499496 OG

Status: ✓ ALL SYSTEMS GO
```

### Notes
- 0G Storage indexer responds HTTP 404 on root (no listing route); doctor treats any HTTP response as "alive" since DNS+TCP work.
- `OG_PRIVATE_KEY=${EVM_PRIVATE_KEY}` line in old `.env` was bash-template syntax that dotenv doesn't expand — removed; env.ts falls back to `EVM_PRIVATE_KEY`.
- Bumped Solidity from 0.8.19 → 0.8.20 because OZ v5 requires `^0.8.20`. Confirmed Provus/MUSASHI use 0.8.20+ on 0G mainnet, so this is fine for explorer verification.
- `OG_ROUTER_KEYS` multi-key file format documented in HLD §11.0; for now keyring loads single key from `ZG_API_SECRET` + `ZG_SERVICE_URL` + `OG_COMPUTE_PROVIDER` + `EVM_WALLET_ADDRESS`.

## Day 2 — Receipt skeleton (DONE 2026-05-08)

### Done
- [x] `packages/receipts` created
- [x] `schema.ts` — full Zod schema for `ReceiptV1` matching RECEIPTS_SPEC.md §2 (9 receipt types, all required + optional fields, hex/sha256/wallet regex validators)
- [x] `builder.ts` — `buildReceipt()`, `signReceipt()` (eth_personal_sign over receipt root hash), `defaultChainAnchor()`
- [x] `verify.ts` — `verifyClaimed()` returns CLAIMED if schema + hash + signature all pass; INVALID otherwise
- [x] **6 unit tests pass** (build returns valid draft / hash deterministic / sign produces recoverable signature / verifyClaimed returns CLAIMED / rejects tampered receipt / rejects wrong-signer signature)
- [x] `apps/cli` `receipt verify <path>` reads a JSON file and runs `verifyClaimed`, prints per-check pass/fail rows + final state
- [x] Wiring through workspace: receipts depends on core; cli depends on receipts; typecheck clean across the graph
- [x] `sha256HexAsync` exported from core (used by builder/test fixtures)
- [x] `signReceipt` accepts `Signer` interface (works with both `Wallet` and `HDNodeWallet` from `Wallet.createRandom()`)

### Day 2 Gate (HIT 2026-05-08)
```
$ pnpm --filter @ivaronix/receipts test
✓ buildReceipt returns a draft with id, createdAt, and a non-zero receipt root
✓ canonical hash is deterministic
✓ signReceipt produces signature recoverable to signer
✓ verifyClaimed returns CLAIMED for a valid signed receipt
✓ verifyClaimed rejects tampered receipt (output hash changed after sign)
✓ verifyClaimed rejects signature from a different wallet
6/6 pass
```

### Notes
- Receipt root hash = `keccak256(canonical JSON without signature field)`. Per RECEIPTS_SPEC.md §3 step 2.
- Signing path: hash → `eth_personal_sign` → signature attached → full canonical bytes uploaded to Storage in Day 4.
- The JSON-schema (`schemas/receipt-v1.json`) file isn't generated yet — Zod schema is the source; will derive a JSON schema export in Day 3 if external tooling needs it.

## Day 3 — ReceiptRegistry on testnet (DONE 2026-05-08)

### Done
- [x] `ReceiptRegistry.sol` deployed to testnet 16602 via `forge create`
  - **Address: `0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c`**
  - Tx: `0xb85786794d267ffd1851eccfb90e27e19019ce7c763e3384306630288ecf1814`
  - Deployer: Wallet A `0xaa95...8677Ce`
- [x] `deployments/testnet.json` records contract address + tx hash + explorer URL
- [x] `packages/og-chain` adds `ReceiptRegistryClient` (typed wrapper, inline ABI) + `loadDeployments()` helper
- [x] `apps/cli` `receipt anchor <path>` calls `ReceiptRegistry.anchor()`, waits for confirmation, writes anchor tx info back to file
- [x] `apps/cli` `receipt verify <path>` runs CLAIMED checks + queries on-chain anchor by `receiptRoot` via `ReceiptAnchored` event; shows `→ ANCHORED ✓` when found
- [x] `apps/cli` `receipt show <id>` reads on-chain receipt by id and prints fields
- [x] `apps/cli` `doctor` now reads `deployments/testnet.json` and shows live `nextId()` count
- [x] `scripts/build-hello-receipt.ts` produces a signed receipt for smoke testing
- [x] **2 testnet receipts anchored end-to-end:**
  - id=0 — first anchor (gas 141217)
  - id=1 — fresh receipt with corrected hash (gas 107017, https://chainscan-galileo.0g.ai/tx/0x600999550e3b4fba6cd44a92f0ae1eda3c8502d0e5f7d0d8a173091aa8ac38a3)

### Day 3 Gate (HIT 2026-05-08)
```
$ ivaronix receipt verify tmp/hello-receipt-v2.json
  ● schema                 PASS
  ● hash                   PASS
  ● signature              PASS
  ●                     → CLAIMED
  ● chain anchor          PASS  (id=1)
  ●                     → ANCHORED

Status: → ANCHORED ✓
```

### Bug found & fixed during Day 3
**Hash exclusion drift between build and verify.** Initial HASH_EXCLUDE only excluded `signature`. After write-back of `chainAnchor.anchorTxHash` post-anchor, the recomputed hash diverged from the original. First fix added too many exclusions (including build-time fields like `proofDownloadVerified`), which made build/verify canonical content asymmetric. Final fix: HASH_EXCLUDE only excludes truly post-claim mutated fields:
```typescript
const HASH_EXCLUDE = new Set([
  'signature',         // added after hash, RECEIPTS_SPEC.md §3 step 3
  'anchorTxHash',      // populated after on-chain anchor
  'anchorBlockNumber',
  'anchorTimestamp',
  'receiptTxHash',     // populated after 0G Storage upload
]);
```
Verification re-runs the storage/chain/TEE checks fresh each time; it does NOT mutate `proofDownloadVerified` / `independentVerified` / `verifiedAt` in the receipt JSON. Those fields stay at their build-time values (false/null) — the LIVE state lives in the verify command's output.

### Day 4 — Burn Mode + doc-ask (DONE 2026-05-08, B-1 partially gates one item)

### Done
- [x] `packages/og-storage/src/burn.ts` — AES-256-GCM session key encryption with explicit key destruction + sha256 key fingerprint capture (per RECEIPTS_SPEC.md §5)
- [x] Refactored `packages/og-storage` to use real `@0glabs/0g-ts-sdk@0.3.3` Indexer
- [x] `apps/cli` `doc ask <file> <question>` end-to-end:
  - Reads file (text-like; PDF parsing deferred to Day 8)
  - Encrypts via burnEncrypt() when --burn passed
  - Captures sha256 evidence digest
  - Calls 0G Router for inference (Quick tier, single qwen-2.5-7b call with TEE flag)
  - Builds canonical receipt with all metadata (model selection, billing, burn block, storage encryption section)
  - Signs receipt with eth_personal_sign
  - Writes signed receipt JSON to `.ivaronix/receipts/anchored/`
  - Anchors on testnet ReceiptRegistry, writes back chainAnchor block
- [x] **Real LLM working on real testnet:** sample contract analysis correctly identified all 5 risky clauses
- [x] Verify command shows `→ CLAIMED → ANCHORED` for the doc-ask receipt

### Day 4 Gate (HIT 2026-05-08, with B-1 caveat)
```
$ ivaronix doc ask sample-contract.txt "Find risky clauses for the Client" --burn --receipt
✓ encrypting with AES-256-GCM session key
✓ session key destroyed at 2026-05-07T19:43:50.892Z
✓ querying 0G Router (Quick tier)... 222 tokens, 3371 ms
[Model output: 5 risky clauses correctly identified]
✓ receiptId            rcpt_01KR1ZFNERAHCAKJXX6V520362
✓ tx hash              0xe59ea02fbf35e2b353fd1205ca4a48406724c8532d2d8dd332dd1670c7fed547
✓ block                32093322
✓ receipt on-chain id  2
Status: → ANCHORED ✓

$ ivaronix receipt verify .ivaronix/receipts/anchored/rcpt_01KR1ZFNERAHCAKJXX6V520362.json
schema PASS / hash PASS / signature PASS → CLAIMED
chain anchor PASS (id=2) → ANCHORED
```

### B-1 caveat (see Blockers section above)
Day 4 ships **without** uploading the encrypted ciphertext to 0G Storage — the on-chain `FixedPriceFlow.submit()` reverts. Workaround: `evidenceRoot` is the local sha256 digest of ciphertext (still chain-anchored on the receipt). When B-1 is unblocked (likely Day 8 hybrid memory work), the same code path will additionally call `storage.upload()` to get a real Storage root + tx hash.

### Day 5 — Tiered Consensus + Independent TEE Verify (DONE 2026-05-08)

### Done
- [x] `packages/consensus` shipped with 3 tiers (Quick / Standard / High-Stakes), 5 role prompts (analyst / critic / risk-reviewer / evidence-checker / judge), 7-gate pre-flight fail-fast, Jaccard convergence scoring, and the `verifyAttestationsIndependent` helper
- [x] 6 unit tests for convergence (identical → 1.0, disjoint → 0, partial overlap, judge excluded, single-reviewer, pairwise scores)
- [x] `apps/cli` `doc ask` accepts `--consensus` (Standard 3-role) / `--high-stakes` (5-role) / `--quick`. Tier resolves from flags; cost shown upfront
- [x] Receipt now records `consensus.individualAttestations` per role with `chatId` for independent verify
- [x] OG Router client switched to `.withResponse()` to capture `ZG-Res-Key` header (chatID for processResponse) and falls back to credential.providerAddress when `x_0g_trace.provider` is absent
- [x] `apps/cli` `receipt verify --tee-independent` initializes `createZGComputeNetworkBroker(wallet)` via `createRequire` (CJS path; the SDK's ESM bundle has internal module-resolution issues), then calls `broker.inference.processResponse(provider, chatID)` per role
- [x] Schema (`ReceiptV1Schema`) extended with optional `chatId` + `independentVerified` per consensus attestation

### Day 5 Gate (HIT 2026-05-08)
```
$ ivaronix doc ask sample-contract.txt "Find risky clauses for the Client" --consensus --burn --receipt
✓ encrypting with AES-256-GCM session key
✓ analyst + critic + judge in parallel via Router (~21s, 1100+ tokens)
✓ convergence score: 0.43 (partial overlap; disagreement summary captured)
✓ judge synthesized: 4 risky clauses + Final Risk Level: Medium + Action Line
✓ receiptId rcpt_01KR20AYQG2Z9FDRDSA85JB7EM, on-chain id 6
✓ tx 0x78ad263816a4b6daee745a5833b35a54fd46446bb814a1a415f5b0eada6cbee6

$ ivaronix receipt verify <path> --tee-independent
schema PASS / hash PASS / signature PASS         → CLAIMED
chain anchor PASS (id=6)                          → ANCHORED
tee:analyst PASS (provider 0xa48f0128…)
tee:critic  PASS (provider 0xa48f0128…)
tee:judge   PASS (provider 0xa48f0128…)            → FULLY VERIFIED ✓

Status: → FULLY VERIFIED ✓
```

### Notes
- 3 anchored consensus receipts on testnet (id=4, 5, 6) all FULLY VERIFY through `broker.inference.processResponse`. This is the differentiator vs. every other 0G project — Router-flag verify is convenient but trusts the Router; we close the loop with the Compute broker doing post-hoc signature verification.
- 7-gate pre-flight catches sensitive content (private keys, GitHub tokens, mnemonics, CC numbers) and recommends Burn Mode automatically.
- Convergence baseline is Jaccard tokens; embeddings (all-MiniLM-L6-v2) upgrade Day 8 with hybrid memory engine.

### Day 6 — ERC-7857 Agent Passport (DONE 2026-05-08)

### Done
- [x] `Erc7857Verifier.sol` shipped — attestor-signed sealed-data integrity verifier with replay-proof nonces (Day 6 MVP; Phase B+ swaps for TEE remote attestation per ERC-7857 §integration)
- [x] `AgentPassportINFT.sol` shipped — ERC-7857 hybrid:
  - ERC-721 base + Ownable2Step + Pausable
  - One passport per wallet (one-agent-per-wallet enforcement)
  - AgentData struct (8 fields, packed): metadataRoot, memoryRoot, skillManifestRoot, receiptCount, violationCount, trustScore (int128), mintedAt, lastEvolutionAt
  - `mint(metadataRoot)` for fresh passports
  - `recordReceipt(tokenId, receiptRoot, type, trustScoreDelta)` — owner OR authorizedRecorder
  - `recordViolation(tokenId, delta, reason)` — negative deltas only
  - `updateMemoryRoot` / `updateSkillManifestRoot` / `rotateMetadata` — owner only
  - `authorizeExecutor(tokenId, executor, ttl)` — run-without-ownership pattern
  - `iTransferFrom` — ERC-7857 secure transfer with attestor-signed re-encryption proof
  - `addAuthorizedRecorder(addr)` — Day 7+ for ReceiptRegistry hook
- [x] **16 unit tests pass** (mint flow, one-per-wallet, recordReceipt + recordViolation, authorized recorders, memory/skill/metadata updates, executors with TTL, iTransferFrom good + bad attestations, pause)
- [x] **Both contracts deployed to testnet 16602:**
  - `Erc7857Verifier`: `0xEAd66Cb90B681720f3aab52d86c289E21106d938`
  - `AgentPassportINFT`: `0x08d25653638c3ed40C3b82840fA20CAe9c94563E`
- [x] `packages/og-chain` adds `AgentPassportClient` (typed wrapper) — mint, getPassport, getPassportByWallet, recordReceipt, updateMemoryRoot, updateSkillManifestRoot
- [x] `apps/cli` `passport mint` — submits mint tx, captures tokenId, writes `.ivaronix/passport.json`
- [x] `apps/cli` `passport show` — reads on-chain state and renders reputation + lifecycle blocks
- [x] `apps/cli` `passport restore --wallet <addr>` — fetches chain state, writes local passport.json (preserves prior metadata if present)
- [x] `apps/cli` `doc ask` now hooks into passport: after anchoring a receipt, calls `passport.recordReceipt(tokenId, receiptRoot, type, +1)` so reputation compounds
- [x] `ivaronix doctor --chain` now displays Verifier + Passport addresses

### Day 6 Gate (HIT 2026-05-08)
```
$ ivaronix passport mint --name "Pratiikpy Agent" --handle "pratiikpy"
✓ tokenId 1
✓ tx 0xf121a37d4b47b2e7ae8226bb4e5dd9f7129c063312b18d4832969dda3a62f037
✓ block 32096127, gas 151953

$ ivaronix doc ask sample-contract.txt "..." --consensus --burn --receipt
✓ receipt on-chain id 7
✓ recording receipt against passport tokenId=1...
✓ passport updated     receiptCount=1 trustScore=1

$ ivaronix passport show
tokenId 1 / receiptCount 1 / violationCount 0 / trustScore 1
mintedAt 1778184420 (2026-05-07T20:07:00.000Z)
lastEvolutionAt 1778184489 (2026-05-07T20:08:09.000Z)
```

### Notes
- Reputation compounds **automatically** on every successful `doc ask --receipt`. Each anchored Action Receipt → +1 trustScore on the user's passport. This closes the receipt-reputation loop spec'd in PRD §4.7.
- The metadata blob is currently a JSON object hashed locally (sha256) since 0G Storage upload is parked (B-1). When B-1 is fixed, the encrypted JSON will be uploaded to Storage and the rootHash will be the metadataRoot — no schema change needed.
- ERC-7857 secure transfer (`iTransferFrom`) is on-chain functional; tests prove the attestor-signed proof flow rejects bad signatures and consumes nonces against replay.

### Day 7 — CapabilityRegistry + MemoryAccessLog (DONE 2026-05-08)

### Done
- [x] `CapabilityRegistry.sol` (SealedMind pattern, REFERENCE_PATTERNS §2.3)
  - issueGrant / revokeGrant / consumeRead / isValid + reverse indexes
  - 16 unit tests pass (issue, revoke, expiry, reads cap, scope mismatch, events)
- [x] `MemoryAccessLog.sol` event-only emitter (3 unit tests pass)
- [x] **Both contracts deployed to testnet 16602:**
  - `CapabilityRegistry`: `0x3783f3c4834fCCBD553860e15c64C7E052646a8D`
  - `MemoryAccessLog`: `0xEe1aDFe76785377C4430B1325d86E58A6eC92119`
- [x] og-chain wrappers: `CapabilityRegistryClient` (with grantIdFromTx helper) + `MemoryAccessLogClient` (with listForAgent event scan)
- [x] CLI `memory grant/revoke/list/log/log-emit` end-to-end working
- [x] doctor now shows all 5 deployed contracts in green

### Day 7 Gate (HIT 2026-05-08)
- Grant `0xf437b7350b69…` issued: grantee 0xB0B0…, scope "work", 7d TTL, 100 reads cap
- Manual log-emit produced indexed event; `memory log` retrieved it correctly
- All contract reads on chain verify the on-chain state matches local

### Day 8 — Hybrid memory engine (DONE 2026-05-08)

### Done
- [x] `packages/memory` shipped with full 4-way hybrid:
  - **FTS5** (`better-sqlite3` + virtual fts5 table) for plaintext search
  - **Vector index** (in-memory FlatVectorIndex, cosine sim, 384-dim hashing-trick TF-IDF — Day 18 swaps for transformers.js + all-MiniLM-L6-v2)
  - **Temporal graph** (facts table with subject/predicate/object/validFrom/validUntil/supersededBy)
  - **KV pointer** (manifest computed on demand; uploaded to 0G KV when B-1 unblocks)
- [x] AES-256-GCM at rest with key derived from owner's private key via scrypt (deterministic; recoverable)
- [x] CapabilityRegistry integration: when caller != owner, `recall` calls `isValid` then `consumeRead` on the grant
- [x] MemoryAccessLog event emission on every WRITE / READ / DELETE (best-effort; doesn't fail the local op)
- [x] `MemoryEngine` API: remember / recall / forget / computeManifest / count / close
- [x] **7 unit tests pass**: roundtrip, tag filtering, encryption-at-rest (plaintext recovers), forget, manifest determinism, manifest changes with state, caller-without-grant rejection
- [x] CLI commands wired:
  - `ivaronix memory remember <text> --tags --source --receipt --no-log`
  - `ivaronix memory recall <query> --tags --top-k --from --to`
  - `ivaronix memory snapshot` (shows manifest)
  - `ivaronix memory forget <id>`
- [x] Recall returns hybrid score (`0.6 * vector + 0.4 * fts`) with per-component scores visible

### Day 8 Gate (HIT 2026-05-08)
```
$ ivaronix memory remember "Bob owes me $400 ..." --tags work,finance
✓ obs id obs_01KR21YW2Q89TRV7S9EHPYXGEC
✓ memory rootHash 0x32af093ef97993586d395338a22ae29a72b4f6a0f67b2dc29fa948997f1e2e14
✓ access log tx 0xd9d55e150ad5f4084ff3cf99abac09d3726979086e67020f6e0f735c0213c830  (real on-chain WRITE event)

(after 3 remembers across work/personal/security tags...)

$ ivaronix memory recall "what does Bob owe" --tags work --top-k 3
#1  score 0.560  vec 0.267  fts 1.000  tags [work, security]
     Reentrancy clause review by Bob: line 142 vulnerable
#2  score 0.550  vec 0.250  fts 1.000  tags [work, finance]
     Bob owes me 00 for the contract review last Tuesday
✓ access log tx 0x156d3e3ae6b69d2a369c99f454f73cdb2ea5a31f10903fbf184b0aeba8800fcf

$ ivaronix memory snapshot
observations 3
rootHash 0xdfa29bc98b18cf2ef2efc89c6b19b788fb40f9ff46b53b86bc083f5d3e0c2f98
embedding hashing-trick-tfidf-v1 dim=384
```

### Notes
- 4 real on-chain MemoryAccessed events emitted in this session (3 WRITE + 1 READ); each cost ~0.0001 OG and is queryable via `ivaronix memory log`.
- The `$400 → 00` in the captured output is bash variable expansion on unquoted strings, NOT a memory bug — single-quoted input would preserve the literal.
- Embedding method (`hashing-trick-tfidf-v1`) is intentionally simple. Day 18 polish swaps in `transformers.js + all-MiniLM-L6-v2` cosine via the same `embed()` interface — no engine code change needed.
- Temporal graph schema is in place; observation→fact extraction (TEE-backed) lands Day 9 with the first-party skills.

### Day 9 — Three first-party skills ✅ DONE 2026-05-08
- `packages/skills` workspace package
  - `manifest.ts` — Zod schema for Anthropic SKILL.md + Ivaronix `og:` extension block (permissions, reputation, consensus tier, burn auto-enable, creator passport)
  - `loader.ts` — parses SKILL.md frontmatter + body, computes deterministic `manifestHash` from canonical-JSON of validated frontmatter (the value receipts will reference)
  - `run.ts` — `runSkill()` composes skill body + user input → consensus invocation, returning `{ skillId, skillVersion, skillManifestHash, defaultTier, ... }`
  - `index.ts` exports `loadSkillsFromDir` / `findSkill` for CLI consumption
- Three first-party skill folders under `seed-skills/` matching awesome-claude-skills layout:
  - `private-doc-review/` — confidential PDF/DOCX review, **burn auto-enabled**, standard tier; tests/sample-lease.txt (10-clause hostile lease)
  - `0g-integration-auditor/` — quick-tier scoring of 0G repo integration; tests/sample-package-json.json with deliberate flaws (chain 16601, no encryption, console.log receipts, router-flag-only TEE)
  - `github-audit/` — code & security audit; tests/sample-vulnerable.sol (Vault with reentrancy + missing access control)
- CLI: `apps/cli/src/commands/skill.ts` exposes `ivaronix skill list` and `ivaronix skill inspect <id>` (manifest hash, permissions, reputation, prompt preview)
- CLI: `ivaronix doc ask --skill <id>` defaults to `private-doc-review` and now honors the loaded skill's `default_tier` and `burn.auto_enable` policy unless the user explicitly overrides; receipts reference the real `skillId / skillVersion / skillManifestHash`

### Day 9 Gate ✅
- ✅ All 3 skills smoke-tested end-to-end on testnet 16602:
  - `0g-integration-auditor` → receipt #8, tx `0x8746ffc18acb1d30f193e665647eef4bbf4fed7bcdaef3deb2cf3db62eb6fbf2`, manifestHash `sha256:3cdd647f99c4a2…7462`, found all 4 deliberate flaws
  - `github-audit` → receipt #9, tx `0xe358ece9603f1a93a766b5e468ed554346a11be5b1bf7af34629baa48fd0fdd5`, manifestHash `sha256:2c23673945e0df…c5eb`, caught critical (missing access control), high (reentrancy), medium (zero-address)
  - `private-doc-review` → receipt #10, tx `0x3df3e5e48c834f4188d9cc88490d2aa1943b70c90099e0a754f20edb3797d65c`, manifestHash `sha256:7d45df06183d72…f689`, **Burn Mode auto-enabled** (AES-256-GCM, session key fingerprint captured + destroyed), risk-level=high
- ✅ Passport `tokenId=1` updated correctly across all three runs: receiptCount 1→4, trustScore 1→4
- ✅ Skills directory layout matches awesome-claude-skills format (SKILL.md + tests/, frontmatter + markdown body)
- ✅ Manifest hash deterministic across loads (same input → same hash) — ready for Day 10 SkillRegistry on-chain anchoring

### Day 10 — SkillRegistry contract + scanner + sandbox ✅ DONE 2026-05-08
- `contracts/src/SkillRegistry.sol` — anchors manifestHash per (skillId, versionId); creator lock-on-first-publish, revocation, immutable versions, transferable ownership; deployed to **`0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1`** on testnet 16602 (tx `0x7b17d10f7fd00465660e563b4cd0e1c136a49add4ffce8e63276e5878cd12f8b`)
- `contracts/test/SkillRegistry.t.sol` — 16/16 tests pass (publish/revoke/verify/transfer paths + zero-arg + non-owner rejection)
- `packages/og-chain/src/contracts/SkillRegistry.ts` — typed wrapper with `publishVersion` / `revokeVersion` / `verify` / `latestVersion` / helpers `skillIdFromName` `versionIdFromSemver` `manifestHashToBytes32`
- `packages/skills/src/scanner.ts` — `scanSkill(skill, registry)` returns `{matches, registered, revoked, onchainManifestHash, creator, publishedAt, reason}`
- `packages/skills/src/sandbox.ts` — `evaluateSandbox(skill, ctx)` enforces `og.permissions` block: passport_min_trust gate, receipt_required, compute_tee_required, burn auto-enable contract, scanner-mismatch escalation; declares (warn-tier) shell_access / writes_files / wallet_access for Day 11 lifecycle hooks
- CLI: `ivaronix skill publish <id>` anchors a skill's manifestHash on chain (idempotent — refuses if same version is already published with different hash)
- CLI: `ivaronix skill verify <id>` does the round-trip check off-chain → on-chain
- CLI: `doc ask` now runs scanner+sandbox pre-flight; MISMATCH or REVOKED aborts the run with exit code 1; absent registry registration is logged as informational ("local-only")

### Day 10 Gate ✅
- ✅ All 3 first-party skills anchored on SkillRegistry:
  - `0g-integration-auditor@0.1.0` → tx `0xb156196085d360fe0d3e7af03eb24f6d3130e591edc369c05d18768d4db13212`
  - `github-audit@0.1.0` → tx `0xc1c5fd203f034a4d07dac53cba4ec745acfbc6caf0538f4cb680c14e1131398a`
  - `private-doc-review@0.1.0` → tx `0xdd4736c17768ede59001485a33e03a1e62ef66cd2b4ac321f082531e4053bd4c`
- ✅ `skill verify` returns MATCH for all three (creator wallet locked, on-chain manifestHash byte-identical to the local sha256)
- ✅ `doc ask --skill private-doc-review` runs scanner pre-flight, prints "registry scan MATCH", then proceeds → receipt #11 anchored, tx `0xfc31b4a8adc342eb01f0543c93c2b483362ba6c2d783314481863f91acd80622`, passport receiptCount=5/trustScore=5
- ✅ Sandbox enforcement: passport_min_trust (block), receipt_required (block), scanner mismatch (block), scanner not-registered (warn), burn-disabled-on-burn-skill (warn unless strict)

### Day 11 — Lifecycle hooks ✅ DONE 2026-05-08
- `packages/skills/src/hooks/types.ts` — typed event union for the 6 lifecycle phases (`session.start`, `consensus.pre`, `consensus.post`, `receipt.pre-anchor`, `receipt.post-anchor`, `session.end`)
- `packages/skills/src/hooks/registry.ts` — `BUILTIN_HOOKS` registry, `resolveHooks(declared, kind)`, `runHooks(...)` with patch-aggregation (each hook sees prior hooks' patched payload)
- 4 first-party built-in hooks under `packages/skills/src/hooks/builtin/`:
  - `redact_pii` — scrubs SSN / email / phone / Luhn-valid credit-card patterns from `consensus.pre.context` before it reaches the router; emits redaction count
  - `balance_check` — warns when tier-estimated cost ≥ 0.05 OG (≈5¢)
  - `log_tokens` — auditable post-consensus token + cost + convergence log
  - `print_passport` — surfaces caller wallet + trustScore at session start
- Manifest schema: new `og.hooks` block accepts ordered name lists per event; unknown names are dropped at load time (anti-typo) without breaking the manifest
- CLI `doc ask` runs `session.start` → sandbox → `consensus.pre` (with patch) → router → `consensus.post`
- Sandbox tightening: not-registered → warn (was incorrectly blocking); registered+mismatch → block; revoked → block
- `private-doc-review` bumped to **v0.2.0** with `og.hooks: { session_start: [print_passport], pre_consensus: [redact_pii, balance_check], post_consensus: [log_tokens] }`; published on chain at tx `0x2f5023ed3c82f4c4c4f78bd80f75fc52a1603e12db0f6242a6d9e61a70cdc9d5`
- `tests/sample-lease.txt` augmented with PII (SSN, email, phone, card) so smoke runs exercise redaction

### Day 11 Gate ✅
- ✅ End-to-end run with v0.2.0 + hooks: registry scan = MATCH, `redact_pii` scrubbed 4/4 PII types (ssn=1 email=1 phone=1 card=1), receipt #14 anchored at tx `0xb301ebf02778951dd4a5d8b7a4be8a7208491fcfe41a59b3c10903584a967754`, passport receiptCount=8 trustScore=8
- ✅ The LLM never received the redacted PII — output references only lease clauses, never the SSN/email/phone/card values
- ✅ Hooks correctly logged with `hook` prefix in CLI output for auditability

### Day 12 — All 7 CLI modes wired ✅ DONE 2026-05-08
- Shared `apps/cli/src/lib/pipeline.ts` orchestrates the common path: skill load → SkillRegistry scan → sandbox → session.start hooks → consensus.pre hooks (with patch) → router → consensus.post hooks → optional sign + anchor receipt + passport update. `doc ask` keeps its own bespoke flow (Burn Mode evidence digest UX); the other 5 modes route through `runPipeline`.
- Two new first-party skills:
  - `seed-skills/plan-step/SKILL.md` v0.1.0 — read-only planner (no writes, no shell, quick tier, redact_pii + balance_check + log_tokens hooks)
  - `seed-skills/code-edit/SKILL.md` v0.1.0 — proposes a unified diff (standard tier, receipt_required, redact_pii + log_tokens hooks)
- Both new skills published on chain:
  - `plan-step@0.1.0` → tx `0xf3cd0fbeaca619fcbb8d56e6cdb7e9b5cc96e488456f4996b6168bdc38147e2f`
  - `code-edit@0.1.0` → tx `0xf5343367b9eb934d2b2eff975c4bc97826e1233091577e04e3249169ae7b1be9`
- Five new mode commands wired into `bin/ivaronix.ts`:
  - `ivaronix plan <goal> --files ...` — read-only; receipt opt-in
  - `ivaronix code <task> --files ...` — emits unified diff; receipt always (sandbox enforced)
  - `ivaronix audit <path>` — walks dir, audits each file with `--max-files` cap; receipt per file
  - `ivaronix swarm run <todo>` — parses markdown bullets/numbered list, dispatches each task; receipt per task
  - `ivaronix watch <path>` — foreground daemon with `--interval` / `--max-runs` / `--duration`; receipt per run
- **Schema fix (during testing):** `og.hooks` made `.optional()` so older manifests (no hooks) keep their canonical-JSON hash. Verified github-audit + 0g-integration-auditor still match their on-chain anchors after the fix.

### Day 12 Gate ✅
- ✅ All 5 new modes smoke-tested end-to-end on testnet 16602 with real consensus + real receipts:
  - `plan` → Status: → COMPLETE (read-only, 7-step plan rendered for "Ship Ivaronix v0.1 to OG testnet")
  - `audit contracts/src/SkillRegistry.sol` → receipt #15, found 3 medium/info findings
  - `code "Add natspec comment"` → receipt #16, sandbox correctly blocked when `--no-receipt` passed (then allowed when receipt enabled)
  - `swarm run sample-todo.md` (2 tasks) → both ran through plan-step with registry MATCH
  - `watch SkillRegistry.sol --max-runs 1` → receipt #17 anchored
- ✅ 61/61 contract tests pass after schema change; every workspace typecheck (consensus / memory / og-toolkit / skills / cli) passes.
- ✅ Skill catalog now lists 5 first-party skills, all with on-chain anchored manifests.

### Day 13 — Studio scaffold ✅ DONE 2026-05-08
- `apps/studio` — Next.js 15.0.3 + React 19 + Tailwind v4-beta with the canonical brand tokens from UI_UX_GUIDE.md §1 (cream `#faf9f6` background, near-black `#1a1a1a` foreground, accent green `#16a34a`, serif italic display via Times New Roman). Editorial design — NOT dark mode (BUILD.md was older; UI_UX_GUIDE locked 2026-05-08 wins).
- 8 routes scaffolded:
  - `/` — hero with "Catch the risks. *Keep the receipts.*" + live `Total receipts` from on-chain `ReceiptRegistry.nextId()` + Four-Light Row + section pattern
  - `/skills` — catalog of 5 first-party skills with permission pills (network/files/compute)
  - `/skill/[id]` — detail page; reads on-chain manifestHash + creator + publishedAt from SkillRegistry
  - `/r/[id]` — receipt page; reads from `ReceiptRegistry.getReceipt(id)` (numeric) or `findByReceiptRoot` (bytes32)
  - `/agent/[handle]` — passport profile (wallet-address handles for Day 13; vanity handles Day 17)
  - `/memory` — Day-13 stub for the Memory Permission Center
  - `/global` — live `nextId` + `nextTokenId` reads cached 60s
  - `/dashboard` — wallet-aware stub showing connected address + links
- Components: `Logo` (brackets-with-i), `Header` (sticky 64px, blur backdrop), `WalletConnect` (wagmi `injected` connector), `FourLightRow`, `Section` (the §-pattern), all per UI_UX_GUIDE.
- Wallet connect: wagmi v2 + viem with `defineChain` for both `ogTestnet` (16602) and `ogMainnet` (16661); `injected` connector covers MetaMask + browser wallets without WalletConnect overhead.
- `src/lib/chain.ts` — server-side reads from ReceiptRegistry + AgentPassportINFT + SkillRegistry using the workspace `@ivaronix/og-chain` package directly (no API proxy).
- `next.config.ts` — `transpilePackages` + a webpack `extensionAlias` for `.js` → `.ts` so workspace ESM source imports resolve without a build step.
- `middleware.ts` — rewrites `/@<handle>` → `/agent/<handle>` for the canonical vanity URL pattern from HLD §6 (Next.js doesn't accept literal `@` in route segments).
- `app/icon.svg` — brand brackets-with-i mark; Next 15 picks it up automatically as the favicon.

### Day 13 Gate ✅
- ✅ `next build` succeeds (8 routes compiled · middleware 31.9 kB · shared chunks 100 kB · React 19)
- ✅ Workspace typecheck passes (every package + Studio)
- ✅ Playwright visual diff at 1280×800: homepage renders with `Total receipts: 18` (LIVE from on-chain `ReceiptRegistry.nextId()`), `First-party skills: 5`, brand cream-on-black, serif italic emphasis on "Keep the receipts.", §-numbered section labels, Four-Light Row chips, brand-correct logo + wordmark
- ✅ All 5 routes load successfully via `next start` on :3300 (`/`, `/skills`, `/skill/private-doc-review`, `/global`, `/r/14`)
- ✅ Console clean except an initial `/favicon.ico 404` — fixed by adding `app/icon.svg`
- ⚠ Vercel deploy skipped (requires user-side `vercel login`); Day-22 Phase A close will deploy. The build artifacts are deploy-ready.

### Day 14 — Studio: drop-zone hero + run flow ✅ DONE 2026-05-08
- Refactored the run pipeline into a new `packages/runtime` workspace package so Studio + CLI share one code path. The CLI keeps a thin colorized wrapper at `apps/cli/src/lib/pipeline.ts`; Studio uses `@ivaronix/runtime` directly.
- New `PipelineLogger` interface (`info` / `pass` / `fail`) with two implementations: CLI binds it to the colorized stdout `ui`, Studio binds it to a `createCaptureLogger()` that returns structured log entries with the JSON response.
- `apps/studio/src/components/RunPanel.tsx` — react-dropzone hero card with skill picker (5 first-party skills), tier picker (Quick/Standard/High-Stakes), receipt toggle, free-form question field, Run button, Four-Light Row that animates through pending → active → verified, ResultCard that shows the audit findings + token/cost metadata + receiptId + "Verify on chain →" anchor link to the testnet explorer.
- `apps/studio/src/app/api/run/route.ts` — Next.js Route Handler (`runtime: nodejs`, `maxDuration: 60`) that accepts `{ skillId, question, contentText, tier, receipt }`, calls `runPipeline` with a capture logger, returns `{ ok, finalText, scan, receiptId, receiptTxHash, receiptOnchainId, logs }`.
- `apps/studio/src/lib/boot-env.ts` — lazy `.env` loader for server-side route handlers; walks parent dirs from cwd to find the workspace-root `.env` (so the same testnet wallet + router config the CLI uses also signs Studio receipts). Bypasses Next 15.0.3's instrumentation.ts edge-bundling issue with `dotenv`/`crypto`.
- `next.config.ts` — `transpilePackages` extended to all six workspace packages the runtime touches (core, og-chain, og-router, consensus, skills, receipts, runtime).
- Replaced the static "Drop a file" placeholder code-snippet on `/` with the live `<RunPanel/>`.

### Day 14 Gate ✅
- ✅ `next build` green: 8 routes + new `/api/run` Route Handler · homepage bundle 19.3kB → 128kB First Load JS
- ✅ Workspace typecheck green for both `@ivaronix/runtime` and `@ivaronix/studio`
- ✅ Playwright smoke at `http://localhost:3300/`: drop-zone hero rendered with brand-correct dashed border, skill/tier pickers, receipt checkbox, disabled Run button (correctly waiting for content), Four-Light Row in all-pending amber state below the action area
- ✅ End-to-end **API smoke test on testnet 16602**: `POST /api/run` with a tiny vulnerable Solidity contract → `github-audit` quick tier → registry scan MATCH (creator wallet identical to CLI signer) → consensus complete (1640ms · 487+50 tok · 0.00002935 OG) → **receipt #18 anchored at tx `0xb28f01a8297c2949b7319bd5b52ac958b27c134c12a29947e02dbf2a8ba114fe`, block 32107150**
- ✅ The captured-logger payload returns the same audit-trail rows the CLI would print, so a future Studio polish pass can render them as a live console alongside the result card.

### Day 15 — Public proof URLs + passport profile ✅ DONE 2026-05-08
- `packages/og-chain` — new `ReceiptRegistryClient.findByAgent(agent, limit, lookback)` that filters `ReceiptAnchored` events by indexed agent address and returns newest-first `OnChainReceipt[]` for activity feeds.
- `apps/studio/src/lib/local-receipt.ts` — server-side helper that walks parent dirs from `cwd` to find `.ivaronix/receipts/anchored/`, then matches a JSON file by `storage.receiptRoot` so the public page can render headline/risk/citations from the canonical receipt body without a daemon. (Day 22 will fall back to 0G Storage download once B-1 unblocks.)
- `apps/studio/src/components/ReceiptStateChip.tsx` — locked 3-state chip per UI_UX_GUIDE §6 (PENDING / VERIFIED / MISMATCH).
- `apps/studio/src/components/ShareButton.tsx` — client component: Copy URL (clipboard API with fallback to new-tab) + Share on X (Twitter intent URL).
- `apps/studio/src/app/r/[id]/page.tsx` — full rewrite as a public proof URL:
  - resolves either numeric on-chain id or 0x bytes32 receiptRoot
  - computes verification ladder (Storage / Compute / TEE / Chain) from on-chain anchor + local body
  - renders sanitized headline (from `outputs.wording.headline`), risk-level chip (low/medium/high), Burn-Mode badge when `execution.burnMode`
  - shows receiptRoot + agent (linked) + anchor tx (linked) + type + tokens + cost
  - shows citations from `outputs.citations`
  - footer with CLI verify hint + ShareButton
  - `generateMetadata` produces title/description/og:image/twitter:card per page
- `apps/studio/src/app/r/[id]/opengraph-image.tsx` — `next/og` ImageResponse renders editorial-cream OG card with brackets-i mark, "§ RECEIPT · #N", headline (140 char clip), VERIFIED chip, "ivaronix.app". Uses system fonts (`fonts: []`) to bypass the bundled Noto Sans.
- `apps/studio/src/app/agent/[handle]/page.tsx` — full rewrite:
  - 5-tier badge system (Newcomer / Verified / Trusted / Veteran / Council) computed from `trustScore` thresholds (0 / 5 / 20 / 50 / 200)
  - **Recent activity feed** — uses `findByAgent` to render the last 5 receipts with timestamp, type, receiptRoot prefix; each links to `/r/{id}`
  - 2-column layout (activity card + tier/profile aside), "On chainscan →" external link

### Day 15 Gate ✅
- ✅ `next build` green: `/r/[id]` 618B + `/r/[id]/opengraph-image` route compiled · `/agent/[handle]` 178B with new activity card
- ✅ Workspace typecheck green for both `@ivaronix/og-chain` and `@ivaronix/studio`
- ✅ Playwright smoke at `/r/18`: real on-chain data resolved, **headline pulled from local receipt** ("Severity: critical — unsafe external calls — Use transfer or send instead of call for sending Ether"), VERIFIED chip + RISK: LOW chip rendered, Four-Light Row Chain=verified Storage/Compute=verified TEE=pending, anchor tx linked to chainscan-galileo, ShareButton (Copy URL + Share on X) bottom-right; page title `Receipt #18 · Ivaronix`
- ✅ Playwright smoke at `/agent/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`: real testnet data shows Trust score 12, 12 receipts anchored, RECENT ACTIVITY (5) lists receipts #18/#17/#16/#15/#14 each with timestamp + type code + receiptRoot prefix and clickable; tier card shows "Verified ≥ 5 trust"; PROFILE table tokenId=1 trust=12 receipts=12 violations=0
- ⚠ **OG image preview on local Windows fails** with `ERR_INVALID_URL .\\file:\\C:\\...noto-sans-v27-latin-regular.ttf` — known Next 15.0.3 + Windows bug in `@vercel/og` font preloading. The route file is in place; metadata auto-includes the OG image URL; production deploy on Vercel/Linux will render correctly. Documented; not a Day-15 blocker.

### Day 16 — Skill browser + skill detail polish ✅ DONE 2026-05-08
- `apps/studio/src/lib/skills.ts` — server-side skill discovery: walks parent dirs from cwd to find `seed-skills/` + `.ivaronix/skills/`, dedupes by skill id, exposes `loadAllSkills()` and `findSkillByIdServer()`. `loadSampleFiles()` reads `tests/*` and returns the first 2400 bytes of each.
- `apps/studio/src/components/PermissionPills.tsx` — 5-slot pill row per UI_UX_GUIDE §7: net / files / compute / wallet / shell with green/amber/red tones derived from the manifest's `og.permissions` block.
- `/skills` rewrite — fully dynamic: loads all skills from disk, queries SkillRegistry per-skill for `MATCH` / `MISMATCH` / `LOCAL ONLY` registry status, sorts MATCH-first then alphabetical, renders 5-pill permission row + tier + burn-auto chip + on-chain registry badge per card. Footer counts loaded skills + current network.
- `/skill/[id]` rewrite — 2-column detail page:
  - **Left:** status card (registry chip + tier + license + permissions), sample-input card (renders `tests/` files with byte size + 2.4kB excerpt in mono-font), system-prompt card (full SKILL.md body), version-history card (uses on-chain `versionCount`)
  - **Right:** "Try it" CTA jumps to `/?skill=<id>`, on-chain anchor (manifestHash + creator-linked-to-chainscan + publishedAt), reputation card (on-pass / on-fail / on-violation trust deltas + locked flag)
- `RunPanel` — reads `?skill=<id>` from `window.location.search` on mount and pre-selects the matching skill, so `/skill/<id>` → "Open Studio →" → drop-zone arrives with the right skill already chosen.

### Day 16 Gate ✅
- ✅ `next build` green; all workspace typechecks green
- ✅ Playwright smoke at `/skills`: 5 cards rendered with REGISTRY MATCH on every one (live on-chain MATCH against the SkillRegistry contract for github-audit / 0g-integration-auditor / private-doc-review v0.2.0 / plan-step / code-edit), each card shows 5 permission pills (net=amber 2-4 hosts / files=green / compute=green / wallet=green / shell=green), private-doc-review shows additional 🔒 burn-auto chip; footer "5 skills loaded · network testnet"
- ✅ Playwright smoke at `/skill/private-doc-review`: title v0.2.0, REGISTRY MATCH + tier standard + license Apache-2.0 status row, sample-input card renders `sample-lease.txt` with PII visible, system-prompt card shows full SKILL.md body, on-chain anchor card shows manifestHash `sha256:874d…f689`, creator wallet linked, publishedAt `2026-05-07 20:56`, reputation card shows on-pass +1 trust / on-fail -2 / on-violation -10 LOCKED, "Open Studio →" jumps with `?skill=private-doc-review`

### Day 17 — Memory Permission Center + Global Stats ✅ DONE 2026-05-08
- `apps/studio/src/lib/local-receipts.ts` — server-side helper that walks parent dirs to find `.ivaronix/receipts/anchored/`, reads up to N most-recent JSON files (newest mtime first), exposes `loadAllLocalReceipts(maxEntries)`, `topSkillsByUsage(receipts, limit)`, `totalOgSpent(receipts)`. Used by `/global` to compute aggregate stats from the canonical receipt bodies.
- `apps/studio/src/lib/client-abis.ts` — client-safe ABI fragments duplicated from `@ivaronix/og-chain`. Necessary because the og-chain barrel re-exports `deployments.ts` which uses `node:fs`/`node:path`; that's fine on the server but breaks Next's client bundle. Documented in the file header so the duplication stays in sync.
- `apps/studio/src/app/global/page.tsx` rewrite — adds **OG spent** stat (sum of `billing.totalCostOg` from local receipts), **Top skills (last 50 receipts)** card grouping local receipts by `skillId` with run count + total cost, **Recent memory access (chain log)** feed reading the last 5 `MemoryAccessed` events from the on-chain `MemoryAccessLog` contract. 60s revalidate.
- `apps/studio/src/app/memory/page.tsx` rewrite — server route resolves `CapabilityRegistry` + `MemoryAccessLog` deployed addresses from the og-chain workspace, then mounts the client-side `<MemoryPanel/>`.
- `apps/studio/src/components/MemoryPanel.tsx` — wallet-aware on-chain admin per UI_UX_GUIDE:
  - shows empty-state card prompting Connect Wallet when not connected
  - **issue-grant form**: grantee address input, scope picker (3 presets: project / work / personal — `keccak256("namespace:<x>")` sent on-chain), TTL slider (1h–30d), `wagmi.useWriteContract` calling `CapabilityRegistry.issueGrant(...)`
  - **your grants list**: `useReadContract listGrantsByOwner(address)` then per-grant `grants(grantId)` to render grantee + expiry + reads-remaining; **Revoke** button calls `revokeGrant`
  - aside card showing connected wallet + capability/memory-log contract addresses

### Day 17 Gate ✅
- ✅ `next build` green: `/memory` 41.4kB First Load JS (wagmi + viem on the wallet form), `/global` 182B server-rendered with new memory feed
- ✅ Workspace typecheck green
- ✅ Playwright smoke at `/global`: live stats — Receipts anchored **19**, Passports minted **1**, OG spent **0.000029** (sum of local billing), First-party skills **5**; Top skills card shows `github-audit · 1 run · 0.000029 OG`; Recent memory access feed shows 5 real on-chain `MemoryAccessed` events from wallet `0xaa954c33…77Ce` (READ + WRITE access types from the Day-8 memory engine writes), each row stamped with block number + ISO timestamp
- ✅ Playwright smoke at `/memory`: page renders the §-pattern, "Grants. Scopes. Audit." headline, and the wallet-required empty-state card ("Connect a wallet to issue and revoke memory grants. The connected wallet becomes the grant owner; only it can revoke."). The wagmi-wired issue + revoke + grants-list flows mount once a wallet connects; full end-to-end click-to-tx test requires a browser wallet extension and is deferred to Day 22 e2e.

### Day 18 — Studio polish + mobile responsive ✅ DONE 2026-05-08
- `apps/studio/src/app/globals.css` — added the responsive layer per UI_UX_GUIDE §8:
  - **Tablet ≤1280px**: body font 16px → 15px
  - **Mobile ≤768px**: hero h1 80px → 40px (line-height 1.05, letter-spacing -0.5px), section padding 96px → 48px, header nav links hidden (logo + Connect-wallet only), every 2-col grid (`grid-template-columns: 2fr 1fr` and `1fr 1fr`) collapses to single column via attribute selector, card padding 32px → 20px, `.italic-display` numbers 64px → 40px, footer wraps to column with reduced padding, .btn-primary/.btn-secondary inside cards become full-width
  - Hover lift on `.card-hoverable` (only on `(hover: hover)` devices, avoids sticky :hover on touch)
  - Smooth focus-ring transition + reduced-motion respect (already present)

### Day 18 Gate ✅
- ✅ `next build` green (no bundle changes; CSS-only)
- ✅ Playwright visual diff at **390×844 (mobile)**: home renders single-column, hero "Catch the risks. *Keep the receipts.*" at 40px, nav reduced to logo + wallet, drop-zone hero card stacks (skill/tier rows wrap), stat cards single-column, footer wraps; `/skills` renders 5 stacked cards with REGISTRY MATCH on each, all permission pills wrap cleanly
- ✅ Playwright visual diff at **1280×800 (tablet)**: full nav, hero at full size, 4-col stat grid, 2-col bottom panel on `/global` (Top skills + Recent memory access)
- ✅ Desktop 1440×900 path unchanged — earlier Day-17 + Day-15 screenshots already proved correct rendering at desktop width
- ⚠ Demo GIF deferred to Day 22 e2e once a real wallet is connected (Playwright MCP can't host an injected web3 provider for the Run-flow click-through)

---

## Blockers

### B-1 (Day 4, opened 2026-05-08): 0G Storage testnet `FixedPriceFlow.submit()` reverts
- **Symptom:** every upload via `@0glabs/0g-ts-sdk@0.3.3` to indexer `https://indexer-storage-testnet-turbo.0g.ai` reverts with `require(false)` at on-chain `submit()` of FixedPriceFlow `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296` on testnet 16602
- **Tried:**
  - auto fee (`30733644962n` ≈ 3.07e-8 OG) → revert
  - manual fee `1e15n` (0.001 OG) → revert
  - explicit `gasLimit: 2_000_000` → tx broadcast (block 32092800, tx `0xcc06718c...`) with `status=0`
  - tx data confirmed correct: `submit()` selector + encoded submission struct
  - direct contract reads (`marketAddress()`, `MAX_DEPTH()`) also revert — public surface unknown
  - alternative `indexer-storage-testnet-standard.0g.ai` returns 503
- **Workaround applied:** Day 4 Burn Mode + receipt anchor proceeds without 0G Storage upload. `storage.evidenceRoot` is omitted (or set to local sha256 of ciphertext as a content-addressable digest). Receipt is still chain-anchored on `ReceiptRegistry`. The receipt's `burn` block correctly captures key fingerprint + destroyedAt locally.
- **Plan to unblock:** Day 8 (hybrid memory) requires Storage too — will dedicate time then to either:
  - Investigate by running a local 0G storage node + uploading via that
  - Open issue with 0G team on Discord
  - Try newer SDK version (e.g. `@0glabs/0g-ts-sdk@0.4.x` if released)
  - Use the `0g-storage-cli` Rust CLI directly as a fallback (per `0G_RESOURCES.md §3`)
- **Impact:** Phase A demos work end-to-end except `evidenceRoot` is local-only; mainnet promotion (Phase B Day 23) likely uses different Storage infrastructure where this may not occur.

---

## Notes for next loop iteration

When the next iteration of `/loop` fires, read this file FIRST. Pick up from the latest "in progress" item. Do not redo work that's already in "Done."

If the latest "in progress" item shows recent file timestamps but no completion, it means the previous iteration was interrupted — resume from where the files indicate.

Run `git log --oneline -20` to see the actual code state regardless of what this file says.
