# Q2 · Memory grant/revoke 2-wallet · tx hashes

> Source: `QA_PROOF_PACK/multi-wallet/burner-memory/proof-1778781835807.json` (latest run · 2026-05-14T18:03:55Z). Burner harness `scripts/qa/ui-test-plan/burner-memory-grant-revoke.ts` exercised the CapabilityRegistryV2 grant lifecycle end-to-end.

## Wallet topology (2 distinct on-chain identities)

| Role | Address | Action |
|---|---|---|
| Issuer (alice burner) | `0x1Ec78950E2386abAE08Ab9F6217958473769B922` | issues memory grant to bob · later revokes it |
| Grantee (bob burner) | `0xB324c85DF053a9c16c305521A70896E6A4ee4BBc` | recipient of the capability grant |
| Operator (funding only) | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` | pre-funds the two burners; not part of the grant lifecycle |

## Contract surface exercised

CapabilityRegistryV2 at `0x1351CD87360f0366D0A0068164e606B3c320F3E1`.

## 4 distinct chainscan tx URLs (all status=1)

1. **fund alice (operator → alice)**  
   `0xda2b265dd14ea36ddad453e215ded1a2ce2062fef45d759a02f8c7c728400d04`  
   https://chainscan-galileo.0g.ai/tx/0xda2b265dd14ea36ddad453e215ded1a2ce2062fef45d759a02f8c7c728400d04
2. **fund bob (operator → bob)**  
   `0x8910f123db9256aef36f94eaf33101f154451d52d58b72d5a4d96d3fa7dabae6`  
   https://chainscan-galileo.0g.ai/tx/0x8910f123db9256aef36f94eaf33101f154451d52d58b72d5a4d96d3fa7dabae6
3. **issue grant (alice → CapabilityRegistryV2)** · grantId `0xd89156672fe020b50e915f0bd8d6434578c6058f830498a5784af0a97541c29e`  
   `0x8387b43a96c78e45a136319a07533a271b3a240f1e07f99e49f543d954db0168` (block 33316129)  
   https://chainscan-galileo.0g.ai/tx/0x8387b43a96c78e45a136319a07533a271b3a240f1e07f99e49f543d954db0168
4. **revoke grant (alice → CapabilityRegistryV2)**  
   `0x48ba55a9f54505167d073fcace25326c4b0f25dbdc6cd91b1f97cc030db05b82` (block 33316160)  
   https://chainscan-galileo.0g.ai/tx/0x48ba55a9f54505167d073fcace25326c4b0f25dbdc6cd91b1f97cc030db05b82

## Grant parameters

- grantId: `0xd89156672fe020b50e915f0bd8d6434578c6058f830498a5784af0a97541c29e`
- scopeHash: `0xf90438b11222cf87f64b3f218cf6a871dcf8f9adc0a5bf7071c138c7dadc2565`
- ttlSeconds: 3600 (1 hour)
- readsCap: 10

## Chain-side proof: isValid lifecycle

- isValid BEFORE revoke: **true** ✓ (grant was active right after issue)
- isValid AFTER revoke: **false** ✓ (grant deactivated · revoke is the one-way state transition)

Verdict in source proof: "PASS · grant lifecycle proven on chain · before=true after=false"
