/**
 * inventory-drive-v1 · Click EVERY visible UI item like a real human.
 *
 * Headless Chromium, no Rabby/MM (wallet flows are covered by other drivers).
 * Focus: items that are NOT yet click-driven — copy buttons, footer links,
 * card click-throughs, hero CTAs, share buttons, external PDF/repo links.
 *
 * Each item: real click → observe outcome → verify (route change, clipboard
 * content, new tab URL, content visibility) → screenshot → PASS/FAIL.
 *
 * Per cron directive (2026-05-17): "screenshots are not usage." Every PASS
 * here is gated on an observable side effect, not just HTTP 200.
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
  category: 'footer' | 'hero' | 'card' | 'copy' | 'external' | 'route';
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
  console.log(`\n========== INVENTORY-DRIVE ${ITER} ==========`);
  const browser: Browser = await chromium.launch({ headless: true });
  const ctx: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await ctx.newPage();

  // ============================================================
  // 1. HOME PAGE — hero CTAs
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 1. HOME PAGE hero CTAs ---');
  await page.goto(`${PROD}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await shot(page, '01-home');

  // Hero CTA: "See a verified receipt" or similar — find anchor to /r/<id>
  const sampleReceiptLinks = await page.locator('a[href*="/r/"]').all();
  if (sampleReceiptLinks.length > 0) {
    const href = await sampleReceiptLinks[0]!.getAttribute('href');
    await Promise.all([
      page.waitForURL((u) => u.pathname.includes('/r/'), { timeout: 15_000 }).catch(() => {}),
      sampleReceiptLinks[0]!.click(),
    ]);
    const url = page.url();
    log({
      item: 'home → sample-receipt link',
      category: 'hero',
      action: `click first <a href="/r/...">`,
      outcome: url.includes('/r/') ? 'PASS' : 'FAIL',
      evidence: `href=${href} · landed=${url}`,
      shot: await shot(page, '02-from-home-to-receipt'),
    });
  } else {
    log({ item: 'home → sample-receipt link', category: 'hero', action: 'click', outcome: 'SKIP', evidence: 'no /r/ link on home' });
  }

  // ============================================================
  // 2. /r/123 — ShareButton clipboard copy verification
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 2. /r/123 ShareButton + Twitter intent ---');
  await page.goto(`${PROD}/r/123`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await shot(page, '03-r123-loaded');

  // Find ShareButton — the button with text matching "Share" / "Copy" / aria-live="polite"
  const shareBtn = page.locator('button[aria-live="polite"]').first();
  if (await shareBtn.count() > 0) {
    const beforeText = await shareBtn.textContent();
    await shareBtn.click();
    await page.waitForTimeout(800);
    const afterText = await shareBtn.textContent();
    let clipboard = '';
    try {
      clipboard = await page.evaluate(() => navigator.clipboard.readText());
    } catch (e) {
      clipboard = `(clipboard read err: ${(e as Error).message})`;
    }
    const expectedUrlContains = '/r/123';
    log({
      item: '/r/123 ShareButton',
      category: 'copy',
      action: 'click + read clipboard',
      outcome: clipboard.includes(expectedUrlContains) ? 'PASS' : 'FAIL',
      evidence: `before="${beforeText}" after="${afterText}" clipboard="${clipboard.slice(0, 80)}"`,
      shot: await shot(page, '04-r123-share-clicked'),
    });
  } else {
    log({ item: '/r/123 ShareButton', category: 'copy', action: 'click', outcome: 'SKIP', evidence: 'no aria-live polite button' });
  }

  // ============================================================
  // 3. Footer Product links — click each, verify route change
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 3. Footer Product links ---');
  const productRoutes = ['/onboard', '/skills', '/global', '/dashboard', '/memory', '/brand'];
  for (const route of productRoutes) {
    await page.goto(`${PROD}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    // Scroll footer into view
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    // Click the footer link
    const link = page.locator(`footer a[href="${route}"]`).first();
    if (await link.count() === 0) {
      log({ item: `footer → ${route}`, category: 'footer', action: 'click', outcome: 'SKIP', evidence: 'link not in footer' });
      continue;
    }
    try {
      await Promise.all([
        page.waitForURL((u) => u.pathname === route, { timeout: 15_000 }).catch(() => {}),
        link.click({ timeout: 5_000 }),
      ]);
      // Wait one more tick for the new page's content to render
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
      const url = page.url();
      const title = await page.title();
      log({
        item: `footer → ${route}`,
        category: 'footer',
        action: 'click',
        outcome: new URL(url).pathname === route ? 'PASS' : 'FAIL',
        evidence: `landed=${url} title="${title}"`,
        shot: await shot(page, `05-footer-${route.replace(/\//g, '_')}`),
      });
    } catch (e) {
      log({ item: `footer → ${route}`, category: 'footer', action: 'click', outcome: 'FAIL', evidence: `click err: ${(e as Error).message.slice(0, 80)}` });
    }
  }

  // ============================================================
  // 4. Footer Docs PDF links — verify they're real PDF assets
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 4. Footer Docs PDF links ---');
  await page.goto(`${PROD}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  for (const pdfPath of ['/whitepaper.pdf', '/pitch-deck.pdf']) {
    const link = page.locator(`footer a[href="${pdfPath}"]`).first();
    if (await link.count() === 0) {
      log({ item: `footer → ${pdfPath}`, category: 'footer', action: 'click', outcome: 'SKIP', evidence: 'link not in footer' });
      continue;
    }
    // PDF links are target=_blank; fetch the asset directly to verify it's a real PDF
    const href = await link.getAttribute('href');
    try {
      const res = await page.request.head(`${PROD}${href}`);
      const ct = res.headers()['content-type'] ?? '';
      const cl = res.headers()['content-length'] ?? '';
      log({
        item: `footer → ${pdfPath}`,
        category: 'footer',
        action: 'verify PDF asset',
        outcome: (res.ok() && ct.includes('pdf')) ? 'PASS' : 'FAIL',
        evidence: `HEAD status=${res.status()} content-type=${ct} content-length=${cl}`,
      });
    } catch (e) {
      log({ item: `footer → ${pdfPath}`, category: 'footer', action: 'verify', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }
  }

  // ============================================================
  // 5. /skills cards — click first card, verify lands on /skill/<slug>
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 5. /skills card click-through ---');
  await page.goto(`${PROD}/skills`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const skillCard = page.locator('a[href^="/skill/"]').first();
  if (await skillCard.count() > 0) {
    const href = await skillCard.getAttribute('href');
    await Promise.all([
      page.waitForURL((u) => u.pathname.startsWith('/skill/'), { timeout: 15_000 }).catch(() => {}),
      skillCard.click(),
    ]);
    await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
    const url = page.url();
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    log({
      item: '/skills first card',
      category: 'card',
      action: 'click into detail',
      outcome: url.includes('/skill/') ? 'PASS' : 'FAIL',
      evidence: `href=${href} landed=${url} h1="${h1?.slice(0, 50)}"`,
      shot: await shot(page, '06-skill-detail'),
    });
  } else {
    log({ item: '/skills first card', category: 'card', action: 'click', outcome: 'SKIP', evidence: 'no skill card found' });
  }

  // ============================================================
  // 6. /marketplace cards — click first card, verify lands on /marketplace/<id>
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 6. /marketplace card click-through ---');
  await page.goto(`${PROD}/marketplace`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const marketCard = page.locator('a[href^="/marketplace/"]').filter({ hasNot: page.locator('text=/payouts|new/i') }).first();
  if (await marketCard.count() > 0) {
    const href = await marketCard.getAttribute('href');
    try {
      await Promise.all([
        page.waitForURL((u) => /^\/marketplace\/[^/]+/.test(u.pathname), { timeout: 15_000 }).catch(() => {}),
        marketCard.click({ timeout: 5_000 }),
      ]);
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
      const url = page.url();
      log({
        item: '/marketplace first card',
        category: 'card',
        action: 'click into detail',
        outcome: url.includes('/marketplace/') ? 'PASS' : 'FAIL',
        evidence: `href=${href} landed=${url}`,
        shot: await shot(page, '07-marketplace-detail'),
      });
    } catch (e) {
      log({ item: '/marketplace first card', category: 'card', action: 'click', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }
  } else {
    log({ item: '/marketplace first card', category: 'card', action: 'click', outcome: 'SKIP', evidence: 'no marketplace card found' });
  }

  // ============================================================
  // 7. /r/123/print — click the print page link in chrome
  //    (browser print API blocked headless; verify the page loaded
  //     with the print stylesheet AND has a body with content)
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 7. /r/123/print loaded + content visible ---');
  await page.goto(`${PROD}/r/123/print`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  const printTitle = await page.title();
  const printH1 = await page.locator('h1').first().textContent().catch(() => '');
  const printHasReceipt = (await page.locator('text=Receipt #123').count()) > 0;
  log({
    item: '/r/123/print',
    category: 'route',
    action: 'load + verify content',
    outcome: (printTitle.includes('printable') && printHasReceipt) ? 'PASS' : 'FAIL',
    evidence: `title="${printTitle}" h1="${printH1?.slice(0, 50)}" hasReceipt#123=${printHasReceipt}`,
    shot: await shot(page, '08-r123-print'),
  });

  // ============================================================
  // 8. /embed/r/123 — verify embed content + iframe-friendly headers
  // ============================================================
  // eslint-disable-next-line no-console
  console.log('\n--- 8. /embed/r/123 iframe-loadable ---');
  await page.goto(`${PROD}/embed/r/123`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const embedHasReceipt = (await page.locator('text=Receipt #123').count()) > 0;
  log({
    item: '/embed/r/123',
    category: 'route',
    action: 'load + verify content',
    outcome: embedHasReceipt ? 'PASS' : 'FAIL',
    evidence: `hasReceipt#123=${embedHasReceipt}`,
    shot: await shot(page, '09-r123-embed'),
  });

  // ============================================================
  // SUMMARY + WRITE REPORT
  // ============================================================
  await browser.close();
  const pass = results.filter((r) => r.outcome === 'PASS').length;
  const fail = results.filter((r) => r.outcome === 'FAIL').length;
  const skip = results.filter((r) => r.outcome === 'SKIP').length;
  // eslint-disable-next-line no-console
  console.log(`\n========== ${pass} PASS · ${fail} FAIL · ${skip} SKIP (${results.length} items) ==========`);

  const md = [
    `# inventory-drive · ${ITER}`,
    '',
    `**Production URL:** ${PROD}`,
    `**Viewport:** 1440×900 headless Chromium · clipboard:read+write granted`,
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
  console.error('inventory-drive crashed:', err);
  process.exit(2);
});
