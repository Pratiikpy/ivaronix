import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/ui-surfaces/skill-new');
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
    await page.goto(`${STUDIO}/skill/new`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await snap(page, 'skill-new-landing', viewport);

    // Try filling form fields if visible (form is wallet-gated · this captures the gated state cleanly)
    const slugInput = page.locator('input[name="slug"], input[placeholder*="slug" i]').first();
    if (await slugInput.count() > 0 && await slugInput.isVisible().catch(() => false)) {
      await slugInput.fill('q5-test-skill').catch(() => {});
      await page.waitForTimeout(500);
      await snap(page, 'skill-new-slug-filled', viewport);
    }

    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.count() > 0 && await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Q5 Test Skill').catch(() => {});
      await page.waitForTimeout(500);
      await snap(page, 'skill-new-name-filled', viewport);
    }

    // Scroll through page to capture each section
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    const steps = Math.min(6, Math.ceil(totalHeight / (size.height * 0.7)));
    for (let i = 1; i < steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.floor((totalHeight / steps) * i));
      await page.waitForTimeout(800);
      await snap(page, `skill-new-section-${String(i).padStart(2, '0')}`, viewport);
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
