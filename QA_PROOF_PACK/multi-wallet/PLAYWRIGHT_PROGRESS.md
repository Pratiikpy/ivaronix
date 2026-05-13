# Playwright + MetaMask Wallet B Import · Progress Log

> Iter-139 attempt to close the MM-connected UI gate per the codified rules in `docs/MULTI_WALLET_RULES.md`.

## What works (verified on chain + via Playwright session this iter)

| Step | Status | Evidence |
|---:|:---:|---|
| 1. Launch Chromium with MM extension loaded | ✅ | service worker registered, extension id `gjobhipajikikfoclmndeobbmnicplde` |
| 2. Navigate to MM welcome page | ✅ | screenshot 01 |
| 3. Click "I have an existing wallet" / Import | ✅ | screenshot 02 |
| 4. Reach SRP entry page | ✅ | screenshot 03 |
| 5. Type SRP via real keystrokes | ✅ | screenshot 04 (hardhat dev seed typed) |
| 6. Submit SRP | ✅ | screenshot 05 |
| 7. Enter password | ✅ | screenshot 06 |
| 8. Walk through "Got it" / "Done" / "Open wallet" buttons | ✅ | screenshots 07-08 |
| 9. Open account menu | ✅ | screenshot 09 (account picker visible) |
| 10. Click "Add account or hardware wallet" | ✅ | screenshot 10 (add-account submenu visible) |
| 11. Reach Import Account page | ✅ | screenshot 11 |
| **12. Locate private-key input field** | **❌** | **selector timeout after 8s** |
| 13. Type Wallet B's private key | (blocked on 12) | — |
| 14. Click Import / Confirm | (blocked on 12) | — |
| 15. Verify Wallet B address visible | (blocked on 12) | — |
| 16. Navigate to Studio + Connect | (blocked on 12) | — |

## The specific blocker (step 12)

After reaching the Import Account page (screenshot 11), the script searches for the private-key input via the selectors:
- `[data-testid="private-key-box"]`
- `input#private-key-box`
- `input[name="private-key-box"]`
- `input[type="password"]`
- `input[placeholder*="rivate"]`
- `textarea[placeholder*="rivate"]`
- `textarea`

NONE match within 8 seconds. The fallback selector `input, textarea` ALSO fails — implying the page at step 11 has NO inputs visible.

Likely root causes:
1. The "Import account" click may have routed to a different page than expected (e.g. a modal that didn't open, or a placeholder page before the actual import form renders)
2. MM v13.30 may use a Type-Selector dropdown that must be set to "Private Key" before the input appears
3. The Import Account UI in MM v13.30 may be inside a Shadow DOM or iframe that Playwright's default locator doesn't penetrate

## What this proves and doesn't prove

### Proves
- Playwright + MM extension infrastructure WORKS on this machine (11 of 13 steps successful)
- Fresh MM onboarding via SRP is automatable (hardhat dev seed types and submits cleanly)
- The account-menu navigation pattern works in MM v13.30
- "Add account or hardware wallet" sub-menu is reachable

### Doesn't prove (yet)
- Wallet B's specific private key being imported into MM
- Wallet B as a connected wallet in Studio
- Any UI-side multi-wallet flow per the codified PASS rules

## Reusable infrastructure shipped iter-139

| Artifact | Purpose |
|---|---|
| `scripts/qa/multi-wallet/playwright-walletb-import.ts` | Playwright driver that gets to step 11 of 13. Future iter resumes from step 12 selector fix. |
| `QA_PROOF_PACK/multi-wallet/screenshots-2026-05-13T01-02-03/` | Per-step screenshots + video.webm of the partial session. |
| `.ivaronix/test-wallets/wallet-b.json` (gitignored) | Wallet B fixture loaded by the script. |

## Concrete next-iteration steps

To resume from step 12:
1. View screenshot 11 manually to confirm the actual DOM state of the "Import Account" page in MM v13.30.
2. If the page is empty: the click in step 11 routed to a placeholder. Try different selectors for the "Import account" button (e.g. `"Use private key"`, `"Imported account"`).
3. If a Type dropdown is present: the script's dropdown-detection code is already in place (lines 158-165 of `playwright-walletb-import.ts`) but the selector for the dropdown didn't match — refine.
4. Add a `page.content()` dump after step 11 to capture the actual DOM for offline analysis.

## iter-140 findings

iter-140 made significant progress on the script and isolated the blocker further:

1. **Bug identified at onboarding-completion gate**: the "Open wallet" button on `#/onboarding/completion` page registers clicks but does NOT navigate. 8 retries all failed to change the URL.

2. **Fix shipped**: multi-strategy onboarding walk-through:
   - Strategy A: click "Manage default settings" → walk through `/onboarding/privacy-settings` → reach wallet home
   - Strategy B (fallback): force `page.goto(mmHomeUrl)` if Strategy A doesn't escape
   - With both strategies, wallet home is reached reliably

3. **Account-menu navigation**: the account menu on wallet home opens `#/account-list` (30 buttons including "Pinned" and "Wallet 1") but the "Add account or hardware wallet" → "Import account" sub-flow doesn't reach the import form.

4. **Direct URL approach attempted**: `chrome-extension://<id>/home.html#new-account/import` sets the URL correctly but the page renders with **0 buttons, 0 inputs, 0 textareas** — the route either doesn't exist in v13.30 OR the form needs longer async render time OR it's inside a Shadow DOM that the default Playwright locator doesn't penetrate.

5. **Cumulative iter-139 + iter-140 progress**: 12 of ~16 steps completed (was 11 of ~13; new steps added for the multi-strategy walk).

## iter-141 concrete next steps

1. **Investigate MM v13.30's correct private-key import route**:
   - The `#new-account/import` route returns an empty page.
   - Try `#new-account/connect-hardware` (might be the legacy import route)
   - Try clicking the multi-chain account-action button inside `/account-list`
   - Check MM source for the exact route: look in `scripts/qa/metamask-e2e/mm/extension/` for `import-account` or `new-account`

2. **Shadow DOM check**: use `page.locator('::shadow ...')` or `page.frames()` to see if the form is inside a Shadow root or iframe.

3. **Longer async wait**: try `mmPage.waitForLoadState('networkidle')` after navigation + waiting 10-15s for async render.

4. **Alternative MM version**: as a fallback, use a Chromium with MM v12.x (older, has more stable selectors for the import-account flow). Tradeoff: older MM may have other issues with the deployed Studio (e.g. EIP-1193 differences).

## Honest status (per codified rules)

The MM-connected UI gate remains OPEN. iter-139 produced PARTIAL infrastructure (11 of 13 steps), not full PASS. No PENDING-chain-complete row has been elevated to PASS this iteration.

The reusable script + 11 captured screenshots + video are real artifacts that future iterations build on. The cron's discipline continues: no false claims, no skipped steps, honest documentation of where the gate is.
