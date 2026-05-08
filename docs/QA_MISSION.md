# Ivaronix · QA Mission

> Locked: 2026-05-08 · this is the verify-everything brief for the contracted QA engineer.
>
> **Goal:** confirm every CLI command and every Studio surface is **smooth, premium, professional, and functionally top-notch**, with **real keys, real chain, real broker — no mocks, no soft-fails** (CLAUDE.md §1, §6, §8).
>
> The QA engineer should be able to clone the repo on a clean machine, follow this doc in order, and either reach **all green** or file precise issues.

---

## 00. Mindset (read this first — every line)

The single most important section. If the engineer skips this, the rest is busywork.

### 00.1 The rule: make it work, then make it beautiful

Primary task is **confirm every feature works once, end-to-end, like a real user would use it.** That's the test.

For every feature:
1. Use it ONCE the way a real user would (not 100 times)
2. Take a screenshot OR record a short video that proves it worked
3. If it works → tick the box, move on
4. If it doesn't work → file precisely, then fix it properly (not a lazy patch)

**Don't overtest.** If `ivaronix demo` runs once cleanly with a real receipt URL, that feature is verified — move on. Don't run it 50 times. Don't fuzz it with random prompts. That's aggressive testing (later, optional).

The analogy: testing Claude Code = install it, set a model, send one real prompt, get one real response. That's the primary test. NOT "send 100 prompts and check token counts." Same here.

### 00.2 Two tiers — primary first, aggressive only after

**Tier 1 — PRIMARY (must finish all of these before Tier 2 starts):**
Every feature works once, end-to-end, with screenshot/video proof. This is what wins the grant. This is the entire shipping bar (CLAUDE.md §1).

**Tier 2 — AGGRESSIVE (only if Tier 1 is fully green):**
Load tests, fuzzing, 100× prompts, stress, edge-case probing, accessibility deep-dive, performance instrumentation. Nice-to-have. Don't start this until Tier 1 is 100% green and signed off.

If the engineer is short on time, Tier 1 wins. Always.

### 00.3 Visual proof is mandatory

For every feature, the engineer captures one of:
- A screenshot of the working state
- A short screen-recording (≤30s) of the flow
- Stdout copy-pasted into the issue tracker

Without one of those, the feature is **not verified** — even if it "looked like it worked."

### 00.4 Fix what you find — don't be lazy

If the engineer finds a real bug while testing, they fix it properly:
- Not a one-line patch that hides the symptom
- Not "add a try/catch and silence the error"
- Find the root cause, fix it, write the commit message that explains why

This is in CLAUDE.md §1: no compromise. We're trying to win.

### 00.5 Be balanced, not perfectionist

Don't bikeshed. Don't argue about pixel-perfect kerning. Don't run a 50-page accessibility audit on a one-button page. Use judgment. The bar is "premium and smooth like Claude Code / OpenCode but on 0G with our brand." That's it.

### 00.6 Reference resources — consult these before quitting

If something looks wrong, broken, or unclear, **check these folders before giving up or filing a question**:

| When you're stuck on… | Look here |
|---|---|
| Anything 0G-related (SDK behavior, contract patterns, KV semantics, broker calls) | `C:\Users\prate\Downloads\oglabs\oglabs resources` |
| Anything CLI-related (chat UX, slash commands, debug subtree, plugin system, streaming render) | `C:\Users\prate\Downloads\oglabs\CLI Open Source Project` (OpenCode + HermesAgent + Octogent + claude-mem + awesome-claude-skills) |
| Working code from projects already shipped on 0G | `C:\Users\prate\Downloads\oglabs\og-projects-showcase` |
| What competing grant entries did + how they handled the same problem | `C:\Users\prate\Downloads\oglabs\entries` and `C:\Users\prate\Downloads\new-entries` |
| The visual contract (what every Studio surface MUST match) | `C:\Users\prate\Downloads\Ivaronix Brand Kit _standalone_.html` (also at `brand/Ivaronix.html`) |
| Receipt schema details, canonical hash rules | `RECEIPTS_SPEC.md` (root) |
| Which receipts are tier-1/tier-2 + the honesty rules | `CLAUDE.md` §1, §6, §7, §8 |

