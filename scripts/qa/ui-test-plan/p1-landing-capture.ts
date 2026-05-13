/**
 * UI_REAL_USER_TEST_PLAN.md Priority 1 · Landing page real-browser capture.
 *
 * Per CLAUDE.md §17 + §17.7: real browser, real viewport, screenshots at
 * every meaningful state, agent visually inspects each before PASS.
 *
 * P1 doesn't need MetaMask (no wallet action yet) — just real rendering
 * at 1440×900 desktop AND 375×812 mobile. The follow-up P2/P3 priorities
 * load the MM extension.
 *
 * Captures:
 *   QA_PROOF_PACK/ui/P1-landing/desktop/<step>.png
 *   QA_PROOF_PACK/ui/P1-landing/mobile/<step>.png
 *   QA_PROOF_PACK/ui/P1-landing/video/<viewport>.webm
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P1-landing');
mkdirSync(resolve(SHOTS_BASE, 'desktop'), { recursive: true });
mkdirSync(resolve(SHOTS_BASE, 'mobile'), { recursive: true });
mkdirSync(resolve(SHOTS_BASE, 'video'), { recursive: true });

let step = 0;
async function snap(page: Page, name: string, dir: 'desktop' | 'mobile'): Promise<string> {
  step += 1;
  const filename = `${String(step).padStart(3, '0')}-${name}.png`;
  const path = resolve(SHOTS_BASE, dir, filename);
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${dir}/${filename}`);
  return filename;
}

async function captureViewport(viewport: 'desktop' | 'mobile'): Promise<void> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  console.log(`\n=== ${viewport.toUpperCase()} ${size.width}×${size.height} ===`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: size,
    recordVideo: { dir: resolve(SHOTS_BASE, 'video'), size },
  });
  const page = await ctx.newPage();
  step = 0;

  console.log(`\n  → loading ${STUDIO}`);
  const t0 = Date.now();
  await page.goto(STUDIO, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const t1 = Date.now();
  console.log(`  ✓ DOM ready in ${t1 - t0}ms`);
  await page.waitForTimeout(2_000); // let live numbers fetch
  await snap(page, 'landing-loaded', viewport);

  // Hero check
  const heroH1 = await page.locator('h1').first().textContent().catch(() => '');
  console.log(`  hero h1: "${heroH1?.slice(0, 120)}"`);

  // Verify-command chip
  const verifyChip = await page.locator('text=/pnpm ivaronix receipt verify/').count();
  console.log(`  verify-command chip count: ${verifyChip}`);

  // 0G PROOF STACK
  const proofStack = await page.locator('text=PROOF STACK').count();
  console.log(`  "PROOF STACK" count: ${proofStack}`);

  // Try the demo CTA
  const demoCTA = await page.locator('text=Try the demo').count();
  console.log(`  "Try the demo" CTA count: ${demoCTA}`);

  // Stat row "verified skills" value
  const verifiedSkillsLine = await page.locator('text=verified skills').first().textContent().catch(() => '');
  console.log(`  stat row · skills line: "${verifiedSkillsLine}"`);
  const verifiedSkillsContainer = await page
    .locator('text=verified skills')
    .first()
    .evaluate((el) => el.parentElement?.textContent ?? '')
    .catch(() => '');
  console.log(`  stat row · skills parent text: "${verifiedSkillsContainer}"`);
  await snap(page, 'stat-row', viewport);

  // Scroll to "BUILT ON 0G PROOF STACK" band
  await page.locator('text=PROOF STACK').scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);
  await snap(page, 'proof-stack-band', viewport);

  // Scroll to live testnet section
  await page.locator('text=LIVE TESTNET').scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);
  await snap(page, 'live-testnet-cards', viewport);

  // Scroll back to top + capture footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await snap(page, 'footer-bottom', viewport);

  await ctx.close();
  await browser.close();
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P1 Landing capture');
  console.log(`Target: ${STUDIO}`);
  console.log(`Output: ${SHOTS_BASE}`);

  await captureViewport('desktop');
  await captureViewport('mobile');

  console.log('\n✓ P1 capture complete · agent visual inspection next');
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
