/**
 * Test 3 click strategies against MM v13.30 confirm-btn:
 *  A. locator.click() normal
 *  B. locator.click({ force: true })
 *  C. page.mouse.click(x, y) — CDP-level Input.dispatchMouseEvent
 *
 * Goal: find one that bypasses LavaMoat scuttling so v40 can use it.
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PASSWORD = 'TestPass123!QA';
const EXT_PATH = resolve(HERE, 'mm', 'extension');
const SOURCE_PROFILE = resolve(HERE, 'mm', 'profile');
const STUDIO = 'https://www.ivaronix.xyz';
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-click-strategies');
mkdirSync(OUT, { recursive: true });

function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

(async () => {
  const tmpProfile = resolve(REPO, '.click-strategy-profile');
  if (existsSync(tmpProfile)) rmSync(tmpProfile, { recursive: true, force: true });
  const { cpSync } = await import('node:fs');
  cpSync(SOURCE_PROFILE, tmpProfile, { recursive: true });

  const ctx = await chromium.launchPersistentContext(tmpProfile, {
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
    viewport: { width: 1440, height: 900 },
  });
  log('chromium launched');

  let extId = '';
  for (let i = 0; i < 10; i++) {
    const sw = ctx.serviceWorkers().find((w) => w.url().includes('chrome-extension://'));
    if (sw) { extId = sw.url().split('/')[2]; break; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log(`mm extId: ${extId}`);

  const mm = await ctx.newPage();
  await mm.goto(`chrome-extension://${extId}/home.html`);
  await mm.waitForTimeout(3000);
  const pwInput = mm.locator('input[type="password"]').first();
  if (await pwInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await pwInput.fill(PASSWORD);
    await mm.locator('button:has-text("Unlock"), button[data-testid="unlock-submit"]').first().click().catch(() => {});
    await mm.waitForTimeout(3000);
  }
  log('mm unlocked');

  // Open Studio
  const studio = await ctx.newPage();
  await studio.goto(STUDIO, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await studio.waitForTimeout(5000);

  const known = new Set(ctx.pages());
  await studio.locator('button:has-text("Connect"), a:has-text("Connect Wallet")').first().click({ timeout: 5000 });
  log('connect clicked');

  let popup = null;
  for (let i = 0; i < 30; i++) {
    for (const p of ctx.pages()) {
      if (known.has(p)) continue;
      if (p.url().includes(extId)) { popup = p; break; }
    }
    if (popup) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!popup) { log('NO POPUP'); await ctx.close(); process.exit(1); }
  log(`popup detected: ${popup.url()}`);
  await popup.waitForTimeout(3000);
  await popup.bringToFront();
  await popup.screenshot({ path: resolve(OUT, '01-popup-before-click.png'), fullPage: true });

  // Get button bounding box via locator (works even if evaluate fails)
  const btn = popup.locator('[data-testid="confirm-btn"]');
  const bbox = await btn.boundingBox({ timeout: 5000 }).catch((e) => { log(`bbox failed: ${(e as Error).message.slice(0, 80)}`); return null; });
  if (!bbox) { log('NO BBOX'); await ctx.close(); process.exit(1); }
  log(`bbox: x=${Math.round(bbox.x)} y=${Math.round(bbox.y)} w=${Math.round(bbox.width)} h=${Math.round(bbox.height)}`);

  // Strategy A: locator.click() normal
  log('--- Strategy A: locator.click()');
  let aWorked = false;
  try {
    await btn.click({ timeout: 5000 });
    aWorked = true;
    log('  A SUCCEEDED');
  } catch (e) { log(`  A failed: ${(e as Error).message.slice(0, 100)}`); }

  if (!aWorked && !popup.isClosed()) {
    // Strategy B: force
    log('--- Strategy B: locator.click({ force: true })');
    let bWorked = false;
    try {
      await btn.click({ force: true, timeout: 5000 });
      bWorked = true;
      log('  B SUCCEEDED');
    } catch (e) { log(`  B failed: ${(e as Error).message.slice(0, 100)}`); }

    if (!bWorked && !popup.isClosed()) {
      // Strategy C: CDP-level mouse click via Playwright's page.mouse
      log('--- Strategy C: page.mouse.click(x, y)');
      try {
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        await popup.mouse.click(cx, cy);
        log('  C SUCCEEDED (no throw)');
      } catch (e) { log(`  C failed: ${(e as Error).message.slice(0, 100)}`); }
    }
  }

  // Wait + check outcome
  await new Promise((r) => setTimeout(r, 6000));

  // Did studio reflect connection?
  await studio.bringToFront();
  await studio.waitForTimeout(2000);
  await studio.screenshot({ path: resolve(OUT, '02-studio-after-click.png'), fullPage: false });
  const headerText = await studio.locator('header').textContent({ timeout: 3000 }).catch(() => 'header read failed');
  log(`studio header: ${headerText?.slice(0, 200)}`);

  await ctx.close();
  log('DONE');
})().catch((e) => { console.error('FATAL:', e); process.exit(2); });
