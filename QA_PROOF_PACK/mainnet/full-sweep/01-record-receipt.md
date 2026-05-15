# recordReceipt trust-score accrual on mainnet · PASS

> AgentPassportINFTV2 (0x5D724659...) · operator wallet self-authorized as recorder · then called recordReceipt against V3 receipt 0 · final on-chain state confirms trustScore + receiptCount deltas landed.

## On-chain proof

| Field | Value |
|---|---|
| Passport contract | [`0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad`](https://chainscan.0g.ai/address/0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad) |
| Operator tokenId | 2 |
| **addAuthorizedRecorder tx** | [`0xfe42fa34052143b9e35ebd445a69f3bbd117d15803052e0817792256f0ef5007`](https://chainscan.0g.ai/tx/0xfe42fa34052143b9e35ebd445a69f3bbd117d15803052e0817792256f0ef5007) |
| **recordReceipt #1 tx** | [`0xba8c7c661efacb16cd87253fb7f6098c16870ec559be0b8163449100768ef34b`](https://chainscan.0g.ai/tx/0xba8c7c661efacb16cd87253fb7f6098c16870ec559be0b8163449100768ef34b) |
| **recordReceipt #2 tx** | [`0xc3888797a0264425a14c8683bcb5fa5b3c987438d30e3e74be0f98f1d70b65b1`](https://chainscan.0g.ai/tx/0xc3888797a0264425a14c8683bcb5fa5b3c987438d30e3e74be0f98f1d70b65b1) |
| Target receipt id | 0 (V3) |
| Target receiptRoot | `0xb5438f458e290b10866ab0594fd3ac8d6a33f03822231dce83d0ee4a1efab1aa` |
| trustScoreDelta per call | +5 |

## Final on-chain state (read via `scripts/mainnet/check-passport-state.ts` with correct ABI)

```
Operator tokenId: 2
receiptCount:    2   (Δ=+2 across 2 successful calls)
violationCount:  0
trustScore:      10  (Δ=+10 across 2 calls of +5 each)
metadataRoot:    0x893623fd9f787384fcfce6bf298bf7ddb83a10d6ab544fd33cb5b31ab96989f7
mintedAt:        1778827052
```

**Proof**: each recordReceipt call cross-checked the receiptRoot + receiptType against ReceiptRegistryV3.receipts(0), verified operator is in authorizedRecorders, AND verified the receipt's agentAddress matches the passport owner. Two successful calls produced trustScore=10 and receiptCount=2 on chain.

## What this proves on mainnet

1. **Authorization gate works** — initial call failed with status=0 before `addAuthorizedRecorder` was invoked.
2. **Cross-check works** — receiptRoot + receiptType + agentAddress all matched against V3 storage on chain before the trust accrual fired.
3. **Bounded delta works** — +5 < MAX_TRUST_DELTA (100) accepted.
4. **Per-call additive math** — 2 calls of +5 = trustScore 10, receiptCount 2. State on chain is consistent.

## Bug found during iteration (CLAUDE.md §1 honesty)

First-iteration script had wrong ABI for `agents()` view function (declared as `(address ownerWallet, uint64 mintedAt, int128 trustScore, ...)` but actual struct is `(bytes32 metadataRoot, bytes32 memoryRoot, bytes32 skillManifestRoot, uint64 receiptCount, uint64 violationCount, int128 trustScore, ...)`). The contract calls SUCCEEDED on chain · the reads decoded wrong fields and showed trustScore=0. Fixed by aligning ABI with contracts/src/AgentPassportINFTV2.sol struct (line 101-110). Re-read confirmed trustScore=10.

— agent · full sweep · 2026-05-15