The engineer has a giant reference library. Use it. Don't ask "is this how it should work?" without checking first.

### 00.7 The mindset summary (one line)

> **"Test like a real user. Use every feature once. Screenshot or video everything. Fix what's broken properly. Match the brand kit HTML exactly. Skip aggressive testing until primary is green."**

If in doubt, that line is the answer.

---

## 0. Setup (one-time)

Repo: `git clone <repo-url> && cd oglabs`

Prerequisites the engineer needs:
- Node ≥ 20
- pnpm ≥ 10
- Docker Desktop (for `pnpm dev:kv`)
- Foundry (`forge`) for contract tests
- A real EVM wallet on 0G Galileo testnet with ≥ 1 OG balance
- (optional) `gh` CLI for `pr create` end-to-end
- (optional) Telegram bot token from @BotFather for the bot
- MetaMask installed in the browser used for Studio QA
- Claude Desktop or Cursor for MCP server end-to-end

`.env` at repo root must contain at minimum:

```
EVM_PRIVATE_KEY=0x...                                # the QA wallet's private key
EVM_WALLET_ADDRESS=0x...                              # same wallet's address
OG_NETWORK=testnet                                    # do not use mainnet for QA
ZG_API_SECRET=app-sk-...                              # 0G Compute key (if testing TIER-1)
TELEGRAM_BOT_TOKEN=...                                # only if testing the bot
```

Bootstrap:

```
pnpm install
pnpm dev:kv                                           # Docker container live, http://localhost:6789
pnpm -r typecheck                                     # every package must show Done
cd contracts && forge test && cd ..                   # 85/85 must pass
```

If any of the three above commands fail, **stop and file an issue**. The rest of QA depends on them.

---

## 1. CLI — every command must run end-to-end

Every line below must succeed with visible output. **Real on-chain reads, not mocks.**

### 1.1 Health + bootstrap

```
ivaronix doctor                          # all 6 sections green
ivaronix doctor --kv-local               # local KV section: HTTP 200
ivaronix doctor --metrics                # live counts from chain
```

### 1.2 The killer demo (must work end-to-end)

```
ivaronix demo                            # receipt anchored, 3 proof URLs, all 3 resolve
ivaronix demo --tier standard            # 3-role consensus
ivaronix demo --tier high-stakes         # 5-role consensus
```

For each `demo` invocation: copy the `/r/<id>` link, open it in the browser, confirm receipt page renders. Click `chainscan-galileo.0g.ai/tx/<hash>` — confirm tx exists. Run `ivaronix receipt verify <id> --tee-independent` — must return PASS or honest amber for TIER-2.

### 1.3 Debug subtree (PASS 77 F-7) — surfaces the spine

```
ivaronix debug receipt 280               # local↔chain receiptRoot match
ivaronix debug passport                  # tokenId + receipt count
ivaronix debug memory                    # CapabilityRegistry + memory_access count
ivaronix debug skill private-doc-review  # versions on chain
ivaronix debug chain                     # 6 contracts + nextId
ivaronix debug storage                   # indexer + local KV ping
ivaronix debug compute                   # broker providers + ledger
ivaronix debug startup                   # OS + Node + env vars
```

### 1.4 Stats + indexer (PASS 76 S-5, PASS 77 F-stats)

```
ivaronix stats                           # editorial layout
ivaronix stats --json                    # machine-readable
ivaronix indexer backfill                # idempotent on rerun
ivaronix indexer stats
ivaronix indexer list --type doc_ask --limit 5
ivaronix indexer tail                    # press Ctrl-C after 30s; cursor advanced
```

### 1.5 Memory + sessions

