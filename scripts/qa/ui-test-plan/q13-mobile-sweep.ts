import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/mobile');
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  { path: '/', label: 'home' },
  { path: '/r/78', label: 'receipt-78' },
  { path: '/skills', label: 'skills' },
  { path: '/agents', label: 'agents' },
  { path: '/legal', label: 'legal' },
  { path: '/verticals', label: 'verticals' },
  { path: '/onboard', label: 'onboard' },
  { path: '/marketplace', label: 'marketplace' },
  { path: '/memory', label: 'memory' },
  { path: '/dashboard', label: 'dashboard' },
  { path: '/global', label: 'global' },
  { path: '/thesis', label: 'thesis' },
  { path: '/docs', label: 'docs' },
];

async function snap(page: Page, label: string): Promise<void> {
  const name = `${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await page.screenshot({ path: resolve(OUT, name), fullPage: false });
  console.log(`   📸 ${name}`);
}

async function main(): Promise<void> {
  console.log(`Studio: ${STUDIO}\nViewport: 375x812 (iPhone)`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  try {
    for (const r of ROUTES) {
      try {
        await page.goto(`${STUDIO}${r.path}`, { waitUntil: 'networkidle', timeout: 30_000 });
        await page.waitForTimeout(1500);
        const status = await page.evaluate(() => document.title || '?');
        console.log(`  ${r.path}: ${status}`);
        await snap(page, r.label);
      } catch (e) {
        console.log(`  ${r.path}: FAIL — ${(e as Error).message.split('\n')[0]}`);
      }
    }
  } finally {
    await ctx.close();
    await browser.close();
  }
  console.log(`\nDone · ${ROUTES.length} routes captured under ${OUT}`);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
