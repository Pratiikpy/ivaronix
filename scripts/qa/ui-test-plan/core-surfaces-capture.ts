/**
 * Core-surface captures for the 4 wallet-required pages.
 * Disconnected (no wallet) state · production Vercel · 1440x900 + 375x812.
 *
 * Per CLAUDE.md §17.7 the agent reads each captured PNG and surfaces
 * anomalies before declaring PASS.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

const ROUTES = [
  { slug: 'memory', path: '/memory' },
  { slug: 'agents', path: '/agents' },
  { slug: 'dashboard', path: '/dashboard' },
  { slug: 'marketplace', path: '/marketplace' },
  { slug: 'onboard', path: '/onboard' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
] as const;

async function captureRoute(page: Page, url: string, slug: string, viewport: string): Promise<void> {
  const out = resolve(REPO, 'QA_PROOF_PACK/ui/post-rewrite-core-surfaces', viewport);
  mkdirSync(out, { recursive: true });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
  await page.waitForTimeout(1200);
  const file = resolve(out, `${slug}-001-loaded.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ${viewport}/${slug}-001-loaded.png`);
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
  console.log(`\nCapture complete. PNGs under QA_PROOF_PACK/ui/post-rewrite-core-surfaces/{desktop,mobile}/`);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
