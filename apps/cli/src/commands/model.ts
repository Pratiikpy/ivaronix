import { Command } from 'commander';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, statSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import { sha256HexAsync, RECEIPT_TYPES, type Hash, type ReceiptType } from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { ReceiptRegistryClient, AgentPassportClient, getDeployedAddress } from '@ivaronix/og-chain';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix model …` — TEE-secured fine-tuning on the 0G Compute network.
 *
 * Wraps `0g-compute-cli` (`@0glabs/0g-serving-broker`) which is the canonical
 * 0G fine-tuning entrypoint. Each subcommand spawns the CLI with the right
 * flags + parses the output. We anchor a receipt for `fine-tune` submissions
 * so the LoRA adapter you train against has an on-chain provenance trail.
 *
 * Workflow (per `oglabs resources/fine-tuning-example/README.md`):
 *   list-providers            see TEE GPU providers
 *   deposit <og>              add OG to the 0G ledger (escrow)
 *   fund <provider> <og>      transfer from ledger to provider's
 *                             fine-tuning sub-account (per-service escrow)
 *   fine-tune <dataset>       create training task → returns Task ID
 *   task <id>                 poll task state
 *   download <id> <out>       fetch the LoRA adapter when done
 *
 * Mainnet status: 0G fine-tuning is testnet-only at the moment (see the
 * 0G docs). Mainnet promotion arrives when 0G enables it.
 */

const execFileAsync = promisify(execFile);

const IS_WIN = process.platform === 'win32';

function resolveCli(): { cmd: string; argPrefix: string[] } {
  for (const candidate of IS_WIN ? ['0g-compute-cli.cmd', '0g-compute-cli'] : ['0g-compute-cli']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'pipe', shell: IS_WIN });
      return { cmd: candidate, argPrefix: [] };
    } catch { /* keep looking */ }
  }
  return {
    cmd: IS_WIN ? 'npx.cmd' : 'npx',
    argPrefix: ['-y', '--package=@0gfoundation/0g-compute-ts-sdk', '--', '0g-compute-cli'],
  };
}

async function runCli(args: string[], opts: { timeoutMs?: number; pipeStdio?: boolean } = {}): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const { cmd, argPrefix } = resolveCli();
  const argv = [...argPrefix, ...args];
  try {
    const { stdout, stderr } = await execFileAsync(cmd, argv, {
      timeout: opts.timeoutMs ?? 90_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      env: process.env,
      shell: IS_WIN,
    });
    if (opts.pipeStdio) {
      process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    }
    return { ok: true, stdout, stderr };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message: string };
    return { ok: false, stdout: e.stdout ?? '', stderr: (e.stderr ?? '') + '\n' + e.message };
  }
}

export const modelCommand = new Command('model')
  .description('TEE-secured fine-tuning on the 0G Compute network');

modelCommand
  .command('list-providers')
  .description('List TEE GPU providers offering fine-tuning service')
  .option('--verbose', 'print full stderr from 0g-compute-cli on failure')
  .action(async (opts: { verbose?: boolean }) => {
    ui.title('0G fine-tuning · providers');
    ui.divider();
    const r = await runCli(['fine-tuning', 'list-providers'], { pipeStdio: true });
    if (!r.ok) {
      const lines = (r.stderr || r.stdout).split('\n').filter((l) => l.trim().length);
      ui.fail('list-providers failed', lines.slice(0, opts.verbose ? 40 : 6).join('\n'));
      ui.hint('Preflight: `ivaronix model preflight` checks setup-network + login.');
      ui.hint('Install   : npm install -g @0gfoundation/0g-compute-ts-sdk');
      ui.hint('Setup     : 0g-compute-cli setup-network && 0g-compute-cli login');
      process.exitCode = 1;
    }
  });

modelCommand
  .command('preflight')
  .description('Verify 0g-compute-cli is installed + logged in (no network calls)')
  .action(async () => {
    ui.title('0G compute · preflight');
    ui.divider();
    const help = await runCli(['--version']);
    if (!help.ok) {
      ui.fail('0g-compute-cli not reachable', help.stderr.split('\n').slice(0, 4).join('\n'));
      ui.hint('Install: npm install -g @0gfoundation/0g-compute-ts-sdk');
      process.exitCode = 1;
      return;
    }
    ui.pass(`binary               v${help.stdout.trim()}`);

    const status = await runCli(['status']);
    if (!status.ok) {
      ui.fail('login status check failed', status.stderr.split('\n').slice(0, 4).join('\n'));
      process.exitCode = 1;
      return;
    }
    const loggedIn = /logged in/i.test(status.stdout);
    if (loggedIn) ui.pass(`login                ${status.stdout.trim().split('\n')[0]}`);
    else {
      ui.fail('not logged in', 'run `0g-compute-cli login` to set your private key');
      process.exitCode = 1;
      return;
    }

    const network = await runCli(['show-network']);
    if (network.ok) ui.pass(`network              ${network.stdout.trim().split('\n')[0]}`);
    ui.divider();
    ui.pass('preflight ok — `ivaronix model list-providers` should work.');
  });

modelCommand
  .command('deposit <amountOg>')
  .description('Deposit OG from your wallet into the 0G ledger (escrow)')
  .action(async (amount: string) => {
    ui.title(`0G ledger · deposit ${amount} OG`);
    const r = await runCli(['deposit', '--amount', amount], { pipeStdio: true, timeoutMs: 180_000 });
    if (!r.ok) { ui.fail('deposit failed', r.stderr.split('\n')[0] ?? ''); process.exitCode = 1; }
  });

modelCommand
  .command('fund <provider> <amountOg>')
  .description('Transfer OG from the ledger to a provider\'s fine-tuning sub-account')
  .action(async (provider: string, amount: string) => {
    ui.title(`0G fine-tuning · fund ${provider} with ${amount} OG`);
    const r = await runCli(
      ['transfer-fund', '--provider', provider, '--amount', amount, '--service', 'fine-tuning'],
      { pipeStdio: true, timeoutMs: 180_000 },
    );
    if (!r.ok) { ui.fail('fund failed', r.stderr.split('\n')[0] ?? ''); process.exitCode = 1; }
  });

modelCommand
  .command('fine-tune <dataset>')
  .description('Submit a fine-tuning task. Anchors an on-chain receipt referencing the task id + dataset hash.')
  .requiredOption('--provider <addr>', 'TEE GPU provider address (from `model list-providers`)')
  .requiredOption('--model <id>', 'base model id, e.g. Qwen2.5-0.5B-Instruct')
  .option('--config <path>', 'training config JSON path', './config/training_config.json')
  .option('--no-receipt', 'skip on-chain receipt for the submission')
  .option('--out-dir <dir>', 'where to write the receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (datasetPath: string, opts: { provider: string; model: string; config: string; receipt: boolean; outDir: string }) => {
    const env = loadEnv();
    const dsAbs = resolve(process.cwd(), datasetPath);
    if (!existsSync(dsAbs)) {
      ui.fail(`dataset not found at ${datasetPath}`);
      process.exitCode = 1;
      return;
    }
    const stat = statSync(dsAbs);

    ui.title(`0G fine-tune · submit`);
    ui.info(`provider             ${opts.provider}`);
    ui.info(`model                ${opts.model}`);
    ui.info(`dataset              ${datasetPath} (${stat.size.toLocaleString()} bytes)`);
    ui.divider();

    const datasetBytes = readFileSync(dsAbs);
    const datasetHash = await sha256HexAsync(datasetBytes);
    ui.info(`dataset sha256       ${datasetHash}`);

    ui.pending('submitting task to 0G Compute (this may take ~1 min) ...');
    const r = await runCli(
      [
        'fine-tuning', 'create-task',
        '--provider', opts.provider,
        '--model', opts.model,
        '--dataset-path', dsAbs,
        '--config-path', resolve(process.cwd(), opts.config),
      ],
      { pipeStdio: true, timeoutMs: 5 * 60_000 },
    );
    if (!r.ok) {
      ui.fail('create-task failed', (r.stderr || r.stdout).split('\n').slice(0, 3).join('\n'));
      process.exitCode = 1;
      return;
    }
    const taskMatch = r.stdout.match(/Task ID:\s*([0-9a-f-]+)/i);
    const taskId = taskMatch?.[1] ?? null;
    if (!taskId) {
      ui.fail('could not parse Task ID from CLI output');
      process.exitCode = 1;
      return;
    }
    ui.pass(`task id              ${taskId}`);

    if (opts.receipt && env.privateKey) {
      const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
      const wallet = new Wallet(env.privateKey, provider);
      const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
      if (registryAddr) {
        const receiptRegistry = new ReceiptRegistryClient(registryAddr, wallet);
        const receiptType: ReceiptType = 'skill_exec';
        const draft = buildReceipt({
          type: receiptType,
          agent: { passportId: `did:0g:passport:${wallet.address}:1`, ownerWallet: wallet.address as `0x${string}`, trustScoreAtTime: 0 },
          request: {
            skillId: 'model.fine-tune',
            skillVersion: '0.1.0',
            skillManifestHash: datasetHash as Hash,
            userPromptHash: await sha256HexAsync(`fine-tune ${opts.model} ${opts.provider}`),
            inputArtifacts: [{ kind: 'doc', encrypted: false }],
            policyDecision: 'approved',
            approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
          },
          execution: {
            mode: 'skill_exec',
            burnMode: false,
            consensusMode: false,
            modelSelection: { requested: opts.model, final: opts.model },
            providerRouting: { allowFallbacks: false, finalProvider: opts.provider as `0x${string}` },
          },
          routerTrace: { requestId: `fine-tune-${taskId}`, x0gTrace: { taskId }, rateLimit: {}, rotations: [] },
          teeVerification: { requested: true, routerVerified: false, independentVerified: null, providerAddress: opts.provider as `0x${string}`, verificationMethod: 'compute_sdk_process_response', verifiedAt: null, tier: 'tier-1-tee', providerKind: '0g-router' },
          billing: { inputTokens: 0, outputTokens: 0, inputCostNeuron: '0', outputCostNeuron: '0', totalCostNeuron: '0', totalCostOg: '0' },
          storage: { proofDownloadVerified: false, encryption: { enabled: false, type: 'none', headerDetected: false } },
          chainAnchor: defaultChainAnchor(env.network, registryAddr),
          outputs: { outputHash: datasetHash as Hash, citations: [], riskLevel: 'low', wording: { headline: `Fine-tune submitted: ${opts.model} on ${stat.size}-byte dataset (task ${taskId.slice(0, 8)}...)`, doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'] } },
          createdBy: 'ivaronix-cli/0.0.1',
        });
        const signed = await signReceipt(draft, wallet);
        mkdirSync(resolve(process.cwd(), opts.outDir), { recursive: true });
        const path = resolve(process.cwd(), opts.outDir, `${signed.id}.json`);
        writeFileSync(path, JSON.stringify(signed, null, 2));
        const tx = await receiptRegistry.anchor(
          signed.storage.receiptRoot as Hash,
          ('0x' + datasetHash.replace(/^sha256:/, '')) as Hash,
          RECEIPT_TYPES[receiptType],
          ('0x' + '0'.repeat(64)) as Hash,
        );
        const txReceipt = await tx.wait();
        ui.pass(`receipt              ${signed.id}  tx=${tx.hash}  block=${txReceipt?.blockNumber}`);

        // Best-effort passport update
        try {
          const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
          if (passportAddr) {
            const passport = new AgentPassportClient(passportAddr, wallet);
            const tokenId = await passport.passportOf(wallet.address as `0x${string}`);
            if (tokenId !== 0n) {
              const ptx = await passport.recordReceipt(tokenId, signed.storage.receiptRoot as Hash, RECEIPT_TYPES[receiptType], 1);
              await ptx.wait();
            }
          }
        } catch { /* opportunistic */ }
      }
    }

    ui.divider();
    ui.banner(true, '→ FINE-TUNE SUBMITTED ✓');
    ui.hint(`Poll: ivaronix model task ${taskId}`);
    ui.hint(`Download adapter when done: ivaronix model download ${taskId} ./adapters/`);
  });

modelCommand
  .command('task <id>')
  .description('Get the status of a fine-tuning task')
  .option('--provider <addr>', 'provider address')
  .action(async (id: string, opts: { provider?: string }) => {
    ui.title(`0G fine-tune · task ${id}`);
    const r = await runCli(['fine-tuning', 'get-task', '--task-id', id, ...(opts.provider ? ['--provider', opts.provider] : [])], { pipeStdio: true });
    if (!r.ok) { ui.fail('get-task failed', r.stderr.split('\n')[0] ?? ''); process.exitCode = 1; }
  });

modelCommand
  .command('download <taskId> <outDir>')
  .description('Download the LoRA adapter for a completed task')
  .option('--provider <addr>', 'provider address')
  .action(async (taskId: string, outDir: string, opts: { provider?: string }) => {
    ui.title(`0G fine-tune · download ${taskId}`);
    mkdirSync(resolve(process.cwd(), outDir), { recursive: true });
    const r = await runCli(
      ['fine-tuning', 'download-model', '--task-id', taskId, '--output-dir', resolve(process.cwd(), outDir), ...(opts.provider ? ['--provider', opts.provider] : [])],
      { pipeStdio: true, timeoutMs: 5 * 60_000 },
    );
    if (!r.ok) { ui.fail('download failed', r.stderr.split('\n')[0] ?? ''); process.exitCode = 1; }
  });
