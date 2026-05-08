# PASS 77 — CLI Depth (fork OpenCode + re-skin to Ivaronix + 0G receipts layer)

> Companion to `docs/PLAN_pass76.md`. Grounded in deep reads of `CLI Open Source Project/{OpenCode, Octogent, hermes-agent, claude-mem, awesome-claude-skills}` and a license + architecture check.
>
> Locked: 2026-05-08. Status: pending kickoff.

## Shipping bar (non-negotiable, applies to every step below)

A feature ships only when all three pass on a clean machine:

1. **One command runs it.** `ivaronix <something>` — single line. If parity with the existing CLI requires a setup ritual, the parity isn't there yet.
2. **One screenshot or URL proves it worked.** TUI screenshot, Studio receipt URL, chain tx in the explorer. Visible interaction, not "tests pass."
3. **A judge on a different machine reproduces it without our help.** Public Proof URL works without auth; `ivaronix receipt verify --tee-independent` works against any anchored receipt; `ivaronix debug receipt N` returns a complete report.

No compromise on UI / UX / functional interaction. The peer audit (see `new-entries/Codex Thinking/claude-thinking.md`) showed everyone else overpromises in READMEs and underdelivers in code. Our edge is reproducibility — every claim survives a 5-second eye-test.

**No mocks. Real or nothing.** Every plugin we layer onto the OpenCode fork must call the real 0G primitive. `og-receipts` anchors real receipts on `ReceiptRegistry`. `og-identity` resolves real `passportOf(wallet)`. `og-skills` mints to the real `SkillRegistry` with real manifestHash matching. `og-memory` writes to real KV streams via real Indexer. **No "if `EVM_PRIVATE_KEY` missing, dummy-sign locally." No "if broker unreachable, mark TIER-1 anyway." No "stub manifestHash, fix later."** A receipt that isn't anchored isn't a receipt. The OpenCode fork inherits a battle-tested chat UI; the re-skin and 0G plugin layer must hit this bar before deprecating `apps/cli/`. Per CLAUDE.md §1, §6, §7, §8, §10.

## 0. The verdict (revised)

**Fork OpenCode. Re-skin to Ivaronix brand. Add 0G receipts as a plugin layer.**

I changed my mind from "lift patterns only" to "fork." The case:

1. **MIT-licensed.** Verified at `CLI Open Source Project/OpenCode/LICENSE` line 1. Clean fork — preserve their copyright header in vendored files; our additions ship under whatever license we pick. Zero legal drag.
2. **Maturity argument is real.** OpenCode has many GitHub users + contributors. The chat UI / streaming / tool-panel / session-attach / debug subtree / plugin loader code paths are battle-tested in ways a green-field rewrite can't be in 16 days. A green-field rewrite is the riskier path here.
3. **Architecture maps cleanly to 0G.** Their plugin system is the joint where we slot in receipts, AgentPassport identity, SkillRegistry mint, MemoryAccessLog grants. We don't have to surgery the core — we layer on top.
4. **The "good CLI" benchmark is already there.** We don't need to invent the keystroke ergonomics, the streaming render, the tool panel, the attach/thread continuity. Those are solved problems in OpenCode's tree.

The only honest concern is **upstream churn drift** — same as any vendored dependency. Manage with periodic rebases. Acceptable cost.

## 1. What we fork (and what we don't)

OpenCode's monorepo has these packages under `packages/`:
- `opencode/` — the CLI entry binary (yargs commands)
- `core/` — engine: LLM provider, tool execution, session state
- `plugin/` — plugin SDK
- `function/` — tool/function definitions
- `script/` — scripts + skills support
- `extensions/` — VSCode extension and similar
- `identity/` — auth layer (we replace this entirely)
- `app/`, `desktop/`, `console/`, `containers/`, `enterprise/` — out of scope (Electron shell, web console, enterprise edition)

**Vendor into Ivaronix:** `opencode/`, `core/`, `plugin/`, `function/`, `script/`, `extensions/`. Land them under `apps/cli-fork/` or merged into existing `apps/cli/`.

**Replace entirely:** `identity/` — we use AgentPassport ERC-7857 INFT.

**Skip:** desktop app, web console, enterprise, containers. Out of our Track-1 scope. We have Studio for the web surface.

