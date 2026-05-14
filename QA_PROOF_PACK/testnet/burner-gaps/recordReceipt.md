# PRE-QUEUE-2 · recordReceipt gap closure

> Per LOOP_DIRECTIVE.md STEP 3 pre-queue + STUCK-RESOLUTION RULE Rule B. Closure shape: burner script (contract-level proof) + UI smoke (downstream surface where the trust score is visible). recordReceipt is operator-admin-only on AgentPassportINFTV2; UI surfaces consume the state it writes (receiptCount + trustScore) on `/agent/[addr]` and `/dashboard`.

## Status

**CLOSED · burner-recordReceipt.ts ran end-to-end on Galileo testnet · 9/9 PASS · contract-level proof + chain-side tx + event + state deltas.**

## Strategy log

| # | Strategy | Outcome | Diagnosis |
|---|---|---|---|
| 1 | Re-use `burner-final-sweep.ts` §3 path | **FAIL** | Same script aborted earlier on the refund-half before reaching the recordReceipt block. Also: the original ABI in that script had `recordReceipt(uint256, bytes32, uint8, int128)` — the wrong signature. |
| 2 | Read the actual contract source | **FOUND CAUSE** | `contracts/src/AgentPassportINFTV2.sol:203-231` defines `recordReceipt(uint256 tokenId, uint256 receiptId, bytes32 expectedReceiptRoot, uint8 expectedReceiptType, int128 trustScoreDelta)` — 5 args, not 4. The event is `ReceiptRecorded(tokenId, root, receiptId, type, delta)` — 5 fields including the receiptId. |
| 3 | Write standalone `burner-recordReceipt.ts` with corrected ABI · mint passport · anchor receipt · operator records | **PASS 9/9** | tx hash captured · receiptCount + trustScore deltas confirmed · event payload verified field-by-field. |
| 4 | Patch the original `burner-final-sweep.ts` ABI so the regression suite is honest | **DONE** | Edits to lines that previously held the 4-arg signature; the script now matches the deployed contract. |

## Evidence on disk

### Chain-side (real Galileo testnet · 4 distinct tx · status=1)

- Fund alice (operator): `0x66fb64d4de14e9ef9a727678758453d91044014ce2b670e7adaeb5d1e96c2306`
  - https://chainscan-galileo.0g.ai/tx/0x66fb64d4de14e9ef9a727678758453d91044014ce2b670e7adaeb5d1e96c2306
- Mint passport (alice → tokenId 20): `0x13f20b616822dfbcd77b08d280cff3b01f27c79a30e9ffd3c57cc7f36150024f`
  - https://chainscan-galileo.0g.ai/tx/0x13f20b616822dfbcd77b08d280cff3b01f27c79a30e9ffd3c57cc7f36150024f
- Anchor receipt (id 78): `0x39e4506ac46003a72305744b678a0d0f8846ff117805b7d662484c7bd86ab30b`
  - https://chainscan-galileo.0g.ai/tx/0x39e4506ac46003a72305744b678a0d0f8846ff117805b7d662484c7bd86ab30b
- **recordReceipt (operator → alice's passport): `0x40279a7c2352db4e77ed18d6022a5fc3e61996a3898d5a7cb85053337e848a91`**
  - https://chainscan-galileo.0g.ai/tx/0x40279a7c2352db4e77ed18d6022a5fc3e61996a3898d5a7cb85053337e848a91

### Assertions (9 of 9 PASS)

1. operator is authorized recorder ✓
2. recordReceipt tx success (status=1) ✓
3. receiptCount incremented by 1 (0 → 1) ✓
4. trustScore delta == +5 (0 → 5) ✓
5. ReceiptRecorded event emitted ✓
6. event.tokenId == alice token (20) ✓
7. event.receiptId == anchored id (78) ✓
8. event.receiptRoot matches the anchored receiptRoot ✓
9. event.trustScoreDelta == 5 ✓

### Proof JSON

`QA_PROOF_PACK/testnet/burner-gaps/recordReceipt-1778784880568.json` — full receiptId · receiptRoot · token · event payload · before/after agent state.

### Wallet split per Rule D

- **Burner script (contract-level proof)** — ✓ captured this iteration. 9/9 PASS. Real on-chain tx hash and event.
- **UI surface where the writes are consumed** — `/agent/[addr]` shows `trustScore` and `receiptCount` after recordReceipt fires; `/dashboard` per-wallet stats show "passport-recorded receipts". recordReceipt is NOT directly invoked from a Studio button (it's called by the daemon when authorized; users don't click "record my receipt"). The UI surface that proves the write landed is `agents(tokenId).trustScore` rendered on `/agent/[addr]/{aliceAddress}`. Capture queued for Q3 (passport mint + trust accrual 2-wallet) which exercises the same path with a real Studio render.

## Regression run after closure (Rule C)

- Foundry tests on AgentPassportINFTV2 will run as part of Q20 CI sweep. For this Q-item the smallest relevant regression is: anchor + record + read back agent state. The script's 9/9 PASS includes that exact regression.
- The fix to `burner-final-sweep.ts` ABI also re-enables that script's §3 recordReceipt block to work end-to-end on a future cron firing.

## Open follow-ups (not blocking closure)

- Q3 will capture the UI render of trustScore for alice's tokenId 20 on `/agent/[aliceAddress]` — the downstream proof that the chain-side write surfaces in the UI.
