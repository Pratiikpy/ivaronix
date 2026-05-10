// Three-way regression: receipt types stay in sync across
//   1. Source enum: packages/core/src/types.ts RECEIPT_TYPES
//   2. Doc table:   RECEIPTS_SPEC.md AUTO:types section
//   3. Numbers:     docs/numbers.json receiptTypes.{count,labels}
//
// Why this exists:
//   pnpm receipt-types:check already verifies (1) <-> (2). If someone
//   adds a new receipt type to types.ts and runs receipt-types:render,
//   the spec stays in sync but numbers.json drifts until the operator
//   also runs pnpm numbers:refresh. The previous sweep (sweep 36)
//   showed how three-way drifts hide better than two-way: a partial
//   match on any pair lets the gap survive.
//
//   This regression closes the third leg of the triangle.
//
// Run: pnpm tsx scripts/qa/metamask-e2e/verify-receipt-types-three-way.ts
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

// ─── Source: extract RECEIPT_TYPES from types.ts ──────────────────────
function extractSourceEnum(): { name: string; code: number }[] {
  const path = resolve(REPO_ROOT, 'packages', 'core', 'src', 'types.ts');
  const source = readFileSync(path, 'utf8');
  const block = source.match(/RECEIPT_TYPES\s*=\s*\{([\s\S]*?)\}\s*as\s*const/);
  if (!block) fail('could not locate RECEIPT_TYPES block in types.ts');
  const body = block[1]!;
  const out: { name: string; code: number }[] = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    const m = trimmed.match(/^(\w+):\s*(\d+)\s*,?$/);
    if (!m) continue;
    out.push({ name: m[1]!, code: Number(m[2]!) });
  }
  out.sort((a, b) => a.code - b.code);
  return out;
}

// ─── Doc: extract AUTO:types table rows from RECEIPTS_SPEC.md ─────────
function extractSpecTable(): { name: string; code: number }[] {
  const path = resolve(REPO_ROOT, 'RECEIPTS_SPEC.md');
  const doc = readFileSync(path, 'utf8');
  const start = doc.indexOf('<!-- AUTO:types:start -->');
  const end = doc.indexOf('<!-- AUTO:types:end -->');
  if (start < 0 || end < 0) fail('AUTO:types markers missing from RECEIPTS_SPEC.md');
  const block = doc.slice(start, end);
  const out: { name: string; code: number }[] = [];
  for (const line of block.split('\n')) {
    const m = line.match(/^\|\s*`(\w+)`\s*\|\s*(\d+)\s*\|/);
    if (m) out.push({ name: m[1]!, code: Number(m[2]!) });
  }
  out.sort((a, b) => a.code - b.code);
  return out;
}

// ─── Numbers: extract receiptTypes.labels + count from numbers.json ──
function extractNumbers(): { count: number; labels: string[] } {
  const path = resolve(REPO_ROOT, 'docs', 'numbers.json');
  const json = JSON.parse(readFileSync(path, 'utf8')) as {
    receiptTypes: { count: number; labels: string[] };
  };
  return json.receiptTypes;
}

const source = extractSourceEnum();
const spec = extractSpecTable();
const numbers = extractNumbers();

ok(`source enum: ${source.length} types extracted from types.ts`);
ok(`spec table: ${spec.length} rows in RECEIPTS_SPEC.md AUTO:types`);
ok(`numbers.json: ${numbers.count} count, ${numbers.labels.length} labels`);

// ─── Check 1: count parity across all three ────────────────────────────
if (source.length !== spec.length) {
  fail(
    `count mismatch · source enum has ${source.length} types, spec table has ${spec.length} · ` +
    `run pnpm receipt-types:render`,
  );
}
if (source.length !== numbers.count) {
  fail(
    `count mismatch · source enum has ${source.length} types, numbers.json count=${numbers.count} · ` +
    `run pnpm numbers:refresh`,
  );
}
if (numbers.count !== numbers.labels.length) {
  fail(
    `numbers.json self-inconsistency · count=${numbers.count} but labels.length=${numbers.labels.length} · ` +
    `run pnpm numbers:refresh`,
  );
}
ok(`count parity: all three sources agree on ${source.length} types`);

// ─── Check 2: name+code parity (source vs spec) ────────────────────────
for (let i = 0; i < source.length; i++) {
  const s = source[i]!;
  const d = spec[i]!;
  if (s.name !== d.name || s.code !== d.code) {
    fail(
      `source ↔ spec mismatch at index ${i} · ` +
      `source=${s.name}(${s.code}) spec=${d.name}(${d.code}) · ` +
      `run pnpm receipt-types:render`,
    );
  }
}
ok(`source ↔ spec: every (name, code) pair matches across ${source.length} entries`);

// ─── Check 3: name+order parity (source vs numbers) ───────────────────
// numbers.json stores labels in source-enum order (not sorted alphabetically).
// Per the parseReceiptTypes() function in numbers-refresh.ts, labels are
// extracted in source-encounter order, which means the array order
// matches the integer codes 0..N-1.
for (let i = 0; i < source.length; i++) {
  const expected = source[i]!.name;
  const actual = numbers.labels[i];
  if (expected !== actual) {
    fail(
      `source ↔ numbers labels mismatch at index ${i} · ` +
      `source[${i}]=${expected} numbers.labels[${i}]=${actual} · ` +
      `run pnpm numbers:refresh`,
    );
  }
}
ok(`source ↔ numbers labels: every label at every index matches`);

// ─── Check 4: code monotonicity (defense-in-depth) ────────────────────
// Receipt-type codes must be 0..N-1 contiguous. A gap (e.g. 0,1,3,4)
// would mean an enum value was deleted; the index-based label array
// in numbers.json couldn't represent that without ambiguity.
for (let i = 0; i < source.length; i++) {
  if (source[i]!.code !== i) {
    fail(
      `source enum has non-contiguous codes · index ${i} has code ${source[i]!.code} · ` +
      `if a type was deprecated, mark it explicitly rather than removing the slot`,
    );
  }
}
ok(`source enum codes are contiguous 0..${source.length - 1}`);

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
