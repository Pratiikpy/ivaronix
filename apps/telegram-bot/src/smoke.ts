/**
 * Smoke test: build the bot wiring with a fake token and ensure no constructor
 * crashes (DB open, ethers provider, IndexerDb path, command registration).
 * Does NOT contact Telegram or any RPC — pure local wiring check.
 *
 * Run: IVARONIX_TG_TEST=1 pnpm --filter @ivaronix/telegram-bot exec tsx src/smoke.ts
 */
import { buildBot } from './index.js';

async function main(): Promise<void> {
  process.env.IVARONIX_TG_TEST = '1';
  const fakeCfg = {
    token: '0:fake-token-not-used',
    network: 'testnet' as const,
    cliEntry: 'apps/cli/src/bin/ivaronix.ts',
    studioBase: 'http://localhost:3300',
  };
  const bot = await buildBot(fakeCfg);
  // grammy stores commands on the bot instance via the bot.api proxy. The
  // public surface we want to confirm: the bot was constructed, and we
  // registered exactly seven command handlers (start + 6 functional commands).
  // We can read them via bot.handlers (private) only by side-effect — instead,
  // assert the bot is non-null and that the underlying Bot ctor accepted us.
  if (!bot) {
    throw new Error('buildBot returned null');
  }
  // eslint-disable-next-line no-console
  console.log('SMOKE OK · bot wired · commands registered without errors');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('SMOKE FAIL:', err);
  process.exit(1);
});
