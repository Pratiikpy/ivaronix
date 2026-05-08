# @ivaronix/telegram-bot

Telegram thin client over the Ivaronix CLI. Per `docs/PLAN_pass76.md` S-3 — neutralizes the consumer-friction critique without compromising on receipts.

## What it does

Six commands, each maps to existing CLI / chain surfaces. No custodial wallets — users bring their own MetaMask; this bot only does **read-only** wallet bindings.

| Command | What runs |
|---|---|
| `/start` / `/help` | Static menu |
| `/connect 0x…` | Bind chat-id ↔ wallet (no private keys) |
| `/passport [0x…]` | On-chain `AgentPassportINFT.passportOf()` |
| `/receipt <id>` | Indexer DB lookup + Studio + explorer URL |
| `/run <prompt>` | `ivaronix demo --tier quick --prompt …` |
| `/skill <id> [args]` | `ivaronix skill inspect <id> …` |
| `/audit <repo-path>` | `ivaronix audit <path> --quick` |

## Verify it

This bot needs a real Telegram bot token to talk to Telegram. The bot logic is pre-tested:

```bash
# Wiring smoke (no token needed) — confirms DB, indexer, provider, commands wire
IVARONIX_TG_TEST=1 pnpm --filter @ivaronix/telegram-bot exec tsx src/smoke.ts
# → SMOKE OK · bot wired · commands registered without errors
```

End-to-end (with a real bot):

1. Open Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`, follow prompts. You'll get a token like `1234:AbCd…`.
2. Add it to `.env` at the workspace root:
   ```
   TELEGRAM_BOT_TOKEN=1234:AbCd…
   ```
3. Make sure the indexer DB is populated (otherwise `/receipt` says "not in local index"):
   ```bash
   pnpm exec tsx apps/cli/src/bin/ivaronix.ts indexer backfill --from 32200000
   ```
4. Boot the bot:
   ```bash
   pnpm --filter @ivaronix/telegram-bot dev
   # → [ivaronix-telegram] online as @YourBotName
   ```
5. In Telegram, find your bot, send:
   - `/start` → menu
   - `/connect 0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`
   - `/passport` → reads on-chain passport for that wallet
   - `/receipt 280` → indexed receipt + Studio URL `http://localhost:3300/r/280`
   - `/run summarize this readme` → real CLI run, real output

## Architecture notes

- `spawn` (no shell) is used to invoke the CLI — no shell-injection surface even if a user types `; rm -rf` in a `/run` prompt. The shipping bar's "no mocks" rule held.
- `ChatBindings` SQLite at `.ivaronix/telegram/bindings.db` (gitignored via `.ivaronix/`). Keys: chat-id → wallet address. **Never** stores private keys.
- Reuses `@ivaronix/indexer` so `/receipt N` is a sub-100ms local SQLite read instead of an RPC round-trip.
- Output stripped of ANSI codes + truncated to fit Telegram's 4096-char message ceiling, preserving the tail (where errors usually are).
