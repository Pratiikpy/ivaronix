/**
 * Unit tests for the receipt-indexer SQLite read-replica.
 *
 * Source of truth stays on chain. This DB is a derived view fed by
 * `ReceiptAnchored` events — the test contract is "given the same
 * events, the DB returns the same rows on every query." Studio's
 * /global page reads from this surface, so query semantics
 * (lower-case agent normalization, limit clamping, ORDER BY id DESC)
 * are user-visible and must not silently drift.
 *
 * Test runner: Node's built-in node:test via tsx (matches the repo's
 * 11-package convention).
 *
 * Each test creates a unique temp-file DB. better-sqlite3 supports
 * `:memory:` but the IndexerDb constructor wraps the path through
 * `resolve` + `mkdirSync(dirname)` — which doesn't compose with
 * `:memory:`. File-backed temps match the production code path
 * exactly, including the WAL pragma + bootstrap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { IndexerDb, type IndexedReceipt } from './db.js';
import type { Address, Hash } from '@ivaronix/core';

function makeTempDb(): { db: IndexerDb; cleanup: () => void } {
  const root = mkdtempSync(resolve(tmpdir(), 'ivaronix-indexer-'));
  const dbPath = resolve(root, 'receipts.db');
  const db = new IndexerDb(dbPath);
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

const ZERO_HASH: Hash = ('0x' + '0'.repeat(64)) as Hash;

function makeReceipt(overrides: Partial<IndexedReceipt> = {}): IndexedReceipt {
  return {
    id: 1,
    registryVersion: 1, // sweep 65: V1 default for backwards-compat fixtures
    receiptRoot: ('0x' + '11'.repeat(32)) as Hash,
    storageRoot: ('0x' + '22'.repeat(32)) as Hash,
    attestationHash: ZERO_HASH,
    agent: '0xAaBbCcDdEeFf00112233445566778899aAbBcCdD' as Address,
    receiptType: 1,
    blockNumber: 100,
    blockTimestamp: 1700000000,
    txHash: ('0x' + '33'.repeat(32)) as Hash,
    logIndex: 0,
    ...overrides,
  };
}

test('constructor bootstraps schema (receipts + ingest_cursor tables)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    // If schema bootstrap failed, stats() would throw. Use it as a
    // smoke that the receipts table exists and is queryable.
    const stats = db.stats();
    assert.equal(stats.totalReceipts, 0);
    assert.equal(stats.latestReceiptId, -1, 'empty DB → latestReceiptId is sentinel -1');
  } finally {
    cleanup();
  }
});

test('upsertReceipt + getReceipt round-trip preserves all fields', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const r = makeReceipt({ id: 42, receiptType: 7, blockNumber: 1234 });
    db.upsertReceipt(r);
    const got = db.getReceipt(42);
    assert.deepEqual(got, r);
  } finally {
    cleanup();
  }
});

test('upsertReceipt with same id overwrites previous row (INSERT OR REPLACE)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertReceipt(makeReceipt({ id: 1, blockNumber: 100 }));
    db.upsertReceipt(makeReceipt({ id: 1, blockNumber: 200 }));
    const got = db.getReceipt(1);
    assert.equal(got?.blockNumber, 200, 'second upsert wins');
    assert.equal(db.stats().totalReceipts, 1, 'no duplicate row');
  } finally {
    cleanup();
  }
});

test('getReceipt returns null when id not found', () => {
  const { db, cleanup } = makeTempDb();
  try {
    assert.equal(db.getReceipt(9999), null);
  } finally {
    cleanup();
  }
});

test('upsertMany inserts every row in a single transaction', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const rows = [1, 2, 3, 4, 5].map((i) => makeReceipt({ id: i }));
    const inserted = db.upsertMany(rows);
    assert.equal(inserted, 5);
    assert.equal(db.stats().totalReceipts, 5);
  } finally {
    cleanup();
  }
});

test('upsertMany on empty array returns 0 (no-op)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    assert.equal(db.upsertMany([]), 0);
    assert.equal(db.stats().totalReceipts, 0);
  } finally {
    cleanup();
  }
});

test('setCursor + getCursor round-trip per contract address', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const addr = '0xAbCdEf0123456789012345678901234567890aBC' as Address;
    db.setCursor(addr, 12345);
    const got = db.getCursor(addr);
    assert.ok(got);
    assert.equal(got!.lastBlock, 12345);
    assert.ok(got!.at > 0, 'at is a recent unix timestamp');
  } finally {
    cleanup();
  }
});

test('setCursor lowercases the contract address (case-insensitive lookup)', () => {
  // The implementation calls `.toLowerCase()` so an address written
  // with mixed case can be read back with any case. This pins the
  // normalization contract — without it, /global queries vs an event
  // ingester writing the same address differently could miss rows.
  const { db, cleanup } = makeTempDb();
  try {
    const upper = '0xABCDEF0123456789012345678901234567890ABC' as Address;
    const lower = '0xabcdef0123456789012345678901234567890abc' as Address;
    db.setCursor(upper, 99);
    assert.equal(db.getCursor(lower)?.lastBlock, 99);
    assert.equal(db.getCursor(upper)?.lastBlock, 99);
  } finally {
    cleanup();
  }
});

test('getCursor returns null for unknown contract', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const addr = '0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef' as Address;
    assert.equal(db.getCursor(addr), null);
  } finally {
    cleanup();
  }
});

test('setCursor with same address overwrites the cursor (INSERT OR REPLACE)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const addr = '0x0123456789012345678901234567890123456789' as Address;
    db.setCursor(addr, 100);
    db.setCursor(addr, 200);
    assert.equal(db.getCursor(addr)?.lastBlock, 200);
  } finally {
    cleanup();
  }
});

test('listReceipts returns rows ordered by id DESC (newest first)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertMany([1, 2, 3, 4, 5].map((i) => makeReceipt({ id: i })));
    const rows = db.listReceipts();
    assert.deepEqual(rows.map((r) => r.id), [5, 4, 3, 2, 1]);
  } finally {
    cleanup();
  }
});

test('listReceipts filters by agent (lowercase normalization)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const a = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address;
    const b = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address;
    db.upsertMany([
      makeReceipt({ id: 1, agent: a }),
      makeReceipt({ id: 2, agent: b }),
      makeReceipt({ id: 3, agent: a }),
    ]);
    // Query with the upper-case form — should still match.
    const upper = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address;
    const rows = db.listReceipts({ agent: upper });
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.id).sort(), [1, 3]);
  } finally {
    cleanup();
  }
});

test('listReceipts filters by receiptType', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertMany([
      makeReceipt({ id: 1, receiptType: 1 }),
      makeReceipt({ id: 2, receiptType: 2 }),
      makeReceipt({ id: 3, receiptType: 1 }),
    ]);
    const rows = db.listReceipts({ receiptType: 1 });
    assert.equal(rows.length, 2);
  } finally {
    cleanup();
  }
});

test('listReceipts limit clamps to [1, 500]', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertMany([1, 2, 3, 4, 5].map((i) => makeReceipt({ id: i })));
    // Limit 0 should clamp to 1.
    assert.equal(db.listReceipts({ limit: 0 }).length, 1);
    // Limit 9999 should clamp to 500 (we only have 5 rows so we get 5
    // back, but the SQL query was issued with LIMIT 500).
    assert.equal(db.listReceipts({ limit: 9999 }).length, 5);
    // Negative limit also clamps to 1.
    assert.equal(db.listReceipts({ limit: -10 }).length, 1);
  } finally {
    cleanup();
  }
});

test('listReceipts offset clamps to >= 0 (negative offset treated as 0)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertMany([1, 2, 3].map((i) => makeReceipt({ id: i })));
    const rows = db.listReceipts({ offset: -5 });
    assert.equal(rows.length, 3);
  } finally {
    cleanup();
  }
});

test('listReceipts default limit is 50', () => {
  const { db, cleanup } = makeTempDb();
  try {
    // Insert 60 rows; default listReceipts() should return 50.
    db.upsertMany(Array.from({ length: 60 }, (_, i) => makeReceipt({ id: i + 1 })));
    const rows = db.listReceipts();
    assert.equal(rows.length, 50);
  } finally {
    cleanup();
  }
});

test('stats() returns aggregate counts + latest pointers', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const a = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Address;
    const b = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address;
    db.upsertMany([
      makeReceipt({ id: 1, agent: a, receiptType: 1, blockNumber: 100 }),
      makeReceipt({ id: 2, agent: a, receiptType: 2, blockNumber: 200 }),
      makeReceipt({ id: 3, agent: b, receiptType: 1, blockNumber: 300 }),
    ]);
    const s = db.stats();
    assert.equal(s.totalReceipts, 3);
    assert.equal(s.distinctAgents, 2);
    assert.equal(s.latestBlock, 300);
    assert.equal(s.latestReceiptId, 3);
    assert.equal(s.byType[1], 2);
    assert.equal(s.byType[2], 1);
  } finally {
    cleanup();
  }
});

test('stats() on empty DB returns zeros + sentinel latestReceiptId=-1', () => {
  const { db, cleanup } = makeTempDb();
  try {
    const s = db.stats();
    assert.equal(s.totalReceipts, 0);
    assert.equal(s.distinctAgents, 0);
    assert.equal(s.latestBlock, 0);
    assert.equal(s.latestReceiptId, -1);
    assert.deepEqual(s.byType, {});
  } finally {
    cleanup();
  }
});

test('persistence: rows survive close + reopen on the same path', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ivaronix-indexer-persist-'));
  const dbPath = resolve(root, 'receipts.db');
  try {
    const db1 = new IndexerDb(dbPath);
    db1.upsertReceipt(makeReceipt({ id: 99, blockNumber: 555 }));
    db1.close();

    const db2 = new IndexerDb(dbPath);
    const got = db2.getReceipt(99);
    assert.equal(got?.blockNumber, 555);
    db2.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Sweep 65 · V2-aware indexing tests
test('V1 id=N and V2 id=N coexist (composite PK)', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertReceipt(makeReceipt({ id: 1, registryVersion: 1, blockNumber: 100 }));
    db.upsertReceipt(makeReceipt({ id: 1, registryVersion: 2, blockNumber: 200 }));
    const v1 = db.getReceipt(1, 1);
    const v2 = db.getReceipt(1, 2);
    assert.equal(v1?.blockNumber, 100);
    assert.equal(v2?.blockNumber, 200);
    assert.equal(db.stats().totalReceipts, 2);
  } finally {
    cleanup();
  }
});

test('stats split V1 vs V2 anchored counts', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertMany([
      makeReceipt({ id: 1, registryVersion: 1 }),
      makeReceipt({ id: 2, registryVersion: 1 }),
      makeReceipt({ id: 1, registryVersion: 2 }),
    ]);
    const s = db.stats();
    assert.equal(s.totalReceipts, 3);
    assert.equal(s.totalV1, 2);
    assert.equal(s.totalV2, 1);
  } finally {
    cleanup();
  }
});

test('listReceipts filter by registryVersion', () => {
  const { db, cleanup } = makeTempDb();
  try {
    db.upsertMany([
      makeReceipt({ id: 1, registryVersion: 1 }),
      makeReceipt({ id: 2, registryVersion: 1 }),
      makeReceipt({ id: 1, registryVersion: 2 }),
    ]);
    const v1Only = db.listReceipts({ registryVersion: 1 });
    const v2Only = db.listReceipts({ registryVersion: 2 });
    const all = db.listReceipts();
    assert.equal(v1Only.length, 2);
    assert.equal(v2Only.length, 1);
    assert.equal(all.length, 3);
    assert.ok(v1Only.every((r) => r.registryVersion === 1));
    assert.ok(v2Only.every((r) => r.registryVersion === 2));
  } finally {
    cleanup();
  }
});
