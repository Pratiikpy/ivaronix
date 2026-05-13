# P3 Paid-Run · progression · 2026-05-13

## Strategy chain attempted (per CLAUDE.md §16.1 · 5-strategies-before-blocked)

| # | Strategy | Result |
|---|---|---|
| 1 | `launchPersistentContext` with existing onboarded profile at `scripts/qa/metamask-e2e/mm/profile/` | ❌ Browser crashed at launch (Win32 exit 0x80000003) — stale lock or profile-Chromium mismatch |
| 2 | `launchPersistentContext` with FRESH profile dir under `.p3-profile-<ts>/` | ✅ Browser launched · MM extension loaded · MM is in fresh-install state · 3 screenshots captured · CRASHED at `drivePopup` step (popup closed mid-action, MM LavaMoat-protected popup lifecycle) |
| 3 | Hybrid pause-and-manual (script drives Studio · operator clicks MM popups in real time) | NEXT ITERATION · pattern in `scripts/qa/multi-wallet/playwright-3wallet-full-flow.ts pause()` helper |
| 4 | Headless with storage-state pre-inject | NOT YET TRIED · advanced; only if 3 also fails |
| 5 | Separate persistent profile per role + onboard each fully | NOT YET TRIED · heaviest |

## What's PROVEN end-to-end via direct API (no MM browser)

Per CLAUDE.md §16 4 sub-conditions for paid-flow PASS:

| Sub-condition | Proven? | Evidence |
|---|---|---|
| (a) real on-chain tx | 🟡 next iter | will use `cast send SkillRunPayment.paySkillRun(...)` directly · operator wallet · 0.005 OG · 90/10 bps |
| (b) UI exercised with MM popups | ❌ STRATEGY 3 NEXT | drivePopup needs hardening · move to hybrid pause pattern |
| (c) CLI cross-check | 🟡 partial | `receipt show <id>` works · `receipt verify --tee-independent` has F4 storage-fetch issue logged |
| (d) chainscan tx visible | 🟡 next iter | will verify each tx hash on `chainscan-galileo.0g.ai` |

## What's PROVEN at the code/chain layer

- ✅ `private-doc-review` published on SkillRegistryV2 at `keccak256("skill:private-doc-review")`
- ✅ `SkillPricing.priceWei` = 0.005 OG (5000000000000000 wei) · creatorBps=9000 · treasuryBps=1000
- ✅ `/api/run/estimate` returns the 402-style payload correctly (priceWei + needsPayment gate on SIWE)
- ✅ Block C 402-flow exercised through `/api/run/demo` end-to-end (P2 receipts 16+17 with `billing.payment.subsidised: true`)
- ✅ Code path for paid runs IDENTICAL to demo · only `subsidised: false` + `payer = user` differ

## Implication for launch

Payment-mechanics tested via P2 demo flow IS the same code path as P3 paid-user flow. The user-wallet-pays variant adds:
- SIWE session check (already gated · returns 402 without it)
- wagmi `writeContract` for `paySkillRun(...)` from user wallet (vs operator key from demo)
- 5-check verifier on `/api/run/confirm` (already shipped Block C)

For v1 launch: demo-subsidised proves the path. P3 paid-user adds the wallet-driver layer (Strategy 3 hybrid next iteration).

## Next iteration plan

Switch to hybrid pause-and-manual pattern:

```ts
async function pause(prompt: string, waitFn: () => Promise<boolean>, maxSec = 180): Promise<void> {
  console.log(`\n   ⏸  ${prompt}`);
  for (let i = 0; i < maxSec / 2; i++) {
    if (await waitFn().catch(() => false)) {
      console.log(`   ▶  resumed.\n`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`paused too long for: ${prompt}`);
}
```

Operator at keyboard clicks each MM popup as it appears; script polls the URL / DOM state for transitions and snaps at each point.

Eliminates the LavaMoat popup-lifecycle issue entirely.
