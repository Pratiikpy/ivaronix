/**
 * Quick screenshot of /r/28 after the ANCHORED chip ships, so the daily
 * checkpoint has a visual record of the green chip + the honest copy.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P5-marketplace-auto/post-anchored-chip');
mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://ivaronix.vercel.app/r/28', { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: resolve(OUT, 'r-28-anchored-chip-desktop.png'), fullPage: false });
  console.log(`📸 ${resolve(OUT, 'r-28-anchored-chip-desktop.png')}`);
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p2 = await ctx2.newPage();
  await p2.goto('https://ivaronix.vercel.app/r/28', { waitUntil: 'load', timeout: 30_000 });
  await p2.waitForTimeout(2_500);
  await p2.screenshot({ path: resolve(OUT, 'r-28-anchored-chip-mobile.png'), fullPage: false });
  console.log(`📸 ${resolve(OUT, 'r-28-anchored-chip-mobile.png')}`);
  await browser.close();
})();
