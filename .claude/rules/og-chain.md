# 0G Chain rules

> Auto-loads when working on `packages/og-chain/**`. Path-scoped guidance per planning-003 §A.4.2.

## Stack

- ethers v6 throughout.
- RPC: `https://evmrpc-testnet.0g.ai` (Galileo · chainId 16602) · `https://evmrpc.0g.ai` (Aristotle mainnet · chainId 16661).
- Address records: `contracts/deployments/{testnet,mainnet}.json`. Read via `getDeployedAddress(network, 'ContractName')` from `packages/og-chain/src/deployments.ts`.

## Hard rules

- **V2-first read pattern.** Every read path queries V2 first, falls back to V1. Never call `ReceiptRegistryClient` directly outside the helper. Pattern lives in `apps/studio/src/lib/chain.ts` (`unifiedX` family) and `apps/cli/src/commands/receipt.ts` (`buildReadRegistries`).

- **EIP-712 typed-data domain for V2 anchors.** Domain is `EIP712("Ivaronix.ReceiptRegistry", "2")`. Constructor pinned per `contracts/src/ReceiptRegistryV2.sol`. Off-chain signers MUST match this domain or `anchor()` reverts on signature recovery.

- **`signTypedData(domain, types, value)`** for V2 anchor. Wallet recovers `agentAddress` from the signature; relayer is `msg.sender`. Per-agent monotonic nonces prevent replay.

- **Anchor-write path** stays V1-friendly during migration. `pipeline.ts` checks `chainAnchor.registryAddress` and routes to the right anchor function. New anchors target V2; legacy receipts on V1 stay readable.

## V1 vs V2 client selection

```ts
import { ReceiptRegistryClient, ReceiptRegistryV2Client, getDeployedAddress } from '@ivaronix/og-chain';

const v2Addr = getDeployedAddress(network, 'ReceiptRegistryV2');
const v1Addr = getDeployedAddress(network, 'ReceiptRegistry');

// Read: V2 first, V1 fallback.
const provider = new JsonRpcProvider(rpcUrl);
const registries = [
  v2Addr ? { client: new ReceiptRegistryV2Client(v2Addr, provider), version: 'v2' } : null,
  v1Addr ? { client: new ReceiptRegistryClient(v1Addr, provider), version: 'v1' } : null,
].filter(Boolean);

for (const r of registries) {
  const found = await r!.client.getReceipt(id);
  if (found) return { ...found, registryVersion: r!.version };
}
```

## Common gotchas

- Galileo node block-time ~3s. Don't spin in tight loops; use `wait()` on tx response.
- ChainID type: `number`, not `bigint`. Convert when interfacing with viem.
- Provider initialisation: pass `{ chainId, name }` to `JsonRpcProvider` so ethers doesn't do an `eth_chainId` round-trip on every call.

## Tests

`packages/og-chain/test/` — vitest. Run via `pnpm --filter @ivaronix/og-chain test`.

## File location reference

- Client: `packages/og-chain/src/contracts/ReceiptRegistry.ts` (V1) · `ReceiptRegistryV2.ts` (V2)
- Deployments: `packages/og-chain/src/deployments.ts` (reads from `contracts/deployments/*.json`)
- Studio reads: `apps/studio/src/lib/chain.ts`
- CLI reads: `apps/cli/src/commands/receipt.ts`
