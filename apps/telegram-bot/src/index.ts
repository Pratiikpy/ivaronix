/**
 * Ivaronix Telegram thin client (PASS 76 S-3).
 *
 * Six commands map onto existing CLI / chain surfaces:
 *
 *   /help                        list commands
 *   /run <prompt>                short skill_exec via the local `ivaronix` CLI
 *   /skill <id> [args]           run a registered skill via the CLI
 *   /audit <repo-path>           ivaronix audit --quick
 *   /passport [0xaddr]           on-chain AgentPassportINFT.passportOf()
 *   /receipt <id>                indexer DB lookup, prints summary + Studio URL
 *   /connect <0xaddress>         bind this Telegram chat to a wallet (no custodial keys)
 *
 * No custodial wallets — users bring their own MetaMask. /connect just
 * stores chat-id ↔ public-address mapping in a small SQLite file alongside
 * the indexer's DB, so commands that need a default address (/passport,
 * /receipt rendering) can default to the connected wallet.
 *
 * Boot path:
 *   pnpm --filter @ivaronix/telegram-bot dev
 *   (TELEGRAM_BOT_TOKEN must be set in the workspace .env)
 */

import 'dotenv/config';
import { Bot } from 'grammy';
import { JsonRpcProvider, Contract } from 'ethers';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { IndexerDb } from '@ivaronix/indexer';
import { NETWORKS, type Address, type Network } from '@ivaronix/core';

const IS_WIN = process.platform === 'win32';

interface Config {
  token: string;
  network: Network;
  registryAddress?: Address;
  passportAddress?: Address;
  cliEntry: string; // path to apps/cli/src/bin/ivaronix.ts (resolved)
  studioBase: string;
}

function loadConfig(): Config {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN missing. Get one from @BotFather and set it in .env.');
  }
  const network = ((process.env.IVARONIX_NETWORK ?? process.env.OG_NETWORK) as Network) ?? 'testnet';
  const cliEntry = resolveCliEntry();
  return {
    token,
    network,
    cliEntry,
    studioBase: process.env.STUDIO_BASE ?? 'http://localhost:3300',
  };
}

function resolveCliEntry(): string {
  // Walk up to find apps/cli/.
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, 'apps', 'cli', 'src', 'bin', 'ivaronix.ts');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), 'apps', 'cli', 'src', 'bin', 'ivaronix.ts');
}

/** Workspace-root anchored DB path so we share the indexer's directory. */
function anchorDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'telegram');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.ivaronix', 'telegram');
}

