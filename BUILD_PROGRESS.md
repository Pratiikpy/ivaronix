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
| A | 4 (Burn Mode + doc-ask) | ⬜ pending |
| A | 5 (tiered consensus + TEE verify) | ⬜ pending |
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

### Day 4 — Burn Mode + doc-ask end-to-end (next)
- AES-256-GCM session keys with destruction + key fingerprint capture
- `ivaronix doc ask <pdf> --burn --receipt` builds, encrypts, uploads to 0G Storage, anchors receipt, prints public Proof URL placeholder
- `peekHeader`-detected encryption type
- Wire `@0gfoundation/0g-storage-ts-sdk` into `packages/og-storage` (currently stubbed)
- Storage upload with proof download verification
- Local cleanup verification (zero buffer, vacuum tmp dir)

### Day 4 Gate
- `ivaronix doc ask <pdf> --burn --receipt` end-to-end on testnet
- Receipt has populated storage section (real evidenceRoot, encryption metadata)
- Receipt verifies CLAIMED → ANCHORED
- No plaintext leak in receipt JSON (only hashes)

---

## Blockers

(none yet — append here when something requires user action)

---

## Notes for next loop iteration

When the next iteration of `/loop` fires, read this file FIRST. Pick up from the latest "in progress" item. Do not redo work that's already in "Done."

If the latest "in progress" item shows recent file timestamps but no completion, it means the previous iteration was interrupted — resume from where the files indicate.

Run `git log --oneline -20` to see the actual code state regardless of what this file says.
