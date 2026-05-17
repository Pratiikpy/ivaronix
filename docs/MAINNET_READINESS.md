# Ivaronix · Mainnet Readiness Checklist

> This is the gate cleared before mainnet promotion. Originally run on
> 2026-05-09 (all 13 items green on Galileo testnet, chainId 16602);
> **mainnet promotion to Aristotle (chainId 16661) shipped 2026-05-15**
> with <!-- numbers:auto:mainnet.deployedContractsToday -->10<!-- /numbers:auto:mainnet.deployedContractsToday --> contracts deployed (~0.085 OG total gas spend) and
> <!-- numbers:auto:mainnet.receiptsAnchored -->132<!-- /numbers:auto:mainnet.receiptsAnchored --> receipts anchored on `ReceiptRegistryV3` across all
> <!-- numbers:auto:receiptTypes.count -->13<!-- /numbers:auto:receiptTypes.count --> receipt-type slots. The checklist below records the
> pre-promotion state of the testnet system and the evidence used to
> clear the gate.

---

## Summary

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Contracts deployed (<!-- numbers:auto:contracts.deployed -->15<!-- /numbers:auto:contracts.deployed -->/<!-- numbers:auto:contracts.deployed -->15<!-- /numbers:auto:contracts.deployed -->) | ✓ | live addresses in `contracts/deployments/testnet.json` |
| 2 | Env vars (9/9 required) | ✓ | IVARONIX_NETWORK, IVARONIX_RPC_URL, IVARONIX_SIGNER_KEY, IVARONIX_ROUTER_KEY, IVARONIX_ROUTER_PROVIDER, NVIDIA_API_KEY, … all set (legacy aliases still resolve) |
| 3 | Deployer wallet funded | ✓ | 69.56 OG on Galileo |
| 4 | RPC latency | ✓ | 0.77s eth_blockNumber round-trip |
| 5 | Receipt anchoring | ✓ | <!-- numbers:auto:receipts.total -->1737<!-- /numbers:auto:receipts.total -->+ receipts on `ReceiptRegistry` (V1) + `ReceiptRegistryV2` + `ReceiptRegistryV3` (canonical slots 10/11/12) |
| 6 | Proof Explorer (`/r/<id>`) | ✓ | HTTP 200 on #994, #1004, #1014, #1056, #1069 |
| 7 | Passport state | ✓ | tokenId 1, trust 1053, receipts 1053, violations 0 |
| 8 | Memory grant/revoke lifecycle | ✓ | 5 grants on chain; ACTIVE → REVOKED proven via Studio + chain |
| 9 | Burn-mode receipt | ✓ | receipt #1069: aes-256-gcm, keyFingerprint sha256:11a3f1a1…, destroyedAt 1778314505036, cleanup completed |
| 10 | Fresh user flow (one command) | ✓ | `ivaronix demo` → receipt #1069 anchor tx `0x4d46b347…01c1261` in ≈3s |
| 11 | TEE-independent verify | ✓ | receipt #1069 at snapshot: schema/hash/signature/chain-anchor PASS + tee:primary PASS via `broker.processResponse` → **FULLY VERIFIED ✓**. Re-verify of tee:primary is best-effort against the live 0G Compute provider; the first four checks are the load-bearing authenticity proof and PASS regardless of broker state. |
| 12 | Studio routes (8/8) | ✓ | /, /onboard, /skills, /global, /dashboard, /memory, /brand, /agent/<addr> all HTTP 200 |
| 13 | `serve` HTTP API (4/4) | ✓ | /healthz, /v1/skills, /v1/passport/<addr>, /v1/receipt/1069 all HTTP 200 |

---

## Per-item detail

### 1. Contracts deployed on Galileo (chainId 16602)

