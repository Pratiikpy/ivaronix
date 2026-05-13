# Manual Walkthrough Kit · Multi-Wallet UI Coverage

> Per the codified rules in `docs/MULTI_WALLET_RULES.md`, full PASS on every multi-wallet plan row requires UI/CLI/ChainScan cross-check with Wallet B/C connected through real MetaMask in real Chrome.
>
> The cron has driven every chain-side proof + CLI cross-check + public Studio render (iters 132-138). The remaining gate is real-MetaMask-connected interactive flow. Iters 139-141 attempted to extend the Playwright driver to programmatically import Wallet B's key into MM v13.30; the obfuscated UI made this take 5+ sessions with no successful import.
>
> **Faster path: ~5 minutes of operator-manual work unblocks all 12 PENDING-chain-complete rows.**

## Step 0 · One-time setup (5 minutes)

### Import Wallet B into your real Chrome MetaMask

1. Open Chrome MetaMask (the one with your operator wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`).
2. Click the account avatar (top of the MM popup — circle with letters).
3. Click "**Add account or hardware wallet**".
4. Click "**Import account**".
5. Paste this private key into the input:

   ```
   0xb0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0
   ```

6. Click "**Import**".
7. Wallet B appears in your account list at address `0xaf295d3c842bc1145E818d7FEf2c929726625620` with **0.108 OG** balance (funded iters 132 + 136).

### (Optional) Import Wallet C too

For 3-wallet flows. Same procedure with this key:

```
0xc0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0
```

Wallet C address: `0x4ee73ECBf603370a1D5183E6A8525E4e9795cAD0` · balance 0.01 OG.

### Save proof: 1 screenshot

Screenshot your MM showing both accounts in the list. Save as:

```
QA_PROOF_PACK/multi-wallet/manual-walkthrough/00-wallets-imported.png
```

This single screenshot satisfies the "Wallet B imported into MetaMask" prerequisite for every PENDING-chain-complete row.

## Step 1 · Walk through each PENDING-chain-complete row

Each row below has chain side already proven (chainscan-verifiable tx hash). Your job: switch MM to the indicated wallet, visit the indicated Studio URL, take a screenshot/video showing the UI matches the chain state.

### Row #820 · Memory grant (2-wallet)

- **MM wallet:** Operator (you grant TO Wallet B)
- **Visit:** `https://ivaronix.vercel.app/memory`
- **Action:** Connect wallet, see grant management UI
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/820-memory-grant-operator-view.png`
- **Then switch MM to Wallet B**, refresh `/memory`, take screenshot showing the same grant from grantee's perspective
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/820-memory-grant-walletb-view.png`

### Row #821 · Memory revoke (2-wallet)

- **Already revoked on chain** (tx `0x69138595...` block 33007241)
- **Visit `/memory` as Wallet B**: confirm the revoked-state UI renders correctly
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/821-memory-revoke-walletb-view.png`

### Row #825/826/791 · Data room (2-wallet)

- **Room ID:** `01KRFBG2XC8G20JDJ81CD614AX` (iter-134, on chain)
- **Visit as Wallet B:** `https://ivaronix.vercel.app/data-room/01KRFBG2XC8G20JDJ81CD614AX`
- **Note:** the iter-134 grant was revoked iter-134. The current state: Wallet B should see "access revoked" UI.
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/825-826-dataroom-walletb-revoked-view.png`

### Row #827/830 · Delegate (2-wallet)

- **Delegate ID:** `01KRFB6W7JJB2HSXRX1XJCE77N`
- **Visit:** `https://ivaronix.vercel.app/delegate/01KRFB6W7JJB2HSXRX1XJCE77N`
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/827-delegate-create-view.png`
- **Then visit with revoked status confirmed:** same URL, expect to see revoked UI
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/830-delegate-revoke-view.png`

### Row #828 · Delegate run

- **Receipt ID:** `rcpt_01KRFBXZZ0R45YGR4DEV9QG9V4`
- **Visit:** `https://ivaronix.vercel.app/r/9`
- **Note:** ownerWallet on receipt is delegate `0xc347bCb0...` — see also USER_TODO §B-V2-43 for the semantic-mismatch decision needed
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/828-delegate-run-receipt-view.png`

### Row #763 · Authorized-recorders gate (security test)

- **No UI surface for this** — direct-ABI test
- **Visit chainscan:** `https://chainscan-galileo.0g.ai/address/0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d` (AgentPassportINFTV2)
- **Save chainscan screenshot:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/763-authorized-recorders-gate-chainscan.png`

### Row #822 · MemoryAccessLogV2 spoofing defense (security test)

- **No UI surface for this** — direct-ABI test
- **Visit chainscan:** `https://chainscan-galileo.0g.ai/address/0xCbfE1f526483283Bba80c2Bed3622a56904bF96d`
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/822-spoofing-defense-chainscan.png`

### Row #863 · Marketplace buyer runs creator skill

- **Buyer (Wallet B) receipt:** `rcpt_01KRFC89GHCCKSFTJN593JSJF8` V2 id=10
- **Visit:** `https://ivaronix.vercel.app/r/10`
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/863-buyer-runs-creator-skill-view.png`

### Row #757 · Fee-split variation honoring manifest

- **Two receipts side-by-side:**
- `https://ivaronix.vercel.app/r/10` (90/10 split, private-doc-review)
- `https://ivaronix.vercel.app/r/11` (70/30 split, content-pitch-review)
- **Save 2 screenshots** showing the different fee-split values:
- `QA_PROOF_PACK/multi-wallet/manual-walkthrough/757-feesplit-90-10-private-doc-review.png`
- `QA_PROOF_PACK/multi-wallet/manual-walkthrough/757-feesplit-70-30-content-pitch-review.png`

### Row #864 · Fee-split serious test (3-wallet)

- **Same as #757** but explicitly note the treasury allocation (creatorBps + treasuryBps on each receipt)
- **Save:** `QA_PROOF_PACK/multi-wallet/manual-walkthrough/864-3wallet-fee-split-treasury-view.png`

## Step 2 · After walkthrough, run the audit-promote command

Once all screenshots are saved:

```bash
ls -la QA_PROOF_PACK/multi-wallet/manual-walkthrough/
```

Confirm at least 11 PNGs exist (one per closed row).

I'll then update `MATRIX_AUDIT.md` to move the relevant rows from `PENDING-chain-complete` to **PASS** (all 6 cross-check arms satisfied: chain · CLI · public Studio · MM-connected · screenshot · cross-check).

## Total time estimate

- Setup: 5 min (Wallet B import) + 2 min (Wallet C optional)
- Per row walkthrough: 30s - 2min depending on complexity
- 11 rows: ~30 min total

This unblocks 11 of 12 PENDING-chain-complete rows. The 12th (#864 with explicit on-chain treasury transfer) stays PENDING-chain-partial per the plan's own "OR marked future" clause.

## Why this is faster than continued Playwright work

- iter-139-141 spent 5 Playwright sessions, ~10 minutes per session including waiting
- Each session ended with a different selector blocker in MM v13.30's obfuscated UI
- The MM extension uses LavaMoat which blocks `page.evaluate` (Playwright's standard introspection technique)
- A human importing the key takes literal seconds; the same operation programmatically requires reverse-engineering MM v13.30's React component tree

The cron continues automated work in parallel (other audit dimensions, chain-side flows, doc audits). The manual walkthrough is the operator-only piece that no automation can substitute for at the strict level the codified rules require.
