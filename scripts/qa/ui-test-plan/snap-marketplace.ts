/**
 * Snapshot of /marketplace after the 5-skill publish (81f2972) — should
 * now show all 6 first-party skills instead of just private-doc-review.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P5-marketplace/post-publish');
mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }] as const,
    ['mobile', { width: 375, height: 812 }] as const,
  ]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.goto('https://ivaronix.vercel.app/marketplace', { waitUntil: 'load', timeout: 30_000 });
    await page.waitForTimeout(3_500);
    await page.screenshot({ path: resolve(OUT, `marketplace-6-skills-${name}.png`), fullPage: true });
    console.log(`📸 ${name}: marketplace-6-skills-${name}.png`);
    await ctx.close();
  }
  await browser.close();
})();
