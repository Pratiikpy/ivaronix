import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', 'docs', 'video', 'qa', 'verify-fix');
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const id of ['14', '52', '62', '63']) {
    await page.goto(`https://www.ivaronix.xyz/r/${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: resolve(OUT, `r-${id}-after-fix.png`), fullPage: false });
    console.log(`shot /r/${id}`);
  }
  await context.close();
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