## 2. Re-skin contract (CLAUDE.md §10 — non-negotiable)

The fork must look indistinguishable from a from-scratch Ivaronix CLI. Tokens locked:

- **Banner mark:** brackets-with-italic-`i` + green tittle (`#16a34a`). Drop OpenCode's logo.
- **Tokens (terminal palette):** ink `#0a0a0a` on cream `#fafaf7` for printed sections; `#16a34a` (live), `#7c3aed` (burn), `#d97706` (warn), `#dc2626` (deny) for chip colors. Map via `picocolors` / `chalk`.
- **Typography (TUI):** Outfit weight 600 for headings (terminal supports SGR; bold serves), JetBrains Mono for hashes/addresses. Fallbacks where TTY can't render.
- **Binary name:** `ivaronix`. Drop `opencode`.
- **Default model:** `qwen/qwen-2.5-7b-instruct` (CLAUDE.md / BUILD.md §11.4) on 0G Compute broker. Drop their default.
- **Splash / first-run:** "Ivaronix · 0G Agent OS · receipts on every action" — not OpenCode marketing.
- **Slash command set:** keep the verbs, swap the names where they conflict with our model. Our 19 chat-v2 commands stay; OpenCode's commands get renamed/aliased into our nomenclature.
- **Editorial tone:** CLAUDE.md §9 voice contract. No "delve / unlock / harness." Our messaging gets re-written wherever the fork has prose.

## 3. The 0G layer (built as a plugin, not a fork modification)

Use OpenCode's plugin SDK (their `packages/plugin/`). Implement these as one or two plugins so future upstream rebases don't conflict with our changes:

### Plugin: `@ivaronix/og-receipts`
- Hooks: `PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`.
- Behavior: every tool-call result in OpenCode → schema-validated `Receipt` → canonical hash → signed by `EVM_PRIVATE_KEY` → anchored on `ReceiptRegistry` → streamId pointer in MemoryAccessLog if it touched memory.
- Receipt types it emits: `doc_ask`, `code_change`, `skill_exec`, `memory_access`, `swarm`, plus our existing `consensus`, `burn`, `passport_update`, `audit`.
- TIER-1 vs TIER-2 marking: receipt `verificationMethod` field set per CLAUDE.md §6.

### Plugin: `@ivaronix/og-identity`
- Replaces OpenCode's `identity/` package usage.
- Resolves `passportOf(wallet)` from `AgentPassportINFT` on chain start; uses passport tokenId as actor in every receipt.
- `ivaronix passport mint/show/restore/authorize/revoke/executor` commands.

### Plugin: `@ivaronix/og-skills`
- Connects OpenCode's skill loader to our SkillRegistry on-chain.
- `ivaronix skill install <id>` reads on-chain manifestHash, fetches body from 0G Storage, verifies hash, registers locally.
- `ivaronix skill propose` (the autonomous-creation nudge) → mint to SkillRegistry → emit `skill_publish` receipt.

### Plugin: `@ivaronix/og-memory`
- Wraps OpenCode's session/memory subsystem with `MemoryAccessLog` grant/revoke + 0G Storage manifest snapshots.
- Wallet-derived stream IDs (`keccak256("ivaronix:memory:v1:" + addr)`) per PLAN_pass76 S-2.

## 4. The OpenCode features we get for free

Once forked + re-skinned + plugins layered, we inherit these without writing them:

- **Debug subcommand tree** (`debug/{agent,config,file,lsp,ripgrep,skill,snapshot,startup}.ts`) — we add `debug receipt|passport|memory|chain|storage|compute` as new subcommands inside the same tree.
- **Session attach / resume** (`tui/{attach,thread}.ts`) — we wire MemoryAccessLog grant on resume.
- **GitHub native PR workflow** (`github.ts`, `pr.ts`) — we add receipt linkage to PR body.
- **Export / import** (`export.ts`, `import.ts`) — we extend with on-chain receipt list bundling.
- **Plugin loader** (`plugin/`) — used directly by all four 0G plugins above.
- **MCP host** — already present in OpenCode (their MCP command).
- **Streaming markdown render + tool panels** — already present in their TUI.
- **Slash command palette + autocomplete** — already present.

