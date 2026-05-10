/**
 * A.2.2 regression · README screenshot grid + capture-pipeline wiring.
 *
 * Closes planning-003 §A.2.2. Asserts:
 *   1. The capture script exists at the expected path.
 *   2. The capture script imports `playwright` (so an operator running
 *      `pnpm screenshots:refresh` doesn't get a missing-module error).
 *   3. The script targets the 6 canonical surfaces named in the plan:
 *      home, runpanel-mid, receipt-tier1, burn-mode, agents, onboard.
 *   4. `package.json` exposes `pnpm screenshots:refresh`.
 *   5. README has a "Visual tour" section that points at the 6 PNG paths.
 *   6. USER_TODO §B-V2-23 documents the operator-action capture step.
 *
 * The PNGs themselves are operator-action (need live Studio server +
 * real receipts) and tracked in USER_TODO §B-V2-23. This regression
 * gates the wired-up state, NOT the file presence.
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

// 1. Capture script exists.
const capture = read('scripts/qa/metamask-e2e/capture-readme-shots.ts');

// 2. Imports playwright.
must(capture, /from 'playwright'/, 'capture script imports playwright');
must(capture, /chromium\.launch/, 'capture script launches chromium');
must(capture, /VIEWPORT[^=]*=[\s\S]*?width:\s*1200/, 'capture script uses 1200×800 viewport');

// 3. Names the six canonical surfaces.
for (const surface of ['home', 'runpanel-mid', 'receipt-tier1', 'burn-mode', 'agents', 'onboard']) {
  must(capture, `name: '${surface}'`, `capture script targets '${surface}' surface`);
}

// 4. package.json exposes pnpm screenshots:refresh.
const pkg = read('package.json');
must(pkg, /"screenshots:refresh":/, 'package.json declares screenshots:refresh script');
must(pkg, /capture-readme-shots\.ts/, 'screenshots:refresh runs the capture script');

// 5. README has the Visual tour section + 6 PNG paths.
const readme = read('README.md');
must(readme, /^## Visual tour\b/m, 'README has "## Visual tour" section header');
for (const seq of ['01-home', '02-runpanel-mid', '03-receipt-tier1', '04-burn-mode', '05-agents', '06-onboard']) {
  must(readme, `screenshots/readme/${seq}.png`, `README references screenshots/readme/${seq}.png`);
}
must(readme, /pnpm screenshots:refresh/, 'README explains how to refresh the grid');

// 6. USER_TODO §B-V2-23 captures the operator-action step.
const userTodo = read('docs/USER_TODO.md');
must(userTodo, /B-V2-23 · Refresh README screenshot grid/, 'USER_TODO §B-V2-23 documents the operator action');
must(userTodo, /pnpm screenshots:refresh/, 'USER_TODO B-V2-23 names the script');

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
