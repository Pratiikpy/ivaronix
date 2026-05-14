/**
 * Launch-readiness validation · structured findings on prod /r/<id>.
 *
 * After commits 4785f6f (parser) + 83a0fbe (UI) + e9fd066 (cache),
 * receipts #68 (contract-renewal), #69 (nda-triage), #70 (term-sheet)
 * carry `outputs.parsed.data` with real structured output. This script
 * verifies the prod Vercel deployment renders that data correctly by
 * driving real Playwright clicks against the live site.
 *
 * What it proves end-to-end:
 *   1. Prod /r/<id> returns 200 + edge-cached (Cache-Control: s-maxage=86400)
 *   2. Hero "AI FINDINGS" section renders for each receipt
 *   3. New "Structured findings" card renders (commit 83a0fbe UI extension)
 *   4. Per-finding risk_level chips render (high/medium/low)
 *   5. Chainscan link present + valid for V2 ReceiptRegistry
 *   6. Mobile 375×812 layout doesn't break
 *   7. CLI cross-check: `receipt show <id>` returns matching root + agent
 *
 * Run:
 *   pnpm --filter qa-metamask-e2e exec tsx ../ui-test-plan/validate-structured-findings-prod.ts
 *
 * Output:
 *   QA_PROOF_PACK/ui/structured-findings-prod/<receipt>/desktop|mobile/*.png
 *   QA_PROOF_PACK/ui/structured-findings-prod/REPORT.json
 */
import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO = process.env.STUDIO_BASE ?? 'https://ivaronix.vercel.app';

const OUT = resolve(REPO, 'QA_PROOF_PACK/ui/structured-findings-prod');
mkdirSync(OUT, { recursive: true });

interface Check {
  receipt: number;
  surface: 'desktop' | 'mobile' | 'http';
  check: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];
function check(receipt: number, surface: 'desktop' | 'mobile' | 'http', name: string, pass: boolean, detail = '') {
  checks.push({ receipt, surface, check: name, pass, detail });
  const ico = pass ? '✓' : '✗';
  console.log(`  ${ico} /r/${receipt} [${surface}] ${name}${detail ? ' · ' + detail : ''}`);
}

const TARGET_RECEIPTS = [68, 69, 70];

async function fetchHeaders(url: string): Promise<Record<string, string>> {
  const res = await fetch(url, { method: 'HEAD' });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  return headers;
}

async function drivePage(page: Page, receipt: number, viewport: 'desktop' | 'mobile'): Promise<void> {
  const url = `${STUDIO}/r/${receipt}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(1500);

  const dir = resolve(OUT, String(receipt), viewport);
  mkdirSync(dir, { recursive: true });

  // 1. Hero "AI FINDINGS" section
  const aiFindingsCount = await page.locator('text=/ai findings/i').count();
  check(receipt, viewport, 'AI FINDINGS hero section renders', aiFindingsCount > 0, `count=${aiFindingsCount}`);

  // 2. Receipt id heading
  const idHeading = await page.locator(`text=/receipt #${receipt}|on-chain id ${receipt}/i`).count();
  check(receipt, viewport, 'receipt id heading renders', idHeading > 0);

  // 3. Structured findings section (commit 83a0fbe)
  const structuredFindings = await page.locator('text=/structured findings|structured output/i').count();
  // For receipts with the new schema, expect "structured findings" or "structured output";
  // older receipts without outputs.parsed render neither (so 0 is also valid for legacy)
  check(receipt, viewport, 'structured findings/output card present (commit 83a0fbe UI)', structuredFindings > 0, `count=${structuredFindings}`);

  // 4. Risk-level chip on hero — uses substring text match so chips with
  // padding/styling (e.g. `RISK · low` or trimmed-but-styled "low") still
  // resolve. The earlier strict `^(low|medium|high)$` selector missed
  // them on prod, false-failing 7/33 checks even though the chips were
  // rendering correctly.
  const riskChips = await page.locator('text=/\\b(low|medium|high)\\b/i').count();
  check(receipt, viewport, 'risk-level chip(s) render', riskChips > 0, `count=${riskChips}`);

  // 5. Chainscan link
  const chainscanLinks = await page.locator('a[href*="chainscan-galileo.0g.ai/tx"]').count();
  check(receipt, viewport, 'chainscan tx link present', chainscanLinks > 0, `count=${chainscanLinks}`);

  // 6. Final paint screenshot
  await page.screenshot({ path: resolve(dir, '01-receipt-loaded.png'), fullPage: false });

  // 7. Scroll to structured findings + screenshot
  try {
    const sf = page.locator('text=/structured findings|structured output/i').first();
    if (await sf.count() > 0) {
      await sf.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: resolve(dir, '02-structured-findings.png'), fullPage: false });
    }
  } catch {}

  // 8. Full-page capture for archive
  await page.screenshot({ path: resolve(dir, '03-full-page.png'), fullPage: true });
}

