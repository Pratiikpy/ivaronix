# Ivaronix Payment Strategy

## Core Decision

Do not build a big marketplace first.

The best payment feature for Ivaronix is one clean paid verified work flow:

**Paid Verified Skill Run**

Users pay 0G to run one trusted skill and receive a verifiable receipt proving what happened.

## Best First Paid Skill

**Private Code Risk Review**

Why this is the best first paid skill:

- Developers and Web3 teams already understand code risk.
- 0G hackathon judges understand code, proof, hashes, and receipts.
- It fits both Studio and CLI.
- It solves a real painful job before shipping.
- It creates a shareable proof page without exposing private code.

Positioning:

> Teams can run a private AI code/security review before shipping and receive a public verification receipt proving the review happened, while the underlying repo and evidence stay encrypted.

## Why This Has Product Value

This improves Product Value & Market Potential because it shows:

- **Market fit:** teams already pay for code/security review.
- **User value:** user gets a useful report and proof.
- **Business model:** Ivaronix can earn per verified run.
- **Growth roadmap:** private workroom -> verified skills -> paid AI services.
- **0G-native value:** payment, compute, storage, and proof all happen through the 0G-centered stack.

## User Flow

1. User connects wallet.
2. User uploads repo/code or selects a repo audit task.
3. User chooses **Private Code Risk Review**.
4. UI shows price in 0G.
5. User pays with 0G token.
6. Ivaronix runs the skill using the selected model path.
7. Evidence is encrypted and stored through 0G Storage.
8. Receipt is anchored on 0G Chain.
9. User receives:
   - human-readable report
   - severity summary
   - receipt page
   - payment proof
   - verification status

## Receipt Fields

The paid skill receipt should include:

- skill name
- skill version
- payer wallet
- creator/operator wallet
- price paid
- payment tx hash
- model/provider
- TIER 1 or TIER 2 trust label
- TEE verification status if available
- input hash
- encrypted evidence root
- output hash
- finding count
- severity summary
- receipt tx hash
- verification status

## Public Proof Page

The public page should show:

- "Ivaronix verified review completed"
- project or repo name
- skill used
- model used
- timestamp
- verification status
- payment status
- receipt tx
- evidence status: encrypted/private
- severity summary

Important:

Do not expose private code or private report content unless the user chooses to share it.

## Payment Method

Use **native 0G token first**.

Why:

- It is simple.
- It is 0G-native.
- It strengthens the hackathon story.
- 0G Chain is EVM, so a payable contract can record payments.
- 0G resources include native-token marketplace and escrow examples.

Later options:

- Wrapped 0G / W0G for ERC20-style flows.
- USDC.e on 0G if needed.
- Circle / Arc / Nanopayments only as a separate future path, not the center of the 0G hackathon submission.

## What 0G Provides

0G supports this direction through:

- **0G Chain:** payable contracts, receipt registry, payment tx, skill run record.
- **0G Compute / Private Computer:** model inference and TEE-capable verification.
- **0G Storage:** encrypted evidence and receipt artifacts.
- **0G Router Payment Layer:** 0G token deposit and usage billing for model calls.
- **Direct Compute SDK ledger:** deposit, transfer to provider sub-account, refund, provider settlement.
- **AgenticID marketplace examples:** native-token escrow, EIP-712 signed orders, fee splits, seller proceeds.
- **Wrapped 0G:** ERC20-style native 0G compatibility for later DeFi/payment flows.

## What Not To Build Now

Avoid these before the core product is fully launched:

- full marketplace
- many paid skills
- creator discovery pages
- complex revenue splits
- USDC/Circle/Arc-first flow
- fake payment metadata
- token-heavy UX
- generic "trusted AI review"

## Best Implementation Scope

Build one first-party paid skill:

**Private Code Risk Review**

Minimum real version:

- one payable contract or payment function
- one skill price
- one operator/creator wallet
- one paid run button
- one payment tx
- one receipt tx
- proof page shows both payment and AI receipt

That is enough to prove the economic loop without distracting from Ivaronix's main story.

## PMF Summary

The PMF is not "payment."

The PMF is:

> A painful private workflow + a useful AI deliverable + a shareable proof receipt.

Payment makes the workflow stronger because it proves the AI action has economic value.

## Final Recommendation

For the 0G hackathon:

1. Finish mainnet deployment and QA first.
2. Make private workroom + receipts flawless.
3. Add one paid verified skill only if it can be real, simple, polished, and fully tested.
4. Use native 0G token first.
5. Keep the story centered on verifiable private AI work, not marketplace hype.

