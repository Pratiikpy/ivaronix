/**
 * v18 · proof page /r/<id> stranger-replay verification.
 *
 * Loads /r/3 + /r/4 in a FRESH incognito Chromium (no MM, no wallet auth,
 * no cookies). Captures screenshots + extracts the verification chip text.
 * A stranger / judge on a different machine MUST be able to load these
 * pages and see "FULLY VERIFIED" or "ANCHORED" without any setup.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-proof-page-v18');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

function log(msg: string): void {
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(`[${stamp}] ${msg}`);
}

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const safe = `${String(stepNum).padStart(3, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(OUT, safe), fullPage: false });
    log(`📸 ${safe}`);
  } catch {}
}

async function checkReceipt(page: Page, id: number, results: any[]): Promise<void> {
  const url = `${STUDIO}/r/${id}`;
  log(`\n=== /r/${id} stranger-load ===`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8_000);
  await snap(page, `r-${id}-loaded`);

  // Look for verification chip text
  const chipTexts = ['FULLY VERIFIED', 'ANCHORED', 'TIER 1', 'TIER 2', 'BURN MODE', '0GM', 'VERIFIED'];
  const found: string[] = [];
  for (const t of chipTexts) {
    const el = page.locator(`text=/${t}/i`).first();
    if (await el.isVisible({ timeout: 1_500 }).catch(() => false)) found.push(t);
  }
  log(`  chips found: ${found.join(', ') || '(none)'}`);

  // Look for tx hash
  const txMatch = await page.locator('text=/0x[a-f0-9]{64}/i').allTextContents().catch(() => []);
  log(`  on-page tx hashes: ${txMatch.slice(0, 3).join(', ') || '(none visible)'}`);

  // Look for chainscan link
  const chainscanCount = await page.locator('a[href*="chainscan"]').count();
  log(`  chainscan links: ${chainscanCount}`);

  // Look for any error indicators
  const errorEl = page.locator('text=/error|not found|404|invalid/i').first();
  const hasError = await errorEl.isVisible({ timeout: 1_000 }).catch(() => false);
  log(`  error visible: ${hasError}`);

  results.push({ id, url, chips: found, txOnPage: txMatch.slice(0, 3), chainscanLinks: chainscanCount, hasError });
}

async function main(): Promise<void> {
  log(`v18 · proof page stranger-replay verification`);
  log(`Studio: ${STUDIO}`);

  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  log(`Fresh incognito browser (no MM, no cookies, no auth)`);

  const page = await ctx.newPage();
  const results: any[] = [];

  try {
    // Check receipts 1-5 (mainnet receipt IDs)
    for (const id of [1, 2, 3, 4, 5]) {
      await checkReceipt(page, id, results);
    }

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({ studio: STUDIO, results }, null, 2));
    log(`\n=== Summary ===`);
    for (const r of results) log(`  /r/${r.id}: chips=[${r.chips.join('|')}] · scanlinks=${r.chainscanLinks} · error=${r.hasError}`);
  } finally {
    await ctx.close().catch(() => {});
    log(`\n=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
