/**
 * `ivaronix stats` — usage telemetry on real on-chain + local data (F-stats, A2).
 *
 * Pattern lifted from OpenCode's `stats` command, rewritten against our
 * surfaces. Reads from:
 *   - IndexerDb (PASS 76 S-5) — receipts mirrored from chain
 *   - ReceiptRegistry on chain — authoritative count via nextId()
 *   - SkillRegistry on chain — published-skill count
 *   - AgentPassportINFT on chain — wallet's tokenId
 *
 * Real numbers, not adjectives. Output is a single screen of metrics
 * that proves what the wallet has been doing on-chain, what the indexer
 * has caught up to, and where the gap is.
 *
 * Per the new-entries audit: peers ship READMEs that overpromise. Stats
 * is the antidote — every number traces back to an addressable record.
 */

import { Command } from 'commander';
import { JsonRpcProvider } from 'ethers';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ReceiptRegistryClient, AgentPassportClient, getDeployedAddress } from '@ivaronix/og-chain';
import { IndexerDb } from '@ivaronix/indexer';
import { RECEIPT_TYPES, type Address } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

const TYPE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(RECEIPT_TYPES).map(([k, v]) => [v, k]),
);

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

export const statsCommand = new Command('stats')
  .description('Usage telemetry — receipts anchored, by type, by agent, anchor latency')
  .option('--json', 'emit machine-readable JSON instead of the editorial layout')
  .action(async (opts: { json?: boolean }) => {
    const env = loadEnv();
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });

    const recAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!recAddr) {
      ui.fail(`No ReceiptRegistry deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    // 1. On-chain authoritative counter
    let onchainNextId = 0n;
    try {
      const client = new ReceiptRegistryClient(recAddr as Address, provider);
      onchainNextId = await client.nextId();
    } catch (err) {
      ui.fail('on-chain nextId() read failed', (err as Error).message);
      process.exitCode = 1;
      return;
    }

    // 2. Local indexer stats
    let local: ReturnType<IndexerDb['stats']> | null = null;
    let cursor: ReturnType<IndexerDb['getCursor']> = null;
    try {
      const db = new IndexerDb(indexerDbPath());
      local = db.stats();
      cursor = db.getCursor(recAddr as Address);
      db.close();
    } catch {
      // ok if indexer DB doesn't exist yet
    }

    // 3. Wallet-specific (if env wallet is set)
    let walletReceipts = 0n;
    let passportTokenId = 0n;
    if (env.walletAddress) {
      try {
        const client = new ReceiptRegistryClient(recAddr as Address, provider);
        walletReceipts = await client.agentReceiptCount(env.walletAddress as Address);
      } catch {/* ignore */}
      const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
      if (passportAddr) {
        try {
          const c = new AgentPassportClient(passportAddr as Address, provider);
          passportTokenId = await c.passportOf(env.walletAddress as Address);
        } catch {/* ignore */}
      }
    }

    // 4. Indexer freshness (lag in blocks)
    let head = 0;
    try {
      head = await provider.getBlockNumber();
    } catch {/* ignore */}
    const indexerLag = cursor && head > 0 ? Math.max(0, head - cursor.lastBlock) : null;

    // 5. Anchor latency (average inter-receipt block delta as proxy)
    // For a real p95, we'd need server-side timing; this is the best we can do
    // from event logs alone, and it's honest about that.
    let avgAnchorBlocks: number | null = null;
    if (local && local.totalReceipts > 1) {
      try {
        const db = new IndexerDb(indexerDbPath());
        const recent = db.listReceipts({ limit: 100 });
        db.close();
        if (recent.length >= 2) {
          const blocks = recent.map((r) => r.blockNumber).sort((a, b) => a - b);
          let total = 0;
          for (let i = 1; i < blocks.length; i++) total += (blocks[i]! - blocks[i - 1]!);
          avgAnchorBlocks = total / (blocks.length - 1);
        }
      } catch {/* ignore */}
    }

    // ── output ──────────────────────────────────────────────────────────

    if (opts.json) {
      process.stdout.write(JSON.stringify({
        network: env.network,
        chainId: env.chainId,
        onchain: {
          receiptRegistry: recAddr,
          totalReceipts: Number(onchainNextId),
          chainHead: head,
        },
        wallet: env.walletAddress ? {
          address: env.walletAddress,
          receiptsAnchored: Number(walletReceipts),
          passportTokenId: Number(passportTokenId),
        } : null,
        indexer: local ? {
          totalReceipts: local.totalReceipts,
          byType: Object.fromEntries(
            Object.entries(local.byType).map(([k, v]) => [TYPE_NAMES[Number(k)] ?? `type${k}`, v]),
          ),
          distinctAgents: local.distinctAgents,
          latestReceiptId: local.latestReceiptId,
          latestBlock: local.latestBlock,
          cursorBlock: cursor?.lastBlock ?? null,
          indexerLagBlocks: indexerLag,
        } : null,
        derived: {
          avgAnchorIntervalBlocks: avgAnchorBlocks,
        },
      }, null, 2) + '\n');
      return;
    }

    ui.title('Ivaronix · stats');
    ui.info(`network              ${env.network} (chainId ${env.chainId})`);
    ui.divider();

    ui.section('01 · On-chain');
    ui.pass(`ReceiptRegistry      ${recAddr}`);
    ui.pass(`total receipts       ${onchainNextId}`);
    ui.info(`chain head           ${head}`);

    if (env.walletAddress) {
      ui.section('02 · This wallet');
      ui.info(`address              ${env.walletAddress}`);
      ui.pass(`receipts anchored    ${walletReceipts}`);
      if (passportTokenId > 0n) ui.pass(`passport tokenId     ${passportTokenId}`);
      else ui.info(`passport             (not minted)`);
    }

    if (local) {
      ui.section('03 · Local indexer (read replica)');
      ui.pass(`indexed receipts     ${local.totalReceipts}`);
      ui.info(`distinct agents      ${local.distinctAgents}`);
      ui.info(`latest indexed id    ${local.latestReceiptId >= 0 ? local.latestReceiptId : '(none)'}`);
      ui.info(`indexer cursor       block ${cursor?.lastBlock ?? '(no cursor)'}`);
      if (indexerLag !== null) {
        if (indexerLag === 0) ui.pass(`indexer lag          0 blocks (caught up)`);
        else if (indexerLag < 100) ui.info(`indexer lag          ${indexerLag} blocks`);
        else ui.fail(`indexer lag          ${indexerLag} blocks (run \`ivaronix indexer backfill\`)`);
      }
      const onchainCount = Number(onchainNextId);
      const localCount = local.totalReceipts;
      const gap = onchainCount - localCount;
      if (gap > 0) ui.info(`gap (chain - local)  ${gap} receipts not yet indexed`);
    } else {
      ui.section('03 · Local indexer');
      ui.info('(indexer DB not initialized — run `ivaronix indexer backfill`)');
    }

    if (local && local.totalReceipts > 0) {
      ui.section('04 · By receipt type');
      const sorted = Object.entries(local.byType)
        .map(([k, v]) => ({ t: Number(k), n: v }))
        .sort((a, b) => b.n - a.n);
      for (const r of sorted) {
        const name = TYPE_NAMES[r.t] ?? `type${r.t}`;
        ui.info(`  ${name.padEnd(24)} ${r.n}`);
      }
    }

    if (avgAnchorBlocks !== null) {
      ui.section('05 · Derived');
      ui.info(`avg anchor interval  ${avgAnchorBlocks.toFixed(1)} blocks (last 100 receipts)`);
      ui.info(`                     ≈ ${(avgAnchorBlocks * 1.5).toFixed(1)}s @ 1.5s/block on Galileo`);
    }

    ui.divider();
    ui.hint('Drill into a single receipt: ivaronix debug receipt <id>');
    ui.hint('Re-sync indexer:            ivaronix indexer backfill');
  });
