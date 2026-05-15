/**
 * v26 · /r/<id>/print + /embed/r/<id> render check on production.
 *
 * Two judge-facing surfaces left unexercised end-to-end:
 *   /r/<id>/print  — printable receipt (judge prints as PDF for archive)
 *   /embed/r/<id>  — embed iframe view (judge pastes into a slide deck)
 *
 * No MM, browser-only · receipt 19 is the latest mainnet V3 anchor.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-print-embed-v26');
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
  await snap(page, `route-${label}`);
  const title = await page.title().catch(() => '');
  const is404 = await page.locator('text=/Nothing here\\. Yet\\./i').first().isVisible({ timeout: 1_500 }).catch(() => false);
  const hasReceiptId = await page.locator('text=/receipt/i').first().isVisible({ timeout: 1_500 }).catch(() => false);
  const hasAnchored = await page.locator('text=/anchored|verified/i').first().isVisible({ timeout: 1_500 }).catch(() => false);
  const hasError = await page.locator('text=/404|server error/i').first().isVisible({ timeout: 1_500 }).catch(() => false);
  log(`  title="${title.slice(0, 60)}" is404=${is404} hasReceiptId=${hasReceiptId} anchored=${hasAnchored} error=${hasError}`);
  results.push({ path, url, title: title.slice(0, 60), is404, hasReceiptId, hasAnchored, hasError, passed: !is404 && !hasError });
}

async function main(): Promise<void> {
  log(`v26 · /r/<id>/print + /embed/r/<id> render check · mainnet receipt 19`);
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  const results: any[] = [];

  try {
    await check(page, '/r/18', 'r-18', results);
    await check(page, '/r/18/print', 'r-18-print', results);
    await check(page, '/embed/r/18', 'r-18-embed', results);

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({ studio: STUDIO, results }, null, 2));
    log(`\n=== Summary ===`);
    for (const r of results) log(`  ${r.path}: ${r.passed ? '✓' : '✗'} title="${r.title.slice(0, 40)}"`);
  } finally {
    await ctx.close().catch(() => {});
    log(`=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
