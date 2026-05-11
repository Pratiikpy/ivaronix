/**
 * No "TEE-Bound" (capital B) overclaim in app source or render-target
 * docs. HALF_BAKED §I-6 closure lock (sweep 211).
 *
 * The audit finding: pre-fix `bin/ivaronix.ts` advertised "TEE-Bound
 * Delegated AI Agent" while the delegate's private key was stored in
 * plaintext under `.ivaronix/delegates/<id>/` with zero TEE involvement.
 * A judge reading the binary's help text expected TEE binding, ran the
 * delegate, and discovered an operator-side wallet.
 *
 * The capital-B form ("TEE-Bound", proper-noun feature name) is the
 * roadmap-stage name used in `docs/planning-01.md` §3 — it explicitly
 * distinguishes Phase A (operator-side custody, shipped) from Phase B
 * (real TEE binding, queued). Internal planning docs can use it freely.
 * Anywhere a judge reads, the capital-B form must NOT appear.
 *
 * Lowercase "TEE-bound" is fine — `delegate.ts` and the dashboard use
 * it adjacent to qualifiers like "end-state", "queued", "Phase B" to
 * mark the aspiration honestly.
 *
 * In-scope files:
 *   - apps/cli/src/**
 *   - apps/studio/src/**
 *   - apps/telegram-bot/src/**
 *   - apps/mcp-server/src/**
 *   - packages/X/src/** (any first-party library code)
 *   - README.md
 *   - docs/JUDGE_GUIDE.md
 *   - docs/PITCH.md
 *   - docs/MAINNET_READINESS.md
 *
 * Out-of-scope:
 *   - docs/HALF_BAKED.md (the audit itself names the term)
 *   - docs/planning-01.md, planning-002.md, planning-003.md (internal planning)
 *   - docs/QA_LOOP_BRIEF.md (internal QA history)
 *   - scripts/qa/** (regression files referencing the rule)
 *   - test files
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
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

function walk(dir: string, out: string[], extRe: RegExp): void {
  let entries: string[];
  try { entries = readdirSync(dir); }
  catch { return; }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist' || name === '.turbo') continue;
    const full = resolve(dir, name);
    let stat;
    try { stat = statSync(full); }
    catch { continue; }
    if (stat.isDirectory()) walk(full, out, extRe);
    else if (extRe.test(name) && !/\.test\.ts$/.test(name)) out.push(full);
  }
}

const filesToScan: string[] = [];

// App + library source code.
const codeDirs = [
  resolve(REPO_ROOT, 'apps', 'cli', 'src'),
  resolve(REPO_ROOT, 'apps', 'studio', 'src'),
  resolve(REPO_ROOT, 'apps', 'telegram-bot', 'src'),
  resolve(REPO_ROOT, 'apps', 'mcp-server', 'src'),
];
for (const d of codeDirs) {
  if (existsSync(d)) walk(d, filesToScan, /\.(ts|tsx)$/);
}
// packages/X/src — exclude _design + opencode-* (upstream-bundled).
const pkgRoot = resolve(REPO_ROOT, 'packages');
try {
  for (const name of readdirSync(pkgRoot)) {
    if (name === '_design' || name.startsWith('opencode-')) continue;
    const srcDir = resolve(pkgRoot, name, 'src');
    if (!existsSync(srcDir)) continue;
    walk(srcDir, filesToScan, /\.(ts|tsx)$/);
  }
} catch { /* packages dir missing — skip */ }

// Render-target docs.
const renderTargets = [
  resolve(REPO_ROOT, 'README.md'),
  resolve(REPO_ROOT, 'docs', 'JUDGE_GUIDE.md'),
  resolve(REPO_ROOT, 'docs', 'PITCH.md'),
  resolve(REPO_ROOT, 'docs', 'MAINNET_READINESS.md'),
];
for (const f of renderTargets) {
  if (existsSync(f)) filesToScan.push(f);
}

ok(`scanned ${filesToScan.length} in-scope files (app source + render-target docs)`);

// Forbidden form: the proper-noun capital-B feature name. Lowercase
// "TEE-bound" stays allowed for honest roadmap framing.
const forbiddenRe = /\bTEE-Bound\b/;

interface Violation { file: string; line: number; text: string; }
const violations: Violation[] = [];
for (const file of filesToScan) {
  const src = readFileSync(file, 'utf8');
  if (!forbiddenRe.test(src)) continue;
  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (forbiddenRe.test(line)) {
      violations.push({ file, line: i + 1, text: line.trim() });
    }
  });
}

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} TEE-Bound overclaim(s) in app source or render-target docs:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}`);
    console.error(`    ${v.text}`);
  }
  console.error('');
  console.error('Fix: the proper-noun feature name "TEE-Bound" is the roadmap-stage label.');
  console.error('  - In docs/planning-01.md (Phase B aspiration), the term is fine.');
  console.error('  - Anywhere a judge reads (README, JUDGE_GUIDE, PITCH, MAINNET_READINESS,');
  console.error('    or app source), use the lowercase honest framing:');
  console.error('      "operator-side delegate wallet (TEE-bound custody queued)"');
  console.error('  - The Phase A delivery does not carry TEE binding; advertising it as a');
  console.error('    current capability misleads the reader.');
  process.exit(1);
}

ok(`no TEE-Bound capital-B overclaim in any in-scope file`);

console.log(`\n[verify-no-tee-bound-overclaim] ${asserts} assertions passed`);
