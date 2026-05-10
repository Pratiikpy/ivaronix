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

import { envCheckReport } from '@ivaronix/runtime/env';

const RED = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;

const report = envCheckReport();

const canonicalCol = Math.max(20, ...report.map((r) => r.canonical.length));
const aliasCol = Math.max(20, ...report.map((r) => (r.usedAlias ?? '').length));

const fmt = (s: string, w: number) => s.length >= w ? s : s + ' '.repeat(w - s.length);

console.log(`${fmt('CANONICAL', canonicalCol)}  ${fmt('USED ALIAS', aliasCol)}  STATUS`);
console.log(`${'-'.repeat(canonicalCol)}  ${'-'.repeat(aliasCol)}  ${'-'.repeat(40)}`);

let unset = 0;
let legacyAliases = 0;
let canonical = 0;

for (const r of report) {
  const canonName = fmt(r.canonical, canonicalCol);
  const used = r.usedAlias ?? '';
  const status =
    !r.usedAlias
      ? RED('UNSET')
      : r.usedAlias === r.canonical
        ? GREEN('canonical · ok')
        : YELLOW(`legacy · resolves to ${r.canonical}`);
  if (!r.usedAlias) unset++;
  else if (r.usedAlias === r.canonical) canonical++;
  else legacyAliases++;
  // Don't print the actual value — that would leak secrets in operator
  // copy-paste. Just confirm it's set.
  const valueLabel = r.value && r.value.length > 0
    ? DIM(`(${r.value.length}-char value set)`)
    : '';
  console.log(`${canonName}  ${fmt(used, aliasCol)}  ${status} ${valueLabel}`);
}

console.log('');
console.log(`Summary: ${GREEN(String(canonical))} canonical · ${YELLOW(String(legacyAliases))} legacy aliases · ${RED(String(unset))} unset.`);
if (legacyAliases > 0) {
  console.log('');
  // canonical-alias-allow:rename-tip · this string IS the operator's rename
  // guidance; the legacy names are the data of the message, not drift.
  console.log(YELLOW('Tip:'), 'rename legacy aliases (`OG_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, `OG_NETWORK`, etc.) to their `IVARONIX_*` canonical forms to silence the deprecation warnings on every CLI start.');
}

if (unset > 0) process.exit(1);
