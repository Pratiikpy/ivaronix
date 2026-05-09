import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'data-room');
mkdirSync(SHOTS_DIR, { recursive: true });
const ROOM_ID = '01KR66C1GJVR57MHQPJCW1HQQY';

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

  // Unlock MM so the wallet header chip is real
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

  const studio = await ctx.newPage();
  await studio.goto(`http://localhost:3300/data-room/${ROOM_ID}`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(4_000);
  await snap(studio, 'data-room-desktop-top');

  // Scroll down to capture parties + verify section
  await studio.evaluate(() => window.scrollTo(0, 400));
  await studio.waitForTimeout(800);
  await snap(studio, 'data-room-desktop-mid');

  await studio.evaluate(() => window.scrollTo(0, 900));
  await studio.waitForTimeout(800);
  await snap(studio, 'data-room-desktop-bottom');

  await studio.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await studio.waitForTimeout(800);
  await snap(studio, 'data-room-desktop-footer');

  // Mobile viewport
  await studio.setViewportSize({ width: 375, height: 812 });
  await studio.goto(`http://localhost:3300/data-room/${ROOM_ID}`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_500);
  await snap(studio, 'data-room-mobile-top');

  await studio.evaluate(() => window.scrollTo(0, 600));
  await studio.waitForTimeout(800);
  await snap(studio, 'data-room-mobile-mid');

  // Negative test: invalid room id
  await studio.setViewportSize({ width: 1440, height: 900 });
  await studio.goto('http://localhost:3300/data-room/no-such-room-id', { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_000);
  await snap(studio, 'data-room-not-found');

  await ctx.close();
  console.log('\n=== room verify done ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
