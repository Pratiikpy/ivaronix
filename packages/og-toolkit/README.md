# `@ivaronix/og-toolkit`

> Receipt-aware-by-default DX wrappers for 0G.
>
> One import. Every action that flows through this toolkit can produce a verifiable Action Receipt anchored on 0G Chain.

## Install

```bash
pnpm add @ivaronix/og-toolkit
# or: npm i @ivaronix/og-toolkit / yarn add @ivaronix/og-toolkit
```

## Quickstart (testnet, ~30 seconds)

```ts
import { createOg } from '@ivaronix/og-toolkit';

const og = createOg({
  network: 'testnet',
  privateKey: process.env.OG_PRIVATE_KEY,
});

// 1. Raw 0G primitives — same surface as the official SDKs
await og.chain.verifyChainId();
await og.storage.upload(myBuffer);

// 2. Receipt-aware: skill run + on-chain anchor in one call
const r = await og.runSkill({
  skillId: 'github-audit',
  userPrompt: 'Find the worst security flaw',
  context: solidityCode,
  tier: 'standard',
  receipt: true,
});
console.log(r.finalText);
console.log('Receipt anchored at', r.receiptTxHash);
```

## Why receipt-aware?

`@0glabs/0g-ts-sdk` + `@0gfoundation/0g-compute-ts-sdk` give you raw 0G primitives. Bare wrappers like `0g-kit` thin those down. **`@ivaronix/og-toolkit` adds the receipt spine**: every `runSkill` call produces a signed Action Receipt that:

- references the skill id, version, and **on-chain manifest hash**
- includes the TEE attestation reference for the inference
- carries a convergence score across consensus roles
- anchors a Merkle root in the `ReceiptRegistry` contract on 0G Chain
- is independently verifiable with `ivaronix receipt verify --tee-independent`

Anyone can hand a receipt URL to anyone else and they verify it themselves — no daemon, no Ivaronix login.

## API surface

| Member             | What it is                                                                                  |
|--------------------|---------------------------------------------------------------------------------------------|
| `og.chain`         | `ethers` JsonRpcProvider + Wallet preconfigured for the chosen 0G network                   |
| `og.storage`       | 0G Storage client (upload / download / proof)                                               |
| `og.compute`       | 0G Router keyring (OpenAI-compatible chat) when `routerCredentials` is supplied             |
| `og.kv`            | 0G KV client                                                                                |
| `og.runSkill(...)` | Full receipt-aware pipeline: scanner → sandbox → hooks → consensus → sign → anchor → record |

## Networks

| Name      | chainId | RPC                                | Explorer                          |
|-----------|---------|------------------------------------|-----------------------------------|
| testnet   | 16602   | <https://evmrpc-testnet.0g.ai>     | <https://chainscan-galileo.0g.ai> |
| mainnet   | 16661   | <https://evmrpc.0g.ai>             | <https://chainscan.0g.ai>         |

## License

Apache-2.0 © Ivaronix contributors. See [LICENSE](../../LICENSE).
