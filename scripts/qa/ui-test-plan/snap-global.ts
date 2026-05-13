import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P10-read-pages');
mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [path, name] of [['/global', 'global'], ['/agent/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce', 'agent-operator']] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`https://ivaronix.vercel.app${path}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForTimeout(2_500);
      await page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: false });
      console.log(`📸 ${path}: ${name}.png`);
    } catch (e) {
      console.log(`✗ ${path}: ${(e as Error).message.split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
})();
