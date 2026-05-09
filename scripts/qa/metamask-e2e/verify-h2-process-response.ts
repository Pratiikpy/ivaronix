/**
 * QA · H-2 · `processResponse` third argument (content).
 *
 * The 0G Compute SDK's `broker.inference.processResponse` takes three args:
 * `(providerAddress, chatId, content)`. The 3-arg form verifies the response
 * content corresponds to the billed chat ID. The 2-arg form only verifies
 * the chat ID was billed. Provus and AIsphere both pass the third argument
 * inline at inference time; we match that depth on offline verify.
 *
 * Asserts:
 *   1. Receipt schema's `ConsensusRoleAttestation` declares an optional
 *      `content` field.
 *   2. Both pipeline build sites (runtime + CLI doc) populate `content`
 *      from `consensus.reviewerOutputs` / `consensus.judgement`.
 *   3. CLI `receipt verify --tee-independent` passes content as the third
 *      argument when present, falls back to 2-arg with a warning when
 *      missing (legacy receipts pre-dating H-2).
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('H-2 · processResponse third argument (content)');
  console.log('───────────────────────────────────────────────────────────────');

  // ─── 1. Schema ─────────────────────────────────────────────────────────
  const schemaPath = resolve(REPO, 'packages/receipts/src/schema.ts');
  const schema = readFileSync(schemaPath, 'utf8');
  const attMatch = schema.match(/ConsensusRoleAttestation\s*=\s*z\.object\(\{([\s\S]*?)\}\)/m);
  assert.ok(attMatch, 'expected ConsensusRoleAttestation in schema.ts');
  assert.ok(
    /content:\s*z\.string\(\)\.optional\(\)/m.test(attMatch[1]),
    'schema.ts: ConsensusRoleAttestation must declare optional `content` field',
  );
  console.log('   schema declares optional content on ConsensusRoleAttestation');

  // ─── 2. Pipeline build sites ───────────────────────────────────────────
  const pipelinePath = resolve(REPO, 'packages/runtime/src/pipeline.ts');
  const pipeline = readFileSync(pipelinePath, 'utf8');
  // Look for the consensus-block builder that maps over `consensus.attestations`.
  // It must include `content: roleContent.get(...)` in the mapped object.
  assert.ok(
    /individualAttestations:\s*consensus\.attestations[\s\S]*?content:\s*roleContent\.get/m.test(pipeline),
    'pipeline.ts: individualAttestations builder must populate content from roleContent map',
  );
  console.log('   pipeline.ts populates content per role');

  const docPath = resolve(REPO, 'apps/cli/src/commands/doc.ts');
  const doc = readFileSync(docPath, 'utf8');
  assert.ok(
    /individualAttestations:\s*consensusResult\.attestations[\s\S]*?content:\s*roleContent\.get/m.test(doc),
    'apps/cli/src/commands/doc.ts: individualAttestations builder must populate content from roleContent map',
  );
  console.log('   doc.ts populates content per role');

  // ─── 3. CLI receipt verify uses 3-arg form when content present ────────
  const receiptCmdPath = resolve(REPO, 'apps/cli/src/commands/receipt.ts');
  const receiptCmd = readFileSync(receiptCmdPath, 'utf8');
  assert.ok(
    /type Att\s*=\s*\{[^}]*content\?:\s*string/m.test(receiptCmd),
    'receipt.ts: Att type must include content?: string',
  );
  assert.ok(
    /broker\.inference\.processResponse\(\s*att\.providerAddress\s*,\s*att\.chatId\s*,\s*att\.content\s*\)/m.test(receiptCmd),
    'receipt.ts: must call processResponse with 3 args when content present',
  );
  assert.ok(
    /broker\.inference\.processResponse\(\s*att\.providerAddress\s*,\s*att\.chatId\s*\)/m.test(receiptCmd),
    'receipt.ts: must retain 2-arg fallback for legacy receipts (with warning)',
  );
  assert.ok(
    /hasContent\s*=\s*typeof\s+att\.content\s*===\s*'string'/m.test(receiptCmd),
    'receipt.ts: branch gating on hasContent must check att.content is a non-empty string',
  );
  console.log('   receipt.ts conditionally passes 3rd arg, falls back honestly');

  console.log('───────────────────────────────────────────────────────────────');
  console.log('H-2 verified (source-file regression)');
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