class ChatBindings {
  private db: Database.Database;
  constructor() {
    const dir = anchorDbDir();
    mkdirSync(dir, { recursive: true });
    this.db = new Database(resolve(dir, 'bindings.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_wallet (
        chat_id INTEGER PRIMARY KEY,
        wallet TEXT NOT NULL,
        connected_at INTEGER NOT NULL
      );
    `);
  }
  get(chatId: number): Address | null {
    const row = this.db.prepare('SELECT wallet FROM chat_wallet WHERE chat_id = ?').get(chatId) as
      | { wallet: string }
      | undefined;
    return (row?.wallet as Address | undefined) ?? null;
  }
  set(chatId: number, wallet: Address): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO chat_wallet (chat_id, wallet, connected_at) VALUES (?, ?, ?)',
      )
      .run(chatId, wallet.toLowerCase(), Math.floor(Date.now() / 1000));
  }
}

/** Run an `ivaronix` CLI command via spawn (no shell). Captures stdout+stderr, time-boxed. */
function runIvaronix(cliEntry: string, args: string[], timeoutMs = 60_000): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  const cmd = IS_WIN ? 'pnpm.cmd' : 'pnpm';
  const argv = ['exec', 'tsx', cliEntry, ...args];
  return new Promise((res) => {
    const child = spawn(cmd, argv, {
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const finish = (ok: boolean): void => {
      if (finished) return;
      finished = true;
      res({ stdout, stderr, ok });
    };
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      stderr += `\n[spawn-error] ${err.message}`;
      finish(false);
    });
    child.on('close', (code) => finish(code === 0));
    setTimeout(() => {
      if (finished) return;
      stderr += `\n[timeout] killed after ${timeoutMs}ms`;
      child.kill('SIGKILL');
      finish(false);
    }, timeoutMs);
  });
}

/** Strip ANSI color codes for Telegram rendering. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Truncate a long string to fit Telegram's 4096-char message limit, preserving the tail. */
function tail(s: string, max = 3500): string {
  const stripped = stripAnsi(s);
  if (stripped.length <= max) return stripped;
  return `… (truncated)\n${stripped.slice(-max)}`;
}

/** Validate a 0x-prefixed 40-hex EVM address. */
function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

const PASSPORT_ABI = [
  'function passportOf(address wallet) external view returns (uint256 tokenId, string memory profileURI, uint64 mintedAt, int64 trustScore)',
] as const;

async function buildBot(cfg: Config): Promise<Bot> {
  const bindings = new ChatBindings();
  const indexer = new IndexerDb(resolve(anchorDbDir(), '..', 'indexer', 'receipts.db'));
  const provider = new JsonRpcProvider(NETWORKS[cfg.network].rpcUrl, {
    chainId: NETWORKS[cfg.network].chainId,
    name: cfg.network,
  });

  const bot = new Bot(cfg.token);

  bot.command('start', async (ctx) => {
    await ctx.reply(
      [
        '*Ivaronix · 0G Agent OS*',
        'Catch the risks. Keep the receipts.',
        '',
        'Commands:',
        '/help — full list',
        '/connect 0x… — bind this chat to your wallet (read-only)',
        '/run <prompt> — quick run via the local CLI',
        '/skill <id> [args] — run a registered skill',
        '/audit <repo-path> — quick repo audit',
        '/passport [0x…] — show on-chain passport',
        '/receipt <id> — show indexed receipt',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        '*Ivaronix Telegram*',
        '',
        '*Identity*',
        '  /connect 0x… — bind chat ↔ wallet (no custodial keys)',
        '  /passport [0x…] — read AgentPassport on-chain',
        '',
        '*Run things*',
        '  /run <prompt> — quick doc-ask style run via CLI',
        '  /skill <id> [args] — run a registered skill',
        '  /audit <repo-path> — `ivaronix audit --quick`',
        '',
        '*Receipts*',
        '  /receipt <id> — print indexed receipt + Studio URL',
        '',
        'No keys are stored. CLI runs locally on the bot host.',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.command('connect', async (ctx) => {
    const arg = (ctx.match ?? '').trim();
    if (!isAddress(arg)) {
      await ctx.reply('Usage: /connect 0xYourWallet — must be a 0x-prefixed 40-hex EVM address.');
      return;
    }
    bindings.set(ctx.chat.id, arg as Address);
    await ctx.reply(`Connected. This chat is now bound to ${arg.toLowerCase()}.\nNo private keys stored — read-only binding.`);
  });

  bot.command('passport', async (ctx) => {
    if (!cfg.passportAddress) {
      const { getDeployedAddress } = await import('@ivaronix/og-chain');
      const a = getDeployedAddress(cfg.network, 'AgentPassportINFT');
      if (a) cfg.passportAddress = a as Address;
    }
    if (!cfg.passportAddress) {
      await ctx.reply('AgentPassport address unavailable for this network.');
      return;
    }
    const arg = (ctx.match ?? '').trim();
    const wallet = (arg && isAddress(arg) ? arg : bindings.get(ctx.chat.id)) as Address | null;
    if (!wallet) {
      await ctx.reply('No wallet. /connect 0x… first or pass an address: /passport 0x…');
      return;
    }
    try {
      const c = new Contract(cfg.passportAddress, PASSPORT_ABI, provider);
      const out = (await c.passportOf!(wallet)) as readonly [bigint, string, bigint, bigint];
      const tokenId = out[0];
      if (tokenId === 0n) {
        await ctx.reply(`No passport found for ${wallet}. Mint via: ivaronix passport mint`);
        return;
      }
      await ctx.reply(
        [
          '*AgentPassport*',
          `wallet: ${wallet}`,
          `tokenId: ${tokenId}`,
          `profileURI: ${out[1]}`,
          `mintedAt: ${new Date(Number(out[2]) * 1000).toISOString()}`,
          `trustScore: ${out[3]}`,
        ].join('\n'),
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      await ctx.reply(`Passport lookup failed: ${(err as Error).message}`);
    }
  });

  bot.command('receipt', async (ctx) => {
    const arg = (ctx.match ?? '').trim();
    const id = Number(arg);
    if (!Number.isFinite(id) || id < 0) {
      await ctx.reply('Usage: /receipt <id>  — e.g. /receipt 280');
      return;
    }
    const r = indexer.getReceipt(id);
    if (!r) {
      await ctx.reply(
        `Receipt #${id} not in local index. Run \`ivaronix indexer backfill\` to ingest, or check it directly: ${cfg.studioBase}/r/${id}`,
      );
      return;
    }
    await ctx.reply(
      [
        `*Receipt #${r.id}*`,
        `type: ${r.receiptType}`,
        `agent: ${r.agent}`,
        `block: ${r.blockNumber}`,
        `timestamp: ${new Date(r.blockTimestamp * 1000).toISOString()}`,
        `tx: ${r.txHash}`,
        '',
        `Studio: ${cfg.studioBase}/r/${r.id}`,
        `Explorer: ${NETWORKS[cfg.network].chainExplorer}/tx/${r.txHash}`,
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.command('run', async (ctx) => {
    const prompt = (ctx.match ?? '').trim();
    if (!prompt) {
      await ctx.reply('Usage: /run <prompt> — e.g. /run summarize this readme');
      return;
    }
    await ctx.reply('Running…');
    const r = await runIvaronix(cfg.cliEntry, ['demo', '--tier', 'quick', '--prompt', prompt], 90_000);
    await ctx.reply(`*Output:*\n\`\`\`\n${tail(r.stdout || r.stderr || '(no output)')}\n\`\`\``, {
      parse_mode: 'Markdown',
    });
  });

  bot.command('skill', async (ctx) => {
    const args = (ctx.match ?? '').trim();
    if (!args) {
      await ctx.reply('Usage: /skill <id> [args]  — e.g. /skill private-doc-review file.pdf "find risks"');
      return;
    }
    const parts = args.split(' ');
    const skillId = parts[0];
    const rest = parts.slice(1);
    if (!skillId) {
      await ctx.reply('Skill id missing.');
      return;
    }
    await ctx.reply(`Running skill ${skillId}…`);
    const r = await runIvaronix(cfg.cliEntry, ['skill', 'inspect', skillId, ...rest], 60_000);
    await ctx.reply(`\`\`\`\n${tail(r.stdout || r.stderr || '(no output)')}\n\`\`\``, {
      parse_mode: 'Markdown',
    });
  });

  bot.command('audit', async (ctx) => {
    const path = (ctx.match ?? '').trim();
    if (!path) {
      await ctx.reply('Usage: /audit <repo-path>  — e.g. /audit ../my-project');
      return;
    }
    await ctx.reply('Running quick audit…');
    const r = await runIvaronix(cfg.cliEntry, ['audit', path, '--quick'], 180_000);
    await ctx.reply(`\`\`\`\n${tail(r.stdout || r.stderr || '(no output)')}\n\`\`\``, {
      parse_mode: 'Markdown',
    });
  });

  bot.on('message:text', async (ctx) => {
    if ((ctx.message.text ?? '').startsWith('/')) return;
    await ctx.reply('Type /help for commands.');
  });

  return bot;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  // eslint-disable-next-line no-console
  console.log(`[ivaronix-telegram] booting · network=${cfg.network} · cli=${cfg.cliEntry}`);
  const bot = await buildBot(cfg);
  // eslint-disable-next-line no-console
  bot.catch((err) => console.error('[grammy]', err));
  await bot.start({
    onStart: (info) => {
      // eslint-disable-next-line no-console
      console.log(`[ivaronix-telegram] online as @${info.username}`);
    },
  });
}

// `IVARONIX_TG_TEST=1` short-circuits the boot for harness use — verify
// imports + builders work without launching grammy long-poll. Any other
// invocation runs the bot.
if (process.env.IVARONIX_TG_TEST !== '1') {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[ivaronix-telegram] fatal:', err);
    process.exit(1);
  });
}

export { buildBot, loadConfig };
