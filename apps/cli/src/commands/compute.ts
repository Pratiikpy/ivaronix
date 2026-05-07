import { Command } from 'commander';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { ui } from '../lib/ui.js';

export const computeCommand = new Command('compute')
  .description('Manage 0G Compute keys, balances, and inference');

computeCommand
  .command('test')
  .description('Send a test prompt to verify the Router is reachable + key works')
  .option('--prompt <text>', 'prompt to send', 'Hello, frontier.')
  .option('--model <model>', 'model id', 'qwen/qwen-2.5-7b-instruct')
  .action(async (opts: { prompt: string; model: string }) => {
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('No router key configured', 'Set ZG_API_SECRET, ZG_SERVICE_URL, OG_COMPUTE_PROVIDER, EVM_WALLET_ADDRESS in .env');
      process.exitCode = 1;
      return;
    }

    ui.title('Compute test');
    ui.hint(`prompt: ${opts.prompt}`);
    ui.hint(`model:  ${opts.model}`);
    ui.divider();

    try {
      const result = await keyring.chat({
        userPrompt: opts.prompt,
        model: opts.model,
      });
      ui.pass(`response (${result.outputTokens ?? '?'} tokens):`);
      console.log('\n' + result.content + '\n');
      if (result.providerAddress) ui.info(`provider: ${result.providerAddress}`);
      if (result.routerVerified) ui.pass('Router-flag TEE verified');
    } catch (err) {
      ui.fail('Router call failed', (err as Error).message);
      process.exitCode = 1;
    }
  });

computeCommand
  .command('balance')
  .description('Show Router balance via 0g-compute-cli')
  .action(() => {
    ui.hint('Run `0g-compute-cli get-account` directly for now. Programmatic balance polling arrives Day 5.');
  });

computeCommand
  .command('verify-tee <receipt-id>')
  .description('Independently verify TEE attestation for a receipt')
  .action(() => {
    ui.hint('Independent TEE verify arrives Phase A Day 5 (broker.inference.processResponse).');
  });
