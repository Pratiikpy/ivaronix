/**
 * Verify React #418 hydration mismatch is gone from the deployed home page.
 *
 * Run after `fix(studio): React #418 hydration mismatch on home`
 * (commit 6715278) has landed on Vercel's production deploy.
 *
 * The original bug: `Date.now()` evaluated inside `timeAgo()` during
 * SSR vs hydration crossed a whole-second boundary; locale-default
 * `toLocaleString()` also drifted. Fix: pin `nowSec` once per server
 * render and lock locale to 'en-US' at all 5 numerical-format sites.
 *
 * Exit 0 = clean. Exit 1 = React #418 or hydration error still fires.
 */
import { chromium, type ConsoleMessage } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_URL ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/hydration-fix');
mkdirSync(OUT, { recursive: true });

// React production-build errors are minified to numeric codes. #418 is the
// hydration text-content mismatch. The browser console renders these as:
//   "Minified React error #418; visit https://react.dev/errors/418..."
const HYDRATION_SIGNATURES = [
  'Minified React error #418',
  'Minified React error #423',  // children-array mismatch
  'Minified React error #425',  // text-content mismatch alt path
  'Hydration failed',
  'did not match',
  'Text content does not match',
];

interface ProofRow {
  url: string;
  pageerrors: string[];
  consoleErrors: string[];
  hydrationHits: string[];
  passed: boolean;
}

async function checkOne(url: string): Promise<ProofRow> {
  const browser = await chromium.launch({ headless: true });
  const row: ProofRow = {
    url,
    pageerrors: [],
    consoleErrors: [],
    hydrationHits: [],
    passed: false,
  };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    page.on('pageerror', (err) => {
      row.pageerrors.push(err.message);
    });
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('favicon') || text.includes('font')) return;
        row.consoleErrors.push(text);
        for (const sig of HYDRATION_SIGNATURES) {
          if (text.includes(sig)) {
            row.hydrationHits.push(`[${sig}] ${text.slice(0, 200)}`);
          }
        }
      }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    // Hydration happens shortly after the first paint. Wait long enough
    // that React's reconciler has fully committed and any warning would
    // have fired.
    await page.waitForTimeout(3500);

    // Cross-check via pageerror too — sometimes hydration warnings
    // promote to a hard error in the production build.
    for (const sig of HYDRATION_SIGNATURES) {
      for (const e of row.pageerrors) {
        if (e.includes(sig)) {
          row.hydrationHits.push(`[pageerror:${sig}] ${e.slice(0, 200)}`);
        }
      }
    }

    const screenshotPath = resolve(
      OUT,
      `${new URL(url).pathname.replace(/\//g, '_') || '_home'}-loaded.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: false });

    row.passed = row.hydrationHits.length === 0;
    await ctx.close();
  } finally {
    await browser.close();
  }
  return row;
}

async function main(): Promise<void> {
  console.log(`Verifying hydration fix against: ${STUDIO}`);
  console.log('');

  // Home page is the only route with the time-ago + numerical-format pattern.
  // Spot-check /r/1004 too just for completeness — receipt pages have their
  // own date rendering and shouldn't regress.
  const rows = await Promise.all([
    checkOne(`${STUDIO}/`),
    checkOne(`${STUDIO}/r/1004`),
  ]);

  for (const r of rows) {
    const verdict = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${verdict}  ${r.url}`);
    console.log(`  pageerrors:    ${r.pageerrors.length}`);
    console.log(`  console.error: ${r.consoleErrors.length}`);
    console.log(`  hydration hits: ${r.hydrationHits.length}`);
    if (r.hydrationHits.length > 0) {
      for (const h of r.hydrationHits) {
        console.log(`    → ${h}`);
      }
    }
    if (r.consoleErrors.length > 0 && r.hydrationHits.length === 0) {
      console.log('  (non-hydration console.errors — informational only)');
      for (const e of r.consoleErrors.slice(0, 3)) {
        console.log(`    · ${e.slice(0, 160)}`);
      }
    }
    console.log('');
  }

  const allPassed = rows.every((r) => r.passed);
  const proofPath = resolve(OUT, 'verification-report.json');
  writeFileSync(
    proofPath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        studioUrl: STUDIO,
        rows,
        verdict: allPassed ? 'PASS' : 'FAIL',
        commit: '6715278',
        fixOf: 'React #418 hydration mismatch on home',
      },
      null,
      2,
    ),
  );
  console.log(`Proof written: ${proofPath}`);

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
