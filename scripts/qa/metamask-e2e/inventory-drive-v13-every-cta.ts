/**
 * inventory-drive-v13-every-cta · individually click every CTA on /verticals + /legal.
 *
 * Per user directive: "do this and thn we can say we hv fully fucnotanl product
 * wit no serious fuctioanl bug everythign is working ry". The 101 CTAs across
 * /verticals (53) and /legal (48) — drive each one + assert the outcome.
 *
 * For each <a> link with a real href:
 *   1. Record href + target + label
 *   2. If href is internal (/path) and not anchor → click + verify navigation
 *   3. If href is external (http* + target=_blank) → HEAD-request the URL + verify 2xx
 *   4. If href is mailto: / javascript: / anchor → record as SKIP-noop
 *
 * Result: every clickable CTA has a recorded PASS/FAIL outcome.
 */
import { chromium, type Browser, type BrowserContext, type Page, type Locator } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const PROD = 'https://www.ivaronix.xyz';
const ITER = `iter-${Date.now()}`;
const PROOF_DIR = resolve(REPO, 'QA_PROOF_PACK', 'inventory-drive', ITER);
mkdirSync(PROOF_DIR, { recursive: true });

type Result = {
  page: string;
  idx: number;
  href: string;
  label: string;
  kind: 'internal' | 'external' | 'mailto' | 'anchor' | 'javascript';
  outcome: 'PASS' | 'FAIL' | 'SKIP-noop';
  evidence: string;
};
const results: Result[] = [];

function log(r: Result) {
  results.push(r);
  const icon = r.outcome === 'PASS' ? '✓' : r.outcome === 'FAIL' ? '✗' : '~';
  // eslint-disable-next-line no-console
  console.log(`  ${icon} ${r.page}#${r.idx} · ${r.kind} · ${r.href.slice(0, 70)} · ${r.evidence}`);
}

function classify(href: string): Result['kind'] {
  if (href.startsWith('mailto:')) return 'mailto';
  if (href.startsWith('javascript:')) return 'javascript';
  if (href.startsWith('#')) return 'anchor';
  if (href.startsWith('http://') || href.startsWith('https://')) return 'external';
  return 'internal';
}

