/**
 * Post-rewrite capture for the 3 new routes shipped this cron run:
 * /learn · /faq · /docs · against production Vercel · 1440x900 + 375x812.
 *
 * Per CLAUDE.md §17.7 the agent reads each captured PNG after this script
 * to surface anomalies before declaring PASS.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

const ROUTES = [
  { slug: 'learn', path: '/learn' },
  { slug: 'faq', path: '/faq' },
  { slug: 'docs', path: '/docs' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

async function captureRoute(page: Page, url: string, slug: string, viewport: string): Promise<void> {
  const out = resolve(REPO, 'QA_PROOF_PACK/ui/post-rewrite-new-routes', viewport);
  mkdirSync(out, { recursive: true });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(800);
  const file = resolve(out, `${slug}-001-loaded.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ${viewport}/${slug}-001-loaded.png`);
  // Scroll to bottom for full-page sample
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const fileBottom = resolve(out, `${slug}-002-bottom.png`);
  await page.screenshot({ path: fileBottom, fullPage: false });
  console.log(`  ${viewport}/${slug}-002-bottom.png`);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const { name, width, height } of VIEWPORTS) {
      console.log(`\n=== ${name.toUpperCase()} ${width}x${height} ===\n`);
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      for (const { slug, path } of ROUTES) {
        console.log(`→ ${STUDIO}${path}`);
        await captureRoute(page, `${STUDIO}${path}`, slug, name);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\nCapture complete. PNGs under QA_PROOF_PACK/ui/post-rewrite-new-routes/{desktop,mobile}/`);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
