// E2E verification for planning-01 §3D (embeddable receipt-verifier widget).
// Loads /embed/r/1004, takes a snapshot at iframe-typical sizes (600×420
// and 320×420), and a desktop full-page snap to confirm the embedded
// surface is iframe-safe (no Studio chrome).

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', '3d-widget');
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
    viewport: { width: 600, height: 420 },
    recordVideo: { dir: SHOTS_DIR, size: { width: 600, height: 420 } },
  });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();

  // 600x420 — typical embed sidebar
  await visit(page, '/embed/r/1004', 4_500);
  await snap(page, 'embed-600x420');

  // 320x420 — narrow column embed
  await page.setViewportSize({ width: 320, height: 420 });
  await visit(page, '/embed/r/1004', 3_500);
  await snap(page, 'embed-320x420');

  // Larger viewport to verify maxWidth caps the card
  await page.setViewportSize({ width: 1200, height: 800 });
  await visit(page, '/embed/r/1004', 3_500);
  await snap(page, 'embed-1200x800');

  // Embed a third-party host page that includes <script src="/embed.js">
  // via a temp HTML file written to disk and loaded as file://
  const hostHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Third-party page demo · Ivaronix widget</title>
  <style>
    body { margin: 0; padding: 48px; font-family: system-ui, sans-serif; background: #f5f5f5; max-width: 800px; margin: 0 auto; }
    h1 { color: #222; }
    p { color: #555; line-height: 1.6; max-width: 600px; }
    .receipt-card { margin: 32px 0; }
  </style>
</head>
<body>
  <h1>Sample partner blog</h1>
  <p>This is a third-party site embedding an Ivaronix receipt verifier. The card below is the widget — the third-party visitor sees the receipt's tier, anchor, and a link to the canonical Studio page.</p>
  <div class="receipt-card">
    <iframe
      src="http://localhost:3300/embed/r/1004"
      title="Ivaronix receipt #1004"
      style="border:0;width:100%;max-width:600px;height:420px;display:block;"
      loading="lazy"
      referrerpolicy="no-referrer"
    ></iframe>
  </div>
  <p>Anyone with the receipt id can drop this snippet on any HTML page and the embedded summary becomes verifiable to their visitors. No client connection. No analytics.</p>
</body>
</html>
`;
  const hostPath = resolve(SHOTS_DIR, 'sample-partner-page.html');
  writeFileSync(hostPath, hostHtml);
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto(`file:///${hostPath.replace(/\\/g, '/')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5_500);
  await snap(page, 'partner-page-with-iframe');

  // Voice + content checks on the embedded page
  await page.goto('http://localhost:3300/embed/r/1004', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3_000);
  const text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  const checks: Array<[string, RegExp]> = [
    ['Status chip rendered', /FULLY VERIFIED|ANCHORED|CLAIMED/i],
    ['Tier badge rendered', /TIER 1|TIER 2/i],
    ['View full receipt CTA', /view full receipt/i],
    ['Footer signature', /verified by ivaronix/i],
  ];
  for (const [label, rx] of checks) console.log(rx.test(text) ? `   ✓ ${label}` : `   ✗ ${label}`);

  await ctx.close();
  await browser.close();
  console.log('\n=== verify-3d complete ===');
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
