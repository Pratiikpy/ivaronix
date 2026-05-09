// E2E verification for Tier 4 · 4A (printable receipt page).
// Captures /r/1004/print at desktop + with print emulation so save-as-PDF
// is the literal snap. No MM required.

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '4a-print');
mkdirSync(SHOTS_DIR, { recursive: true });

let stepNum = 0;
async function snap(page: Page, label: string): Promise<void> {
  stepNum++;
  const name = `${String(stepNum).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  if (page.isClosed()) return;
  try {
    await page.screenshot({ path: resolve(SHOTS_DIR, name), fullPage: false });
    console.log(`   ${name}`);
  } catch (e) {
    console.log(`   skipped ${name}: ${(e as Error).message.slice(0, 80)}`);
  }
}

async function visit(page: Page, path: string, settleMs = 4_000): Promise<void> {
  await page.goto(`http://localhost:3300${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(settleMs);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 1400 }, // tall viewport so the full letterhead fits
    recordVideo: { dir: SHOTS_DIR, size: { width: 1024, height: 1400 } },
  });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();

  // Desktop · /r/1004/print
  console.log('=== /r/1004/print · desktop ===');
  await visit(page, '/r/1004/print', 4_500);
  await snap(page, 'print-receipt-1004-screen');

  // Voice + content checks
  const text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const checks: Array<[string, RegExp]> = [
    ['letterhead title', /Receipt #1004/i],
    ['status block', /FULLY VERIFIED|ANCHORED/],
    ['tier label', /TIER 1|TIER 2/],
    ['audit trail · receipt root', /receipt root/i],
    ['audit trail · agent wallet', /agent wallet/i],
    ['verify section', /Verify this receipt/i],
    ['three-command snippet', /tee-independent/i],
    ['footer signature', /receipt is the spine/i],
  ];
  for (const [label, rx] of checks) console.log(rx.test(text) ? `   ✓ ${label}` : `   ✗ ${label}`);

  // Print emulation — what the user would actually see in their PDF
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(500);
  await snap(page, 'print-receipt-1004-print-emulation');

  // Confirm chrome is gone in print mode (no header / footer / back link)
  const inPrintHidden = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.print-hide')) as HTMLElement[];
    if (els.length === 0) return false;
    return els.every((e) => getComputedStyle(e).display === 'none');
  }).catch(() => false);
  console.log(inPrintHidden ? '   ✓ print-hide controls hidden in print emulation' : '   ✗ controls still visible in print');

  // Same on receipt #1252 (the consolidation receipt) — sanity check the
  // priorReceiptIds and Burn Mode rendering handle that variant.
  await page.emulateMedia({ media: 'screen' });
  await visit(page, '/r/1252/print', 4_500);
  await snap(page, 'print-receipt-1252');

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-4a complete ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
