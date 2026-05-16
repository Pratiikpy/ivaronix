# Ivaronix

> **Private AI work. Public proof.**
>
> Every AI review leaves a signed, chain-anchored receipt — independently re-verifiable by anyone, on any machine, in 10 seconds, without an account.

[![mainnet](https://img.shields.io/badge/0G_Aristotle_Mainnet-Live%202026--05--15-16a34a)](https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297)
[![testnet](https://img.shields.io/badge/0G_Galileo_Testnet-Live-16a34a)](https://chainscan-galileo.0g.ai/address/0x7396D536594e2BE833070c7EB441A10906046257)
[![tests](https://img.shields.io/badge/Foundry-227%2F227_green-16a34a)](contracts/test/) <!-- numbers-bare:allow: badge URL embeds value; shields.io requires URL-encoded literal; numbers.json contracts.foundryTests is the SoT for this value -->
[![receipts](https://img.shields.io/badge/Receipts_anchored-1%2C778%2B-16a34a)](docs/numbers.json)

```text
[ Drop a document ]  →  [ 0G Compute TEE ]  →  [ 0G Chain anchor ]  →  [ Public Proof URL ]
   contract.pdf          specialist runs        receipt signed +        /r/<id> renders
   stays private         inside attested        hash anchored on        evidence anyone
   throughout            hardware enclave       ReceiptRegistryV3       can re-verify
```

---

## For OG APAC Hackathon judges — 60-second path

> Every item below is a real on-chain artifact at submission time. No mocks.

```bash
git clone https://github.com/Pratiikpy/ivaronix.git && cd ivaronix
pnpm install
pnpm ivaronix receipt verify 1644
# → ANCHORED ✓  (schema · hash · signature · chain anchor)
```

Add `--tee-independent` for the full 5-step proof against the live 0G Compute provider:

```bash
pnpm ivaronix receipt verify 74 --tee-independent
# → FULLY VERIFIED ✓  (5 of 5: schema · hash · signature · chain · TEE)
```

No wallet. No account. The receipt was anchored from a different machine; you re-run the verification against the public 0G chain.

| Want… | Open this |
|---|---|
| **5-minute demo path** | [docs/JUDGE_GUIDE.md](docs/JUDGE_GUIDE.md) |
| **Pitch deck (PDF)** | [Ivaronix_Pitch_Deck.pdf](Ivaronix_Pitch_Deck.pdf) |
| **3-page pitch (non-technical)** | [docs/PITCH.md](docs/PITCH.md) |
| **Technical whitepaper (PDF)** | [Ivaronix_Whitepaper.pdf](Ivaronix_Whitepaper.pdf) |
| **Mainnet receipt registry on chainscan** | [`0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297`](https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297) |
| **Reviewer notes (faucet, test wallet, networks)** | [Reviewer notes](#reviewer-notes) below |

---

## 1 · Project overview

**Problem.** Professional AI adoption accelerated sharply in 2024–2025: 26% of legal organisations now actively use generative AI, up from 14% a year earlier ([Thomson Reuters, 2025](https://www.thomsonreuters.com/en/press-releases/2025/april/from-incubation-to-integration-generative-ai-adoption-nearly-doubles-as-professional-services-reach-crossroads)). At the same time, the EU AI Act Article 12 record-keeping mandate enters full application on **2 August 2026** for high-risk systems ([artificialintelligenceact.eu/article/12](https://artificialintelligenceact.eu/article/12/)). Yet the default consumer AI surface gives a user no cryptographic record of which model ran, what data was touched, or whether the answer was edited afterward. The audit log, when it exists at all, is controlled by the same vendor being audited.

**Solution.** Ivaronix gives every important AI action a verifiable receipt — RFC-8785 canonical-hashed, EIP-712 signed by the agent's on-chain identity, anchored on `ReceiptRegistryV3` (0G Chain), with the inference itself running inside a TEE-attested 0G Compute provider. The receipt is independently re-verifiable by a stranger on a clean machine, in one shell command, in any of three languages (TypeScript / Python / Rust).

**Persona.** The deal lawyer scanning a contract before signing. The founder reviewing a vendor agreement. The analyst sweeping a private data room. Anyone whose work demands an AI second opinion *and* an audit trail other people can verify.

**Tracks.** Track 1 (Agentic Infrastructure) primary; Track 3 (Agentic Economy) automatic-secondary via `SkillRegistryV2` and `og.creator.fee_split`.

---

## 2 · System architecture

```
                ┌──────────────────────────────────────────────────────┐
                │                       USER                            │
                │            Studio (Next.js 15) · CLI · MCP            │
                └──────────────────────┬───────────────────────────────┘
                                       │ skill run
                                       ▼
        ┌────────────────────────────────────────────────────────┐
        │                  IVARONIX RUNTIME                       │
        │  manifest → consensus orchestrator → receipt builder    │
        └──┬──────────────────┬──────────────────┬──────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌───────────┐      ┌───────────┐      ┌────────────┐
    │ 0G Router │      │ 0G Compute│      │ 0G Storage │
    │ (rotation │      │   (TEE)   │      │ (evidence  │
    │ + billing)│      │ attested  │      │  + Burn    │
    │           │      │ inference │      │  ciphertext│
    └─────┬─────┘      └─────┬─────┘      └──────┬─────┘
          │                  │                   │
          └──────────────────┴───────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │   Receipt (RFC-8785 + JCS    │
              │   + Zod-validated + EIP-712  │
              │   signed by passport wallet) │
              └──────────────┬───────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────────────┐
        │              0G CHAIN — ANCHORS                     │
        │  ReceiptRegistryV3 · AgentPassportINFTV2            │
        │  CapabilityRegistryV2 · MemoryAccessLogV2           │
        │  SkillRegistryV2 · SkillPricing · SkillRunPayment   │
        │  SubscriptionEscrowV2 · Erc7857Verifier             │
        └────────────────────────────────────────────────────┘
                             │
                             ▼
             ┌──────────────────────────────────┐
             │   /r/<id> — public proof page     │
             │   ivaronix receipt verify <id>    │
             │       --tee-independent           │
             │                                   │
             │   →  FULLY VERIFIED ✓             │
             │      (5 checks · no account       │
             │       · works on a clean machine) │
             └──────────────────────────────────┘
```

The five steps `schema → hash → signature → chain anchor → TEE re-attest` are the load-bearing claim of the whole product. Step 5 (`broker.processResponse` against the live 0G Compute provider) is what makes the receipt verifiable to a third party weeks after the original inference.

Detailed architecture in [HLD.md](HLD.md). Receipt-schema reference in [RECEIPTS_SPEC.md](RECEIPTS_SPEC.md). Canonical-hash spec in [docs/HASH_FUNCTION.md](docs/HASH_FUNCTION.md).

---

## 3 · 0G modules used (and how each supports the product)

Five primitives live today; one (0G DA) is on the roadmap. We do not claim integration we have not shipped.

| 0G Primitive | How Ivaronix uses it | User-visible value | Where it lives |
|---|---|---|---|
| **0G Chain** | Anchors every receipt via `ReceiptRegistryV3` EIP-712 typed-data with per-agent monotonic nonce. Anchors passport mints, capability grants, memory access logs, skill registrations, subscription escrow. | A verification two years from now produces the same answer as a verification ten seconds after the run. | [`@ivaronix/og-chain`](packages/og-chain/) · [contracts/](contracts/) |
| **0G Compute** | The specialist model runs inside a TEE on 0G Compute. After the run, `broker.processResponse` is re-invoked from any machine to confirm the attestation against the live network. | `verificationMethod: 'compute_sdk_process_response'` is an honest claim that any stranger can re-check. This is the load-bearing step. | [`@ivaronix/og-router`](packages/og-router/) |
| **0G Storage** | The encrypted blob (Burn Mode) and the signed receipt JSON live on 0G Storage. The blob's storage root is recorded inside the receipt; anyone can fetch the ciphertext and confirm it matches. | Evidence is content-addressed on infrastructure no single party controls — exactly what EU AI Act Article 12 expects from a "non-operator-controlled" record. | [`@ivaronix/og-storage`](packages/og-storage/) |
| **0G Router** | Routes inference to 0G Compute providers. Records per-provider rate-limits and cost telemetry on the receipt. Multi-credential `Keyring` with three failure-mode taxonomy (`'402'` permanent, `'auth'` permanent, `'429'` transient). | A reviewer can read the receipt body and see exactly how the work was billed, by which provider, with which model. | [`@ivaronix/og-router/keyring`](packages/og-router/src/keyring.ts) |
| **0G Agent ID (ERC-7857)** | `AgentPassportINFTV2` mints a soulbound INFT per agent, storing trust score, receipt count, and violation history. Every receipt is bound to a passport tokenId. Delegated agents get their own passport so trust accrues to the agent itself. | Buyers can inspect an agent's on-chain track record before purchasing a skill run. Receipt signer is recovered and matched against the passport owner on chain. | [`AgentPassportINFTV2.sol`](contracts/src/AgentPassportINFTV2.sol) |
| **0G DA** *(roadmap)* | Receipt-batch dispersal once 0G ships a public DA endpoint. Schema slot `og.da.batched` reserved (default `false`); v1.1 wires it without breaking byte-equality of current receipts. | High-volume archival without per-receipt anchor cost. Documented in [docs/0G_DA_INTEGRATION.md](docs/0G_DA_INTEGRATION.md). | scaffolded; no live endpoint claim |

---

## 4 · By the numbers (refreshed via `pnpm numbers:refresh`)

| Metric | Value | Where to look |
|---|---|---|
| Receipts anchored on chain | **<!-- numbers:auto:receipts.total -->1737<!-- /numbers:auto:receipts.total -->+ testnet** · **<!-- numbers:auto:mainnet.receiptsAnchored -->22<!-- /numbers:auto:mainnet.receiptsAnchored --> mainnet** | live `nextId()` on V1+V2+V3 registries |
| Receipt types | **<!-- numbers:auto:receiptTypes.count -->13<!-- /numbers:auto:receiptTypes.count -->** | `packages/core/src/types.ts` enum |
| Deployed contracts | **<!-- numbers:auto:contracts.deployed -->15<!-- /numbers:auto:contracts.deployed --> testnet** · **<!-- numbers:auto:mainnet.deployedContractsToday -->10<!-- /numbers:auto:mainnet.deployedContractsToday --> mainnet** | tables below |
| Foundry tests | **<!-- numbers:auto:contracts.foundryTests -->227<!-- /numbers:auto:contracts.foundryTests -->** all passing | `cd contracts && forge test` |
| Workspace packages typecheck-clean | **<!-- numbers:auto:packages.typecheckClean -->21<!-- /numbers:auto:packages.typecheckClean -->** | `pnpm -r typecheck` |
| First-party skills + ported catalog | **<!-- numbers:auto:skills.firstParty -->10<!-- /numbers:auto:skills.firstParty -->** + **<!-- numbers:auto:skills.vendored -->150<!-- /numbers:auto:skills.vendored -->** = **<!-- numbers:auto:skills.catalogTotal -->160<!-- /numbers:auto:skills.catalogTotal -->** | `seed-skills/` + `apps/cli/.ivaronix/skills/` |
| 0G primitives integrated | **5** (Chain · Compute · Storage · Router · Agent ID) | per-module table in §3 above |
| Polyglot canonical hash | **<!-- numbers:auto:polyglotHash.languages -->3<!-- /numbers:auto:polyglotHash.languages --> languages, byte-equal** | TS + Python + Rust, 29 vectors checked on every PR in `.github/workflows/jcs-roundtrip.yml` |
| Networks live | **Galileo testnet · Aristotle mainnet** | chainIds 16602 + 16661 |

Source of truth: [`docs/numbers.json`](docs/numbers.json) (refreshed against the live chain via `pnpm numbers:refresh`).

---

## 5 · Reproduction steps for judges

> Tested on a clean macOS / Linux machine. ~5 minutes including pnpm install.

### Prerequisites

```bash
# Node 20+, pnpm 9+, Foundry (for contract tests, optional)
node --version   # v20.x or v22.x
pnpm --version   # 9.x
```

### Clone, install, verify an existing anchored receipt (no wallet)

```bash
git clone https://github.com/Pratiikpy/ivaronix.git oglabs
cd oglabs
pnpm install

# Receipt 1644 — anchored on ReceiptRegistry V1 (testnet)
pnpm ivaronix receipt verify 1644
# Expected: → ANCHORED ✓  (schema · hash · signature · chain anchor)
```

### Full 5-step verification including live TEE re-attestation

```bash
# Receipt 74 — TIER 1 TEE-attested, anchored on V2
pnpm ivaronix receipt verify 74 --tee-independent
# Expected: → FULLY VERIFIED ✓
```

If the live 0G Compute provider's TEE channel is temporarily unreachable, the last two lines look like this — **honest amber banner, exit code 1, no fake green**:

```
tee:primary error
Status: → ANCHORED · TEE-independent partial
```

The first four checks are the load-bearing authenticity proof and pass deterministically. The TEE re-attestation is the additional check that calls back to the live 0G Compute provider — it proves the inference itself ran inside the attested TEE when reachable, and degrades honestly when not.

### Run a fresh receipt of your own (~3 seconds, ~0.0001 OG)

```bash
cp .env.example .env
# Fill: IVARONIX_ROUTER_KEY, IVARONIX_SIGNER_KEY
# Faucet for testnet OG: https://faucet.0g.ai

pnpm ivaronix demo
# → anchors one real receipt on Galileo testnet
# → prints three independent proof URLs: /r/<id>, chainscan-galileo.0g.ai/tx/<hash>,
#   and the `ivaronix receipt verify <id> --tee-independent` command
```

Want a richer view? `demo --tier standard` runs 3-role consensus (analyst / critic / judge); `--tier high-stakes` runs 5 roles; `--tier audit` runs 6 roles including red-team-critic.

For a sensitive document, add `--burn`:

```bash
pnpm ivaronix doc ask contract.pdf "find risky clauses" --skill private-doc-review --burn
# → AES-256-GCM session-key encryption, key destroyed post-anchor,
#   keyFingerprint captured before zero in the receipt body
```

### Open the Studio UI

```bash
pnpm --filter @ivaronix/studio dev
# → http://localhost:3300/
```

### Run the contract test suite (optional)

```bash
cd contracts && forge test
# → 227 tests passing across ReceiptRegistry V1+V2+V3, AgentPassport V1+V2,
#   CapabilityRegistry V1+V2, MemoryAccessLog V1+V2, SkillRegistry V1+V2,
#   SkillPricing, SkillRunPayment, SubscriptionEscrowV2, Erc7857Verifier
```

---

## 6 · Reviewer notes

### Network reference

| | Galileo testnet | Aristotle mainnet |
|---|---|---|
| Chain ID | `16602` | `16661` |
| RPC | `https://evmrpc-testnet.0g.ai` | `https://evmrpc.0g.ai` |
| Explorer | `https://chainscan-galileo.0g.ai` | `https://chainscan.0g.ai` |
| Faucet | `https://faucet.0g.ai` (free, no auth) | n/a |
| Status | <!-- numbers:auto:contracts.deployed -->15<!-- /numbers:auto:contracts.deployed --> contracts live | <!-- numbers:auto:mainnet.deployedContractsToday -->10<!-- /numbers:auto:mainnet.deployedContractsToday --> contracts live · deployed 2026-05-15 |

Funding ~0.5 OG from the testnet faucet covers a full afternoon of demo runs (one anchored receipt costs ~0.0001 OG). Receipts are idempotent on the storage and anchor layers; a stalled inference call can be re-run without duplicating chain state.

### Reviewer test account

The operator wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` is funded on Galileo testnet and is the deployer of all 25 contracts above. Reviewers can either:

1. **Reuse the operator wallet** — anchors against the existing passport (Galileo testnet tokenId 1 · Aristotle mainnet tokenId 2), inheriting the test history on each chain.
2. **Generate a fresh wallet** — `cast wallet new`, fund via `https://faucet.0g.ai`, run `pnpm ivaronix passport mint` to mint a new ERC-7857 passport. The whole flow takes ~60 seconds.

For mainnet TEE re-verification, the deployer wallet's first run on a fresh shell needs a one-time Compute provider acknowledgement + ledger deposit (≈0.001 OG). The scripts under `scripts/mainnet/` handle this: `pnpm exec tsx scripts/mainnet/discover-compute-providers.ts` lists registered TEE providers (the sovereign 0GM-1.0-35B-A3B provider at `0x4870CbC4…` is the canonical one); `pnpm exec tsx scripts/mainnet/deposit-compute-ledger.ts` deposits the broker ledger fee. Without these the first `--tee-independent` call returns ANCHORED + amber banner instead of FULLY VERIFIED — the verifier degrades honestly rather than failing silently.

### Canonical demo receipts (anchored, replay-able)

| Receipt id | Network | Type | Proof |
|---|---|---|---|
| **`1644`** | Galileo | `doc_ask` (TIER 1, TEE) | `pnpm ivaronix receipt verify 1644` returns ANCHORED |
| **`74`** | Galileo | `doc_ask` (TIER 1, TEE) — gold-standard B-V2-46 validation-PASS | `pnpm ivaronix receipt verify 74 --tee-independent` returns FULLY VERIFIED ✓ |
| **mainnet `21`** | Aristotle | `doc_ask` (TIER 1, TEE — signed by the registered sovereign 0GM-1.0-35B-A3B provider `0x4870CbC4…`) | `pnpm ivaronix receipt verify 21 --network mainnet --tee-independent` returns FULLY VERIFIED ✓ |

If the TEE channel is unreachable at the moment a judge runs `--tee-independent`, the first four checks still pass and the CLI returns ANCHORED + an amber banner. That's by design — honesty beats fake-green.

### Rate-limit caveats

- **0G Router** caps requests at ~30/min per credential. The `Keyring` rotates across multiple credentials when configured.
- **Public Studio proof pages** (`/r/<id>`) are read-only and have no rate limit.
- **`broker.processResponse` for TEE re-verify** works against receipts anchored within ~30 days. Older receipts return ANCHORED (the provider rotates attestation history).

---

## 7 · Tier 1 vs Tier 2 — honest disclosure

Every Ivaronix receipt is one of:

| Tier | Compute | Storage proof | Chain anchor | Re-verify CLI |
|---|---|---|---|---|
| **TIER 1 · TEE** (green) | TEE-attested 0G Compute | `evidenceRoot` on 0G Storage | yes | `--tee-independent` returns FULLY VERIFIED ✓ |
| **TIER 2 · EXTERNAL** (amber) | NVIDIA NIM / Gemini / OpenAI / Ollama | optional | yes | returns ANCHORED (not FULLY VERIFIED) |

The `/r/<id>` proof page never claims compute integrity it cannot back. A TIER 2 receipt renders an explicit *"verifies storage integrity ✓ · verifies compute integrity ⚠ external provider"* line. Storage-integrity and compute-integrity are separate claims and the page labels each one (per CLAUDE.md §6).

---

## 8 · What ships today (vs what's queued for v1.1)

### Shipped on both networks

- 13-type receipt schema with RFC-8785 canonical hash (TS / Python / Rust, byte-equal across all three, checked on every PR)
- `ReceiptRegistryV3` EIP-712 typed-data anchoring with per-agent monotonic nonces
- Independent TEE re-verification via `broker.processResponse`
- `AgentPassportINFTV2` (ERC-7857) — trust score, receipt count, violation history
- Consensus Mode — 6 roles, 4 tiers (`quick` / `standard` / `high-stakes` / `audit`), Jaccard + cosine convergence scoring
- Burn Mode — AES-256-GCM session-key encryption, key destroyed post-anchor, `keyFingerprint` captured before zeroing
- `SkillRegistryV2` marketplace primitive with `og.creator.fee_split` recorded on every receipt body
- <!-- numbers:auto:skills.firstParty -->10<!-- /numbers:auto:skills.firstParty --> first-party skills + <!-- numbers:auto:skills.vendored -->150<!-- /numbers:auto:skills.vendored --> ported skills (<!-- numbers:auto:skills.catalogTotal -->160<!-- /numbers:auto:skills.catalogTotal --> total in catalog)
- Studio (Next.js 15, SIWE session auth, mobile + desktop), CLI (`ivaronix(1)`), MCP server, IETF AAT-format export

### Queued for v1.1 (honest disclosure)

- **Live OG fee settlement.** `SkillRunPayment.sol` is deployed; wiring it into the Studio run flow so OG transfers at 90/10 split occur atomically on every marketplace purchase is the v1.1 headline item. Today the declared fee split is recorded on every receipt body and is enforceable off-chain against the receipt; live settlement adds the on-chain transfer.
- **0G DA integration.** Schema slot `og.da.batched` reserved; integration lands once 0G ships a public DA disperser endpoint. Documented in [docs/0G_DA_INTEGRATION.md](docs/0G_DA_INTEGRATION.md).
- **Multi-agent receipt chains.** Single receipt spanning a chain of agent delegations, with EIP-712 signatures from each passport.
- **ZK receipt compression.** SNARK proving receipt validity without revealing content — privacy-preserving compliance reporting.

---

## 9 · Polyglot canonical hash · RFC-8785

Three reference implementations of the receipt's canonical hash, byte-equal across all three on every PR:

- **TypeScript** · `packages/core/src/jcs.ts` · 17 self-tests
- **Python** · `scripts/verifier-py/` · 14 self-tests
- **Rust** · `ivaronix-verifier-rs/` · 11 self-tests · `cargo install ivaronix-verifier`

Cross-impl proof runs in `.github/workflows/jcs-roundtrip.yml` on every push: each language hashes the same 29 vectors, `scripts/verifier-py/cross_check.py` asserts byte-equality across all three. CI blocks merge on any divergence.

Why this matters: *"re-verify on any machine, in any language"* is only true if the canonical hash is language-independent. RFC-8785 (JSON Canonicalisation Scheme) is the spec; [`docs/HASH_FUNCTION.md`](docs/HASH_FUNCTION.md) is the design doc, including the `schemaVersion` migration plan so v1 and v2 receipts coexist forever.

---

## 10 · Deployed contracts

### Phase A · Galileo testnet (chainId 16602)

All <!-- numbers:auto:contracts.deployed -->15<!-- /numbers:auto:contracts.deployed --> contracts deployed and feeding live data into Studio + CLI + MCP:

<!-- contracts:auto:start -->
| Contract              | Address                                                                                                                                            |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `AgentPassportINFT`    | [`0x08d25653638c3ed40C3b82840fA20CAe9c94563E`](https://chainscan-galileo.0g.ai/address/0x08d25653638c3ed40C3b82840fA20CAe9c94563E) — stays live for 4 minted passports (tokenIds 1-4) |
| `AgentPassportINFTV2`  | [`0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d`](https://chainscan-galileo.0g.ai/address/0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d) — K-1 + K-4 + K-6 fix |
| `CapabilityRegistry`   | [`0x3783f3c4834fCCBD553860e15c64C7E052646a8D`](https://chainscan-galileo.0g.ai/address/0x3783f3c4834fCCBD553860e15c64C7E052646a8D) — stays live for any existing grants |
| `CapabilityRegistryV2` | [`0x1351CD87360f0366D0A0068164e606B3c320F3E1`](https://chainscan-galileo.0g.ai/address/0x1351CD87360f0366D0A0068164e606B3c320F3E1) — B-V2-15 |
| `Erc7857Verifier`      | [`0xEAd66Cb90B681720f3aab52d86c289E21106d938`](https://chainscan-galileo.0g.ai/address/0xEAd66Cb90B681720f3aab52d86c289E21106d938) — V1 verifier reused by AgentPassportINFTV2 |
| `MemoryAccessLog`      | [`0xEe1aDFe76785377C4430B1325d86E58A6eC92119`](https://chainscan-galileo.0g.ai/address/0xEe1aDFe76785377C4430B1325d86E58A6eC92119) — stays live for any existing log entries (chain history im… |
| `MemoryAccessLogV2`    | [`0xCbfE1f526483283Bba80c2Bed3622a56904bF96d`](https://chainscan-galileo.0g.ai/address/0xCbfE1f526483283Bba80c2Bed3622a56904bF96d) — B-V2-16 |
| `ReceiptRegistry`      | [`0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c`](https://chainscan-galileo.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c) — stays live for the existing anchored receipts (chain hist… |
| `ReceiptRegistryV2`    | [`0xf675d4183b34fe8d1981FA9c117065aAcff690ab`](https://chainscan-galileo.0g.ai/address/0xf675d4183b34fe8d1981FA9c117065aAcff690ab) — K-2 fix |
| `ReceiptRegistryV3`    | [`0x7396D536594e2BE833070c7EB441A10906046257`](https://chainscan-galileo.0g.ai/address/0x7396D536594e2BE833070c7EB441A10906046257) — B-V2-32 fix |
| `SkillPricing`         | [`0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F`](https://chainscan-galileo.0g.ai/address/0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F) — FINAL_BUILD_PLAN |
| `SkillRegistry`        | [`0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1`](https://chainscan-galileo.0g.ai/address/0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1) — stays live for existing skill registrations (chain histor… |
| `SkillRegistryV2`      | [`0xF05113E83146160024326ff30979c57f5adc2193`](https://chainscan-galileo.0g.ai/address/0xF05113E83146160024326ff30979c57f5adc2193) — B-V2-17 |
| `SkillRunPayment`      | [`0x9eA5FDba913AC94dA8833Fee21F2832827950A5C`](https://chainscan-galileo.0g.ai/address/0x9eA5FDba913AC94dA8833Fee21F2832827950A5C) — FINAL_BUILD_PLAN |
| `SubscriptionEscrowV2` | [`0x74235b707194c4cc3DDb717B6D95595e8A82B7F5`](https://chainscan-galileo.0g.ai/address/0x74235b707194c4cc3DDb717B6D95595e8A82B7F5) — B-V2-18 |
<!-- contracts:auto:end -->

### Phase B · Aristotle mainnet (chainId 16661)

<!-- numbers:auto:mainnet.deployedContractsToday -->10<!-- /numbers:auto:mainnet.deployedContractsToday --> contracts deployed on **2026-05-15**. <!-- numbers:auto:mainnet.receiptsAnchored -->41<!-- /numbers:auto:mainnet.receiptsAnchored --> receipts anchored on mainnet `ReceiptRegistryV3` + `ReceiptRegistryV2`, spanning all <!-- numbers:auto:receiptTypes.count -->13<!-- /numbers:auto:receiptTypes.count --> receipt-type slots. Total deploy spend ~0.085 OG across 10 transactions; deployer wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`.

<!-- contracts:auto:mainnet:start -->
| Contract              | Address                                                                                                                                            |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `AgentPassportINFTV2`  | [`0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad`](https://chainscan.0g.ai/address/0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad) |
| `CapabilityRegistryV2` | [`0x41fEad4b86DE042845D25Be71aae857E19a8089E`](https://chainscan.0g.ai/address/0x41fEad4b86DE042845D25Be71aae857E19a8089E) |
| `Erc7857Verifier`      | [`0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c`](https://chainscan.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c) |
| `MemoryAccessLogV2`    | [`0xA2c3420242aE2BdD7e0970B1DfB28b3055DC4E65`](https://chainscan.0g.ai/address/0xA2c3420242aE2BdD7e0970B1DfB28b3055DC4E65) |
| `ReceiptRegistryV2`    | [`0x27a54F64F3A8578B39fE1E61dF7014813F325adf`](https://chainscan.0g.ai/address/0x27a54F64F3A8578B39fE1E61dF7014813F325adf) |
| `ReceiptRegistryV3`    | [`0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297`](https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297) |
| `SkillPricing`         | [`0x08d25653638c3ed40C3b82840fA20CAe9c94563E`](https://chainscan.0g.ai/address/0x08d25653638c3ed40C3b82840fA20CAe9c94563E) |
| `SkillRegistryV2`      | [`0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde`](https://chainscan.0g.ai/address/0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde) |
| `SkillRunPayment`      | [`0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A`](https://chainscan.0g.ai/address/0xf8085B43a08e957Fea157394dbB0d3EB76A1cD6A) |
| `SubscriptionEscrowV2` | [`0x937cfE76dEdB25CCf6c7C56fF16F53270794311e`](https://chainscan.0g.ai/address/0x937cfE76dEdB25CCf6c7C56fF16F53270794311e) |
<!-- contracts:auto:mainnet:end -->

Sample mainnet receipt anchor transactions (open from any machine, no auth):

- Receipt 0 · `quick` tier · tx [`0xd9a48ded…`](https://chainscan.0g.ai/tx/0xd9a48dedd80b88f166da56988c6b3923925476491eb6805dd6e87e0d351d4482)
- Receipt 1 · `standard` 3-role · tx [`0xbc40fd41…`](https://chainscan.0g.ai/tx/0xbc40fd41c0ff4af78af91dcd598d3618b9c8bd7995069143e58d46c1886e8743)
- Receipt 2 · `high-stakes` 5-role · tx [`0x280d4548…`](https://chainscan.0g.ai/tx/0x280d45489569a5ee5c927f064e26465857e54f0b8dd35d09678dd8938c07ac29)

---

## Visual tour

Six canonical surfaces a judge sees on the live production deploy at https://ivaronix.vercel.app (Aristotle mainnet, chainId 16661):

| # | Surface | Path |
|---|---|---|
| 01 | Home + Run panel | `screenshots/readme/01-home.png` |
| 02 | Run panel mid-flight, four-light row pending | `screenshots/readme/02-runpanel-mid.png` |
| 03 | Receipt page `/r/<id>` with TIER 1 + ANCHORED chips | `screenshots/readme/03-receipt-tier1.png` |
| 04 | Burn Mode dialog with `keyFingerprint` | `screenshots/readme/04-burn-mode.png` |
| 05 | Agents leaderboard `/agents` with minted passports | `screenshots/readme/05-agents.png` |
| 06 | Onboard passport-mint flow `/onboard` | `screenshots/readme/06-onboard.png` |

Captures generated by Playwright at 1200×800 @ 2x scale. Refresh against a running Studio dev server via `pnpm screenshots:refresh`.

---

## 11 · What makes Ivaronix different

- **Receipts are independently re-verifiable on a clean machine.** `pnpm ivaronix receipt verify <id> --tee-independent` runs the full 5-step check — schema · hash · signature · chain anchor · live TEE re-attestation via `broker.processResponse`. No account. No wallet. No Ivaronix server.
- **TIER 1 vs TIER 2 is labelled honestly.** Green chip when inference ran inside a TEE-attested 0G Compute provider; amber chip for external providers (NIM / Gemini / OpenAI / Ollama). Both signed and anchored; the page never conflates the two.
- **Receipt hashes are byte-equal across TypeScript, Python, and Rust** — checked on every PR against 29 cross-impl vectors. RFC-8785 is the spec.
- **Creators earn from receipt-bound runs.** Each skill manifest declares `og.creator.fee_split`; the declared split is written to every receipt body. Today, this is enforceable off-chain against the receipt; live atomic OG settlement via `SkillRunPayment.sol` is the v1.1 headline (see §8).
- **Proof links work without an account.** `/r/<id>` renders the four-light evidence row, the TIER chip, the anchor tx link, and the key fingerprint to anyone, no wallet, no login.
- **Legal vertical, live cluster on Galileo.** Five legal skills (`private-doc-review` · `contract-renewal-clause-detector` · `nda-triage-reviewer` · `term-sheet-risk-scanner` · `legal-citation-verifier`) deployed on `SkillRegistryV2` with schema-aware output validation. Receipt body carries the model's structured findings in `outputs.parsed.data` plus the schema-pass/fail flag.

---

## 12 · Memory primitive

`MemoryEngine` is an encrypted hybrid memory layer (vector similarity + FTS keyword, AES-256-GCM at rest with fresh per-call nonce), wired to `CapabilityRegistryV2` (on-chain grants) and `MemoryAccessLogV2` (on-chain access trail). Portable across machines via `memory stream-id` — a deterministic 0G KV stream-ID derived from any wallet.

```bash
ivaronix memory remember "Vendor X's contract has a 90-day notice asymmetry" --tags work,legal
ivaronix memory recall  "asymmetric notice clauses" --top-k 5
ivaronix memory grant   0xPartner --scope "memory:work" --expires 1735689600
ivaronix memory log     --agent $IVARONIX_WALLET_ADDRESS --limit 10
```

Every memory write anchors a `memory_access` receipt by default — a memory write isn't just stored, it's attested. Same applies to reads and grants.

Ten sub-commands: `remember` · `recall` · `forget` · `grant` · `revoke` · `list` · `log` · `log-emit` · `stream-id` · `snapshot`. Studio `/memory` mirrors the surface with SIWE-gated grant management and a real-time event feed from `MemoryAccessLogV2`.

---

## 13 · Documentation

| Doc | Purpose |
|---|---|
| [docs/JUDGE_GUIDE.md](docs/JUDGE_GUIDE.md) | 5-minute demo path for OG APAC judges |
| [docs/PITCH.md](docs/PITCH.md) | 3-page non-technical pitch |
| [Ivaronix_Whitepaper.pdf](Ivaronix_Whitepaper.pdf) | Technical whitepaper (PDF, May 2026) |
| [HLD.md](HLD.md) | High-level architecture |
| [PRD.md](PRD.md) | Product requirements |
| [RECEIPTS_SPEC.md](RECEIPTS_SPEC.md) | Canonical receipt JSON schema |
| [docs/HASH_FUNCTION.md](docs/HASH_FUNCTION.md) | RFC-8785 canonical receipt hash spec |
| [docs/MAINNET_READINESS.md](docs/MAINNET_READINESS.md) | 13/13 mainnet-readiness checklist |
| [docs/RECEIPT_SCHEMA.md](docs/RECEIPT_SCHEMA.md) | Receipt field-level reference |
| [docs/CRYPTO_NOTES.md](docs/CRYPTO_NOTES.md) | Threat models for every primitive |
| [docs/AAT_MAPPING.md](docs/AAT_MAPPING.md) | IETF Agent Audit Trail draft mapping |
| [docs/PHASE_B_DISCLOSURES.md](docs/PHASE_B_DISCLOSURES.md) | Half-baked surfaces — what shipped, what's queued |
| [docs/PRIVACY_NOTES.md](docs/PRIVACY_NOTES.md) | Operator-as-proxy threat model |
| [SECURITY.md](SECURITY.md) | What the receipt system defends · what it does NOT |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Pre-PR command list, commit conventions, audit-trailer convention |
| [BRAND.md](BRAND.md) | Brand-asset license (separate from MIT code grant) |
| [CHANGELOG.md](CHANGELOG.md) | Audit-fix ledger with `Closes audit <ID>` trailers |
| [UI_UX_GUIDE.md](UI_UX_GUIDE.md) | Visual contract, design tokens, brand reference |

---

## License & contact

Code: MIT. Brand assets: see [BRAND.md](BRAND.md) (separate grant — for fork/widget-embedding terms).

Open source at [github.com/Pratiikpy/ivaronix](https://github.com/Pratiikpy/ivaronix). Contributions, audits, and partnership inquiries welcome.

---

*Submission for the 0G APAC Hackathon · May 2026 · Track 1 (Agentic Infrastructure) primary · Track 3 (Agentic Economy) automatic-secondary.*
