/**
 * Unit tests for the 0G DA gRPC client.
 *
 * Locks in the public surface that runs OFFLINE — constants,
 * constructor defaults, env-driven instantiation, and the synchronous
 * blob-size guard. The gRPC RPCs themselves (DisperseBlob /
 * GetBlobStatus / RetrieveBlob) need a live `0g-da-client` Docker
 * container at localhost:51001 and are covered by the live smoke
 * `ivaronix doctor --da` per scripts/qa/.
 *
 * Test runner: Node's built-in node:test via tsx (matches the repo's
 * 10-package convention).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DaClient,
  createDaClient,
  DEFAULT_DA_ENDPOINT,
  MAX_BLOB_SIZE,
} from './index.js';

test('DEFAULT_DA_ENDPOINT is the documented 0g-da-client default', () => {
  // Per the README + docker-compose, the local DA client binds to
  // localhost:51001. Pinning the constant so a "clean up the magic
  // strings" refactor must explicitly choose to change the default.
  assert.equal(DEFAULT_DA_ENDPOINT, 'localhost:51001');
});

test('MAX_BLOB_SIZE matches the disperser.proto limit (31744 KiB)', () => {
  // From disperser.proto §DisperseBlobRequest comment block. If the
  // upstream proto bumps the limit, this test forces an explicit
  // update + grep for any callers depending on the old size.
  assert.equal(MAX_BLOB_SIZE, 31_744 * 1024);
});

test('DaClient constructor uses default endpoint when none given', () => {
  const c = new DaClient();
  try {
    assert.equal(c.endpoint, DEFAULT_DA_ENDPOINT);
  } finally {
    c.close();
  }
});

test('DaClient constructor honors custom endpoint', () => {
  const c = new DaClient({ endpoint: 'da.example.org:51001' });
  try {
    assert.equal(c.endpoint, 'da.example.org:51001');
  } finally {
    c.close();
  }
});

test('DaClient default timeoutMs is 30s (per-RPC deadline)', () => {
  const c = new DaClient();
  try {
    assert.equal(c.timeoutMs, 30_000);
  } finally {
    c.close();
  }
});

test('DaClient honors custom timeoutMs', () => {
  const c = new DaClient({ timeoutMs: 5_000 });
  try {
    assert.equal(c.timeoutMs, 5_000);
  } finally {
    c.close();
  }
});

test('createDaClient is a thin factory', () => {
  const c = createDaClient({ endpoint: 'unit-test:51001' });
  try {
    assert.ok(c instanceof DaClient);
    assert.equal(c.endpoint, 'unit-test:51001');
  } finally {
    c.close();
  }
});

test('DaClient.fromEnv returns null when ZG_DA_URL + ZG_DA_ENDPOINT unset', () => {
  // Honest opt-in pattern (planning-002 W3): when no DA env is set,
  // the runtime SHOULD report `daBlobRef: undefined` rather than
  // fabricate a claim. Returning null here makes the gap detectable.
  const prevUrl = process.env.ZG_DA_URL;
  const prevEndpoint = process.env.ZG_DA_ENDPOINT;
  delete process.env.ZG_DA_URL;
  delete process.env.ZG_DA_ENDPOINT;
  try {
    assert.equal(DaClient.fromEnv(), null);
  } finally {
    if (prevUrl !== undefined) process.env.ZG_DA_URL = prevUrl;
    if (prevEndpoint !== undefined) process.env.ZG_DA_ENDPOINT = prevEndpoint;
  }
});

test('DaClient.fromEnv returns null when ZG_DA_URL is empty / whitespace', () => {
  const prevUrl = process.env.ZG_DA_URL;
  process.env.ZG_DA_URL = '   ';
  try {
    assert.equal(DaClient.fromEnv(), null);
  } finally {
    if (prevUrl !== undefined) process.env.ZG_DA_URL = prevUrl;
    else delete process.env.ZG_DA_URL;
  }
});

test('DaClient.fromEnv returns instance when ZG_DA_URL is set', () => {
  const prevUrl = process.env.ZG_DA_URL;
  process.env.ZG_DA_URL = 'localhost:51001';
  try {
    const c = DaClient.fromEnv();
    assert.ok(c instanceof DaClient);
    assert.equal(c!.endpoint, 'localhost:51001');
    c?.close();
  } finally {
    if (prevUrl !== undefined) process.env.ZG_DA_URL = prevUrl;
    else delete process.env.ZG_DA_URL;
  }
});

test('DaClient.fromEnv prefers ZG_DA_URL over ZG_DA_ENDPOINT (alias)', () => {
  // The function reads `ZG_DA_URL ?? ZG_DA_ENDPOINT`. When BOTH are
  // set, ZG_DA_URL wins; the ENDPOINT alias is the legacy form.
  const prevUrl = process.env.ZG_DA_URL;
  const prevEndpoint = process.env.ZG_DA_ENDPOINT;
  process.env.ZG_DA_URL = 'primary:51001';
  process.env.ZG_DA_ENDPOINT = 'legacy:51001';
  try {
    const c = DaClient.fromEnv();
    assert.ok(c);
    assert.equal(c!.endpoint, 'primary:51001');
    c?.close();
  } finally {
    if (prevUrl !== undefined) process.env.ZG_DA_URL = prevUrl;
    else delete process.env.ZG_DA_URL;
    if (prevEndpoint !== undefined) process.env.ZG_DA_ENDPOINT = prevEndpoint;
    else delete process.env.ZG_DA_ENDPOINT;
  }
});

test('DaClient.fromEnv falls back to ZG_DA_ENDPOINT when ZG_DA_URL unset', () => {
  const prevUrl = process.env.ZG_DA_URL;
  const prevEndpoint = process.env.ZG_DA_ENDPOINT;
  delete process.env.ZG_DA_URL;
  process.env.ZG_DA_ENDPOINT = 'fallback:51001';
  try {
    const c = DaClient.fromEnv();
    assert.ok(c);
    assert.equal(c!.endpoint, 'fallback:51001');
    c?.close();
  } finally {
    if (prevUrl !== undefined) process.env.ZG_DA_URL = prevUrl;
    if (prevEndpoint !== undefined) process.env.ZG_DA_ENDPOINT = prevEndpoint;
    else delete process.env.ZG_DA_ENDPOINT;
  }
});

test('disperseBlob throws synchronously when blob exceeds MAX_BLOB_SIZE', () => {
  // The size check is BEFORE the gRPC call (and BEFORE the Promise
  // is constructed), so the assertion fires even when no DA client
  // is reachable. This is the boundary that protects against a 200MB
  // blob getting silently chunked or rejected by the wire layer with
  // a confusing error.
  //
  // Using assert.throws (not assert.rejects) because the throw is
  // synchronous — it fires before disperseBlob returns a Promise.
  const c = new DaClient();
  try {
    const oversized = new Uint8Array(MAX_BLOB_SIZE + 1);
    assert.throws(
      () => c.disperseBlob(oversized),
      /exceeds MAX_BLOB_SIZE/,
    );
  } finally {
    c.close();
  }
});

test('disperseBlob accepts exactly MAX_BLOB_SIZE without throwing the size guard', async () => {
  // At-threshold case: the cap is `> MAX_BLOB_SIZE`, not `>= MAX_BLOB_SIZE`.
  // A blob of exactly the limit must pass the guard. We don't actually
  // care that the subsequent gRPC call succeeds (it won't here — no
  // running DA client); we care that the rejection's reason is NOT
  // the size-guard error, but rather a connection error.
  const c = new DaClient({ endpoint: '127.0.0.1:1', timeoutMs: 100 });
  try {
    const exact = new Uint8Array(MAX_BLOB_SIZE);
    await assert.rejects(
      () => c.disperseBlob(exact),
      (err) => {
        // The error must NOT be the size-guard error (that would mean
        // we rejected at-limit by mistake). Any other error means the
        // size guard let it through to the gRPC layer.
        const msg = (err as Error).message;
        return !/exceeds MAX_BLOB_SIZE/.test(msg);
      },
    );
  } finally {
    c.close();
  }
});
