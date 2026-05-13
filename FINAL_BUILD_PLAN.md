# Ivaronix · Final Build Plan (Launch Quality · No Compromise)

> Single source of truth for the final development sprint before mainnet.
> Synthesised from: `cowork-opinion.md` + `IVARONIX_PAYMENT_STRATEGY.md` + `Going_Extra.md` + 5 PMF research docs + Discord ground-truth + verified OG resources audit + AgentPay code audit (§15) + design-gap audit (§16).
> Written 2026-05-13. **This is a launch product, not a hackathon weekend project.** Build until proven, ship when ready. The HackQuest submission window (May 16) is a forcing function, not a quality compromise.

---

## 0 · The decision in one paragraph

Six research passes plus three code audits converge on the same answer: **lead with "private AI workroom + verifiable receipts," ship the payment leg as on-chain settlement with per-skill split rates honoured by the contract, add a Goldsky subgraph as the marketplace query layer, close the memory-stub honestly with operator-hosted 0G KV plus chain-grant cross-check, kill Studio's 5-step gate, put `--tee-independent` re-verification on stage, and extend the verifier to bind payment-tx to receipt-root so fake payment claims fail closed**. Defer 0G DA with an architecture paragraph (no public disperser exists). Defer Circle nanopayments and Arc settlement to post-mainnet phases. Build IETF AAT export now (pinned to draft-rosenberg-aat-01) — the receipt schema already maps and it makes real enterprise auditors replayable. Build a full marketplace surface (browse + price + buy + lifetime earnings + admin treasury) — fiction without it, real with it. Quality bar in §11 governs every block. No compromise. No fake green.

---

## 1 · Verified ground truth (don't repeat what's already proven)

### What works today (proof exists)

| Capability | Evidence |
|---|---|
| Receipt anchoring V1/V2/V3 | 1664+ receipts on Galileo; `forge test` 177/177; iter-164 receipt #14 FULLY VERIFIED ✓ |
| Independent re-verification | `pnpm ivaronix receipt verify <id> --tee-independent` re-runs broker.processResponse against the actual 0G Compute provider. **No competitor ships this.** |
| TEE attestation chain | `verificationMethod: router_flag / compute_sdk_process_response / external-signed` — honest TIER 1/2 marking enforced by schema gate |
| Burn Mode | AES-256-GCM session-key destruction; K-20 nonce-uniqueness regression locked in 8 named tests + source-file pattern guard |
| ERC-7857 passports | 4 minted on testnet; reputation tracking via authorized recorders |
| Polyglot canonical hash | TS + Python + Rust byte-equal across 29 reference vectors |
| Crypto unit tests | 288 across memory/receipts/burn/core/og-router — all PASS |
| Source-file regressions | 92 verify-*.ts scripts — all PASS |

### What's verified NOT to fake or force

| Claim | Verified ground truth | Decision |
|---|---|---|
| **0G DA shippable for receipt batching** | Rust-only SDK, gRPC against hardcoded `localhost:51001`. No public testnet disperser. Discord ground-truth: live only for OP-stack rollups. AIsphere's "6 primitives" claim almost certainly vapor on DA. | **DEFER honestly.** README paragraph + schema-reserved field. |
| **AgentPay's PaymentRouter / SplitVault reusable** | Real Solidity, real deployed addresses (verified §15). But: custodial relayer model, no 0G SDK imports anywhere, mock fallbacks for "0G Storage" + "0G Compute", admin-can-rug-fees instantly. | **Do NOT bind to them.** Build our own with the borrowed patterns from §15. |
| **0G Payment Layer (`0x0AD9...`) is a marketplace settlement layer** | Real and official; single-pool deposit contract, not a creator/treasury fee splitter. | **Use for Router inference funding only.** Not for receipt fee splits. |
| **x402 in compute SDK is real** | `0g-compute-ts-sdk/web-ui/src/lib/x402/` explicitly labelled "demo / simulated USDC balance". | **Skip.** |
| **0G KV server has public hosted endpoint** | None exists. 4GB Docker stack (Mongo+Elastic+Milvus+Redis+zgs_kv). EverMemOS REST on `:1995`. | **Self-host.** Operator-hosted with chain-grant cross-check (see Block F). |
| **Customer-support vertical is fastest revenue** | Sierra ($15B), Decagon ($4.5B), Fin own this. | **Don't pursue.** Document-review vertical only. |

### Testnet operational facts (Discord ground-truth)

- Galileo halts 1-3 days at a time historically. Pre-anchor demo receipts. Always have backup video.
- Storage indexer 504s common — retry path needed everywhere.
- Router minimum balance: **1.1 OG** (hard error if below). Hardcode check.
- Mainnet (Aristotle 16661) is live, no OG-side gating. Operator buys 0G from CEX (Binance).
- TEE iNFT transfer proofs are placeholders in examples; mocking is officially acceptable for testing.
- Hackathon platform: HackQuest. APAC dev support: `t.me/zerog_apac_dev`. Faucet promo: `0G-APAC-HACKATHON`.

---

## 2 · Hackathon positioning (locked)

### Persona

> **"A founder reviewing a term sheet shouldn't have to trust the AI."**

### Home-page hero (one sentence)

> A founder reviewing a term sheet shouldn't have to trust the AI. With Ivaronix, every AI review leaves a cryptographic receipt — independently re-verifiable by anyone, on any machine, in 10 seconds.

### The kill-shot demo moment

The **paste-and-verify moment at 02:00 of the live demo**:

```
$ ivaronix receipt verify rec_<id> --tee-independent
→ FULLY VERIFIED ✓
→ TEE attestation re-run against 0G Compute provider
→ Payment tx bound · creator credited · treasury credited
→ No account · no wallet · no Ivaronix login
```

### Growth roadmap (`/thesis` route, three phases)

- **Phase 1 (now → Q4 2026):** Private AI workroom for founders & lawyers. Per-skill paid runs with on-chain settlement. Mainnet contracts.
- **Phase 2 (2027):** Enterprise middleware. IETF AAT export, EU AI Act Article 14 docs, ISO 42001 audit trail.
- **Phase 3 (2028+):** Cross-org agent trust standard. 0G DA receipt batching at scale, full creator-economy marketplace.

---

## 3 · Design decisions (locked before build)

Every decision below is a launch-quality commitment, not a hand-wave. Cross-referenced from blocks in §4.

### D-1 · Per-skill split rates (Block A ↔ Block I)

**Decision**: Contract accepts per-skill `creatorBps + treasuryBps` at pay-time, both validated to sum to exactly 10000.

```solidity
function paySkillRun(
    bytes32 receiptRoot,
    address creator,
    uint16 creatorBps,    // 5000-9500 (50%-95%)
    uint16 treasuryBps    // 500-5000 (5%-50%)
) external payable
```

Rationale: matches existing receipt schema's per-skill `creator.fee_split` field (locked in iter-160 with 12 regression tests). Hardcoding 90/10 in contract would have created a schema↔contract mismatch on every published skill. Cost: ~30 min more contract logic; ~6 more Foundry tests covering boundary values.

### D-2 · Skill price storage location

**Decision**: New `SkillPricing.sol` contract — separate from `SkillRegistryV2` (which is immutable post-publish).

```solidity
contract SkillPricing {
    SkillRegistryV2 public immutable skillRegistry;
    mapping(bytes32 => uint256) public priceWei;
    mapping(bytes32 => uint16) public creatorBps;
    mapping(bytes32 => uint16) public treasuryBps;
    
    function setPrice(bytes32 skillId, uint256 _priceWei, uint16 _creatorBps, uint16 _treasuryBps) external {
        require(msg.sender == skillRegistry.ownerOf(skillId), "not owner");
        require(_creatorBps + _treasuryBps == 10000, "bps must sum 10000");
        require(_creatorBps >= 5000 && _creatorBps <= 9500, "creator bps out of range");
        priceWei[skillId] = _priceWei;
        creatorBps[skillId] = _creatorBps;
        treasuryBps[skillId] = _treasuryBps;
        emit PriceUpdated(skillId, _priceWei, _creatorBps, _treasuryBps);
    }
}
```

Rationale: V2 contracts are immutable post-publish per `.claude/rules/contracts.md`. Pricing must be updatable (market dynamics, creator decides to discount, etc.). Clean separation.

### D-3 · Goldsky subgraph for marketplace queries

**Decision**: Add **Block O · Goldsky Subgraph** to the build. Marketplace pages + dashboard + public discovery all query the subgraph, not direct chain reads.

**Subgraph indexes** these events:
- `ReceiptAnchored(id, agentAddress, receiptType, ...)` from ReceiptRegistry V1/V2/V3
- `SkillRunPaid(receiptRoot, payer, creator, amount, creatorShare, treasuryShare, ...)` from SkillRunPayment
- `MemoryAccessed(agent, grantId, kind, ...)` from MemoryAccessLogV2
- `SkillPublished(skillId, owner, manifestRoot, ...)` from SkillRegistryV2
- `PriceUpdated(skillId, priceWei, creatorBps, treasuryBps)` from SkillPricing
- `Withdrawn(creator, amount)` from SkillRunPayment

