// Indexer mirrors V1 + V2 + V3 ReceiptAnchored events. V2 and V3 share the same event ABI (id, root, agent, type, store, attest, relayer, nonce) so one worker handles both; V1 uses its 6-field shape. Closes the V3-blind reader part of USER_TODO §B-V2-37 (✅ shipped).
/**
 * `ivaronix indexer ...` — receipt indexer (PASS 76 S-5).
 *
 * Mirrors on-chain `ReceiptAnchored` events into a local SQLite read replica
 * so Studio's /global page stops iterating RPCs to render counts and recent
 * lists. Postgres backend is a driver flip away (same column shape) — see
 * docs/PLAN_pass76.md S-5.
 *
 * Subcommands:
 *   backfill --from <block> [--to <block>]  one-shot range sweep
 *   tail [--from <block>]                    live poll loop (Ctrl-C to stop)
 *   stats                                    summary counts
 *   list [--type N] [--agent 0x...] [--limit] [--offset]   query the replica
 */

import { Command } from 'commander';
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { IndexerDb, IndexerWorker } from '@ivaronix/indexer';
import { getDeployedAddress } from '@ivaronix/og-chain';
import { RECEIPT_TYPES, type Address } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/** Anchor on workspace root (parent of pnpm-workspace.yaml) so all surfaces share one db. */
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

interface RegistryTarget {
  address: Address;
  registryVersion: 1 | 2 | 3;
}

interface IndexerContext {
  db: IndexerDb;
  // Sweep 65: backfill iterates over BOTH V1 and V2 registries when
  // both are deployed. The single-address `address` field below is the
  // V1 contract for backwards-compat with code that still reads it
  // (sweep 64's stats display, the V1 cursor key in ingest_cursor);
  // multi-version code paths use `registries` instead.
  address: Address;
  registries: RegistryTarget[];
  rpcUrl: string;
  chainId: number;
}

function buildContext(): IndexerContext | null {
  const env = loadEnv();
  const v1Addr = getDeployedAddress(env.network, 'ReceiptRegistry');
  const v2Addr = getDeployedAddress(env.network, 'ReceiptRegistryV2');
  const v3Addr = getDeployedAddress(env.network, 'ReceiptRegistryV3');
  if (!v1Addr && !v2Addr && !v3Addr) {
    ui.fail(`No ReceiptRegistry (V1, V2, or V3) deployed on ${env.network}`);
    return null;
  }
  const registries: RegistryTarget[] = [];
  if (v1Addr) registries.push({ address: v1Addr as Address, registryVersion: 1 });
  if (v2Addr) registries.push({ address: v2Addr as Address, registryVersion: 2 });
  if (v3Addr) registries.push({ address: v3Addr as Address, registryVersion: 3 });
  const dbPath = indexerDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  // address kept for legacy stats output; multi-registry callers use registries[].
  return {
    db: new IndexerDb(dbPath),
    address: (v1Addr ?? v2Addr) as Address,
    registries,
    rpcUrl: env.rpcUrl,
    chainId: env.chainId,
  };
}

const RECEIPT_TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(RECEIPT_TYPES).map(([k, v]) => [v, k]),
);

export const indexerCommand = new Command('indexer')
  .description('Index ReceiptRegistry events into a local read replica');

indexerCommand
  .command('backfill')
  .description('Sweep a block range and write all ReceiptAnchored events to the local DB')
  .option('--from <block>', 'starting block (default: cursor or 0)')
  .option('--to <block>', 'ending block (default: chain head)')
  .option('--chunk <n>', 'block range per RPC call', '5000')
  .action(async (opts: { from?: string; to?: string; chunk: string }) => {
    const ctx = buildContext();
    if (!ctx) { process.exitCode = 1; return; }
    // Sweep 65: backfill iterates each deployed registry (V1, V2, ...)
    // with its own per-contract cursor in ingest_cursor. Each worker
    // tags rows by registryVersion so V1 id=N and V2 id=N coexist.
    let totalScanned = 0;
    let totalInserted = 0;
    let finalBlock = 0;
    for (const reg of ctx.registries) {
      const worker = new IndexerWorker(ctx.db, {
        rpcUrl: ctx.rpcUrl,
        chainId: ctx.chainId,
        contractAddress: reg.address,
        registryVersion: reg.registryVersion,
        blockChunkSize: Math.max(100, Number(opts.chunk) || 5000),
      });
      const cursor = ctx.db.getCursor(reg.address);
      const fromBlockReg = opts.from
        ? Number(opts.from)
        : cursor
          ? cursor.lastBlock + 1
          : 0;
      const toBlockMaybeReg = opts.to ? Number(opts.to) : undefined;
      ui.section(`backfill V${reg.registryVersion} · ${reg.address}`);
      ui.info(`from block           ${fromBlockReg}`);
      ui.info(`to block             ${toBlockMaybeReg ?? '(chain head)'}`);
      try {
        const r = await worker.backfill(fromBlockReg, toBlockMaybeReg);
        ui.pass(`scanned blocks       ${r.scannedBlocks}`);
        ui.pass(`inserted rows        ${r.insertedRows}`);
        ui.pass(`final block          ${r.toBlock}`);
        totalScanned += r.scannedBlocks;
        totalInserted += r.insertedRows;
        finalBlock = Math.max(finalBlock, r.toBlock);
      } catch (err) {
        ui.fail(`V${reg.registryVersion} backfill failed`, (err as Error).message);
      }
    }
    ctx.db.close();
    ui.divider();
    ui.pass(`total scanned        ${totalScanned} blocks`);
    ui.pass(`total inserted       ${totalInserted} rows (V1 + V2 combined)`);
    return;

  });

