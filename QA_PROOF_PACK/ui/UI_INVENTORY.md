# UI Inventory · Ivaronix Studio

> Auto-derived from `apps/studio/src/app/**/page.tsx` on 2026-05-13.
> Read by `UI_REAL_USER_TEST_PLAN.md` UI Inventory Gate.

## 27 routes in the launch product

| Route | Type | Auth | Wallets needed | Tested in priority |
|---|---|---|---|---|
| `/` | static | none | 0-1 | P1 Landing · P16 freshness |
| `/0g` | static | none | 0 | P10 Docs/0G/Legal |
| `/admin/treasury` | static | SIWE + admin | 1 (admin only) | P5 Marketplace · P16 freshness |
| `/agent/[handle]` | dynamic | none | 0 | P7 Agent · P16 freshness |
| `/agents` | static | none | 0 | P7 Agent |
| `/brand` | static | none | 0 | P10 Docs/0G/Legal |
| `/dashboard` | static | wallet connect | 1 | P7 Agent · P16 freshness |
| `/data-room/[id]` | dynamic | depends | 1-2 | P9 Data Room |
| `/delegate/[id]` | dynamic | depends | 1-2 | P9 Delegate |
| `/docs` | static | none | 0 | P10 Docs/0G/Legal |
| `/embed/r/[id]` | dynamic | none | 0 | P4 Receipt |
| `/global` | static | none | 0 | P10 Docs/0G/Legal |
| `/marketplace` | static | none | 0 | P5 Marketplace |
| `/marketplace/[skillId]` | dynamic | none | 0-1 | P5 Marketplace |
| `/marketplace/new` | static | SIWE | 1 (creator) | P5 Marketplace · P8 Skills |
| `/marketplace/payouts` | static | SIWE | 1 (creator) | P5 Marketplace · P16 freshness |
| `/memory` | static | wallet connect | 1-2 | P6 Memory · P16 freshness |
| `/onboard` | static | none | 0-1 | P7 Agent |
| `/privacy` | static | none | 0 | P10 Docs/0G/Legal |
| `/r/[id]` | dynamic | none | 0 | P4 Receipt · P16 freshness |
| `/r/[id]/print` | dynamic | none | 0 | P4 Receipt |
| `/skill/[id]` | dynamic | none | 0 | P8 Skills |
| `/skill/new` | static | SIWE | 1 | P8 Skills |
| `/skills` | static | none | 0 | P8 Skills |
| `/terms` | static | none | 0 | P10 Docs/0G/Legal |
| `/test-wallet` | static | wallet connect | 1 | P0 Setup (test page) |
| `/thesis` | static | none | 0 | P1 Landing · P10 Docs |

## Dynamic-route sample IDs to use in tests

| Route | Sample id source | Initial value |
|---|---|---|
| `/r/[id]` | Canonical sample receipt | `1004` (from `apps/studio/src/lib/demo-fallback.ts`) |
| `/r/[id]/print` | Same as above | `1004` |
| `/embed/r/[id]` | Same as above | `1004` |
| `/marketplace/[skillId]` | First published skill in marketplace | (capture during P5) |
| `/agent/[handle]` | Operator passport handle | (capture during P7) |
| `/data-room/[id]` | Created during P9 | (capture during P9) |
| `/delegate/[id]` | Created during P9 | (capture during P9) |
| `/skill/[id]` | First skill from `/skills` | (capture during P8) |

## API routes (touched indirectly through UI tests)

- `/api/auth/siwe/{nonce,verify}` — SIWE handshake (P0 Setup + every SIWE-gated page)
- `/api/run` — receipt anchor (P3 Run, deprecated path)
- `/api/run/estimate` — 402-style estimate (P3 Run · NEW)
- `/api/run/confirm` — 402-style confirm with 5-check verifier (P3 Run · NEW)
- `/api/run/demo` — operator-subsidised (P2 Demo)
- `/api/dashboard/[addr]` — public dashboard fetch (P7)
- `/api/skill/save` — per-wallet sandbox (P8)
- `/api/memory/key` — KV API key issuance (P6 Memory · SIWE-gated)
- `/r/[id]/opengraph-image` — OG image route (P4 Receipt · P15 Vercel)

## Coverage check

Every route above is mapped to at least one test priority. No invisible routes.

---

*Generated 2026-05-13. Refresh when new routes ship.*
