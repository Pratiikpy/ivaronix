/**
 * QA · H-1 · attestationHash bound to chat ID via keccak256
 * QA · H-4 · memoryClient.store called after every anchor
 *
 * Asserts:
 *   1. pipeline.ts and doc.ts both compute attestationHash as
 *      keccak256(toUtf8Bytes(zgResKey)) when chat ID is present (was always
 *      zero before). Fallback to zero retained for the path where no chat
 *      ID exists (TIER 2 / NIM-routed runs).
 *   2. pipeline.ts calls memoryClient.store({...}) after a successful
 *      anchor when memoryClient + walletAddress + receiptId are all
 *      present. Best-effort, never throws.
 *   3. Both ethers imports include keccak256 + toUtf8Bytes.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('H-1 + H-4 · attestationHash + memory store after anchor');
  console.log('───────────────────────────────────────────────────────────────');

  // ─── 1. Imports ────────────────────────────────────────────────────────
  const pipelinePath = resolve(REPO, 'packages/runtime/src/pipeline.ts');
  const pipeline = readFileSync(pipelinePath, 'utf8');
  const docPath = resolve(REPO, 'apps/cli/src/commands/doc.ts');
  const doc = readFileSync(docPath, 'utf8');

  assert.ok(
    /import\s*\{[^}]*keccak256[^}]*toUtf8Bytes[^}]*\}\s*from\s*'ethers'/m.test(pipeline),
    'pipeline.ts: ethers import must include keccak256 + toUtf8Bytes',
  );
  assert.ok(
    /import\s*\{[^}]*keccak256[^}]*toUtf8Bytes[^}]*\}\s*from\s*'ethers'/m.test(doc),
    'doc.ts: ethers import must include keccak256 + toUtf8Bytes',
  );
  console.log('   ethers imports include keccak256 + toUtf8Bytes');

  // ─── 2. attestationHash computation ────────────────────────────────────
  // pipeline.ts: x.zgResKey ? keccak256(toUtf8Bytes(x.zgResKey)) : zero
  assert.ok(
    /x\.zgResKey\s*\?\s*keccak256\(toUtf8Bytes\(x\.zgResKey\)\)\s*:\s*\(?\s*'0x'\s*\+\s*'0'\.repeat\(64\)/m.test(pipeline),
    'pipeline.ts: attestationHash must be keccak256(toUtf8Bytes(x.zgResKey)) when chat ID present',
  );
  console.log('   pipeline.ts binds attestationHash to chat ID via keccak256');

  // doc.ts: a.zgResKey ? keccak256(toUtf8Bytes(a.zgResKey)) : zero
  assert.ok(
    /a\.zgResKey\s*\?\s*keccak256\(toUtf8Bytes\(a\.zgResKey\)\)\s*:\s*\(?\s*'0x'\s*\+\s*'0'\.repeat\(64\)/m.test(doc),
    'doc.ts: attestationHash must be keccak256(toUtf8Bytes(a.zgResKey)) when chat ID present',
  );
  console.log('   doc.ts binds attestationHash to chat ID via keccak256');

  // ─── 3. memoryClient.store call after anchor ───────────────────────────
  // The pipeline must call memoryClient.store({ group_id, user_id, type:
  // 'episodic_memory', ... }) after the anchor result is captured.
  assert.ok(
    /memoryClient\.store\(\s*\{[\s\S]*?group_id:\s*skill\.id[\s\S]*?user_id:\s*env\.walletAddress[\s\S]*?type:\s*'episodic_memory'/m.test(pipeline),
    'pipeline.ts: must call memoryClient.store({ group_id: skill.id, user_id: env.walletAddress, type: \'episodic_memory\', ... })',
  );
  console.log('   pipeline.ts calls memoryClient.store after anchor');

  // The store call is gated on memoryClient + env.walletAddress + receiptId.
  assert.ok(
    /if\s*\(memoryClient\s*&&\s*env\.walletAddress\s*&&\s*receiptId\)/m.test(pipeline),
    'pipeline.ts: memory store must be gated on memoryClient + walletAddress + receiptId',
  );
  console.log('   memory store is gated on opt-in env (ZG_MEMORY_URL) + wallet + receipt');

  // The metadata block carries receiptId, tier, anchorTxHash.
  assert.ok(
    /metadata:\s*\{[\s\S]*?receiptId[\s\S]*?tier[\s\S]*?anchorTxHash/m.test(pipeline),
    'pipeline.ts: memory metadata must carry receiptId, tier, anchorTxHash',
  );
  console.log('   memory metadata carries receiptId + tier + anchorTxHash');

  console.log('───────────────────────────────────────────────────────────────');
  console.log('H-1 + H-4 verified (source-file regression)');
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