All <!-- numbers:auto:contracts.deployed -->15<!-- /numbers:auto:contracts.deployed --> contracts (table auto-rendered from `contracts/deployments/testnet.json` via `pnpm docs:render` — original byte-size column dropped as the canonical record doesn't track it; run `forge inspect <name> bytecode --hex | wc -c` if you need it):

<!-- contracts:auto:start -->
| Contract              | Address                                                                                                                                            |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `AgentPassportINFT`    | [`0x08d25653638c3ed40C3b82840fA20CAe9c94563E`](https://chainscan-galileo.0g.ai/address/0x08d25653638c3ed40C3b82840fA20CAe9c94563E) — stays live for 4 minted passports (tokenIds 1-4) |
| `AgentPassportINFTV2`  | [`0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d`](https://chainscan-galileo.0g.ai/address/0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d) — authorizedRecorders-only with ReceiptRegistryV2 cross-check and a ±100 trustS… |
| `CapabilityRegistry`   | [`0x3783f3c4834fCCBD553860e15c64C7E052646a8D`](https://chainscan-galileo.0g.ai/address/0x3783f3c4834fCCBD553860e15c64C7E052646a8D) — stays live for any existing grants |
| `CapabilityRegistryV2` | [`0x1351CD87360f0366D0A0068164e606B3c320F3E1`](https://chainscan-galileo.0g.ai/address/0x1351CD87360f0366D0A0068164e606B3c320F3E1) — Private reverse indexes close a social-graph leak; authorizedRelayers gate on… |
| `Erc7857Verifier`      | [`0xEAd66Cb90B681720f3aab52d86c289E21106d938`](https://chainscan-galileo.0g.ai/address/0xEAd66Cb90B681720f3aab52d86c289E21106d938) — V1 verifier reused by AgentPassportINFTV2 |
| `MemoryAccessLog`      | [`0xEe1aDFe76785377C4430B1325d86E58A6eC92119`](https://chainscan-galileo.0g.ai/address/0xEe1aDFe76785377C4430B1325d86E58A6eC92119) — stays live for any existing log entries (chain history immutable) |
| `MemoryAccessLogV2`    | [`0xCbfE1f526483283Bba80c2Bed3622a56904bF96d`](https://chainscan-galileo.0g.ai/address/0xCbfE1f526483283Bba80c2Bed3622a56904bF96d) — logAccess enforces msg |
| `ReceiptRegistry`      | [`0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c`](https://chainscan-galileo.0g.ai/address/0x97376C6f0BE0Ee08AA34C4cAcdbDeC2183e7743c) — stays live for the existing anchored receipts (chain history immutable; curre… |
| `ReceiptRegistryV2`    | [`0xf675d4183b34fe8d1981FA9c117065aAcff690ab`](https://chainscan-galileo.0g.ai/address/0xf675d4183b34fe8d1981FA9c117065aAcff690ab) — EIP-712 anchor signature recovery; agentAddress is the recovered signer, not msg |
| `ReceiptRegistryV3`    | [`0x7396D536594e2BE833070c7EB441A10906046257`](https://chainscan-galileo.0g.ai/address/0x7396D536594e2BE833070c7EB441A10906046257) — Admits receipt-type slots 10 (doc_room_create), 11 (doc_room_read), 12 (memor… |
| `SkillPricing`         | [`0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F`](https://chainscan-galileo.0g.ai/address/0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F) — Mutable per-skill pricing (priceWei + creator/treasury bps) gated by SkillReg… |
| `SkillRegistry`        | [`0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1`](https://chainscan-galileo.0g.ai/address/0xf8894Ce4FFc7C594976d5Eaca38d8FE6DB4820a1) — stays live for existing skill registrations (chain history immutable) |
| `SkillRegistryV2`      | [`0xF05113E83146160024326ff30979c57f5adc2193`](https://chainscan-galileo.0g.ai/address/0xF05113E83146160024326ff30979c57f5adc2193) — Constructor pre-reserves 6 first-party skill IDs (private-doc-review, github-… |
| `SkillRunPayment`      | [`0x9eA5FDba913AC94dA8833Fee21F2832827950A5C`](https://chainscan-galileo.0g.ai/address/0x9eA5FDba913AC94dA8833Fee21F2832827950A5C) — Per-skill creator/treasury bps fee-split with pull-pattern withdrawals, lifet… |
| `SubscriptionEscrowV2` | [`0x74235b707194c4cc3DDb717B6D95595e8A82B7F5`](https://chainscan-galileo.0g.ai/address/0x74235b707194c4cc3DDb717B6D95595e8A82B7F5) — cancelGraceSeconds window between agent-initiated cancel and EXPIRED status c… |
<!-- contracts:auto:end -->

Deployed by `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` on 2026-05-08 (V1) + 2026-05-10 (V2).

### 5. Receipt anchoring

```
ivaronix debug chain
  receipts anchored    <!-- numbers:auto:receipts.total -->1737<!-- /numbers:auto:receipts.total -->  (ReceiptRegistry V1 + V2 .nextId() · live)
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

Output at snapshot time, when the live 0G Compute provider's TEE channel was reachable:

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

When the channel is temporarily unreachable (Router rate limit, provider session rotation, transient network), the `tee:primary` line returns `error  getting signature error` and the final status is `→ ANCHORED (some TEE checks failed)`. The first four checks (`schema · hash · signature · chain anchor`) are the load-bearing authenticity proof and PASS on any anchored receipt regardless of broker state; `tee:primary` is the additional check that calls back to the live provider.

### 13. `serve` HTTP API (port 4243)

Sample capture · regenerate live counts via `pnpm exec ivaronix serve` then `curl http://localhost:4243/v1/skills`.

```
GET /healthz                                       HTTP 200
GET /v1/skills                                     HTTP 200  (~156 skills, ~50 KB on the live registry)
GET /v1/passport/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce  HTTP 200
GET /v1/receipt/1069                               HTTP 200  state=ANCHORED
```

---

## Mainnet promotion — shipped 2026-05-15

Mainnet promotion to Aristotle (chainId 16661) shipped on **2026-05-15**.
The deployer wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` was funded
with 25 OG; total deploy spend was ~0.085 OG across <!-- numbers:auto:mainnet.deployedContractsToday -->10<!-- /numbers:auto:mainnet.deployedContractsToday --> contracts. All
transactions confirmed with status 1 on `chainscan.0g.ai`.

```bash
# the deploy that shipped — recorded in contracts/deployments/mainnet.json
NETWORK=mainnet pnpm --filter @ivaronix/og-chain run deploy
```

The deploy script wrote `contracts/deployments/mainnet.json` (same shape
as `contracts/deployments/testnet.json`). Studio reads `IVARONIX_NETWORK=mainnet`
(legacy alias: `OG_NETWORK`) and switches reads/writes accordingly.

Mainnet `ReceiptRegistryV3` lives at
[`0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297`](https://chainscan.0g.ai/address/0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297);
<!-- numbers:auto:mainnet.receiptsAnchored -->132<!-- /numbers:auto:mainnet.receiptsAnchored --> receipts have been anchored on it spanning all <!-- numbers:auto:receiptTypes.count -->13<!-- /numbers:auto:receiptTypes.count -->
receipt-type slots, with real TEE attestation via `broker.processResponse`
proven on mainnet receipt #4 and real 0G Storage upload on receipts 3–14.
Full mainnet contract address table lives in [README.md](../README.md).

---

## Testnet status: ready

The testnet checklist was 13/13 green before mainnet promotion. Items that
remain on the roadmap (DA disperse pipeline, mobile WalletConnect) are
documented honestly in the surfaces that ship them rather than gated on
this checklist.
