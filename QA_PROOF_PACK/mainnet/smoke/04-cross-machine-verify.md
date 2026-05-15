# Phase 3 step 4 · Cross-machine verifier · 3/3 mainnet receipts re-readable from raw chain state

> What a stranger with only `https://evmrpc.0g.ai` + the QA receipt JSONs can verify: (a) chain bytes match what we claim, (b) operator wallet is the signer agent, (c) canonical hash recomputes to chain's stored receiptRoot.

## On-chain state

- ReceiptRegistryV3 mainnet address: `0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297`
- On-chain `nextId()`: 3
- Operator wallet (expected agent): `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`

## Per-receipt cross-check

| id | tier | rootMatches | agentMatches | chain timestamp | chain receiptRoot |
|---:|---|:---:|:---:|---|---|
| 0 | quick | ✓ | ✓ | 2026-05-15T03:35:07.000Z | `0xb5438f458e290b10...` |
| 1 | standard-3role | ✓ | ✓ | 2026-05-15T03:40:07.000Z | `0x0a69b03ff4be3a7f...` |
| 2 | high-stakes-5role | ✓ | ✓ | 2026-05-15T03:45:49.000Z | `0x38daec001fca77b5...` |

## Detailed receipt 0 (quick-tier · 0GM-1.0)

- JSON: `QA_PROOF_PACK/mainnet/smoke/01-first-tier1-receipt.json`
- Chain receiptRoot: `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa`
- Computed receiptRoot (keccak256 of canonical JSON): `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa`
- Match: ✓

## Detailed receipt 1 (standard 3-role · 0GM + 0GM + deepseek-v4-pro)

- JSON: `QA_PROOF_PACK/mainnet/smoke/02-standard-3role-receipt.json`
- Chain receiptRoot: `0x0a69b03ff4be3a7fab98e82daa8715fa8e65b6df60d984ace06014877312e280`
- Computed: `0x0a69b03ff4be3a7fab98e82daa8715fa8e65b6df60d984ace06014877312e280`
- Match: ✓

## Detailed receipt 2 (high-stakes 5-role · 0GM + deepseek-v4-pro + GLM-5 + deepseek-v3.2 + 0GM)

- JSON: `QA_PROOF_PACK/mainnet/smoke/03-high-stakes-5role-receipt.json`
- Chain receiptRoot: `0x38daec001fca77b5f46738dae646b53bfdb63390fb9d45d7b8673fbdf01be5a3`
- Computed: `0x38daec001fca77b5f46738dae646b53bfdb63390fb9d45d7b8673fbdf01be5a3`
- Match: ✓

## What this proves to a judge / stranger

1. **No Ivaronix-side state required** — the verifier only needs the chain RPC + the receipt JSON. There is no Ivaronix server, no auth, no API key, no cached state.
2. **Canonical hash deterministic** — the same JSON re-hashes to the same chain-stored `receiptRoot` byte-for-byte. A stranger can clone the repo, run this script, and arrive at the same conclusion.
3. **Signer identity on chain** — every receipt's `agentAddress` field on chain matches the operator wallet. The chain knows who signed.
4. **Stranger replay command** (anyone, anywhere):

```bash
# Read receipt 0 from chain
cast call 0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297 \
  "receipts(uint256)(bytes32,bytes32,bytes32,address,uint64,uint8)" \
  0 --rpc-url https://evmrpc.0g.ai

# Then verify the receipt JSON in this repo matches:
node -e "const fs=require('fs'); const {keccak256,toUtf8Bytes}=require('ethers'); const c=(o)=>(typeof o!=='object'||o===null)?JSON.stringify(o):Array.isArray(o)?'['+o.map(c).join(',')+']':'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+c(o[k])).join(',')+'}'; console.log(keccak256(toUtf8Bytes(c(JSON.parse(fs.readFileSync('QA_PROOF_PACK/mainnet/smoke/01-first-tier1-receipt.json','utf8'))))));"
```

## Honest disclosures

- **storageRoot is a placeholder** for these 3 receipts (no 0G Storage upload yet — that integration is queued · the earlier TIER 2 testnet demo proved the 0G Storage path independently). The chain anchor + canonical hash chain still proves the receipt body is what it claims.
- **attestationHash is a placeholder** computed as keccak256 of completion IDs. Real TEE attestation via `broker.processResponse` lands as a runtime upgrade · the receipt records actual provider addresses so verifiers can independently check provider attestation reports.
- **/r/<id> Studio rendering on mainnet** requires Studio's `IVARONIX_NETWORK=mainnet` Vercel cutover (Phase 2 step 6 · queued). Until then the "stranger reads receipt page" check uses raw chain reads — same cryptographic guarantee, less ergonomic UI.

## Result

**3 / 3 receipts cross-machine verified · root matches · agent matches.**

— agent · Phase 3 step 4 · 2026-05-15T03:49:12.911Z
