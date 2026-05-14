/**
 * Fire 9/10 of the LEGAL VERTICAL HARD-LAUNCH PIVOT directive.
 *
 * Captures the 2 new SEO surfaces (/verticals + /legal) and a sample of the
 * receipt pages from Fire 8's anchor batch, at both desktop (1440×900) and
 * mobile (375×812). Per CLAUDE.md §17.7 the captures are documentation —
 * the agent must `Read` each PNG after the run and report any anomalies
 * before claiming the surfaces are launch-ready.
 *
 * Output: QA_PROOF_PACK/ui/legal-cluster/{desktop,mobile}/*.png
 */
import { chromium, type ConsoleMessage } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_URL ?? 'https://ivaronix.vercel.app';
const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/legal-cluster');
mkdirSync(resolve(OUT, 'desktop'), { recursive: true });
mkdirSync(resolve(OUT, 'mobile'), { recursive: true });

interface CaptureRow {
  url: string;
  outPath: string;
  pageerrors: string[];
  consoleErrors: string[];
  passed: boolean;
}

const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 375, height: 812 } as const;

async function captureOne(url: string, viewport: typeof DESKTOP | typeof MOBILE, outPath: string): Promise<CaptureRow> {
  const browser = await chromium.launch({ headless: true });
  const row: CaptureRow = { url, outPath, pageerrors: [], consoleErrors: [], passed: false };
  try {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => row.pageerrors.push(err.message));
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('favicon') || text.includes('font')) return;
        row.consoleErrors.push(text);
      }
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: outPath, fullPage: true });
    row.passed = row.pageerrors.length === 0 && row.consoleErrors.length === 0;
    await ctx.close();
  } finally {
    await browser.close();
  }
  return row;
}

async function main(): Promise<void> {
  console.log(`Capturing legal cluster surfaces against: ${STUDIO}\n`);

  const desktopTargets = [
    { path: '/verticals', file: '001-verticals-desktop.png' },
    { path: '/legal', file: '002-legal-desktop.png' },
    { path: '/r/53', file: '003-receipt-53-private-doc-review.png' },
    { path: '/r/55', file: '004-receipt-55-contract-renewal.png' },
    { path: '/r/58', file: '005-receipt-58-nda-triage.png' },
    { path: '/r/62', file: '006-receipt-62-term-sheet.png' },
    { path: '/r/64', file: '007-receipt-64-citation-verifier-mata.png' },
  ];
  const mobileTargets = [
    { path: '/verticals', file: '001-verticals-mobile.png' },
    { path: '/legal', file: '002-legal-mobile.png' },
    { path: '/r/64', file: '003-receipt-64-mata-mobile.png' },
  ];

  const rows: CaptureRow[] = [];
  for (const t of desktopTargets) {
    console.log(`  desktop: ${t.path}`);
    const row = await captureOne(`${STUDIO}${t.path}`, DESKTOP, resolve(OUT, 'desktop', t.file));
    rows.push(row);
    console.log(`    ${row.passed ? '✓' : '✗'} pageerrors=${row.pageerrors.length} console.error=${row.consoleErrors.length}`);
  }
  for (const t of mobileTargets) {
    console.log(`  mobile: ${t.path}`);
    const row = await captureOne(`${STUDIO}${t.path}`, MOBILE, resolve(OUT, 'mobile', t.file));
    rows.push(row);
    console.log(`    ${row.passed ? '✓' : '✗'} pageerrors=${row.pageerrors.length} console.error=${row.consoleErrors.length}`);
  }

  const proofPath = resolve(OUT, 'capture-report.json');
  writeFileSync(
    proofPath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        studioUrl: STUDIO,
        desktop: desktopTargets.map((t, i) => ({ ...t, ...rows[i] })),
        mobile: mobileTargets.map((t, i) => ({ ...t, ...rows[desktopTargets.length + i] })),
        verdict: rows.every((r) => r.passed) ? 'PASS · zero errors' : 'INVESTIGATE · some captures had console errors',
      },
      null,
      2,
    ),
  );
  console.log(`\nProof: ${proofPath}`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
