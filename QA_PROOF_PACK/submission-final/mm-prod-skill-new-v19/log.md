# v19 skill publish · 2026-05-15T15:01:09.544Z

Fresh wallet: 0xc4020D892cc09819dd767187E7AC3E5f07148bDc

- [14:54:04] v19 · /skill/new manifest publish autonomous
- [14:54:04] Fresh wallet: 0xc4020D892cc09819dd767187E7AC3E5f07148bDc
- [14:54:04] Funding 0.05 OG
- [14:54:06] Fund tx: 0x1ce9ab9e6353abdf1c7d853f9ab6a0cb9655d12f4bd5dd8fcf7d6e3117fd2817
- [14:54:12] ✓ 0.05 OG arrived
- [14:54:15] Chromium launched
- [14:54:15] MM SW · extId=gjobhipajikikfoclmndeobbmnicplde
- [14:54:23] 📸 001-mm-initial.png
- [14:54:46] 📸 002-mm-unlocked.png
- [14:54:46] 
=== SRP import ===
- [14:54:56] 📸 003-mm-account-menu.png
- [14:55:01] 📸 004-mm-after-add-wallet.png
- [14:55:04] 📸 005-mm-after-import-a-wallet.png
- [14:55:10] 📸 006-mm-srp-typed.png
- [14:55:27] 📸 007-mm-srp-imported.png
- [14:55:27]   ✓ SRP imported
- [14:55:27] 
=== Studio + add Aristotle ===
- [14:55:36] 📸 008-studio-home.png
- [14:56:26] 📸 009-mm-connect-open.png
- [14:56:47]   mm-connect: splash cleared after 20s
- [14:56:58] 📸 010-mm-connect-after-splash.png
- [14:57:07]   mm-connect: "Connect" after 9s
- [14:57:07]   mm-connect: step 0 click "Connect" (multi-strategy)
- [14:57:11]   mm-connect: closed after 1
- [14:57:29] 📸 011-mm-add-network-open.png
- [14:57:38]   mm-add-network: splash cleared after 9s
- [14:57:43] 📸 012-mm-add-network-after-splash.png
- [14:57:43]   mm-add-network: "Confirm" after 0s
- [14:57:43]   mm-add-network: step 0 click "Confirm" (multi-strategy)
- [14:57:59]   mm-add-network: closed after 1
- [14:58:02] 📸 013-studio-network-added.png
- [14:58:02] 
=== Force switch to Aristotle (EIP-3326) ===
- [14:58:12]   switch result: {"ok":true}
- [14:58:16]   wallet active chainId: 0x4115 (expect 0x4115 = 16661)
- [14:58:16] 
=== /skill/new publish "qa-test-71l3wi" ===
- [14:58:20]   watching for auto-SIWE Sign popup
- [14:58:40]   ⚠ no SIWE popup in 20s (already-signed or page is open-access)
- [14:58:45] 📸 014-studio-skill-new-loaded.png
- [14:58:45] 
=== Step 1: Fill skill manifest form ===
- [14:58:45]   found 5 input fields
- [14:58:45]   filled 5 inputs
- [14:58:47] 📸 015-studio-skill-new-filled.png
- [14:58:47] 
=== Step 2: Click Publish ===
- [14:58:47]   matched: button:has-text("Save"):not([disabled])
- [14:58:47]   ✓ Save clicked (1st time — will likely 401, triggers SIWE)
- [14:58:47] 📸 016-after-publish-click.png
- [14:58:48]   🔴 console error: Failed to load resource: the server responded with a status of 401 ()
- [14:58:48]   📡 401 /api/skill/save: {"error":"authentication required — POST /api/auth/siwe/verify first"}
- [14:58:48]   📡 200 /api/auth/siwe/nonce: {"nonce":"5b0e87e22143c0c5be80d0013f4541f2"}
- [14:58:48]   popup 0 (likely SIWE Sign)
- [14:58:53] 📸 017-mm-siwe-0-open.png
- [14:58:56]   mm-siwe-0: splash cleared after 2s
- [14:59:01] 📸 018-mm-siwe-0-after-splash.png
- [14:59:03]   mm-siwe-0: "Confirm" after 1s
- [14:59:03]   mm-siwe-0: step 0 click "Confirm" (multi-strategy)
- [14:59:04]   📡 200 /api/auth/siwe/verify: {"ok":true,"wallet":"0xc4020d892cc09819dd767187e7ac3e5f07148bdc"}
- [14:59:04]   🔴 console error: Failed to load resource: the server responded with a status of 400 ()
- [14:59:04]   📡 400 /api/skill/save: {"error":"manifest YAML parse error: Implicit map keys need to be followed by map values at line 5, column 1:"}
- [14:59:05]   mm-siwe-0: closed after 1
- [14:59:29]   re-clicking Save after SIWE (1st save status: 400)
- [14:59:29]   ✓ Save re-clicked
- [14:59:29]   🔴 console error: Failed to load resource: the server responded with a status of 400 ()
- [14:59:29]   📡 400 /api/skill/save: {"error":"manifest YAML parse error: Implicit map keys need to be followed by map values at line 5, column 1:"}
- [14:59:37] 📸 019-studio-post-publish.png
- [14:59:37] 
=== Verify publish via API ===
- [14:59:37]   final /api/skill/save status: 400 · saveOk=false
- [14:59:38]   Fresh wallet nonce: 0 (off-chain flow → 0 expected) · balance: 0.05 OG
- [14:59:38]   ⚠ /api/skill/save did not return 200 · final status: 400
