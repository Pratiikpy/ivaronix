# PASS 77 F-1h — Porting Impact Analysis

> **ARCHIVAL · 2026-05-10.** Sprint-internal research artefact from the OpenCode port. The actual implementation choices live in `packages/opencode-bin/`; this doc remains for context on why those choices were made.

> Locked: 2026-05-08 · status: research artifact · companion to `docs/PLAN_pass77_cli.md`

After F-1a..F-1g landed (499 TS files vendored across 6 OpenCode packages — `opencode-{plugin, sdk, function, script, core, bin}`), this doc surveys the **actual concrete porting work** needed before any of those packages compile in our pnpm/Node/tsx workspace.

## Headline numbers (real, not estimates)

```
=== bun.* API calls ===                             7 files
=== bun-conditional imports (#-aliased modules) ===  4 import lines
=== drizzle-kit / drizzle-orm references ===        28 files
=== effect imports ===                              256 files
=== zod imports ===                                  76 files
=== node-pty references ===                          1 file (post-install)

=== Our existing zod@3 surface ===                  81 files import zod
                                                    (would all need v3→v4
                                                    migration if we adopt
                                                    OpenCode's zod@4.1.8)
```

## What each blocker means

### 1. effect (256 files) — biggest and most invasive

OpenCode is built on **Effect 4.0-beta.59**, an FP-runtime library in the spirit of fp-ts/cats. 256 of the 499 vendored files import `effect` or `@effect/...`. This is not a casual dependency — it shapes how OpenCode does *everything*: error handling, async flow, dependency injection, retries.

**Port options:**
- **(a) Pin effect@4.0.0-beta.59 + transitive deps** — works for compile-time, but our existing code doesn't use effect, so we'd be running an FP runtime no other Ivaronix code touches. Bundle bloat without leverage.
- **(b) Replace effect with our existing patterns** — would require rewriting all 256 files. Effectively re-implementing OpenCode's flow control. Multi-week effort just to undo a design choice.
- **(c) Quarantine** — keep effect inside `opencode-*` packages, never let it leak into our existing code. Requires strict export discipline + lint rules.

Recommendation: **(c) quarantine** — but only if we decide the rest of the fork is worth it.

### 2. zod (76 OpenCode files + 81 OUR files at v3 = 157 files) — version conflict

OpenCode uses zod@4.1.8 (recently released, breaking changes from v3). Our `@ivaronix/receipts` and `apps/mcp-server` use zod@^3 today across **81 files**.

**Port options:**
- **(a) Upgrade everything to zod@4** — touch 81 of our files. Zod v3→v4 has migrations for `.parse()` shape, `.refine()` syntax, `z.coerce` semantics, and `z.discriminatedUnion()`. Mechanical but error-prone.
- **(b) Workspace alias** — install zod@3 + zod@4 side-by-side, alias zod-v4 inside opencode-* packages. pnpm supports it via `dependenciesMeta` overrides. Risk: type-namespace collisions when both touch the same surface.
- **(c) Defer the upgrade** — short-circuit OpenCode's zod usage with a thin shim that translates v4→v3 schemas. Builds break across all 76 files.

Recommendation: **(a) upgrade to zod@4**. Mechanical, single-direction, gets us off the conflict permanently. Cost: ~6 hours of focused migration + test repair across 81 files.

### 3. drizzle-kit / drizzle-orm (28 files) — DB migration tooling

OpenCode uses drizzle as its ORM. 28 files import drizzle. We use better-sqlite3 directly + Drizzle in the indexer (PASS 76 S-5).

**Port options:**
- **(a) Adopt drizzle workspace-wide** — replace better-sqlite3 raw queries with drizzle. Multi-day refactor.
- **(b) Stub drizzle** — write thin compat adapters so OpenCode's 28 files compile against our existing storage. Custom work, fragile.
- **(c) Quarantine** — let drizzle live inside `opencode-*`, isolate from our memory engine.

Recommendation: **(c) quarantine** + add drizzle-kit + drizzle-orm@^0.36.x as opencode-* deps. ~30 minutes.

