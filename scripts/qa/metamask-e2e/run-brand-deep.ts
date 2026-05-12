/**
 * QA: deep brand parity — compare standalone brand kit vs Studio /brand
 * at multiple scroll positions. Captures a side-by-side mosaic per section.
 *
 * The standalone brand kit has these sections (from its own nav):
 *   Overview / Logo / Color / Type / Voice / Components / Tokens
 *
 * For each section, we scroll the standalone HTML and Studio /brand to
 * matching anchors and snapshot. End report logs whether each section
 * has a matching counterpart in Studio.
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const EXTENSION_PATH = resolve(HERE, 'mm', 'extension');
const USER_DATA_DIR = resolve(HERE, 'mm', 'profile');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'brand-deep');
mkdirSync(SHOTS_DIR, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'http://localhost:3300';
const BRAND_STANDALONE = 'C:/Users/prate/Downloads/Ivaronix Brand Kit _standalone_.html';
const BRAND_REPO = resolve(REPO, 'brand', 'Ivaronix.html');

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
    console.log(`   (skip) ${name} — ${(e as Error).message.split('\n')[0]}`);
    return '';
  }
}

async function findExtensionId(context: BrowserContext): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const sw = context.serviceWorkers();
    if (sw.length > 0) {
      const m = sw[0].url().match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('extension service worker not found');
}

async function captureFullPageSection(page: Page, label: string, scrolls: number[]): Promise<void> {
  for (const y of scrolls) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(800);
    await snap(page, `${label}-y${y}`);
  }
}

async function main(): Promise<void> {
  console.log('=== launching Chromium ===');
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
    recordVideo: { dir: SHOTS_DIR, size: { width: 1440, height: 900 } },
  });
  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(120_000);

  const extId = await findExtensionId(context);
  console.log(`   ext id: ${extId}`);

  // Standalone brand kit — full scroll capture
  console.log('\n=== capturing standalone brand kit at multiple scroll positions ===');
  const standalone = await context.newPage();
  await standalone.goto(`file:///${BRAND_STANDALONE.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await standalone.waitForTimeout(2_500);
  // Capture top + 6 scrolled positions (kit has ~8 sections)
  await captureFullPageSection(standalone, 'standalone', [0, 900, 1800, 2700, 3600, 4500, 5400]);
  // Inspect the page content to enumerate section anchors
  const sectionAnchors = await standalone.evaluate(() => {
    const anchors: { id: string; text: string; top: number }[] = [];
    document.querySelectorAll('section, article, [id]').forEach((el) => {
      const id = (el as HTMLElement).id;
      if (id) {
        const text = (el as HTMLElement).innerText.split('\n')[0].slice(0, 50);
        anchors.push({ id, text, top: el.getBoundingClientRect().top + window.scrollY });
      }
    });
    return anchors;
  }).catch(() => []);
  console.log(`   standalone has ${sectionAnchors.length} anchored sections`);
  for (const a of sectionAnchors.slice(0, 10)) {
    console.log(`     #${a.id} @ y=${Math.round(a.top)}px — "${a.text}"`);
  }
  await standalone.close();

  // Repo brand HTML — full scroll capture for comparison
  console.log('\n=== capturing repo brand HTML at multiple scroll positions ===');
  const repoBrand = await context.newPage();
  await repoBrand.goto(`file:///${BRAND_REPO.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await repoBrand.waitForTimeout(2_500);
  await captureFullPageSection(repoBrand, 'repo-brand', [0, 900, 1800, 2700, 3600, 4500, 5400]);
  await repoBrand.close();

  // Studio /brand — full scroll capture
  console.log('\n=== capturing Studio /brand at multiple scroll positions ===');
  const studio = await context.newPage();
  await studio.goto(`${STUDIO}/brand`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(3_000);
  await captureFullPageSection(studio, 'studio-brand', [0, 900, 1800, 2700, 3600, 4500, 5400]);
  // Enumerate Studio /brand section anchors
  const studioAnchors = await studio.evaluate(() => {
    const anchors: { id: string; text: string; top: number }[] = [];
    document.querySelectorAll('section, article, [id]').forEach((el) => {
      const id = (el as HTMLElement).id;
      if (id) {
        const text = (el as HTMLElement).innerText.split('\n')[0].slice(0, 50);
        anchors.push({ id, text, top: el.getBoundingClientRect().top + window.scrollY });
      }
    });
    return anchors;
  }).catch(() => []);
  console.log(`   Studio /brand has ${studioAnchors.length} anchored sections`);
  for (const a of studioAnchors.slice(0, 10)) {
    console.log(`     #${a.id} @ y=${Math.round(a.top)}px — "${a.text}"`);
  }

  // Header/footer pixel inspection
  console.log('\n=== Studio /brand header inspection ===');
  const headerInfo = await studio.evaluate(() => {
    const header = document.querySelector('header, [role="banner"], nav') as HTMLElement | null;
    if (!header) return null;
    const cs = getComputedStyle(header);
    return {
      tag: header.tagName,
      height: cs.height,
      position: cs.position,
      backdropFilter: cs.backdropFilter || cs.getPropertyValue('-webkit-backdrop-filter'),
      borderBottom: cs.borderBottom,
      bg: cs.backgroundColor,
      logoText: header.innerText.split('\n')[0],
    };
  }).catch(() => null);
  console.log('   Studio header:', JSON.stringify(headerInfo));

  console.log('\n=== Studio / footer inspection ===');
  await studio.goto(`${STUDIO}/`, { waitUntil: 'domcontentloaded' });
  await studio.waitForTimeout(2_500);
  const footerInfo = await studio.evaluate(() => {
    const footer = document.querySelector('footer') as HTMLElement | null;
    if (!footer) return null;
    const cs = getComputedStyle(footer);
    return {
      height: cs.height,
      display: cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      borderTop: cs.borderTop,
      bg: cs.backgroundColor,
      text: footer.innerText.slice(0, 200),
    };
  }).catch(() => null);
  console.log('   Studio footer:', JSON.stringify(footerInfo));

  console.log('\n=== closing context ===');
  await context.close();
  console.log(`\nDone. Outputs in: ${SHOTS_DIR}`);
}

main().catch((err: Error) => {
  console.error('FAIL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
