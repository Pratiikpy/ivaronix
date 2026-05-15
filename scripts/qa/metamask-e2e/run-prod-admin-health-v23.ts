/**
 * v23 · Verify /admin/health renders on production after the 5a4eda9 deploy.
 *
 * Loads https://ivaronix.vercel.app/admin/health in a fresh incognito
 * Chromium at 1440x900, captures a screenshot, extracts the contracts
 * count + receipt count + status chip text. The previous v22 sweep caught
 * the 404 → this is the fix-verification round.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-admin-health-v23');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

function log(m: string): void {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
}

async function main(): Promise<void> {
  log(`v23 · verify /admin/health on production (post-5a4eda9 deploy)`);
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();

  try {
    // Cache-buster to bypass Vercel edge's stale 404 from pre-deploy.
    const url = `${STUDIO}/admin/health?cb=${Date.now()}`;
    log(`GET ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(8_000);
    await page.screenshot({ path: resolve(OUT, '001-admin-health-loaded.png'), fullPage: true });
    log(`📸 001-admin-health-loaded.png`);

    // Check we're NOT on the 404 page anymore
    const is404 = await page.locator('text=/Nothing here\\. Yet\\./i').isVisible({ timeout: 2_000 }).catch(() => false);
    const hasSystemHealth = await page.locator('text=/System health/i').isVisible({ timeout: 2_000 }).catch(() => false);
    const hasRpcOk = await page.locator('text=/RPC OK/i').isVisible({ timeout: 2_000 }).catch(() => false);
    const contractsTableRows = await page.locator('table tbody tr').count().catch(() => 0);
    const blockNumberText = await page.locator('text=/currentBlock/i').first().textContent().catch(() => '');

    log(`---`);
    log(`is404=${is404} hasSystemHealth=${hasSystemHealth} hasRpcOk=${hasRpcOk}`);
    log(`contracts in table: ${contractsTableRows}`);
    log(`currentBlock row text: "${(blockNumberText || '').slice(0, 80)}"`);

    // Scroll to bottom + capture full page state
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: resolve(OUT, '002-admin-health-scrolled.png'), fullPage: true });
    log(`📸 002-admin-health-scrolled.png`);

    const status = {
      url,
      is404,
      hasSystemHealth,
      hasRpcOk,
      contractsTableRows,
      passed: !is404 && hasSystemHealth && hasRpcOk && contractsTableRows > 0,
    };
    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify(status, null, 2));
    log(status.passed ? `\n=== PASS ===` : `\n=== FAIL ===`);
    log(JSON.stringify(status, null, 2));
  } finally {
    await ctx.close().catch(() => {});
    log(`=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