```
ivaronix memory stream-id <addr>         # same addr → same id (case-insensitive)
ivaronix memory remember "hello qa"
ivaronix memory recall "hello"
ivaronix memory list
ivaronix memory grant 0x2222222222222222222222222222222222222222 --scope qa-test --ttl 1h
ivaronix memory revoke <grantId-from-above>
ivaronix memory snapshot
ivaronix session list
ivaronix session show <id>
ivaronix session prune --before 2099-01-01 --dry-run
```

### 1.6 Compute + model

```
ivaronix compute test
ivaronix compute balance
ivaronix compute warmup                  # check-only mode (no tx)
ivaronix model list-providers
```

### 1.7 Doc / code / audit / swarm / watch

```
ivaronix doc ask file.pdf "find risks" --burn --quick
ivaronix code <task> --files <paths> --apply --interactive
                                         # y/N/a/q prompt walks each hunk
ivaronix audit <repo-path> --quick
ivaronix audit <repo-path> --high-stakes
ivaronix swarm run --worktree --cleanup
ivaronix watch --on-change               # touch a file, see receipt
```

### 1.8 Daemon + native-host pairing (PASS 76 S-4)

```
ivaronix daemon start <repo>
ivaronix daemon status
ivaronix daemon logs
ivaronix daemon stop
ivaronix daemon register-host
ivaronix daemon host-info                # confirm manifest + reg key written
ivaronix daemon unregister-host          # confirm manifest + reg key removed
```

On Windows, after `register-host`, run `reg.exe QUERY "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.ivaronix.daemon" /ve` and confirm the value points at the manifest path. After `unregister-host`, the same query must fail with "ERROR".

### 1.9 PR-with-receipts (PASS 77 F-8)

```
ivaronix pr create --title "x" --body "y" --print-only
                                         # prints body + Receipts table to stdout
ivaronix pr verify <pr#> --body-file <stub.md>
                                         # ALL_RECEIPTED ✓
```

### 1.10 Export / import

```
ivaronix export -o /tmp/bundle.json
ivaronix import /tmp/bundle.json --dry-run
ivaronix import /tmp/bundle.json         # idempotent
```

### 1.11 Passport + skill

```
ivaronix passport show
ivaronix passport mint                   # only if no passport yet
ivaronix passport authorize <addr> --until 2099-01-01
ivaronix passport revoke <addr>
ivaronix skill list
ivaronix skill inspect private-doc-review
ivaronix skill verify private-doc-review
ivaronix skill eval private-doc-review --test-input <file>
```

### 1.12 Receipt verification

```
ivaronix receipt list
ivaronix receipt show <id>
ivaronix receipt verify <id> --tee-independent
                                         # must return PASS for TIER-1, amber for TIER-2
```

### 1.13 OpenClaw + DA + serve

```
ivaronix openclaw verify --check-env
ivaronix da preflight
ivaronix serve                           # then curl all 5 endpoints
```

### 1.14 chat-v2 (the killer surface)

Bare invocation:

```
ivaronix                                 # opens chat-v2 Ink TUI in TTY
ivaronix < piped.txt                     # falls back to chat-classic in piped mode
```

In **chat-v2** TUI, verify:
- Banner with brackets + italic-i + green tittle mark renders
- Type a prompt → streaming markdown appears as the model types
- Tool calls render in collapsible panels (storage upload / compute / chain anchor)
- Type `/` → fuzzy palette appears, prefix matches first
- Try fuzzy: `/skl` matches `/skill` and `/skills` and the direct-activation skills
- All 19 slash commands work: `/help /cost /usage /passport /skill /skills /model /memory /history /resume /save /clear /retry /undo /exit` plus direct `/<skill-name>` activation
- Multi-line input: shift+enter newline; ctrl+a/e move cursor; arrow keys cycle history
- Paste with newlines preserves them
- Hit ctrl-D → conversation auto-saves
- Re-open `ivaronix` → `/resume` lists yesterday's conversation
- `ivaronix session attach <id>` resumes the same conversation

---

## 2. Studio (Next.js, http://localhost:3300) — every route + MetaMask

```
pnpm --filter @ivaronix/studio dev       # localhost:3300
```

