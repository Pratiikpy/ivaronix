/**
 * Studio mobile-overflow regression.
 *
 * `gridTemplateColumns: 'auto 1fr'` is a known mobile-overflow trap:
 * the `1fr` track has implicit `min-width: auto`, so long content
 * forces the entire grid wider than its parent. The fix is
 * `auto minmax(0, 1fr)` which lets the second track shrink to 0.
 *
 * Closes HALF_BAKED §G Tier A item 9. Pre-sweep-133 there were 10
 * instances across 8 files (r/[id], embed/r/[id], agent/[handle],
 * delegate/[id], dashboard, data-room/[id], skill/[id]). All
 * rewritten to the minmax(0, 1fr) form.
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

const tracked = execFileSync('git', ['ls-files', 'apps/studio/src/'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter((s) => s.endsWith('.tsx') || s.endsWith('.ts'));

ok(`scanned ${tracked.length} Studio source files`);

const violations: Array<{ file: string; line: number; text: string }> = [];

for (const rel of tracked) {
  const content = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (/auto-1fr-allow:/.test(text)) continue;
    if (/gridTemplateColumns:\s*['"]\s*auto\s+1fr\s*['"]/.test(text)) {
      violations.push({ file: rel, line: i + 1, text: text.trim().slice(0, 140) });
    }
  }
}

if (violations.length > 0) {
  console.error('FAIL: bare `gridTemplateColumns: "auto 1fr"` found — use `auto minmax(0, 1fr)` to defeat mobile overflow:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  console.error('Fix: replace `auto 1fr` with `auto minmax(0, 1fr)` OR add the inline marker `// auto-1fr-allow:<reason>` if the bare form is intentional.');
  process.exit(1);
}
ok('no bare `auto 1fr` literals in Studio source');

console.log(`\n[verify-no-bare-auto-1fr] ${asserts} assertions passed`);
