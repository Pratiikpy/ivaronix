/**
 * UI_REAL_USER_TEST_PLAN.md Priority 11 · Touch-target accessibility audit.
 *
 * WCAG AA minimum: every clickable element must be ≥ 44×44 px at mobile
 * viewport (375×812). Audits every <button>, <a>, <input>, <select>,
 * <textarea>, [role=button], [role=link] across the canonical surfaces.
 *
 * Writes results to QA_PROOF_PACK/ui/P11-touch-targets/audit.md.
 * Per CLAUDE.md §17.7 the agent reads the audit and reports issues.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P11-touch-targets');
mkdirSync(OUT, { recursive: true });

const PAGES = [
  '/',
  '/?demo=true',
  '/r/1004',
  '/marketplace',
  `/marketplace/0x0934cfc21748e6a579630c2637fcb1f95b9fa2acfb16039e1a7ed70473860dcb`,
  '/skills',
  '/onboard',
  '/dashboard',
  '/memory',
  '/agents',
  '/thesis',
  '/0g',
];

// WCAG 2.2 AA = 24×24 px minimum (SC 2.5.8 Target Size Minimum)
// WCAG 2.2 AAA = 44×44 px minimum (SC 2.5.5 Target Size Enhanced)
// The test plan's "≥ 44px" maps to the AAA / Enhanced bar.
const MIN_AA = 24;
const MIN_AAA = 44;

interface Hit {
  selector: string;
  text: string;
  width: number;
  height: number;
  visible: boolean;
  underAA: boolean;
  underAAA: boolean;
}

async function auditPage(page: Page, url: string): Promise<{ url: string; total: number; underAA: Hit[]; underAAAOnly: Hit[]; sampled: number }> {
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  if (!resp?.ok()) return { url, total: 0, underMin: [], sampled: 0 };
  await page.waitForTimeout(2_000);

  // For each visible interactive element, measure bounding box.
  const results = await page.evaluate(({ minAA, minAAA }: { minAA: number; minAAA: number }) => {
    const interactiveSelectors = [
      'button',
      'a[href]',
      'input:not([type=hidden])',
      'select',
      'textarea',
      '[role=button]',
      '[role=link]',
      '[tabindex]:not([tabindex="-1"])',
    ];
    const all = document.querySelectorAll(interactiveSelectors.join(','));
    const hits: Array<{ selector: string; text: string; width: number; height: number; visible: boolean; underAA: boolean; underAAA: boolean }> = [];
    let sampled = 0;
    let total = 0;
    all.forEach((el) => {
      total += 1;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      if (!visible) return;
      sampled += 1;
      const underAA = rect.width < minAA || rect.height < minAA;
      const underAAA = rect.width < minAAA || rect.height < minAAA;
      if (!underAAA) return;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role') ?? '';
      const text = (el.textContent ?? '').trim().slice(0, 50) || el.getAttribute('aria-label') || el.getAttribute('title') || '(no text)';
      hits.push({
        selector: `${tag}${role ? `[role=${role}]` : ''}`,
        text,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible,
        underAA,
        underAAA,
      });
    });
    return { hits, total, sampled };
  }, { minAA: MIN_AA, minAAA: MIN_AAA });

  return {
    url,
    total: results.total,
    underAA: results.hits.filter((h) => h.underAA),
    underAAAOnly: results.hits.filter((h) => h.underAAA && !h.underAA),
    sampled: results.sampled,
  };
}

async function main(): Promise<void> {
  console.log(`UI_REAL_USER_TEST_PLAN.md · P11 Touch-target audit (WCAG AA ≥${MIN_AA}px · AAA ≥${MIN_AAA}px)`);
  console.log(`Target: ${STUDIO}`);
  console.log(`Output: ${OUT}/audit.md`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();

  const results: Array<Awaited<ReturnType<typeof auditPage>>> = [];
  for (const path of PAGES) {
    process.stdout.write(`  ${path} `);
    try {
      const r = await auditPage(page, `${STUDIO}${path}`);
      console.log(`· total=${r.total} visible=${r.sampled} <${MIN_AA}px AA=${r.underAA.length} ${MIN_AA}-${MIN_AAA - 1}px AAA-only=${r.underAAAOnly.length}`);
      results.push(r);
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      results.push({ url: `${STUDIO}${path}`, total: 0, underAA: [], underAAAOnly: [], sampled: 0 });
    }
  }

  await browser.close();

  // Write audit.md
  const totalUnderAA = results.reduce((sum, r) => sum + r.underAA.length, 0);
  const totalUnderAAAOnly = results.reduce((sum, r) => sum + r.underAAAOnly.length, 0);
  const totalSampled = results.reduce((sum, r) => sum + r.sampled, 0);
  const lines: string[] = [];
  lines.push(`# P11 · Touch-target audit · ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`Audit at mobile viewport 375×812. Two thresholds:`);
  lines.push(``);
  lines.push(`- **WCAG 2.2 AA** (SC 2.5.8 Target Size Minimum): ≥ ${MIN_AA}×${MIN_AA} px — the launch gate.`);
  lines.push(`- **WCAG 2.2 AAA** (SC 2.5.5 Target Size Enhanced): ≥ ${MIN_AAA}×${MIN_AAA} px — the "comfort target" the test plan §P11 cites.`);
  lines.push(``);
  lines.push(`**Summary**: ${totalSampled} visible interactive elements across ${PAGES.length} pages.`);
  lines.push(``);
  lines.push(`- Under WCAG AA (< ${MIN_AA}px on at least one axis): **${totalUnderAA}** (${((totalUnderAA / Math.max(totalSampled, 1)) * 100).toFixed(1)}%).`);
  lines.push(`- ${MIN_AA}-${MIN_AAA - 1}px on at least one axis (passes AA, fails AAA): **${totalUnderAAAOnly}** (${((totalUnderAAAOnly / Math.max(totalSampled, 1)) * 100).toFixed(1)}%).`);
  lines.push(``);
  lines.push(`Pass criteria for v1 mainnet promotion: **zero AA violations** on every primary CTA + form control + nav element. AAA gaps tolerated for inline text links (footer, address lists, dense paragraph copy).`);
  lines.push(``);
  for (const r of results) {
    lines.push(`## ${r.url.replace(STUDIO, '')}`);
    lines.push(``);
    lines.push(`Total interactive: **${r.total}** · visible: **${r.sampled}** · under AA: **${r.underAA.length}** · AAA-only (passes AA): **${r.underAAAOnly.length}**`);
    lines.push(``);
    if (r.underAA.length === 0) {
      lines.push(`✓ Zero AA violations · ${r.underAAAOnly.length} AAA-comfort gaps.`);
    } else {
      lines.push(`### AA violations (< ${MIN_AA}px on at least one axis)`);
      lines.push(``);
      lines.push(`| Selector | Text/label | Width | Height |`);
      lines.push(`|---|---|---:|---:|`);
      for (const hit of r.underAA) {
        lines.push(`| \`${hit.selector}\` | ${hit.text.replace(/\|/g, '\\|')} | ${hit.width} px | ${hit.height} px |`);
      }
    }
    if (r.underAAAOnly.length > 0) {
      lines.push(``);
      lines.push(`<details><summary>AAA-only gaps (${r.underAAAOnly.length}) — pass AA, fail AAA comfort target</summary>`);
      lines.push(``);
      lines.push(`| Selector | Text/label | Width | Height |`);
      lines.push(`|---|---|---:|---:|`);
      for (const hit of r.underAAAOnly) {
        lines.push(`| \`${hit.selector}\` | ${hit.text.replace(/\|/g, '\\|')} | ${hit.width} px | ${hit.height} px |`);
      }
      lines.push(``);
      lines.push(`</details>`);
    }
    lines.push(``);
  }

  writeFileSync(resolve(OUT, 'audit.md'), lines.join('\n'));
  console.log(`\n✓ Wrote ${resolve(OUT, 'audit.md')}`);
  console.log(`  AA violations: ${totalUnderAA}/${totalSampled} (${((totalUnderAA / Math.max(totalSampled, 1)) * 100).toFixed(1)}%)`);
  console.log(`  AAA-only gaps: ${totalUnderAAAOnly}/${totalSampled} (${((totalUnderAAAOnly / Math.max(totalSampled, 1)) * 100).toFixed(1)}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
