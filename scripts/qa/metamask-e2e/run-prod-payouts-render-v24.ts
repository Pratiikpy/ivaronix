/**
 * v24 · /marketplace/payouts render check.
 *
 * Loads the page in fresh incognito Chromium (no MM), captures the
 * connect-cta empty-state. Confirms the page renders cleanly before
 * v25 drives the real-MM withdraw flow.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK', 'submission-final', 'mm-prod-payouts-v24');
mkdirSync(OUT, { recursive: true });
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

function log(m: string): void { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

async function main(): Promise<void> {
  log(`v24 · /marketplace/payouts render check`);
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  try {
    const url = `${STUDIO}/marketplace/payouts?cb=${Date.now()}`;
    log(`GET ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(6_000);
    await page.screenshot({ path: resolve(OUT, '001-payouts-no-wallet.png'), fullPage: true });
    log(`📸 001-payouts-no-wallet.png`);

    const title = await page.title().catch(() => '');
    const connectCta = await page.locator('text=/connect wallet/i').first().isVisible({ timeout: 2_000 }).catch(() => false);
    const hasPayoutsHeading = await page.locator('text=/payouts|creator earnings|pending/i').first().isVisible({ timeout: 2_000 }).catch(() => false);
    const hasError = await page.locator('text=/404|not found|something went wrong/i').first().isVisible({ timeout: 1_000 }).catch(() => false);
    const withdrawBtn = await page.locator('button:has-text("Withdraw")').count().catch(() => 0);

    log(`  title="${title.slice(0, 60)}"`);
    log(`  connectCta=${connectCta} payoutsHeading=${hasPayoutsHeading} error=${hasError} withdrawBtn=${withdrawBtn}`);

    writeFileSync(resolve(OUT, 'final.json'), JSON.stringify({
      url, title, connectCta, hasPayoutsHeading, hasError, withdrawBtn,
      passed: !hasError && hasPayoutsHeading,
    }, null, 2));
  } finally {
    await ctx.close().catch(() => {});
    log(`=== DONE ===`);
  }
}

main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1); });
