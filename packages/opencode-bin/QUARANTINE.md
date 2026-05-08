# Quarantine boundaries (PASS 77 F-1h-b)

The OpenCode fork inherits a few heavy ecosystem deps that we intentionally **do not let leak** into the rest of `packages/` or `apps/`. This document records the boundary so any future contributor can run a 30-second audit.

## Quarantined deps (must stay inside `packages/opencode-*/`)

- `effect@4.0.0-beta.59` and the `@effect/*` family (FP runtime + opentelemetry layer)
- `drizzle-orm@1.0.0-beta.19-d95b7a4` (DB ORM)
- `solid-js@1.9.9` (Solid components in the TUI parts)
- `@opentelemetry/*` (observability)
- The 14 `@ai-sdk/*` provider adapters (alibaba/anthropic/azure/cerebras/cohere/deepinfra/gateway/google/google-vertex/groq/mistral/openai/openai-compatible/perplexity/togetherai/vercel/xai)
- `tree-sitter-bash` / `tree-sitter-powershell` / `web-tree-sitter`
- `@lydell/node-pty` (kept with caveat in opencode-bin)

## Audit command

Run from the repo root to confirm the quarantine holds:

```bash
# Should be empty (nothing outside opencode-* imports these):
grep -rln "drizzle" packages --include='*.ts' --include='*.tsx' | grep -v opencode-
grep -rln "drizzle" apps --include='*.ts' --include='*.tsx'

grep -rln "from ['\"]effect" packages --include='*.ts' --include='*.tsx' | grep -v opencode-
grep -rln "from ['\"]@effect" packages --include='*.ts' --include='*.tsx' | grep -v opencode-

grep -rln "solid-js" packages --include='*.ts' --include='*.tsx' | grep -v opencode-
```

## Status (locked 2026-05-08)

```
drizzle (in opencode-*):   27 files
drizzle (anywhere else):    0 files   ✓
```

All other quarantined deps were pinned to `opencode-*` packages by F-1h-a. Drizzle quarantine is the highest-risk one because PASS 76 S-5 introduced `@ivaronix/indexer` which uses `better-sqlite3` directly (not drizzle) — verified clean.

If a future commit imports any of the quarantined deps from outside `opencode-*`, that's a regression: revert it or move the consuming code into `opencode-*` so the dep stays contained.
