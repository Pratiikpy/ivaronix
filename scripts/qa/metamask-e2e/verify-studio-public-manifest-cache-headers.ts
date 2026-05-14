/**
 * Studio public-manifest cache headers regression · B-V2-45 closure.
 *
 * `docs/PRIVACY_NOTES.md §1` ("Operator-as-proxy privacy") declares
 * a mitigation: edge-cache public manifests so a typical reviewer
 * hitting `/r/<id>` triggers zero indexer reads from the operator
 * wallet on the warm path. Pre-fix, the privacy doc promised the
 * mitigation but `apps/studio/next.config.ts:headers()` had no
 * `cache-control` directive for public-manifest routes.
 *
 * Source-file regression — reads next.config.ts as text and asserts
 * each public-manifest path has a Cache-Control header with the
 * recommended s-maxage=86400 + stale-while-revalidate=604800. Live
 * HTTP request testing is queued for the studio-live filter.
 *
 * Routes covered (per PRIVACY_NOTES.md §1):
 *   - /r/:id              — receipt page
 *   - /r/:id/print        — printable receipt
 *   - /embed/r/:id        — embeddable receipt iframe
 *   - /data-room/:id      — confidential data room manifest
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

const NEXT_CONFIG = resolve(REPO_ROOT, 'apps/studio/next.config.ts');
const content = readFileSync(NEXT_CONFIG, 'utf8');

const EXPECTED_CACHE_VALUE = 'public, s-maxage=86400, stale-while-revalidate=604800';
const COVERED_ROUTES = [
  '/r/:id',
  '/r/:id/print',
  '/embed/r/:id',
  '/data-room/:id',
];

for (const route of COVERED_ROUTES) {
  // Match `source: '<route>'` (single or double quoted) followed within
  // the same headers entry by a Cache-Control directive with the expected
  // value. Use a non-greedy match across whitespace + newlines.
  const escaped = route.replace(/[/]/g, '\\/').replace(/:/g, ':');
  const rx = new RegExp(
    `source:\\s*['"]${escaped}['"][\\s\\S]*?key:\\s*['"]Cache-Control['"][\\s\\S]*?value:\\s*['"]${EXPECTED_CACHE_VALUE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
  );
  if (!rx.test(content)) {
    fail(
      `next.config.ts missing Cache-Control header for route ${route} ` +
        `with value "${EXPECTED_CACHE_VALUE}". B-V2-45 + docs/PRIVACY_NOTES.md §1 ` +
        `require this on every public-manifest route.`,
    );
  }
  ok(`${route} → Cache-Control: ${EXPECTED_CACHE_VALUE}`);
}

console.log(`\n${asserts}/${asserts} assertions passed`);
