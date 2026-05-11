/**
 * README + render-target docs must only reference real pnpm scripts.
 *
 * Closes sweep 190's queue: a judge running the README's quick-start
 * hit `pnpm cli verify` and got "no such script" because the alias
 * never existed in root package.json. This regression catches that
 * class: any `pnpm <token>` invocation in README / PITCH / JUDGE_GUIDE
 * / MAINNET_READINESS / privacy / terms that references a script not
 * in root package.json fails CI.
 *
 * Skip patterns:
 *   - pnpm <subdirective> where subdirective is a built-in: install,
 *     run, --filter, -r, dlx, init, etc.
 *   - inline `pnpm-script-allow:<reason>` marker
 *
 * Pure source-file regression.
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

const PNPM_BUILTINS = new Set([
  'install', 'i', 'add', 'remove', 'rm', 'uninstall',
  'run', 'exec', 'dlx', 'init', 'audit', 'config',
  'list', 'ls', 'why', 'outdated', 'update', 'up',
  'create', 'pack', 'publish', 'link', 'unlink',
  'patch', 'patch-commit', 'patch-remove',
  'rebuild', 'recursive', 'root', 'setup',
  'start', 'stop', 'restart',
  'test', 'lint', 'build', 'dev', 'typecheck', 'clean',
  '-r', '--filter', '--workspace-root', '-w',
]);

const rootPkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
const rootScripts = new Set(Object.keys(rootPkg.scripts ?? {}));
ok(`root package.json declares ${rootScripts.size} scripts`);

const TARGET_DOCS = [
  'README.md',
  'docs/PITCH.md',
  'docs/JUDGE_GUIDE.md',
  'docs/MAINNET_READINESS.md',
  'apps/studio/src/app/privacy/page.tsx',
  'apps/studio/src/app/terms/page.tsx',
];

const violations: Array<{ file: string; line: number; cmd: string }> = [];

// Script names can contain colons (e.g. `numbers:refresh`, `docs:check`).
const pnpmPattern = /\bpnpm\s+(?:--[a-zA-Z][\w-]*\s+\S+\s+)*([a-zA-Z][\w:-]*)/g;

for (const rel of TARGET_DOCS) {
  let content: string;
  try {
    content = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (/pnpm-script-allow:/.test(text)) continue;
    const matches = text.matchAll(pnpmPattern);
    for (const m of matches) {
      const cmd = m[1];
      if (!cmd || PNPM_BUILTINS.has(cmd)) continue;
      if (!rootScripts.has(cmd)) {
        violations.push({ file: rel, line: i + 1, cmd: m[0] });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('FAIL: README / render-target docs reference pnpm scripts that don\'t exist in root package.json:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  -> ${v.cmd}`);
  }
  console.error('Fix: either (a) the script is real but missing from root package.json — add it; or (b) the doc is using a stale alias — update to the real script name.');
  console.error('Allow-marker: `pnpm-script-allow:<reason>` inline if the example is intentionally aspirational.');
  process.exit(1);
}

ok('all pnpm <script> references in render-target docs match root package.json scripts');
console.log(`\n[verify-readme-pnpm-scripts-exist] ${asserts} assertions passed`);
