/**
 * Receipt indexer schema + read/write helpers (PASS 76 S-5).
 *
 * Plan: Drizzle + Postgres for production. Phase 1 ships better-sqlite3
 * because it's already vendored (memory engine) and verifiable on Windows
 * without Docker. Same column shape as the planned Postgres schema, so the
 * Drizzle/postgres-js driver is a flip later, not a rewrite.
 *
 * Source of truth stays on chain. This is a read replica — every row
 * derives from a `ReceiptAnchored` event. Studio's /global page uses
 * this to skip per-receipt RPC iteration.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Address, Hash } from '@ivaronix/core';

export interface IndexedReceipt {
  id: number;
  receiptRoot: Hash;
  storageRoot: Hash;
  attestationHash: Hash;
  agent: Address;
  receiptType: number;
  blockNumber: number;
  blockTimestamp: number;
  txHash: Hash;
  logIndex: number;
}

export interface IndexerStats {
  totalReceipts: number;
  byType: Record<number, number>;
  latestBlock: number;
  latestReceiptId: number;
  distinctAgents: number;
}

export class IndexerDb {
  readonly path: string;
  private db: Database.Database;

  constructor(filePath: string) {
    this.path = resolve(filePath);
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new Database(this.path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.bootstrap();
  }

  private bootstrap(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY,
        receipt_root TEXT NOT NULL,
        storage_root TEXT NOT NULL,
        attestation_hash TEXT NOT NULL,
        agent TEXT NOT NULL,
        receipt_type INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        block_timestamp INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_receipts_agent     ON receipts (agent);
      CREATE INDEX IF NOT EXISTS idx_receipts_type      ON receipts (receipt_type);
      CREATE INDEX IF NOT EXISTS idx_receipts_block     ON receipts (block_number);
      CREATE INDEX IF NOT EXISTS idx_receipts_agent_type ON receipts (agent, receipt_type);

      CREATE TABLE IF NOT EXISTS ingest_cursor (
        contract_address TEXT PRIMARY KEY,
        last_block_indexed INTEGER NOT NULL,
        last_indexed_at INTEGER NOT NULL
      );
    `);
  }

  upsertReceipt(r: IndexedReceipt): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO receipts
        (id, receipt_root, storage_root, attestation_hash, agent, receipt_type,
         block_number, block_timestamp, tx_hash, log_index)
      VALUES
        (@id, @receiptRoot, @storageRoot, @attestationHash, @agent, @receiptType,
         @blockNumber, @blockTimestamp, @txHash, @logIndex)`,
    ).run(r);
  }

  upsertMany(rows: IndexedReceipt[]): number {
    if (rows.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO receipts
        (id, receipt_root, storage_root, attestation_hash, agent, receipt_type,
         block_number, block_timestamp, tx_hash, log_index)
      VALUES
        (@id, @receiptRoot, @storageRoot, @attestationHash, @agent, @receiptType,
         @blockNumber, @blockTimestamp, @txHash, @logIndex)`,
    );
    const tx = this.db.transaction((batch: IndexedReceipt[]) => {
      for (const r of batch) stmt.run(r);
    });
    tx(rows);
    return rows.length;
  }

  setCursor(contractAddress: Address, lastBlockIndexed: number): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO ingest_cursor
        (contract_address, last_block_indexed, last_indexed_at)
       VALUES (@addr, @block, @at)`,
    ).run({
      addr: contractAddress.toLowerCase(),
      block: lastBlockIndexed,
      at: Math.floor(Date.now() / 1000),
    });
  }

  getCursor(contractAddress: Address): { lastBlock: number; at: number } | null {
    const row = this.db.prepare(
      `SELECT last_block_indexed AS lastBlock, last_indexed_at AS at
         FROM ingest_cursor
         WHERE contract_address = ?`,
    ).get(contractAddress.toLowerCase()) as { lastBlock: number; at: number } | undefined;
    return row ?? null;
  }

  getReceipt(id: number): IndexedReceipt | null {
    const row = this.db.prepare(
      `SELECT id, receipt_root AS receiptRoot, storage_root AS storageRoot,
              attestation_hash AS attestationHash, agent, receipt_type AS receiptType,
              block_number AS blockNumber, block_timestamp AS blockTimestamp,
              tx_hash AS txHash, log_index AS logIndex
         FROM receipts WHERE id = ?`,
    ).get(id) as IndexedReceipt | undefined;
    return row ?? null;
  }

  listReceipts(opts: {
    agent?: Address;
    receiptType?: number;
    limit?: number;
    offset?: number;
  } = {}): IndexedReceipt[] {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
    const offset = Math.max(opts.offset ?? 0, 0);
    const where: string[] = [];
    const params: Record<string, unknown> = { limit, offset };
    if (opts.agent) {
      where.push('agent = @agent');
      params.agent = opts.agent.toLowerCase();
    }
    if (opts.receiptType !== undefined) {
      where.push('receipt_type = @type');
      params.type = opts.receiptType;
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(
      `SELECT id, receipt_root AS receiptRoot, storage_root AS storageRoot,
              attestation_hash AS attestationHash, agent, receipt_type AS receiptType,
              block_number AS blockNumber, block_timestamp AS blockTimestamp,
              tx_hash AS txHash, log_index AS logIndex
         FROM receipts ${whereSql}
         ORDER BY id DESC
         LIMIT @limit OFFSET @offset`,
    ).all(params) as IndexedReceipt[];
  }

  stats(): IndexerStats {
    const totalRow = this.db.prepare('SELECT COUNT(*) AS n FROM receipts').get() as { n: number };
    const latestRow = this.db.prepare(
      'SELECT MAX(id) AS id, MAX(block_number) AS blk FROM receipts',
    ).get() as { id: number | null; blk: number | null };
    const distinctRow = this.db.prepare(
      'SELECT COUNT(DISTINCT agent) AS n FROM receipts',
    ).get() as { n: number };
    const typeRows = this.db.prepare(
      'SELECT receipt_type AS t, COUNT(*) AS n FROM receipts GROUP BY receipt_type',
    ).all() as Array<{ t: number; n: number }>;
    const byType: Record<number, number> = {};
    for (const r of typeRows) byType[r.t] = r.n;
    return {
      totalReceipts: totalRow.n,
      byType,
      latestBlock: latestRow.blk ?? 0,
      latestReceiptId: latestRow.id ?? -1,
      distinctAgents: distinctRow.n,
    };
  }

  close(): void {
    this.db.close();
  }
}
