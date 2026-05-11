/**
 * Every "✅ <STATUS>" header in `docs/HALF_BAKED.md` must carry a
 * verifiable citation: a commit sha, a sweep number, an ISO date, an
 * on-chain address, or an explicit verification phrase.
 *
 * Class this gates against (sweeps 165-201 missed, sweep 202 caught
 * manually): a bug fix ships in code with a commit message that cites
 * the HALF_BAKED entry, but the entry's header in HALF_BAKED.md is
 * never updated to reflect the closure. The entry sits as "severity A"
 * forever even though the fix landed weeks earlier. Judges read the
 * doc as "8 open severity-A bugs" when the truth is "8 closed bugs
 * with stale doc text."
 *
 * Sweep 202 manually caught and closed 8 such entries (I-10, I-13,
 * I-14, I-15, I-16, I-17, I-19, I-20). This regression makes the
 * closure-citation rule structural so the next wave of fixes can't
 * accumulate the same doc debt.
 *
 * The opposite drift class (header says ✅ CLOSED but the cited
 * code no longer matches) is harder to detect statically — that
 * would require parsing the cited file:line. Out of scope here.
 *
 * Acceptable citation forms (any one is sufficient):
 *   - bare or backticked commit sha (>= 7 hex chars)
 *   - "sweep N" where N is a number
 *   - ISO date YYYY-MM-DD in the header
 *   - on-chain "address 0x..." (for DEPLOYED entries)
 *   - explicit verification phrase: "file exists", "build passes",
 *     "tests pass", "verified" (for VERIFIED entries that prove via
 *     a stand-alone check rather than a fix commit)
 *
 * Pure source-file regression — no runtime.
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

// Match any header line carrying a closure marker. The marker word can
// be CLOSED / FIXED / SHIPPED / DEPLOYED / VERIFIED / CODE-COMPLETE.
// We require the marker to appear AFTER a `✅` so half-bakeds carrying
// `⚠ PARTIALLY CLOSED` (a deliberately-partial state — see §I-12) are
// scoped out: partial closures get their own audit shape (a body bullet
// per half), not a header citation.
const closedHeaderRe = /^###\s+.*✅\s+(CLOSED|FIXED|SHIPPED|DEPLOYED|VERIFIED|CODE-COMPLETE)\b/;

// Citation patterns — any one of these in the header line counts as
// a real citation.
const citationPatterns = [
  { name: 'commit sha (7+ hex)', re: /\b[0-9a-f]{7,40}\b/i },
  { name: 'sweep N', re: /\bsweeps?\s+\d+/i }, // accepts "sweep 200" and "sweeps 145-150" (range across multiple sweeps)
  { name: 'ISO date', re: /\b20\d{2}-\d{2}-\d{2}\b/ },
  { name: 'address 0x...', re: /\baddress\s+`?0x[0-9a-fA-F]{6,}/i },
  { name: 'verification phrase', re: /\b(file exists|build passes|tests? pass|verified)\b/i },
];

interface ScanResult {
  relPath: string;
  closedCount: number;
  violations: { line: number; header: string }[];
  cited: Record<string, number>;
}

/**
 * Scan a doc for `### ... ✅ <STATUS>` headers and check each carries
 * a verifiable citation. Same rule applies whether the file is the
 * audit log (HALF_BAKED.md) or a judge-facing disclosure
 * (PHASE_B_DISCLOSURES.md, sweep 223 extension).
 */
function scanDocForClosureCitations(relPath: string): ScanResult {
  const fullPath = resolve(REPO_ROOT, relPath);
  const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/);
  const result: ScanResult = { relPath, closedCount: 0, violations: [], cited: {} };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (!closedHeaderRe.test(line)) continue;
    result.closedCount += 1;
    let matched: string | null = null;
    for (const p of citationPatterns) {
      if (p.re.test(line)) { matched = p.name; break; }
    }
    if (matched === null) {
      result.violations.push({ line: i + 1, header: line });
    } else {
      result.cited[matched] = (result.cited[matched] ?? 0) + 1;
    }
  }
  return result;
}

// Sweep 223 extension: PHASE_B_DISCLOSURES.md is the judge-facing
// counterpart to HALF_BAKED — same drift class (fix ships, doc forgets)
// applies. Same rule too: any ✅ closure marker must cite a verifiable
// artefact so readers can audit the closure.
const docs = ['docs/HALF_BAKED.md', 'docs/PHASE_B_DISCLOSURES.md'];
const results = docs.map(scanDocForClosureCitations);

for (const r of results) {
  ok(`scanned ${r.closedCount} ✅ <STATUS> headers in ${r.relPath}`);
}

const allViolations = results.flatMap((r) =>
  r.violations.map((v) => ({ ...v, relPath: r.relPath })),
);

if (allViolations.length > 0) {
  console.error('');
  console.error(`FAIL: ${allViolations.length} closed entry header(s) lack a verifiable citation:`);
  for (const v of allViolations) {
    console.error(`  ${v.relPath}:${v.line}`);
    console.error(`    ${v.header}`);
  }
  console.error('');
  console.error('Fix: append one of:');
  console.error('  - a commit sha (`42005a9`)');
  console.error('  - `sweep N` reference (`sweep 202`)');
  console.error('  - ISO date (`2026-05-10`)');
  console.error('  - on-chain address (for DEPLOYED entries)');
  console.error('  - verification phrase (`file exists; build passes`) for VERIFIED entries');
  process.exit(1);
}

ok(`every closed entry across ${docs.length} docs cites at least one verifiable artefact`);

// Aggregate citation-form breakdown for the report.
const aggregateCited: Record<string, number> = {};
for (const r of results) {
  for (const [name, count] of Object.entries(r.cited)) {
    aggregateCited[name] = (aggregateCited[name] ?? 0) + count;
  }
}
for (const [name, count] of Object.entries(aggregateCited).sort()) {
  ok(`citation form "${name}" used by ${count} entries`);
}

console.log(`\n[verify-half-baked-closure-citations] ${asserts} assertions passed`);
