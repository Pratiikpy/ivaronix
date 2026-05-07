import { Command } from 'commander';
import { createChainClient } from '@ivaronix/og-chain';
import { createStorageClient } from '@ivaronix/og-storage';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import { STALE_CHAIN_IDS } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

export const doctorCommand = new Command('doctor')
  .description('Health check: network, router, storage, chain, daemon')
  .option('--network', 'check network only')
  .option('--router', 'check router only')
  .option('--storage', 'check storage only')
  .option('--chain', 'check chain contracts only')
  .option('--metrics', 'show live metrics from chain')
  .action(async (opts: { network?: boolean; router?: boolean; storage?: boolean; chain?: boolean; metrics?: boolean }) => {
    const env = loadEnv();
    const all = !opts.network && !opts.router && !opts.storage && !opts.chain && !opts.metrics;

    ui.title('Ivaronix · doctor');
    ui.divider();

    let allOk = true;

    // Network
    if (all || opts.network) {
      ui.section('01 · Network');
      try {
        const chain = createChainClient({ network: env.network });
        const result = await chain.verifyChainId();
        if (result.ok) {
          ui.pass(`network              ${env.network}`);
          ui.pass(`chainId              ${env.chainId}  (matches eth_chainId)`);
          ui.pass(`rpc                  ${env.rpcUrl}`);
        } else {
          ui.fail('chainId verify failed', result.reason);
          allOk = false;
        }
        if (STALE_CHAIN_IDS.has(env.chainId)) {
          ui.fail(`stale chainId ${env.chainId} in env — update to 16602 (testnet) or 16661 (mainnet)`);
          allOk = false;
        }
      } catch (err) {
        ui.fail('network check error', (err as Error).message);
        allOk = false;
      }
    }

    // Router
    if (all || opts.router) {
      ui.section('02 · Router');
      const keyring = keyringFromEnv();
      if (!keyring) {
        ui.pending('router               not configured (set ZG_API_SECRET, ZG_SERVICE_URL, OG_COMPUTE_PROVIDER, EVM_WALLET_ADDRESS)');
      } else {
        const list = keyring.list();
        for (const k of list) {
          ui.pass(`key:${k.label}             wallet ${k.wallet.slice(0, 10)}…  provider ${k.provider.slice(0, 10)}…`);
        }
        ui.info(`default model        ${env.defaultModel}`);
      }
    }

    // Storage
    if (all || opts.storage) {
      ui.section('03 · Storage');
      try {
        if (!env.privateKey) {
          ui.fail('storage              no private key in .env (set OG_PRIVATE_KEY or EVM_PRIVATE_KEY)');
          allOk = false;
        } else {
          const storage = createStorageClient({ network: env.network, privateKey: env.privateKey });
          const ping = await storage.ping();
          if (ping.ok) {
            ui.pass(`indexer              ${storage.indexerUrl}  (alive · HTTP ${ping.status})`);
          } else {
            ui.fail('indexer unreachable', ping.reason);
            allOk = false;
          }
        }
      } catch (err) {
        ui.fail('storage check error', (err as Error).message);
        allOk = false;
      }
    }

    // Chain (contracts not yet deployed in Day 1)
    if (all || opts.chain) {
      ui.section('04 · Chain (contracts)');
      ui.pending('ReceiptRegistry      not yet deployed (Phase A Day 3)');
      ui.pending('AgentPassportINFT    not yet deployed (Phase A Day 6)');
      ui.pending('CapabilityRegistry   not yet deployed (Phase A Day 7)');
      ui.pending('MemoryAccessLog      not yet deployed (Phase A Day 7)');
      ui.pending('SkillRegistry        not yet deployed (Phase A Day 10)');
      ui.pending('Erc7857Verifier      not yet deployed (Phase A Day 6)');
    }

    // Wallet balance (live read)
    if (all && env.walletAddress && env.privateKey) {
      ui.section('05 · Wallet');
      try {
        const chain = createChainClient({ network: env.network, privateKey: env.privateKey });
        const balance = await chain.getBalanceOg(env.walletAddress);
        ui.pass(`address              ${env.walletAddress}`);
        ui.pass(`balance              ${balance} OG`);
      } catch (err) {
        ui.fail('wallet balance error', (err as Error).message);
      }
    }

    ui.divider();
    ui.banner(allOk, allOk ? '✓ ALL SYSTEMS GO' : '✗ Issues detected (see above)');
  });
