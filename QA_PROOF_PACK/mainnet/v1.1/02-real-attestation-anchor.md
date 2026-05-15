# v1.1-2 · Real broker.processResponse TEE attestation · DONE

> Mainnet receipt anchored with REAL TEE-attested verification via @0gfoundation/0g-compute-ts-sdk broker.inference.processResponse · NOT the keccak256(model+provider+completionId+timestamp) placeholder used in receipts 0/1/2/3.

## Proof

| Field | Value |
|---|---|
| Receipt off-chain id | `rcpt_01L603ET4YJAG` |
| On-chain V3 id | 4 |
| receiptRoot | `0x6ed8933010d19228588e941d43e82fb062337d5ce5199559436fbe5f7e554092` |
| storageRoot (REAL · 0G Storage) | `0x730ba50db138c86129bc6bb10a1290e296e1da1373d1dc57874b74416377d776` |
| Storage upload tx | `0x0145bfe6ad72dd4546c415f54cab4625f310b89a9604366a0599c1274e2c70be` |
| **attestationHash (chatID-bound)** | `0xe7c9946cb61ab2066ef50d921f5dc9caf7f952a11ed1eaf4ee6547af60187260` |
| **chatID (from ZG-Res-Key header)** | `0063bb97-a56b-4fd3-a91d-530654a33f08` |
| **TEE verification result (broker.processResponse)** | ✓ TRUE (TEE signature valid) |
| processResponse error | (none) |
| **TEE signature download URL** | https://compute-network-20.integratenetwork.work/v1/proxy/signature/0063bb97-a56b-4fd3-a91d-530654a33f08 |
| verificationMethod (receipt) | `compute_sdk_process_response` |
| tier1Verified (receipt) | true |
| Anchor tx | [0xb711839f252d7eee484d2d7760dfd2ca96a682fc4b6f4d4fb0a84cbc2e2d7fe7](https://chainscan.0g.ai/tx/0xb711839f252d7eee484d2d7760dfd2ca96a682fc4b6f4d4fb0a84cbc2e2d7fe7) |
| Wallet | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` |
| Block | 33293445 |
| Total cost | 0.000561 OG |

## AI output (max_tokens=1500 · v1.1 thinking-mode fix confirmed)

content (488c):
```
The 2x participating preferred liquidation preference is the most concerning provision because it entitles investors to recover twice their investment plus share in remaining proceeds, drastically capping your upside and making it highly likely you receive little to nothing in a moderate or down-round exit. This structure fundamentally skews the economic waterfalls in favor of early investors and severely jeopardizes your potential founder returns even during successful acquisitions.
```

## What this proves

1. **TEE signature verification is REAL** · broker.inference.processResponse returned true · this is the on-chain provider's TEE signer's verifiable signature, not a derived hash
2. **chatID is binding** · ZG-Res-Key header captured directly from provider · this ID is what the broker's signature attests
3. **Independent verification path** · a stranger downloads the signature from `https://compute-network-20.integratenetwork.work/v1/proxy/signature/0063bb97-a56b-4fd3-a91d-530654a33f08` · runs `recoverAddress(hashMessage(chatID), signature)` · confirms it matches the provider's registered TEE signer address (on-chain in 0x47340d90... InferenceServing contract)
4. **Storage + chain + compute · all three primitives integrated end-to-end** · receipt body on 0G Storage · canonical hash + attestation hash on 0G Chain · TEE attestation from 0G Compute

## v1.1 remaining gap

- **legal-citation-verifier web_fetch** (v1.1-3) · the only remaining "partial" label on /legal

## Verification path for a stranger

```bash
# 1. Read receipt's chain anchor
cast call 0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297 "receipts(uint256)(bytes32,bytes32,bytes32,address,uint64,uint8)" 4 --rpc-url https://evmrpc.0g.ai

# 2. Fetch receipt body from 0G Storage by storageRoot
# storageRoot: 0x730ba50db138c86129bc6bb10a1290e296e1da1373d1dc57874b74416377d776
# (run via ivaronix cli or 0g-storage CLI)

# 3. Download TEE signature from broker
curl https://compute-network-20.integratenetwork.work/v1/proxy/signature/0063bb97-a56b-4fd3-a91d-530654a33f08 > signature.bin

# 4. Verify signature recovers to provider's TEE signer
# (run @0gfoundation/0g-compute-ts-sdk verifier or use ethers.js directly)
```

— agent · v1.1-2 · 2026-05-15T05:22:14.431Z
