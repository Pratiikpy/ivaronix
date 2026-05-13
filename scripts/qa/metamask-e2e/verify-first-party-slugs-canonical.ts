/**
 * Regression · FIRST_PARTY_SLUGS canonical source-of-truth gate.
 *
 * Closes the recurring drift pattern surfaced 2026-05-14: the 6
 * first-party skill slugs were inlined in 4 places with subtle
 * differences. apps/studio/src/lib/subgraph.ts had 2 phantom names
 * ('lawyer-clean', 'finance-watchdog') and was missing 2 real ones
 * ('plan-step', 'code-edit'), so /marketplace silently dropped them
 * from the listing.
 *
 * Consolidated in a252af5 — apps/studio/src/lib/first-party-skills.ts
 * is now the canonical source. This regression fails if any other
 * file (outside the canonical module) inlines an array literal
 * containing 3+ first-party slug names together, which is the
 * fingerprint of a drift-prone redeclaration.
 *
 * Allowed: importing FIRST_PARTY_SLUGS from the canonical module,
 * references to individual slugs in copy/strings/test fixtures.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CANONICAL = resolve(REPO_ROOT, 'apps/studio/src/lib/first-party-skills.ts');
const STUDIO_SRC = resolve(REPO_ROOT, 'apps/studio/src');

const FIRST_PARTY_SLUGS = [
  '0g-integration-auditor',
  'code-edit',
  'content-pitch-review',
  'github-audit',
  'plan-step',
  'private-doc-review',
];

let failures = 0;
function fail(msg: string): void {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    const full = resolve(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, files);
    else if (st.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) files.push(full);
  }
  return files;
}

// 1. Canonical module exists + exports the expected set.
if (!existsSync(CANONICAL)) {
  fail(`Canonical module missing: ${CANONICAL}`);
} else {
  const canonText = readFileSync(CANONICAL, 'utf8');
  for (const slug of FIRST_PARTY_SLUGS) {
    if (!canonText.includes(`'${slug}'`)) {
      fail(`Canonical module ${CANONICAL} is missing slug '${slug}'`);
    }
  }
  // Phantom-slug guard — these never had SKILL.md on disk
  for (const phantom of ['lawyer-clean', 'finance-watchdog']) {
    if (canonText.includes(`'${phantom}'`)) {
      fail(`Canonical module references phantom slug '${phantom}' (no SKILL.md on disk)`);
    }
  }
}

// 2. No OTHER file inlines 3+ canonical slugs in an array literal,
//    UNLESS it already imports from @/lib/first-party-skills (then we
//    trust it — partial mappings like RunPanel's STANDARD_TIER_SLUGS
//    are deliberate per-tier classifications, not first-party drift).
// Match patterns like `['slug1', 'slug2', 'slug3']` or `[\n  'slug1',\n  'slug2',\n  ...]`.
const files = walk(STUDIO_SRC);
for (const file of files) {
  if (file === CANONICAL) continue;
  const text = readFileSync(file, 'utf8');
  if (/from\s+['"]@\/lib\/first-party-skills['"]/.test(text)) {
    // File explicitly opted in to the canonical module — trust it
    continue;
  }
  // Find array-literal contexts and count canonical slugs inside each.
  // Heuristic: scan for `[` opening, walk forward up to ~600 chars or until matching `]`,
  // count how many canonical slugs appear inside that span.
  let pos = 0;
  while (pos < text.length) {
    const open = text.indexOf('[', pos);
    if (open === -1) break;
    const close = text.indexOf(']', open);
    if (close === -1) break;
    if (close - open > 1000) { pos = close + 1; continue; } // too wide, probably not a slug array
    const span = text.slice(open, close + 1);
    const hits = FIRST_PARTY_SLUGS.filter((slug) => span.includes(`'${slug}'`) || span.includes(`"${slug}"`));
    if (hits.length >= 3) {
      const rel = file.replace(REPO_ROOT, '').replace(/\\/g, '/');
      fail(`${rel}: array literal contains ${hits.length} first-party slugs (${hits.join(', ')}). Import FIRST_PARTY_SLUGS from @/lib/first-party-skills instead.`);
    }
    pos = close + 1;
  }
}

if (failures === 0) {
  console.log(`PASS: FIRST_PARTY_SLUGS canonical · ${files.length} TS/TSX files scanned · zero drift`);
} else {
  console.error(`\n${failures} failure(s) — drift detected. Import from @/lib/first-party-skills.`);
  process.exit(1);
}
