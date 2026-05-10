# `apps/studio` — agent guidance

> Per planning-003 §A.5.2. Path-scoped specifics live in `.claude/rules/studio.md` (auto-loaded when editing files under `apps/studio/**`); this file is the human-readable index pointing at it. CLAUDE.md §10 is the brand contract; CLAUDE.md §11 is the test-topology contract.

## Stack at a glance

- Next.js 15.0.3 · React 19 · Tailwind v4 (CSS-first via `@theme inline` block in `app/globals.css`).
- wagmi 2.13 + viem 2.21 + ethers 6.13 (multi-tool wallet stack).
- SIWE 2.3.2 for session auth (`/api/auth/siwe/{nonce,verify}`).
- Dev port: `3300`, NOT 3000 (set in `package.json`).

## Hot files

- **Brand globals:** `src/app/globals.css` (imports `brand/tokens.css`).
- **V2-first chain reads:** every page goes through `src/lib/chain.ts` `unifiedX` helpers (`unifiedNextId`, `unifiedGetReceipt`, `unifiedFindByReceiptRoot`, `unifiedFindByAgent`). NEVER call `getReceiptRegistry()` directly.
- **SSR data loaders:** `src/lib/dashboard.ts`, `src/lib/local-receipt.ts`. Server components prefer these over client-side fetches per planning-003 §A.5.16.
- **Forms:** any form binding to a Zod enum imports the enum (`MemoryAccessEnum`, `ShellAccessEnum`, `ConsensusTierEnum`) from `@ivaronix/skills` and reads `.options`. Never redeclare enum values inline.

## Required env

Copy `.env.production.template` (or `.env.local.template`) and fill:
- `IVARONIX_SIGNER_KEY` — server-side signer for receipt anchoring.
- `IVARONIX_NETWORK=testnet|mainnet`.
- `ZG_API_SECRET` + `ZG_SERVICE_URL` + `OG_COMPUTE_PROVIDER` + `EVM_WALLET_ADDRESS` — Router credentials.
- `IVARONIX_READ_PROXY_KEY` — optional read-only proxy key for storage indexer (planning-003 §A.5.3 / `docs/PRIVACY_NOTES.md`).
- `IVARONIX_STUDIO_BASE` — public origin for OG image URLs and link unfurls.

## Test command

```bash
pnpm --filter @ivaronix/studio typecheck
pnpm --filter qa-metamask-e2e run regressions:studio
# Live regressions (need running dev server):
pnpm --filter qa-metamask-e2e run regressions:studio-live
```

## See also

- `.claude/rules/studio.md` — the auto-loading rule with full hard-rule list.
- `brand/Ivaronix.html` — visual reference; re-render Studio at 1440×900 + 375×812 and diff before commit.
- CLAUDE.md §10 (brand) · §11 (test topology) · §12 (completion discipline).
