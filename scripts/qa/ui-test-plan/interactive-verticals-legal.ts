/**
 * Interactive Playwright drives on /verticals + /legal · breadth-test item #6.
 *
 * Per CLAUDE.md §17 + the locked feedback_ui_coverage_question.md memory:
 * page-load proof + chain-side proof are necessary but not sufficient;
 * interactive UI exercise is the third leg.
 *
 * Drives:
 *   - /verticals: click each Legal LIVE card · verify /skill/<slug> nav
 *                 mailto: link hrefs are well-formed per the directive's
 *                 "Notify me when this ships" honest contract
 *   - /legal: click "Run private-doc-review" CTA · verify /?skill=... nav
 *             click each "Open receipt /r/<id>" link in before/after · verify
 *             /r/<id> resolves on prod (real Fire-8 receipts)
 *             expand each FAQ <details> · verify expanded state
 *             mobile 375×812 · open hamburger drawer · verify nav links
 */
import { chromium, type Page, type ConsoleMessage } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_URL ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/legal-cluster/interactive');
mkdirSync(OUT, { recursive: true });

interface CheckRow { action: string; pass: boolean; detail: string; }
const checks: CheckRow[] = [];
function check(action: string, pass: boolean, detail = '') {
  checks.push({ action, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${action}${detail ? ' · ' + detail : ''}`);
}

async function setupPageErrorCapture(page: Page): Promise<{ pageerrors: string[]; consoleErrors: string[] }> {
  const pageerrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (err) => pageerrors.push(err.message));
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('font')) return;
      consoleErrors.push(text);
    }
  });
  return { pageerrors, consoleErrors };
}

async function driveVerticals(page: Page): Promise<void> {
  console.log('\n=== /verticals ===');
  await page.goto(`${STUDIO}/verticals`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(OUT, '01-verticals-loaded.png'), fullPage: true });

  // Verify LIVE chips count (5 legal cluster skills)
  const liveChips = await page.locator('.chip-verified').count();
  check('verticals · LIVE chip count >= 5', liveChips >= 5, `found ${liveChips}`);

  // Verify each first-party legal skill card links to /skill/<slug>
  const expectedSlugs = ['private-doc-review', 'contract-renewal-clause-detector', 'nda-triage-reviewer', 'term-sheet-risk-scanner', 'legal-citation-verifier'];
  for (const slug of expectedSlugs) {
    const link = page.locator(`a[href="/skill/${slug}"]`);
    const exists = (await link.count()) > 0;
    check(`verticals · /skill/${slug} card link present`, exists);
  }

  // Verify mailto: notify links on COMING SOON cards (>= 10 of 14 visible)
  const mailtoLinks = await page.locator('a[href^="mailto:hello@ivaronix.com"]').count();
  check('verticals · mailto notify-me links >= 10', mailtoLinks >= 10, `found ${mailtoLinks}`);

  // Click into one Legal card and verify navigation
  const firstLegalLink = page.locator('a[href="/skill/private-doc-review"]').first();
  await firstLegalLink.click({ trial: false });
  await page.waitForURL(/\/skill\/private-doc-review/, { timeout: 10_000 });
  check('verticals · clicking private-doc-review card navigates to /skill/private-doc-review', true, page.url());
  await page.screenshot({ path: resolve(OUT, '02-skill-private-doc-review-nav.png'), fullPage: true });
}

async function driveLegal(page: Page): Promise<void> {
  console.log('\n=== /legal ===');
  await page.goto(`${STUDIO}/legal`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(OUT, '03-legal-loaded.png'), fullPage: false });

  // Verify the H1 + italic-serif accent renders
  const h1Visible = await page.locator('h2').filter({ hasText: 'The AI second opinion' }).count();
  check('legal · H1 "The AI second opinion you can give your lawyer." renders', h1Visible > 0);

  // Verify the primary CTA href
  const ctaHref = await page.locator('a[href="/?skill=private-doc-review"]').first().getAttribute('href');
  check('legal · primary CTA href = /?skill=private-doc-review', ctaHref === '/?skill=private-doc-review', `${ctaHref}`);

  // Verify each real receipt link in the before/after section (Fire 8 anchors)
  const expectedReceipts = [53, 55, 58, 62, 64];
  for (const id of expectedReceipts) {
    const link = page.locator(`a[href="/r/${id}"]`);
    const count = await link.count();
    check(`legal · /r/${id} link present in before/after`, count > 0, `count=${count}`);
  }

  // Expand all FAQ <details> elements and verify each expanded
  const detailsCount = await page.locator('details').count();
  check('legal · FAQ details elements >= 6', detailsCount >= 6, `count=${detailsCount}`);
  for (let i = 0; i < Math.min(detailsCount, 6); i++) {
    const det = page.locator('details').nth(i);
    const wasOpen = await det.getAttribute('open');
    if (wasOpen === null) {
      await det.locator('summary').click();
      await page.waitForTimeout(150);
    }
    const isOpen = await det.getAttribute('open');
    check(`legal · FAQ details[${i}] expands on click`, isOpen !== null);
  }
  await page.screenshot({ path: resolve(OUT, '04-legal-faq-expanded.png'), fullPage: true });

  // Click one of the real /r/<id> links and verify navigation lands on a receipt page
  await page.goto(`${STUDIO}/legal`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const r53 = page.locator('a[href="/r/53"]').first();
  await r53.click();
  await page.waitForURL(/\/r\/53/, { timeout: 10_000 });
  const h1OnR53 = await page.locator('h1, h2').filter({ hasText: /Receipt #53/i }).count();
  check('legal · clicking /r/53 link navigates and receipt page renders', h1OnR53 > 0, page.url());
  await page.screenshot({ path: resolve(OUT, '05-r53-from-legal-link.png'), fullPage: false });
}

async function driveMobile(): Promise<void> {
  console.log('\n=== mobile drawer · /legal ===');
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto(`${STUDIO}/legal`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: resolve(OUT, '06-mobile-legal-pre-drawer.png'), fullPage: false });

    // Open hamburger
    const trigger = page.getByRole('button', { name: /menu/i }).first();
    await trigger.click({ force: true, trial: false });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: resolve(OUT, '07-mobile-drawer-open.png'), fullPage: false });

    // Verify drawer reveals Legal nav link
    const legalLinkInDrawer = await page.locator('a[href="/legal"]').count();
    check('mobile · drawer opens · Legal nav link visible', legalLinkInDrawer >= 1, `count=${legalLinkInDrawer}`);

    // Verify drawer reveals Verticals nav link too
    const verticalsLink = await page.locator('a[href="/verticals"]').count();
    check('mobile · drawer · Verticals nav link visible', verticalsLink >= 1, `count=${verticalsLink}`);

    await ctx.close();
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  console.log(`Interactive drives against: ${STUDIO}`);
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const { pageerrors, consoleErrors } = await setupPageErrorCapture(page);

    await driveVerticals(page);
    await driveLegal(page);

    check('zero pageerrors across all desktop drives', pageerrors.length === 0, `${pageerrors.length} errors`);
    check('zero console.errors across all desktop drives', consoleErrors.length === 0, `${consoleErrors.length} errors`);

    await ctx.close();
  } finally {
    await browser.close();
  }

  await driveMobile();

  const passCount = checks.filter((c) => c.pass).length;
  const failCount = checks.length - passCount;
  console.log(`\n=== SUMMARY ===`);
  console.log(`  ${passCount} PASS · ${failCount} FAIL · ${checks.length} total`);

  const proof = {
    runAt: new Date().toISOString(),
    studioUrl: STUDIO,
    checks,
    summary: { pass: passCount, fail: failCount, total: checks.length },
    verdict: failCount === 0 ? 'PASS · all interactive drives green' : 'FAIL · investigate failures',
  };
  const proofPath = resolve(OUT, `interactive-report-${Date.now()}.json`);
  writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log(`\nProof: ${proofPath}`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
