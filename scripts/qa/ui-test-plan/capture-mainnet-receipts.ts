/**
 * Capture mainnet receipt pages /r/0..6 on ivaronix.vercel.app (post-§PHASE 5
 * Vercel cutover). Proves the Studio's V3 reads + mainnet manifest import
 * actually render in production.
 *
 * Output: QA_PROOF_PACK/mainnet/§phase5-vercel/r-<id>-{desktop,mobile}.png
 *
 * Usage:
 *   STUDIO_BASE=https://ivaronix.vercel.app pnpm tsx scripts/qa/ui-test-plan/capture-mainnet-receipts.ts
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'QA_PROOF_PACK/mainnet/§phase5-vercel');
const STUDIO_BASE = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const RECEIPTS = ['0', '1', '2', '3', '4', '6']; // skip 5 (v1.1-3 first run · classifier bug · superseded by 6)

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2 },
];

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[capture] base    ${STUDIO_BASE}`);
  console.log(`[capture] receipts ${RECEIPTS.join(', ')}`);
  console.log(`[capture] out     ${OUT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });
  const results: Array<{ url: string; status: 'ok' | 'fail'; bytes?: number; error?: string }> = [];

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        userAgent: 'Mozilla/5.0 (Ivaronix-§PHASE5-verify/1.0)',
      });

      // Capture home + global first
      for (const path of ['/', '/global', '/legal', '/marketplace']) {
        const page = await context.newPage();
        const url = `${STUDIO_BASE}${path}`;
        const safeName = path.replace(/\//g, '-').replace(/^-/, '') || 'home';
        const outPath = resolve(OUT_DIR, `${safeName || 'home'}-${vp.name}.png`);
        try {
          const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
          const status = resp?.status();
          await page.waitForTimeout(800);
          await page.screenshot({ path: outPath, fullPage: true });
          const bytes = (await page.evaluate(() => document.documentElement.outerHTML.length));
          results.push({ url: `${path} ${vp.name} (HTTP ${status})`, status: status === 200 ? 'ok' : 'fail', bytes });
          console.log(`  ${path} ${vp.name}: HTTP ${status} · ${bytes}B · ${outPath}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push({ url: `${path} ${vp.name}`, status: 'fail', error: msg.slice(0, 120) });
          console.log(`  ${path} ${vp.name}: ERR ${msg.slice(0, 120)}`);
        }
        await page.close();
      }

      // Capture each mainnet receipt page
      for (const id of RECEIPTS) {
        const page = await context.newPage();
        const url = `${STUDIO_BASE}/r/${id}`;
        const outPath = resolve(OUT_DIR, `r-${id}-${vp.name}.png`);
        try {
          const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
          const status = resp?.status();
          await page.waitForTimeout(1200);
          await page.screenshot({ path: outPath, fullPage: true });
          const title = await page.title();
          const has404 = await page.evaluate(() => document.body.textContent?.includes('NOT FOUND') ?? false);
          results.push({ url: `/r/${id} ${vp.name} (HTTP ${status} · 404:${has404})`, status: status === 200 && !has404 ? 'ok' : 'fail' });
          console.log(`  /r/${id} ${vp.name}: HTTP ${status} · title="${title.slice(0, 60)}" · has404=${has404} · ${outPath}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push({ url: `/r/${id} ${vp.name}`, status: 'fail', error: msg.slice(0, 120) });
          console.log(`  /r/${id} ${vp.name}: ERR ${msg.slice(0, 120)}`);
        }
        await page.close();
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  console.log(`\n=== DONE · ${ok} ok · ${fail} fail ===`);
  console.log(`screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
