/**
 * No-hardcoded-studio-base regression.
 *
 * Closes HALF_BAKED §J-10 + sweep 143. Any code path that emits a
 * Studio URL to operator/judge output MUST resolve via the env-var
 * alias chain (IVARONIX_STUDIO_BASE → STUDIO_BASE → localhost
 * fallback), not hardcode 'http://localhost:3300/...' inline.
 *
 * Sweep 143 introduced studioUrl() in @ivaronix/core; the canonical
 * usage is `studioUrl('/r/12345')`. This regression catches any new
 * literal that bypasses the helper.
 *
 * Skip patterns:
 *   - Inside a `??` chain (legitimate fallback default)
 *   - Inside a smoke-test fixture
 *   - Marked with `studio-base-allow:<reason>` inline comment
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

const tracked = execFileSync('git', ['ls-files', 'apps/cli/src', 'apps/telegram-bot/src'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter((s) => s.endsWith('.ts') || s.endsWith('.tsx'));

ok(`scanned ${tracked.length} CLI + telegram-bot source files`);

const violations: Array<{ file: string; line: number; text: string }> = [];

for (const rel of tracked) {
  const content = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (!/['"]http:\/\/localhost:3300/.test(text)) continue;
    if (/studio-base-allow:/.test(text)) continue;
    if (/process\.env\./.test(text)) continue;
    if (rel.endsWith('smoke.ts')) continue;
    violations.push({ file: rel, line: i + 1, text: text.trim().slice(0, 140) });
  }
}

if (violations.length > 0) {
  console.error('FAIL: hardcoded localhost:3300 Studio URL in user-output paths:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  console.error('Fix: import studioUrl from @ivaronix/core and call studioUrl(\'/r/<id>\').');
  console.error('Allow-marker: `studio-base-allow:<reason>` inline if a hardcode is intentional (e.g. fixture).');
  process.exit(1);
}
ok('no hardcoded localhost:3300 Studio URLs in CLI + telegram-bot output paths');

console.log(`\n[verify-no-hardcoded-studio-base] ${asserts} assertions passed`);
