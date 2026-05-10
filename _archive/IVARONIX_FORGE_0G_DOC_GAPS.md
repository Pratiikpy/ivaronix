# Ivaronix Forge 0G Official Docs Addendum

## Purpose

This document is the second pass over the official local 0G docs at `oglabs resources/0g-doc`, focused only on what the Ivaronix Forge CLI may be missing.

The existing CLI plan is directionally correct: Forge should use an OpenCode/Hermes-style terminal UX, Octogent-style scoped workspaces, portable skills, durable memory, 0G Router inference, 0G Storage proofs, and 0G Chain receipts.

The missing part is mostly not product vision. The missing part is operational detail: balances, provider routing, TEE verification, model capability checks, storage encryption behavior, error handling, network profiles, and future Direct/DA/INFT hooks.

## Final Verdict

Ivaronix Forge is buildable on 0G.

For MVP, use:

- 0G Router / Private Computer for inference.
- 0G Storage for encrypted docs, receipt JSON, memory snapshots, code snapshots, and skill artifacts.
- 0G Chain for receipt anchoring and agent/passport hashes.
- Router `verify_tee: true` for first proof mode.
- Independent TEE verification as the higher-trust receipt verification mode.

Do not build the full Direct Compute path, full DA integration, full INFT marketplace, image generation, audio transcription, fine-tuning, teams, payments, or 100 skills in the first build. Design hooks for them, but keep the first CLI demo narrow and deep.

## Highest Priority Missing Items

### 1. Add Independent TEE Receipt Verification

The current plan mentions `verify_tee: true`, but official Router docs show a stronger path.

Router verification gives a convenient field in `x_0g_trace.tee_verified`, but this means we are trusting the Router to say it verified the provider signature.

Forge should add a second verification mode:

```bash
ivaronix receipt verify <receipt-id> --tee-independent
ivaronix compute verify-tee <request-id>
```

What this should do:

- Capture the raw response header `ZG-Res-Key` from Router responses.
- Store the final provider address from `x_0g_trace.provider`.
- Store the model ID.
- Use `@0gfoundation/0g-compute-ts-sdk` and `broker.inference.processResponse(providerAddress, chatID)` for independent verification.
- Record the result inside the receipt as separate from Router's own `tee_verified` field.

Receipt fields to add:

```json
{
  "teeVerification": {
    "requested": true,
    "routerVerified": true,
    "independentVerified": null,
    "providerAddress": "0x...",
    "chatId": "ZG-Res-Key header or response id",
    "verificationMethod": "router_flag | compute_sdk_process_response"
  }
}
```

Why it matters:

This is a real 0G-native differentiator. Most projects stop at "TEE verified" as a label. Forge can prove the provider signature after the fact from the CLI.

### 2. Add Router Balance And Usage Commands

The official docs make it clear that Router uses the 0G Payment Layer, not Direct Compute provider subaccounts.

Forge needs commands for this:

```bash
ivaronix compute balance
ivaronix compute usage --today
ivaronix compute usage --history
ivaronix doctor --router
```

Use:

- `GET /v1/account/balance`
- `GET /v1/account/usage/stats?start_date=...`
- `GET /v1/account/usage/history?limit=20&offset=0`

Store exact costs in receipts:

```json
{
  "billing": {
    "inputTokens": 1234,
    "outputTokens": 500,
    "inputCostNeuron": "61700000000000",
    "outputCostNeuron": "50000000000000",
    "totalCostNeuron": "111700000000000",
    "totalCostOg": "0.0001117"
  }
}
```

Important details:

- Router API key is tied to a wallet and spends the deposited 0G balance.
- Never expose Router API keys to browsers.
- API keys currently behave like full inference keys, so the CLI should support local `.env` and system secret storage later.
- `402 insufficient_balance` should produce a clear CLI message, not a generic failure.

### 3. Separate Router Balance From Direct Compute Balance

Official docs say Router and Direct balances are independent.

Forge must not confuse them.

CLI should show:

```bash
ivaronix compute balance --router
ivaronix compute balance --direct
ivaronix doctor --compute
```

MVP should implement only `--router`.

Future Direct mode can support:

- provider subaccount deposits
- provider selection
- `broker.inference`
- fine-tuning subaccounts
- direct wallet signing

But Direct mode should not block the first Forge release.

### 4. Add Model And Provider Catalog Commands

The official docs provide live model/provider endpoints and model capabilities.

Forge needs:

```bash
ivaronix models list
ivaronix models inspect qwen/qwen-2.5-7b-instruct
ivaronix providers list --model qwen/qwen-2.5-7b-instruct
ivaronix models prices
```

Use:

- `GET /v1/models`
- `GET /v1/providers?model=<model-id>`

Why this matters:

