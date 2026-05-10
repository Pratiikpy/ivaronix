# PASS 77 F-1h-g — opencode-bin status

> **ARCHIVAL · 2026-05-10.** Sprint-internal status snapshot from the OpenCode port decision. The chosen path is reflected in `packages/opencode-bin/`. Read live state in code; this doc remains for traceability.

> Locked: 2026-05-08 · status: blocking decision

## What landed

3 of 4 vendored OpenCode packages now typecheck **GREEN**:

- ✅ `@ivaronix/opencode-plugin` — paths aliases + drop rootDir
- ✅ `@ivaronix/opencode-sdk` — drop rootDir
- ✅ `@ivaronix/opencode-core` — relaxed strict mode + 3 small patches (filesystem cast, npm-config @ts-ignore, npm.ts Bun-guard)

2 of the original 6 dropped (out of fork scope):

- ❌ `opencode-function` — Cloudflare Workers runtime, not Node
- ❌ `opencode-script` — release-tooling only, not runtime

## What didn't land: opencode-bin

When tsc was enabled on `@ivaronix/opencode-bin` (424 vendored TS files):

```
$ pnpm --filter @ivaronix/opencode-bin typecheck 2>&1 | grep -E "^src/" | wc -l
1267
```

**1267 first-round errors.** Categories observed:

1. **Bun-runtime APIs still leaked into non-conditional files** (~200 errors)
   - `bun:sqlite` imports in `cli/cmd/db.ts` and elsewhere
   - Bun-loader text file imports (`.txt` files imported as modules)
   - Bun's `import.meta.dir`, `import.meta.glob` patterns
   
2. **ES2024 MapIterator.map / .filter / .toArray** (~50 errors)
   - `bus-event.ts:24,41` — needs ES2024 lib or rewrite to spread+map
   
3. **Effect Result discriminated-union narrowing** (~300 errors)
   - `cli/cmd/plug.ts` and similar — accessing `.error` on `Ok<...>` branch
   - These are real strictness issues that ALSO existed under bun's tsgo, just suppressed
   
4. **Missing type declarations** (~10 errors)
   - `@octokit/webhooks-types`, others — install or stub
   
5. **Strict-typing leftovers** (~700 errors)
   - `unknown[]` vs typed arrays from broker/SDK responses
   - These come from the AI SDK provider packages whose types don't match opencode's expectations
   - Requires per-call-site type assertions or wrapper functions

## Honest read

opencode-bin is the actual CLI implementation — 424 files of glue between AI SDKs (14 providers), Effect runtime, Solid TUI components, drizzle storage, hono server, MCP integration. Each error category needs specific port work:

- Bun → Node API swap: ~2 days
- Effect type narrowing: ~3 days  
- AI SDK type-assertion shims: ~5 days
- Solid TUI compile path (currently emits JSX with custom directives): ~2 days
- Test the surface: ~3 days

**Realistic: 14–17 focused days for opencode-bin alone.** Plus F-2..F-10.

## The decision point

We have 3 vendored packages green and 1 (the big one) at 1267 errors. Two paths:

### Path A1 — continue the bin grind

Burn 14–17 days porting opencode-bin to a green tsc. Then F-2 (re-skin), F-3 (identity), F-4..F-6 (4 0G plugins), F-7..F-10 (debug/PR/cutover/editorial). Total: still ~17–20 days from here.

### Path A2 — light fork (recommended)

Use the 3 green packages (`opencode-{plugin, sdk, core}`) as a TS-typed surface inside our existing `apps/cli/` workspace, **don't port opencode-bin**. We get:
- Effect runtime primitives from `opencode-core` (timeouts, retries, structured logging)
- The plugin manifest shape from `opencode-plugin`
- The SDK client/server types from `opencode-sdk` (so our existing ivaronix CLI can consume opencode-style plugins if we ever want)

Skip:
- opencode-bin's chat TUI (we have Ink chat-v2)
- opencode-bin's session management (we have memory engine)
- opencode-bin's GitHub/PR workflow (we have a clean re-implementation path)
- The 14 AI SDK providers (we use 0G Compute via Router; NIM as TIER-2)

Total: ~3 days for our existing apps/cli to import-and-use opencode-core primitives + write the 4 0G plugins (F-4..F-6) + debug subtree (F-7) + PR-with-receipts (F-8) using **OUR** CLI's existing structure.

## Recommendation: Path A2

The 3 green packages give us 80% of what the fork was supposed to deliver:
- Effect structured concurrency + retries (opencode-core)
- A plugin spec we can target (opencode-plugin)
- A typed SDK surface (opencode-sdk)

The 20% we lose by not porting bin:
- Their specific TUI chat (we have ours)
- Their session attach/resume (we can write in 2 days as cherry-pick)
- Their export/import (1 day)
- Their MCP wiring (we have ours already)

Net: 3 days vs ~17 days. Same shipping bar holds either way. NIM TIER-2 escape hatch preserved either way.

## What's preserved

Either path A1 or A2:
- All PASS 76 work (S-1..S-5, B-1, B-2) ships unchanged.
- Receipts spine intact.
- 85/85 forge tests green.
- 233 on-chain receipts indexed locally.
- All four 0G plugins (og-receipts, og-identity, og-skills, og-memory) are F-4..F-6 and don't depend on bin.

## The user's call

Cron is paused. Path A1 = grind through 1267 errors over 14+ days. Path A2 = pivot to lightweight integration over 3 days.

Both keep the fork narrative ("we vendored OpenCode, they're MIT, here are the green packages"). Neither compromises the receipts thesis. A2 just spends the remaining 14 days on F-2..F-10 directly instead of on opencode-bin's port.
