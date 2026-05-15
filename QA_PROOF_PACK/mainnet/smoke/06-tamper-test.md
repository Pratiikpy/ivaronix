# Phase 3 step 7 · Tamper test · mainnet receipt 0

> "Demo wow moment" per LOOP_DIRECTIVE Phase 3 SMOKE COMPLETENESS table. Demonstrates the chain-anchored `receiptRoot` is a strict cryptographic commitment: change ANY byte of the receipt body and the local hash diverges from the on-chain value · restore the byte and they match again.

## Receipt under test

- ULID: `rcpt_01R0516ZLA8D`
- V3 on-chain id: `0`
- Source JSON: `QA_PROOF_PACK/mainnet/smoke/01-first-tier1-receipt.json` (3987 bytes)
- Anchor tx: [`0xd9a48dedd80b88f166da56988c6b3923925476491eb6805dd6e87e0d351d4482`](https://chainscan.0g.ai/tx/0xd9a48dedd80b88f166da56988c6b3923925476491eb6805dd6e87e0d351d4482)

## Round-trip evidence

| State | Local keccak256 | Chain receiptRoot | Match? |
|---|---|---|---|
| Baseline (unmodified) | `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa` | `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa` | ✓ YES |
| **Tampered** (1 byte: position 657 `r` → `R`) | `0x8689ddb30367edd2c598780a47b5541e51468c5685982b8edf781f45d6c6b66c` | `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa` | **✗ NO — tampering detected** |
| Restored | `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa` | `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa` | ✓ YES (clean round-trip) |

## What this proves

1. **Strict cryptographic commitment** — a single byte change ANYWHERE in the receipt body produces a completely different keccak256 output. The chain doesn't store the body itself, only the 32-byte commitment. A stranger can detect tampering with a single hash comparison.
2. **No "close" matches** — keccak256 has avalanche · changing one bit changes ~half the output bits. The tampered hash differs from chain by 256 bits, not 1.
3. **Verification is one-way + deterministic** — given the receipt body, anyone can recompute the same hash. Given the chain-stored hash alone, no one can reconstruct the receipt body.

## Stranger replay path

```bash
# Read chain-stored receiptRoot
cast call 0xCE35aF8D75ffB24BC1671Ca9F0CF293D82737297 \
  "receipts(uint256)(bytes32,bytes32,bytes32,address,uint64,uint8)" \
  0 --rpc-url https://evmrpc.0g.ai | head -1
# → 0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa

# Compute local hash from receipt body
node -e "console.log(require('ethers').keccak256(require('ethers').toUtf8Bytes(require('fs').readFileSync('QA_PROOF_PACK/mainnet/smoke/01-first-tier1-receipt.json','utf8'))))"
# → 0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa

# Modify one byte and re-hash → hash diverges entirely (✓ tampering detected)
```

## Verdict

**✓ TAMPER TEST PASS · receipt is a strict cryptographic commitment to its body bytes.**

— agent · Phase 3 step 7 · 2026-05-15T03:54:34.727Z
