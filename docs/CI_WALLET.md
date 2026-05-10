# CI wallet · scoped EVM key for chain-smoke workflow

> Operator runbook for the `IVARONIX_CI_WALLET_KEY` repo secret used by `.github/workflows/chain-smoke.yml`. Closes planning-003 §A.1.5.

## Why a separate CI wallet

The chain-smoke workflow anchors a synthetic V2 receipt on Galileo to verify K-2 correctness end-to-end on PR (label-gated) + nightly. Each run spends ~0.0005 OG. Using the operator's main signing key (`EVM_PRIVATE_KEY` in `.env`) for CI:
- Leaks the operator wallet address into GitHub Actions logs.
- Mixes CI traffic with operator traffic in chainscan lookups.
- Forces every CI run to share the operator's nonce sequence.

A scoped CI wallet sidesteps all three.

## One-time setup

Run on the operator's machine (anywhere with `node`):

```bash
node -e 'const {Wallet} = require("ethers"); const w = Wallet.createRandom(); console.log("address:", w.address); console.log("privateKey:", w.privateKey);'
```

Output:

```
address:    0x<NEW_CI_ADDRESS>
privateKey: 0x<NEW_CI_PRIVATE_KEY>
```

1. Copy the **address** to a note. Send 0.5 OG from the operator wallet (`0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`, ≈ 69 OG balance per USER_TODO §A-1) to this address on Galileo. Cost: 0.5 OG, covers ~1000 PR + nightly runs.

2. Copy the **privateKey** to GitHub:
   - Repo Settings → Secrets and variables → Actions → New repository secret.
   - Name: `IVARONIX_CI_WALLET_KEY`
   - Value: `0x<NEW_CI_PRIVATE_KEY>` (full hex with `0x` prefix).

3. Verify the secret is reachable to the workflow:
   - Trigger the workflow manually: GitHub → Actions → "Chain smoke" → Run workflow → branch `main`.
   - First run takes ~3 min. Look for `V2 anchor live · receipt #<id> · ...` in the log.

4. Add the funded address to `contracts/deployments/testnet.json` under a `ci_wallet` key (so the operator can find it later):

```json
{
  "ReceiptRegistry": "0x...",
  "ReceiptRegistryV2": "0xf675d4183b34fe8d1981FA9c117065aAcff690ab",
  "ci_wallet": "0x<NEW_CI_ADDRESS>"
}
```

## Top-up

The smoke spends ~0.0005 OG per run. With 0.5 OG allocated, the wallet handles ~1000 runs before refunding. Refund via:

```bash
cast send 0x<NEW_CI_ADDRESS> --value 500000000000000000 \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $EVM_PRIVATE_KEY --legacy
```

Monitor balance via `cast balance 0x<NEW_CI_ADDRESS> --rpc-url https://evmrpc-testnet.0g.ai`.

## Rotation

If the CI wallet key is ever compromised (e.g. accidentally logged), rotate:

1. Generate a new wallet (step 1 above).
2. Drain the old wallet (`cast send` from old key sending balance to the new address).
3. Update the GitHub secret with the new private key.
4. Update `contracts/deployments/testnet.json:ci_wallet`.

The CI workflow auto-picks up the new secret on the next run.

## Network targeting

Chain-smoke targets Galileo testnet (chainID 16602). When mainnet redeploy (USER_TODO §A-2) ships, add a parallel workflow `chain-smoke-mainnet.yml` with `IVARONIX_CI_WALLET_KEY_MAINNET` secret and a separately-funded mainnet CI wallet. Keep them on different RPC URLs and different schedules so a Galileo outage doesn't fail mainnet smokes.
