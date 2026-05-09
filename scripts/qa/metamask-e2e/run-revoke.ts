/**
 * QA: Memory revokeGrant round-trip via Studio /memory.
 * - Open /memory connected
 * - Find an ACTIVE grant row (the 0xf437b7… grant per CLI memory list)
 * - Click its Revoke button
 * - Drive the MM tx popup → Confirm
 * - Wait for the row to flip ACTIVE → REVOKED
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
const SHOTS_DIR = resolve(REPO, 'screenshots', 'revoke');
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

async function drivePopup(popup: Page, label: string, max = 8): Promise<void> {
  await popup.bringToFront().catch(() => {});
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(1_500);
  await snap(popup, `${label}-open`);
  const ctas = ['Confirm', 'Approve', 'Got it', 'Continue', 'Next', 'Sign', 'Switch', 'Add network'];
  for (let s = 0; s < max; s++) {
    if (popup.isClosed()) return;
    let clicked = false;
    for (const t of ctas) {
      const btn = popup.locator(`button:has-text("${t}"):not([disabled])`).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        console.log(`   ${label} step ${s} → "${t}"`);
        await btn.click({ timeout: 5_000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
    await popup.waitForTimeout(2_000).catch(() => {});
  }
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

  const extId = await findExtensionId(ctx);
  console.log(`   ext id: ${extId}`);

  // Unlock MM
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
  await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_500);

  // Reconnect if needed
  const reconnect = studio.locator('button:has-text("Connect wallet"):not([disabled])').first();
  if (await reconnect.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const popupP = ctx.waitForEvent('page', { timeout: 12_000 }).catch(() => null);
    await reconnect.click({ timeout: 5_000 });
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
    await studio.goto(`${STUDIO}/memory`, { waitUntil: 'domcontentloaded' });
    await studio.waitForTimeout(3_000);
  }

  await snap(studio, 'memory-pre-revoke');

  // Scroll to YOUR GRANTS list
  await studio.evaluate(() => window.scrollTo(0, 700));
  await studio.waitForTimeout(800);
  await snap(studio, 'memory-grants-visible');

  // Find the FIRST Revoke button (only ACTIVE grants have it)
  const revokeBtn = studio.locator('button:has-text("Revoke")').first();
  if (!(await revokeBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    console.log('   FAIL: no Revoke button visible (no ACTIVE grants?)');
    await ctx.close();
    return;
  }
  // Capture which grant we're revoking
  const grantRowText = await revokeBtn.locator('xpath=..').textContent().catch(() => '');
  console.log(`   revoking row: "${(grantRowText ?? '').trim().slice(0, 120)}"`);

  const popupP = ctx.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
  await revokeBtn.click({ timeout: 5_000 });
  await snap(studio, 'memory-revoke-clicked');
  console.log('   waiting for MM tx popup...');
  const mp = await popupP;
  if (mp) {
    console.log('   ✓ MM TX POPUP for revoke');
    await drivePopup(mp, 'mm-revoke-tx', 8);
    await studio.bringToFront();
  } else {
    console.log('   no popup — write may have failed pre-MM');
  }

  // Wait for the revoke to confirm on chain — list should re-render with the row as REVOKED
  console.log('   waiting up to 90s for the grant to flip to REVOKED...');
  const start = Date.now();
  let flipped = false;
  while (Date.now() - start < 90_000) {
    // Capture page text and look for the now-revoked grant
    const txt = await studio.evaluate(() => document.body?.innerText ?? '');
    if (/REVOKED/i.test(txt) && !/Revoke<\/button>/i.test(txt)) {
      // also re-check: the active grant is gone
      const stillActive = await studio.locator('button:has-text("Revoke")').count();
      if (stillActive === 0) { flipped = true; break; }
    }
    await studio.waitForTimeout(3_000);
  }
  if (flipped) {
    console.log(`   ✓ grant flipped to REVOKED in ${Math.round((Date.now() - start) / 1000)}s`);
  } else {
    console.log(`   timed out after ${Math.round((Date.now() - start) / 1000)}s — grant may have revoked but UI not refetched`);
    // Force reload
    await studio.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await studio.waitForTimeout(4_000);
  }
  await snap(studio, 'memory-after-revoke');
  await studio.evaluate(() => window.scrollTo(0, 700));
  await studio.waitForTimeout(800);
  await snap(studio, 'memory-after-revoke-scrolled');

  await ctx.close();
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
