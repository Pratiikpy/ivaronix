# Multi-Wallet Testing Rules

> User directive captured iter-133 · 2026-05-13.
> These rules are CANONICAL — every future iteration honors them. Linked from CLAUDE.md.

## The mistake this fixes

iter-132 shipped 2-wallet infrastructure + 2 chain-level proofs and described the result as "mostly proven." The user pushed back: **chain-level proof is NOT "fully working"**. A real user opens a real MetaMask extension, imports Wallet B's key into a real browser, and uses Studio through the wallet popup flow. Anything less is partial proof.

## The rules (verbatim user directive)

> You made an important QA mistake: you treated "mostly proven" multi-wallet coverage as enough, but 2-wallet and 3-wallet flows were not fully tested like real users. Do not repeat this.
>
> From now on, every feature that involves permissions, memory sharing, delegation, data rooms, paid runs, marketplace, creator/treasury split, passport authority, or wallet roles must be tested with the exact required wallet count.
>
> **Rules:**
> - 1-wallet feature = real MetaMask wallet test.
> - 2-wallet feature = Wallet A + Wallet B, real on-chain actions, UI/CLI/ChainScan cross-check.
> - 3-wallet feature = creator + buyer + treasury/admin, real payment/split/receipt proof.
> - Do not claim "fully working" if only contracts or CLI were tested.
> - Do not claim UI coverage if Wallet B/C was not imported into MetaMask and used through Studio.
> - Every multi-wallet row in Ivaronix_User_QA_Test_Plan.md must become PASS, PENDING, or BLOCKED with proof.
> - Before stopping, audit QA_PROOF_PACK and list every remaining 2-wallet/3-wallet gap.
>
> **The goal is not to reduce the number of gaps. The goal is to prove the product works exactly how real users will use it. No shortcut, no simulated claim, no "mostly proven."**

## Status taxonomy (only these 3 states are valid)

| State | What it means | Required artifacts |
|---|---|---|
| `PASS` | Real user could replay it. Real MetaMask, real wallet, real UI/CLI/ChainScan cross-check. | Real tx hash on chainscan + screenshot OR video of MetaMask popup + Studio render OR CLI output |
| `PENDING` | Agent has tried but coverage is partial (e.g. chain-only proof, no UI capture, or untested at all). | Exact remaining work named + a concrete next-step command |
| `BLOCKED` | Truly external dependency unblocks (browser-extension automation work, paid quota, second machine, etc.). | Concrete unblock action + named blocker |

## Anti-patterns (never describe a test as any of these)

- "mostly proven" — say PASS or PENDING
- "works in principle" — say PENDING with the concrete missing flow
- "covered by chain-level proof" — chain-only proof on a multi-wallet feature is PENDING per these rules, not PASS
- "should work because the contract reverts" — only PASS once the user-facing surface is exercised through real MM

## Compounding rule

For 2-wallet features, ALL three of the following must be true for `PASS`:
1. Real on-chain action (chainscan-verifiable tx hash)
2. UI surface exercised through real MetaMask with Wallet B imported (screenshot + video)
3. CLI cross-check matches the UI result

For 3-wallet features, add a fourth:
4. The third wallet's role (treasury / admin / second grantee) is exercised through real MetaMask too.

## How this rule changes the audit

Pre-iter-133, the proof artifact `QA_PROOF_PACK/multi-wallet/2-wallet-grant-proof.md` claimed "5 of 29 plan rows proven on chain." Per these rules, **all 5 of those are PENDING, not PASS** — they're chain-proven but UI side never exercised with Wallet B imported into a real MetaMask.

The honest count post-iter-133 is **0 of 14 multi-wallet rows at PASS**. Every multi-wallet row is currently PENDING or BLOCKED.

See `QA_PROOF_PACK/multi-wallet/MATRIX_AUDIT.md` for the full per-row breakdown.

## Reading order

1. This doc (rules)
2. `Ivaronix_User_QA_Test_Plan.md` §54 "Real Human Testing Mandate" (the original plan-level mandate these rules sharpen)
3. `QA_PROOF_PACK/multi-wallet/MATRIX_AUDIT.md` (per-row state)
4. `QA_PROOF_PACK/multi-wallet/2-wallet-grant-proof.md` (chain-level proofs as supporting evidence for the PENDING rows that have chain-side done)