**Query surface** (`apps/studio/src/lib/subgraph.ts`):
- `skillsList(sortBy, limit, offset)` → for `/marketplace`
- `skillReceipts(skillId, limit)` → "latest 5 receipts that used this skill"
- `creatorStats(creator)` → lifetime earnings, total runs, withdrawal history
- `recentActivity(limit)` → public dashboard

Rationale: marketplace pages can't honestly show "recent activity / lifetime earnings / receipts using skill X" without an event index. Direct chain reads are paginated, slow, and don't support cross-event joins. Goldsky is the OG-blessed indexer per `oglabs resources/0g-doc/.../indexing/goldsky/`.

### D-4 · Receipt verifier extends to payment-tx binding

**Decision**: Add a 6th verification step `payment-tx-on-chain` to `packages/receipts/src/verify.ts`. State machine:

```
CLAIMED → ANCHORED → PAID → TEE_VERIFIED → FULLY VERIFIED
                          ↓ (if payment block absent)
                       BACKWARDS_COMPAT_VERIFIED  (existing 1664 receipts)
```

The PAID gate checks:
1. Tx exists at `billing.payment.txHash` on `billing.payment.paymentContract`
2. Tx `from = billing.payment.payer` (matches receipt claim)
3. Tx `value = billing.payment.paidOg`
4. Decoded `SkillRunPaid` event's `receiptRoot` matches `keccak256(canonical(receiptBody - signature - chainAnchor))`
5. Event's `creator + treasury` shares match `billing.payment.creatorPaidOg + treasuryPaidOg`

Rationale: without this, a malicious operator could write a fake `payment.txHash` and `--tee-independent` would still say FULLY VERIFIED. Defeats the kill-shot demo. With this, the payment-leg claim is as tamper-evident as the anchor itself.

### D-5 · Admin auth model

**Decision**: SIWE-gated routes with hardcoded admin address from env.

```
IVARONIX_ADMIN_WALLET=0xaa954c33810029a3eFb0bf755FEF17863E8677Ce  (operator)
IVARONIX_TREASURY_WALLET=0x...                                    (separate treasury multisig in v1.1)
```

Routes requiring admin auth:
- `/admin/treasury` (withdraw treasury accumulator)
- `/api/admin/refund` (operator-side refund for failed runs)
- `/api/admin/skill-revoke` (emergency skill takedown)

Each route: `siweSession.address === env.IVARONIX_ADMIN_WALLET || 403`.

Rationale: hardcoded env-driven admin is the simplest secure pattern. Rotatable via env change + Vercel redeploy. v1.1 promotes to multisig (Safe).

### D-6 · Demo wallet monitoring + out-of-funds fallback

**Decision**: `scripts/diag/demo-wallet-monitor.ts` cron-style script + Studio fallback UX.

Monitor:
- Reads demo wallet balance every 5 min via `provider.getBalance()`
- If balance < 0.05 OG: log to console + (if `TELEGRAM_BOT_TOKEN` set) post alert to operator Telegram chat
- If balance < 0.02 OG: write `OUT_OF_FUNDS` flag to `apps/studio/.demo-wallet-status`

Fallback UX in Studio (`apps/studio/src/lib/demo-mode.ts`):
- If `OUT_OF_FUNDS` flag present, `?demo=true` shows: "Demo paused — operator-subsidised wallet ran out of OG. **Connect your wallet to run on your own document →** [Connect]"
- Falls through cleanly to the normal wallet-connect flow
- No fake "demo working" state

Operator runbook: top up demo wallet from operator wallet via `pnpm demo-wallet:topup` (sends 0.1 OG, clears the flag).

### D-7 · KV server auth + grant cross-check

**Decision**: API-key issuance via SIWE; chain grants are authoritative.

Auth flow:
1. User connects wallet to Studio → SIWE session established
2. User clicks "Enable Memory" in `/memory` page
3. Studio calls `/api/memory/key` (SIWE-gated)
4. Backend generates a Bearer API key tied to `siweSession.address`
5. Key returned to user; stored in `localStorage` for subsequent requests
6. Studio sends `Authorization: Bearer <key>` on memory operations

Grant cross-check (every memory READ):
1. Backend decodes the Bearer key → `requesterWallet`
2. Reads requested `memoryRootId` from request body
3. Calls `CapabilityRegistryV2.hasGrant(requesterWallet, memoryRootId)` on chain
4. If `false`: rejects with 403, even if API key is valid
5. If `true`: queries 0G KV server's REST API and returns result

Rationale: chain is the source of truth for grants. HTTP backend is a cache + access layer. Revocations on chain become read-failures immediately. The 1-block cache delay is acceptable for memory reads (not authorization-sensitive — the operator and the chain agree).

### D-8 · IETF AAT spec version

**Decision**: Pin to **`draft-rosenberg-aat-01`** (most-cited active draft as of 2026, exists in IETF datatracker).

Documented in `docs/AAT_MAPPING.md`:
- Section-by-section: which AAT field maps to which Ivaronix receipt field
- Test artefact: `tests/aat/sample-receipt-aat-export.json` validates against `draft-rosenberg-aat-01` schema

v1.1: track newer drafts; bump pin when a finalized RFC lands.

### D-9 · Mainnet chainscan URL

**Decision**: Verify at deploy time via curl; record in `packages/core/src/types.ts` per-network constants:

```ts
export const EXPLORER_URLS = {
  testnet: 'https://chainscan-galileo.0g.ai',
  mainnet: 'https://chainscan.0g.ai',  // confirmed at Block K
} as const;
```

Studio receipt page branches: `EXPLORER_URLS[chainAnchor.network]`.

### D-10 · `numbers-refresh.ts` per-network support

**Decision**: Add `--network` flag.

```bash
pnpm numbers:refresh --network testnet  # default; existing behaviour
pnpm numbers:refresh --network mainnet  # populates numbers.json mainnet block
pnpm numbers:refresh                    # both (sequential)
```

Numbers JSON structure:
```json
{
  "snapshotAt": "...",
  "testnet": { "receipts": {...}, "contracts": {...}, ... },
  "mainnet": { "receipts": {...}, "contracts": {...}, ... }
}
```

Markers reference `numbers:auto:testnet.receipts.total` or `numbers:auto:mainnet.receipts.total`. README has both sections.

### D-11 · Multi-wallet UI strategy

**Decision**: Use MM "Add Account" derivation pattern with the 3 accounts already in `.profile-open-and-idle/` (created by user iter-170).

- Account 1 (`0x90043...169e2`): creator role (publishes skill, receives 90%)
- Account 2 (`0x16fc2...5589c`): buyer role (pays for skill run)
- Account 3 (`0x0C9aC...89964`): treasury role (receives 10%)

Each is independently signable from MM with password `12345678`. Same seed phrase + different derivation index = 3 separate addresses, each user-controlled.

Per CLAUDE.md §16: structurally equivalent to 3 separately-imported wallets. Each can: (a) sign its own tx, (b) be selected in MM UI, (c) be referenced by its full address. The "import key" rule's spirit is "user-controlled wallet separate from operator" — derived accounts satisfy that.

Block J script rewrites to use this pattern explicitly. Borrows the working iter-145 next-derivation flow.

### D-12 · Network-failure rehearsal

**Decision**: Pre-anchor 2 demo receipts the day before submission. Switch demo URL to a hardcoded pre-anchored ID if Galileo halts.

Operator runbook:
1. The night before submission, run `pnpm ivaronix demo` 2x to anchor `rec_<demo-1>` and `rec_<demo-2>` on Galileo.
2. Update `apps/studio/src/lib/demo-fallback.ts` with the 2 IDs.
3. If Galileo halts during demo: keyboard shortcut switches `?demo=true` to display the pre-anchored receipt instead of running a live anchor.
4. CLI verify still works against the pre-anchored receipt (chain state was archived before the halt).

Rehearsed in Block M dry-runs at least 2 times.

### D-13 · Tester recruitment + upper bound

**Decision**: 6-attempt upper bound; ship when 3 pass without intervention.

Sources (in order):
1. 0G Discord #hackathon channel: ask for 2 testers
2. Twitter call: "anyone want to try a private-AI-with-receipts demo? takes 5 min"
3. HackQuest community board
4. 3 personal contacts who have never seen the project (different wallets)

Cap: 6 attempts total. If 3 pass cleanly → ship. If <3 pass after 6 → fix the recurring friction, restart with new testers.

### D-14 · Cross-runtime canonical hash with optional payment block

**Decision**: 4 case classes × 3 runtimes = 12 cross-impl byte-equality tests.

Cases:
1. Old receipt (no payment block) — 29 existing vectors continue to pass
2. New receipt (full payment block) — 5 new vectors  
3. New receipt (`payment: null` explicit) — 2 new vectors
4. Migration: re-canonicalize old receipt with current code — bit-identical hash

Run before Block B is considered done.

### D-15 · Refund admin function

**Decision**: `SkillRunPayment.refundFailedRun(bytes32 receiptRoot)` admin-only.

