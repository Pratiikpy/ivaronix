/**
 * Studio runtime pipeline MUST attempt 0G Storage upload before
 * anchoring the receipt. HALF_BAKED §H-3 closure lock (sweep 218).
 *
 * Pre-fix state: `packages/runtime/src/pipeline.ts` never called
 * `createStorageClient`. Every Studio /api/run receipt landed on
 * chain with `storage.evidenceRoot` absent, while RunPanel's
 * Storage light was hard-coded to show pending forever. The CLI
 * `doc ask` path had the upload wired since planning-002 B-1;
 * the Studio runtime path was the gap.
 *
 * Shipped wiring this regression locks:
 *   - import { createStorageClient } from '@ivaronix/og-storage'
 *   - `sc.upload(evidenceBytes)` call site inside anchorReceipt
 *   - `evidenceRoot` field threaded into the receipt body's storage
 *     block (spread-conditional so absent on upload failure)
 *   - `runStorageEvidenceRoot` bubble-up from anchorReceipt's return
 *     to `PipelineOutput.storageEvidenceRoot`
 *   - HALF_BAKED §H-3 citation comment for future readers
 *
 * Pure source-file regression.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

const pipelinePath = resolve(REPO_ROOT, 'packages', 'runtime', 'src', 'pipeline.ts');
const src = readFileSync(pipelinePath, 'utf8');
ok(`loaded ${pipelinePath}`);

const wiring = [
  {
    label: 'createStorageClient import',
    pattern: /createStorageClient\s*[,}]/,
    miss: 'pipeline.ts must import createStorageClient from @ivaronix/og-storage (sweep 218 wiring)',
  },
  {
    label: 'sc.upload(evidenceBytes) call',
    pattern: /\bsc\.upload\s*\(\s*evidenceBytes\b/,
    miss: 'pipeline.ts anchorReceipt must call sc.upload(evidenceBytes) before signing the receipt (§H-3 closure)',
  },
  {
    label: 'evidenceRoot spread into storage block',
    pattern: /\.\.\.\s*\(\s*evidenceRoot\s*\?\s*\{\s*evidenceRoot\s*\}/,
    miss: 'pipeline.ts must spread `evidenceRoot` into the receipt storage block only on successful upload (honest absence on failure)',
  },
  {
    label: 'runStorageEvidenceRoot bubble-up',
    pattern: /runStorageEvidenceRoot\s*=\s*result\.evidenceRoot/,
    miss: 'pipeline.ts must capture anchorReceipt result.evidenceRoot into runStorageEvidenceRoot for PipelineOutput',
  },
  {
    label: 'storageEvidenceRoot returned from runPipeline',
    pattern: /storageEvidenceRoot\s*:\s*runStorageEvidenceRoot/,
    miss: 'PipelineOutput.storageEvidenceRoot must read runStorageEvidenceRoot (not hardcoded null)',
  },
];

for (const w of wiring) {
  if (!w.pattern.test(src)) {
    fail(`${w.miss} · pattern ${w.pattern} did not match in packages/runtime/src/pipeline.ts`);
  }
  ok(`${w.label} present`);
}

if (!/HALF_BAKED §H-3/.test(src) && !/HALF_BAKED \xa7H-3/.test(src)) {
  fail('pipeline.ts must reference "HALF_BAKED §H-3" near the upload block (sweep 218 closure citation)');
}
ok('HALF_BAKED §H-3 citation present in pipeline.ts');

// Anti-regression: the OLD hardcoded `storageEvidenceRoot: null` shape
// should be gone. Catches a future revert that re-introduces the bug.
if (/storageEvidenceRoot\s*:\s*null\s*,/.test(src)) {
  fail('pipeline.ts still hardcodes `storageEvidenceRoot: null` somewhere — the §H-3 fix bubbles the real upload result instead');
}
ok('no hardcoded `storageEvidenceRoot: null` in pipeline.ts');

console.log(`\n[verify-pipeline-storage-upload] ${asserts} assertions passed`);
