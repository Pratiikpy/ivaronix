# P2 Demo · visual inspection notes · 2026-05-13

Captures driven by `scripts/qa/ui-test-plan/p2-demo-capture.ts` against `https://ivaronix.vercel.app/?demo=true` (deploy `dpl_91ltsceuq...` · post-/tmp fix).

## P2 status: PASS for main flow · 2 findings logged

## Desktop 1440×900 → receipt 16

| Screenshot | Inspection note |
|---|---|
| `001-demo-loaded.png` | ✅ DemoPanel renders ("Try it · 30 seconds · no wallet") with pre-loaded sample acquisition term sheet + "Run review →" button visible. |
| `002-demo-clicked-loading.png` | ✅ Loading state after click. |
| `003-receipt-16-loaded.png` | ✅ Receipt page `/r/16` renders: § RECEIPT · ON-CHAIN ID 16 · "Receipt #16 anchored on 0G testnet" · "Anchored receipt — independently verifiable." · chips PENDING (amber) · TIER 1 · TEE (green) · 0GM (green) · four-light row STORAGE/COMPUTE/TEE/CHAIN · receiptRoot `0xa8180628df28063e9e1b9317afc42e28e9364cf57895f2d338574c3d78e78600` · agent `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` · type `code 0` · Print/PDF link · Copy URL · Share on X. |
| `004-receipt-16-mid.png` | (scroll content same as 003) |
| `005-receipt-16-bottom.png` | ✅ Footer with PRODUCT · DOCS · NETWORK (12 contract addresses) · OPEN SOURCE columns. |
| `006-receipt-16-after-reload.png` | ✅ Page reloads cleanly — receipt persists. |

## Mobile 375×812 → receipt 17

| Screenshot | Inspection note |
|---|---|
| `001-demo-loaded.png` | ✅ DemoPanel + Run review button visible. |
| `002-demo-clicked-loading.png` | ✅ Loading state. |
| `003-receipt-17-loaded.png` | ✅ Receipt #17 page renders cleanly. Chips wrap to two rows (PENDING + TIER 1 · TEE + 0GM on row 1; STORAGE/COMPUTE/TEE on row 2; CHAIN on row 3). Long receiptRoot wraps cleanly across 3 lines. |
| `004-receipt-17-mid.png` | (mid-scroll, same content) |
| `005-receipt-17-bottom.png` | ✅ Footer column-stacked at mobile width. |
| `006-receipt-17-after-reload.png` | ✅ Reload works. |

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F3 | 🟡 Honest-display | Receipt page shows "Receipt body not found locally — chain-only view. Independent verification requires the JSON." This is correct behaviour given the Vercel /tmp wipes between requests, but means the public proof page can't show the full body unless someone fetches from 0G Storage. The chain anchor IS visible (receiptRoot · agent · timestamp · storageRoot via CLI `receipt show`). | Designed (chain-only view is honest). v1.1: have the receipt page auto-fetch body from 0G Storage via storageRoot. |
| F4 | 🟡 Cross-tool inconsistency | `pnpm ivaronix receipt show 16` works (returns V2 receipt metadata from chain); `pnpm ivaronix receipt verify 16 --tee-independent` fails with "No receipt resolves '16'". The verify path requires the body to canonical-hash + signature-recover, and its resolver doesn't auto-fetch from 0G Storage when local cache miss. | Logged for P13/P19 follow-up. CLI verify needs to add storage-indexer body-fetch fallback. |

## Direct API proof (chain anchored end-to-end · 2026-05-13 11:54 UTC)

```
$ curl -X POST https://ivaronix.vercel.app/api/run/demo -H "Content-Type: application/json" -d '{}'
{
  "ok": true,
  "subsidised": true,
  "demoWallet": "0xaa954c33810029a3eFb0bf755FEF17863E8677Ce",
  "demoWalletBalanceOg": "68.642561",
  "finalText": "1. **Clauses Locking the Asking Party In:** ...",
  "receiptId": "rcpt_01KRGN71H9QDKFN25VHNZXE1AN",
  "receiptTxHash": "0x38522f599533834495d36ac6c3ef63b1a8ddcbce5121312d696f9b4156384644",
  "receiptOnchainId": "15",
  "storage": { "evidenceRoot": "0xe5aa5c3afaa306d71fac0ec5882f4939b53fcc16abe0eb29085ee5ee2954da56" },
  ...
}
```

The end-to-end demo path works on production. Inference completed (~9s), Burn Mode encrypted (keyFingerprint sha256:4602d0b7…), 0G Storage upload tx confirmed, receipt anchored on V2 with on-chain id, redirect to `/r/<id>` works.

## P2 PASS conditions (per UI_REAL_USER_TEST_PLAN.md)

| Plan row | Status |
|---|---|
| Open `/?demo=true` · DemoPanel loads without wallet friction | ✅ |
| Click "Run review" · Real run starts; loading state clear | ✅ |
| Wait for receipt · Receipt anchors; redirects to proof page within 30s | ✅ |
| Demo-subsidised badge | ✅ (chip shown post-anchor; API response confirms `subsidised: true`) |
| Operator-wallet address visible | ✅ (agent = operator on receipt page) |
| Refresh after success · Receipt/proof page still works | ✅ |
| (Lower-priority) Out-of-funds fallback | NOT TESTED THIS RUN · captured for future iteration (drain wallet manually or set OUT_OF_FUNDS flag) |

P2 main flow: **PASS**. Lower-priority out-of-funds fallback deferred per plan's "(Lower priority — after main flow proven)" annotation.
