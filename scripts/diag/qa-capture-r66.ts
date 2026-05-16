import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', 'docs', 'video', 'qa', 'verify-fix');
mkdirSync(OUT, { recursive: true });

async function shoot(viewport: { width: number; height: number }, label: string) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('https://www.ivaronix.xyz/r/66', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: resolve(OUT, `r-66-${label}.png`), fullPage: false });
    console.log(`shot ${label}`);
    await context.close();
  } finally {
    await browser.close();
  }
}

await shoot({ width: 1440, height: 900 }, 'desktop');
await shoot({ width: 375, height: 812 }, 'mobile');
