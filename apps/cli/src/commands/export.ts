/**
 * `ivaronix export` and `ivaronix import` — portable bundle (F-export, A2).
 *
 * Pattern lifted from OpenCode's export/import commands. Bundles
 * everything a wallet needs to reproduce its receipt history on a fresh
 * machine into one JSON file. Round-trip restore is idempotent.
 *
 * What goes in the bundle:
 *   - schema_version (1)
 *   - exported_at (ISO timestamp)
 *   - workspace.network + chainId
 *   - workspace.wallet (just the address, never the private key)
 *   - workspace.passportTokenId (read from chain at export time)
 *   - receipts[] — every row from the local IndexerDb (chain is source of
 *                  truth; this is the queryable snapshot)
 *   - skills[] — first-party skill manifests under seed-skills/ if any
 *   - memory_streamId — the deterministic stream-ID for cross-machine
 *                       memory restore (S-2)
 *
 * What is NEVER exported:
 *   - private keys, .env contents, signing material
 *   - off-chain memory observations (those live in 0G KV via the
 *     stream-ID; restore re-pulls them after import)
 */

import { Command } from 'commander';
import { JsonRpcProvider } from 'ethers';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { AgentPassportClient, getDeployedAddress } from '@ivaronix/og-chain';
import { IndexerDb } from '@ivaronix/indexer';
import { memoryStreamId } from '@ivaronix/og-storage';
import { type Address } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

const SCHEMA_VERSION = 1 as const;

interface IvaronixBundle {
  schema_version: 1;
  exported_at: string;
  workspace: {
    network: string;
    chainId: number;
    wallet: string;
    passportTokenId: number;
    memory_streamId: string;
  };
  receipts: Array<{
    id: number;
    receiptRoot: string;
    storageRoot: string;
    attestationHash: string;
    agent: string;
    receiptType: number;
    blockNumber: number;
    blockTimestamp: number;
    txHash: string;
    logIndex: number;
  }>;
  receipt_count: number;
  notes: string[];
}

function indexerDbPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'indexer', 'receipts.db');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.ivaronix', 'indexer', 'receipts.db');
}

export const exportCommand = new Command('export')
  .description('Bundle wallet receipts + workspace metadata into a portable JSON archive')
  .option('-o, --output <path>', 'output file path', './ivaronix-bundle.json')
  .option('--all-agents', 'include receipts from every indexed agent (default: only env wallet)')
  .option('--limit <n>', 'cap the receipts exported', '5000')
  .action(async (opts: { output: string; allAgents?: boolean; limit: string }) => {
    const env = loadEnv();
    if (!env.walletAddress && !opts.allAgents) {
      ui.fail('No IVARONIX_WALLET_ADDRESS (legacy: EVM_WALLET_ADDRESS) in .env. Pass --all-agents to skip the wallet filter.');
      process.exitCode = 1;
      return;
    }

    ui.title('Ivaronix · export');
    ui.info(`network              ${env.network} (${env.chainId})`);
    ui.divider();

    // 1. Read passport tokenId at export time (snapshot)
    let passportTokenId = 0n;
    if (env.walletAddress) {
      const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
      if (passportAddr) {
        try {
          const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
          const c = new AgentPassportClient(passportAddr as Address, provider);
          passportTokenId = await c.passportOf(env.walletAddress as Address);
        } catch {/* ignore — bundle still valid without it */}
      }
    }

    // 2. Read receipts from indexer DB
    let receipts: ReturnType<IndexerDb['listReceipts']> = [];
    try {
      const db = new IndexerDb(indexerDbPath());
      receipts = db.listReceipts({
        agent: opts.allAgents ? undefined : (env.walletAddress as Address | undefined),
        limit: Math.max(1, Number(opts.limit) || 5000),
      });
      db.close();
    } catch (err) {
      ui.fail('indexer DB read failed', (err as Error).message);
      ui.hint('Run `ivaronix indexer backfill` first to populate the local replica.');
      process.exitCode = 1;
      return;
    }

    // 3. Compose bundle
    const bundle: IvaronixBundle = {
      schema_version: SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      workspace: {
        network: env.network,
        chainId: env.chainId,
        wallet: env.walletAddress ?? '',
        passportTokenId: Number(passportTokenId),
        memory_streamId: env.walletAddress ? memoryStreamId(env.walletAddress) : '',
      },
      receipts: receipts.map((r) => ({
        id: r.id,
        receiptRoot: r.receiptRoot,
        storageRoot: r.storageRoot,
        attestationHash: r.attestationHash,
        agent: r.agent,
        receiptType: r.receiptType,
        blockNumber: r.blockNumber,
        blockTimestamp: r.blockTimestamp,
        txHash: r.txHash,
        logIndex: r.logIndex,
      })),
      receipt_count: receipts.length,
      notes: [
        'Private keys are NEVER included. Restore using your existing .env on the target machine.',
        'Receipts are a local replica of on-chain state. The chain is the source of truth.',
        'Memory observations live in 0G KV under workspace.memory_streamId; ivaronix import re-derives the stream-ID and pulls them.',
      ],
    };

    // 4. Write
    const outPath = resolve(opts.output);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

    ui.pass(`receipts exported    ${bundle.receipts.length}`);
    ui.pass(`passport tokenId     ${bundle.workspace.passportTokenId}`);
    ui.pass(`memory streamId      ${bundle.workspace.memory_streamId.slice(0, 22)}…`);
    ui.divider();
    ui.pass(`written              ${outPath}`);
    ui.hint('Restore on a fresh machine: ivaronix import <path-to-bundle.json>');
  });

