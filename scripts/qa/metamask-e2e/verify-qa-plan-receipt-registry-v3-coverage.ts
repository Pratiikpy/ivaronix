/**
 * iter-130 closure regression for QA plan ReceiptRegistry V3-coverage drift.
 *
 * iter-128/129 caught literal PENDING + future-tense drift. iter-130
 * catches a fifth dimension: ReceiptRegistry-read descriptions that
 * say "V2-first" or list "V1 OR V2" addresses when the actual
 * read path is V3-first (V3 -> V2 -> V1 fallback) per iter-114 +
 * iter-119 + iter-120 cascade.
 *
 * Forbidden phrasings (each implies V3 is excluded from the read path):
 *   - "Studio reads V2 first" / "Studio reads ReceiptRegistryV2 first"
 *   - "reads V2 first, V1 fallback"
 *   - "V2-first chain client" / "V2-first read fallback"
 *   - "V2-first to V1 fallback" / "V2-first then V1"
 *   - "ReceiptRegistry V1 OR ReceiptRegistryV2"
 *
 * Allow-marker: qa-plan-v3-receipt-allow:<reason> on the same line.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const QA_PLAN = resolve(REPO_ROOT, 'Ivaronix_User_QA_Test_Plan.md');

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

const FORBIDDEN_PHRASES = [
  /Studio reads ReceiptRegistryV2 first/i,
  /Studio reads V2 first/i,
  /reads V2 first,?\s*V1 fallback/i,
  /V2[- ]first chain client/i,
  /V2[- ]first read fallback/i,
  /V2[- ]first.{0,40}V1 fallback/i,
  /ReceiptRegistry V1 OR ReceiptRegistryV2/i,
];

const qaSrc = readFileSync(QA_PLAN, 'utf8');
const lines = qaSrc.split(/\r?\n/);

const violations: { line: number; phrase: string; snippet: string }[] = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]!;
  if (/qa-plan-v3-receipt-allow:/.test(line)) continue;
  for (const re of FORBIDDEN_PHRASES) {
    const mm = re.exec(line);
    if (mm) {
      violations.push({
        line: i + 1,
        phrase: mm[0]!,
        snippet: line.slice(0, 160) + (line.length > 160 ? '...' : ''),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} ReceiptRegistry V3-coverage drift(s) in QA plan:`);
  for (const v of violations) {
    console.error(`  line ${v.line}: matched "${v.phrase}"`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\nReceiptRegistry reads are V3-first (slots 10/11/12 require V3 per B-V2-32)`);
  console.error(`then V2 (slots 0-9) then V1 legacy. Studio destructure regression at`);
  console.error(`verify-v3-aware-registry-destructure.ts locks the code-side; this regression`);
  console.error(`locks the plan-side description. If a phrase is intentional, add`);
  console.error(`qa-plan-v3-receipt-allow:<reason> on the same line.`);
  process.exit(1);
}

ok(`no ReceiptRegistry V2-first phrasing left in QA plan (V3-first since iter-119)`);
console.log(`\n[verify-qa-plan-receipt-registry-v3-coverage] ${asserts}/1 assertions passed`);
