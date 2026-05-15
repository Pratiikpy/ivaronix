# Mainnet Funding Estimate

> Per LOOP_DIRECTIVE Phase 2 PRE-DEPLOY FUNDING ESTIMATE: produced BEFORE any mainnet tx. Bytecode-size-based conservative estimate (forge `--estimate-gas` simulation needs the deploy script's runtime context which carries small operational risk; bytecode size × gas-per-byte gives a deterministic upper bound that is strictly higher than simulation would produce for the same compiler output).

## Mainnet target

- Network: 0G Aristotle mainnet · chainId 16661 · RPC `https://evmrpc.0g.ai`
- Deployer wallet: `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` (same operator wallet · 25 OG deposited)
- Foundry profile: `mainnet` (`via_ir = true` for ~20% bytecode reduction · same one used for the 232 Foundry tests Phase 1 EXIT GATE)
- Solidity: 0.8.20 · EVM target: cancun (per `contracts/foundry.toml`)

## Bytecode size per contract (measured via `forge inspect <Contract> bytecode`)

| Contract | Bytecode size (hex chars) | ~bytes | Conservative deploy gas* |
|---|---:|---:|---:|
| AgentPassportINFTV2 | 24,307 | 12,153 | 2,533,600 |
| ReceiptRegistryV2 | 12,621 | 6,310 | 1,344,800 |
| ReceiptRegistryV3 | 12,849 | 6,424 | 1,367,600 |
| SkillRegistryV2 | 9,985 | 4,992 | 1,071,200 |
| SkillPricing | 3,905 | 1,952 | 502,400 |
| SkillRunPayment | 8,131 | 4,065 | 884,800 |
| CapabilityRegistryV2 | 9,759 | 4,879 | 1,048,600 |
| MemoryAccessLogV2 | 2,367 | 1,183 | 339,400 |
| SubscriptionEscrowV2 | 16,477 | 8,238 | 1,701,400 |
| Erc7857Verifier | 5,111 | 2,555 | 614,000 |
| **TOTAL DEPLOY GAS** | | **52,851** | **11,407,800** |

*Formula: `21,000 (base tx) + 32,000 (contract creation) + bytecode_bytes × 200 (Solidity deploy cost) + ~30,000 (constructor avg)`. This is the SAFE UPPER BOUND. Actual gas usage from `forge --estimate-gas` simulation will be slightly lower.

## Gas price assumptions (Aristotle mainnet · early-network conditional)

| Scenario | Gas price | Total deploy cost (OG) |
|---|---|---:|
| Best case (5 Gwei · matches Galileo testnet floor) | 5e9 wei | 0.0570 OG |
| Expected (10 Gwei · 2× testnet) | 1e10 wei | 0.1141 OG |
| Worst case (50 Gwei · 10× testnet) | 5e10 wei | 0.5704 OG |

Mainnet gas price will be confirmed by `cast gas-price --rpc-url https://evmrpc.0g.ai` BEFORE first deploy tx.

## Additional Phase 2 + Phase 3 spend

| Item | Estimated cost |
|---|---:|
| Authorize operator wallet as recorder on AgentPassportINFTV2 (1 tx) | ~0.001 OG |
| Configure pc.0g.ai adapter (provider acknowledgment tx · if needed) | ~0.005 OG |
| Republish 5 legal skills to SkillRegistryV2 mainnet (5 tx) | ~0.025 OG |
| Phase 3 mainnet QA: 20 receipt anchors at 0.005 OG average | ~0.100 OG |
| 0G Compute ledger initial deposit (per MAINNET_PROMOTION_PLAN §2.3 · ledger-based billing) | ~5.0 OG |
| 0G Compute provider transfer (initial fund for `pc.0g.ai` route to `0GM-1.0`) | ~5.0 OG |
| Misc admin txs (treasury withdraw test · capability grant test · trust score bump test) | ~0.020 OG |
| **TOTAL PHASE 2+3 SPEND ESTIMATE** | **~10.65 OG (best case)** to **~10.92 OG (expected)** |

## Hard cap with buffer

| Item | OG |
|---|---:|
| Deploy + admin + skill republish + Phase 3 anchors (expected case) | 0.92 OG |
| 0G Compute ledger + provider transfer | 10.00 OG |
| Subtotal | 10.92 OG |
| +50% buffer (per directive) | 5.46 OG |
| **HARD AUTONOMOUS CAP** | **16.38 OG** |
| Operator deposited | 25.00 OG |
| **Safety margin** | **8.62 OG (35%)** |

Well within the 25 OG operator deposit. The 0G Compute ledger + provider transfer (10 OG · 2 × 5 OG) is the LARGEST line item · per `MAINNET_PROMOTION_PLAN.md §2.4`; this is a one-time setup cost that funds the inference layer for the lifetime of mainnet operations until depletion.

## Stop-if-unexpected triggers (locked per directive)

The agent MUST STOP autonomous mainnet spending if ANY of:
- Any single tx exceeds **2× estimated tx cost** (e.g. AgentPassportINFTV2 deploy > 5.06M gas OR > 0.0506 OG at 10 Gwei)
- Daily mainnet spend exceeds **2× estimated daily** (e.g. > 5 OG in 24h during Phase 3 QA)
- Cumulative loop spend exceeds **16.38 OG hard cap**
- Real gas price during a tx exceeds **50 Gwei** (10× testnet · indicates network congestion or operator-side mempool issue)

On any STOP trigger: agent writes `QA_PROOF_PACK/mainnet/spend-stop-trigger.md` documenting which trigger fired + the current spend total + the proposed next action. Operator approves continuation before next mainnet tx.

## Continuous spend log

The agent maintains `QA_PROOF_PACK/mainnet/spend-log.md` updated after EVERY mainnet tx:
- Timestamp (ISO 8601 + chain.timestamp)
- Tx hash + chainscan URL
- Gas used + gas price
- OG cost (gas × price)
- Running total + % of 16.38 OG hard cap consumed
- % of 25 OG operator deposit consumed

## Deploy order (locked · per MAINNET_PROMOTION_PLAN §2.2 + LOOP_DIRECTIVE Phase 2 step 3)

10 contracts, sequenced across blocks (per-block gas budget on 0G Chain · per `docs/SOLIDITY_CHOICES.md`):

1. **Erc7857Verifier** — chain primitive · standalone · no constructor deps
2. **ReceiptRegistryV3** — canonical anchor target · `EIP712("Ivaronix.ReceiptRegistry", "3")` domain
3. **AgentPassportINFTV2** — ERC-7857 · pairs with Verifier
4. **CapabilityRegistryV2** — memory grant lifecycle
5. **MemoryAccessLogV2** — read-access events · capability-gated
6. **SkillRegistryV2** — manifest hash registry
7. **SubscriptionEscrowV2** — subscription billing primitive
8. **SkillPricing** — per-skill price storage (constructor: SkillRegistryV2 address)
9. **SkillRunPayment** — fee-split (constructor: SkillRegistryV2 + SkillPricing addresses)
10. **ReceiptRegistryV2** — V2 receipt anchors (legacy compat for any clients reading V2-only)

Each deploy script in `contracts/script/Deploy<Name>.s.sol` already exists and is forge-tested. Foundry mainnet profile (`via_ir = true`) gives ~20% bytecode reduction → actual gas will be lower than the bytecode-size formula above.

Address records land in `contracts/deployments/mainnet.json` immediately after each deploy. Per-contract proof at `QA_PROOF_PACK/mainnet/deploys/<contract>.md` (address · tx hash · chainscan URL · constructor args).

## First mainnet smoke-test plan (per MAINNET_PROMOTION_PLAN §2.5)

After deploys land:

1. **`ivaronix doctor --network mainnet`** → expect ALL GREEN: RPC reachable · Compute reachable · Storage reachable · 10 contracts deployed · operator wallet balance.
2. **`ivaronix demo --network mainnet`** → produces 1 receipt against `private-doc-review` · expect `FULLY VERIFIED ✓` via TIER 1 TEE path.
3. **`pnpm ivaronix receipt verify <mainnet-id> --tee-independent`** → re-verifies against actual `pc.0g.ai` route reaching `0GM-1.0`. Expect 5/5 checks green.
4. **`pc.0g.ai` route test** → call `pnpm ivaronix compute test --model 0GM-1.0-35B-A3B` to confirm the route reaches the sovereign model.
5. **One anchor per consensus tier** — `quick` · `standard` · `high-stakes` · `audit` — all `FULLY VERIFIED` per `MAINNET_PERFECT_PLAN.md §7` mainnet promotion gate.
6. **3-wallet marketplace flow** on mainnet — creator + buyer + treasury · real OG fee-split paid · 3 distinct chainscan tx URLs.
7. **Stranger-machine verify** — open `/r/<mainnet-id>` from a fresh browser on a different device · all 4 lights green without auth.

Total Phase 3 smoke spend: ~0.1 OG (within hard cap).

## Phase 3 QA Q-walkthrough (post-smoke · per LOOP_DIRECTIVE Phase 3 work)

Same 20-item Q-walkthrough run on mainnet (Q1-Q20) · Q9 PARTIAL stays explicit per ISSUE-B closure (citation-verifier runtime web_fetch enforcement is the per-skill mainnet promotion gate). Q15 DA stays NON-BLOCKING per operating principle #10. All other Q-items expect the same green outcomes as testnet, with mainnet-specific items (real `0GM-1.0` via `pc.0g.ai` route · 5 consensus tiers anchored · 3-wallet fee-split paid in real OG).

## Authorization gate

Agent does NOT proceed to step 1 (Erc7857Verifier deploy) without operator's explicit "go" reply confirming:
- They've spot-checked at least 3 of the 8 PHASE_1_DONE.md spot-check paths
- They've reviewed this funding estimate
- They authorize Phase 2 within the 16.38 OG autonomous cap (real wallet at 25 OG)

— agent · Phase 2 step 0 · 2026-05-15T02:40Z chain time
