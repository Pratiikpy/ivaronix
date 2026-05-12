/**
 * B-V2-35 closure regression · every type in RECEIPT_TYPES has a producer.
 *
 * Iter-96 audit surfaced a "catalog overclaims" gap: 5 of 13 declared
 * receipt types in `packages/core/src/types.ts` `RECEIPT_TYPES` had
 * zero producers anywhere in shipped code. iter-96 → iter-100 closed
 * all 5 orphan slots. This regression locks the closure in place —
 * if a future commit adds a new receipt type to RECEIPT_TYPES without
 * also wiring a producer, this test fails.
 *
 * Definition of "producer": a TypeScript source file in apps/ or
 * packages/ that contains one of these literal patterns:
 *
 *   type: '<name>'              (buildReceipt input shape)
 *   receiptType: '<name>'       (pipeline input shape)
 *   type:'<name>'               (no-space variant)
 *   receiptType:'<name>'        (no-space variant)
 *
 * Test files (*.test.ts, tests/**) and example/fixture files are
 * excluded so test-only types don't false-pass.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

const TYPES_SRC = resolve(REPO_ROOT, 'packages/core/src/types.ts');
const typesSrc = readFileSync(TYPES_SRC, 'utf8');
const TYPES_BLOCK_RE = /export const RECEIPT_TYPES = \{([\s\S]*?)\} as const;/;
const blockMatch = typesSrc.match(TYPES_BLOCK_RE);
if (!blockMatch || !blockMatch[1]) fail(`could not find RECEIPT_TYPES block in ${TYPES_SRC}`);
const block = blockMatch![1]!;
const TYPE_RE = /^\s*([a-z_]+):\s*(\d+),/gm;
const canonicalTypes: { name: string; slot: number }[] = [];
let m: RegExpExecArray | null;
while ((m = TYPE_RE.exec(block)) !== null) {
  canonicalTypes.push({ name: m[1]!, slot: Number(m[2]!) });
}
if (canonicalTypes.length === 0) fail(`parsed 0 receipt types from RECEIPT_TYPES — regex broke?`);
ok(`parsed ${canonicalTypes.length} canonical receipt types from RECEIPT_TYPES`);

const SCAN_DIRS = [resolve(REPO_ROOT, 'apps'), resolve(REPO_ROOT, 'packages')];
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'out',
  'tests',
  '__tests__',
  '_archive',
]);
const SKIP_FILE_SUFFIXES = ['.test.ts', '.spec.ts', '.test.tsx'];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (stat.isFile()) {
      if (SKIP_FILE_SUFFIXES.some((s) => entry.endsWith(s))) continue;
      if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(path);
    }
  }
  return out;
}

const tsFiles: string[] = [];
for (const d of SCAN_DIRS) tsFiles.push(...listTsFiles(d));
ok(`scanned ${tsFiles.length} TypeScript source files (test/fixture files excluded)`);

// Producer-detection regex set. We treat a file as a producer of <name> if
// it contains any of these literal patterns:
//
//   type: '<name>' / type:'<name>'           buildReceipt input shape
//   receiptType: '<name>' / receiptType:'<name>'  pipeline input shape
//   ? '<name>' / ?'<name>'                   ternary branch (multi-line)
//   : '<name>'  (start of line)              ternary branch (multi-line · else)
//   = '<name>'                                assignment shape (let r = 'name')
//
// The last three handle the case where the receipt-type literal is a
// ternary branch on its own line, separated from `type:` by newlines.
// doc.ts uses this shape for the burn/skill_exec/doc_ask/consensus
// selector; without the broader patterns the regression false-fails.
const producerPatterns = (name: string): RegExp[] => [
  new RegExp(`type:\\s*'${name}'`),
  new RegExp(`receiptType:\\s*'${name}'`),
  new RegExp(`\\?\\s*'${name}'`),
  new RegExp(`^\\s*:\\s*'${name}'`, 'm'),
  new RegExp(`=\\s*'${name}'`),
];

const missing: string[] = [];
const producerCounts = new Map<string, number>();
for (const t of canonicalTypes) {
  const patterns = producerPatterns(t.name);
  let count = 0;
  for (const f of tsFiles) {
    let src: string;
    try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const p of patterns) {
      if (p.test(src)) {
        count += 1;
        break;
      }
    }
  }
  producerCounts.set(t.name, count);
  if (count === 0) missing.push(`${t.name} (slot ${t.slot})`);
}

for (const t of canonicalTypes) {
  const count = producerCounts.get(t.name) ?? 0;
  if (count > 0) {
    console.log(`  ok slot ${String(t.slot).padStart(2)} · ${t.name.padEnd(28)} · ${count} producer file(s)`);
  } else {
    console.log(`  XX slot ${String(t.slot).padStart(2)} · ${t.name.padEnd(28)} · NO PRODUCER`);
  }
}

if (missing.length > 0) {
  console.log();
  fail(
    `${missing.length} of ${canonicalTypes.length} receipt types in RECEIPT_TYPES have no producer:\n` +
      `  ${missing.join('\n  ')}\n` +
      `\nFix: add a CLI command or pipeline path that produces a receipt with\n` +
      `that type literal. See USER_TODO §B-V2-35 for the closure pattern.`,
  );
}

ok(`every receipt type in RECEIPT_TYPES has at least 1 producer · B-V2-35 closure locked`);
console.log(`\n[verify-receipt-types-have-producers] ${asserts}/3 assertions passed`);
