/**
 * Capture the four product screenshots that ship in the README.
 *
 * Targets the live production site at https://www.ivaronix.xyz so the
 * images mirror what a judge sees when they click through. No local
 * dev server, no operator wallet needed.
 *
 * Output: `docs/img/<NN-name>.png` — committed to the repo so GitHub
 * renders them inline.
 *
 * Run: `pnpm tsx scripts/diag/capture-readme-prod.ts`
 */

import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'docs', 'img');
mkdirSync(OUT_DIR, { recursive: true });

const BASE = process.env.SITE_BASE ?? 'https://www.ivaronix.xyz';
const RECEIPT_ID = process.env.RECEIPT_ID ?? '14';

const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 375, height: 812 } as const;

interface Shot {
  name: string;
  url: string;
  viewport: typeof DESKTOP | typeof MOBILE;
  postNav?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  {
    name: '01-home-desktop',
    url: `${BASE}/`,
    viewport: DESKTOP,
    postNav: async (page) => {
      // Let live chain reads land and animations settle.
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2500);
    },
  },
  {
    name: '02-receipt-proof',
    url: `${BASE}/r/${RECEIPT_ID}`,
    viewport: DESKTOP,
    postNav: async (page) => {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2500);
    },
  },
  {
    name: '03-marketplace',
    url: `${BASE}/marketplace`,
    viewport: DESKTOP,
    postNav: async (page) => {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2500);
    },
  },
  {
    name: '04-home-mobile',
    url: `${BASE}/`,
    viewport: MOBILE,
    postNav: async (page) => {
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2500);
    },
  },
];

async function main(): Promise<void> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    for (const shot of SHOTS) {
      const context = await browser.newContext({
        viewport: shot.viewport,
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      console.log(`[capture] ${shot.name} ← ${shot.url} (${shot.viewport.width}×${shot.viewport.height})`);
      await page.goto(shot.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (shot.postNav) await shot.postNav(page);
      const outPath = resolve(OUT_DIR, `${shot.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`         → ${outPath.replace(REPO_ROOT, '.')}`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
  }
  console.log(`\n[capture] done · ${SHOTS.length} screenshots in ${OUT_DIR.replace(REPO_ROOT, '.')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
