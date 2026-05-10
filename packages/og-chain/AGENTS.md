# `@ivaronix/og-chain` — agent guidance

> Per planning-003 §A.5.2. Path-scoped specifics live in `.claude/rules/og-chain.md` (auto-loaded when editing files here).

## Stack at a glance

- ethers v6 throughout.
- RPC: `https://evmrpc-testnet.0g.ai` (Galileo · chainId 16602) or `https://evmrpc.0g.ai` (Aristotle mainnet · chainId 16661).
- Deployed addresses live in `contracts/deployments/{testnet,mainnet}.json`; read via `getDeployedAddress(network, 'ContractName')` from `src/deployments.ts`.

## Hard rules

- **V2-first read pattern.** Every read path queries V2 first, falls back to V1. NEVER call `ReceiptRegistryClient` directly outside the helper. Pattern lives in `apps/studio/src/lib/chain.ts` (`unifiedX` family) and `apps/cli/src/commands/receipt.ts` (`buildReadRegistries`).
- **EIP-712 typed-data domain for V2 anchors.** Domain is `EIP712("Ivaronix.ReceiptRegistry", "2")`. Pinned per `contracts/src/ReceiptRegistryV2.sol` constructor. Off-chain signers MUST match this domain or `anchor()` reverts on signature recovery.
- **`signTypedData(domain, types, value)`** for V2 anchor. Wallet recovers `agentAddress` from the signature; relayer is `msg.sender`. Per-agent monotonic nonces prevent replay.

## Hot files

- **V1 client:** `src/contracts/ReceiptRegistry.ts`.
- **V2 client:** `src/contracts/ReceiptRegistryV2.ts` (EIP-712 anchor flow).
- **Deployments:** `src/deployments.ts` (reads `contracts/deployments/*.json`).
- **Studio reads:** `apps/studio/src/lib/chain.ts`.
- **CLI reads:** `apps/cli/src/commands/receipt.ts`.

## Common gotchas

- Galileo node block-time ~3s. Don't tight-loop; use `wait()` on tx response.
- ChainID type is `number`, not `bigint`. Convert when interfacing with viem.
- Provider initialisation: pass `{ chainId, name }` to `JsonRpcProvider` so ethers doesn't do an `eth_chainId` round-trip on every call.

## Test command

```bash
pnpm --filter @ivaronix/og-chain typecheck
pnpm --filter @ivaronix/og-chain test
# Live anchor smoke (real testnet + receipt cost ~0.0001 OG):
pnpm tsx scripts/qa/metamask-e2e/verify-v2-anchor-live.ts
```

## See also

- `.claude/rules/og-chain.md` — full V1 vs V2 client-selection pattern.
- `docs/MAINNET_READINESS.md` — promotion checklist.
