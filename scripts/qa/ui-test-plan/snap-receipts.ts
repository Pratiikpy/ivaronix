/**
 * Multi-receipt capture to verify the post-6867b5f chip / four-light /
 * registry-link fix renders correctly across:
 *   - chain-only receipts (no local body): /r/28, /r/26, /r/25, /r/23
 *   - receipts with full local body: /r/1004 (canonical sample)
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P4-receipt/post-anchored-chip');
mkdirSync(OUT, { recursive: true });

const IDS = ['1004', '28', '26', '25', '23'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const id of IDS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`https://ivaronix.vercel.app/r/${id}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(2_500);
      const out = resolve(OUT, `r-${id}-desktop.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`📸 r/${id}: ${out}`);
    } catch (e) {
      console.log(`r/${id} FAILED: ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
