/**
 * Record a tight submission walkthrough against the live mainnet site
 * (https://www.ivaronix.xyz). Output is a single Playwright .webm in
 * docs/video/raw/.
 *
 * The walkthrough sequence (≈ 80 seconds at 1920×1080):
 *
 *   1. Home page · "45 RECEIPTS ON-CHAIN · LIVE" chip in view (5s)
 *   2. Scroll past hero into the "Run on my own doc" Run panel (5s)
 *   3. Click into "/marketplace" via nav (3s)
 *   4. Marketplace · 5 skills with 90/10 split visible (8s)
 *   5. Click into a skill detail page (5s)
 *   6. Navigate to /r/14 receipt page (10s) — shows ANCHORED · TIER 1 · TEE chips
 *   7. Scroll receipt page to show chain anchor + receiptRoot + agent (8s)
 *   8. Click chainscan link · external proof (5s)
 *   9. Navigate to /agents leaderboard (5s)
 *  10. Navigate to /dashboard with /agent/<addr> (8s)
 *  11. Navigate to /skills catalog (8s)
 *  12. Return home, show four-light row + live receipt count (8s)
 *
 * The recording is silent. Title cards and the CLI verify clip are
 * stitched on with ffmpeg downstream.
 *
 * No MetaMask, no wallet popup — every page is read-only. The receipts
 * shown are real, anchored on Aristotle mainnet.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync, renameSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'docs', 'video', 'raw');
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.SITE_BASE ?? 'https://www.ivaronix.xyz';

async function slowMove(page: Page, x: number, y: number): Promise<void> {
  // Smooth the cursor to a focal point so the recording isn't jumpy.
  await page.mouse.move(x, y, { steps: 20 });
}

async function record(): Promise<void> {
  const browser: Browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();

  // --- 1. Home page · live mainnet chip ------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3500);
  await slowMove(page, 600, 200);
  await page.waitForTimeout(2000);

  // --- 2. Scroll into Run panel --------------------------------------------
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(800);
  await slowMove(page, 1200, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await page.waitForTimeout(2500);

  // --- 3. Navigate to /marketplace -----------------------------------------
  await page.goto(`${BASE}/marketplace`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await slowMove(page, 400, 500);
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'smooth' }));
  await page.waitForTimeout(2500);

  // --- 4. Skill detail page ------------------------------------------------
  await page.goto(`${BASE}/marketplace/private-doc-review`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);

  // --- 5. Receipt proof page ----------------------------------------------
  await page.goto(`${BASE}/r/14`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  // Hover the four-light row chips for emphasis.
  await slowMove(page, 280, 600);
  await page.waitForTimeout(1500);
  await slowMove(page, 360, 600);
  await page.waitForTimeout(1500);
  await slowMove(page, 440, 600);
  await page.waitForTimeout(1500);
  await slowMove(page, 520, 600);
  await page.waitForTimeout(1500);

  // Scroll down to receiptRoot + agent + chainscan link.
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'smooth' }));
  await page.waitForTimeout(4000);

  // --- 6. Agents leaderboard -----------------------------------------------
  await page.goto(`${BASE}/agents`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);

  // --- 7. Skills catalog ---------------------------------------------------
  await page.goto(`${BASE}/skills`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);

  // --- 8. Return home, show four-light row + receipt count -----------------
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3500);

  // Close the context to flush the video to disk.
  await context.close();
  await browser.close();

  // Rename the Playwright-generated UUID file to a readable name.
  const files = readdirSync(OUT_DIR)
    .filter((n) => n.endsWith('.webm'))
    .map((n) => ({ n, t: statSync(join(OUT_DIR, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (files[0]) {
    const src = join(OUT_DIR, files[0].n);
    const dst = join(OUT_DIR, 'walkthrough.webm');
    try { renameSync(src, dst); console.log(`[record] saved → ${dst}`); }
    catch (e) { console.log(`[record] saved at ${src} (rename failed: ${e})`); }
  }
}

record().catch((err) => {
  console.error(err);
  process.exit(1);
});
