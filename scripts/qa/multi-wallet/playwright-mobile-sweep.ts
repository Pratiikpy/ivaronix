/**
 * Mobile viewport sweep (375×812) — plan §1385 "No broken layout in the
 * main user flow" + §10 "1440×900 (desktop), 375×812 (mobile · iPhone).
 * Every UI change verified at both viewports."
 *
 * iter-144 captured 18 routes at desktop. iter-148 captures the same
 * routes at 375×812 mobile.
 *
 * No wallet connection needed for this sweep — checking layout integrity
 * at the public surface (most pages render server-side without wallet).
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_DIR = resolve(REPO, `QA_PROOF_PACK/multi-wallet/manual-walkthrough/mobile-sweep-${TIMESTAMP}`);
mkdirSync(SHOTS_DIR, { recursive: true });

const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

// Same route list as iter-144's desktop sweep, plus the mobile-specific
// hamburger menu surface (which only appears at small viewports).
const ROUTES = [
  '/', '/onboard', '/skills', '/memory', '/dashboard', '/global', '/agents',
  '/thesis', '/0g', '/brand', '/docs', '/privacy', '/terms',
  '/r/10', '/r/11', '/r/9', '/r/6',
  '/data-room/01KRFBG2XC8G20JDJ81CD614AX',
  '/delegate/01KRFB6W7JJB2HSXRX1XJCE77N',
];

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum += 1;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: true });
    console.log(`   📸 ${name}`);
  } catch (e) {
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function main(): Promise<void> {
  console.log(`\n=== mobile viewport sweep (375x812) iter-148 ===`);
  console.log(`   Studio target: ${STUDIO}`);
  console.log(`   routes: ${ROUTES.length}`);
  console.log(`   screenshots: ${SHOTS_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();

  // First: capture the hamburger menu state.
  await page.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await snap(page, 'mobile-home-closed');

  // Try clicking the hamburger to open the mobile menu.
  const hamburger = page.locator('button[aria-label*="enu" i], button[aria-label*="ide" i], button:has-text("☰")').first();
  if (await hamburger.isVisible({ timeout: 3_000 }).catch(() => false)) {
    console.log('   clicking hamburger menu...');
    await hamburger.click().catch(() => {});
    await page.waitForTimeout(1_500);
    await snap(page, 'mobile-hamburger-open');
    // Try closing too
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    await snap(page, 'mobile-hamburger-closed');
  }

  // Sweep every route at mobile viewport
  for (const path of ROUTES) {
    console.log(`   visiting ${path}...`);
    try {
      await page.goto(`${STUDIO}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(3_000);
      await snap(page, `mobile${path.replace(/\//g, '-')}`);
    } catch (e) {
      console.log(`     FAIL on ${path}: ${(e as Error).message.split('\n')[0]}`);
    }
  }

  console.log(`\n=== mobile sweep complete ===`);
  console.log(`   screenshots: ${SHOTS_DIR}`);
  await browser.close();
}

main().catch((e) => {
  console.error(`[mobile-sweep] FAIL: ${(e as Error).message}`);
  process.exit(1);
});
