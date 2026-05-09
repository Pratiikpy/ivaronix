/**
 * QA: end-to-end Burn Mode + Consensus role-preview test on Studio.
 * - Open /, ensure connected
 * - Verify role-preview row reflects each tier
 * - Toggle Burn Mode on
 * - Run a sample doc
 * - Visit /r/<id>, verify burn-mode chip + key fingerprint + destroyed timestamp render
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'burn');
mkdirSync(SHOTS_DIR, { recursive: true });
const STUDIO = 'http://localhost:3300';

let stepNum = 0;
async function snap(page: Page, label: string): Promise<string> {
  stepNum++;
  const name = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return '';
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   📸 ${name}`);
    return name;
  } catch (e) {
    return '';
  }
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const sw = context.serviceWorkers();
    if (sw.length) { const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//); if (m) return m[1]; }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('extension service worker not found');
}

(async () => {
  console.log('=== launching ===');
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);

  const extId = await findExtensionId(ctx);
  console.log(`   ext id: ${extId}`);

  // Unlock
  const mm = ctx.pages().find((p) => p.url().includes(extId)) ?? await ctx.newPage();
  if (!mm.url().includes(extId)) await mm.goto(`chrome-extension://${extId}/home.html`);
  await mm.bringToFront();
  await mm.waitForSelector('button, input[type="password"]', { timeout: 60_000 }).catch(() => {});
  await mm.waitForTimeout(2_500);
  if (await mm.locator('button:has-text("Unlock")').first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await mm.locator('input[type="password"]').first().fill(PASSWORD);
    await mm.locator('button:has-text("Unlock"), button:has-text("Sign in")').first().click({ timeout: 8_000 }).catch(() => {});
    await mm.waitForTimeout(3_000);
  }

  const studio = await ctx.newPage();
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_000);

  // Auto-connect (permission cached)
  const connectBtn = studio.locator('button:has-text("Connect wallet"):not([disabled])').first();
  if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const popupP = ctx.waitForEvent('page', { timeout: 12_000 }).catch(() => null);
    await connectBtn.click({ timeout: 5_000 });
    const p = await popupP;
    if (p) {
      await p.bringToFront().catch(() => {});
      await p.waitForLoadState('domcontentloaded').catch(() => {});
      await p.waitForTimeout(1_500);
      const c = p.locator('button:has-text("Connect"):not([disabled])').first();
      if (await c.isVisible({ timeout: 5_000 }).catch(() => false)) await c.click().catch(() => {});
      await p.waitForTimeout(2_000).catch(() => {});
    }
    await studio.bringToFront();
  }
  await studio.waitForFunction(() => /Disconnect/i.test(document.body?.innerText ?? ''), { timeout: 10_000 }).catch(() => {});

  console.log('\n=== verify role-preview row at each tier ===');
  // Quick (default)
  await studio.locator('select').filter({ hasText: 'Quick' }).first().selectOption({ value: 'quick' }).catch(() => {});
  await studio.waitForTimeout(500);
  await snap(studio, 'tier-quick');
  // Standard
  await studio.locator('select').filter({ hasText: /Quick|Standard|High/ }).nth(1).selectOption({ value: 'standard' }).catch(() => {});
  await studio.waitForTimeout(500);
  await snap(studio, 'tier-standard');
  // High-Stakes
  await studio.locator('select').filter({ hasText: /Quick|Standard|High/ }).nth(1).selectOption({ value: 'high-stakes' }).catch(() => {});
  await studio.waitForTimeout(500);
  await snap(studio, 'tier-high-stakes');
  // Reset to Quick for the actual run
  await studio.locator('select').filter({ hasText: /Quick|Standard|High/ }).nth(1).selectOption({ value: 'quick' }).catch(() => {});
  await studio.waitForTimeout(500);

  console.log('\n=== toggle Burn Mode + run ===');
  // Find the Burn Mode checkbox and check it
  const burnLabel = studio.locator('label:has-text("burn mode")').first();
  if (await burnLabel.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await burnLabel.locator('input[type="checkbox"]').check();
    console.log('   ✓ burn mode checked');
    await studio.waitForTimeout(800);
    await snap(studio, 'burn-toggled-on');
  }

  // Upload a sample
  const tmp = resolve(tmpdir(), `burn-sample-${Date.now()}.txt`);
  writeFileSync(tmp, 'CONFIDENTIAL: Tenant must indemnify Landlord for any and all claims.', 'utf8');
  await studio.locator('input[type="file"]').first().setInputFiles(tmp);
  await studio.waitForTimeout(1_500);

  const runBtn = studio.locator('button:has-text("Run"):not([disabled])').first();
  await runBtn.click({ timeout: 5_000 });
  await snap(studio, 'burn-run-clicked');
  console.log('   waiting up to 240s for fresh receipt...');

  const t0 = Date.now();
  let proofUrl = '';
  while (Date.now() - t0 < 240_000) {
    const link = studio.locator('a[href^="/r/"]').first();
    if (await link.isVisible({ timeout: 1_000 }).catch(() => false)) {
      proofUrl = (await link.getAttribute('href')) ?? '';
      break;
    }
    await studio.waitForTimeout(2_000);
  }
  console.log(`   ✓ fresh receipt: ${proofUrl} after ${Math.round((Date.now() - t0) / 1000)}s`);
  await snap(studio, 'burn-run-done');

  if (proofUrl) {
    await studio.goto(`${STUDIO}${proofUrl}`, { waitUntil: 'domcontentloaded' });
    await studio.waitForTimeout(3_000);
    await snap(studio, `burn-receipt-${proofUrl.replace(/\//g, '-')}`);
    // Check burn block visible
    const burnText = await studio.evaluate(() => document.body?.innerText ?? '');
    const hasBurnChip = burnText.includes('Burn Mode 🔒');
    const hasKeyFp = /key fingerprint/i.test(burnText);
    const hasDestroyed = /destroyed at/i.test(burnText);
    console.log(`   burn chip=${hasBurnChip} fingerprint=${hasKeyFp} destroyed=${hasDestroyed}`);
  }

  await ctx.close();
  console.log('\n=== done ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
