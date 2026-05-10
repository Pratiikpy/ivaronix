#!/usr/bin/env tsx
/**
 * Local 0G KV bootstrap (PASS 76 S-1).
 *
 * Cross-platform TS launcher that:
 *   1. Builds (or reuses) the Docker image at scripts/dev/Dockerfile.kv-node
 *   2. Renders the runtime config from .env (IVARONIX_WALLET_ADDRESS,
 *      IVARONIX_SIGNER_KEY, IVARONIX_NETWORK · legacy aliases
 *      EVM_WALLET_ADDRESS, EVM_PRIVATE_KEY, OG_NETWORK still resolve)
 *      into .ivaronix/kv-node/config.toml
 *   3. Runs the container with that config mounted, RPC bound to localhost:6789
 *   4. Polls until the node's HTTP RPC responds, then prints status
 *
 * Single command for macOS / Linux / Windows: `pnpm dev:kv`.
 *
 * Verify: `ivaronix doctor --kv-local` reports LIVE while this runs.
 *
 * Stop:   `pnpm dev:kv:stop`  (or `docker stop ivaronix-kv-node`).
 *
 * Real binary, real local node — no mocks. Same zgs_kv release the
 * OpenClaw_Hackathon entry uses; we just wrap it for cross-platform reach.
 */

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256, toUtf8Bytes, getAddress } from 'ethers';

const HERE = dirname(fileURLToPath(import.meta.url));
// scripts/dev/ → repo root is two up
const REPO_ROOT = resolve(HERE, '..', '..');

const IMAGE_TAG = 'ivaronix/zgs-kv:v1.5.1';
const CONTAINER_NAME = 'ivaronix-kv-node';
const RPC_PORT = Number(process.env.IVARONIX_KV_PORT ?? 6789);

const NETWORK_PROFILES = {
  testnet: {
    chainRpc: 'https://evmrpc-testnet.0g.ai',
    flowContract: '0x22e0ed5cf3F9D8aaB8D75F1996fB72a3FF73bbB7', // 0G Galileo testnet flow
    indexerUrl: 'https://indexer-storage-testnet-turbo.0g.ai',
    logSyncStartBlock: 0,
  },
  mainnet: {
    chainRpc: 'https://evmrpc.0g.ai',
    flowContract: '0x62d4144db0f0a6FbBaeb6296c785c71B3D57c526', // 0G Aristotle mainnet flow
    indexerUrl: 'https://indexer-storage-turbo.0g.ai',
    logSyncStartBlock: 0,
  },
} as const;

type Network = keyof typeof NETWORK_PROFILES;

function info(msg: string): void { process.stdout.write(`\x1b[2m●\x1b[0m ${msg}\n`); }
function ok(msg: string): void { process.stdout.write(`\x1b[32m●\x1b[0m ${msg}\n`); }
function warn(msg: string): void { process.stdout.write(`\x1b[33m●\x1b[0m ${msg}\n`); }
function fail(msg: string): never {
  process.stderr.write(`\x1b[31m●\x1b[0m ${msg}\n`);
  process.exit(1);
}

function run(cmd: string, args: string[], opts: { quiet?: boolean; timeoutMs?: number } = {}): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((res) => {
    const child = spawn(cmd, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
      if (!opts.quiet) process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
      if (!opts.quiet) process.stderr.write(d);
    });
    let timeout: NodeJS.Timeout | null = null;
    if (opts.timeoutMs) {
      timeout = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, opts.timeoutMs);
    }
    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      res({ ok: code === 0, stdout, stderr });
    });
  });
}

async function ensureDocker(): Promise<void> {
  const r = await run('docker', ['version', '--format', '{{.Server.Version}}'], { quiet: true });
  if (!r.ok) {
    fail('Docker daemon not reachable. Start Docker Desktop and re-run.');
  }
  info(`docker daemon: ${r.stdout.trim() || 'ok'}`);
}

async function imageExists(): Promise<boolean> {
  const r = await run('docker', ['image', 'inspect', IMAGE_TAG], { quiet: true });
  return r.ok;
}

async function buildImage(): Promise<void> {
  info('building image (one-time, ~2-3min on first run)...');
  const r = await run('docker', [
    'build',
    '-t', IMAGE_TAG,
    '-f', resolve(HERE, 'Dockerfile.kv-node'),
    HERE,
  ]);
  if (!r.ok) fail('docker build failed');
  ok(`built ${IMAGE_TAG}`);
}

async function stopExisting(): Promise<void> {
  // Stop any container with our canonical name. Idempotent.
  await run('docker', ['rm', '-f', CONTAINER_NAME], { quiet: true });
}

function memoryStreamId(addr: string): string {
  // Same primitive as packages/og-storage/src/streamId.ts (S-2). Inlined here
  // because this script runs before workspace deps may exist.
  const normalized = getAddress(addr).toLowerCase();
  return keccak256(toUtf8Bytes(`ivaronix:memory:v1:${normalized}`));
}

