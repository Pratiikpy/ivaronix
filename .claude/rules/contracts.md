# Contracts rules

> Auto-loads when working on `contracts/**`. Path-scoped guidance per planning-003 §A.4.2 (AlphaDawg pattern).

## Hard rules

- **Solidity 0.8.20 + EVM `cancun`** per `contracts/foundry.toml`. Do NOT change without approval.
- **NO sprint-language in NatSpec.** No `Day-N`, `Phase A/B/C`, `K-N fix`, `planning-0N §X`, `MVP`, `killer demo`, `Track N headline`. NatSpec compiles into permanent contract metadata; sprint references fossilize. Use capability statements + roadmap phrasing.
- **Direct deploy + no upgradeability** per `docs/SOLIDITY_CHOICES.md`. No proxy patterns on receipt-anchoring contracts. V2 = new contract at new address, NOT upgrade.
- **Threat-model NatSpec** required on every security-sensitive contract: `Threat model:` block listing what the contract defends + what it does NOT defend + assumed attacker capabilities. Pattern: `CapabilityRegistry.sol`, `MemoryAccessLog.sol`, `Erc7857Verifier.sol`.

## Foundry test discipline

- Every `*.t.sol` carries the test-keys-only namespace warning (top of file, after pragma) per planning-003 §A.3.7.
- Test private keys are deterministic hex-pattern fills (`0xA1A1_AAAA_...`, `0xB0B0_BBBB_...`, `0xA77E5707_...`). Never use real keys.
- Test names: `test_<TaskID>_<Behaviour>` (e.g. `test_K2_HappyPath_SignerIsAgent`, `test_K1_RejectSelfClaimedTrustScore`).
- Use `vm.expectRevert(bytes("<message>"))` for revert assertions; match exact strings from the contract.
- Helper-contract pattern (e.g. `GuardCaller` in `IvaronixReceiptGuard.t.sol`) wraps library functions so `vm.expectRevert` can target them at an external entry point.

## V1 → V2 migration pattern

When a security finding requires a contract change:
1. Ship the V2 contract at a new address (e.g. `ReceiptRegistryV2`, `AgentPassportINFTV2`).
2. V1 stays live for legacy state — chain history is immutable, no rewrites.
3. Off-chain readers branch on `chainAnchor.registryAddress` to choose V1 vs V2 behaviour.
4. CLI + Studio readers query V2 first, V1 fallback (per `apps/studio/src/lib/chain.ts` `unifiedX` helpers and `apps/cli/src/commands/receipt.ts` `buildReadRegistries`).
5. Document the migration in `CHANGELOG.md` with `Closes audit K-N` commit trailer.

## Per-block gas budget

0G's per-block gas limit is meaningful. When deploying multiple contracts, sequence them across blocks rather than batching. Aegis Vault uses EIP-1167 minimal proxies for the user-vault layer (per `docs/SOLIDITY_CHOICES.md`); we explicitly chose direct-deploy + multi-block sequencing.

`via_ir = false` in foundry.toml today (testnet · faster compile). Mainnet redeploy enables `via_ir = true` for ~20% bytecode reduction.

## Address resolution

`getDeployedAddress(network, 'ContractName')` per `packages/og-chain/src/deployments.ts`. Do NOT hardcode addresses in CLI or Studio. New deployments update `contracts/deployments/<network>.json`.

For V2-first lookup pattern:
```ts
const v2 = getDeployedAddress(network, 'ReceiptRegistryV2');
const v1 = getDeployedAddress(network, 'ReceiptRegistry');
// Try V2 first, fall back to V1.
```

## File location reference

- Contracts: `contracts/src/<Name>.sol`
- Tests: `contracts/test/<Name>.t.sol`
- Deploy scripts: `contracts/script/Deploy<Name>.s.sol`
- Address records: `contracts/deployments/{testnet,mainnet}.json`
- Library imports: `contracts/lib/openzeppelin-contracts/...`