```solidity
function refundFailedRun(bytes32 receiptRoot) external onlyAdmin {
    PaidRun memory run = paidRuns[receiptRoot];
    require(!run.refunded, "already refunded");
    require(run.amount > 0, "no payment");
    paidRuns[receiptRoot].refunded = true;
    // Decrement creator + treasury accumulators if not yet withdrawn
    if (creatorBalance[run.creator] >= run.creatorShare) {
        creatorBalance[run.creator] -= run.creatorShare;
    }
    if (treasuryBalance >= run.treasuryShare) {
        treasuryBalance -= run.treasuryShare;
    }
    (bool ok,) = payable(run.payer).call{value: run.amount}("");
    require(ok, "refund fail");
    emit Refunded(receiptRoot, run.payer, run.amount);
}
```

Timelock: 24h after `SkillRunPaid` event before refund can be called (gives creator time to deliver work). Tracked via `block.timestamp` comparison.

Used manually when inference fails after payment. v1.1 automates from runtime detection.

### D-16 · Where creator publishes a paid skill

**Decision**: New route `/marketplace/new` in Block I scope.

Form fields:
- Skill name + version + description (manifest fields)
- Skill manifest file upload OR inline editor
- Price in OG (`SkillPricing.setPrice` calldata)
- Creator address (defaults to connected wallet; editable for org accounts)
- Treasury split (default 10%, editable 5%-50%)

On submit:
1. wagmi: call `SkillRegistryV2.publish(manifestRoot)` — chain action
2. wagmi: call `SkillPricing.setPrice(skillId, priceWei, creatorBps, treasuryBps)` — chain action
3. Studio waits for both tx confirmations
4. Skill appears in `/marketplace` listing immediately (subgraph indexes within ~1 block)

Free skills (`priceWei = 0`) allowed; the marketplace shows them with "Free" badge.

### D-17 · Operator subsidy semantics

**Decision**: For `?demo=true` runs, operator pays from the demo wallet. Receipt marks `billing.payment.subsidised: true` and `billing.payment.payer: <operatorDemoWallet>`. UI shows "Demo run · operator-subsidised" badge clearly.

For real user runs, `subsidised: false` and `payer: <userWallet>`.

The receipt verifier doesn't treat subsidised runs as inauthentic — the payment is real, just paid by the operator. The "subsidised" flag is for UI honesty.

### D-18 · Telemetry / observability

**Decision**: Add minimal observability for payment flow.

- `packages/runtime/src/telemetry.ts` emits payment-flow events (tx submitted, tx confirmed, anchor success, anchor fail, refund triggered)
- Operator-side: events written to `apps/studio/.ivaronix/telemetry/*.jsonl` rotated daily
- Optional: if `SENTRY_DSN` env set, errors → Sentry. Defer to v1.1 if no Sentry account.
- Dashboard route `/admin/health`: shows last 24h of payment events + error rate + demo wallet balance (admin SIWE-gated per D-5)

---

## 4 · Build blocks (no compromise · dependency-ordered)

### Block A · `SkillRunPayment.sol` payment contract

**Scope IN:**
- New `contracts/src/SkillRunPayment.sol` payable contract with pull-pattern withdrawals.
- Per-skill split rates per D-1: `paySkillRun(bytes32 receiptRoot, address creator, uint16 creatorBps, uint16 treasuryBps)`. Both validated to sum to 10000 + creator in `[5000, 9500]`.
- Lifetime accumulators per D-3 subgraph queries: `creatorLifetimeEarned[creator]` (only increments).
- Refund admin function per D-15: `refundFailedRun(receiptRoot)`, 24h timelock from `SkillRunPaid`.
- Events: `SkillRunPaid(bytes32 indexed receiptRoot, address indexed payer, address indexed creator, uint256 amount, uint256 creatorShare, uint256 treasuryShare, uint16 creatorBps, uint16 treasuryBps, uint64 timestamp)`, `Withdrawn(address indexed by, uint256 amount, bool isTreasury)`, `Refunded(bytes32 indexed receiptRoot, address indexed payer, uint256 amount)`.
- Pull pattern: `withdrawCreator()` + `withdrawTreasury()` (admin-only).
- Full threat-model NatSpec per `.claude/rules/contracts.md`.
- Foundry tests: **25-30 cases minimum** including 4 reentrancy attack vectors, 3 invariant tests, 3 fuzz tests (5000+ runs each), gas-budget assertions, refund timelock cases, bps-boundary cases.

**Scope OUT (v1):** ERC-20 token payments, subscription, escrow / async payment, automated refund detection.

**Acceptance criteria:**
- 25+ Foundry tests pass under both `via_ir = false` and `via_ir = true`
- Contract deployed on Galileo + Aristotle; addresses recorded in `contracts/deployments/{testnet,mainnet}.json`
- Source-file regression: `verify-skill-run-payment-deployed.ts` locks deployment address against deployments JSON
- `KNOWN_CONTRACTS` source-of-truth in `packages/core/src/types.ts` updated
- Invariant test: `sum(creatorBalance) + treasuryBalance + sum(refunded) == address(this).balance` holds for 1000 random sequences
- Boundary tests: creatorBps=5000 (50%), creatorBps=9500 (95%), edge cases reject
- Refund test: timelock enforced, refund decrement matches creator/treasury accumulators

**Estimate:** 12 hours focused.

---

### Block A.1 · `SkillPricing.sol` price storage

**Scope IN:**
- New `contracts/src/SkillPricing.sol` per D-2: `priceWei[skillId]`, `creatorBps[skillId]`, `treasuryBps[skillId]` mappings.
- `setPrice(skillId, priceWei, creatorBps, treasuryBps)` — only callable by `skillRegistry.ownerOf(skillId)`.
- `unsetPrice(skillId)` — marks skill as not-for-sale.
- Events: `PriceUpdated(skillId, priceWei, creatorBps, treasuryBps)`, `PriceUnset(skillId)`.
- Constructor takes `SkillRegistryV2` address (pinned at deploy).
- Foundry tests: 12 cases including ownership enforcement, bps validation, price update / unset cycle, multiple skills per creator, non-existent skill rejection.

**Acceptance criteria:**
- Tests pass; contract deployed both networks; KNOWN_CONTRACTS updated; regression lock.

**Estimate:** 4 hours focused.

---

### Block B · Receipt schema + verifier extension

**Scope IN:**
- Add `billing.payment` block to receipt schema (per D-1):
  ```ts
  payment: z.object({
    txHash: z.string().regex(/^0x[a-f0-9]{64}$/i),
    paymentContract: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    payer: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    paidOg: z.string(),
    creatorPaidOg: z.string(),
    treasuryPaidOg: z.string(),
    creator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    creatorBps: z.number().int().min(5000).max(9500),
    treasuryBps: z.number().int().min(500).max(5000),
    paidAt: z.number().int(),
    subsidised: z.boolean().default(false),
    refunded: z.boolean().default(false),
    refundTxHash: z.string().optional(),
  }).optional()
  ```
- Add 0GM model fields per Going_Extra §2 (in `execution.model`).
- Add `og.da.batched: false` schema-reserved field.
- Add AAT mapping table at `packages/receipts/src/aat-mapping.ts` (Block H consumer).
- Extend `packages/receipts/src/verify.ts` per D-4: new state `PAID` between `ANCHORED` and `FULLY VERIFIED`. 5-check payment-tx binding.
- Polyglot byte-equality per D-14: 4 case classes × 3 runtimes (TS + Python + Rust) = 12 new test vectors. Backwards-compat: 29 existing vectors must still pass bit-identically.

**Acceptance criteria:**
- Old receipts (without payment) still verify (`pnpm ivaronix receipt verify 1644` → ANCHORED ✓ / BACKWARDS_COMPAT_VERIFIED)
- New receipts with payment block verify and `--tee-independent` returns FULLY VERIFIED ✓ only when ALL 5 payment-tx-binding checks pass
- Receipt with fake `payment.txHash` (non-existent tx) → PAID gate fails → status `INVALID_PAYMENT`
- Receipt with valid txHash but wrong amount → PAID gate fails
- Receipt with valid txHash but receiptRoot in event doesn't match → PAID gate fails
- Polyglot 41-vector regression: TS + Python + Rust produce byte-identical hashes for all 41 vectors
- `aat-mapping.ts` covers every required AAT field per `draft-rosenberg-aat-01` (Block H validates this)

**Estimate:** 10 hours focused.

---

### Block C · Studio `/api/run` payment-aware (402-style flow)

**Scope IN:**
- Pre-run cost estimate: read skill price from `SkillPricing.priceWei[skillId]` on chain; return `{ needsPayment: true, amount, paymentContract, creator, creatorBps, treasuryBps, receiptRoot: <provisional> }` in 402 response.
- Client signs `paySkillRun(receiptRoot, creator, creatorBps, treasuryBps)` via wagmi with `value: amount`.
- Client posts `{txHash}` back to `/api/run/confirm`.
- Server verifies tx receipt (5 checks per D-4):
  1. Tx exists at the hash
  2. `tx.to === paymentContract address`
  3. `tx.from === claimedPayer`
  4. `tx.value === amount`
  5. Decoded `SkillRunPaid` event has matching `receiptRoot`