For each route below, verify:
- **(a) disconnected** state renders cleanly with a connect-wallet CTA
- **(b) connected with MetaMask** state renders real on-chain data
- **at desktop 1440×900** AND **mobile 390×812**

### 2.1 Routes

```
/                                         hero, 4-light row, real receipt count from chain
/onboard                                  drop-zone, run flow, MetaMask sign step works
/skills                                   skill catalog, search, filter
/skill/[id]                               skill detail page
/r/<receipt-id>                          public Proof page; all 3 states (pending / verified / mismatch)
/agent/[handle]                           agent profile
/memory                                   grant + revoke flow on chain
/global                                   live counts from indexer DB
/dashboard                                connected wallet view
/test-wallet                              test surface
/brand                                    native React; open brand/Ivaronix.html in another tab — must look IDENTICAL
```

### 2.2 API routes

```
GET  /api/run                            (or POST per the route file)
GET  /api/onboard/metadata
GET  /api/dashboard/<addr>
```

### 2.3 Visual contract (CLAUDE.md §10) — non-negotiable

For every Studio surface, screenshot at **1440×900** + **375×812** + **390×812** and verify:

- Cream `#fafaf7` background, ink `#0a0a0a` foreground (NOT the warmer `#1a1a1a`)
- Three font families loaded via `next/font/google`: **Outfit** (sans, weights 500/600/700), **Instrument Serif italic** (accents), **JetBrains Mono** (hashes/code). System fonts as default = regression.
- Border radii: `10px / 14px / 16px / 20px`. Sharper radii (4–8px) read as draft-quality.
- Hero density on `/`, `/onboard`, `/skills`: hero band with concrete numbers (live receipt count, agent count) — not just a headline + button.
- Cards lift on hover: `translateY(-2px)` + border-color tint.
- Header: sticky, 64px tall, `backdrop-filter: blur(20px)`, brackets-only italic-i mark on the left, nav links on the right.
- Footer: multi-column grid (Product / Docs / Network / Social).
- Section eyebrows: uppercase + letterspacing.
- Four-light row chips on every receipt page (Storage / Compute / TEE / Chain).
- Logo (brackets + italic-i + green `#16a34a` tittle) renders correctly on **every** page header AND in the favicon (browser tab icon).

### 2.4 Side-by-side check

Open `brand/Ivaronix.html` in one tab, the live Studio in another tab. **Layout, palette, type, radii, spacing, hover behavior must all match.** If Studio looks "less designed" — colors weaker, type blander, radii sharper — that's a Studio bug, not a brand drift. File an issue.

---

## 3. Cross-surface integrity (the moat — most important test)

This proves the receipts spine works in both directions.

```
# From CLI:
ivaronix memory grant 0x2222222222222222222222222222222222222222 --scope qa-cross --ttl 1d --reads 50

# Note the grantId from the output. Now in Studio:
# Open /memory — within 5 seconds, the new grant must appear in the active grants list
# with grantee=0x2222… scope hash + TTL + reads cap matching the CLI output.

# Now from CLI:
ivaronix memory revoke <grantId>

# In Studio /memory: the row must update within 5 seconds — REVOKED chip,
# not the Revoke button anymore. Active count goes down by 1; total stays the same
# (revoked grants stay listed for audit history).
```

Both directions must agree. CLI ethers + Studio wagmi/viem read the same chain via the same ABI on the same RPC.

---

## 4. MCP server (Claude Desktop / Cursor)

```
pnpm --filter @ivaronix/mcp-server dev
```

In Claude Desktop or Cursor, add the MCP server (stdio). The 5 tools must list:

- `ivaronix_ask`
- `verify_receipt`
- `search_memory`
- `install_skill`
- `passport_show`

Each must execute end-to-end. `ivaronix_ask` must produce a real receipt URL.

---

## 5. Telegram bot (PASS 76 S-3) — only if user provided a token

```
pnpm --filter @ivaronix/telegram-bot exec tsx src/smoke.ts   # must print SMOKE OK
pnpm --filter @ivaronix/telegram-bot dev                     # must say "online as @YourBot"
```

