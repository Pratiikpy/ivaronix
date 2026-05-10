/**
 * A.4.4 UI-layer regression · Studio Run panel + /r/[id] efficiency chip.
 *
 * Closes planning-003 §A.4.4 (UI slice). Asserts:
 *   1. RunPanel exposes the `audit` tier option (not just quick/standard/high-stakes).
 *   2. RunPanel exposes the "How strict?" override dropdown with
 *      AUTO/STRICT/BALANCED/LENIENT options.
 *   3. RunPanel ships the POLICY_LABEL_TO_NAME map so the wire format
 *      stays in sync with the canonical ConsensusPolicy enum.
 *   4. /api/run accepts the `policy` field on its body shape.
 *   5. runPipeline forwards the resolved policy to runConsensus.
 *   6. /r/[id] renders the EFFICIENCY chip when `policyApplied` is set.
 *
 * Pure source-file regression — no server needed.
 */
import { existsSync, readFileSync } from 'node:fs';
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
const read = (rel: string): string => {
  const p = resolve(REPO_ROOT, rel);
  if (!existsSync(p)) fail(`expected file missing: ${rel}`);
  return readFileSync(p, 'utf8');
};
const must = (s: string, needle: string | RegExp, label: string) => {
  const found = typeof needle === 'string' ? s.includes(needle) : needle.test(s);
  if (!found) fail(`${label} (missing: ${needle.toString().slice(0, 80)})`);
  ok(label);
};

// 1-3. Run panel surface.
const runPanel = read('apps/studio/src/components/RunPanel.tsx');
must(runPanel, /<option value="audit">Audit<\/option>/, 'RunPanel exposes audit tier option');
must(runPanel, /how strict\?/i, 'RunPanel renders "How strict?" label');
must(runPanel, /<option value="AUTO">/, 'RunPanel includes AUTO policy option');
must(runPanel, /<option value="STRICT">/, 'RunPanel includes STRICT policy option');
must(runPanel, /<option value="BALANCED">/, 'RunPanel includes BALANCED policy option');
must(runPanel, /<option value="LENIENT">/, 'RunPanel includes LENIENT policy option');
must(runPanel, /POLICY_LABEL_TO_NAME/, 'RunPanel exports POLICY_LABEL_TO_NAME map');
must(runPanel, /STRICT:\s*'unanimous'/, 'STRICT label maps to unanimous on the wire');
must(runPanel, /BALANCED:\s*'majority'/, 'BALANCED label maps to majority on the wire');
must(runPanel, /LENIENT:\s*'first-objection'/, 'LENIENT label maps to first-objection on the wire');
must(runPanel, /disabled=\{tier === 'quick'\}/, 'How-strict dropdown disabled for quick tier (1-reviewer policy is meaningless)');

// 4. API accepts policy field. Accepts either the legacy TS-interface
//    form `policy?: 'unanimous' | 'majority' | 'first-objection' |
//    'weighted'` OR the Zod-schema form `z.enum(['unanimous',
//    'majority', 'first-objection', 'weighted'])` (sweep 145 rewrote
//    RunBody as Zod for HALF_BAKED §J-2 closure).
const runRoute = read('apps/studio/src/app/api/run/route.ts');
const policyTsForm = /policy\?:\s*'unanimous'\s*\|\s*'majority'\s*\|\s*'first-objection'\s*\|\s*'weighted'/;
const policyZodForm = /z\.enum\(\s*\[\s*'unanimous'\s*,\s*'majority'\s*,\s*'first-objection'\s*,\s*'weighted'\s*\]\s*\)/;
if (!policyTsForm.test(runRoute) && !policyZodForm.test(runRoute)) {
  fail('RunBody declares the policy field with the canonical ConsensusPolicy enum (TS-interface or Zod-schema form)');
}
ok('RunBody declares the policy field with the canonical ConsensusPolicy enum (TS or Zod form)');
must(runRoute, /\.\.\.\(body\.policy\s*\?\s*\{\s*policy:\s*body\.policy\s*\}\s*:\s*\{\}\)/, 'run route forwards body.policy to runPipeline');

// 5. runPipeline resolves + forwards policy.
const pipeline = read('packages/runtime/src/pipeline.ts');
must(pipeline, /policy\?:\s*'unanimous'\s*\|\s*'majority'\s*\|\s*'first-objection'\s*\|\s*'weighted'/, 'PipelineInput.policy declared with the canonical enum');
must(pipeline, /skill\.manifest\.og\.consensus\.policy/, 'pipeline reads the skill manifest default policy');
must(pipeline, /resolvedPolicy/, 'pipeline computes a resolvedPolicy local');
must(pipeline, /policy:\s*resolvedPolicy/, 'pipeline forwards resolvedPolicy into runConsensus');

// 6. /r/[id] renders the efficiency chip.
const receiptPage = read('apps/studio/src/app/r/[id]/page.tsx');
must(receiptPage, /policyApplied/, '/r/[id] reads execution.consensus.policyApplied');
must(receiptPage, 'EFFICIENCY {efficiency}%', '/r/[id] renders EFFICIENCY <pct>% chip');
must(receiptPage, "dissents === 1 ? '' : 's'", '/r/[id] pluralises dissents correctly');

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
