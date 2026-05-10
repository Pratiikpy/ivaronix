/**
 * Regenerate the receipt-types table in `RECEIPTS_SPEC.md` from the
 * canonical `RECEIPT_TYPES` enum in `packages/core/src/types.ts`.
 *
 * Closes the docs-render half of planning-003 §A.2.7 (receipt-types
 * drift between RECEIPTS_SPEC §1 and the source enum). The receipt
 * types live in code; this script keeps the human-readable doc
 * consistent.
 *
 * Usage:
 *   pnpm tsx scripts/diag/render-receipt-types.ts
 *   pnpm receipt-types:check    (CI gate · throws if doc is out of sync)
 *
 * The script reads the source enum literally (regex-extract from the
 * `RECEIPT_TYPES = { ... }` block) so it never has to import a
 * compiled-aware module — keeps the script tsx-friendly with no
 * package boundary concerns.
 *
 * The table is bracketed by:
 *   <!-- AUTO:types:start -->
 *   <!-- AUTO:types:end -->
 *
 * Per-row "When created" descriptions live inline in the source enum
 * as `// comments`. The script preserves whatever description was
 * already in the doc when the enum slot existed at last render —
 * this way a copy-edit on the description doesn't get clobbered. New
 * enum slots get a placeholder description (`TODO describe trigger`)
 * that the operator fills in once.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SOURCE_PATH = resolve(REPO_ROOT, 'packages', 'core', 'src', 'types.ts');
const DOC_PATH = resolve(REPO_ROOT, 'RECEIPTS_SPEC.md');

const START_MARKER = '<!-- AUTO:types:start -->';
const END_MARKER = '<!-- AUTO:types:end -->';

interface ReceiptTypeRow {
  name: string;
  code: number;
  description: string;
}

function extractEnum(source: string): { name: string; code: number }[] {
  const block = source.match(/RECEIPT_TYPES\s*=\s*\{([\s\S]*?)\}\s*as\s*const/);
  if (!block) throw new Error('could not locate RECEIPT_TYPES block in types.ts');
  const body = block[1]!;
  const out: { name: string; code: number }[] = [];
  // Match `name: <number>,` lines, ignoring lines that look like comments.
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

function extractDocDescriptions(doc: string): Map<string, string> {
  const start = doc.indexOf(START_MARKER);
  const end = doc.indexOf(END_MARKER);
  if (start < 0 || end < 0) return new Map();
  const block = doc.slice(start + START_MARKER.length, end);
  const map = new Map<string, string>();
  for (const line of block.split('\n')) {
    const m = line.match(/^\|\s*`(\w+)`\s*\|\s*\d+\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) map.set(m[1]!, m[2]!);
  }
  return map;
}

function renderTable(rows: ReceiptTypeRow[]): string {
  const lines: string[] = [
    '',
    '| Type | Code | When created |',
    '|---|---|---|',
    ...rows.map((r) => `| \`${r.name}\` | ${r.code} | ${r.description} |`),
    '',
  ];
  return lines.join('\n');
}

function main(): void {
  const source = readFileSync(SOURCE_PATH, 'utf8');
  const doc = readFileSync(DOC_PATH, 'utf8');

  const sourceTypes = extractEnum(source);
  const docDescriptions = extractDocDescriptions(doc);

  const rows: ReceiptTypeRow[] = sourceTypes.map((t) => ({
    name: t.name,
    code: t.code,
    description: docDescriptions.get(t.name) ?? 'TODO describe trigger',
  }));

  const start = doc.indexOf(START_MARKER);
  const end = doc.indexOf(END_MARKER);
  if (start < 0 || end < 0) {
    throw new Error(`AUTO:types markers missing from ${DOC_PATH}`);
  }

  const before = doc.slice(0, start + START_MARKER.length);
  const after = doc.slice(end);
  const next = before + renderTable(rows) + after;

  if (process.argv.includes('--check')) {
    if (next !== doc) {
      console.error('RECEIPTS_SPEC.md receipt-types table is out of sync with packages/core/src/types.ts.');
      console.error(`Run \`pnpm receipt-types:render\` and commit the diff.`);
      process.exit(1);
    }
    console.log(`OK: ${rows.length} receipt types in sync.`);
    return;
  }

  if (next === doc) {
    console.log(`OK: ${rows.length} receipt types already in sync; nothing to write.`);
    return;
  }

  writeFileSync(DOC_PATH, next, 'utf8');
  console.log(`Wrote ${rows.length} receipt types to RECEIPTS_SPEC.md`);
}

main();