- Some models support tool calling, some do not.
- Some support JSON mode, some do not.
- Some support reasoning output.
- Some support image/audio endpoints, most chat models do not.
- Context length and max output must be checked before large repo/doc tasks.
- Consensus mode can estimate cost before it launches 3-5 model calls.

Forge should cache:

```json
{
  "model": "qwen/qwen-2.5-7b-instruct",
  "contextLength": 32768,
  "maxOutputTokens": 8192,
  "pricing": {
    "inputNeuronPerToken": "...",
    "outputNeuronPerToken": "..."
  },
  "capabilities": {
    "toolCalling": true,
    "jsonMode": true,
    "teeVerified": true,
    "reasoning": false
  },
  "providerCount": 1
}
```

### 5. Add Provider Routing Controls

Official Router supports default routing, latency sorting, price sorting, provider pinning, and fallback behavior.

Forge should expose:

```bash
ivaronix code "fix this bug" --provider-sort latency
ivaronix audit repo --provider-sort price
ivaronix doc ask contract.pdf "find risks" --provider 0xabc...
ivaronix doc ask contract.pdf "find risks" --allow-fallbacks
```

Receipt fields:

```json
{
  "providerRouting": {
    "requestedSort": "latency",
    "requestedProvider": null,
    "allowFallbacks": true,
    "finalProvider": "0x..."
  }
}
```

Why it matters:

This lets Forge become a serious developer tool, not just a wrapper. Developers can choose cheap mode, fast mode, pinned provider mode, or high-trust mode.

### 6. Add Strict Rate Limit And Retry Behavior

Router returns rate-limit headers and `Retry-After`.

Forge should implement:

- automatic backoff on `429`
- optional retry on `502`
- no blind retry on `400`, `401`, `402`, or `403`
- swarm queue throttling
- clear error explanations

Headers to capture when available:

- `X-RateLimit-Limit-Requests`
- `X-RateLimit-Remaining-Requests`
- `X-RateLimit-Reset-Requests`
- `Retry-After`

CLI behavior:

```bash
ivaronix doctor --router
ivaronix compute test
ivaronix swarm run todo.md --max-parallel 3
```

Swarm mode must not launch 20 parallel agents if Router is rate-limiting the account.

### 7. Add Storage Encryption Details Correctly

The docs include important SDK details that should be reflected in Forge.

Forge should support:

```bash
ivaronix storage upload file.pdf --encrypt aes --receipt
ivaronix storage upload file.pdf --encrypt wallet --recipient 0x...
ivaronix storage download <root> --proof
ivaronix storage peek <root>
ivaronix storage snapshot repo --encrypt aes
ivaronix storage diff <old-root> <new-folder>
```

Implementation details to remember:

- Use `@0gfoundation/0g-storage-ts-sdk`.
- Use `ZgFile.fromFilePath()` for file uploads.
- Use `MemData` for in-memory receipt JSON and memory snapshots.
- Call `file.merkleTree()` before upload so Forge can display/store root hash.
- Use `indexer.upload(file, RPC_URL, signer)`.
- Always close file handles after upload.
- Use `indexer.download(rootHash, outputPath, true)` for proof downloads.
- For encrypted files, use `downloadToBlob()` with decryption options.
- `indexer.download()` does not support decryption.
- `peekHeader(rootHash)` can detect encryption mode.
- Wrong decryption key may return ciphertext rather than throwing, so Forge must verify the encryption header and validate decrypted payload format.

Burn mode should use AES session-key encryption:

```bash
ivaronix doc ask contract.pdf "find risks" --burn --receipt
```

Burn Receipt should prove:

- file was encrypted before upload or processing
- storage root hash
- encryption mode
- session key fingerprint
- key destruction timestamp
- local temp/cache cleanup status

Do not claim:

- "deleted from blockchain"
- "deleted from 0G Storage"

Correct wording:

The encrypted data may remain stored, but the session key was destroyed, making the stored ciphertext unreadable.

### 8. Add Network Profiles

The CLI must support both 0G Galileo testnet and 0G Aristotle mainnet.

```bash
ivaronix config network testnet
ivaronix config network mainnet
ivaronix doctor --network
```

Testnet profile:

```env
OG_NETWORK=testnet
OG_CHAIN_ID=16602
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_CHAIN_EXPLORER=https://chainscan-galileo.0g.ai
OG_STORAGE_EXPLORER=https://storagescan-galileo.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api-testnet.integratenetwork.work/v1
```

Mainnet profile:

```env
OG_NETWORK=mainnet
OG_CHAIN_ID=16661
OG_RPC_URL=https://evmrpc.0g.ai
OG_CHAIN_EXPLORER=https://chainscan.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
OG_ROUTER_BASE_URL=https://router-api.0g.ai/v1
```

`doctor` should warn if a stale `16601` Galileo config appears anywhere.