async function driveLink(page: Page, info: { href: string; label: string; target: string | null; isExternal: boolean }, pageRoute: string, idx: number, ctx: BrowserContext): Promise<void> {
  const kind = classify(info.href);
  if (kind === 'anchor' || kind === 'mailto' || kind === 'javascript') {
    log({ page: pageRoute, idx, href: info.href, label: info.label.slice(0, 60), kind, outcome: 'SKIP-noop', evidence: `${kind} link · no navigation expected` });
    return;
  }
  // Fix 1: a relative path with target=_blank is still relative (e.g. PDF asset).
  // Re-classify based on actual URL scheme, not just the target attribute.
  const isReallyExternal = kind === 'external';
  if (isReallyExternal) {
    try {
      const res = await ctx.request.get(info.href, { maxRedirects: 5, timeout: 15_000 });
      log({
        page: pageRoute,
        idx,
        href: info.href,
        label: info.label.slice(0, 60),
        kind: 'external',
        outcome: (res.status() >= 200 && res.status() < 400) ? 'PASS' : 'FAIL',
        evidence: `status=${res.status()} target=${info.target ?? 'none'}`,
      });
    } catch (e) {
      log({ page: pageRoute, idx, href: info.href, label: info.label.slice(0, 60), kind: 'external', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 60) });
    }
    return;
  }
  // internal — verify navigation OR asset fetch (for /file.pdf style hrefs)
  // Fix 2: a relative path to a .pdf / .png / .json is an asset, not a route. Verify via HEAD.
  const isAsset = /\.(pdf|png|jpg|svg|json|txt|xml|ico)(\?|$)/i.test(info.href);
  if (isAsset || info.target === '_blank') {
    try {
      const res = await ctx.request.get(`${PROD}${info.href}`, { maxRedirects: 5, timeout: 15_000 });
      log({
        page: pageRoute,
        idx,
        href: info.href,
        label: info.label.slice(0, 60),
        kind: 'internal',
        outcome: (res.status() >= 200 && res.status() < 400) ? 'PASS' : 'FAIL',
        evidence: `asset · status=${res.status()} content-type=${res.headers()['content-type']?.slice(0, 30) ?? 'unknown'}`,
      });
    } catch (e) {
      log({ page: pageRoute, idx, href: info.href, label: info.label.slice(0, 60), kind: 'internal', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 60) });
    }
    return;
  }
  try {
    await page.goto(`${PROD}${pageRoute}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    // Fix 3: strip query-string AND fragment to get the pathname-only comparison target
    const expectedPath = info.href.split('?')[0]?.split('#')[0] ?? info.href;
    await Promise.all([
      page.waitForURL((u) => u.pathname === expectedPath || u.pathname.startsWith(expectedPath), { timeout: 12_000 }).catch(() => {}),
      page.locator(`a[href="${info.href}"]`).first().click({ timeout: 5_000 }),
    ]);
    const landed = new URL(page.url()).pathname;
    const ok = landed === expectedPath || landed.startsWith(expectedPath);
    log({
      page: pageRoute,
      idx,
      href: info.href,
      label: info.label.slice(0, 60),
      kind: 'internal',
      outcome: ok ? 'PASS' : 'FAIL',
      evidence: `landed=${landed}`,
    });
  } catch (e) {
    log({ page: pageRoute, idx, href: info.href, label: info.label.slice(0, 60), kind: 'internal', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 60) });
  }
}

async function drive(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n========== INVENTORY-DRIVE-V13-EVERY-CTA ${ITER} ==========`);
  const browser: Browser = await chromium.launch({ headless: true });
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const route of ['/verticals', '/legal']) {
    // eslint-disable-next-line no-console
    console.log(`\n--- ${route} ---`);
    await page.goto(`${PROD}${route}?cb=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    // Collect every <a> link with an href
    const links = await page.locator('a[href]').evaluateAll((els) =>
      (els as HTMLAnchorElement[]).map((a) => ({
        href: a.getAttribute('href') ?? '',
        label: (a.innerText || a.getAttribute('aria-label') || a.title || '').trim().slice(0, 80),
        target: a.getAttribute('target'),
        isExternal: a.getAttribute('target') === '_blank',
      })),
    );

    // Dedupe by href — clicking the same link twice doesn't add info
    const seen = new Set<string>();
    const unique = links.filter((l) => {
      if (seen.has(l.href)) return false;
      seen.add(l.href);
      return true;
    });

    // eslint-disable-next-line no-console
    console.log(`  · ${unique.length} unique links (${links.length} total)`);

    for (let i = 0; i < unique.length; i++) {
      const info = unique[i]!;
      if (!info.href) continue;
      await driveLink(page, info, route, i + 1, ctx);
    }
  }

  await browser.close();
  const pass = results.filter((r) => r.outcome === 'PASS').length;
  const fail = results.filter((r) => r.outcome === 'FAIL').length;
  const skip = results.filter((r) => r.outcome === 'SKIP-noop').length;
  // eslint-disable-next-line no-console
  console.log(`\n========== ${pass} PASS · ${fail} FAIL · ${skip} SKIP-noop (${results.length} CTAs across 2 routes) ==========`);

  const md = [
    `# inventory-drive-v13-every-cta · ${ITER}`,
    '',
    `**Pages:** /verticals + /legal`,
    `**Total CTAs:** ${results.length} · **PASS:** ${pass} · **FAIL:** ${fail} · **SKIP-noop:** ${skip}`,
    '',
    '| # | Page | Idx | Kind | Href | Label | Outcome | Evidence |',
    '|---|---|---|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.page} | ${r.idx} | ${r.kind} | \`${r.href.slice(0, 60)}\` | ${r.label} | **${r.outcome}** | ${r.evidence} |`),
  ].join('\n');
  writeFileSync(resolve(PROOF_DIR, 'report.md'), md, 'utf8');
  writeFileSync(resolve(PROOF_DIR, 'results.json'), JSON.stringify({ iter: ITER, pass, fail, skip, results }, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`\nReport: ${resolve(PROOF_DIR, 'report.md')}`);
  process.exit(fail > 0 ? 1 : 0);
}

drive().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('inventory-drive-v13-every-cta crashed:', err);
  process.exit(2);
});