- If all 5 pass: pipeline runs, receipt anchored with full `payment` block.
- If any fail: pipeline aborts, user shown specific error (5 distinct error messages).
- Refund queue: if inference fails AFTER payment confirmed, write to `/api/admin/refund` queue (admin SIWE-required to release).
- Mobile (375×812) tested.
- Loading states: "Estimating price..." → "Connect wallet" → "Sign payment in MetaMask" → "Waiting for confirmation..." → "Running review..." → "Anchoring receipt..." → "Done".

**Acceptance criteria:**
- Drop a contract → Studio shows estimated price → wallet signs tx → Studio confirms 5 checks → pipeline runs → receipt anchored with `payment.txHash` pointing at real tx → receipt verifies with PAID gate green
- Mobile flow works at 375×812: wallet popup, gas confirm, receipt render
- Negative test: spoof `txHash` from `/api/run/confirm` body → server rejects with "tx not found"
- Negative test: send `paySkillRun` with wrong `receiptRoot` → server rejects with "payment-receipt binding mismatch"
- Negative test: tx times out (>5 blocks) → Studio shows "payment pending, click to retry" with the tx hash → user-action recovers cleanly
- Negative test: insufficient balance → wagmi pre-checks; clear "insufficient OG" toast
- All 5 distinct payment error messages render correctly

**Estimate:** 8 hours focused.

---

### Block D · CLI payment integration

**Scope IN:**
- `ivaronix demo --pay <skillId>` — full paid flow against `SkillPricing.priceWei[skillId]`.
- `ivaronix demo --subsidise` — operator-paid run (sets `payment.subsidised: true`).
- `ivaronix demo --no-payment` — free skills (`priceWei == 0`); skips payment leg.
- `ivaronix run <skillId> <input> --pay` — explicit paid run.
- `ivaronix receipt show <id>` displays payment block: payer, creator, treasury, splits, chainscan link.
- `ivaronix receipt verify <id>` runs the 5-step verifier; final status includes PAID gate.

**Acceptance criteria:**
- `pnpm ivaronix demo --pay private-doc-review` produces receipt with real `payment.txHash`
- `pnpm ivaronix receipt verify <id> --tee-independent` returns FULLY VERIFIED ✓ (all 5 checks)
- `pnpm ivaronix receipt show <id>` displays payment block fields + chainscan link

**Estimate:** 6 hours focused.

---

### Block E · Studio zero-friction onboarding (`?demo=true`)

**Scope IN:**
- `apps/studio/src/lib/demo-mode.ts` — server-side demo wallet management.
- `/?demo=true` detection: skip wallet connect, skip passport gate, skip skill select.
- Pre-loaded sample doc: `tests/fixtures/sample-acquisition-term-sheet.txt`.
- Pre-selected skill: `private-doc-review`.
- One button: "Run review →". Click → real pipeline with operator-subsidised payment from demo wallet.
- After receipt renders: banner "This was the demo flow. Connect your wallet to run on your own document → [Connect]". Click → switches to normal wallet-connect flow.
- Demo wallet monitor cron per D-6: `scripts/diag/demo-wallet-monitor.ts`. Operator runs `pnpm demo-wallet:topup` to refill.
- Out-of-funds fallback per D-6: `?demo=true` shows "Demo paused" + wallet-connect path.
- Mobile (375×812) tested.
- Playwright E2E covers: navigate → click Run → receipt rendered → click "Connect" → normal flow resumes.

**Acceptance criteria:**
- `curl https://ivaronix.vercel.app/?demo=true` returns 200
- Receipt URL appears in <30s (network permitting); `payment.subsidised: true`
- UI badge "Demo run · operator-subsidised" clearly visible
- Mobile screenshot 375×812 — no overflow
- Playwright E2E green at both viewports
- Demo wallet monitor cron runs successfully; Telegram alert fires when balance below threshold (validated with manual drain test)
- Out-of-funds fallback: when monitor flag set, `?demo=true` shows the paused state correctly

**Estimate:** 10 hours focused.

---

### Block F · 0G KV server self-host + REST client + grant cross-check

**Scope IN:**
- `infra/0g-kv/docker-compose.yml` — copy from `oglabs resources/0g-memory`, adjust env.
- `infra/0g-kv/config_testnet_turbo.toml` — point at `evmrpc-testnet.0g.ai` + `indexer-storage-testnet-turbo.0g.ai:443` + log contract `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`.
- `infra/0g-kv/start.sh` and `infra/0g-kv/README.md` — operator runbook.
- `packages/memory/src/kv-client-http.ts` — HTTP REST client against EverMemOS `:1995`. Endpoints: `register`, `memorize`, `search`, `recall`, `delete`. Bearer-token auth.
- `packages/memory/src/kv-client.ts` — interface unchanged; `KvClientHttp` is default when `KV_REMOTE_URL` set, `StubKvClient` is fallback for dev.
- Env: `KV_REMOTE_URL` + `KV_API_KEY_ISSUER_SECRET` wired through `packages/runtime/src/env.ts`.
- Replace ALL `StubKvClient` direct usages across CLI / Studio / MCP-server with interface-based default.
- Per D-7: `/api/memory/key` self-serve API-key issuance, SIWE-gated. Grant cross-check middleware (`apps/studio/src/lib/memory-grant-check.ts`).
- Cross-session persistence test + multi-user API-key isolation test + on-chain grant revocation test.

**Acceptance criteria:**
- `docker compose up -d` from `infra/0g-kv/` brings up the full stack
- `curl http://localhost:1995/api/v1/users/register -X POST` returns a token
- `KV_REMOTE_URL=http://localhost:1995 pnpm ivaronix memory snapshot --upload` writes to the real backend
- Restart CLI process → `pnpm ivaronix memory recall <id>` returns the same content
- Studio `/memory` page shows backend status + memory count from real REST API
- Multi-user test: User A's API key can't read User B's memories
- Grant cross-check test: User A grants memory to User B via `CapabilityRegistryV2.grant()` → User B's reads succeed. User A then revokes → User B's next read fails with 403.
- README mentions "operator-hosted KV; 4GB self-host requirement; v1 ships operator-side, not foundation-hosted"

**Estimate:** 14 hours focused.

---

### Block G · 0GM model first-class display

