import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/ui-surfaces/onboard');
mkdirSync(resolve(OUT, 'desktop'), { recursive: true });
mkdirSync(resolve(OUT, 'mobile'), { recursive: true });
mkdirSync(resolve(OUT, 'videos'), { recursive: true });

let n = 0;
async function snap(page: Page, label: string, viewport: 'desktop' | 'mobile'): Promise<void> {
  n++;
  const name = `${String(n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await page.screenshot({ path: resolve(OUT, viewport, name), fullPage: false });
  console.log(`   📸 ${viewport} ${name}`);
}

async function driveAtViewport(viewport: 'desktop' | 'mobile'): Promise<void> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: resolve(OUT, 'videos'), size } });
  const page = await ctx.newPage();
  try {
    // Step 0 · /onboard landing
    await page.goto(`${STUDIO}/onboard`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'onboard-landing', viewport);

    // Scroll progressively to capture each step / section
    const viewportHeight = size.height;
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    const steps = Math.min(8, Math.ceil(totalHeight / (viewportHeight * 0.6)));
    for (let i = 1; i < steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.floor((totalHeight / steps) * i));
      await page.waitForTimeout(800);
      await snap(page, `onboard-step-${String(i).padStart(2, '0')}`, viewport);
    }

    // Try clicking the primary CTA (likely "Connect wallet" or "Mint passport")
    const cta = page.locator('button, a').filter({ hasText: /connect.*wallet|mint.*passport|start.*onboard|get.*started/i }).first();
    if (await cta.count() > 0) {
      await cta.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
      await snap(page, 'onboard-cta-visible', viewport);
      await cta.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await snap(page, 'onboard-cta-clicked', viewport);
    }
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log(`Studio: ${STUDIO}\n`);
  console.log(`=== desktop 1440x900 ===`);
  await driveAtViewport('desktop');
  console.log(`\n=== mobile 375x812 ===`);
  n = 0;
  await driveAtViewport('mobile');
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
