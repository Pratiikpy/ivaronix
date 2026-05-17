/**
 * inventory-drive-v11-skill-deep · drive each first-party skill detail page.
 *
 * Each of the 5 first-party skills has a /skill/<slug> deep page rendering:
 *  - skill name + version
 *  - manifest hash (chain anchor)
 *  - REGISTRY MATCH / MISMATCH / LOCAL ONLY chip
 *  - permissions pills (memory + shell + consensus + burn)
 *  - description
 *  - prompt body
 *  - price + creator fee split
 *
 * This batch verifies each page renders end-to-end with the correct skill
 * data, with no execution-reverted or TypeError leaks.
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

const FIRST_PARTY_SKILLS = [
  'private-doc-review',
  'legal-citation-verifier',
  'term-sheet-risk-scanner',
  'nda-triage-reviewer',
  'contract-renewal-clause-detector',
];

type Result = {
  skill: string;
  check: string;
  outcome: 'PASS' | 'FAIL';
  evidence: string;
};
const results: Result[] = [];

function log(r: Result) {
  results.push(r);
  const icon = r.outcome === 'PASS' ? '✓' : '✗';
  // eslint-disable-next-line no-console
  console.log(`  ${icon} ${r.skill} · ${r.check} · ${r.evidence}`);
}

async function drive(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`\n========== INVENTORY-DRIVE-V11-SKILL-DEEP ${ITER} ==========`);
  const browser: Browser = await chromium.launch({ headless: true });
  const ctx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const slug of FIRST_PARTY_SKILLS) {
    try {
      await page.goto(`${PROD}/skill/${slug}?cb=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

      // 1. Title matches the slug (Bug-58 fix)
      const title = await page.title();
      log({
        skill: slug,
        check: 'page title contains skill slug',
        outcome: title.includes(slug) ? 'PASS' : 'FAIL',
        evidence: `title="${title}"`,
      });

      // 2. Slug name visible in body
      const bodyText = (await page.locator('body').textContent()) ?? '';
      log({
        skill: slug,
        check: 'slug name visible in body',
        outcome: bodyText.includes(slug) ? 'PASS' : 'FAIL',
        evidence: `bodyChars=${bodyText.length}`,
      });

      // 3. REGISTRY MATCH chip OR LOCAL ONLY (honest framing)
      const hasMatchChip = bodyText.includes('REGISTRY MATCH') || bodyText.includes('LOCAL ONLY') || bodyText.includes('UNREGISTERED');
      log({
        skill: slug,
        check: 'registry-state chip rendered',
        outcome: hasMatchChip ? 'PASS' : 'FAIL',
        evidence: `match=${bodyText.includes('REGISTRY MATCH')} local=${bodyText.includes('LOCAL ONLY')}`,
      });

      // 4. No raw errors leaked
      const hasRawError = bodyText.includes('execution reverted') || bodyText.includes('TypeError') || bodyText.includes('SyntaxError');
      log({
        skill: slug,
        check: 'no raw error trace',
        outcome: !hasRawError ? 'PASS' : 'FAIL',
        evidence: hasRawError ? 'leaked error visible' : 'clean UI',
      });

      // 5. Permissions / consensus / burn pills present
      const hasPermPills = (await page.locator('text=/memory|shell|consensus|burn|receipt_required/i').count()) > 0;
      log({
        skill: slug,
        check: 'permissions pills visible',
        outcome: hasPermPills ? 'PASS' : 'FAIL',
        evidence: `pills=${hasPermPills}`,
      });

      // 6. Capture screenshot for evidence
      const shotPath = resolve(SHOT_DIR, `skill-${slug}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
    } catch (e) {
      log({ skill: slug, check: 'load page', outcome: 'FAIL', evidence: (e as Error).message.slice(0, 80) });
    }
  }

  await browser.close();
  const pass = results.filter((r) => r.outcome === 'PASS').length;
  const fail = results.filter((r) => r.outcome === 'FAIL').length;
  // eslint-disable-next-line no-console
  console.log(`\n========== ${pass} PASS · ${fail} FAIL (${results.length} checks across ${FIRST_PARTY_SKILLS.length} skills) ==========`);

  const md = [
    `# inventory-drive-v11-skill-deep · ${ITER}`,
    '',
    `**Skills:** ${FIRST_PARTY_SKILLS.join(', ')}`,
    `**Total checks:** ${results.length} · **PASS:** ${pass} · **FAIL:** ${fail}`,
    '',
    '| # | Skill | Check | Outcome | Evidence |',
    '|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.skill} | ${r.check} | **${r.outcome}** | ${r.evidence} |`),
  ].join('\n');
  writeFileSync(resolve(PROOF_DIR, 'report.md'), md, 'utf8');
  writeFileSync(resolve(PROOF_DIR, 'results.json'), JSON.stringify({ iter: ITER, pass, fail, results }, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`\nReport: ${resolve(PROOF_DIR, 'report.md')}`);
  process.exit(fail > 0 ? 1 : 0);
}

drive().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('inventory-drive-v11-skill-deep crashed:', err);
  process.exit(2);
});
