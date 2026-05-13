/**
 * One-shot env diagnostic — print which canonical env name resolved to
 * which alias for every environment variable Ivaronix consumes.
 *
 * Closes USER_TODO §B-V2-11. The lower layer (`envCheckReport()` in
 * `packages/runtime/src/env.ts`) was shipped with planning-003 §A.3.4;
 * this is the operator-facing CLI surface on top of it.
 *
 * Usage:
 *   pnpm env:check
 */

import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Walk up to find the nearest .env file before reading process.env — matches
// the CLI's own startup loader (apps/cli/src/bin/ivaronix.ts:7-17) so the
// gate sees the same environment the CLI does. Without this, running
// `pnpm env:check` from the repo root shows every canonical as UNSET even
// when .env has them defined (cron sweep iter-165 finding · 2026-05-13).
function findEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envPath = findEnvFile(process.cwd());
if (envPath) dotenvConfig({ path: envPath });

import { envCheckReport } from '@ivaronix/runtime/env';

const RED = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;

// Canonicals that are documented OPTIONAL today — unset is not a gate failure.
// Each entry MUST cite its source-of-truth queued doc so a future reader knows
// why the gate is permissive about it.
const OPTIONAL_CANONICALS = new Set<string>([
  // Read-proxy key gates operator-side privacy for unrelated reads (planning-003
  // §A.5.4 · operator-as-proxy). Today's operator wallet signs every indexer
  // call by default — the proxy split is queued, not load-bearing. The gate
  // doesn't fail when unset because the dev .env doesn't need to carry it.
  'IVARONIX_READ_PROXY_KEY',
]);

const report = envCheckReport();

const canonicalCol = Math.max(20, ...report.map((r) => r.canonical.length));
const aliasCol = Math.max(20, ...report.map((r) => (r.usedAlias ?? '').length));

const fmt = (s: string, w: number) => s.length >= w ? s : s + ' '.repeat(w - s.length);

console.log(`${fmt('CANONICAL', canonicalCol)}  ${fmt('USED ALIAS', aliasCol)}  STATUS`);
console.log(`${'-'.repeat(canonicalCol)}  ${'-'.repeat(aliasCol)}  ${'-'.repeat(40)}`);

let unsetRequired = 0;
let unsetOptional = 0;
let legacyAliases = 0;
let canonical = 0;

for (const r of report) {
  const isOptional = OPTIONAL_CANONICALS.has(r.canonical);
  const canonName = fmt(r.canonical, canonicalCol);
  const used = r.usedAlias ?? '';
  const status =
    !r.usedAlias
      ? isOptional
        ? DIM('UNSET · optional')
        : RED('UNSET')
      : r.usedAlias === r.canonical
        ? GREEN('canonical · ok')
        : YELLOW(`legacy · resolves to ${r.canonical}`);
  if (!r.usedAlias) {
    if (isOptional) unsetOptional++;
    else unsetRequired++;
  } else if (r.usedAlias === r.canonical) canonical++;
  else legacyAliases++;
  // Don't print the actual value — that would leak secrets in operator
  // copy-paste. Just confirm it's set.
  const valueLabel = r.value && r.value.length > 0
    ? DIM(`(${r.value.length}-char value set)`)
    : '';
  console.log(`${canonName}  ${fmt(used, aliasCol)}  ${status} ${valueLabel}`);
}

console.log('');
const optionalSuffix = unsetOptional > 0 ? ` · ${DIM(String(unsetOptional) + ' optional')}` : '';
console.log(`Summary: ${GREEN(String(canonical))} canonical · ${YELLOW(String(legacyAliases))} legacy aliases · ${RED(String(unsetRequired))} unset (required)${optionalSuffix}.`);
if (legacyAliases > 0) {
  console.log('');
  // canonical-alias-allow:rename-tip · this string IS the operator's rename
  // guidance; the legacy names are the data of the message, not drift.
  console.log(YELLOW('Tip:'), 'rename legacy aliases (`OG_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, `OG_NETWORK`, etc.) to their `IVARONIX_*` canonical forms to silence the deprecation warnings on every CLI start.');
}

// Only fail the gate when a REQUIRED canonical is unset. Optional canonicals
// (e.g. IVARONIX_READ_PROXY_KEY · queued · planning-003 §A.5.4) are
// disclosed in the summary but do not exit-1.
if (unsetRequired > 0) process.exit(1);
