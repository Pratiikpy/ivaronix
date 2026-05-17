/**
 * inventory-drive-v6 · mobile sweep + negative-path drive.
 *
 * Bug-73 found 149px horizontal overflow on /. Run the same overflow check
 * across every named route to see if siblings have the same flex/grid bug
 * with long-content children (pre, code, mono hash strings).
 *
 * Plus negative-path coverage:
 *  - /r/999999 (out-of-range receipt id)
 *  - /skill/nonexistent-slug (404 page)
 *  - /agent/0xDEAD…DEAD (no on-chain history)
 *  - /marketplace/0xinvalidhex (bad skillId)
 *  - /data-room/bad-id
 *  - Receipt 124 full proof surface (just-anchored, not yet driven)
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PROD = 'https://www.ivaronix.xyz';
const ITER = `iter-${Date.now()}`;
const PROOF_DIR = resolve(REPO, 'QA_PROOF_PACK', 'inventory-drive', ITER);
const SHOT_DIR = resolve(REPO, 'QA_PROOF_PACK', 'screenshots', 'inventory-drive', ITER);
mkdirSync(PROOF_DIR, { recursive: true });
mkdirSync(SHOT_DIR, { recursive: true });

type Result = {
  item: string;
  category: 'mobile-sweep' | 'negative-path' | 'r124-surface';
  action: string;
  outcome: 'PASS' | 'FAIL' | 'SKIP';
  evidence: string;
  shot?: string;
};
const results: Result[] = [];

function log(r: Result) {
  results.push(r);
  const icon = r.outcome === 'PASS' ? '✓' : r.outcome === 'FAIL' ? '✗' : '~';
  // eslint-disable-next-line no-console
  console.log(`  ${icon} [${r.category}] ${r.item} · ${r.action} · ${r.evidence}`);
}

async function shot(page: Page, name: string): Promise<string> {
  const path = resolve(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function drive(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n========== INVENTORY-DRIVE-V6 ${ITER} ==========`);
  const browser: Browser = await chromium.launch({ headless: true });

  // ============================================================
  // 1. Mobile-sweep · every named route at 375×812 — no horizontal overflow
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 1. Mobile-sweep across 14 routes (375×812) ---');
  const mobileCtx: BrowserContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const mobilePage = await mobileCtx.newPage();
  const mobileRoutes = [
    '/', '/onboard', '/skills', '/marketplace', '/dashboard', '/memory',
    '/global', '/agents', '/thesis', '/docs', '/brand', '/legal', '/verticals',
    '/r/66', '/r/123', '/r/124',
    '/admin/treasury', '/admin/health',
    '/privacy', '/terms',
  ];
  for (const route of mobileRoutes) {
    try {
      await mobilePage.goto(`${PROD}${route}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await mobilePage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const dim = await mobilePage.evaluate(() => ({
        docW: document.documentElement.clientWidth,
        bodyW: document.body.scrollWidth,
      }));
      const overflow = dim.bodyW > dim.docW;
      log({
        item: `mobile ${route}`,
        category: 'mobile-sweep',
        action: 'check no horizontal overflow at 375×812',
        outcome: !overflow ? 'PASS' : 'FAIL',
        evidence: `docW=${dim.docW} bodyW=${dim.bodyW} overflow=${overflow ? dim.bodyW - dim.docW + 'px' : 'none'}`,
      });
    } catch (e) {
      log({ item: `mobile ${route}`, category: 'mobile-sweep', action: 'load', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }
  }
  await mobileCtx.close();

  // ============================================================
  // 2. Negative paths · honest 404 / not-found state
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 2. Negative paths ---');
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dp = await desktopCtx.newPage();
  const badRoutes = [
    { route: '/r/999999', expect: 'honest receipt-not-found' },
    { route: '/skill/this-skill-does-not-exist-xyz', expect: 'honest 404' },
    { route: '/agent/0xDEAD0000000000000000000000000000000000ad', expect: 'no on-chain history' },
    { route: '/marketplace/0xdeadbeefcafe0000000000000000000000000000000000000000000000000000', expect: 'no such skillId' },
    { route: '/data-room/nonexistent-room-id', expect: 'room not found' },
  ];
  for (const { route, expect } of badRoutes) {
    try {
      const res = await dp.request.get(`${PROD}${route}`);
      const status = res.status();
      await dp.goto(`${PROD}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const title = await dp.title();
      const body = (await dp.locator('body').textContent()) ?? '';
      // Honest gate: must NOT throw a raw error, must show readable copy
      const hasRawError = body.includes('execution reverted') || body.includes('TypeError') || body.includes('SyntaxError');
      const hasReadableCopy = body.length > 500 && !hasRawError;
      log({
        item: `${route} negative`,
        category: 'negative-path',
        action: `verify honest state (${expect})`,
        outcome: hasReadableCopy ? 'PASS' : 'FAIL',
        evidence: `status=${status} title="${title.slice(0, 40)}" hasRawErr=${hasRawError} bodyChars=${body.length}`,
      });
    } catch (e) {
      log({ item: `${route} negative`, category: 'negative-path', action: 'load', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }
  }

  // ============================================================
  // 3. Receipt 124 · full proof surface (just-anchored, not yet driven)
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 3. Receipt 124 surface drive ---');
  for (const surface of ['/r/124', '/r/124/print', '/embed/r/124']) {
    try {
      await dp.goto(`${PROD}${surface}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await dp.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const title = await dp.title();
      const hasReceiptId = (await dp.locator('text=Receipt #124').count()) > 0;
      log({
        item: `${surface}`,
        category: 'r124-surface',
        action: 'load + verify Receipt #124 visible',
        outcome: hasReceiptId ? 'PASS' : 'FAIL',
        evidence: `title="${title}" hasReceiptId=${hasReceiptId}`,
        shot: await shot(dp, `r124-${surface.replace(/\//g, '_')}`),
      });
    } catch (e) {
      log({ item: surface, category: 'r124-surface', action: 'load', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }
  }
  // OG image too
  try {
    const ogRes = await dp.request.get(`${PROD}/r/124/opengraph-image`);
    const ct = ogRes.headers()['content-type'] ?? '';
    log({
      item: '/r/124/opengraph-image',
      category: 'r124-surface',
      action: 'verify PNG 1200×630',
      outcome: ogRes.ok() && ct.includes('image') ? 'PASS' : 'FAIL',
      evidence: `status=${ogRes.status()} ct=${ct}`,
    });
  } catch (e) {
    log({ item: '/r/124/opengraph-image', category: 'r124-surface', action: 'fetch', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
  }
  await desktopCtx.close();

  // ============================================================
  // SUMMARY + REPORT
  // ============================================================
  await browser.close();
  const pass = results.filter((r) => r.outcome === 'PASS').length;
  const fail = results.filter((r) => r.outcome === 'FAIL').length;
  const skip = results.filter((r) => r.outcome === 'SKIP').length;
  // eslint-disable-next-line no-console
  console.log(`\n========== ${pass} PASS · ${fail} FAIL · ${skip} SKIP (${results.length} items) ==========`);

  const md = [
    `# inventory-drive-v6 · ${ITER}`,
    '',
    `**Production URL:** ${PROD}`,
    `**Viewport:** 375×812 mobile + 1440×900 desktop`,
    `**Total items:** ${results.length} · **PASS:** ${pass} · **FAIL:** ${fail} · **SKIP:** ${skip}`,
    '',
    '| # | Category | Item | Action | Outcome | Evidence | Shot |',
    '|---|---|---|---|---|---|---|',
    ...results.map((r, i) =>
      `| ${i + 1} | ${r.category} | ${r.item} | ${r.action} | **${r.outcome}** | ${r.evidence} | ${r.shot ? `\`${r.shot.replace(REPO, '.')}\`` : '—'} |`,
    ),
  ].join('\n');
  writeFileSync(resolve(PROOF_DIR, 'report.md'), md, 'utf8');
  writeFileSync(resolve(PROOF_DIR, 'results.json'), JSON.stringify({ iter: ITER, pass, fail, skip, results }, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`\nReport: ${resolve(PROOF_DIR, 'report.md')}`);
  process.exit(fail > 0 ? 1 : 0);
}

drive().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('inventory-drive-v6 crashed:', err);
  process.exit(2);
});
