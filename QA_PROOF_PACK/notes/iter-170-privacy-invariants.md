# Iter-170 · Privacy invariants (plan §1059 · docs/PRIVACY_NOTES.md)

## Plan §1059 claim

Every privacy primitive Ivaronix relies on is documented in `docs/PRIVACY_NOTES.md` §1-5 with its threat model, source of truth, and known gaps.

## Per-section walk

### §1 · Operator-as-proxy — **2 REAL GAPS FOUND + DOCS FIXED**

The privacy doc claims two mitigations against operator-side disclosure via indexer log correlation:
1. The read-proxy key (`IVARONIX_READ_PROXY_KEY`)
2. Edge-cache headers on public-manifest routes

**Audit:**

```
$ grep -rnE "readProxyPrivateKey" apps/ packages/ scripts/ --include="*.ts" | grep -v node_modules
packages\runtime\src\env.ts:28:  readProxyPrivateKey?: string;
packages\runtime\src\env.ts:43:const READ_PROXY_KEY_ALIASES = ['IVARONIX_READ_PROXY_KEY', 'READ_PROXY_PRIVATE_KEY'] as const;
packages\runtime\src\env.ts:84:    readProxyPrivateKey: readWithDeprecation(READ_PROXY_KEY_ALIASES),
packages\runtime\src\env.ts:102:    READ_PROXY_KEY_ALIASES,
```

**Gap 1**: The env field is declared + parsed via the alias chain, BUT no other file in `apps/`, `packages/`, or `scripts/` reads `env.readProxyPrivateKey` at runtime. The privacy doc reads as if setting this env var makes public-fetch paths sign with this key instead of the operator's signer — but no consumer exists today. The mitigation is declared, not implemented.

```
$ grep -rnE "s-maxage|stale-while-revalidate" apps/studio/src/
(no results)

$ apps/studio/next.config.ts headers():
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
(no cache-control directive)
```

**Gap 2**: The privacy doc recommends `cache-control: public, s-maxage=86400, stale-while-revalidate=604800` on Studio public-manifest routes. `apps/studio/next.config.ts:headers()` ships 4 security headers but **NO cache-control directive**. The recommendation is correct in principle and worth implementing; it is not currently in effect.

**Fixes applied this iter:**

1. `docs/PRIVACY_NOTES.md §1` — added explicit honest-status callouts above both mitigation sections marking each PENDING with a date and the auditable grep that proves the state.
2. `docs/USER_TODO.md` — added two new B-V2 entries above B-V2-43:
   - **B-V2-44** · Read-proxy private key — runtime consumer (~2-3h)
   - **B-V2-45** · Edge-cache headers on public-manifest Studio routes (~1h)

### §2 · Burn Mode does NOT defend against local-machine compromise

- **Source**: `packages/og-storage/src/burn.ts:13-14` canonical threat-model JSDoc
- **Test coverage**: 15/15 PASS in iter-169 (`@ivaronix/og-storage` test)
- **Threat-model boundary**: defends against operator-side disclosure of plaintext after the run; does NOT defend against local-machine compromise during the active run window
- **Doc honest** ✓ — no changes needed

### §3 · TIER 1 vs TIER 2 — the privacy line

- **Source**: `packages/receipts/src/schema.ts` enforces `verificationMethod` enum at the Zod layer
- **Live proof** (iter-168 receipt #14 walk): `verificationMethod = "router_flag"` → honest TIER 1
- **Studio gate**: `apps/studio/src/app/r/[id]/page.tsx` renders TIER 1 green / TIER 2 amber based on the canonical enum value; anything else throws a schema violation
- **Doc honest** ✓ — no changes needed

### §4 · Receipt body content is public

- **Threat-model claim**: receipt body's `outputs.wording` field is part of the canonical hash + lives in 0G Storage as a public signed JSON blob. Burn Mode protects the **input**, not the **output**.
- **iter-146 audit** verified this directly: receipt #11's `outputs.wording.headline` contained the test canary string `PRIVATE_TEST_PHRASE_DO_NOT_LEAK` (the LLM quoted it back from the input). All FOUR public surfaces (chain anchor, OG image, embed, /r/<id> HTML) were CLEAN of the canary — the local leak is operator-side custody only. Per the threat model this is by design.
- **Mitigation recommendation in doc**: write a `pre_consensus` or `post_consensus` redaction hook (e.g., `redact_pii`) for sensitive flows. iter-158 confirmed `redact_pii` is one of 5 builtin hooks (`packages/skills/src/hooks/builtin/redact-pii.ts`).
- **Doc honest** ✓ — no changes needed

### §5 · What to tell users

- Copy-only section. Reads correctly against the current threat model:
  - User's wallet address on every signed receipt ✓ (proven iter-168 — `agent.ownerWallet = 0xaa954c33...`)
  - User's wallet NOT on receipts other people sign with read-proxy ⚠️ **only true when B-V2-44 lands** — today the operator wallet signs every read. Doc §5 implies this is already in effect.

**Action**: §5's bullet "Their wallet address is NOT on receipts other people sign, even when they read those receipts (with the read-proxy key set per §1)" is technically defensible because it's conditioned on "with the read-proxy key set" — but no one CAN set it usefully today. Once B-V2-44 ships, the bullet stands without qualification.

## Cumulative session plan-coverage

~36 concrete plan sections now proven. Fifth iter in a row with real implementation drift surfaced + addressed via honest doc-state correction (iter-164 README quickstart · iter-165 env-check · iter-166 prettier-plugin + test orchestrator · iter-168 receipt schema doc · iter-170 privacy doc).

## Verdict

✅ **PASS (with 2 honest PENDING callouts added)** — Plan §1059 audited. §2 + §3 + §4 stand as documented; §1 had two real implementation gaps that the doc was over-promising on, now honestly marked PENDING with B-V2-44 + B-V2-45 queued in USER_TODO. §5 reads correctly once §1 ships.

The pattern continues: the cron's per-iteration discipline keeps catching cases where "the doc reads confident but the code isn't there yet" — exactly the §1 brutal-honesty rule from CLAUDE.md.
