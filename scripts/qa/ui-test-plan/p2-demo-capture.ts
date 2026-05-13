/**
 * UI_REAL_USER_TEST_PLAN.md Priority 2 · One-click demo flow capture.
 *
 * Real browser, real /?demo=true path, real one-click run (operator-
 * subsidised). Captures every meaningful state transition + agent
 * visually inspects after.
 *
 * P2 doesn't need MetaMask: the demo path uses the operator's pre-funded
 * wallet server-side. User clicks ONE button and gets a receipt back.
 *
 * Steps captured:
 *   1. Landing at /?demo=true — DemoPanel rendered
 *   2. After clicking "Run review" — loading state
 *   3. Receipt rendered (redirected to /r/<id>)
 *   4. Receipt page content (payment block, subsidised badge, chips)
 *   5. Reload after success — receipt still loads
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P2-demo');
for (const sub of ['desktop', 'mobile', 'video']) {
  mkdirSync(resolve(SHOTS_BASE, sub), { recursive: true });
}

let step = 0;
async function snap(page: Page, name: string, dir: 'desktop' | 'mobile'): Promise<void> {
  step += 1;
  const filename = `${String(step).padStart(3, '0')}-${name}.png`;
  if (page.isClosed()) {
    console.log(`  (skip · page closed) ${dir}/${filename}`);
    return;
  }
  await page.screenshot({ path: resolve(SHOTS_BASE, dir, filename), fullPage: false });
  console.log(`  📸 ${dir}/${filename}`);
}

async function captureViewport(viewport: 'desktop' | 'mobile'): Promise<{
  receiptId: string | null;
  finalUrl: string;
}> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  console.log(`\n=== ${viewport.toUpperCase()} ${size.width}×${size.height} ===`);

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: size,
    recordVideo: { dir: resolve(SHOTS_BASE, 'video'), size },
  });
  const page = await ctx.newPage();
  step = 0;

  console.log(`\n  → ${STUDIO}/?demo=true`);
  await page.goto(`${STUDIO}/?demo=true`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(2_500);
  await snap(page, 'demo-loaded', viewport);

  // Find the "Run review" button (DemoPanel ships this when demoActive)
  const runBtn = page.locator('button:has-text("Run review"), button:has-text("Run Review")').first();
  const runBtnVisible = await runBtn.isVisible({ timeout: 5_000 }).catch(() => false);
  console.log(`  "Run review" button visible: ${runBtnVisible}`);

  if (!runBtnVisible) {
    // Demo path might have fallen back to regular RunPanel (e.g., demo wallet
    // out of funds OR demo not detected). Capture whatever is rendered.
    await snap(page, 'demo-fallback-state', viewport);
    console.log('  ⚠ no demo button visible — capturing fallback state');
    await ctx.close();
    await browser.close();
    return { receiptId: null, finalUrl: page.url() };
  }

  console.log('  → clicking Run review');
  await runBtn.click();
  await page.waitForTimeout(1_000);
  await snap(page, 'demo-clicked-loading', viewport);

  // Wait for either: redirect to /r/<id>, OR an error state, OR a banner
  let receiptId: string | null = null;
  for (let i = 0; i < 60; i++) {
    const url = page.url();
    const match = url.match(/\/r\/(\d+)/);
    if (match) {
      receiptId = match[1];
      break;
    }
    // also check for error text on the same page
    const errorVisible = await page.locator('text=/error|failed|insufficient|out of funds/i').first().isVisible({ timeout: 500 }).catch(() => false);
    if (errorVisible) {
      console.log('  ⚠ error visible during demo run — capturing');
      await snap(page, 'demo-error-state', viewport);
      break;
    }
    await page.waitForTimeout(2_000);
  }

  if (receiptId) {
    console.log(`  ✓ receipt anchored: rec_${receiptId}`);
    await page.waitForTimeout(2_500);
    await snap(page, `receipt-${receiptId}-loaded`, viewport);

    // Scroll through receipt content
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(500);
    await snap(page, `receipt-${receiptId}-mid`, viewport);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await snap(page, `receipt-${receiptId}-bottom`, viewport);

    // Reload to confirm receipt persists
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2_000);
    await snap(page, `receipt-${receiptId}-after-reload`, viewport);
  } else {
    console.log('  ⚠ no receipt id detected after 120s — recording final state');
    await snap(page, 'demo-no-receipt-timeout', viewport);
  }

  const finalUrl = page.url();
  await ctx.close();
  await browser.close();
  return { receiptId, finalUrl };
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P2 Demo capture');
  console.log(`Target: ${STUDIO}/?demo=true`);
  console.log(`Output: ${SHOTS_BASE}`);

  const desktopResult = await captureViewport('desktop');
  console.log(`\nDesktop final: ${desktopResult.finalUrl} (receipt: ${desktopResult.receiptId ?? 'NONE'})`);

  const mobileResult = await captureViewport('mobile');
  console.log(`\nMobile final: ${mobileResult.finalUrl} (receipt: ${mobileResult.receiptId ?? 'NONE'})`);

  console.log('\n✓ P2 capture complete · agent visual inspection next');
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