### 9. Add Chain Deployment And Verification Commands

Forge receipts need a contract layer.

Official docs say 0G is EVM-compatible and should compile with modern EVM settings.

Commands:

```bash
ivaronix chain deploy-registry
ivaronix chain verify-contract <address>
ivaronix receipt anchor <receipt-root>
ivaronix receipt registry status
```

Implementation notes:

- Use Hardhat or Foundry.
- Configure testnet chain ID `16602`.
- Configure mainnet chain ID `16661`.
- Use `evmVersion: "cancun"` where relevant.
- Use ChainScan verification endpoints.

Receipt anchoring contract should stay simple:

- receipt hash
- receipt storage root
- agent ID
- owner wallet
- timestamp
- receipt type
- optional burn receipt hash

Do not put private data on-chain.

### 10. Add DA As A Future Receipt Scaling Path

DA is not MVP.

But the CLI architecture should reserve commands:

```bash
ivaronix da publish-events
ivaronix da verify <data-root>
```

Why:

- DA is better for high-volume agent event streams and batched receipt/event availability.
- Official DA docs require running DA Client/Encoder/Retriever infrastructure, so it is too heavy for first MVP.
- DA blob size and node setup make this a later scaling layer, not the first receipt system.

Use 0G Storage + Chain first.

Use 0G DA later for:

- batched action logs
- swarm event streams
- agent marketplace activity
- high-volume receipts
- appchain/rollup style use cases

### 11. Add INFT / ERC-7857 Hooks, Not Full Marketplace

INFT / ERC-7857 is relevant to Ivaronix, but not first CLI scope.

Future commands:

```bash
ivaronix passport mint-inft
ivaronix passport authorize <agent-id> --executor <address>
ivaronix passport transfer <agent-id> --to <wallet>
ivaronix passport clone <agent-id>
```

Important ERC-7857 concepts:

- encrypted metadata
- secure re-encryption during transfer
- TEE/ZKP oracle verification
- authorized usage without ownership transfer
- agent cloning

For MVP, use a simpler Agent Passport:

- local metadata
- 0G Storage root
- 0G Chain passport hash
- owner wallet
- skills installed
- receipts
- memory root

Later, upgrade the passport into ERC-7857 / INFT.

## Updated Forge CLI Command Map

### Compute And Models

```bash
ivaronix compute test
ivaronix compute balance
ivaronix compute usage --today
ivaronix compute usage --history
ivaronix compute verify-tee <receipt-id>
ivaronix models list
ivaronix models inspect <model>
ivaronix providers list --model <model>
```

### Private Docs And Burn Mode

```bash
ivaronix doc ask contract.pdf "find risky clauses" --burn --consensus --receipt
ivaronix doc ask deck.pdf "what are the investor risks?" --private --receipt
ivaronix receipt verify <receipt-id>
ivaronix receipt verify <receipt-id> --tee-independent
```

### Storage

```bash
ivaronix storage upload file.pdf --encrypt aes
ivaronix storage upload receipt.json --mem
ivaronix storage download <root> --proof
ivaronix storage peek <root>
ivaronix storage snapshot repo --encrypt aes
ivaronix storage diff <old-root> <path>
```

### Chain

```bash
ivaronix chain deploy-registry
ivaronix chain verify-contract <address>
ivaronix receipt anchor <receipt-root>
ivaronix receipt registry status
```

### Doctor

```bash
ivaronix doctor
ivaronix doctor --network
ivaronix doctor --router
ivaronix doctor --storage
ivaronix doctor --chain
```

## Updated Receipt Schema Fields

The current receipt schema should add these fields:

```json
{
  "network": {
    "name": "0G-Galileo-Testnet",
    "chainId": 16602,
    "rpcUrlHash": "sha256:...",
    "routerBaseUrl": "https://router-api-testnet.integratenetwork.work/v1"
  },
  "model": {
    "id": "qwen/qwen-2.5-7b-instruct",
    "contextLength": 32768,
    "maxOutputTokens": 8192,
    "capabilities": ["chat", "tool_calling", "tee_verified"]
  },
  "providerRouting": {
    "requestedSort": "latency",
    "requestedProvider": null,
    "allowFallbacks": true,
    "finalProvider": "0x..."
  },
  "routerTrace": {
    "requestId": "...",
    "zgResKey": "...",
    "x0gTrace": {},
    "rateLimit": {
      "limitRequests": null,
      "remainingRequests": null,
      "resetRequests": null
    }
  },
  "teeVerification": {
    "requested": true,
    "routerVerified": true,
    "independentVerified": null,
    "method": "router_flag"
  },
  "billing": {
    "inputTokens": 0,
    "outputTokens": 0,
    "inputCostNeuron": "0",
    "outputCostNeuron": "0",
    "totalCostNeuron": "0"
  },
  "storage": {
    "receiptRoot": "0x...",
    "receiptTxHash": "0x...",
    "proofDownloadVerified": false,
    "encryption": {
      "enabled": true,
      "type": "aes256",
      "headerDetected": true,
      "keyFingerprint": "sha256:..."
    }
  }
}
```