export const importCommand = new Command('import')
  .description('Restore an Ivaronix bundle into the local indexer DB (idempotent)')
  .argument('<bundle>', 'path to a bundle.json from `ivaronix export`')
  .option('--dry-run', 'parse + report what would be imported, write nothing')
  .action(async (bundlePath: string, opts: { dryRun?: boolean }) => {
    if (!existsSync(bundlePath)) {
      ui.fail(`bundle not found: ${bundlePath}`);
      process.exitCode = 1;
      return;
    }

    let bundle: IvaronixBundle;
    try {
      const raw: unknown = JSON.parse(readFileSync(bundlePath, 'utf8'));
      // Lightweight shape guard per HALF_BAKED §J-3 (sweep 160). A bundle
      // with valid JSON but missing top-level structure would pass `as
      // IvaronixBundle` and crash mid-import at `bundle.workspace.network`.
      // Now we fail-fast with a structured message naming what's missing.
      if (!raw || typeof raw !== 'object') throw new Error('bundle must be a JSON object');
      const r = raw as Record<string, unknown>;
      if (typeof r.schema_version !== 'number') throw new Error('bundle missing or non-numeric schema_version');
      if (!r.workspace || typeof r.workspace !== 'object') throw new Error('bundle missing workspace block');
      if (!Array.isArray(r.receipts)) throw new Error('bundle.receipts must be an array');
      bundle = raw as IvaronixBundle;
    } catch (err) {
      ui.fail('bundle parse failed', (err as Error).message);
      process.exitCode = 1;
      return;
    }

    if (bundle.schema_version !== SCHEMA_VERSION) {
      ui.fail(`unsupported schema_version=${bundle.schema_version} (expected ${SCHEMA_VERSION})`);
      process.exitCode = 1;
      return;
    }

    ui.title('Ivaronix · import');
    ui.info(`bundle               ${bundlePath}`);
    ui.info(`exported_at          ${bundle.exported_at}`);
    ui.info(`source workspace     ${bundle.workspace.wallet} on ${bundle.workspace.network}`);
    ui.info(`receipts in bundle   ${bundle.receipts.length}`);
    ui.divider();

    if (opts.dryRun) {
      ui.info('--dry-run: nothing written.');
      ui.hint('Re-run without --dry-run to actually import.');
      return;
    }

    // Sanity: refuse to mix networks unless explicitly forced.
    const env = loadEnv();
    if (bundle.workspace.network !== env.network) {
      ui.fail(`bundle is from ${bundle.workspace.network}, current IVARONIX_NETWORK is ${env.network}`);
      ui.hint(`Switch network in .env (IVARONIX_NETWORK=${bundle.workspace.network} · legacy: OG_NETWORK) before importing, or use a clean bundle.`);
      process.exitCode = 1;
      return;
    }

    // Upsert into local indexer (idempotent — duplicate ids are no-ops)
    let inserted = 0;
    try {
      const db = new IndexerDb(indexerDbPath());
      inserted = db.upsertMany(bundle.receipts.map((r) => ({
        id: r.id,
        // sweep 65: bundles serialized before V2 indexing have no
        // registryVersion field; default to V1 for backwards-compat.
        registryVersion: ((r as { registryVersion?: 1 | 2 }).registryVersion ?? 1) as 1 | 2,
        receiptRoot: r.receiptRoot as `0x${string}`,
        storageRoot: r.storageRoot as `0x${string}`,
        attestationHash: r.attestationHash as `0x${string}`,
        agent: r.agent as `0x${string}`,
        receiptType: r.receiptType,
        blockNumber: r.blockNumber,
        blockTimestamp: r.blockTimestamp,
        txHash: r.txHash as `0x${string}`,
        logIndex: r.logIndex,
      })));
      db.close();
    } catch (err) {
      ui.fail('indexer write failed', (err as Error).message);
      process.exitCode = 1;
      return;
    }

    ui.pass(`upserted             ${inserted} receipts`);
    if (bundle.workspace.memory_streamId) {
      ui.info(`memory streamId      ${bundle.workspace.memory_streamId.slice(0, 22)}…`);
      ui.hint('Memory observations re-derive from this stream-ID; pull via ivaronix memory restore (S-1 KV must be running).');
    }
    ui.divider();
    ui.pass('import complete. Verify: ivaronix stats');
  });