### 4. Bun.* APIs (7 files) — runtime swap

Files use `Bun.file()`, `Bun.write()`, `Bun.serve()`. Each must be replaced with Node equivalents (`fs.readFile`, `fs.writeFile`, native `http.createServer` or hono).

Port: ~1 hour mechanical. List those 7 files in F-1h-i follow-up.

### 5. Bun conditional imports (4 import lines)

`#db: { bun: ..., node: ..., default: ... }` patterns. Node's package.json conditional exports support the same shape via `imports`. Either use Node-conditional imports verbatim, or simplify to single-target Node-only paths.

Port: ~30 min.

### 6. node-pty (1 file — postinstall fixup)

Bun ships node-pty pre-fixed; pure Node needs a manual `node-gyp` rebuild on Windows. Either drop pty entirely (if we don't need shell pseudo-terminals) or accept the build cost.

Recommendation: **drop**. We have `chat-v2` (Ink TUI) for terminal interaction; pty is for nested shells which we don't need.

## Time honest estimate (focused engineering, not cron-tick)

| Step | Files touched | Days |
|------|---|------|
| F-1h-a: pin catalog versions across 6 vendored package.json | 6 | 0.25 |
| F-1h-b: stub or quarantine drizzle | 28 | 1 |
| F-1h-c: replace 7 Bun.* call sites | 7 | 0.5 |
| F-1h-d: replace 4 conditional imports | 4 | 0.25 |
| F-1h-e: drop node-pty postinstall | 1 | 0.25 |
| F-1h-f: zod@3 → zod@4 migration across our 81 files | 81 | 1 |
| F-1h-g: get tsc -b green across all 6 vendored packages | (cumulative) | 2-3 |
| **F-1h subtotal** | — | **5-6 days** |
| F-2: re-skin to Ivaronix brand (CLAUDE.md §10) | (CSS/banner only) | 1 |
| F-3: replace identity/ with AgentPassport | ~5 | 1 |
| F-4: og-receipts plugin (PreTool/PostTool hooks) | new | 2 |
| F-5: og-skills plugin (SkillRegistry mint + nudge) | new | 2 |
| F-6: og-memory plugin (MemoryAccessLog + snapshots) | new | 2 |
| F-7: debug subcommand tree | new | 2 |
| F-8: PR-with-receipts wiring | (existing receipts) | 1 |
| F-9: cutover apps/cli/ → cli-fork | — | 1 |
| F-10: editorial pass + voice contract | — | 0.5 |
| **PASS 77 total** | — | **~17.5–18.5 days** |

(Earlier 25-day estimate was a hedge; with the impact survey done, the realistic number is 17–19 days of focused single-engineer time.)

## What ships per cron tick from here

Each cron tick now produces **one atomic F-1h sub-step**:

- Tick N: F-1h-a — pin catalog versions (6 package.jsons updated, committed)
- Tick N+1: F-1h-c — replace Bun.* calls (7 files patched, committed)
- Tick N+2: F-1h-d — replace conditional imports (4 lines patched, committed)
- Tick N+3: F-1h-e — drop node-pty postinstall (1 file removed, package.json updated)
- Tick N+4: F-1h-b — drizzle quarantine (add deps to opencode-bin/sdk only)
- Tick N+5..N+10: F-1h-f zod@3 → zod@4 migration (chunked by package: receipts, mcp-server, indexer, runtime, etc.)
- Tick N+11..N+15: F-1h-g get tsc -b green (iterate on errors)
- Tick N+16+: F-2 re-skin

This is honest, atomic, real. Each tick produces a green commit.

## Decision point

**This document IS the F-1h-i deliverable**: numbers + plan + per-tick atomic chunks. Subsequent ticks execute it. If the user reads this and says "actually, switch to cherry-pick," that's the moment to pivot — not 5 days into a port.

Per the shipping bar: nothing committed here breaks anything. The 6 vendored packages have `typecheck` short-circuited until they're green. Existing PASS 76 features (S-1..S-5, B-1, B-2) all still work as before.

— PASS 77 F-1h-i, locked 2026-05-08.
