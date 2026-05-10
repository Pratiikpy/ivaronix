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

function buildContext(): { db: IndexerDb; address: Address; rpcUrl: string; chainId: number } | null {
  const env = loadEnv();
  const addr = getDeployedAddress(env.network, 'ReceiptRegistry');
  if (!addr) {
    ui.fail(`No ReceiptRegistry address known for network=${env.network}`);
    return null;
  }
  const dbPath = indexerDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  return {
    db: new IndexerDb(dbPath),
    address: addr as Address,
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
    const worker = new IndexerWorker(ctx.db, {
      rpcUrl: ctx.rpcUrl,
      chainId: ctx.chainId,
      contractAddress: ctx.address,
      blockChunkSize: Math.max(100, Number(opts.chunk) || 5000),
    });

    const cursor = ctx.db.getCursor(ctx.address);
    const fromBlock = opts.from
      ? Number(opts.from)
      : cursor
        ? cursor.lastBlock + 1
        : 0;
    const toBlockMaybe = opts.to ? Number(opts.to) : undefined;

    ui.title('indexer · backfill');
    ui.info(`db                   ${ctx.db.path}`);
    ui.info(`contract             ${ctx.address}`);
    ui.info(`from block           ${fromBlock}`);
    ui.info(`to block             ${toBlockMaybe ?? '(chain head)'}`);
    ui.divider();

    try {
      ui.pending('querying ReceiptAnchored events...');
      const r = await worker.backfill(fromBlock, toBlockMaybe);
      ui.pass(`scanned blocks       ${r.scannedBlocks}`);
      ui.pass(`inserted rows        ${r.insertedRows}`);
      ui.pass(`final block          ${r.toBlock}`);
    } catch (err) {
      ui.fail('backfill failed', (err as Error).message);
      process.exitCode = 1;
    } finally {
      ctx.db.close();
    }
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
      ui.title('indexer · stats');
      ui.info(`db                   ${ctx.db.path}`);
      ui.info(`contract             ${ctx.address}  (V1 only · V2 indexing queued)`);
      ui.info(`cursor (last block)  ${cursor?.lastBlock ?? '(none)'}`);
      ui.info(`total receipts       ${s.totalReceipts}  (V1 events only)`);
      ui.info(`distinct agents      ${s.distinctAgents}`);
      ui.info(`latest receipt id    ${s.latestReceiptId >= 0 ? s.latestReceiptId : '(none)'}`);
      ui.info(`latest block         ${s.latestBlock}`);
      // V1-only caveat per sweep 64. The local SQLite indexer was
      // built before V2 contracts existed; extending it to multi-
      // registry is queued in USER_TODO §B-V2-INDEXER-V2. Until then,
      // operators reading these stats need to know V2 anchors are
      // invisible here. The chain-side `pnpm doctor` and `pnpm stats`
      // commands DO show V1 + V2 split (sweeps 56-57).
      ui.hint('V2 receipts are NOT indexed locally yet — see `ivaronix doctor` for live V1+V2 chain counts.');
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