indexerCommand
  .command('tail')
  .description('Live-tail ReceiptAnchored events. Ctrl-C to stop.')
  .option('--from <block>', 'starting block if no cursor exists')
  .option('--interval <ms>', 'poll interval in ms', '6000')
  .option('--chunk <n>', 'block range per RPC call', '5000')
  .action(async (opts: { from?: string; interval: string; chunk: string }) => {
    const ctx = buildContext();
    if (!ctx) { process.exitCode = 1; return; }
    const worker = new IndexerWorker(ctx.db, {
      rpcUrl: ctx.rpcUrl,
      chainId: ctx.chainId,
      contractAddress: ctx.address,
      blockChunkSize: Math.max(100, Number(opts.chunk) || 5000),
    });

    ui.title('indexer · tail');
    ui.info(`db                   ${ctx.db.path}`);
    ui.info(`contract             ${ctx.address}`);
    ui.info(`poll interval        ${opts.interval}ms`);
    ui.divider();
    ui.hint('Ctrl-C to stop.');

    process.on('SIGINT', () => {
      worker.stop();
      ui.info('\n(stopping…)');
    });

    try {
      await worker.tail({
        fromBlock: opts.from ? Number(opts.from) : undefined,
        pollIntervalMs: Math.max(1000, Number(opts.interval) || 6000),
        onTick: (r) => {
          if (r.insertedRows > 0) {
            ui.pass(`+${r.insertedRows} receipts (blocks ${r.fromBlock}..${r.toBlock})`);
          }
        },
      });
    } finally {
      ctx.db.close();
    }
  });

indexerCommand
  .command('stats')
  .description('Print counts and the latest indexed receipt')
  .action(() => {
    const ctx = buildContext();
    if (!ctx) { process.exitCode = 1; return; }
    try {
      const s = ctx.db.stats();
      const cursor = ctx.db.getCursor(ctx.address);
      // Sweep 65: indexer now indexes both V1 and V2. Display the
      // split + per-registry cursors so operators can see migration
      // state at a glance. The previous V1-only caveat is removed
      // because the real fix landed.
      ui.title('indexer · stats');
      ui.info(`db                   ${ctx.db.path}`);
      for (const reg of ctx.registries) {
        const c = ctx.db.getCursor(reg.address);
        ui.info(`contract V${reg.registryVersion}          ${reg.address}`);
        ui.info(`  cursor (last block) ${c?.lastBlock ?? '(none)'}`);
      }
      ui.info(`total receipts       ${s.totalReceipts}  (V1: ${s.totalV1} + V2: ${s.totalV2})`);
      ui.info(`distinct agents      ${s.distinctAgents}`);
      ui.info(`latest receipt id    ${s.latestReceiptId >= 0 ? s.latestReceiptId : '(none)'}`);
      ui.info(`latest block         ${s.latestBlock}`);
      ui.divider();
      ui.title('by type');
      for (const [t, n] of Object.entries(s.byType).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const name = RECEIPT_TYPE_NAMES[Number(t)] ?? `type${t}`;
        ui.info(`  ${name.padEnd(24)} ${n}`);
      }
    } finally {
      ctx.db.close();
    }
  });

indexerCommand
  .command('list')
  .description('Query the local replica')
  .option('--type <name>', 'filter by receipt type (e.g. doc_ask, skill_exec, subscription_skill_exec)')
  .option('--agent <0x>', 'filter by agent address')
  .option('--limit <n>', 'max rows', '20')
  .option('--offset <n>', 'rows to skip', '0')
  .action((opts: { type?: string; agent?: string; limit: string; offset: string }) => {
    const ctx = buildContext();
    if (!ctx) { process.exitCode = 1; return; }
    try {
      let receiptType: number | undefined;
      if (opts.type) {
        const t = (RECEIPT_TYPES as Record<string, number>)[opts.type];
        if (t === undefined) {
          ui.fail(`unknown receipt type: ${opts.type}`);
          ui.hint(`valid: ${Object.keys(RECEIPT_TYPES).join(', ')}`);
          process.exitCode = 1;
          return;
        }
        receiptType = t;
      }
      const rows = ctx.db.listReceipts({
        agent: opts.agent as Address | undefined,
        receiptType,
        limit: Number(opts.limit) || 20,
        offset: Number(opts.offset) || 0,
      });
      ui.title('indexer · list');
      if (rows.length === 0) {
        ui.info('(no receipts match)');
        return;
      }
      for (const r of rows) {
        const name = RECEIPT_TYPE_NAMES[r.receiptType] ?? `type${r.receiptType}`;
        const tsIso = r.blockTimestamp > 0 ? new Date(r.blockTimestamp * 1000).toISOString() : '-';
        ui.info(`  #${String(r.id).padStart(4)}  ${name.padEnd(24)} blk=${r.blockNumber}  agent=${r.agent}  ${tsIso}`);
      }
    } finally {
      ctx.db.close();
    }
  });
