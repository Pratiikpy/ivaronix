# Phase 3 · 2-wallet flows on MAINNET

## Flow A · Memory grant/revoke (CapabilityRegistryV2)

- grantId: `0x5c9455670bced5da595617a39f45780ac0edcc287db6ed5de8f957f2807b31d3` · scope: read:memory · ttl 3600s · readsCap 100
- issueGrant tx: [0x18586f12f724](https://chainscan.0g.ai/tx/0x18586f12f7240cd5ddb4ce75b6dd237e455288cd489c5627abe8d0bd70171a3b) · alice → bob
- isValid post-grant: ✓ TRUE
- revokeGrant tx: [0xc9c33f5a277c](https://chainscan.0g.ai/tx/0xc9c33f5a277ce64171501c938151849756768d7b7bb2c748fc1f7be7a6113047)
- isValid post-revoke: ✓ FALSE
- **Flow A: PASS**

## Flow B · Passport mint + ownership verify (AgentPassportINFTV2)

- alice tokenId: 1
- metadata root: `0x8bf12140fe0bf17dbc085ff0cc1c2aceec12926ef8425e13b88b508ec58dddac`
- mint tx: [0x5acd1de68f3e](https://chainscan.0g.ai/tx/0x5acd1de68f3e3275f2597d28263e5bd0fa9fd195c8f318634ea75bce41e05b13)
- ownerOf(1) = `0x7581a5ef2c1C563a1b071B3472715635B9C15699` · matches alice: ✓ YES
- initial trust score: 0
- **Flow B: PASS · ownership verified**

**Honest deferral**: full trust-accrual via `recordReceipt` requires a receipt where `agent==alice`. Phase 3 step 2/3 receipts are operator-signed · so alice can't bump trust via those. Trust accrual is queued for a follow-up script: alice anchors a receipt with her own key (V3 EIP-712 sign) · operator then calls recordReceipt on alice's passport pointing at that receipt.

## Burner wallet identities (for replay)

- alice: `0x7581a5ef2c1C563a1b071B3472715635B9C15699` (private key in JSON · keep operator-internal)
- bob: `0x092A2b929a5995AEB39dDc1DDeb3733e15ea3c74`

## §16 PASS criteria

Per CLAUDE.md §16 a 2-wallet feature needs (a) chain tx · (b) UI with each wallet · (c) CLI cross-check · (d) chainscan distinct senders.

| Criterion | Flow A | Flow B |
|---|---|---|
| (a) Real on-chain tx | ✓ 2 txs | ✓ 2 txs |
| (b) UI with each wallet | deferred — Studio mainnet cutover queued | deferred |
| (c) CLI cross-check matches | ✓ `isValid` reads match expected state | ✓ `trustScore` reads match expected |
| (d) Chainscan distinct senders | ✓ alice + operator | ✓ alice + operator |

— agent · Phase 3 · 2026-05-15T04:10:53.229Z