## MVP Changes After This Doc Pass

The MVP should remain narrow:

```text
Private docs/code -> 0G inference -> consensus -> burn mode -> receipt -> storage root -> chain anchor -> CLI verification
```

But add these hidden engineering requirements:

1. `models list/inspect` before serious model calls.
2. Router balance and usage checks.
3. Provider routing config.
4. Proper retry and rate-limit handling.
5. Storage encryption using documented SDK behavior.
6. Receipt capture of `ZG-Res-Key`, `x_0g_trace`, provider, billing, and rate-limit metadata.
7. Independent TEE verification path, even if first implemented as an advanced command.
8. Testnet/mainnet profiles with chain ID validation.

## What We Are Not Missing

The existing CLI plan already correctly includes:

- OpenCode-style TUI.
- Plan/build/audit/doc/swarm/watch/receipt modes.
- Octogent-style scoped workspace folders.
- Hermes-style memory, skills, scheduled agents, and long-running agent behavior.
- Portable skill manifests.
- 0G Router inference.
- 0G Storage receipts and encrypted artifacts.
- 0G Chain anchoring.
- Burn mode.
- Agent passport.

The official docs do not change the product direction. They make the implementation more precise.

## What To Avoid In The First Release

Do not build these first:

- full Direct Compute funding UI
- fine-tuning
- image generation
- audio transcription
- DA nodes or DA publishing
- ERC-7857 marketplace
- agent payments
- team workspace
- 100 skills

Build the trust loop first.

## Best First Demo Command

```bash
ivaronix doc ask contract.pdf "Find risky clauses and explain them simply" \
  --model qwen/qwen-2.5-7b-instruct \
  --provider-sort latency \
  --burn \
  --consensus \
  --verify-tee \
  --receipt
```

Expected output:

- concise legal/risk summary
- source citations
- model agreement/disagreement
- risk score
- burn receipt
- 0G Storage root
- 0G Chain transaction
- Router trace
- TEE verification status
- exact 0G cost

Then:

```bash
ivaronix receipt verify <receipt-id> --tee-independent
```

That is the CLI feature that feels most 0G-native.

## Source Docs Checked

Local official docs reviewed:

- `docs/ai-context.md`
- `docs/developer-hub/testnet/testnet-overview.md`
- `docs/developer-hub/mainnet/mainnet-overview.md`
- `docs/developer-hub/building-on-0g/storage/sdk.md`
- `docs/developer-hub/building-on-0g/storage/storage-cli.md`
- `docs/developer-hub/building-on-0g/compute-network/overview.md`
- `docs/developer-hub/building-on-0g/compute-network/inference.md`
- `docs/developer-hub/building-on-0g/compute-network/account-management.md`
- `docs/developer-hub/building-on-0g/compute-network/fine-tuning.md`
- `docs/developer-hub/building-on-0g/compute-network/router/quickstart.md`
- `docs/developer-hub/building-on-0g/compute-network/router/authentication.md`
- `docs/developer-hub/building-on-0g/compute-network/router/account/deposits.md`
- `docs/developer-hub/building-on-0g/compute-network/router/features/chat-completions.md`
- `docs/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution.md`
- `docs/developer-hub/building-on-0g/compute-network/router/routing.md`
- `docs/developer-hub/building-on-0g/compute-network/router/rate-limits.md`
- `docs/developer-hub/building-on-0g/compute-network/router/errors.md`
- `docs/developer-hub/building-on-0g/compute-network/router/models.md`
- `docs/developer-hub/building-on-0g/compute-network/router/features/image-generation.md`
- `docs/developer-hub/building-on-0g/compute-network/router/features/audio.md`
- `docs/developer-hub/building-on-0g/compute-network/router/comparison.md`
- `docs/developer-hub/building-on-0g/compute-network/router/principles.md`
- `docs/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts.md`
- `docs/developer-hub/building-on-0g/contracts-on-0g/precompiles/overview.md`
- `docs/developer-hub/building-on-0g/contracts-on-0g/precompiles/dasigners.md`
- `docs/developer-hub/building-on-0g/contracts-on-0g/precompiles/wrappedogbase.md`
- `docs/developer-hub/building-on-0g/da-integration.md`
- `docs/developer-hub/building-on-0g/da-deep-dive.md`
- `docs/developer-hub/building-on-0g/inft/inft-overview.md`
- `docs/developer-hub/building-on-0g/inft/erc7857.md`
- `docs/developer-hub/building-on-0g/inft/integration.md`

