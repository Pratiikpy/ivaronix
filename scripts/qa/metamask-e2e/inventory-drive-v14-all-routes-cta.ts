/**
 * inventory-drive-v14-all-routes-cta · drive every CTA on every Studio route.
 *
 * Extends v13 (/verticals + /legal) to cover all 13 named Studio routes.
 * Global dedupe by href — header / footer links that repeat across pages
 * are tested once and skipped on subsequent visits (avoids re-testing the
 * same chainscan addresses 13 times each).
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
mkdirSync(PROOF_DIR, { recursive: true });

const ROUTES = [
  '/',                       // home — RunPanel + hero + dev-card grid
  '/thesis',                 // thesis page
  '/docs',                   // docs · 8 copy snippets (with copy buttons post-842c329)
  '/onboard',                // multi-step onboarding
  '/skills',                 // skill catalog (160 cards · only count unique)
  '/marketplace',            // marketplace
  '/dashboard',              // dashboard (no-wallet state)
  '/memory',                 // memory page (no-wallet state)
  '/global',                 // global stats
  '/agents',                 // agents list
  '/brand',                  // brand kit
  '/privacy',                // privacy
  '/terms',                  // terms
  '/r/135',                  // most recent receipt page (TEE-warm)
  '/skill/private-doc-review', // canonical first-party skill detail
];

type Result = {
  page: string;
  href: string;
  outcome: 'PASS' | 'FAIL' | 'SKIP-noop';
  kind: string;
  evidence: string;
};
const results: Result[] = [];
const globallySeen = new Set<string>();

function classify(href: string): 'internal' | 'external' | 'mailto' | 'anchor' | 'javascript' | 'asset' {
  if (href.startsWith('mailto:')) return 'mailto';
  if (href.startsWith('javascript:')) return 'javascript';
  if (href.startsWith('#')) return 'anchor';
  if (href.startsWith('http://') || href.startsWith('https://')) return 'external';
  if (/\.(pdf|png|jpg|svg|json|txt|xml|ico|css|js)(\?|$)/i.test(href)) return 'asset';
  return 'internal';
}

async function driveHref(page: Page, ctx: BrowserContext, pageRoute: string, href: string, target: string | null): Promise<void> {
  if (globallySeen.has(href)) return;
  globallySeen.add(href);

  const kind = classify(href);
  if (kind === 'anchor' || kind === 'mailto' || kind === 'javascript') {
    results.push({ page: pageRoute, href, outcome: 'SKIP-noop', kind, evidence: 'non-navigation link' });
    return;
  }
  if (kind === 'external') {
    try {
      const res = await ctx.request.get(href, { maxRedirects: 5, timeout: 15_000 });
      results.push({
        page: pageRoute,
        href,
        outcome: (res.status() >= 200 && res.status() < 400) ? 'PASS' : 'FAIL',
        kind,
        evidence: `status=${res.status()} target=${target ?? 'none'}`,
      });
    } catch (e) {
      results.push({ page: pageRoute, href, outcome: 'FAIL', kind, evidence: (e as Error).message.slice(0, 60) });
    }
    return;
  }
  if (kind === 'asset' || target === '_blank') {
    try {
      const res = await ctx.request.get(`${PROD}${href}`, { maxRedirects: 5, timeout: 15_000 });
      results.push({
        page: pageRoute,
        href,
        outcome: (res.status() >= 200 && res.status() < 400) ? 'PASS' : 'FAIL',
        kind: 'asset',
        evidence: `status=${res.status()} content-type=${res.headers()['content-type']?.slice(0, 30) ?? 'unknown'}`,
      });
    } catch (e) {
      results.push({ page: pageRoute, href, outcome: 'FAIL', kind: 'asset', evidence: (e as Error).message.slice(0, 60) });
    }
    return;
  }
  // internal — verify navigation
  try {
    await page.goto(`${PROD}${pageRoute}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    const expectedPath = href.split('?')[0]?.split('#')[0] ?? href;
    await Promise.all([
      page.waitForURL((u) => u.pathname === expectedPath || u.pathname.startsWith(expectedPath), { timeout: 12_000 }).catch(() => {}),
      page.locator(`a[href="${href}"]`).first().click({ timeout: 5_000 }),
    ]);
    const landed = new URL(page.url()).pathname;
    const ok = landed === expectedPath || landed.startsWith(expectedPath);
    results.push({
      page: pageRoute,
      href,
      outcome: ok ? 'PASS' : 'FAIL',
      kind: 'internal',
      evidence: `landed=${landed}`,
    });
  } catch (e) {
    results.push({ page: pageRoute, href, outcome: 'FAIL', kind: 'internal', evidence: (e as Error).message.slice(0, 60) });
  }
}

async function drive(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n========== INVENTORY-DRIVE-V14-ALL-ROUTES-CTA ${ITER} ==========`);
  const browser: Browser = await chromium.launch({ headless: true });
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let totalPerPage = 0;
  for (const route of ROUTES) {
    try {
      await page.goto(`${PROD}${route}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
      const links = await page.locator('a[href]').evaluateAll((els) =>
        (els as HTMLAnchorElement[]).map((a) => ({
          href: a.getAttribute('href') ?? '',
          target: a.getAttribute('target'),
        })).filter((l) => l.href),
      );
      const beforeCount = results.length;
      for (const { href, target } of links) {
        await driveHref(page, ctx, route, href, target);
      }
      const newCount = results.length - beforeCount;
      totalPerPage += newCount;
      // eslint-disable-next-line no-console
      console.log(`  · ${route} · ${links.length} total · ${newCount} NEW (rest deduped globally)`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`  · ${route} · ERROR · ${(e as Error).message.slice(0, 60)}`);
    }
  }

  await browser.close();
  const pass = results.filter((r) => r.outcome === 'PASS').length;
  const fail = results.filter((r) => r.outcome === 'FAIL').length;
  const skip = results.filter((r) => r.outcome === 'SKIP-noop').length;
  // eslint-disable-next-line no-console
  console.log(`\n========== ${pass} PASS · ${fail} FAIL · ${skip} SKIP-noop (${results.length} UNIQUE CTAs across ${ROUTES.length} routes) ==========`);

  const md = [
    `# inventory-drive-v14-all-routes-cta · ${ITER}`,
    '',
    `**Routes:** ${ROUTES.length} (${ROUTES.join(', ')})`,
    `**Unique CTAs:** ${results.length} · **PASS:** ${pass} · **FAIL:** ${fail} · **SKIP-noop:** ${skip}`,
    '',
    '| # | Page first seen | Kind | Href | Outcome | Evidence |',
    '|---|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.page} | ${r.kind} | \`${r.href.slice(0, 70)}\` | **${r.outcome}** | ${r.evidence.slice(0, 80)} |`),
  ].join('\n');
  writeFileSync(resolve(PROOF_DIR, 'report.md'), md, 'utf8');
  writeFileSync(resolve(PROOF_DIR, 'results.json'), JSON.stringify({ iter: ITER, pass, fail, skip, results }, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`\nReport: ${resolve(PROOF_DIR, 'report.md')}`);
  process.exit(fail > 0 ? 1 : 0);
}

drive().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('inventory-drive-v14 crashed:', err);
  process.exit(2);
});
