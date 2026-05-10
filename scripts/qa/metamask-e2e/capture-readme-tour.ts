/**
 * Capture a 30-60 second README "tour" video walking a viewer across
 * the canonical Ivaronix surfaces:
 *
 *   1. Studio home (hero + receipt counter + Run panel)
 *   2. /skills (catalog with verified manifests)
 *   3. /r/<id> (a real receipt's proof page; default 1004)
 *   4. /agents (passport leaderboard)
 *   5. /0g (the 0G primitive depth-proof page)
 *   6. /memory (per-wallet quick-capture demo)
 *
 * Every page renders from a real Studio dev server reading the live
 * Galileo testnet — no mocks. Closes the screen-recording side of
 * planning-003 §A.2.2.
 *
 * Output:
 *   screenshots/readme/tour.webm     ~600KB-2MB · 1280x720 · 30fps
 *
 * Usage:
 *   pnpm tour:refresh                # default: localhost:3300, 1004
 *   STUDIO_BASE=https://ivaronix-studio.vercel.app pnpm tour:refresh
 *   RECEIPT_ID=994 pnpm tour:refresh
 */

import { chromium, type Browser } from 'playwright';
import { mkdirSync, existsSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'screenshots', 'readme');
const FINAL_PATH = resolve(OUT_DIR, 'tour.webm');

const STUDIO_BASE = process.env.STUDIO_BASE ?? 'http://localhost:3300';
const RECEIPT_ID = process.env.RECEIPT_ID ?? '1004';

interface Stop {
  path: string;
  /** ms to dwell on this page so the viewer can read it. */
  dwellMs: number;
  /** Optional: per-page setup (scroll, click, etc.). */
  setup?: (page: import('playwright').Page) => Promise<void>;
}

const STOPS: Stop[] = [
  { path: '/', dwellMs: 5000 },
  { path: '/skills', dwellMs: 4000 },
  { path: `/r/${RECEIPT_ID}`, dwellMs: 7000, setup: async (page) => {
    // Slow scroll down so viewers see the receipt body, four-light row,
    // and the BURN MODE evidence-proof block.
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
  } },
  { path: '/agents', dwellMs: 4000 },
  { path: '/0g', dwellMs: 6000, setup: async (page) => {
    // Scroll past the hero into the 6-module grid.
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
  } },
  { path: '/memory', dwellMs: 4000 },
];

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[tour] base    ${STUDIO_BASE}`);
  console.log(`[tour] receipt ${RECEIPT_ID}`);
  console.log(`[tour] stops   ${STOPS.length}`);
  console.log(`[tour] out     ${FINAL_PATH}`);
  console.log('');

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      recordVideo: {
        dir: OUT_DIR,
        size: { width: 1280, height: 720 },
      },
    });
    const page = await context.newPage();

    for (const stop of STOPS) {
      const url = `${STUDIO_BASE}${stop.path}`;
      console.log(`[tour] -> ${stop.path}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 }).catch((err) => {
        console.warn(`  [tour] navigation warning: ${(err as Error).message}`);
      });
      if (stop.setup) await stop.setup(page);
      await page.waitForTimeout(stop.dwellMs);
    }

    // Closing the page first ensures the recording is flushed; the
    // video file lands in OUT_DIR with a generated name.
    await page.close();
    await context.close();

    // Rename the auto-generated webm to the canonical `tour.webm`.
    const webms = readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm') && f !== 'tour.webm');
    if (webms.length === 0) {
      console.error('[tour] no .webm produced');
      process.exit(1);
    }
    // Pick the most recent file (fs sorts deterministically; take last).
    const fresh = resolve(OUT_DIR, webms[webms.length - 1]!);
    if (existsSync(FINAL_PATH)) unlinkSync(FINAL_PATH);
    renameSync(fresh, FINAL_PATH);
    // Clean up any other stale recordings produced in the same run.
    for (const f of webms.slice(0, -1)) {
      try { unlinkSync(resolve(OUT_DIR, f)); } catch { /* ignore */ }
    }
    console.log(`[tour] done · ${FINAL_PATH}`);
  } finally {
    await browser?.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
