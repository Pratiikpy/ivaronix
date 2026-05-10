/**
 * Share-surface font binding regression.
 *
 * /r/[id]/print and /embed/r/[id] are the two surfaces judges share
 * most often (a printable letterhead + an iframe-embeddable receipt).
 * Both inherit the html className from the root layout, which carries
 * --font-sans (Outfit), --font-display (Instrument Serif), and
 * --font-mono (JetBrains Mono) via next/font/google.
 *
 * Pre-sweep-132, both pages had a bare system-ui fontFamily literal
 * that bypassed the brand binding. The body of the receipt rendered
 * in Segoe UI on Windows, Helvetica on macOS — anything but Outfit.
 * Closes HALF_BAKED §G Tier A item 8.
 *
 * Contract:
 *   - Neither page may use a bare system-ui literal in fontFamily.
 *   - Both pages MUST use var(--font-sans, ...) so Outfit resolves
 *     when next/font is wired and a sane fallback runs in dev.
 *
 * Pure source-file regression — no live server.
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

const SHARE_SURFACES = [
  'apps/studio/src/app/r/[id]/print/page.tsx',
  'apps/studio/src/app/embed/r/[id]/page.tsx',
];

for (const rel of SHARE_SURFACES) {
  const content = readFileSync(resolve(REPO_ROOT, rel), 'utf8');

  const bareSystemUi = /fontFamily:\s*['"]system-ui[^'"]*['"]/.exec(content);
  if (bareSystemUi) {
    fail(`${rel} has bare system-ui fontFamily literal at offset ${bareSystemUi.index}: ${bareSystemUi[0]}`);
  }
  ok(`${rel} no bare system-ui literal`);

  if (!/fontFamily:\s*['"]var\(--font-sans/.test(content)) {
    fail(`${rel} is missing var(--font-sans) for the body fontFamily`);
  }
  ok(`${rel} body fontFamily binds to var(--font-sans)`);
}

console.log(`\n[verify-share-surface-fonts] ${asserts} assertions passed`);
