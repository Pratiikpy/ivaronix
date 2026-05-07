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
| A | 6 (ERC-7857 passport) | ⬜ pending |
| A | 7 (CapabilityRegistry + MemoryAccessLog) | ⬜ pending |
| A | 8 (hybrid memory engine) | ⬜ pending |
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

### Day 6 — ERC-7857 Agent Passport (next)
- Deploy `Erc7857Verifier.sol` and `AgentPassportINFT.sol` to testnet
- `ivaronix passport mint` mints ERC-7857 INFT for the user's wallet
- Encrypted metadata blob on 0G Storage; pointer in 0G KV (B-1 caveat: KV uses local cache until Storage upload unblocks)
- Passport `recordReceipt(tokenId, receiptId)` updates trustScore + receiptCount on chain
- `ivaronix passport restore --wallet 0x...` restores from chain + KV
- `ivaronix passport show` displays current state

### Day 6 Gate
- `ivaronix passport mint` mints + returns tokenId; passport.json on disk
- `ivaronix passport show` reads on-chain state (trustScore, receiptCount, ownerWallet)
- `recordReceipt` integration so each `doc ask --receipt` updates passport reputation

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