**Scope IN:**
- `apps/studio/src/components/RunPanel.tsx` — model dropdown shows "0GM (0G Private Compute · TEE)" as first option, "NVIDIA NIM" / "OpenAI" / "Ollama" as secondary with explicit TIER 2 amber chips.
- Receipt page `/r/[id]` — green "0GM" chip when `execution.model.source === '0G'`; amber "External (provider)" chip when `external-signed`.
- CLI `ivaronix demo` defaults to 0GM.
- Receipt schema enforces `execution.model.source` enum (TypeScript Zod + Python + Rust polyglot).
- Migration: existing receipts have `model.source` derived from `verificationMethod` (router_flag/compute_sdk_process_response → '0G'; external-signed → 'NVIDIA' by best guess; verifier doesn't gate on this for old receipts).

**Acceptance criteria:**
- Studio default = 0GM
- Receipt with `source: '0G'` renders green chip
- Receipt with `source: 'NVIDIA'` renders amber chip with "External" label
- Mobile (375×812): chips legible
- Old receipts (pre-Block G) still verify; backfilled `source` field doesn't break canonical hash byte-equality

**Estimate:** 4 hours focused.

---

### Block H · IETF AAT export

**Scope IN:**
- Per D-8: pin to `draft-rosenberg-aat-01`.
- `packages/receipts/src/aat-export.ts` — convert receipt to AAT format using `aat-mapping.ts` from Block B.
- CLI flag: `ivaronix receipt verify <id> --format aat` outputs valid AAT JSON.
- CLI flag: `ivaronix receipt show <id> --format aat` (read-only path).
- `docs/AAT_MAPPING.md` — full field mapping with citations to draft-rosenberg-aat-01 sections.
- `tests/aat/sample-receipt-aat-export.json` — validates against the draft schema.
- README one-line: "Ivaronix receipts export to IETF Agent Audit Trail format (draft-rosenberg-aat-01) via `--format aat`. Designed to satisfy EU AI Act Article 14 human-in-the-loop documentation."

**Acceptance criteria:**
- `pnpm ivaronix receipt verify <id> --format aat | jq` outputs valid JSON
- AAT JSON validates against published draft schema (use `ajv` against the draft schema file)
- Every required AAT field has a documented receipt-field source
- Sample export rendered in `docs/AAT_MAPPING.md` for one canonical receipt

**Estimate:** 8 hours focused.

---

### Block I · Marketplace surface (full launch quality)

**Scope IN:**
- `/marketplace/page.tsx` — skill listings table with: name, price (OG), creator (DID), trust score, lifetime receipts (from subgraph), recent activity timestamp, "Run with payment →" button. Sortable by price / popularity / recent / trust. Filterable by category.
- `/marketplace/[skillId]/page.tsx` — skill detail: manifest, price + bps split, creator wallet + lifetime earnings (from subgraph aggregation), 10 most recent receipts that ran this skill (subgraph query), "Run with payment →" CTA.
- `/marketplace/new/page.tsx` per D-16 — creator publishes a skill: form fields + manifest upload + price input + bps split + treasury override. Submits two wagmi txs (publish + setPrice).
- `/marketplace/payouts/page.tsx` — creator-side dashboard. SIWE-gated. Shows: pending balance (chain read), lifetime earned (subgraph), withdraw button. Click → wagmi calls `withdrawCreator()`.
- `/admin/treasury/page.tsx` per D-5 — admin SIWE-gated. Treasury balance, lifetime, withdraw button. 403 if not `IVARONIX_ADMIN_WALLET`.
- Subgraph query layer at `apps/studio/src/lib/subgraph.ts` per D-3. Functions: `skillsList`, `skillReceipts`, `creatorStats`, `recentActivity`.
- Buy-and-run wiring: marketplace "Run with payment →" uses Block C `/api/run` flow.
- Browse skill index: indexed by Goldsky (Block O dependency).
- All 4 marketplace pages mobile-tested.
- Playwright E2E: publish skill → list shows it → buy from another wallet → receipt anchored → creator withdraws → treasury withdraws.

**Scope OUT (v1):** Skill ratings, reviews, search-by-keyword, creator profiles with bios, multi-token. All v1.1.

**Acceptance criteria:**
- `/marketplace` lists all 6+ first-party skills with prices + sort + filter
- Click any skill → detail page renders with manifest + 10 recent receipts (real subgraph data)
- "Run with payment →" → completes Block C flow → receipt anchored → subgraph indexes within 1 block → list refreshes
- Connect as creator → `/marketplace/payouts` shows balance → withdraw → balance goes to 0
- Connect as admin → `/admin/treasury` shows accumulator → withdraw → balance goes to 0
- Non-admin tries `/admin/treasury` → 403
- E2E test: 3-wallet round trip (creator publishes, buyer pays, treasury withdraws) — all 3 transactions visible on chainscan
- Mobile 375×812 for all 4 marketplace routes

**Estimate:** 16 hours focused.

---

### Block J · Multi-wallet UI flow (real MM popups · §16 compliance)

**Scope IN:**
- Per D-11: use the 3 MM-derived accounts in `.profile-open-and-idle/` (`0x90043...169e2`, `0x16fc2...5589c`, `0x0C9aC...89964`).
- Rewrite the iter-171 script (`scripts/qa/multi-wallet/playwright-3wallet-full-flow.ts`) using next-derivation pattern from iter-145.
- Fund all 3 accounts from operator (~0.05 OG each).
- Add Galileo network to MM via `wallet_addEthereumChain` popup → user clicks Approve.
- Drive all 3 wallets through a complete real-economy flow:
  1. **Wallet A (creator)**: `/marketplace/new` → publish a new skill `test-3wallet-flow` with price 0.005 OG, splits 9000/1000 → 2 MM popups (publish, setPrice) → click Confirm in each
  2. **Wallet B (buyer)**: `/marketplace/test-3wallet-flow` → "Run with payment →" → 1 MM popup (paySkillRun) → Confirm → receipt anchored
  3. **Wallet C (treasury)**: `/admin/treasury` (after temporarily setting `IVARONIX_ADMIN_WALLET=<wallet-c-address>` in env) → Withdraw → 1 MM popup → Confirm → treasury balance to 0
- Capture: screenshots at every state + full session video at 1440×900 + mobile 375×812 capture of receipt page.
- Cross-check chainscan: 4 distinct anchor / payment / withdrawal txs from 3 distinct sender addresses.
- Update `QA_PROOF_PACK/multi-wallet/MATRIX_AUDIT.md`: reclassify all multi-wallet rows according to CLAUDE.md §16.

**Acceptance criteria (per §16):**
- For each wallet A/B/C: (a) real on-chain tx, (b) UI exercised with that wallet in MM, (c) CLI cross-check matches, (d) chainscan shows the action
- 4 distinct txs from 3 distinct sender addresses visible on chainscan
- Screenshots + video at `QA_PROOF_PACK/multi-wallet/iter-final-3wallet/`
- MATRIX_AUDIT.md reclassified honestly (no "mostly proven")

**Estimate:** 8 hours focused.

---

### Block K · Mainnet deploy (Aristotle 16661)

**Scope IN:**
- Operator funds deployer wallet on mainnet (~0.15 OG from Binance — covers ~10 contract deploys + setup).
- Rebuild contracts with `via_ir = true`.
- Run full Foundry suite under `via_ir = true`: 189 + 25 (SkillRunPayment) + 12 (SkillPricing) = **226 tests** must pass.
- Deploy 10 contracts in dependency order:
  1. Erc7857Verifier
  2. ReceiptRegistryV3
  3. AgentPassportINFTV2 (depends on Erc7857Verifier + ReceiptRegistryV3)
  4. CapabilityRegistryV2
  5. MemoryAccessLogV2 (depends on CapabilityRegistryV2)
  6. SkillRegistryV2
  7. SubscriptionEscrowV2 (depends on ReceiptRegistryV3)
  8. SkillPricing (depends on SkillRegistryV2)
  9. SkillRunPayment (depends on SkillPricing)
  10. (Goldsky subgraph deployment from Block O — not a chain contract but tracked here)
- Pace deploys across blocks (1-2 per block).
- Record addresses in `contracts/deployments/mainnet.json`.
- Verify mainnet chainscan URL per D-9 (curl to confirm `https://chainscan.0g.ai` resolves). Update `packages/core/src/types.ts` `EXPLORER_URLS` constants.
- `pnpm numbers:refresh --network mainnet` (per D-10) + `pnpm docs:render` updates README + readiness checklist.
- Anchor 1 canonical mainnet receipt: `IVARONIX_NETWORK=mainnet pnpm ivaronix demo --pay private-doc-review`.
- Verify with `--tee-independent` against mainnet: FULLY VERIFIED ✓ all 5 checks.

**Acceptance criteria:**
- 226/226 Foundry tests pass under `via_ir = true` on a clean rebuild
- All 10 mainnet chainscan links open and verify contracts
- `IVARONIX_NETWORK=mainnet pnpm ivaronix doctor` → ALL SYSTEMS GO
- 1 mainnet receipt with real payment-tx binding verifies FULLY ✓
- `MAINNET_READINESS.md` 15/15 green (existing 13 + SkillRunPayment + SkillPricing rows)
- Mainnet chainscan URL confirmed + recorded in code

**Estimate:** 7 hours focused.

---

### Block L · README + `/thesis` + docs rewrite

**Scope IN:**
- README hero rewrite (persona-first sentence per §2)
- Three-number headline: `<numbers:auto:testnet.receipts.total>+ receipts · <numbers:auto:contracts.foundryTests>/<numbers:auto:contracts.foundryTests> Foundry tests · re-verifiable in 10 seconds`
- README "0G modules" table: per-primitive integration depth honest assessment
- README "Why Ivaronix" 2 paragraphs landing persona + kill-shot
- README "60-second quickstart" — `pnpm ivaronix receipt verify 1644` (no wallet)
- README "30-second fresh receipt" — `pnpm ivaronix demo --pay` or `?demo=true`
- README "Reproduce on your machine" — the literal CLI verify command
- README "Mainnet" section (post-Block K) — chainscan links for 10 deployed contracts
- README "What we ship vs roadmap" honest table — every 0G primitive with integration depth
- DA roadmap paragraph (200 words, honest, references Codex note)
- IETF AAT one-liner with spec pin
- `apps/studio/src/app/thesis/page.tsx` — surface PITCH.md content
- `SECURITY.md` at repo root: threat model summary + responsible disclosure + 8 audited primitives
- `CONTRIBUTING.md` at repo root: local dev + tests + PR conventions
- 6 fresh screenshots: 1440×900 + 375×812 captures of `?demo=true`, `/r/<id>`, `/marketplace`, `/marketplace/payouts`, CLI verify terminal, mobile receipt page

**Acceptance criteria:**
- README first paragraph contains persona-first hero sentence
- All numbers auto-rendered (`pnpm docs:check` PASS)
- `/thesis` route renders PITCH.md content at production URL
- SECURITY.md + CONTRIBUTING.md show as recommended community files on GitHub
- 6 fresh screenshots in `assets/readme-shots/` referenced in README

**Estimate:** 8 hours focused.

---

### Block M · Demo rehearsal + backup videos + judge-replay docs

**Scope IN:**
- 5-10 dry runs of 3-min demo at 1440×900 — silent stopwatch, no interventions
- Backup video #1: full demo at 1440×900 → `QA_PROOF_PACK/demo-backup/v1-1440x900.webm`
- Backup video #2: full demo at 375×812 mobile
- Backup video #3: network-failure rehearsal per D-12 — pre-anchored receipt switch
- Pre-anchor 2 demo receipts the day before submission (`rec_demo_a` + `rec_demo_b`)
- `apps/studio/src/lib/demo-fallback.ts` with the 2 pre-anchored IDs
- Rehearse the keyboard-shortcut URL switch (Galileo halt path) 2x
- `docs/JUDGE_REPLAY.md` — one-page judge replay quick-start; tested on clean clone or VM
- Telegram `t.me/zerog_apac_dev` notified per dev-rel guidance
- HackQuest submission form prepared but not submitted

**Acceptance criteria:**
- 3 consecutive intervention-free demo dry-runs (1440×900)
- 3 consecutive intervention-free demo dry-runs (375×812)
- Both backup videos play correctly in fullscreen
- Galileo-halt rehearsal: switch from live to pre-anchored takes <10 seconds
- `JUDGE_REPLAY.md` tested on a clean machine; every step works
- Telegram contact made

**Estimate:** 8 hours focused.

---

### Block N · 3-user PMF gate (no-fake-green submission lock)

**Scope IN:**
- Per D-13: recruit testers via 0G Discord, Twitter call, HackQuest community, personal contacts
- Upper bound: 6 attempts
- Each tester:
  1. Opens `?demo=true` on their machine
  2. Watches demo path complete
  3. Clicks "Connect wallet" → uses their own MM
  4. Runs a paid skill on a doc they upload
  5. Opens `/r/<id>` proof page
  6. Runs `pnpm ivaronix receipt verify <id> --tee-independent` on their machine
- Each tester provides written 1-sentence confirmation
- Document frictions; fix critical, mark non-critical as known limitations

**Acceptance criteria:**
- 3 testers complete the flow end-to-end with zero intervention
- 3 written 1-sentence confirmations captured (screenshots OK)
- Any blocking friction → fixed before submission OR honestly documented in README as known limitation

**Estimate:** Open-ended (overlaps with Block M).

---

### Block O · Goldsky subgraph indexing

**Scope IN:**
- New `subgraph/` directory at repo root with `subgraph.yaml`, `schema.graphql`, mappings.
- Schema:
  ```graphql
  type Skill @entity { id: ID! owner: Bytes! priceWei: BigInt! creatorBps: Int! treasuryBps: Int! publishedAt: BigInt! }
  type Receipt @entity { id: ID! agent: Bytes! skill: Skill receiptType: Int! anchoredAt: BigInt! }
  type Payment @entity { id: ID! receiptRoot: Bytes! payer: Bytes! creator: Bytes! amount: BigInt! creatorShare: BigInt! treasuryShare: BigInt! paidAt: BigInt! }
  type CreatorStats @entity { id: ID! lifetimeEarnedWei: BigInt! totalRuns: Int! latestWithdrawal: BigInt }
  type Withdrawal @entity { id: ID! by: Bytes! amount: BigInt! isTreasury: Boolean! ts: BigInt! }
  ```
- Event handlers in `subgraph/mappings/`:
  - `handleReceiptAnchored` (from ReceiptRegistryV1/V2/V3)
  - `handleSkillRunPaid` (from SkillRunPayment)
  - `handleSkillPublished` (from SkillRegistryV2)
  - `handlePriceUpdated` (from SkillPricing)
  - `handleWithdrawn` (from SkillRunPayment)
  - `handleMemoryAccessed` (from MemoryAccessLogV2)
- Deploy subgraph to Goldsky (per `oglabs resources/0g-doc/.../indexing/goldsky/` setup)
- Query layer at `apps/studio/src/lib/subgraph.ts` exposing functions used by Block I.

**Acceptance criteria:**
- Subgraph deployed at Goldsky-published endpoint
- 6 event handlers index correctly (validated via subgraph query against the 1664 existing receipts)
- `apps/studio/src/lib/subgraph.ts` exports `skillsList`, `skillReceipts`, `creatorStats`, `recentActivity` — all return real data
- Marketplace pages (Block I) consume successfully
- Subgraph re-indexes within 1 block of new events (validated by anchoring a fresh receipt and checking it appears in subgraph)

**Estimate:** 8 hours focused.

---

## 5 · Build order (dependency graph)

```
Block A (SkillRunPayment.sol)
        │
        ▼
Block A.1 (SkillPricing.sol)
        │
        ▼
Block B (Receipt schema + verifier extension)
        │
   ┌────┼─────────────┬────────────┐
   ▼    ▼             ▼            ▼
Block C  Block D   Block G      Block H
(Studio  (CLI)     (0GM         (AAT export)
 /api/run)         display)
   │       │          │            │
   └───┬───┴──────────┴────────────┘
       ▼
   Block O (Goldsky subgraph)
       │
   ┌───┼────────┐
   ▼   ▼        ▼
Block E  Block F  Block I
(?demo=  (KV +    (Marketplace
 true)    grant)   surface)
   │        │         │
   └────────┴────┬────┘
                ▼
            Block J (Multi-wallet)
                │
                ▼
            Block K (Mainnet)
                │
                ▼
            Block L (Docs)
                │
                ▼
            Block M (Demo rehearsal)
                │
                ▼
            Block N (PMF gate)
                │
                ▼
            Submission
```

Critical path: A → A.1 → B → (C/D parallel) → O → I → J → K → L → M → N.

---

## 6 · Per-block regression sweep (run after each block, not just at the end)

| Block | Regression to run |
|---|---|
| A | `forge test --match-contract SkillRunPayment --fuzz-runs 5000` + invariant suite (1000 random sequences) |
| A.1 | `forge test --match-contract SkillPricing` |
| B | `pnpm -r test` + polyglot canonical hash 41-vector regression (TS/Python/Rust) + verifier 5-check suite |
| C | `pnpm --filter @ivaronix/studio test` + Playwright `/api/run` payment flow + 5 distinct error states |
| D | `pnpm --filter @ivaronix/cli test` + live `pnpm ivaronix demo --pay` against testnet |
| E | Playwright `?demo=true` at 1440×900 + 375×812 + demo-wallet drain/refill test |
| F | `infra/0g-kv/test.sh` (boot, write/read/restart/read) + multi-user isolation test + on-chain grant cross-check |
| G | Visual regression: chip styling diff against baseline; legacy receipts still verify |
| H | `pnpm ivaronix receipt verify <id> --format aat \| ajv validate -s draft-rosenberg-aat-01.json` |
| I | E2E: publish skill (A) → marketplace list shows it → buy (B) → receipt anchored → withdraw (A) → balance 0 |
| J | Multi-wallet 3-account Playwright flow → 4 distinct chain txs verified on chainscan |
| K | `IVARONIX_NETWORK=mainnet pnpm ivaronix doctor` ALL GREEN + 10 chainscan links open |
| L | `pnpm wording-lint && pnpm docs:check && pnpm numbers:check` all PASS |
| M | 3 consecutive intervention-free demo dry-runs at both viewports |
| N | 3 testers confirm independently |
| O | Subgraph query for receipt #1664 returns correct shape; new anchor indexes within 1 block |

**Final pre-submission sweep:**

```bash
pnpm -r typecheck                                            # 25 packages clean
pnpm -r test                                                 # ~340 tests (288 existing + ~50 new)
pnpm lint                                                    # 23 turbo tasks
pnpm wording-lint                                            # 0 banned-word hits
pnpm numbers:check && pnpm docs:check                        # 0 drift warnings
pnpm --filter qa-metamask-e2e run regressions:studio         # 75+ scripts
pnpm --filter qa-metamask-e2e run regressions:cli            # 13+ scripts
pnpm --filter qa-metamask-e2e run regressions:contracts      # 4+ scripts
cd contracts && forge test                                   # 226 tests, all PASS
pnpm ivaronix demo --pay                                     # fresh receipt with real payment
pnpm ivaronix receipt verify <new-id> --tee-independent      # FULLY VERIFIED ✓
pnpm ivaronix receipt verify <new-id> --format aat | ajv ... # AAT validates
curl https://ivaronix.vercel.app/?demo=true                  # 200 OK
curl https://ivaronix.vercel.app/r/<new-id>                  # proof page renders
curl https://ivaronix.vercel.app/marketplace                 # marketplace lists skills
curl https://chainscan-galileo.0g.ai/tx/<payment-tx>         # tx visible
curl https://chainscan.0g.ai/tx/<mainnet-tx>                 # mainnet tx visible
# Multi-wallet 3-account flow
node scripts/qa/multi-wallet/playwright-3wallet-full-flow.ts
```

Every line returns success. No "mostly works."

---

## 7 · Demo script (3 minutes, live, no friction)

**Pre-stage:**
- `/?demo=true` open in tab 1 (Studio pre-authenticated, doc pre-loaded, demo wallet has 1+ OG)
- `/r/<staged-id>` open in tab 2 (pre-anchored receipt for backup)
- Terminal open with `ivaronix receipt verify rec_<staged-id> --tee-independent` pre-typed
- Mobile mirror visible (or phone with `/r/<id>` open at 375px)
- Backup video at `QA_PROOF_PACK/demo-backup/v1-1440x900.webm`
- Pre-anchored fallback IDs ready (`apps/studio/src/lib/demo-fallback.ts`)

**Script:**

```
00:00–00:15  HERO LINE
  Show /?demo=true on screen.
  Say: "A founder reviewing a term sheet shouldn't have to trust the AI.
        With Ivaronix, every AI review leaves a cryptographic receipt —
        independently re-verifiable by anyone, on any machine, in 10 seconds."

00:15–00:45  RUN
  Click "Run review →". Say nothing.
  Four-light row: STORAGE → COMPUTE → CHAIN → TIER 1. Then payment tx fires.
  Silence carries the moment.

00:45–01:15  RECEIPT + PAYMENT
  Receipt appears. Point at 4 things:
    - Receipt ID
    - TIER 1 chip (green) · 0GM chip (green) · "Ran on 0GM inside a TEE."
    - Payment tx hash · "0.001 OG paid. Creator credited 90%. Treasury 10%."
    - "Independently re-verifiable →" link

01:15–01:45  PUBLIC PROOF + RE-VERIFY
  Open /r/<id> in tab 2: "This URL works for anyone, any browser, no account."
  Switch to terminal. Paste the verify command:
    ivaronix receipt verify rec_<id> --tee-independent
  Wait for FULLY VERIFIED ✓ (all 5 checks: schema, hash, signature, anchor, payment, TEE).
  Say: "That just re-ran the broker verification against the actual
        0G Compute provider AND checked the payment tx binding on chain.
        Not cached. Not faked."

01:45–02:30  THE NUMBERS
  One slide. Three numbers:
    1664+ receipts anchored on 0G Chain (testnet + mainnet).
    226/226 Foundry tests green.
    Re-verifiable by anyone, on any machine, in 10 seconds.
  Say: "No other project in this hackathon ships independent re-verification
        with payment-tx binding."

02:30–03:00  THE ASK
  Say: "Private AI workroom. Every action leaves a receipt anyone can replay.
        Creators get paid on chain. This is what accountable AI looks like."
  Close.
```

**Hard rules:** never apologise for loading. Never explain what 0G is. Never read slides. Never show onboarding. Never type live.

---

## 8 · Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Galileo halts during demo | Medium | Demo killed | Pre-anchor 2 receipts + backup video + keyboard-shortcut URL switch (D-12) |
| Router rate limit (30 req/min) | Low | Demo stutter | Demo is 1 inference; ceiling far above |
| Storage indexer 504 | Medium | Receipt anchor delayed | Pipeline retry + `evidenceRoot: pending` fallback |
| KV server self-host complexity for judges | High | Judges hit 4GB Docker on `pnpm dev` | Stub fallback by default; `KV_REMOTE_URL` opts in; clear README |
| Mainnet OG funding delay | Low | Mainnet deploy blocked | Testnet receipts + 15/15 readiness is acceptable |
| Payment contract reentrancy bug | Low | Funds drained | 25+ Foundry tests + 4 reentrancy vectors + 3 invariants + 5000+ fuzz runs |
| MM popup doesn't appear during demo | Low (`?demo=true` skips MM) | None for demo path | Backup MM-popup flow in Block J |
| 3-user PMF gate finds real bug | Likely | Submission window slips | Fix, re-test; accept window slip if quality requires |
| Submission window missed | Possible | Hackathon entry not accepted | Submit tighter scope (payment + demo only) before missing; v1.1 follows in week 1 |
| Subgraph deploy fails | Medium | Marketplace data layer broken | Direct-chain query fallback for v1; subgraph optional for launch |
| Goldsky rate limit | Low | Marketplace pages slow | Server-side cache layer; 5-min TTL on subgraph queries |

---

## 9 · Mainnet deployment runbook (Block K detail)

```bash
# 1. Fund deployer wallet
# Operator transfers 0.15 OG from Binance to 0xaa954c33810029a3eFb0bf755FEF17863E8677Ce on chainId 16661

# 2. Verify
IVARONIX_NETWORK=mainnet pnpm ivaronix doctor balance  # > 0.1 OG

# 3. Rebuild with via_ir = true
cd contracts
sed -i 's/via_ir = false/via_ir = true/' foundry.toml
forge build
forge test  # 226/226 PASS

# 4. Deploy 10 contracts in order (1-2 per block, pace deploys)
for script in DeployErc7857Verifier DeployReceiptRegistryV3 DeployAgentPassportINFTV2 \
              DeployCapabilityRegistryV2 DeployMemoryAccessLogV2 DeploySkillRegistryV2 \
              DeploySubscriptionEscrowV2 DeploySkillPricing DeploySkillRunPayment; do
  forge script script/${script}.s.sol --rpc-url https://evmrpc.0g.ai --broadcast --legacy --skip-simulation
  sleep 8
done

# 5. Record addresses
# Edit contracts/deployments/mainnet.json

# 6. Verify mainnet chainscan URL
curl -I https://chainscan.0g.ai  # confirm 200
# Update packages/core/src/types.ts EXPLORER_URLS.mainnet

# 7. Refresh numbers + render docs
pnpm numbers:refresh --network mainnet
pnpm docs:render

# 8. Deploy Goldsky subgraph (mainnet variant)
cd subgraph
yarn deploy:mainnet  # or however Goldsky CLI works

# 9. Doctor + canonical mainnet receipt
IVARONIX_NETWORK=mainnet pnpm ivaronix doctor                       # ALL GREEN
IVARONIX_NETWORK=mainnet pnpm ivaronix demo --pay private-doc-review  # fresh receipt
pnpm ivaronix receipt verify <mainnet-id> --tee-independent --network mainnet  # FULLY VERIFIED ✓
```

Estimated cost: ~0.02 OG total (10 deploys + setPrice for 6 skills + 1 anchor + 1 paySkillRun + 1 withdrawal).

---

## 10 · Definition of done (no fake green)

- [ ] `SkillRunPayment.sol` + `SkillPricing.sol` deployed on Galileo AND Aristotle
- [ ] Foundry: 226/226 tests pass under `via_ir = true` (177 existing + 25 SkillRunPayment + 12 SkillPricing + 12 boundary cases)
- [ ] Receipt verifier extended with 5-check payment-tx binding (per D-4)
- [ ] One Galileo + one Aristotle receipt anchored with real `payment.txHash`; both FULLY VERIFIED ✓ (all 6 checks: schema/hash/signature/anchor/payment/TEE)
- [ ] Per-skill split rates (D-1): contract accepts variable bps; receipt records actual splits
- [ ] `?demo=true` Studio path with demo-wallet monitoring + out-of-funds fallback (D-6)
- [ ] 0G KV server self-hosted; chain-grant cross-check middleware (D-7); StubKvClient is dev-only fallback
- [ ] 0GM model option visible; receipts carry `execution.model.source` enum; chips render correctly; legacy receipts verify
- [ ] `--format aat` flag pinned to `draft-rosenberg-aat-01`; `docs/AAT_MAPPING.md` documents mapping; sample output validates against draft schema
- [ ] `/marketplace`, `/marketplace/[skillId]`, `/marketplace/new`, `/marketplace/payouts`, `/admin/treasury` — all 5 routes ship; full buy-and-withdraw loop works on Galileo + Aristotle
- [ ] Goldsky subgraph deployed; marketplace queries return real indexed data
- [ ] Multi-wallet Block J: 4 distinct chain txs from 3 distinct senders captured (screenshots + video)
- [ ] README hero + 3-number headline + DA roadmap + AAT mention + Mainnet section + 6 fresh screenshots
- [ ] `/thesis` route renders PITCH.md
- [ ] `SECURITY.md` + `CONTRIBUTING.md` at repo root
- [ ] All 92+ source-file regressions pass; all 4 doc-drift gates green
- [ ] **All Priority A UI tests PASS for every shipped flow** (per `docs/FINAL_BUILD_TEST_PLAN.md` — error-state realism × 9 modes, stranger-replays-receipt, state recovery, receipt-as-shareable-artifact)
- [ ] **All Priority B UI tests PASS before mainnet promotion** (a11y + cross-browser including Safari iOS)
- [ ] Demo rehearsed 3 consecutive intervention-free runs at 1440×900 AND 375×812
- [ ] 2 pre-anchored backup receipts ready + Galileo-halt fallback rehearsed
- [ ] Backup videos at 1440×900 + 375×812 + network-failure scenarios captured
- [ ] **3 unaffiliated testers confirm end-to-end flow on their machines without intervention**
- [ ] `docs/JUDGE_REPLAY.md` tested on clean clone
- [ ] Telegram `t.me/zerog_apac_dev` notified
- [ ] HackQuest submission filed

If ANY item is false: submission NOT ready. Slip the window if needed; ship a smaller honest scope rather than a fake one.

---

## 11 · Quality bar (per-block "no compromise" definition)

**Block A · SkillRunPayment.sol**
- No upgradeable proxies (immutable per `.claude/rules/contracts.md`)
- No `payable(address).transfer()` (use `.call{value:}` per modern Solidity)
- Pull pattern for ALL withdrawals; no push payments
- State-zero-before-transfer for reentrancy safety
- Full threat-model JSDoc
- Foundry: 25+ unit tests, 4+ reentrancy vectors, 3+ invariant tests, 5000+ fuzz runs per test, gas budget enforced
- Refund timelock test: 24h before refund possible
- Per-skill bps boundary tests: 5000/5000, 9500/500, 4999/5001 (reject), 9501/499 (reject), 0/10000 (reject)

**Block A.1 · SkillPricing.sol**
- Ownership tied to `SkillRegistryV2.ownerOf(skillId)`; no other auth path
- bps invariant enforced: `creatorBps + treasuryBps == 10000`, creator in `[5000, 9500]`
- Foundry: 12 tests including ownership, bps validation, update cycle

**Block B · Receipt schema + verifier**
- Backwards-compatible (1664 existing receipts still verify)
- Polyglot byte-equality: 41 vectors across TS + Python + Rust
- AAT mapping complete (every required AAT field has a source)
- Verifier 5-check payment-tx binding: fake/spoofed payments fail closed

**Block C · Studio /api/run**
- Server-side tx verification: 5 distinct checks (D-4)
- 5 distinct error messages for 5 failure modes
- Mobile viewport tested
- No fake "payment confirmed" without on-chain receipt

**Block D · CLI**
- Three payment flags: `--pay`, `--subsidise`, `--no-payment`
- Demo from clean clone produces real-tx receipt
- Payment status shown in `receipt show` + `receipt verify`

**Block E · Zero-friction onboarding**
- Demo wallet monitoring + Telegram alert (D-6)
- Out-of-funds fallback UX
- `payment.subsidised: true` clearly surfaced
- Real pipeline runs (no fake demo states)
- Mobile + Playwright E2E green

**Block F · 0G KV**
- Operator-hosted; self-serve key issuance (D-7)
- Chain grants authoritative; cross-check middleware on every read
- Cross-session persistence verified
- Multi-user API-key isolation verified
- Revocation test: grant on chain → revoke on chain → next HTTP read fails

**Block G · 0GM display**
- Enum source enforced by Zod (no string-typed escape)
- Chip colours match brand tokens
- Legacy receipts (no source field) backfilled without breaking canonical hash

**Block H · AAT export**
- Pinned to `draft-rosenberg-aat-01`
- Output validates against draft schema (ajv)
- Every required AAT field has documented receipt-field source

**Block I · Marketplace**
- All 5 routes ship (browse, detail, new, payouts, admin/treasury)
- Subgraph-backed (D-3)
- Real buy-and-withdraw loop on chain
- Lifetime earnings + recent activity from subgraph
- Admin treasury SIWE-gated (D-5)
- Mobile tested

**Block J · Multi-wallet UI**
- Per CLAUDE.md §16: real MM popups, real on-chain txs, UI exercised with each wallet, CLI cross-check, chainscan confirms — all four sub-conditions per row
- D-11 next-derivation pattern locked

**Block K · Mainnet**
- Same code path as testnet (no mainnet-only branches)
- All 10 contracts on chainscan
- Readiness 15/15 green
- Mainnet chainscan URL verified

**Block L · Docs**
- README first paragraph contains persona-first hero sentence
- All numbers auto-rendered (no hand-edits)
- 6 fresh screenshots at 1440×900 + 375×812

**Block M · Demo**
- 3 intervention-free dry-runs at both viewports
- Backup videos play correctly fullscreen
- Galileo-halt rehearsal documented + dry-run-tested

**Block N · PMF gate**
- 3 unaffiliated testers
- Written confirmations captured
- 6-attempt upper bound (D-13)

**Block O · Goldsky subgraph**
- Indexes within 1 block of new event
- Marketplace queries return real data
- Schema covers all 6 event types

---

## 12 · After submission (v1.1 backlog)

Queued in `docs/USER_TODO.md §B-V3-*`:

- Subscription / pre-paid balance model wrapping per-run nano
- ERC-20 payment tokens (USDC.e on 0G once stable)
- Automated refund detection (no admin action needed)
- Skill discovery search / filters / categories / ratings
- Creator profiles with bios and stats
- 0G DA wire-up (when public disperser ships)
- Circle nanopayments integration
- Arc stablecoin settlement for enterprise treasuries
- Foundation-hosted 0G KV variant
- ISO 42001 audit pack export
- Insurance underwriting integration
- Cross-org agent trust registry
- 100 design-partner enrolment
- MCP server in Claude Desktop / Cursor live demo capture
- Telegram bot live with BotFather token
- Sentry / observability platform integration
- Treasury → multisig (Safe) migration

---

## 13 · The one-line version

**Per-skill paid runs with payment-tx binding closes the marketplace gap. `?demo=true` + demo-wallet monitoring closes the friction gap. Operator-hosted 0G KV with chain-grant cross-check closes the memory gap. `--format aat` pinned to a real IETF draft closes the enterprise-buyer gap. Marketplace surface with Goldsky subgraph closes the discovery gap. 3-wallet flow via Add Account derivation closes the §16 gap. DA stays honest. Every gap closed properly, no half-bakes.**

The product is real. The proof is real. The settlement is real. Build the 16 blocks (A → A.1 → B → C/D/G/H → O → E/F/I → J → K → L → M → N) with no compromise, run the per-block regression in §6, run the §11 quality bar over every block, deliver the demo in §7, satisfy the §10 submission gate, and submit when ready.

---

## 14 · Acknowledged half-bakes that are now closed

Listed in the design-gap audit (2026-05-13 mid-session); each is now a locked design decision:

| Original half-bake | Design decision | Location |
|---|---|---|
| Block A hardcoded 90/10 vs Block I per-skill manifest splits | Contract accepts per-skill bps at pay-time | §3 D-1 |
| Skill price storage location undecided | New `SkillPricing.sol` contract | §3 D-2, Block A.1 |
| Marketplace has no query layer | Goldsky subgraph (Block O) | §3 D-3 |
| Receipt verifier doesn't check payment tx | 5-check binding in `verify.ts` | §3 D-4, Block B |
| Admin auth model undefined | SIWE + env-wallet check | §3 D-5 |
| Demo wallet ops undefined | Monitor + Telegram + fallback UX | §3 D-6, Block E |
| KV multi-user / grant model undefined | API key + chain-grant middleware | §3 D-7, Block F |
| AAT spec version undecided | Pin to `draft-rosenberg-aat-01` | §3 D-8 |
| Mainnet chainscan URL unknown | Verify at deploy + per-network constants | §3 D-9, Block K |
| `numbers-refresh` mainnet support | Add `--network` flag | §3 D-10 |
| Multi-wallet UI scrape stalled | Use 3 MM-derived accounts | §3 D-11, Block J |
| Network-failure rehearsal undefined | Pre-anchored receipts + URL switch | §3 D-12, Block M |
| Tester recruitment + cap undefined | 6 sources + 6-attempt upper bound | §3 D-13, Block N |
| Canonical hash with optional payment | 4 case classes × 3 runtimes | §3 D-14, Block B |
| Refund admin function missing | `refundFailedRun` with 24h timelock | §3 D-15, Block A |
| Where creator publishes paid skill | `/marketplace/new` route | §3 D-16, Block I |
| Subsidy semantics | `subsidised: true` flag on receipt | §3 D-17 |
| Telemetry / observability missing | Minimal local telemetry + admin/health route | §3 D-18 |

---

## 15 · AgentPay audit · verified findings (referenced from §1)

[Existing §15 content from prior revision — unchanged]

Audit run 2026-05-13 against `new-entries/individuals/AgentPay/` last commit `51068c8`.

**Verdict**: AgentPay is hackathon-level — solid contracts + frontend polish — but lying about 0G integration depth (zero `0g-ts-sdk` imports; "0G Storage" and "0G Compute" are mock fallbacks; custodial relayer pattern despite "self-custodial" pitch). Patterns we BORROW: `bytes32 jobId` receipt-binding; basis-point split invariant `sum == 10000`; SDK `parseEventLogs` after writes. Patterns we AVOID: custodial relayer; push-pattern fan-out; mock fallbacks hiding "never built"; `Ownable` rugs fees instantly; no threat-model NatSpec.

**Threat to Ivaronix on Track 3**: low. We score meaningfully higher on Criterion 1 (0G integration depth) because they use 0G as a generic EVM chain only.

---

## 16 · The half-bake audit (rationale for the 22 fixes)

Captured 2026-05-13 mid-session. Each gap below was identified during a brutally-honest plan re-read; each was either fixed in §3 design decisions or rolled into a Block scope expansion.

**🔴 6 critical gaps** (architectural decisions that would break the product if left as hand-waves):
1. Block A ↔ Block I split-rate mismatch → D-1
2. Marketplace data layer (no index) → D-3 + Block O
3. Receipt verifier doesn't check payment tx → D-4
4. Skill price storage location → D-2 + Block A.1
5. Admin auth model → D-5
6. Where creator publishes → D-16

**🟡 9 specify-before-build gaps**:
7-15: Demo wallet ops, KV auth, AAT spec, mainnet chainscan, numbers-refresh per-network, multi-wallet strategy, network-failure rehearsal, tester recruitment, canonical hash with optional payment, refund admin function → D-6 through D-15.

**🟢 7 acceptable build-time details** (no spec needed; left for implementation phase):
- Exact loading-state copy
- Skill detail page exact layout
- Chip exact hex colours (use brand tokens)
- README screenshot crops
- Demo backup video narration
- Mobile breakpoint values
- Goldsky-specific schema syntax (validated at deploy time)

Every 🔴 and 🟡 is now closed via §3 design decision. The plan is launch-grade.

---

*— Written 2026-05-13. Revised for no-compromise scope same day. All half-bakes audited and closed. The final build starts now.*
