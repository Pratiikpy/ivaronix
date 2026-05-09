/**
 * QA: end-to-end verification of the new privileged-document hero copy.
 * Per CLAUDE.md §11: real MM extension loaded, both viewports, side-by-side
 * vs brand/Ivaronix.html. Per §12: capture transitions, no synthetic shortcuts.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'hero');
mkdirSync(SHOTS_DIR, { recursive: true });
const BRAND_HTML = `file:///${resolve(REPO, 'brand', 'Ivaronix.html').replace(/\\/g, '/')}`;

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

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const sw = context.serviceWorkers();
    if (sw.length) { const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//); if (m) return m[1]; }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('extension service worker not found');
}

(async () => {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);

  // Unlock MM (so the connect chip path works at desktop)
  const extId = await findExtensionId(ctx);
  console.log(`   ext id: ${extId}`);
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

  // 1. Studio home at 1440x900
  const studio = await ctx.newPage();
  await studio.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_500);
  await snap(studio, 'studio-home-desktop');

  // 2. Connect wallet (real MM popup) so the connected-state header chip is visible
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
  await studio.waitForTimeout(1_500);
  await snap(studio, 'studio-home-connected');

  // 3. Click "See a sample receipt" → should land on /r/1004 (FULLY VERIFIED proof)
  const sampleBtn = studio.locator('a:has-text("See a sample receipt")').first();
  if (await sampleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await sampleBtn.click({ timeout: 5_000 });
    await studio.waitForLoadState('domcontentloaded').catch(() => {});
    await studio.waitForTimeout(3_000);
    await snap(studio, 'studio-sample-receipt');
  }

  // 4. Back to home and click "Run a private audit" CTA
  await studio.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  const ctaBtn = studio.locator('a:has-text("Run a private audit")').first();
  if (await ctaBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await ctaBtn.click({ timeout: 5_000 });
    await studio.waitForLoadState('domcontentloaded').catch(() => {});
    await studio.waitForTimeout(2_500);
    await snap(studio, 'studio-onboard-from-cta');
  }

  // 5. Mobile viewport — verify hero scales and CTAs stack
  await studio.setViewportSize({ width: 375, height: 812 });
  await studio.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'studio-home-mobile');

  // 6. Brand HTML side-by-side at both viewports
  await studio.setViewportSize({ width: 1440, height: 900 });
  const brand = await ctx.newPage();
  await brand.goto(BRAND_HTML, { waitUntil: 'domcontentloaded' });
  await brand.waitForTimeout(2_500);
  await snap(brand, 'brand-html-desktop');
  await brand.setViewportSize({ width: 375, height: 812 });
  await brand.goto(BRAND_HTML, { waitUntil: 'domcontentloaded' });
  await brand.waitForTimeout(2_000);
  await snap(brand, 'brand-html-mobile');

  // 7. Computed-style audit — ensure hero h1 reads correctly + tokens match brand
  await studio.goto('http://localhost:3300/', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  const tokens = await studio.evaluate(() => {
    const h1 = document.querySelector('h1') as HTMLElement | null;
    const cs = h1 ? getComputedStyle(h1) : null;
    const body = document.body;
    const bcs = getComputedStyle(body);
    const header = document.querySelector('header') as HTMLElement | null;
    const hcs = header ? getComputedStyle(header) : null;
    return {
      h1Text: h1?.innerText ?? null,
      h1FontSize: cs?.fontSize ?? null,
      h1FontFamily: cs?.fontFamily?.slice(0, 60) ?? null,
      bodyBg: bcs.backgroundColor,
      bodyInk: bcs.color,
      headerHeight: hcs?.height ?? null,
      headerBackdrop: hcs?.backdropFilter ?? null,
    };
  });
  console.log('   computed:', JSON.stringify(tokens, null, 2));

  await ctx.close();
  console.log('\n=== hero verify done ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
