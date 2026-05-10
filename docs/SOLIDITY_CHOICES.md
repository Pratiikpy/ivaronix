# Solidity choices

> Why every Ivaronix contract is direct-deploy, non-upgradeable, no-governance-multisig. Closes planning-003 §A.4.6 (wandering thought #87). Companion: `docs/CRYPTO_NOTES.md` for primitive-level threat models.

## Why direct deploy, not minimal proxies

**Receipts are the product.** Every receipt is a permanent statement about what happened. If the contract that anchored the receipt can be silently changed under the receipt's feet, the receipt's trust property collapses.

A proxy pattern (EIP-1167 minimal-proxy clones, OpenZeppelin TransparentUpgradeableProxy, UUPS, Diamond) introduces an upgrade path. Even if the upgrade is governance-gated, the upgrade EXISTS. A future upgrade could change the meaning of `anchor()` or `getReceipt(id)`. A receipt anchored today against contract bytecode X is anchored against the LOGIC of X. If X gets replaced with X', every historical receipt now refers to X' even though it was issued under X.

We chose direct deploy + no upgradeability for the receipt-anchoring contracts:
- `ReceiptRegistry` (V1)
- `ReceiptRegistryV2` (K-2 EIP-712 fix)
- `IvaronixReceiptGuard` (the library that gates external contracts on a real receipt)

The contract code is as immutable as the receipts it anchors. A scanner checking `chainscan-galileo.0g.ai/address/<receipt-registry>` sees the bytecode that was deployed. That bytecode never changes. The receipts under it never change. Trust holds.

## Aegis Vault made the same call

`entries/aegis-vault/README.md` ships 235 Hardhat tests + EIP-1167 minimal proxies + sealed-strategy commit-reveal on 0G mainnet. They explicitly cite "no upgradeable backdoor" as a virtue. They use proxies for the user-vault layer (every user gets their own vault clone) but the trust-root contracts (`OperatorRegistry`, `Reputation`, `InsurancePool`, `AegisGovernor`) are direct-deploy. Same architectural lean as Ivaronix on the trust root.

The proxy choice is right when the trust property is "this CLONE is parameterised but the LOGIC is shared." That's the user-vault use case. The trust property is wrong for receipt anchoring, which says "this RECEIPT was anchored against THIS LOGIC."

## Marketplace contracts: same lean

`SkillRegistry`, `CapabilityRegistry`, `MemoryAccessLog`, `SubscriptionEscrow` are all direct-deploy too. Same reasoning, lower stakes:
- `SkillRegistry` anchors skill manifests; an upgrade could redefine "this skill version" silently.
- `CapabilityRegistry` issues memory-access grants; an upgrade could redefine "consumeRead" semantics.
- `MemoryAccessLog` is event-only; an upgrade could change which events emit.
- `SubscriptionEscrow` holds funds + governs cadence; an upgrade has direct money risk.

The V2 contracts (CapabilityRegistryV2, MemoryAccessLogV2, SubscriptionEscrowV2) are NEW contracts at NEW addresses, not upgrades. V1 stays live for legacy state. New writes go to V2.

## Per-block gas limit

0G's per-block gas limit is meaningful. 8 contracts × full bytecode = a lot of gas. We deploy across multiple blocks rather than batching into proxies. Aegis Vault explicitly cites "0G's per-block gas limit is respected" as their reason for proxies; we cite "deploy across multiple blocks" as our reason for direct deploys. Same constraint, different solve.

## Optional `via_ir = true` for production

`contracts/foundry.toml:9` ships `via_ir = false` today. Enabling `via_ir = true` reduces per-contract bytecode by ~20% via the IR optimisation pipeline. Slower compile (~2x) but cheaper deploy. Mainnet redeploy will toggle this on; testnet stays at false to keep CI compile times fast.

## What we explicitly DON'T have

- **No governance multisig.** The contracts have a single owner — the operator wallet. `AegisGovernor` (Aegis's governance multisig) has no Ivaronix equivalent. The owner can `pause()` (emergency stop) + `addAuthorizedRecorder` (operational config), nothing else. No fund transfers, no logic changes, no parameter migrations. Smaller surface = smaller attack surface.
- **No timelock.** No 7-day cooldown on owner actions. The owner is one wallet; if it's compromised, the timelock would only delay damage, not prevent it. Mitigation is wallet hygiene + chain-smoke regression detection (see `.github/workflows/chain-smoke.yml`).
- **No proxy admin.** Direct deploys have no admin role to compromise.

## What this costs us in flexibility

If we ship a critical bug in `ReceiptRegistryV2`, we can't patch in place. We have to deploy V3 + migrate readers + leave V2 receipts on the legacy contract. That's expensive — same migration shape as the K-2 V1 → V2 transition. We accept the cost because the alternative (silent in-place upgrades) destroys the receipt trust property.

## Mainnet posture

When K-1 + K-2 V2 contracts deploy to mainnet (USER_TODO §A-V2-K1, §A-V2-K2), they ship with the same direct-deploy + no-upgradeability + no-multisig + no-timelock posture as testnet. Operators reading the mainnet bytecode see the same trust shape as testnet's. Auditors review the same logic. Receipts on mainnet inherit the same immutability claim as receipts on testnet.

ChainGPT audit (USER_TODO §C-2) runs against the V2 contracts before mainnet promotion. The audit verifies the trust posture matches the documentation.
