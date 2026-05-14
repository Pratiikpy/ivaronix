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
  registryVersion: 1 | 2 | 3; // V1 = legacy, V2 = active, V3 = canonical slots 10/11/12 (iter 22)
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
  totalV1: number; // sweep 65: split V1 + V2 anchored counts (iter 22: V3 added)
  totalV2: number;
  totalV3: number;
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
    // Sweep 65: V2 ReceiptRegistry support. V1 id=100 and V2 id=100 are
    // DIFFERENT receipts (separate counters per registry contract), so
    // the PK is now composite (id, registry_version). Existing V1 rows
    // migrate by tagging registry_version=1.
    //
    // Migration path: detect old schema (PK on id only · no
    // registry_version column) and migrate via copy-into-new-table.
    // Safe to run repeatedly; the IF NOT EXISTS guards handle clean
    // installs.
    const hasOldSchema = this.detectOldSchema();
    if (hasOldSchema) {
      this.migrateV1ToMultiVersion();
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER NOT NULL,
        registry_version INTEGER NOT NULL DEFAULT 1,
        receipt_root TEXT NOT NULL,
        storage_root TEXT NOT NULL,
        attestation_hash TEXT NOT NULL,
        agent TEXT NOT NULL,
        receipt_type INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        block_timestamp INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        PRIMARY KEY (id, registry_version)
      );

      CREATE INDEX IF NOT EXISTS idx_receipts_agent     ON receipts (agent);
      CREATE INDEX IF NOT EXISTS idx_receipts_type      ON receipts (receipt_type);
      CREATE INDEX IF NOT EXISTS idx_receipts_block     ON receipts (block_number);
      CREATE INDEX IF NOT EXISTS idx_receipts_agent_type ON receipts (agent, receipt_type);
      CREATE INDEX IF NOT EXISTS idx_receipts_version   ON receipts (registry_version);

      CREATE TABLE IF NOT EXISTS ingest_cursor (
        contract_address TEXT PRIMARY KEY,
        last_block_indexed INTEGER NOT NULL,
        last_indexed_at INTEGER NOT NULL
      );
    `);
  }

  /**
   * Detect the pre-V2 schema: PRIMARY KEY on `id` only (no
   * registry_version column). Returns true if migration is needed.
   */
  private detectOldSchema(): boolean {
    try {
      const cols = this.db
        .prepare("PRAGMA table_info('receipts')")
        .all() as Array<{ name: string }>;
      if (cols.length === 0) return false; // table doesn't exist yet
      return !cols.some((c) => c.name === 'registry_version');
    } catch {
      return false;
    }
  }

  /**
   * Sweep 65 migration: copy old (V1-only · single-PK) rows into the
   * new multi-version schema, tagging every existing row as V1.
   */
  private migrateV1ToMultiVersion(): void {
    this.db.exec(`
      ALTER TABLE receipts RENAME TO receipts_v1_only;
      CREATE TABLE receipts (
        id INTEGER NOT NULL,
        registry_version INTEGER NOT NULL DEFAULT 1,
        receipt_root TEXT NOT NULL,
        storage_root TEXT NOT NULL,
        attestation_hash TEXT NOT NULL,
        agent TEXT NOT NULL,
        receipt_type INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        block_timestamp INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        PRIMARY KEY (id, registry_version)
      );
      INSERT INTO receipts (id, registry_version, receipt_root, storage_root,
                            attestation_hash, agent, receipt_type, block_number,
                            block_timestamp, tx_hash, log_index)
      SELECT id, 1, receipt_root, storage_root, attestation_hash, agent,
             receipt_type, block_number, block_timestamp, tx_hash, log_index
      FROM receipts_v1_only;
      DROP TABLE receipts_v1_only;
    `);
  }

  upsertReceipt(r: IndexedReceipt): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO receipts
        (id, registry_version, receipt_root, storage_root, attestation_hash, agent, receipt_type,
         block_number, block_timestamp, tx_hash, log_index)
      VALUES
        (@id, @registryVersion, @receiptRoot, @storageRoot, @attestationHash, @agent, @receiptType,
         @blockNumber, @blockTimestamp, @txHash, @logIndex)`,
    ).run(r);
  }

  upsertMany(rows: IndexedReceipt[]): number {
    if (rows.length === 0) return 0;
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO receipts
        (id, registry_version, receipt_root, storage_root, attestation_hash, agent, receipt_type,
         block_number, block_timestamp, tx_hash, log_index)
      VALUES
        (@id, @registryVersion, @receiptRoot, @storageRoot, @attestationHash, @agent, @receiptType,
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

  getReceipt(id: number, registryVersion: 1 | 2 | 3 = 1): IndexedReceipt | null {
    const row = this.db.prepare(
      `SELECT id, registry_version AS registryVersion,
              receipt_root AS receiptRoot, storage_root AS storageRoot,
              attestation_hash AS attestationHash, agent, receipt_type AS receiptType,
              block_number AS blockNumber, block_timestamp AS blockTimestamp,
              tx_hash AS txHash, log_index AS logIndex
         FROM receipts WHERE id = ? AND registry_version = ?`,
    ).get(id, registryVersion) as IndexedReceipt | undefined;
    return row ?? null;
  }

  listReceipts(opts: {
    agent?: Address;
    receiptType?: number;
    registryVersion?: 1 | 2 | 3; // sweep 65: filter by V1 / V2 / V3 (iter 22)
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
    if (opts.registryVersion !== undefined) {
      where.push('registry_version = @version');
      params.version = opts.registryVersion;
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(
      `SELECT id, registry_version AS registryVersion,
              receipt_root AS receiptRoot, storage_root AS storageRoot,
              attestation_hash AS attestationHash, agent, receipt_type AS receiptType,
              block_number AS blockNumber, block_timestamp AS blockTimestamp,
              tx_hash AS txHash, log_index AS logIndex
         FROM receipts ${whereSql}
         ORDER BY id DESC, registry_version DESC
         LIMIT @limit OFFSET @offset`,
    ).all(params) as IndexedReceipt[];
  }

  stats(): IndexerStats {
    const totalRow = this.db.prepare('SELECT COUNT(*) AS n FROM receipts').get() as { n: number };
    const v1Row = this.db
      .prepare('SELECT COUNT(*) AS n FROM receipts WHERE registry_version = 1')
      .get() as { n: number };
    const v2Row = this.db
      .prepare('SELECT COUNT(*) AS n FROM receipts WHERE registry_version = 2')
      .get() as { n: number };
    const v3Row = this.db
      .prepare('SELECT COUNT(*) AS n FROM receipts WHERE registry_version = 3')
      .get() as { n: number };
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
      totalV1: v1Row.n,
      totalV2: v2Row.n,
      totalV3: v3Row.n,
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