function renderConfig(network: Network, walletAddress: string): { configPath: string; runtimeDir: string; streamId: string } {
  const cfg = NETWORK_PROFILES[network];
  const streamId = memoryStreamId(walletAddress);
  const runtimeDir = resolve(REPO_ROOT, '.ivaronix', 'kv-node');
  mkdirSync(runtimeDir, { recursive: true });
  // Inside-container paths (config will reference these — they live under
  // /var/lib/zgs-kv inside the container, which we mount from runtimeDir).
  const config = `# Auto-generated by scripts/dev/start-local-0g-kv.ts — do not edit by hand.
# Wallet: ${walletAddress.toLowerCase()}
# Network: ${network}
# Stream ID: ${streamId}

stream_ids = ["${streamId}"]

db_dir = "/var/lib/zgs-kv/db"
kv_db_file = "/var/lib/zgs-kv/kv.DB"

blockchain_rpc_endpoint = "${cfg.chainRpc}"
log_contract_address = "${cfg.flowContract}"
log_sync_start_block_number = ${cfg.logSyncStartBlock}

rpc_enabled = true
rpc_listen_address = "0.0.0.0:6789"
indexer_url = "${cfg.indexerUrl}"
zgs_node_urls = ""

log_config_file = "/etc/zgs-kv/log_config"
`;
  const configPath = resolve(runtimeDir, 'config.toml');
  writeFileSync(configPath, config, { encoding: 'utf8' });
  writeFileSync(resolve(runtimeDir, 'log_config'), 'info\n', { encoding: 'utf8' });
  return { configPath, runtimeDir, streamId };
}

async function startContainer(runtimeDir: string): Promise<void> {
  await stopExisting();
  info('docker run...');
  // Mount runtimeDir → /var/lib/zgs-kv (so db + log persist between restarts).
  // Mount config.toml + log_config → /etc/zgs-kv/.
  const r = await run('docker', [
    'run', '-d',
    '--name', CONTAINER_NAME,
    '-p', `${RPC_PORT}:6789`,
    '-v', `${runtimeDir}:/var/lib/zgs-kv`,
    '-v', `${resolve(runtimeDir, 'config.toml')}:/etc/zgs-kv/config.toml:ro`,
    '-v', `${resolve(runtimeDir, 'log_config')}:/etc/zgs-kv/log_config:ro`,
    IMAGE_TAG,
  ], { quiet: true });
  if (!r.ok) fail(`docker run failed: ${r.stderr}`);
  ok(`container ${CONTAINER_NAME} started (id ${r.stdout.trim().slice(0, 12)})`);
}

async function pollRpc(timeoutMs: number): Promise<boolean> {
  const url = `http://127.0.0.1:${RPC_PORT}/`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Simple JSON-RPC ping; KV node responds even to unknown methods with
      // a JSON error payload, which is enough to confirm the port is alive.
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'kv_getValue', params: ['0x', '0x'] }),
      });
      if (res.status >= 200 && res.status < 600) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main(): Promise<void> {
  // Resolve via canonical → legacy alias chain.
  // canonical-alias-allow:forensic-comment · the lines below describe
  // the PRE-sweep-111 bug shape; legacy names are the historical
  // evidence, not drift.
  // Pre-sweep-111 read only EVM_WALLET_ADDRESS / OG_NETWORK;
  // canonical-only operators got null wallet and the script failed
  // with "EVM_WALLET_ADDRESS missing" even when IVARONIX_WALLET_ADDRESS
  // was set. Same correctness-bug class as sweeps 108-109's
  // amnesty-mining finds.
  const wallet = process.env.IVARONIX_WALLET_ADDRESS ?? process.env.EVM_WALLET_ADDRESS;
  const network = (process.env.IVARONIX_NETWORK ?? process.env.OG_NETWORK ?? 'testnet') as Network;
  if (!wallet) {
    fail('IVARONIX_WALLET_ADDRESS missing in .env. Add it — read-only, used to derive the stream-ID. Legacy alias EVM_WALLET_ADDRESS still resolves.');
  }
  if (!(network in NETWORK_PROFILES)) {
    fail(`Unknown network "${network}". Use testnet or mainnet.`);
  }
  process.stdout.write(`\x1b[1mLocal 0G KV node\x1b[0m\n`);
  info(`wallet               ${wallet}`);
  info(`network              ${network}`);
  info(`port                 ${RPC_PORT}`);

  await ensureDocker();
  if (!(await imageExists())) {
    await buildImage();
  } else {
    info(`image exists: ${IMAGE_TAG}`);
  }

  const { configPath, runtimeDir, streamId } = renderConfig(network, wallet);
  info(`config               ${configPath}`);
  info(`stream-ID            ${streamId}`);

  await startContainer(runtimeDir);
  info('waiting for RPC to come up (up to 60s)...');
  const live = await pollRpc(60_000);
  if (!live) {
    warn('RPC didn\'t respond within 60s. Container is running — check logs:');
    warn(`  docker logs ${CONTAINER_NAME}`);
    process.exitCode = 2;
    return;
  }
  ok(`RPC live at http://127.0.0.1:${RPC_PORT}`);
  process.stdout.write(`\nVerify:  ivaronix doctor --kv-local\nLogs:    docker logs -f ${CONTAINER_NAME}\nStop:    docker rm -f ${CONTAINER_NAME}\n`);
}

main().catch((err) => {
  process.stderr.write(`\x1b[31m●\x1b[0m fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