In Telegram on a phone, find the bot, send:

```
/start                  → menu
/connect 0xaa954c33810029a3eFb0bf755FEF17863E8677Ce
/passport               → on-chain passport details
/receipt 280            → indexed receipt + Studio URL + explorer URL
/run summarize this readme
                        → real CLI run, real output
```

`/run` must produce real Ivaronix CLI output (not mocked). The Studio URL in `/receipt` must open the same receipt page on a different device.

---

## 6. Foundry tests

```
cd contracts && forge test
```

**85/85 must pass. No skips.** No warnings beyond LF/CRLF.

Run a single suite to confirm clean output:

```
forge test --match-contract SubscriptionEscrow
```

23 tests should pass with full coverage of: 3 interval modes, all invariant reverts, check-in drain + pause, alert drain, fund + auto-resume, grace expiry, propose/accept handshake, cancel by either party, withdrawRemaining only after terminal.

---

## 7. Workspace typecheck

```
pnpm -r typecheck
```

**Every package must show `Done`.** No errors, no skips beyond the 3 vendored opencode-* packages whose `typecheck` script intentionally short-circuits to a status echo (these are scaffolded for the A2 path, not yet integrated — see `docs/PASS77_F1h_g_bin_status.md`).

The packages whose typecheck must be GREEN:
- `@ivaronix/cli`
- `@ivaronix/studio`
- `@ivaronix/mcp-server`
- `@ivaronix/telegram-bot`
- `@ivaronix/indexer`
- `@ivaronix/og-storage`
- `@ivaronix/og-chain`
- `@ivaronix/og-router`
- `@ivaronix/core`
- `@ivaronix/receipts`
- `@ivaronix/runtime`
- `@ivaronix/memory`
- `@ivaronix/skills`
- `@ivaronix/og-toolkit`
- `@ivaronix/opencode-plugin`
- `@ivaronix/opencode-sdk`
- `@ivaronix/opencode-core`

---

## 8. Edge cases (must fail clean, never crash)

1. **Disconnect internet** → CLI commands fail with clean errors, no Node stack traces leaking.
2. **Wrong `OG_NETWORK`** (e.g. `mainnet` while wallet has only testnet OG) → clean rejection with hint to switch.
3. **Missing `EVM_PRIVATE_KEY`** → clear `"set EVM_PRIVATE_KEY in .env"` error, exit 1.
4. **Bad receipt id** (`debug receipt 9999999`) → "not on chain" message, not crash.
5. **Bad address** (`debug passport not-an-addr`) → "invalid address" message, not crash.
6. **Indexer DB wiped** → first command says "run `ivaronix indexer backfill`".
7. **Docker daemon down** → `pnpm dev:kv` says `"Docker daemon not reachable. Start Docker Desktop and re-run."`
8. **No `gh` CLI** → `pr create` fails with `"gh pr create failed"` + hint, exit 1.
9. **No `TELEGRAM_BOT_TOKEN`** → bot fails with `"TELEGRAM_BOT_TOKEN missing. Get one from @BotFather"`, exit 1.
10. **Pass invalid arg** (e.g. `ivaronix demo --tier silly`) → clean validation error, no crash.
11. **MetaMask rejected signature in Studio** → UI shows clean "rejected by user" state, doesn't lock up.
12. **Network down mid-anchor** → CLI shows "anchor failed" with actionable error.

---

## 9. Honesty contract (CLAUDE.md §6) — must be enforced everywhere

Verify:

- Receipts using NIM (NVIDIA NIM external provider) display **TIER 2 / amber chip / `verificationMethod: 'external-signed'`** — never green.
- Receipts using 0G Compute TEE display **TIER 1 / green chip / `verificationMethod: 'router_flag'` or `'compute_sdk_process_response'`**.
- If broker is unreachable, the receipt says so explicitly. **Must not** soft-fail to TIER 1.
- If `EVM_PRIVATE_KEY` is missing for a path that needs signing, the path errors out — does not stub-sign.
- If indexer is empty, commands that need it (e.g. `pr verify`) say so plainly with the backfill hint.

