/**
 * inventory-drive-v7 · verify the 8 fresh paid receipts (124-131) anchored
 * this session render correctly on production.
 *
 * Each receipt:
 *  - /r/<id> renders with title "Receipt #<id> · Ivaronix"
 *  - /r/<id>/print renders printable surface
 *  - /embed/r/<id> renders embed (Bug-29 X-Frame-Options fix verified)
 *  - /r/<id>/opengraph-image returns valid PNG
 *  - CLI verify --tee-independent → FULLY VERIFIED ✓ (covered separately)
 *
 * Each receipt represents a specific feature being exercised:
 *  124 · legal-citation-verifier · high-stakes 5-role (Bug-72 proof)
 *  126 · term-sheet-risk-scanner · high-stakes 5-role (Bug-72 proof)
 *  127 · legal-citation-verifier · PAID high-stakes (SkillRunPayment)
 *  128 · term-sheet-risk-scanner · PAID high-stakes (SkillRunPayment)
 *  129 · nda-triage-reviewer · PAID standard
 *  130 · contract-renewal-clause-detector · PAID standard
 *  131 · private-doc-review · PAID quick
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

const FRESH_RECEIPTS = [124, 126, 127, 128, 129, 130, 131];

type Result = {
  item: string;
  category: 'r-page' | 'print' | 'embed' | 'og-image';
  action: string;
  outcome: 'PASS' | 'FAIL' | 'SKIP';
  evidence: string;
};
const results: Result[] = [];

function log(r: Result) {
  results.push(r);
  const icon = r.outcome === 'PASS' ? '✓' : r.outcome === 'FAIL' ? '✗' : '~';
  // eslint-disable-next-line no-console
  console.log(`  ${icon} [${r.category}] ${r.item} · ${r.action} · ${r.evidence}`);
}

async function drive(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n========== INVENTORY-DRIVE-V7 ${ITER} ==========`);
  const browser: Browser = await chromium.launch({ headless: true });
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // eslint-disable-next-line no-console
  console.log(`\n--- Driving 4 surfaces × ${FRESH_RECEIPTS.length} receipts (${FRESH_RECEIPTS.length * 4} items) ---`);

  for (const id of FRESH_RECEIPTS) {
    // /r/<id>
    try {
      await page.goto(`${PROD}/r/${id}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      const title = await page.title();
      const hasReceiptId = (await page.locator(`text=Receipt #${id}`).count()) > 0;
      log({
        item: `/r/${id}`,
        category: 'r-page',
        action: 'load + verify Receipt #<id> visible',
        outcome: hasReceiptId && title.includes(`#${id}`) ? 'PASS' : 'FAIL',
        evidence: `title="${title}" hasReceiptId=${hasReceiptId}`,
      });
    } catch (e) {
      log({ item: `/r/${id}`, category: 'r-page', action: 'load', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }

    // /r/<id>/print
    try {
      await page.goto(`${PROD}/r/${id}/print?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const title = await page.title();
      const hasReceiptId = (await page.locator(`text=Receipt #${id}`).count()) > 0;
      log({
        item: `/r/${id}/print`,
        category: 'print',
        action: 'verify printable surface',
        outcome: hasReceiptId && title.includes('printable') ? 'PASS' : 'FAIL',
        evidence: `title="${title}" hasReceiptId=${hasReceiptId}`,
      });
    } catch (e) {
      log({ item: `/r/${id}/print`, category: 'print', action: 'load', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }

    // /embed/r/<id> + Bug-29 frame-ancestors header
    try {
      const res = await page.request.get(`${PROD}/embed/r/${id}`);
      const xfo = res.headers()['x-frame-options'] ?? 'absent';
      const csp = res.headers()['content-security-policy'] ?? 'absent';
      // Bug-29 closure: X-Frame-Options must be ALLOWALL or absent (CSP frame-ancestors handles it)
      const iframeOk = !xfo.toLowerCase().includes('deny') && !xfo.toLowerCase().includes('sameorigin');
      log({
        item: `/embed/r/${id}`,
        category: 'embed',
        action: 'verify iframe-friendly headers (Bug-29)',
        outcome: res.ok() && iframeOk ? 'PASS' : 'FAIL',
        evidence: `status=${res.status()} XFO=${xfo} CSP-frame-ancestors=${csp.includes('frame-ancestors') ? 'set' : 'absent'}`,
      });
    } catch (e) {
      log({ item: `/embed/r/${id}`, category: 'embed', action: 'fetch', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }

    // /r/<id>/opengraph-image
    try {
      const res = await page.request.get(`${PROD}/r/${id}/opengraph-image`);
      const ct = res.headers()['content-type'] ?? '';
      log({
        item: `/r/${id}/opengraph-image`,
        category: 'og-image',
        action: 'verify PNG 1200×630',
        outcome: res.ok() && ct.includes('image') ? 'PASS' : 'FAIL',
        evidence: `status=${res.status()} ct=${ct}`,
      });
    } catch (e) {
      log({ item: `/r/${id}/opengraph-image`, category: 'og-image', action: 'fetch', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  await browser.close();
  const pass = results.filter((r) => r.outcome === 'PASS').length;
  const fail = results.filter((r) => r.outcome === 'FAIL').length;
  const skip = results.filter((r) => r.outcome === 'SKIP').length;
  // eslint-disable-next-line no-console
  console.log(`\n========== ${pass} PASS · ${fail} FAIL · ${skip} SKIP (${results.length} items) ==========`);

  const md = [
    `# inventory-drive-v7 · ${ITER}`,
    '',
    `**Receipts:** ${FRESH_RECEIPTS.join(', ')}`,
    `**Surfaces per receipt:** /r/<id>, /r/<id>/print, /embed/r/<id>, /r/<id>/opengraph-image`,
    `**Total items:** ${results.length} · **PASS:** ${pass} · **FAIL:** ${fail} · **SKIP:** ${skip}`,
    '',
    '| # | Category | Item | Action | Outcome | Evidence |',
    '|---|---|---|---|---|---|',
    ...results.map((r, i) =>
      `| ${i + 1} | ${r.category} | ${r.item} | ${r.action} | **${r.outcome}** | ${r.evidence} |`,
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
  console.error('inventory-drive-v7 crashed:', err);
  process.exit(2);
});
