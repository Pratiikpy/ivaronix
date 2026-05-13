/**
 * UI_REAL_USER_TEST_PLAN.md Priority 4 · Receipt / Proof Explorer.
 *
 * Tests against the real anchored receipts 16 + 17 (from P2 demo flow).
 * Plain Chromium · no MM required for proof-page surfaces.
 *
 * Surfaces covered:
 *   - /r/<id>               · proof page render + chips
 *   - /r/<id>/print         · printable view
 *   - /r/<id>/opengraph-image · 1200×630 PNG
 *   - /embed/r/<id>         · embeddable card
 *   - /r/<id> in incognito · stranger-replay test (the kill-shot)
 *
 * Captures at 1440×900 desktop and 375×812 mobile per CLAUDE.md §11.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const RECEIPT_IDS = ['16', '17', '1004']; // 16=desktop demo · 17=mobile demo · 1004=canonical sample
const SHOTS_BASE = resolve(REPO, 'QA_PROOF_PACK/ui/P4-receipt');

for (const id of RECEIPT_IDS) {
  for (const sub of ['desktop', 'mobile', 'video']) {
    mkdirSync(resolve(SHOTS_BASE, `r-${id}`, sub), { recursive: true });
  }
}

let step = 0;
async function snap(page: Page, scope: string, name: string, viewport: 'desktop' | 'mobile'): Promise<void> {
  step += 1;
  const filename = `${String(step).padStart(3, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  const path = resolve(SHOTS_BASE, scope, viewport, filename);
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path, fullPage: false });
    console.log(`  📸 ${scope}/${viewport}/${filename}`);
  } catch (e) {
    console.log(`  (skip) ${scope}/${viewport}/${filename} — ${(e as Error).message.split('\n')[0]}`);
  }
}

async function captureReceipt(receiptId: string, viewport: 'desktop' | 'mobile'): Promise<void> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  const scope = `r-${receiptId}`;
  console.log(`\n=== /r/${receiptId} ${viewport.toUpperCase()} ${size.width}×${size.height} ===`);
  step = 0;

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: size,
    recordVideo: { dir: resolve(SHOTS_BASE, scope, 'video'), size },
  });
  const page = await ctx.newPage();

  // 1. Proof page
  console.log(`  → ${STUDIO}/r/${receiptId}`);
  await page.goto(`${STUDIO}/r/${receiptId}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3_000);
  await snap(page, scope, 'proof-loaded', viewport);

  // Inspect chips
  const verifyState = await page.locator('[class*="chip"], [class*="status"]').first().textContent().catch(() => '?');
  console.log(`  chip text: "${verifyState}"`);

  // Scroll capture
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await snap(page, scope, 'proof-mid', viewport);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await snap(page, scope, 'proof-bottom', viewport);

  // 2. Print page
  await page.goto(`${STUDIO}/r/${receiptId}/print`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(2_000);
  await snap(page, scope, 'print-view', viewport);

  // 3. Embed view
  await page.goto(`${STUDIO}/embed/r/${receiptId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(2_000);
  await snap(page, scope, 'embed-view', viewport);

  // 4. OG image (open directly · should return PNG)
  const ogResp = await page.goto(`${STUDIO}/r/${receiptId}/opengraph-image`, { waitUntil: 'load', timeout: 30_000 }).catch(() => null);
  if (ogResp) {
    const contentType = ogResp.headers()['content-type'];
    console.log(`  OG image content-type: ${contentType}`);
    await page.waitForTimeout(1_000);
    await snap(page, scope, 'og-image-preview', viewport);
  }

  await ctx.close();
  await browser.close();
}

async function strangerReplay(receiptId: string): Promise<void> {
  console.log(`\n=== STRANGER REPLAY · /r/${receiptId} in incognito · no wallet ===`);
  const scope = `r-${receiptId}`;
  step = 0;

  const browser = await chromium.launch({ headless: false });
  // Brand-new incognito context: no cookies, no auth, no wallet
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: resolve(SHOTS_BASE, scope, 'video'), size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();

  console.log(`  → ${STUDIO}/r/${receiptId} (no cookies, no wallet)`);
  const resp = await page.goto(`${STUDIO}/r/${receiptId}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(3_500);
  console.log(`  status: ${resp?.status() ?? '?'} · url: ${page.url()}`);
  await snap(page, scope, 'stranger-incognito-loaded', 'desktop');

  // Scroll through
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await snap(page, scope, 'stranger-incognito-mid', 'desktop');

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await snap(page, scope, 'stranger-incognito-bottom', 'desktop');

  await ctx.close();
  await browser.close();
}

async function main(): Promise<void> {
  console.log('UI_REAL_USER_TEST_PLAN.md · P4 Receipt Explorer');
  console.log(`Target: ${STUDIO}`);
  console.log(`Receipts: ${RECEIPT_IDS.join(', ')}`);
  console.log(`Output: ${SHOTS_BASE}\n`);

  // Capture each receipt at desktop + mobile + stranger-replay
  for (const id of RECEIPT_IDS) {
    await captureReceipt(id, 'desktop');
    await captureReceipt(id, 'mobile');
    await strangerReplay(id);
  }

  console.log('\n✓ P4 capture complete · agent visual inspection next');

  writeFileSync(
    resolve(SHOTS_BASE, 'summary.json'),
    JSON.stringify({ studio: STUDIO, receiptIds: RECEIPT_IDS, timestamp: new Date().toISOString() }, null, 2),
  );
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
