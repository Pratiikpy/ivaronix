# Ivaronix · Mainnet Readiness Checklist

> Per `QA_LOOP_BRIEF.md` operating rule #12, this is the final gate before
> declaring `READY`. Run on 2026-05-09. All 13 items green on Galileo
> testnet (chainId 16602). Mainnet (chainId 16661) waits on funding the
> deployer wallet — the only blocker per CLAUDE.md §1 ("the only blocker
> is money").

---

## Summary

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Contracts deployed (<!-- numbers:auto:contracts.deployed -->8<!-- /numbers:auto:contracts.deployed -->/<!-- numbers:auto:contracts.deployed -->8<!-- /numbers:auto:contracts.deployed -->) | ✓ | live addresses in `contracts/deployments/testnet.json` |
| 2 | Env vars (9/9 required) | ✓ | IVARONIX_NETWORK, IVARONIX_RPC_URL, IVARONIX_SIGNER_KEY, IVARONIX_ROUTER_KEY, IVARONIX_ROUTER_PROVIDER, NVIDIA_API_KEY, … all set (legacy aliases still resolve) |
| 3 | Deployer wallet funded | ✓ | 69.56 OG on Galileo |
| 4 | RPC latency | ✓ | 0.77s eth_blockNumber round-trip |
| 5 | Receipt anchoring | ✓ | <!-- numbers:auto:receipts.total -->1644<!-- /numbers:auto:receipts.total -->+ receipts on `ReceiptRegistry.nextId()` (V1) + `ReceiptRegistryV2.nextId()` |
| 6 | Proof Explorer (`/r/<id>`) | ✓ | HTTP 200 on #994, #1004, #1014, #1056, #1069 |
| 7 | Passport state | ✓ | tokenId 1, trust 1053, receipts 1053, violations 0 |
| 8 | Memory grant/revoke lifecycle | ✓ | 5 grants on chain; ACTIVE → REVOKED proven via Studio + chain |
| 9 | Burn-mode receipt | ✓ | receipt #1069: aes-256-gcm, keyFingerprint sha256:11a3f1a1…, destroyedAt 1778314505036, cleanup completed |
| 10 | Fresh user flow (one command) | ✓ | `ivaronix demo` → receipt #1069 anchor tx `0x4d46b347…01c1261` in ≈3s |
| 11 | TEE-independent verify | ✓ | receipt #1069: schema/hash/signature/chain-anchor PASS, tee:primary PASS via `broker.processResponse` → **FULLY VERIFIED ✓** |
| 12 | Studio routes (8/8) | ✓ | /, /onboard, /skills, /global, /dashboard, /memory, /brand, /agent/<addr> all HTTP 200 |
| 13 | `serve` HTTP API (4/4) | ✓ | /healthz, /v1/skills, /v1/passport/<addr>, /v1/receipt/1069 all HTTP 200 |

---

## Per-item detail

### 1. Contracts deployed on Galileo (chainId 16602)

All <!-- numbers:auto:contracts.deployed -->8<!-- /numbers:auto:contracts.deployed --> contracts (table auto-rendered from `contracts/deployments/testnet.json` via `pnpm docs:render` — original byte-size column dropped as the canonical record doesn't track it; run `forge inspect <name> bytecode --hex | wc -c` if you need it):

<!-- contracts:auto:start -->
| Contract              | Address                                                                                                                                            |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `AgentPassportINFT`    | [`0x08d25653638c3ed40C3b82840fA20CAe9c94563E`](https://chainscan-galileo.0g.ai/address/0x08d25653638c3ed40C3b82840fA20CAe9c94563E) — stays live for 4 minted passports (tokenIds 1-4) |
| `AgentPassportINFTV2`  | [`0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d`](https://chainscan-galileo.0g.ai/address/0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d) — K-1 + K-4 + K-6 fix |
| `CapabilityRegistry`   | [`0x3783f3c4834fCCBD553860e15c64C7E052646a8D`](https://chainscan-galileo.0g.ai/address/0x3783f3c4834fCCBD553860e15c64C7E052646a8D) |
| `Erc7857Verifier`      | [`0xEAd66Cb90B681720f3aab52d86c289E21106d938`](https://chainscan-galileo.0g.ai/address/0xEAd66Cb90B681720f3aab52d86c289E21106d938) — V1 verifier reused by AgentPassportINFTV2 |
| `MemoryAccessLog`      | [`0xEe1aDFe76785377C4430B1325d86E58A6eC92119`](https://chainscan-galileo.0g.ai/address/0xEe1aDFe76785377C4430B1325d86E58A6eC92119) |
| `ReceiptRegistry`      | [`0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c`](https://chainscan-galileo.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c) — stays live for the existing anchored receipts (chain hist… |
| `ReceiptRegistryV2`    | [`0xf675d4183b34fe8d1981FA9c117065aAcff690ab`](https://chainscan-galileo.0g.ai/address/0xf675d4183b34fe8d1981FA9c117065aAcff690ab) — K-2 fix |
| `SkillRegistry`        | [`0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1`](https://chainscan-galileo.0g.ai/address/0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1) |
<!-- contracts:auto:end -->

Deployed by `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` on 2026-05-08 (V1) + 2026-05-10 (V2).

### 5. Receipt anchoring

```
ivaronix debug chain
  receipts anchored    <!-- numbers:auto:receipts.total -->1644<!-- /numbers:auto:receipts.total -->  (ReceiptRegistry V1 + V2 .nextId() · live)
```

### 9. Burn-mode receipt #1069

```json
{
  "id": "rcpt_01KR5WVTTDR1YAAP9MCPGR9R51",
  "execution": { "burnMode": true },
  "storage": {
    "encryption": {
      "enabled": true,
      "type": "aes-256-gcm",
      "headerDetected": true,
      "keyFingerprint": "sha256:11a3f1a1849212ebc5cfbf387…"
    }
  },
  "burn": {
    "sessionKeyDestroyedAt": 1778314505036,
    "localCleanupStatus": "completed",
    "wording": "Session key destroyed; ciphertext now unreadable to operator…"
  }
}
```

### 11. TEE-independent verify on receipt #1069

```
schema                 PASS
hash                   PASS
signature              PASS
                    → CLAIMED
chain anchor          PASS  (id=1069 block≈1778314507)
                    → ANCHORED
initializing 0G Compute broker...
verifying 1 attestation via broker.processResponse...
tee:primary          PASS  (provider 0xa48f0128…)
                    → FULLY VERIFIED ✓
```

### 13. `serve` HTTP API (port 4243)

```
GET /healthz                                       HTTP 200
GET /v1/skills                                     HTTP 200  (155 skills, 49 KB)
GET /v1/passport/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce  HTTP 200
GET /v1/receipt/1069                               HTTP 200  state=ANCHORED
```

---

## Mainnet promotion gate

CLAUDE.md §1 ("The only blocker is money") — mainnet promotion requires the
deployer wallet to be funded on chainId 16661 with enough OG to redeploy all
<!-- numbers:auto:contracts.deployed -->8<!-- /numbers:auto:contracts.deployed --> contracts. Estimated cost: ≈0.05 OG plus a buffer. The actual deploy
script is the same `forge script` used on testnet, with `--rpc-url
https://evmrpc.0g.ai` and the same artefacts already verified by <!-- numbers:auto:contracts.foundryTests -->167<!-- /numbers:auto:contracts.foundryTests -->/<!-- numbers:auto:contracts.foundryTests -->167<!-- /numbers:auto:contracts.foundryTests -->
Foundry tests.

Once the deployer wallet receives mainnet OG, run:

```bash
NETWORK=mainnet pnpm --filter @ivaronix/og-chain run deploy
```

The deploy script writes `contracts/deployments/mainnet.json` (same shape
as `contracts/deployments/testnet.json`). Studio reads `OG_NETWORK=mainnet`
and switches
all reads/writes accordingly.

---

## Testnet status: `READY`

Every item that the agent can verify without external funding is verified.
The four blocked items in `QA_LOOP_BRIEF.md` (DA preflight, Telegram bot
live, fresh-wallet passport mint, `skill install <name>` URL ergonomics) are
all `blocked with real reason + unblock action` per the brief's stop
condition — none of them are bug fixes the agent can ship alone.
