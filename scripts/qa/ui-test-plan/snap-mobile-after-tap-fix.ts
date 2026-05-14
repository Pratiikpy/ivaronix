/**
 * Visual proof for §17.7 — capture every shipped Studio surface at the
 * 375×812 mobile viewport AFTER the touch-target sweep landed. The
 * agent reads each capture back via Read() and writes a 1-sentence
 * visual confirmation note. Output under QA_PROOF_PACK/ui/P11-mobile/
 * after-tap-fix/.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P11-mobile/after-tap-fix');
mkdirSync(OUT, { recursive: true });

const TARGETS: Array<[string, string]> = [
  ['/', 'home'],
  ['/marketplace', 'marketplace'],
  ['/r/1004', 'receipt-1004'],
  ['/r/31', 'receipt-31'],
  ['/onboard', 'onboard'],
  ['/skills', 'skills'],
  ['/memory', 'memory'],
  ['/0g', '0g'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  for (const [path, name] of TARGETS) {
    try {
      await page.goto(`https://ivaronix.vercel.app${path}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(2_000);
      await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: false });
      console.log(`📸 ${path}: ${name}.png`);
    } catch (e) {
      console.log(`✗ ${path}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  await ctx.close();
  await browser.close();
})();
