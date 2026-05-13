/**
 * UI_REAL_USER_TEST_PLAN.md Priority 5 · Marketplace surface.
 *
 * Capture the routes that DON'T require SIWE: browse + detail.
 * Routes requiring SIWE (new, payouts, admin/treasury) need MM connect
 * and are tested in the hybrid P3-style script (next iteration).
 *
 * Pre-condition: private-doc-review skill published + priced on chain
 * via P3 setup (skillId 0x0934cfc2…).
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const SKILL_ID_HASH = '0x0934cfc21748e6a579630c2637fcb1f95b9fa2acfb16039e1a7ed70473860dcb';
const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P5-marketplace');
for (const sub of ['desktop', 'mobile', 'video']) {
  mkdirSync(resolve(SHOTS_BASE, sub), { recursive: true });
}

let step = 0;
async function snap(page: Page, name: string, viewport: 'desktop' | 'mobile'): Promise<void> {
  step += 1;
  const filename = `${String(step).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_BASE, viewport, filename), fullPage: false });
    console.log(`  📸 ${viewport}/${filename}`);
  } catch (e) {
    console.log(`  (skip) ${viewport}/${filename} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function captureViewport(viewport: 'desktop' | 'mobile'): Promise<void> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  console.log(`\n=== ${viewport.toUpperCase()} ${size.width}×${size.height} ===`);
  step = 0;

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: size,
    recordVideo: { dir: resolve(SHOTS_BASE, 'video'), size },
  });
  const page = await ctx.newPage();

  // 1. /marketplace browse
  console.log(`\n  → ${STUDIO}/marketplace`);
  await page.goto(`${STUDIO}/marketplace`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4_000); // give subgraph/chain reads time
  await snap(page, 'marketplace-browse', viewport);

  // count skills visible
  const skillCount = await page.locator('[class*="skill"], [class*="card"]').count();
  console.log(`  visible skill/card elements: ${skillCount}`);

  // Try to find private-doc-review by text
  const ourSkill = page.locator('text=/private-doc-review/i').first();
  const ourSkillVisible = await ourSkill.isVisible({ timeout: 3_000 }).catch(() => false);
  console.log(`  private-doc-review listed: ${ourSkillVisible}`);

  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await snap(page, 'marketplace-mid', viewport);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await snap(page, 'marketplace-bottom', viewport);

  // 2. /marketplace/<skillId> detail (using the hash)
  console.log(`\n  → ${STUDIO}/marketplace/${SKILL_ID_HASH}`);
  await page.goto(`${STUDIO}/marketplace/${SKILL_ID_HASH}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4_000);
  await snap(page, 'skill-detail-hash', viewport);

  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await snap(page, 'skill-detail-mid', viewport);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await snap(page, 'skill-detail-bottom', viewport);

  // 3. Try /marketplace/private-doc-review (slug form)
  console.log(`\n  → ${STUDIO}/marketplace/private-doc-review`);
  await page.goto(`${STUDIO}/marketplace/private-doc-review`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await snap(page, 'skill-detail-slug', viewport);

  // 4. /marketplace/new (SIWE-gated, will show connect prompt)
  console.log(`\n  → ${STUDIO}/marketplace/new`);
  await page.goto(`${STUDIO}/marketplace/new`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await snap(page, 'marketplace-new-gated', viewport);

  // 5. /marketplace/payouts (SIWE-gated)
  console.log(`\n  → ${STUDIO}/marketplace/payouts`);
  await page.goto(`${STUDIO}/marketplace/payouts`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await snap(page, 'marketplace-payouts-gated', viewport);

  // 6. /admin/treasury (SIWE + admin gated)
  console.log(`\n  → ${STUDIO}/admin/treasury`);
  await page.goto(`${STUDIO}/admin/treasury`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await snap(page, 'admin-treasury-gated', viewport);

  await ctx.close();
  await browser.close();
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P5 Marketplace capture');
  console.log(`Target: ${STUDIO}`);
  console.log(`Output: ${SHOTS_BASE}\n`);

  await captureViewport('desktop');
  await captureViewport('mobile');

  console.log('\n✓ P5 capture complete · agent visual inspection next');
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
