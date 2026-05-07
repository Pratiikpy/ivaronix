import Database from 'better-sqlite3';
import type { ObservationMeta } from './types.js';

/**
 * SQLite + FTS5 + structured tables for memory metadata.
 * The FTS table holds plaintext for fuzzy match; the encrypted ciphertext is the
 * canonical artifact (and what would be uploaded to 0G Storage when B-1 is fixed).
 *
 * Note: receipts never contain plaintext (RECEIPTS_SPEC §5), but the local memory
 * store is user-owned and can hold plaintext for query convenience. SealedMind
 * makes the same trade-off.
 */

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    ciphertext BLOB NOT NULL,
    vec BLOB NOT NULL,
    tags TEXT NOT NULL,
    source TEXT,
    createdAt INTEGER NOT NULL,
    validFrom INTEGER,
    validUntil INTEGER,
    authorWallet TEXT,
    parentReceiptId TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_obs_createdAt ON observations(createdAt)`,
  `CREATE INDEX IF NOT EXISTS idx_obs_authorWallet ON observations(authorWallet)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
    id UNINDEXED,
    content,
    tags,
    tokenize = 'unicode61'
  )`,
  `CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    observationId TEXT NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    createdAt INTEGER NOT NULL,
    validFrom INTEGER,
    validUntil INTEGER,
    supersededBy TEXT,
    FOREIGN KEY (observationId) REFERENCES observations(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_facts_subject ON facts(subject)`,
  `CREATE INDEX IF NOT EXISTS idx_facts_predicate ON facts(predicate)`,
  `CREATE INDEX IF NOT EXISTS idx_facts_validFrom ON facts(validFrom)`,
];

export interface Fact {
  id: string;
  observationId: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  createdAt: number;
  validFrom?: number;
  validUntil?: number;
  supersededBy?: string;
}

interface ObservationListRow {
  id: string;
  vec: Buffer;
  tags: string;
  createdAt: number;
}

interface ObservationByIdRow {
  id: string;
  ciphertext: Buffer;
  tags: string;
  source: string | null;
  createdAt: number;
  validFrom: number | null;
  validUntil: number | null;
  authorWallet: string | null;
  parentReceiptId: string | null;
}

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    for (const stmt of SCHEMA_STATEMENTS) {
      this.db.prepare(stmt).run();
    }
  }

  insertObservation(meta: ObservationMeta, plaintext: string): void {
    const vecBlob = Buffer.from(meta.embeddingVector.buffer, meta.embeddingVector.byteOffset, meta.embeddingVector.byteLength);
    this.db.prepare(`
      INSERT INTO observations (id, ciphertext, vec, tags, source, createdAt, validFrom, validUntil, authorWallet, parentReceiptId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meta.id,
      Buffer.from(meta.ciphertext),
      vecBlob,
      JSON.stringify(meta.tags),
      meta.source ?? null,
      meta.createdAt,
      meta.validFrom ?? null,
      meta.validUntil ?? null,
      meta.authorWallet ?? null,
      meta.parentReceiptId ?? null,
    );
    this.db.prepare(`INSERT INTO observations_fts (id, content, tags) VALUES (?, ?, ?)`)
      .run(meta.id, plaintext, meta.tags.join(' '));
  }

  deleteObservation(id: string): void {
    this.db.prepare('DELETE FROM observations WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM observations_fts WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM facts WHERE observationId = ?').run(id);
  }

  listAll(): { id: string; vec: Float32Array; tags: string[]; createdAt: number }[] {
    const rows = this.db.prepare(`SELECT id, vec, tags, createdAt FROM observations ORDER BY createdAt`).all() as ObservationListRow[];
    return rows.map((r) => ({
      id: r.id,
      vec: new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4),
      tags: JSON.parse(r.tags) as string[],
      createdAt: r.createdAt,
    }));
  }

  getById(id: string): {
    id: string;
    ciphertext: Uint8Array;
    tags: string[];
    source: string | null;
    createdAt: number;
    validFrom: number | null;
    validUntil: number | null;
    authorWallet: string | null;
    parentReceiptId: string | null;
  } | null {
    const row = this.db.prepare(`SELECT id, ciphertext, tags, source, createdAt, validFrom, validUntil, authorWallet, parentReceiptId FROM observations WHERE id = ?`).get(id) as ObservationByIdRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      ciphertext: new Uint8Array(row.ciphertext),
      tags: JSON.parse(row.tags) as string[],
      source: row.source,
      createdAt: row.createdAt,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      authorWallet: row.authorWallet,
      parentReceiptId: row.parentReceiptId,
    };
  }

  ftsSearch(query: string, topK: number, tagFilter?: string[]): { id: string; score: number }[] {
    const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    if (!safeQuery) return [];
    const ftsQuery = safeQuery.split(/\s+/).filter((w) => w.length >= 2).join(' OR ');
    if (!ftsQuery) return [];

    let sql = `SELECT id, bm25(observations_fts) AS score FROM observations_fts WHERE observations_fts MATCH ?`;
    const params: unknown[] = [ftsQuery];
    if (tagFilter && tagFilter.length > 0) {
      const tagClauses = tagFilter.map(() => `tags LIKE ?`).join(' OR ');
      sql += ` AND (${tagClauses})`;
      for (const t of tagFilter) params.push(`%${t}%`);
    }
    sql += ` ORDER BY score LIMIT ?`;
    params.push(topK);

    const rows = this.db.prepare(sql).all(...params) as { id: string; score: number }[];
    return rows.map((r) => ({ id: r.id, score: Math.max(0, Math.min(1, 1 / (1 + Math.abs(r.score)))) }));
  }

  insertFact(f: Fact): void {
    this.db.prepare(`
      INSERT INTO facts (id, observationId, subject, predicate, object, confidence, createdAt, validFrom, validUntil, supersededBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      f.id,
      f.observationId,
      f.subject,
      f.predicate,
      f.object,
      f.confidence,
      f.createdAt,
      f.validFrom ?? null,
      f.validUntil ?? null,
      f.supersededBy ?? null,
    );
  }

  factsBySubject(subject: string, opts: { atTime?: number } = {}): Fact[] {
    let sql = `SELECT * FROM facts WHERE subject = ?`;
    const params: unknown[] = [subject];
    if (opts.atTime !== undefined) {
      sql += ` AND (validFrom IS NULL OR validFrom <= ?) AND (validUntil IS NULL OR validUntil > ?)`;
      params.push(opts.atTime, opts.atTime);
    }
    sql += ` ORDER BY createdAt DESC`;
    return this.db.prepare(sql).all(...params) as Fact[];
  }

  observationCount(): number {
    return (this.db.prepare(`SELECT COUNT(*) as c FROM observations`).get() as { c: number }).c;
  }

  factCount(): number {
    return (this.db.prepare(`SELECT COUNT(*) as c FROM facts`).get() as { c: number }).c;
  }

  close(): void {
    this.db.close();
  }
}
