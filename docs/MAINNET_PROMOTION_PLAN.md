# Mainnet promotion plan

> Drafted 2026-05-14, after the burner-test-script foundation passed 52/52 outcome assertions + 14/14 cross-machine surface checks across 4 test-scriptes (3-wallet flow · all-features · outcomes-deep · cross-machine). Testing-phase cron loop cancelled. This document is the runway from "everything works on Galileo testnet" to "Ivaronix is live on Aristotle mainnet."

## State of the foundation (what's already proven)

Burner-test-script proof, last 24 hours:

| Script | Outcome | Runtime |
|---|---|---|
| `burner-3-wallet-flow.ts` | 6 txs, fee-split 9000/1000 verified at event + state level | 74s |
| `burner-all-features.ts` | 19 functions across 6 contracts, all green | 158s |
| `burner-outcomes-deep.ts` | 52/52 assertions (tx-status + event + state + balance triangulation) | 142s |
| `burner-cross-machine.ts` | 14/14 Studio surfaces resolve a fresh burner-anchored receipt | 38.6s |

Two on-chain primitives remain unverified by the burner pattern: `SkillRunPayment.refundFailedRun` and `AgentPassportINFTV2.recordReceipt`. A `burner-final-sweep.ts` test-script was drafted to close them but blocked by a security hook (used `execSync`). Re-draft with `execFileSync` is a 5-minute job and lives at the top of the polish list.

## Phase 1 — Polish (≤ 5 working days, no mainnet writes)

### 1.1 Close the two remaining burner gaps
- Re-draft `burner-final-sweep.ts` using `execFileSync` (per the hook's recommendation). Cover (a) `recordReceipt` reputation bump with event + state delta, (b) `refundFailedRun` with `Refunded` event + payer balance delta + `refunded[receiptRoot]` flag.
- Add the test-script path to `scripts/qa/metamask-e2e/run-source-regressions.ts` filter list per CLAUDE.md §15.

### 1.2 Final regression sweep
Run the existing 94+ source-file regressions (`pnpm --filter @ivaronix/studio test`, `pnpm -r typecheck`, `pnpm --filter @ivaronix/studio build`) one more time on a clean checkout. CI-clean is the gate per CLAUDE.md §1.

### 1.3 README + judge-facing copy
The README is the submission deliverable per CLAUDE.md §13. Lock it before mainnet:
- Anchored-receipt count as the headline number (current `docs/numbers.json` value, auto-rendered).
- Three-line reproduction path that a judge can paste verbatim.
- Pre-funded reviewer wallet address with faucet link.
- No competitor-bashing (CLAUDE.md §9 final paragraph).

### 1.4 Visual final pass
Side-by-side `brand/Ivaronix.html` vs production Studio at 1440×900 + 375×812 for the 4 high-traffic routes (`/`, `/r/<id>`, `/marketplace`, `/onboard`). Fix any cream/ink/radius drift first per CLAUDE.md §10.

### 1.5 Submission package dry-run
`docs/JUDGE_REPLAY.md` rehearsal on a fresh machine — clean clone, `pnpm install`, env fill, `pnpm ivaronix demo`, see a receipt URL. If the rehearsal takes more than 10 minutes end-to-end, the bottleneck is the polish item.

## Phase 2 — Mainnet deploy (operator-gated)

### 2.1 Funding gate
Operator wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` needs ~0.5 OG on Aristotle mainnet for the full 8-contract deploy. This is the **only true blocker** per CLAUDE.md §1 ("The only blocker is money").

### 2.2 Deploy order (sequenced across blocks for the per-block gas budget)
1. `AgentPassportINFTV2`
2. `ReceiptRegistry` (V1 — for legacy-flow compatibility on mainnet, anchor with V2)
3. `ReceiptRegistryV2` (canonical anchor target)
4. `ReceiptRegistryV3` (preferred for new anchors)
5. `SkillRegistryV2`
6. `SkillPricing`
7. `SkillRunPayment` (constructor-wires SkillRegistryV2 + SkillPricing addresses)
8. `CapabilityRegistryV2`
9. `MemoryAccessLogV2`
10. `Erc7857Verifier`

Each deploy script in `contracts/script/Deploy*.s.sol` already exists. Foundry profile pinned at `solc 0.8.20` + EVM `cancun` per `contracts/foundry.toml`. Flip `via_ir = true` for ~20% bytecode reduction on mainnet (currently `false` for testnet compile speed).

### 2.3 Address propagation (auto)
`contracts/deployments/mainnet.json` is the single source of truth. Once populated:
- `pnpm numbers:refresh` rebuilds `numbers.json` contracts.list + addresses (CLAUDE.md §15).
- `pnpm docs:render` regenerates the README + MAINNET_READINESS contracts:auto blocks.
- `KNOWN_RECEIPT_REGISTRIES` regression catches drift.
- `verify-numbers-vs-deployments.ts` regression catches drift.
- `verify-user-todo-deploy-markers.ts` regression catches drift.

### 2.4 ChainGPT audit
Mainnet promotion gates on a ChainGPT audit pass per USER_TODO §B-2. The current 8-contract surface is the audit scope; no new contracts before audit submission.

### 2.5 First mainnet anchor (smoke)
Same shape as `burner-3-wallet-flow.ts` but pointed at mainnet RPC + mainnet addresses. Funding constraint: ~0.02 OG per burner + ~0.005 OG per anchor + per-tx gas at mainnet pricing. Total budget for the smoke ≤ 0.1 OG.

## Phase 3 — Submission (CLAUDE.md §13)

1. README finalized with mainnet addresses.
2. JUDGE_REPLAY.md updated with mainnet RPC + chainscan URLs (chainscan.0g.ai, not chainscan-galileo).
3. PITCH.md and MAINNET_READINESS.md re-rendered via `pnpm docs:render`.
4. Submission form filled. README is in English (or Chinese — submission lead's choice).
5. Final `pnpm -r typecheck && pnpm --filter @ivaronix/studio build` on the submission commit.

## What I'm NOT doing now

- No more burner test-script runs (foundation is sufficient).
- No mainnet writes until operator funds the deployer wallet.
- No mainnet audit submission until the README is final.
- No public-trust-surface competitor comparisons (CLAUDE.md §9).

## Open decisions for the operator

1. **README language** — English, Chinese, or both?
2. **Funding source** — CEX withdraw to the deployer wallet, or a different operator wallet?
3. **ChainGPT audit timing** — pre-submission or post-submission? (Submission deadline determines.)
4. **Mainnet launch announcement** — Twitter thread, Discord, or both?

## Quick reference

- Submission deadline: see hackathon page.
- Operator deployer wallet: `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`
- Galileo RPC: `https://evmrpc-testnet.0g.ai` (chainId 16602)
- Aristotle RPC: `https://evmrpc.0g.ai` (chainId 16661)
- Galileo chainscan: `https://chainscan-galileo.0g.ai`
- Aristotle chainscan: `https://chainscan.0g.ai`
- Last burner-anchored receipt: id 36 on V2 (`/r/36`)
