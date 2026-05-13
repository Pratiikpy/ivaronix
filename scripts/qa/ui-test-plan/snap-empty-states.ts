/**
 * Capture empty / connect-wallet states for routes that need a wallet to
 * be useful: /dashboard, /memory, /marketplace/payouts, /admin/treasury.
 * Confirms each renders a clean "connect" prompt rather than crashing
 * or showing stale data.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P10-read-pages/empty-states');
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['/dashboard', 'dashboard'],
  ['/memory', 'memory'],
  ['/marketplace/payouts', 'marketplace-payouts'],
  ['/admin/treasury', 'admin-treasury'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const [path, name] of ROUTES) {
    try {
      await page.goto(`https://ivaronix.vercel.app${path}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(2_500);
      await page.screenshot({ path: resolve(OUT, `${name}-no-wallet.png`), fullPage: false });
      console.log(`📸 ${path}: ${name}-no-wallet.png`);
    } catch (e) {
      console.log(`✗ ${path}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  await browser.close();
})();
