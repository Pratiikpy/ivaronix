# `contracts/` — agent guidance

> Per planning-003 §A.5.2. Path-scoped specifics live in `.claude/rules/contracts.md` (auto-loaded when editing files here).

## Stack at a glance

- Solidity 0.8.20 + EVM `cancun` per `foundry.toml`. Do NOT change without approval.
- Foundry forge for build/test.
- Direct deploy + no upgradeability per `docs/SOLIDITY_CHOICES.md`. V2 = new contract at new address; V1 stays for legacy state.

## Hard rules

- **NO sprint-language in NatSpec.** No `Day-N`, `Phase A/B/C`, `K-N fix`, `planning-0N §X`, `MVP`, `killer demo`, `Track N headline`. NatSpec compiles into permanent contract metadata; sprint references fossilize. Use capability statements + roadmap phrasing.
- **Threat-model NatSpec** required on every security-sensitive contract: `Threat model:` block listing what the contract defends + what it does NOT defend + assumed attacker capabilities.
- **`*.t.sol` test-keys-only namespace warning** at top of file (after pragma) per planning-003 §A.3.7. Test private keys are deterministic hex-pattern fills (`0xA1A1_AAAA_...`). Never use real keys.

## V1 → V2 migration pattern

When a security finding requires a contract change:
1. Ship the V2 at a new address.
2. V1 stays live for legacy state (chain history is immutable, no rewrites).
3. Off-chain readers branch on `chainAnchor.registryAddress`.
4. CLI + Studio readers query V2 first, V1 fallback.
5. Document the migration in `CHANGELOG.md` with `Closes audit K-N` commit trailer.

## Per-block gas budget

0G's per-block gas limit is meaningful. When deploying multiple contracts, sequence them across blocks rather than batching. Aegis Vault uses EIP-1167 minimal proxies for the user-vault layer (per `docs/SOLIDITY_CHOICES.md`); we explicitly chose direct-deploy + multi-block sequencing.

`via_ir = false` in foundry.toml today (testnet · faster compile). Mainnet redeploy enables `via_ir = true` for ~20% bytecode reduction.

## Address resolution

`getDeployedAddress(network, 'ContractName')` per `packages/og-chain/src/deployments.ts`. Do NOT hardcode addresses in CLI or Studio. New deployments update `contracts/deployments/<network>.json`.

## Hot files

- Contracts: `src/<Name>.sol`
- Tests: `test/<Name>.t.sol`
- Deploy scripts: `script/Deploy<Name>.s.sol`
- Address records: `contracts/deployments/{testnet,mainnet}.json`
- Library imports: `lib/openzeppelin-contracts/...`

## Test command

```bash
forge build --root contracts
forge test --root contracts -vvv
# Live deploy (operator action, costs OG):
forge script --root contracts script/Deploy<Name>.s.sol --broadcast --rpc-url $IVARONIX_RPC_URL
```

## See also

- `.claude/rules/contracts.md` — full Foundry test discipline + V1→V2 pattern.
- `docs/SOLIDITY_CHOICES.md` — direct-deploy + no-upgradeability rationale.
- `docs/MAINNET_READINESS.md` — pre-mainnet checklist.
