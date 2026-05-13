/**
 * Final read-only page captures for the cron cycle — /thesis, /onboard,
 * /agents, /0g, /privacy, /terms, /brand. Single-pass smoke that every
 * static-ish surface still renders cleanly after this cron's flurry of
 * commits.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P10-read-pages');
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['/thesis', 'thesis'],
  ['/onboard', 'onboard'],
  ['/agents', 'agents'],
  ['/0g', 'og'],
  ['/privacy', 'privacy'],
  ['/terms', 'terms'],
  ['/brand', 'brand'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const [path, name] of ROUTES) {
    try {
      await page.goto(`https://ivaronix.vercel.app${path}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(2_000);
      await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: false });
      console.log(`📸 ${path}: ${name}.png`);
    } catch (e) {
      console.log(`✗ ${path}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  await browser.close();
})();
