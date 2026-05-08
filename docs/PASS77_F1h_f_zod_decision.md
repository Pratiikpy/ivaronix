# PASS 77 F-1h-f — zod version decision (side-by-side coexistence)

> Locked: 2026-05-08 · supersedes the "migrate all 81 of our files to zod@4" recommendation in `PASS77_F1h_impact_analysis.md` §2.

## The finding

`pnpm --version` is `10.32.1`. Running `find node_modules -maxdepth 4 -name "zod" -type d` after F-1h-a (catalog version pins added zod@4.1.8 to opencode-* deps) shows:

```
node_modules/.pnpm/zod@3.22.4/node_modules/zod
node_modules/.pnpm/zod@3.25.76/node_modules/zod
node_modules/.pnpm/zod@4.4.3/node_modules/zod
```

Three zod versions live in the workspace simultaneously, each scoped to the packages that declared them.

## What this means

- Our existing packages (`receipts`, `skills`, `trust-layer`, `mcp-server`) keep `zod@^3` and get a 3.x install.
- The vendored `opencode-*` packages keep `zod@4.1.8` and get a 4.x install.
- TypeScript respects each package's `node_modules/zod` resolution (different package roots → different type imports).
- No shared types cross the boundary today (audit: nothing in `packages/opencode-*` re-exports zod schemas to our code).

## Implication for F-1h-f

The original plan was: migrate 81 of our files from zod@3 syntax to zod@4 syntax. That assumed a single workspace-wide zod version. Since pnpm hosts both versions transparently, **the migration isn't needed**.

F-1h-f reduces to:
1. Verify quarantine: nothing in `packages/opencode-*` re-exports a zod-typed value to our code.
2. Pin one workspace `pnpm.overrides` for the opencode-* zod range so the install is deterministic across machines.
3. Move on.

That's a 30-minute task, not a 5-day migration.

## What stays risky

- If a future commit re-exports a zod schema from `opencode-*` into our code (e.g., consuming opencode's MCP tool definitions verbatim), the version-mismatch types collide. Our quarantine doc (`packages/opencode-bin/QUARANTINE.md`) covers this — add an audit grep.
- If we ever want our code to use opencode's models (zod@4 type definitions of receipts, etc.), we'd need to migrate then. That decision can be deferred.

## Net change to PASS 77 timeline

Was: 17–19 days total (impact analysis estimate).
After this finding: F-1h-f drops from ~1 day to ~30 minutes. F-1h-g (tsc green) still unbounded but the zod work that would have surfaced there is now moot.

Updated estimate: **~16–18 days** for full PASS 77 fork. The bulk now sits in F-1h-g (tsc green across 499 vendored TS files) and F-2..F-10 (re-skin + 4 0G plugins + cutover).

## Action

Add a workspace-wide pnpm override pinning opencode-* zod, then the next atomic step (F-1h-g) starts iterating on tsc errors.
