# Studio rules

> Auto-loads when working on `apps/studio/**`. Path-scoped guidance per planning-003 §A.4.2.

## Stack

- Next.js 15.0.3 · React 19 · Tailwind CSS v4 (CSS-first config via `postcss.config.mjs` + `globals.css`).
- wagmi 2.13 + viem 2.21 + ethers 6.13 (multi-tool wallet stack: wagmi for browser, ethers for chain reads).
- SIWE 2.3.2 for session auth (`/api/auth/siwe/{nonce,verify}`).

## Hard rules

- **V2-first reads.** Every chain-read surface MUST go through `apps/studio/src/lib/chain.ts` `unifiedX` helpers (`unifiedNextId`, `unifiedGetReceipt`, `unifiedFindByReceiptRoot`, `unifiedFindByAgent`). NEVER call `getReceiptRegistry()` directly outside the lib. Lint queued (planning-003 §A.1.6).

- **Brand contract** per `brand/tokens.css` + `brand/tokens.json` (planning-003 §A.3.3). Color/font/radius tokens live there. UI_UX_GUIDE.md owns LAYOUT contract; brand/tokens owns COLOR/FONT/RADIUS contract. Hex literals NOT in `brand/tokens.json` are drift; `pnpm brand:check` (queued · USER_TODO §B-V2-9) catches them.

- **Forms derived from schema.** Any Studio form binding to a Zod enum MUST import the enum from the source-of-truth package and call `.options`. Never redeclare. Pattern: `apps/studio/src/app/skill/new/page.tsx` imports `MemoryAccessEnum`, `ShellAccessEnum`, `ConsensusTierEnum` from `@ivaronix/skills`.

- **Mobile breakpoints** per CLAUDE.md §10: 1440×900 (desktop), 375×812 (mobile · iPhone). Every UI change verified at both viewports per §11.3.

- **Server components by default.** Add `'use client'` only when wallet connection, real-time state, or browser APIs are required. Dashboard route was a `'use client'` regression (planning-003 §A.5.16); convert to server-rendered with a client island for wagmi connect.

## Studio test target

`pnpm --filter @ivaronix/studio test` runs the offline source-file regressions:
- `verify-a11-form-schema-parity.ts` (16 assertions)
- `verify-a13-studio-v2-first.ts` (37 assertions)

Live regressions (need running dev server): `pnpm --filter qa-metamask-e2e run regressions:studio-live`.

## /api routes

- `/api/auth/siwe/{nonce,verify}` — SIWE handshake (K-8 + K-9).
- `/api/run` — receipt anchor pipeline. Per-IP rate limit (10/min anonymous), per-wallet rate limit (50/hr authenticated), SIWE-required when `userWallet` claim present.
- `/api/skill/save` — per-wallet sandbox write. SIWE required. Manifest validated against `SkillManifestSchema`. Hook list scanned for shell-injection patterns.
- `/api/dashboard/[addr]` — public dashboard fetch. V2-first via `unifiedFindByAgent`.

## OG image generation

`/r/[id]/opengraph-image.tsx` per Next.js convention. Per-receipt 1200×630 PNG. Production verify after Vercel custom domain lands (USER_TODO §B-V2-2).

## Common gotchas

- `next/font/google` for Outfit + JetBrains Mono + Instrument Serif. NEVER load fonts via inline `@import` in CSS.
- wagmi v2 MetaMask connector imports `@react-native-async-storage/async-storage` (mobile-only). Webpack noop in `next.config.ts` is canonical; don't change.
- Tailwind v4 BETA: tokens via `@theme` block in CSS, NOT a `tailwind.config.ts` file. Aligns with brand/tokens.css.
- Studio dev port: 3300 (not 3000). Set in `package.json` scripts.

## File location reference

- Pages: `apps/studio/src/app/<route>/page.tsx`
- API routes: `apps/studio/src/app/api/<route>/route.ts`
- Lib: `apps/studio/src/lib/{chain,siwe-session,rate-limit,local-receipt}.ts`
- Components: `apps/studio/src/components/<Name>.tsx`
- Brand globals: `apps/studio/src/app/globals.css` (imports brand/tokens.css)