If any UI surface marks a TIER-2 receipt as green, or vice versa, **that is a P0 bug. File immediately.**

---

## 10. Cross-platform sanity

We built and verified on Windows. The QA engineer should verify:
- macOS — `ivaronix demo`, `pnpm dev:kv`, `forge test` all work
- Linux — same set
- Windows — same set (we already verified)

If a platform-specific path crashes (e.g. PowerShell vs bash), file an issue.

---

## 11. What is intentionally NOT built (do not file as missing)

- **Path A/B hosted-runtime mode** (the "deploy 10 agents in one cmd") — explicitly skipped per CLAUDE.md §8 (don't add features that need a stack of dependencies to verify). The replacement: a 30-line shell loop running `ivaronix demo` with N keypairs gives the same demo answer.
- **Mainnet contracts** — waiting on the user to fund the deployer wallet `0xaa954c33810029a3eFb0bf755FEF17863E8677Ce` on chainId 16661. The deploy script is ready (Phase B Day-23).
- **`@ivaronix/cli` published to npm** — waiting on user's npm credentials.
- **Public HTTPS Studio deploy** — waiting on user's Vercel / Render auth.
- **Live Telegram bot** — needs user to get a token from @BotFather. Code is ready; smoke-test passes.
- **`opencode-bin` ported to Node** — explicitly skipped (1267 errors, 14+ days, replaced by A2 cherry-picks). The 3 vendored packages we DO use (plugin/sdk/core) typecheck green; their integration into apps/cli was done as cherry-picked patterns, not a full fork.

---

## 12. Reporting

For each issue found:

1. **Title**: terse one-liner (e.g. "debug receipt crashes on negative id")
2. **Steps to reproduce**: numbered list, copy-pastable commands
3. **Expected**: what the shipping bar says should happen
4. **Actual**: what happened (paste stdout/stderr verbatim)
5. **Severity**:
   - **P0** = TIER mismarking, fake data displayed as real, crash on common path, mainnet-blocking
   - **P1** = command works but visual contract broken (palette wrong, font fallback, broken layout)
   - **P2** = edge case crashes, error messages unclear, polish items
   - **P3** = cosmetic, doc typos
6. **Commit hash**: paste output of `git rev-parse HEAD` so we know exactly what was tested

Submit issues via GitHub Issues on the project repo.

---

## 13. The shipping bar (the standard the QA engineer enforces)

Every feature must satisfy these three (CLAUDE.md §1):

1. **One command runs it.** No multi-step setup.
2. **One screenshot or URL proves it worked.** Visible end-to-end.
3. **Reproducible on a different machine without our help.** Public Proof URL, third-party explorer, or `ivaronix receipt verify --tee-independent` works for the engineer's machine.

If a claim in this doc fails any of those three, file it.

---

**Total surface to verify:** ~80 CLI invocations, 11 Studio routes × 2 states × 2 viewports = 44 visual states, 85 forge tests, 17 typecheck packages, 12 edge-case break-tests, 1 cross-surface integrity test, 1 MCP integration. Estimate: **2 focused engineering days** for full coverage.

When done: every box ticked = we're ready to demo to OG Labs grant judges.

---

## 14. Test mode (how the engineer works) [TIER 1 — PRIMARY]

**This is human testing — no DOM scripts, no headless automation, no shortcuts.** Real mouse, real cursor, real MetaMask. Every visual claim is verified with screenshot or screen-recording. No exceptions.

> **Tier note:** sections §14–§19 below are **PRIMARY** (do these first, must all pass). Sections §20–§22 are **AGGRESSIVE** (start only after PRIMARY is fully green).

### 14.1 Roles to walk through

The engineer plays each role for one full pass. Same wallet, different mindsets.

- New user journey
- Wallet owner flow
- Power user flow
- Team lead flow
- Skeptic flow
- Failure hunter
- Visual judge
- Mobile user

### 14.2 Core passes (functional)

- Wallet connect flow
- Private doc flow
- Receipt proof flow
- Memory grant flow
- Memory revoke flow
- Burn mode flow
- Skill install flow
- CLI parity flow

### 14.3 Visual passes

- Desktop visual pass
- Mobile visual pass
- Empty state pass
- Loading state pass
- Error state pass
- Slow network pass
- Modal alignment pass
- Text overflow pass

### 14.4 Trust passes (the receipts thesis)

- Chain evidence check
- Receipt verification check
- No-mock enforcement
- Real-key enforcement
- Permission gate check
- Reconnect recovery check
- Cross-device sync check
- Audit trail check

### 14.5 Premium passes

- Screenshot quality pass
- Video walkthrough pass
- Keyboard-only pass
- Accessibility pass
- Brand consistency pass
- Smooth transition pass

---

## 15. Visual / UI verification checklist

- MetaMask manual every flow
- Real mouse, no DOM
- Screenshot every page state
- Record golden-path video
- Side-by-side with HTML
- Desktop, tablet, mobile viewports
- Empty state per page
- Loading state per page
- Error state per page
- Skeleton state per page
- Hover, focus, active states
- Disabled button states
- Form validation messages
- Toast notification timing
- Modal close behaviors
- Mobile gestures (swipe, pinch)
- Long hash truncation
- Long agent name overflow
- Long receipt body wrap
- Slow network throttle (3G)
- Reduced-motion preference
- Browser back-button safety
- Refresh mid-flow recovery
- Multi-tab same wallet
- Chinese font rendering
- Right-to-left preview

---

## 16. Accessibility checklist

- Keyboard tab order
- Focus ring visibility
- Screen reader labels
- Color contrast WCAG AA
- Image alt text
- Form labels associated
- Skip-to-content link
- Heading hierarchy correct
- ARIA roles validated
- Color-blind palette safe

---

## 17. CLI smoothness checklist

- Tab completion bash
- Tab completion powershell
- Help text quality every cmd
- Error messages actionable
- Spinner during long ops
- Progress bars uploads
- Ctrl-C cleanup safe
- Concurrent invocation safety
- Output piping (--json)
- Exit codes correct
- Wide terminal 200 cols
- Narrow terminal 80 cols
- ANSI off in pipes
- Color codes meaningful

---

## 18. Functional integrity checklist

- Real chain everywhere
- No cached fakes
- Fresh-wallet round-trip
- Concurrent tx nonce
- Gas estimation real
- Rate-limit handling
- Receipt schema strict
- Canonical hash deterministic
- Subscription time-warp test
- Memory TTL expiry
- Burn-mode key destroyed
- Independent re-verify works
- Indexer cursor resume

---

## 19. Cross-surface integrity (the moat)

- CLI grant → Studio updates
- Studio revoke → CLI sees
- Within five seconds
- Both directions verified
- Same chain, same ABI

---

## 20. Performance checklist [TIER 2 — AGGRESSIVE]

> Skip this entire section until §0–§19 are 100% green.

- Cold start time CLI
- Studio time-to-interactive
- Receipt page TTFB
- Indexer query p95
- Backfill rows-per-second
- Memory recall latency
- 100 receipts page
- 10000 receipts scroll

---

## 21. Operational checklist [TIER 2 — AGGRESSIVE]

- gitignore covers everything
- License files present
- Lock file committed
- Pre-commit hook runs
- CI matrix passes
- Backup `.ivaronix/` usable
- Cross-OS path handling
- File watcher cleanup

---

## 22. Polish checklist [TIER 2 — AGGRESSIVE]

- No browser console errors
- No deprecation warnings
- No layout shift (CLS)
- 60fps animations
- Hover lift exact 2px
- Cream `#fafaf7` exact
- Ink `#0a0a0a` exact
- Green tittle `#16a34a`

---

## 23. Main mission (the standard the engineer enforces)

- End-to-end trust loop
- Premium visual polish
- Real chain proof
- Real wallet flow
- Real error handling
- No fake states

---

— locked 2026-05-08
