import { Command } from 'commander';
import { createChainClient, ReceiptRegistryClient, loadDeployments } from '@ivaronix/og-chain';
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
  .option('--upload-probe', 'with --storage, do a real testnet upload to confirm B-1 unblocked')
  .option('--kv-local', 'check the local 0G KV node (started via `pnpm dev:kv`)')
  .action(async (opts: { network?: boolean; router?: boolean; storage?: boolean; chain?: boolean; metrics?: boolean; uploadProbe?: boolean; kvLocal?: boolean }) => {
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
        ui.pending('router               not configured (set IVARONIX_ROUTER_KEY, IVARONIX_ROUTER_URL, IVARONIX_ROUTER_PROVIDER, IVARONIX_WALLET_ADDRESS · legacy aliases ZG_API_SECRET, ZG_SERVICE_URL, OG_COMPUTE_PROVIDER, EVM_WALLET_ADDRESS still resolve)');
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
          ui.fail('storage              no private key in .env (set IVARONIX_SIGNER_KEY · legacy aliases OG_PRIVATE_KEY, EVM_PRIVATE_KEY still resolve)');
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
          if (opts.uploadProbe && ping.ok) {
            ui.pending('upload-probe         submitting 28-byte payload to 0G Storage ...');
            const start = Date.now();
            try {
              const payload = new TextEncoder().encode(`hello-ivaronix-${Date.now()}`);
              const r = await storage.upload(payload);
              const ms = Date.now() - start;
              ui.pass(`upload-probe         OK in ${ms.toLocaleString()} ms`);
              ui.pass(`rootHash             ${r.rootHash}`);
              ui.pass(`txHash               ${r.txHash}`);
            } catch (err) {
              ui.fail('upload-probe failed', (err as Error).message.split('\n')[0] ?? '');
              allOk = false;
            }
          }
        }
      } catch (err) {
        ui.fail('storage check error', (err as Error).message);
        allOk = false;
      }
    }

    // Chain
    if (all || opts.chain) {
      ui.section('04 · Chain (contracts)');
      const deployments = loadDeployments(env.network);
      // Iterate every contract in deployments.json directly. Auto-derives
      // from the canonical source so V2 deploys (and any future Vn)
      // surface here without hand-editing — same shape as
      // numbers-refresh.ts countDeployedContracts() (sweep 36) and the
      // README contracts:auto block (sweep 40).
      const contractNames = deployments
        ? Object.keys(deployments.contracts).sort()
        : [];
      if (contractNames.length === 0) {
        ui.pending('  no deployments file found · run forge script first');
      }
      for (const name of contractNames) {
        const dep = deployments!.contracts[name]!;
        const padName = name.padEnd(20);
        ui.pass(`${padName} ${dep.address}`);
        // Live read for receipt-anchor count: prefer V2 if deployed
        // (active anchor target post-sweep K-2), fall back to V1 for
        // legacy chains. V2 anchor count + V1 anchor count are
        // displayed separately so operators see the migration state.
        const isReceiptRegistry = name === 'ReceiptRegistry' || name === 'ReceiptRegistryV2';
        if (isReceiptRegistry && env.privateKey) {
          try {
            const chain = createChainClient({ network: env.network, privateKey: env.privateKey });
            const registry = new ReceiptRegistryClient(dep.address, chain.provider);
            const next = await registry.nextId();
            // nextId is 1-indexed; anchored count = nextId - 1.
            const anchored = next > 0n ? next - 1n : 0n;
            const tag = name === 'ReceiptRegistryV2' ? '(V2 active)' : '(V1 legacy)';
            ui.info(`${' '.repeat(20)}   ${anchored} receipts anchored ${tag}`);
          } catch {
            /* skip live read on error */
          }
        }
      }
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

    // Local KV node (PASS 76 S-1) — only when explicitly requested
    if (opts.kvLocal) {
      ui.section('06 · Local 0G KV node');
      const port = Number(process.env.IVARONIX_KV_PORT ?? 6789);
      const url = `http://127.0.0.1:${port}/`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'kv_getValue', params: ['0x', '0x'] }),
          signal: AbortSignal.timeout(3000),
        });
        if (res.status >= 200 && res.status < 600) {
          ui.pass(`url                  ${url}`);
          ui.pass(`http status          ${res.status}  (RPC alive)`);
        } else {
          ui.fail(`unexpected status    ${res.status}`);
          allOk = false;
        }
      } catch (err) {
        ui.fail('kv-local unreachable', (err as Error).message);
        ui.hint('Start it with: pnpm dev:kv');
        allOk = false;
      }
    }

    ui.divider();
    ui.banner(allOk, allOk ? '✓ ALL SYSTEMS GO' : '✗ Issues detected (see above)');
  });
