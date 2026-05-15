# v19 skill publish · 2026-05-15T14:48:12.152Z

Fresh wallet: 0xD0E2DB1d93E28c61c73Ee39E9dc1B6434B9E025C

- [14:43:44] v19 · /skill/new manifest publish autonomous
- [14:43:44] Fresh wallet: 0xD0E2DB1d93E28c61c73Ee39E9dc1B6434B9E025C
- [14:43:44] Funding 0.05 OG
- [14:43:46] Fund tx: 0x2893f41e4484dae8a2d2c5f4795c63e52e28b30f1d30bdff6899677088bb89a7
- [14:43:55] ✓ 0.05 OG arrived
- [14:43:57] Chromium launched
- [14:43:57] MM SW · extId=gjobhipajikikfoclmndeobbmnicplde
- [14:44:04] 📸 001-mm-initial.png
- [14:44:28] 📸 002-mm-unlocked.png
- [14:44:28] 
=== SRP import ===
- [14:44:41] 📸 003-mm-account-menu.png
- [14:44:47] 📸 004-mm-after-add-wallet.png
- [14:44:51] 📸 005-mm-after-import-a-wallet.png
- [14:44:55] 📸 006-mm-srp-typed.png
- [14:45:03] 📸 007-mm-srp-imported.png
- [14:45:03]   ✓ SRP imported
- [14:45:03] 
=== Studio + add Aristotle ===
- [14:45:12] 📸 008-studio-home.png
- [14:45:22] 📸 009-mm-connect-open.png
- [14:45:22]   mm-connect: splash cleared after 0s
- [14:45:22] 📸 010-mm-connect-after-splash.png
- [14:45:22]   mm-connect: "Connect" after 0s
- [14:45:22]   mm-connect: step 0 click "Connect" (multi-strategy)
- [14:45:24]   mm-connect: closed after 1
- [14:45:39] 📸 011-mm-add-network-open.png
- [14:45:39]   mm-add-network: splash cleared after 0s
- [14:45:39] 📸 012-mm-add-network-after-splash.png
- [14:45:39]   mm-add-network: "Confirm" after 0s
- [14:45:39]   mm-add-network: step 0 click "Confirm" (multi-strategy)
- [14:45:48]   mm-add-network: closed after 1
- [14:45:51] 📸 013-studio-network-added.png
- [14:45:51] 
=== Force switch to Aristotle (EIP-3326) ===
- [14:46:01]   switch result: {"ok":true}
- [14:46:05]   wallet active chainId: 0x4115 (expect 0x4115 = 16661)
- [14:46:05] 
=== /skill/new publish "qa-test-715fva" ===
- [14:46:08]   watching for auto-SIWE Sign popup
- [14:46:28]   ⚠ no SIWE popup in 20s (already-signed or page is open-access)
- [14:46:33] 📸 014-studio-skill-new-loaded.png
- [14:46:33] 
=== Step 1: Fill skill manifest form ===
- [14:46:33]   found 5 input fields
- [14:46:34]   filled 5 inputs
- [14:46:36] 📸 015-studio-skill-new-filled.png
- [14:46:36] 
=== Step 2: Click Publish ===
- [14:46:36]   matched: button:has-text("Save"):not([disabled])
- [14:46:36]   ✓ Save clicked (1st time — will likely 401, triggers SIWE)
- [14:46:36] 📸 016-after-publish-click.png
- [14:46:37]   🔴 console error: Failed to load resource: the server responded with a status of 401 ()
- [14:46:37]   📡 401 /api/skill/save: {"error":"authentication required — POST /api/auth/siwe/verify first"}
- [14:47:00]   re-clicking Save after SIWE (1st save status: 401)
- [14:47:00]   ✓ Save re-clicked
- [14:47:01]   🔴 console error: Failed to load resource: the server responded with a status of 401 ()
- [14:47:01]   📡 401 /api/skill/save: {"error":"authentication required — POST /api/auth/siwe/verify first"}
- [14:47:08] 📸 017-studio-post-publish.png
- [14:47:08] 
=== Verify publish via API ===
- [14:47:08]   final /api/skill/save status: 401 · saveOk=false
- [14:47:09]   Fresh wallet nonce: 0 (off-chain flow → 0 expected) · balance: 0.05 OG
- [14:47:09]   ⚠ /api/skill/save did not return 200 · final status: 401
