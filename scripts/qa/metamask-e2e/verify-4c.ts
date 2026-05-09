// Quick verify for /agents leaderboard (planning-01 §4C).

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '4c-agents');
mkdirSync(SHOTS_DIR, { recursive: true });

let n = 0;
async function snap(page: Page, label: string): Promise<void> {
  n++;
  const name = `${String(n).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false }); console.log(`   ${name}`); }
  catch (e) { console.log(`   skip ${name}: ${(e as Error).message.slice(0, 60)}`); }
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();

  await page.goto('http://localhost:3300/agents', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(
    () => !/Loading from chain/i.test(document.body.innerText || ''),
    { timeout: 30_000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await snap(page, 'agents-desktop');

  const text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const checks: Array<[string, RegExp]> = [
    ['heading', /Every passport on this network/i],
    ['column · trust', /TRUST/],
    ['column · receipts', /RECEIPTS/i],
    ['tier badge', /Council|Veteran|Trusted|Verified|Newcomer/],
    ['operator wallet visible', /0xaa95/i],
  ];
  for (const [label, rx] of checks) console.log(rx.test(text) ? `   ✓ ${label}` : `   ✗ ${label}`);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:3300/agents', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => !/Loading from chain/i.test(document.body.innerText || ''), { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await snap(page, 'agents-mobile');

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-4c complete ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); process.exit(1); });
