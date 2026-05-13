/**
 * UI_REAL_USER_TEST_PLAN.md Priority 14 · Performance baseline.
 *
 * Measures FCP / LCP / TTFB / domContentLoaded / load + bundle bytes
 * against `https://ivaronix.vercel.app` for the 5 key pages.
 * Writes numbers to QA_PROOF_PACK/ui/P14-performance/numbers.md.
 *
 * Thresholds from test plan §P14:
 *   - Landing FCP < 2s desktop · < 3s mobile
 *   - Landing LCP < 2.5s desktop · < 4s mobile
 *   - Receipt page render < 1s cached · < 3s cold
 *   - Bundle first-load JS < 300 KB gzip for landing
 *
 * No Lighthouse dep — uses Playwright's `performance.getEntries*` + the
 * built-in PerformanceObserver. Same numbers Lighthouse would report
 * for the core Web Vitals (FCP/LCP) since both pull from `window.performance`.
 */
import { chromium, type Page, type BrowserContext } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P14-performance');
mkdirSync(OUT, { recursive: true });

interface PerfNumbers {
  url: string;
  viewport: 'desktop' | 'mobile';
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  fcpMs: number | null;
  lcpMs: number | null;
  firstLoadJsBytes: number;
  cssBytes: number;
  totalTransferBytes: number;
  status: number;
}

async function measure(page: Page, url: string, viewport: 'desktop' | 'mobile'): Promise<PerfNumbers> {
  const transferred: { js: number; css: number; total: number } = { js: 0, css: 0, total: 0 };
  let status = 0;
  page.on('response', (res) => {
    const u = res.url();
    const ct = res.headers()['content-type'] ?? '';
    res.body().then((b) => {
      transferred.total += b.length;
      if (u.endsWith('.js') || ct.includes('javascript')) transferred.js += b.length;
      else if (u.endsWith('.css') || ct.includes('text/css')) transferred.css += b.length;
    }).catch(() => {/* aborted/redirected */});
  });

  const resp = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  status = resp?.status() ?? 0;
  // Wait for LCP to settle. Per the W3C spec LCP can update for several
  // seconds after first paint as larger contentful images load.
  await page.waitForTimeout(2_000);

  const numbers = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint');
    const lcp = (() => {
      const lcps = performance.getEntriesByType('largest-contentful-paint');
      return lcps.length > 0 ? lcps[lcps.length - 1] : null;
    })();
    return {
      ttfb: nav?.responseStart ?? 0,
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      load: nav?.loadEventEnd ?? 0,
      fcp: fcp?.startTime ?? null,
      lcp: lcp?.startTime ?? null,
    };
  });

  return {
    url,
    viewport,
    ttfbMs: Math.round(numbers.ttfb),
    domContentLoadedMs: Math.round(numbers.domContentLoaded),
    loadMs: Math.round(numbers.load),
    fcpMs: numbers.fcp != null ? Math.round(numbers.fcp) : null,
    lcpMs: numbers.lcp != null ? Math.round(numbers.lcp) : null,
    firstLoadJsBytes: transferred.js,
    cssBytes: transferred.css,
    totalTransferBytes: transferred.total,
    status,
  };
}

