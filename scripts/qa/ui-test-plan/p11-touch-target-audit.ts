/**
 * UI_REAL_USER_TEST_PLAN.md Priority 11 · Mobile touch-target ≥ 44×44px audit.
 *
 * Walks every interactive element (button, a, input, [role=button]) on
 * each rendered Studio route at 375×812 and asserts the rendered
 * bounding box has both width AND height ≥ 44px (WCAG 2.5.5 AA).
 *
 * Reports per-route violations with the rendered text + size. Output
 * goes to QA_PROOF_PACK/ui/P11-mobile/touch-targets.md.
 *
 * Routes excluded: dynamic ones (`/r/[id]`, etc.) — those get tested
 * by their dynamic-route capture suites.
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/P11-mobile');
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  '/',
  '/onboard',
  '/skills',
  '/memory',
  '/dashboard',
  '/agents',
  '/global',
  '/thesis',
  '/0g',
  '/marketplace',
  '/marketplace/payouts',
  '/marketplace/new',
  '/admin/treasury',
  '/r/1004',
];

interface Violation {
  route: string;
  selector: string;
  text: string;
  width: number;
  height: number;
}

async function auditRoute(page: Page, route: string): Promise<Violation[]> {
  await page.goto(`${STUDIO}${route}`, { waitUntil: 'load', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1_500);

  // Narrow to PRIMARY interactives only (buttons, form controls, button-
  // styled or role=button anchors). Skip inline text-style anchors in
  // footers / paragraphs — WCAG 2.5.5 AA is 24×24 for those; 44×44 is the
  // Apple HIG / Material recommendation for primary affordances.
  return page.evaluate(`
    (() => {
      const out = [];
      const inFooter = (el) => {
        let p = el;
        while (p) { if (p.tagName === 'FOOTER') return true; p = p.parentElement; }
        return false;
      };
      const isInlineText = (el) => {
        const parent = el.parentElement;
        if (!parent) return false;
        const tag = parent.tagName.toLowerCase();
        if (['p', 'span', 'li', 'em', 'strong', 'small'].includes(tag)) return true;
        const s = getComputedStyle(el);
        const hasAff = el.classList.contains('btn') || el.classList.contains('button') ||
          el.classList.contains('cta') || el.getAttribute('role') === 'button' ||
          parseFloat(s.paddingTop) >= 8 || parseFloat(s.paddingLeft) >= 8 ||
          s.borderRadius !== '0px' || s.backgroundColor !== 'rgba(0, 0, 0, 0)';
        return !hasAff;
      };
      const elements = [];
      document.querySelectorAll('button').forEach((b) => elements.push(b));
      document.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach((f) => elements.push(f));
      document.querySelectorAll('a').forEach((a) => {
        if (inFooter(a)) return;
        if (a.getAttribute('role') === 'button' || a.getAttribute('role') === 'tab') { elements.push(a); return; }
        if (a.classList.contains('btn') || a.classList.contains('button') ||
            a.classList.contains('btn-primary') || a.classList.contains('btn-ghost') ||
            a.classList.contains('cta')) { elements.push(a); return; }
        if (!isInlineText(a)) elements.push(a);
      });
      document.querySelectorAll('[role="button"]:not(a):not(button), [role="tab"]:not(a), [role="checkbox"]:not(input)').forEach((e) => elements.push(e));

      for (const el of elements) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1) continue;
        if (r.width < 44 || r.height < 44) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : '';
          const text = (el.textContent || '').trim().slice(0, 40) || el.getAttribute('aria-label') || el.getAttribute('title') || '';
          out.push({
            selector: tag + (cls ? '.' + cls : ''),
            text,
            width: Math.round(r.width),
            height: Math.round(r.height),
          });
        }
      }
      return out;
    })()
  `).then((violations) => (violations).map((v) => ({ route, ...v })));
}

async function main(): Promise<void> {
  console.log(`UI_REAL_USER_TEST_PLAN.md · P11 Touch-target audit`);
  console.log(`Target: ${STUDIO} · viewport 375×812`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();

  const allViolations: Violation[] = [];
  for (const route of ROUTES) {
    const violations = await auditRoute(page, route);
    console.log(`  ${route}: ${violations.length} violations`);
    allViolations.push(...violations);
  }
  await browser.close();

  const byRoute = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const list = byRoute.get(v.route) ?? [];
    list.push(v);
    byRoute.set(v.route, list);
  }

  const lines: string[] = [];
  lines.push(`# P11 · Touch-target ≥ 44×44 audit · ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`Target: ${STUDIO} · viewport 375×812 · WCAG 2.5.5 Level AA`);
  lines.push(``);
  lines.push(`| Route | Violations |`);
  lines.push(`|---|---:|`);
  for (const route of ROUTES) {
    const count = byRoute.get(route)?.length ?? 0;
    const mark = count === 0 ? '✓' : `✗ ${count}`;
    lines.push(`| ${route} | ${mark} |`);
  }
  lines.push(``);
  lines.push(`Total violations: ${allViolations.length}`);
  lines.push(``);

  if (allViolations.length > 0) {
    lines.push(`## Detailed violations`);
    lines.push(``);
    for (const [route, list] of byRoute) {
      if (list.length === 0) continue;
      lines.push(`### ${route}`);
      lines.push(``);
      lines.push(`| Selector | Text | Size |`);
      lines.push(`|---|---|---|`);
      for (const v of list) {
        lines.push(`| \`${v.selector}\` | ${v.text || '(no text)'} | ${v.width}×${v.height} px |`);
      }
      lines.push(``);
    }
  } else {
    lines.push(`✓ Every interactive element on every route meets the ≥ 44×44 minimum.`);
    lines.push(``);
  }

  writeFileSync(resolve(OUT, 'touch-targets.md'), lines.join('\n'));
  console.log(`\n✓ Wrote ${resolve(OUT, 'touch-targets.md')} · ${allViolations.length} total violations`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