Every one of these would have been a 1-3 day build for us. We get them in the cost of the fork.

## 5. Sequence

| Step | Item | Days | Receipt impact |
|------|------|------|----------------|
| F-1 | Vendor OpenCode 6 packages into `apps/cli-fork/` | 2 | — |
| F-2 | Re-skin: brand tokens, banner, binary name, defaults, splash | 3 | — |
| F-3 | Replace `identity/` with AgentPassport resolver | 2 | passport_update receipts on bind |
| F-4 | `@ivaronix/og-receipts` plugin (PreTool/PostTool hooks) | 4 | every tool call → receipt |
| F-5 | `@ivaronix/og-skills` plugin (SkillRegistry + propose nudge) | 3 | skill_exec + skill_publish |
| F-6 | `@ivaronix/og-memory` plugin (MemoryAccessLog + snapshots) | 3 | memory_access receipts |
| F-7 | New debug subcommands (receipt/passport/memory/chain/...) | 3 | surfaces existing |
| F-8 | PR-with-receipts (link existing code_change receipts in PR body) | 2 | links existing |
| F-9 | Cut over: deprecate `apps/cli/` once parity proven | 2 | — |
| F-10 | Editorial pass: kill OpenCode prose anywhere it leaked | 1 | — |

**Total wall-clock:** ~25 days single-engineer (vs 16 in the rewrite plan I had before). Higher than rewrite, but **lower risk** because we inherit a battle-tested base.

Branching: each step on its own `pass77/<sub-id>` branch; merge to `main` per F-N parity.

## 6. Migration path for `apps/cli/`

We don't yank it day-1. Both binaries co-exist for the cutover window:
- Day 1-22: `apps/cli/` keeps shipping. `apps/cli-fork/` builds in parallel.
- Day 23: feature parity check (every command in `apps/cli/` works in `apps/cli-fork/`, with at least one receipt round-trip per command).
- Day 24: `ivaronix` symlink points at `cli-fork`. Old `cli` lives on as `ivaronix-classic` for a release.
- Day 25+: deprecate `cli-classic` after 1 release.

This way the fork doesn't gate the live testnet demo — we keep shipping receipts the whole time.

## 7. The skip list (unchanged from the previous draft)

These stay rejected for this pass. Documented so they don't slip back:
- 7 terminal backends (Hermes) — over-engineered.
- Cron / scheduled tasks (Hermes) — we have daemon.
- Multi-platform messaging (Discord/Slack/WhatsApp/Signal) — Telegram from PLAN_pass76 S-3 is enough.
- Voice mode (Hermes) — wrong audience.
- Personality system (Hermes) — low ROI.
- OpenClaw migration (Hermes) — no legacy users.
- Octogent tentacle cosmetics — zero functional value.
- OpenCode's `desktop/` and `console/` — we have Studio.
- OpenCode's `enterprise/` — premature.

## 8. The user-experience picture (after fork + re-skin + plugins)

Bare `ivaronix` opens chat-v2 (now powered by OpenCode's TUI under our brand). The banner is the brackets-with-italic-`i` mark + green tittle. Type `/`, fuzzy palette appears. Type `/skill private-doc-review contract.pdf` — the consensus loop runs with role panels showing live disagreement. At the end, a one-line nudge offers to mint the workflow as a skill. Accept; SKILL.md scaffold opens in `$EDITOR`; save → on-chain mint with creator-fee-split → `skill_publish` receipt anchored.

Walk away. Tomorrow: `ivaronix session list` shows yesterday's session; `ivaronix session attach <id>` resumes — chat history restored from snapshot, memory grants restored from MemoryAccessLog, the resume itself emits a `memory_access` receipt.

When something looks off: `ivaronix debug receipt 280` prints the full trail. `ivaronix debug compute` pings the broker. `ivaronix debug chain` shows the six contract addresses with their `nextId` counters live.

Open a PR: `ivaronix pr create` makes the GitHub PR; the body's `## Receipts` section lists every `code_change` receipt id touched in the branch with `/r/<id>` links. `ivaronix pr verify <pr#>` confirms ALL_RECEIPTED.

That's "best CLI on 0G" — OpenCode's polish, our brand, our receipts spine, our 0G primitives wired through their plugin system. Battle-tested base + thesis-true layer.