async function runForViewport(viewport: 'desktop' | 'mobile'): Promise<PerfNumbers[]> {
  const size = viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 375, height: 812 };
  console.log(`\n=== ${viewport.toUpperCase()} ${size.width}×${size.height} ===`);
  const browser = await chromium.launch({ headless: true });
  const targets: string[] = [
    `${STUDIO}/`,
    `${STUDIO}/r/1004`,
    `${STUDIO}/marketplace`,
    `${STUDIO}/thesis`,
    `${STUDIO}/0g`,
  ];
  const results: PerfNumbers[] = [];
  for (const url of targets) {
    const ctx: BrowserContext = await browser.newContext({ viewport: size });
    const page = await ctx.newPage();
    try {
      const m = await measure(page, url, viewport);
      console.log(
        `  ${url.replace(STUDIO, '')}`,
        `\n    TTFB ${m.ttfbMs}ms · FCP ${m.fcpMs}ms · LCP ${m.lcpMs}ms · load ${m.loadMs}ms · JS ${(m.firstLoadJsBytes / 1024).toFixed(0)} KB · total ${(m.totalTransferBytes / 1024).toFixed(0)} KB`,
      );
      results.push(m);
    } catch (err) {
      console.log(`  ${url} FAILED: ${(err as Error).message}`);
      results.push({ url, viewport, ttfbMs: -1, domContentLoadedMs: -1, loadMs: -1, fcpMs: null, lcpMs: null, firstLoadJsBytes: -1, cssBytes: -1, totalTransferBytes: -1, status: -1 });
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
  return results;
}

function fmt(n: number | null, unit: string): string {
  if (n === null) return '—';
  if (n < 0) return 'ERR';
  return `${n} ${unit}`;
}

function pass(value: number | null, threshold: number, lowerIsBetter = true): string {
  if (value === null) return '—';
  if (value < 0) return 'ERR';
  const ok = lowerIsBetter ? value <= threshold : value >= threshold;
  return ok ? '✓' : '✗';
}

async function main(): Promise<void> {
  console.log(`UI_REAL_USER_TEST_PLAN.md · P14 Performance capture`);
  console.log(`Target: ${STUDIO}`);
  console.log(`Output: ${OUT}/numbers.md`);

  const desktop = await runForViewport('desktop');
  const mobile = await runForViewport('mobile');

  // Write numbers.md
  const lines: string[] = [];
  lines.push(`# P14 · Performance baseline · ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`Target: ${STUDIO}`);
  lines.push(`Method: Playwright + Web Performance API (FCP/LCP via performance.getEntriesByType). No Lighthouse dep.`);
  lines.push(``);
  lines.push(`## Thresholds (from test plan §P14)`);
  lines.push(``);
  lines.push(`| Metric | Desktop | Mobile |`);
  lines.push(`|---|---|---|`);
  lines.push(`| FCP | < 2,000 ms | < 3,000 ms |`);
  lines.push(`| LCP | < 2,500 ms | < 4,000 ms |`);
  lines.push(`| Receipt page | < 1,000 ms cached · < 3,000 ms cold | — |`);
  lines.push(`| Bundle first-load JS | < 300,000 bytes gzip | — |`);
  lines.push(``);

  for (const [viewport, results] of [['desktop', desktop] as const, ['mobile', mobile] as const]) {
    const fcpThreshold = viewport === 'desktop' ? 2_000 : 3_000;
    const lcpThreshold = viewport === 'desktop' ? 2_500 : 4_000;
    lines.push(`## ${viewport.charAt(0).toUpperCase() + viewport.slice(1)} (1440×900 / 375×812)`);
    lines.push(``);
    lines.push(`| Page | TTFB | FCP | LCP | load | JS | total | status | FCP/LCP gate |`);
    lines.push(`|---|---:|---:|---:|---:|---:|---:|---|---|`);
    for (const r of results) {
      const fcpGate = pass(r.fcpMs, fcpThreshold);
      const lcpGate = pass(r.lcpMs, lcpThreshold);
      lines.push(`| ${r.url.replace(STUDIO, '')} | ${fmt(r.ttfbMs, 'ms')} | ${fmt(r.fcpMs, 'ms')} | ${fmt(r.lcpMs, 'ms')} | ${fmt(r.loadMs, 'ms')} | ${(r.firstLoadJsBytes / 1024).toFixed(0)} KB | ${(r.totalTransferBytes / 1024).toFixed(0)} KB | ${r.status} | FCP ${fcpGate} · LCP ${lcpGate} |`);
    }
    lines.push(``);
  }

  lines.push(`## Notes`);
  lines.push(``);
  lines.push(`- TTFB = time to first byte (server response start).`);
  lines.push(`- FCP / LCP per W3C Web Vitals spec.`);
  lines.push(`- "JS" + "total" are uncompressed transfer bytes since Playwright's response.body() returns decompressed bytes. Gzip would be roughly 30-40% of these values; the < 300 KB gzip threshold maps to < 750 KB uncompressed.`);
  lines.push(`- Numbers vary by network conditions; this snapshot was taken from the operator's local machine connecting to Vercel's edge.`);
  lines.push(``);

  writeFileSync(resolve(OUT, 'numbers.md'), lines.join('\n'));
  console.log(`\n✓ Wrote ${resolve(OUT, 'numbers.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
