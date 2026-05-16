/**
 * Capture the three submission-video title cards from the local HTML
 * source at scripts/diag/submission-cards.html.
 *
 * Output: docs/video/cards/{01-intro,02-primitives,03-outro}.png at
 * 1920×1080.
 */

import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SOURCE = `file:///${resolve(HERE, 'submission-cards.html').replace(/\\/g, '/')}`;
const OUT = resolve(REPO_ROOT, 'docs', 'video', 'cards');
mkdirSync(OUT, { recursive: true });

const CARDS = [
  { id: 'intro', file: '01-intro.png' },
  { id: 'primitives', file: '02-primitives.png' },
  { id: 'cli', file: '03-cli.png' },
  { id: 'outro', file: '04-outro.png' },
];

async function shootEach(page: Page): Promise<void> {
  await page.goto(SOURCE, { waitUntil: 'domcontentloaded' });
  // Let Google Fonts settle.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  for (const card of CARDS) {
    const sel = `section#${card.id}`;
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const out = resolve(OUT, card.file);
    await page.locator(sel).screenshot({ path: out });
    console.log(`[card] ${card.id} → ${out.replace(REPO_ROOT, '.')}`);
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    await shootEach(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
