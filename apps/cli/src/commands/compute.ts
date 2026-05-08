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
  .description('Show 0G Compute ledger balance for the configured wallet')
  .action(async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const IS_WIN = process.platform === 'win32';
    ui.title('0G Compute · ledger balance');
    ui.divider();
    try {
      const argv = ['-y', '--package=@0gfoundation/0g-compute-ts-sdk', '--', '0g-compute-cli', 'get-account'];
      const { stdout } = await execFileAsync(IS_WIN ? 'npx.cmd' : 'npx', argv, {
        timeout: 90_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, shell: IS_WIN,
      });
      // Parse the SDK's text output for the balance line.
      const balanceLine = stdout.split('\n').find((l) => /balance/i.test(l));
      if (balanceLine) ui.pass(balanceLine.trim());
      else process.stdout.write(stdout);
    } catch (err) {
      ui.fail('balance lookup failed', (err as Error).message.split('\n')[0]);
      ui.hint('Did you run `0g-compute-cli setup-network && 0g-compute-cli login` first?');
      process.exitCode = 1;
    }
  });

computeCommand
  .command('verify-tee <receipt-id-or-path>')
  .description('Independently verify TEE attestation (alias for `ivaronix receipt verify <file> --tee-independent`)')
  .action((id: string) => {
    ui.title('compute verify-tee → forwarding to receipt verify');
    ui.divider();
    ui.hint(`Run: ivaronix receipt verify ${id} --tee-independent`);
    ui.hint('The verify command auto-resolves on-chain ids, ULIDs, and file paths.');
  });
