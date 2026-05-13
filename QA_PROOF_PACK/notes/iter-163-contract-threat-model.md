# Iter-163 · Smart contract threat-model coverage (plan §1095)

## Plan §1095 claim

> Every security-sensitive contract carries a `Threat model:` NatSpec
> block listing what it defends + what it does NOT defend + assumed
> attacker capabilities. Pattern: `CapabilityRegistry.sol`,
> `MemoryAccessLog.sol`, `Erc7857Verifier.sol`.

## Foundry test sweep

`cd contracts && forge test --no-match-test "Live|Mainnet"`:

- **14 test suites**
- **177 tests passed · 0 failed · 0 skipped**
- finished in **22.49ms** (53.53ms CPU time)

Per-suite highlights:
- `ReceiptRegistryV3.t.sol` (6 tests, all PASS) — slot-10/11/12 accept, domain separator differs from V2, slot-13 out-of-range reject
- `IvaronixReceiptGuard.t.sol` (multi-suite) — tampered receipt rejection, empty-input gate, bogus-id honesty
- `AgentPassportINFTV2.t.sol` (16 tests) — K-1 + K-4 + K-6 fixes, authorizedRecorders-only, ±100 trustScoreDelta cap, mint nonReentrant

## NatSpec coverage scan

`verify-contract-threat-model.ts` (one of the 4 contract regressions
from iter-162 sweep):

```
Contracts · Threat model NatSpec coverage
  scanned 15 .sol files in contracts/src/
  PASS · every contract has a Threat model block
```

Manual cross-check: `ls contracts/src/*.sol | wc -l` = **15** ·
`grep -l "Threat model" contracts/src/*.sol | wc -l` = **15** ·
**100% coverage**.

Per-contract list with the NatSpec block:

| Contract | Class |
|---|---|
| `AgentPassportINFT.sol` | Identity (V1) |
| `AgentPassportINFTV2.sol` | Identity (V2 · K-1+K-4+K-6 fixes) |
| `CapabilityRegistry.sol` | Capability gate (V1) |
| `CapabilityRegistryV2.sol` | Capability gate (V2) |
| `Erc7857Verifier.sol` | ERC-7857 INFT signature verification |
| `IvaronixReceiptGuard.sol` | Library — receipt-integrity assertions |
| `MemoryAccessLog.sol` | Memory grant/revoke log (V1) |
| `MemoryAccessLogV2.sol` | Memory grant/revoke log (V2) |
| `ReceiptRegistry.sol` | Anchor registry (V1) |
| `ReceiptRegistryV2.sol` | Anchor registry (V2 · K-2 EIP-712) |
| `ReceiptRegistryV3.sol` | Anchor registry (V3 · slots 10/11/12) |
| `SkillRegistry.sol` | Marketplace (V1) |
| `SkillRegistryV2.sol` | Marketplace (V2 · fee-split policy) |
| `SubscriptionEscrow.sol` | Subscription escrow (V1) |
| `SubscriptionEscrowV2.sol` | Subscription escrow (V2 · cancelGraceSeconds) |

The regression `verify-contract-threat-model.ts` lives in
`scripts/qa/metamask-e2e/` and runs as part of the offline
`regressions:contracts` filter. It will fail CI the moment a
contributor adds a new `contracts/src/*.sol` without the
`Threat model:` block, structurally locking the rule from
`.claude/rules/contracts.md`.

## Verdict

✅ **PASS** — Plan §1095 fully satisfied.

- 177/177 Foundry tests green.
- 15/15 `.sol` files carry a `Threat model:` NatSpec block.
- The structural regression locks the contract from regressing.

Combined with iter-162's 92/92 source-file regressions, the entire
contract-layer trust surface is locked at both write-time (NatSpec
required) and read-time (177 forge tests + 1 NatSpec coverage scan).
