# Solidity choices

> Why every Ivaronix contract is direct-deploy, non-upgradeable, and has no governance multisig. Companion: `docs/CRYPTO_NOTES.md` for primitive-level threat models.

## Why direct deploy, not minimal proxies

**Receipts are the product.** Every receipt is a permanent statement about what happened. If the contract that anchored the receipt can be silently changed under the receipt's feet, the receipt's trust property collapses.

A proxy pattern (EIP-1167 minimal-proxy clones, OpenZeppelin TransparentUpgradeableProxy, UUPS, Diamond) introduces an upgrade path. Even if the upgrade is governance-gated, the upgrade EXISTS. A future upgrade could change the meaning of `anchor()` or `getReceipt(id)`. A receipt anchored today against contract bytecode X is anchored against the LOGIC of X. If X gets replaced with X', every historical receipt now refers to X' even though it was issued under X.

We chose direct deploy and no upgradeability for the receipt-anchoring contracts:
- `ReceiptRegistry` (V1)
- `ReceiptRegistryV2` (EIP-712 anchor signature recovery)
- `ReceiptRegistryV3` (admits receipt-type slots 10-12)
- `IvaronixReceiptGuard` (the library that gates external contracts on a real receipt)

The contract code is as immutable as the receipts it anchors. A scanner checking the registry on chainscan sees the bytecode that was deployed. That bytecode never changes. The receipts under it never change. Trust holds.

## Where proxies make sense (and where they don't)

The proxy choice is right when the trust property is "this clone is parameterised but the logic is shared" — that's the per-user-vault use case in fund-management protocols. The trust property is wrong for receipt anchoring, which says "this receipt was anchored against this exact logic." We accept the per-block deploy cost rather than the proxy admin surface.

## Marketplace contracts: same lean

`SkillRegistry`, `CapabilityRegistry`, `MemoryAccessLog`, `SubscriptionEscrow` are all direct-deploy too. Same reasoning, lower stakes:
- `SkillRegistry` anchors skill manifests; an upgrade could redefine "this skill version" silently.
- `CapabilityRegistry` issues memory-access grants; an upgrade could redefine "consumeRead" semantics.
- `MemoryAccessLog` is event-only; an upgrade could change which events emit.
- `SubscriptionEscrow` holds funds + governs cadence; an upgrade has direct money risk.

The V2 contracts (CapabilityRegistryV2, MemoryAccessLogV2, SubscriptionEscrowV2) are NEW contracts at NEW addresses, not upgrades. V1 stays live for legacy state. New writes go to V2.

## Per-block gas limit

0G's per-block gas limit is meaningful. The deployed contracts total enough bytecode that we sequence the deploys across multiple blocks rather than batching them into proxies.

## Optional `via_ir = true` for production

`contracts/foundry.toml:9` ships `via_ir = false` today. Enabling `via_ir = true` reduces per-contract bytecode by roughly 20% via the IR optimisation pipeline. Slower compile (about 2x) but cheaper deploy. Mainnet redeploys toggle this on; testnet stays at false to keep CI compile times fast.

## What we explicitly do not have

- **No governance multisig.** The contracts have a single owner — the operator wallet. The owner can `pause()` (emergency stop) and `addAuthorizedRecorder` (operational config). No fund transfers, no logic changes, no parameter migrations. Smaller surface, smaller attack surface.
- **No timelock.** No 7-day cooldown on owner actions. The owner is one wallet; if it's compromised, the timelock would only delay damage, not prevent it. Mitigation is wallet hygiene + chain-smoke regression detection (see `.github/workflows/chain-smoke.yml`).
- **No proxy admin.** Direct deploys have no admin role to compromise.

## What this costs us in flexibility

If we ship a critical bug in `ReceiptRegistryV2`, we can't patch in place. We have to deploy V3, migrate readers, and leave V2 receipts on the legacy contract — same migration shape as the V1 → V2 transition. We accept the cost because the alternative (silent in-place upgrades) destroys the receipt trust property.

## Mainnet posture

The mainnet V2 and V3 contracts ship with the same direct-deploy, no-upgradeability, no-multisig, no-timelock posture as testnet. Operators reading the mainnet bytecode see the same trust shape as testnet's. Auditors review the same logic. Receipts on mainnet inherit the same immutability claim as receipts on testnet.
