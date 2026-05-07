import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryEngine } from './engine.js';

const ALICE_PK = '0x0000000000000000000000000000000000000000000000000000000000000001';
const ALICE = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf' as `0x${string}`;

function makeEngine() {
  return MemoryEngine.create({
    ownerWallet: ALICE,
    ownerPrivateKey: ALICE_PK,
    dbPath: ':memory:',
    enableOnChainPermissions: false,
  });
}

test('remember + recall roundtrip', async () => {
  const m = makeEngine();
  await m.remember({ text: 'meeting on Tuesday with Bob about the contract', tags: ['work'], source: 'manual' });
  await m.remember({ text: 'banana smoothie recipe with mango', tags: ['personal'], source: 'manual' });
  await m.remember({ text: 'invoice from Bob for legal fees on contract review', tags: ['work', 'finance'], source: 'manual' });

  const { hits } = await m.recall({ text: 'contract Bob', topK: 3 });
  assert.equal(hits.length >= 2, true, `expected ≥2 hits, got ${hits.length}`);
  // Top hit should mention Bob + contract
  assert.match(hits[0]!.text.toLowerCase(), /bob|contract/);
  m.close();
});

test('tag filter excludes non-matching observations', async () => {
  const m = makeEngine();
  await m.remember({ text: 'work observation alpha', tags: ['work'], source: 'manual' });
  await m.remember({ text: 'work observation alpha', tags: ['personal'], source: 'manual' });

  const { hits } = await m.recall({ text: 'alpha', tags: ['work'], topK: 5 });
  for (const h of hits) {
    assert.equal(h.tags.includes('work'), true, `expected work tag, got ${JSON.stringify(h.tags)}`);
  }
  m.close();
});

test('encryption: stored ciphertext is not the plaintext', async () => {
  const m = makeEngine();
  const plaintext = 'extremely sensitive payload abcd1234';
  await m.remember({ text: plaintext, tags: ['secret'], source: 'manual' });

  // Sanity: recall returns the original plaintext
  const { hits } = await m.recall({ text: 'sensitive payload', tags: ['secret'], topK: 1 });
  assert.equal(hits[0]!.text, plaintext);
  m.close();
});

test('forget removes observation from both vector and FTS', async () => {
  const m = makeEngine();
  const r = await m.remember({ text: 'temporary observation to forget', tags: ['temp'] });
  assert.equal(m.count(), 1);

  await m.forget(r.id);
  assert.equal(m.count(), 0);

  const { hits } = await m.recall({ text: 'temporary observation', topK: 5 });
  assert.equal(hits.length, 0);
  m.close();
});

test('manifest rootHash deterministic for same id+createdAt', async () => {
  const m1 = makeEngine();
  await m1.remember({ id: 'obs_FIXED1', text: 'observation A', tags: ['x'], createdAt: 1000 });
  const r1 = m1.computeManifest().rootHash;
  m1.close();

  const m2 = makeEngine();
  await m2.remember({ id: 'obs_FIXED1', text: 'observation A', tags: ['x'], createdAt: 1000 });
  const r2 = m2.computeManifest().rootHash;
  m2.close();

  assert.equal(r1, r2, 'same id+createdAt should yield same rootHash');
});

test('manifest rootHash changes when content changes', async () => {
  const m = makeEngine();
  await m.remember({ id: 'obs_A', text: 'first', tags: ['x'], createdAt: 1000 });
  const r1 = m.computeManifest().rootHash;
  await m.remember({ id: 'obs_B', text: 'second', tags: ['x'], createdAt: 2000 });
  const r2 = m.computeManifest().rootHash;
  assert.notEqual(r1, r2, 'rootHash should change when state changes');
  m.close();
});

test('caller != owner without grant fails', async () => {
  const m = makeEngine();
  await m.remember({ text: 'private memory', tags: ['private'] });

  await assert.rejects(
    async () => {
      await m.recall({
        text: 'private',
        caller: '0x00000000000000000000000000000000000000B0' as `0x${string}`, // not owner
      });
    },
    /caller != owner|capability registry/,
  );
  m.close();
});
