/**
 * Publishable-package metadata invariant.
 *
 * Closes HALF_BAKED §J-14. Any package.json NOT marked `"private": true`
 * MUST carry the full publishable metadata block:
 *
 *   name         (auto-checked: required by npm)
 *   version      (auto-checked: required by npm)
 *   description  (visible on npm registry)
 *   license      (legal clarity for downstream consumers)
 *   homepage     (registry shows the project URL)
 *   repository   (registry shows the source tree)
 *   bugs         (registry shows the issue tracker)
 *   engines.node (warns downstream on incompatible Node versions)
 *
 * Skip: packages with `"private": true` are workspace-internal, not
 * intended for npm publish. The check is private==true OR full metadata
 * — both states are honest; the dangerous state is "not private" plus
 * "missing metadata" because that's the package that ships to npm with
 * unmaintained-looking registry pages.
 *
 * Pure source-file regression.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

interface Pkg {
  name?: string;
  version?: string;
  private?: boolean;
  description?: string;
  license?: string;
  homepage?: string;
  repository?: { url?: string } | string;
  bugs?: { url?: string } | string;
  engines?: { node?: string };
}

const tracked = execFileSync('git', ['ls-files', '**/package.json'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter((s) => s.length > 0)
  .filter((s) => !s.startsWith('node_modules/'))
  .filter((s) => !s.includes('/node_modules/'))
  .filter((s) => !s.startsWith('packages/_design/'))
  .filter((s) => !s.startsWith('packages/opencode-')) // upstream-bundled
  .filter((s) => !s.startsWith('contracts/lib/')); // Foundry vendored deps (forge-std / openzeppelin) — not ours to publish

ok(`scanned ${tracked.length} package.json files`);

const violations: Array<{ file: string; missing: string[] }> = [];
let publishable = 0;
let privatePkgs = 0;

const REQUIRED_FIELDS: Array<{ key: keyof Pkg; describe: (p: Pkg) => boolean }> = [
  { key: 'description', describe: (p) => typeof p.description === 'string' && p.description.length > 0 },
  { key: 'license', describe: (p) => typeof p.license === 'string' && p.license.length > 0 },
  { key: 'homepage', describe: (p) => typeof p.homepage === 'string' && p.homepage.length > 0 },
  { key: 'repository', describe: (p) => Boolean(p.repository) },
  { key: 'bugs', describe: (p) => Boolean(p.bugs) },
  { key: 'engines', describe: (p) => Boolean(p.engines?.node) },
];

for (const rel of tracked) {
  const content = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
  let pkg: Pkg;
  try {
    pkg = JSON.parse(content) as Pkg;
  } catch {
    fail(`${rel} is not valid JSON`);
  }
  if (rel === 'package.json') continue; // workspace root — special-case
  if (pkg.private === true) {
    privatePkgs++;
    continue;
  }
  const missing: string[] = [];
  for (const { key, describe } of REQUIRED_FIELDS) {
    if (!describe(pkg)) missing.push(String(key));
  }
  if (missing.length > 0) {
    violations.push({ file: rel, missing });
  } else {
    publishable++;
  }
}

if (violations.length > 0) {
  console.error('FAIL: publishable packages missing metadata:');
  for (const v of violations) {
    console.error(`  ${v.file}  - missing: ${v.missing.join(', ')}`);
  }
  console.error('Fix: add the missing fields, OR mark `"private": true` if the package is not intended for npm publish.');
  process.exit(1);
}

ok(`${publishable} publishable packages have full metadata`);
ok(`${privatePkgs} workspace-internal packages (private: true) skipped`);
console.log(`\n[verify-publishable-metadata] ${asserts} assertions passed`);
