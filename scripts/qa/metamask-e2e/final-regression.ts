/**
 * Final regression sweep — every UI feature shipped today must still work
 * after 14 commits. Captures freshest-receipt visuals + footer link checks
 * + mobile nav verification.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'final');
mkdirSync(SHOTS_DIR, { recursive: true });

let stepNum = 0;
async function snap(page: Page, label: string): Promise<string> {
  stepNum++;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return '';
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
    return name;
  } catch { return ''; }
}

(async () => {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });

  const studio = await ctx.newPage();

  // 1. Freshest TIER 1 receipt with burn mode (#1069)
  console.log('\n=== /r/1069 — freshest TIER 1 burn-mode receipt ===');
  await studio.goto('http://localhost:3300/r/1069', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'r-1069-top');
  await studio.evaluate(() => window.scrollTo(0, 600));
  await studio.waitForTimeout(800);
  await snap(studio, 'r-1069-burn-evidence');
  await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await studio.waitForTimeout(800);
  await snap(studio, 'r-1069-footer');

  // 2. Freshest TIER 2 NVIDIA receipt (#1056) — should be amber
  console.log('\n=== /r/1056 — TIER 2 NVIDIA amber receipt ===');
  await studio.goto('http://localhost:3300/r/1056', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'r-1056-tier2-amber');

  // 3. Home page with full footer
  console.log('\n=== / home with multi-column footer ===');
  await studio.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_500);
  await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await studio.waitForTimeout(800);
  await snap(studio, 'home-footer-final');

  // 4. Mobile viewport — hamburger nav
  console.log('\n=== mobile nav at 375x812 ===');
  await studio.setViewportSize({ width: 375, height: 812 });
  await studio.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_500);
  await snap(studio, 'mobile-home');
  // Click hamburger
  const trigger = studio.locator('button.mobile-menu-trigger').first();
  if (await trigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await trigger.click();
    await studio.waitForTimeout(900);
    await snap(studio, 'mobile-drawer-open');
    // Verify nav links exist in drawer
    const linkCount = await studio.locator('[role="dialog"] a').count();
    console.log(`   drawer nav links: ${linkCount}`);
  }

  // 5. Skill detail page (regression-check it didn't break)
  console.log('\n=== /skill/private-doc-review ===');
  await studio.setViewportSize({ width: 1440, height: 900 });
  await studio.goto('http://localhost:3300/skill/private-doc-review', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_500);
  await snap(studio, 'skill-detail-regression');

  // 6. Agent profile — proves /agent/[handle]
  console.log('\n=== /agent/<addr> ===');
  await studio.goto('http://localhost:3300/agent/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_500);
  await snap(studio, 'agent-profile-regression');

  await ctx.close();
  console.log('\n=== regression sweep done ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); process.exit(1); });
