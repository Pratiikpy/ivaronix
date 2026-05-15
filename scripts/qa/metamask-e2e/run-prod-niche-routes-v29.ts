/**
 * v29 · /data-room/<id> + /delegate/<addr> render check.
 *
 * Two niche route families left unexercised in the launch-ready sweep.
 * Browser-only at 1440×900; verifies the page renders something
 * judge-readable (either a real data room / delegate state, or a
 * clean empty/not-found state with brand chrome).
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-niche-routes-v29');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try { await page.screenshot({ path: resolve(OUT, safe), fullPage: true }); log(`📸 ${safe}`); } catch {}
}

async function check(page: Page, path: string, label: string, results: any[]): Promise<void> {
  const url = `${STUDIO}${path}?cb=${Date.now()}`;
  log(`\n=== ${path} ===`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(5_000);
  await snap(page, label);
  const title = await page.title().catch(() => '');
  const hasHeader = await page.locator('text=/IVARONIX/i').first().isVisible({ timeout: 1_500 }).catch(() => false);
  const hasFooter = await page.locator('text=/0G Aristotle|chainId/i').first().isVisible({ timeout: 1_500 }).catch(() => false);
  log(`  title="${title.slice(0, 60)}" header=${hasHeader} footer=${hasFooter}`);
  results.push({ path, url, title: title.slice(0, 60), hasHeader, hasFooter });
}

async function main(): Promise<void> {
  log(`v29 · /data-room + /delegate niche routes render check`);
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const results: any[] = [];

  try {
    await check(page, '/data-room/test-data-room-001', 'data-room-test', results);
    await check(page, '/delegate/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce', 'delegate-operator', results);

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({ studio: STUDIO, results }, null, 2));
    log(`\n=== Summary ===`);
    for (const r of results) log(`  ${r.path}: title="${r.title.slice(0, 40)}" header=${r.hasHeader} footer=${r.hasFooter}`);
  } finally {
    await ctx.close().catch(() => {});
    log(`=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
