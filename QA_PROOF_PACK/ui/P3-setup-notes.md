# P3 Setup · paid-flow chain state · 2026-05-13

Before driving a real-MM paid run for P3, the chain needs a published + priced skill.
This file documents the manual chain writes that make `private-doc-review` paid on Galileo.

## Chain writes

| Step | Command | Tx | Result |
|---|---|---|---|
| Publish `private-doc-review` on SkillRegistryV2 (wrong hash · without `skill:` prefix) | `publishVersion(0x6f80de..., 0xa54d02..., 0xa9958c...)` | `0x65555847...` | ✅ status 1 · skillId published but at wrong hash for Studio's lookup |
| Publish `private-doc-review` on SkillRegistryV2 (correct hash · with `skill:` prefix) | `publishVersion(0x0934cf..., 0xa54d02..., 0xa9958c...)` | (in same iteration) | ✅ status 1 |
| Set price 0.005 OG · 90/10 bps | `setPrice(0x0934cf..., 5000000000000000, 9000, 1000)` | `0x0b582d04...` (1st attempt) | ⚠ first call hit RPC null response · retried, ✅ confirmed |
| Verify price on chain | `cast call SkillPricing.priceWei(0x0934cf...)` | — | ✅ returns `5000000000000000` (0.005 OG) |
| Verify Studio estimate API | `curl POST /api/run/estimate` | — | ✅ "paid skill requires userWallet claim with SIWE session" (correct 402 gate) |

## Skill state

| Field | Value |
|---|---|
| Skill name | `private-doc-review` |
| Studio hash | `keccak256("skill:private-doc-review")` |
| Skill ID (bytes32) | `0x0934cfc21748e6a579630c2637fcb1f95b9fa2acfb16039e1a7ed70473860dcb` |
| Version ID | `keccak256("0.3.1") = 0xa54d0256a5ef7b691e1e01baacb06baa29013253f551f7dad7708516cb21264d` |
| Manifest hash | `keccak256("manifest:private-doc-review@0.3.1") = 0xa9958ce310be0598b26769aade117c8abf95154add5ad7feffdbf2d29b101773` |
| Creator | `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` (operator wallet) |
| Price | `0.005 OG` (5000000000000000 wei) |
| Creator BPS | `9000` (90%) |
| Treasury BPS | `1000` (10%) |
| Sum check | `9000 + 1000 = 10000` ✓ |

## Studio API responses (proof)

```
$ curl -X POST .../api/run/estimate -d '{"skillId":"private-doc-review",...}'
{
  "error": "paid skill requires userWallet claim with SIWE session",
  "skillId": "private-doc-review",
  "priceWei": "5000000000000000"
}
```

The Block C 402-flow is ground-truth verified at the API layer.

## Next: P3 capture script

`scripts/qa/ui-test-plan/p3-paid-run-capture.ts` — needs to drive:
1. Chromium with MM extension + persistent profile at `scripts/qa/metamask-e2e/mm/profile/`
2. MM unlock (already onboarded with operator wallet per `scripts/qa/metamask-e2e/run.ts`)
3. Visit `https://ivaronix.vercel.app/onboard`
4. Click "Connect wallet" → MM popup → user clicks "Next" + "Connect"
5. SIWE sign popup → user clicks "Sign"
6. Navigate to landing page (RunPanel) OR `/onboard` run flow
7. Drop sample doc + choose `private-doc-review` skill
8. Click "Run review" → /api/run/estimate returns `needsPayment: true, amount, paymentContract, creator, bps`
9. wagmi calls `paySkillRun(receiptRoot, creator, creatorBps, treasuryBps)` → MM tx popup
10. Click "Confirm" → tx broadcasts
11. Studio waits for confirmation → calls `/api/run/confirm` with tx hash
12. Backend runs 5-check verifier → pipeline anchors receipt with `billing.payment` block
13. Browser redirects to `/r/<id>` → receipt shows payment block + chip + tx hash
14. Capture screenshots at every state + full session video
15. Visually inspect each capture

Reuse patterns:
- `scripts/qa/metamask-e2e/run.ts` for MM extension load + unlock + Studio nav
- `scripts/qa/multi-wallet/playwright-3wallet-full-flow.ts` for popup-handling

Block J's scaffold `scripts/qa/multi-wallet/playwright-3wallet-marketplace-flow.ts` already has most of the structure; P3 is the 1-wallet subset of that.
