/**
 * A.2.7 (markdown auto-render half) regression · `numbers:auto:KEY`
 * marker pipeline + 24h staleness gate.
 *
 * Closes the wired-up state of planning-003 §A.2.7's last unfinished
 * sub-item: the markdown auto-render pipeline (USER_TODO §B-V2-8).
 * Asserts:
 *   1. `scripts/diag/docs-render.ts` exists + walks the 4 canonical
 *      target docs (README, PITCH, JUDGE_GUIDE, MAINNET_READINESS).
 *   2. `pnpm docs:render` + `pnpm docs:check` are wired in package.json.
 *   3. README has at least one `<!-- numbers:auto:KEY -->` marker.
 *   4. The script enforces a 24h staleness window on numbers.json.
 *
 * This regression doesn't actually run docs:check (that requires fresh
 * numbers.json + every marker pointing at a valid key, which is a
 * runtime check). It enforces the wired-up code surface only.
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

// 1. Render script exists + walks the 4 docs.
const renderSrc = read('scripts/diag/docs-render.ts');
must(renderSrc, "'README.md'", 'render script lists README.md as a target');
must(renderSrc, "'docs/PITCH.md'", 'render script lists docs/PITCH.md as a target');
must(renderSrc, "'docs/JUDGE_GUIDE.md'", 'render script lists docs/JUDGE_GUIDE.md as a target');
must(renderSrc, "'docs/MAINNET_READINESS.md'", 'render script lists docs/MAINNET_READINESS.md as a target');

// 2. Marker regex shape. The script must accept the canonical
//    `<!-- numbers:auto:KEY -->VALUE<!-- /numbers:auto:KEY -->` form.
must(renderSrc, /numbers:auto:/, 'render script knows the numbers:auto: prefix');
must(renderSrc, /MARKER\s*=\s*\//, 'render script declares a MARKER regex constant');

// 3. 24h staleness gate.
must(renderSrc, /STALENESS_HOURS\s*=\s*24/, 'render script enforces 24h staleness window');
must(renderSrc, /lastRefreshed/, 'render script reads numbers.json lastRefreshed timestamp');

// 4. Dotted-path lookup so markers like receiptTypes.count and
//    polyglotHash.tests.ts work.
must(renderSrc, /lookupValue/, 'render script exports a dotted-path lookup helper');
must(renderSrc, /key\.split\('\.'\)/, 'lookupValue walks dotted keys');

// 5. package.json wiring.
const pkg = read('package.json');
must(pkg, /"docs:render":/, 'package.json declares docs:render script');
must(pkg, /"docs:check":/, 'package.json declares docs:check (CI gate)');
must(pkg, /docs-render\.ts.*--check/, 'docs:check passes --check flag to the render script');

// 6. README has at least one marker so the pipeline isn't a no-op.
const readme = read('README.md');
must(readme, /<!-- numbers:auto:[\w.]+ -->/, 'README has at least one numbers:auto marker');
must(readme, /<!-- numbers:auto:receipts\.total -->/, 'README marker covers receipts.total (the headline number)');
must(readme, /<!-- numbers:auto:contracts\.deployed -->/, 'README marker covers contracts.deployed');

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
