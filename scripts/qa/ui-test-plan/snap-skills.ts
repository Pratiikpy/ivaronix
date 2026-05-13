/**
 * Capture /skills to show how many first-party skills render with
 * REGISTRY MATCH chips post-publish.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P8-skills');
mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`https://ivaronix.vercel.app/skills?b=${Date.now()}`, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForTimeout(3_500);
  await page.screenshot({ path: resolve(OUT, 'skills-page-post-publish.png'), fullPage: false });
  console.log(`📸 ${resolve(OUT, 'skills-page-post-publish.png')}`);
  await browser.close();
})();