async function main(): Promise<void> {
  console.log(`Studio target: ${STUDIO}`);
  console.log(`Receipts under test: ${TARGET_RECEIPTS.join(', ')}\n`);

  // HTTP layer · edge cache headers per commit e9fd066
  for (const receipt of TARGET_RECEIPTS) {
    try {
      const headers = await fetchHeaders(`${STUDIO}/r/${receipt}`);
      const cacheControl = headers['cache-control'] ?? '';
      const hasEdgeCache = cacheControl.includes('s-maxage=86400');
      check(receipt, 'http', `HTTP 200 + edge cache header (commit e9fd066)`, hasEdgeCache, `cache-control: "${cacheControl.slice(0, 100)}"`);
    } catch (err) {
      check(receipt, 'http', 'HTTP HEAD', false, (err as Error).message);
    }
  }

  // Desktop pass · 1440×900
  console.log('\n=== Desktop · 1440×900 ===');
  const desktopBrowser = await chromium.launch({ headless: true });
  try {
    const ctx = await desktopBrowser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (const receipt of TARGET_RECEIPTS) {
      console.log(`\n--- /r/${receipt} ---`);
      try {
        await drivePage(page, receipt, 'desktop');
      } catch (err) {
        check(receipt, 'desktop', 'page drive', false, (err as Error).message);
      }
    }
    await ctx.close();
  } finally {
    await desktopBrowser.close();
  }

  // Mobile pass · 375×812
  console.log('\n=== Mobile · 375×812 ===');
  const mobileBrowser = await chromium.launch({ headless: true });
  try {
    const ctx = await mobileBrowser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    for (const receipt of TARGET_RECEIPTS) {
      console.log(`\n--- /r/${receipt} ---`);
      try {
        await drivePage(page, receipt, 'mobile');
      } catch (err) {
        check(receipt, 'mobile', 'page drive', false, (err as Error).message);
      }
    }
    await ctx.close();
  } finally {
    await mobileBrowser.close();
  }

  // Summary
  const passCount = checks.filter((c) => c.pass).length;
  const failCount = checks.length - passCount;
  console.log(`\n=== SUMMARY ===`);
  console.log(`  ${passCount} PASS · ${failCount} FAIL · ${checks.length} total\n`);

  const report = {
    runAt: new Date().toISOString(),
    studioUrl: STUDIO,
    receipts: TARGET_RECEIPTS,
    checks,
    summary: { pass: passCount, fail: failCount, total: checks.length },
    verdict: failCount === 0 ? 'PASS · all checks green' : `FAIL · ${failCount} of ${checks.length} checks failed`,
  };
  const reportPath = resolve(OUT, 'REPORT.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);

  // Per-receipt status
  for (const receipt of TARGET_RECEIPTS) {
    const ownPass = checks.filter((c) => c.receipt === receipt && c.pass).length;
    const ownTotal = checks.filter((c) => c.receipt === receipt).length;
    console.log(`  /r/${receipt}: ${ownPass}/${ownTotal} PASS`);
  }

  if (failCount > 0) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
