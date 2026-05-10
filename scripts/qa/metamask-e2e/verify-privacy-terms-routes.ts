/**
 * Privacy + Terms route + footer-link regression.
 *
 * Closes HALF_BAKED §G Tier A item 7. The contract:
 *   1. apps/studio/src/app/privacy/page.tsx exists + exports default.
 *   2. apps/studio/src/app/terms/page.tsx exists + exports default.
 *   3. Footer.tsx renders Link href="/privacy" and Link href="/terms".
 *
 * Pure source-file regression — no live server.
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

for (const route of ['privacy', 'terms']) {
  const p = resolve(REPO_ROOT, `apps/studio/src/app/${route}/page.tsx`);
  if (!existsSync(p)) fail(`apps/studio/src/app/${route}/page.tsx is missing`);
  const content = readFileSync(p, 'utf8');
  if (!/export default function/.test(content)) {
    fail(`${route}/page.tsx must export a default function (Next.js page convention)`);
  }
  ok(`/${route} route exists with default export`);
}

const footer = readFileSync(resolve(REPO_ROOT, 'apps/studio/src/components/Footer.tsx'), 'utf8');
if (!/href=['"]\/privacy['"]/.test(footer)) {
  fail('Footer.tsx is missing a Link href="/privacy"');
}
ok('Footer.tsx links to /privacy');
if (!/href=['"]\/terms['"]/.test(footer)) {
  fail('Footer.tsx is missing a Link href="/terms"');
}
ok('Footer.tsx links to /terms');

console.log(`\n[verify-privacy-terms-routes] ${asserts} assertions passed`);
