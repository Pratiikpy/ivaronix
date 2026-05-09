// Comprehensive surface regression — hits every public Studio route at
// desktop + mobile, asserts no Next.js build errors, captures one snap
// per (route, viewport) so "every side verified" is a literal proof.
//
// No MetaMask: routes that need a wallet (dashboard, memory) use the
// ?address= query path or the disconnected-state honest fallback. The
// CLI signing flows are exercised in the per-feature verify-*.ts scripts
// and in the live receipt anchor (#1304).

import { chromium, type Page } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', 'all-surfaces');
mkdirSync(SHOTS_DIR, { recursive: true });

const OPERATOR = '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce';
const ROOM_ID = '01KR66C1GJVR57MHQPJCW1HQQY';
const DELEGATE_ID = '01KR67PT76V9AQTHN413PYWB1J';

interface Surface {
  path: string;
  name: string;
  // Optional content checks: every regex must match the rendered body text.
  must: RegExp[];
  // Optional banned words that must NOT appear (voice-clean).
  banned?: string[];
  // settle ms before snapshot — chain RPC pages need longer.
  settleMs?: number;
}

const SURFACES: Surface[] = [
  { path: '/', name: 'home', must: [/can.t paste/i, /receipts on-chain/i], banned: ['delve', 'unlock', 'unleash', 'leverage'] },
  { path: '/thesis', name: 'thesis', must: [/Some documents are too sensitive/i, /three choices today/i], banned: ['delve', 'unlock', 'unleash', 'leverage', 'robust'] },
  { path: '/docs', name: 'docs', must: [/0G modules/i, /0G Chain/, /INTEGRATED|ROADMAP/] },
  { path: '/skills', name: 'skills', must: [/skill catalog/i, /Compose a new skill/i] },
  { path: '/skill/new', name: 'skill-new', must: [/Compose a skill/i, /live preview/i] },
  { path: `/agent/${OPERATOR}`, name: 'agent-operator', must: [/§ AGENT/i, /Trust score/i], settleMs: 6000 },
  { path: `/delegate/${DELEGATE_ID}`, name: 'delegate', must: [/§ DELEGATE/i, /KEY CUSTODY/i] },
  { path: `/data-room/${ROOM_ID}`, name: 'data-room', must: [/Confidential/i, /MANIFEST/i] },
  { path: `/dashboard?address=${OPERATOR}`, name: 'dashboard-via-query', must: [/Agent view/i, /scheduled runs/i], settleMs: 14000 },
  { path: '/global', name: 'global', must: [/Live testnet stats/i] },
  { path: '/onboard', name: 'onboard', must: [/Get started|Onboard|step/i] },
  { path: '/memory', name: 'memory', must: [/Memory|connect a wallet/i] },
  { path: '/r/1004', name: 'r-1004', must: [/Receipt/i, /TIER/i] },
  { path: '/r/1252', name: 'r-1252-consolidation', must: [/Receipt/i] },
  { path: '/r/1304', name: 'r-1304-fresh', must: [/Receipt/i] },
  { path: '/r/1004/print', name: 'r-1004-print', must: [/IVARONIX · ACTION RECEIPT/i, /Verify this receipt/i] },
  { path: '/embed/r/1004', name: 'embed-r-1004', must: [/IVARONIX RECEIPT/i, /TIER/i] },
];

let pass = 0, fail = 0;
const failures: string[] = [];

async function visit(page: Page, surface: Surface): Promise<{ ok: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  await page.goto(`http://localhost:3300${surface.path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(surface.settleMs ?? 3500);
  // Wait for chain-RPC-backed pages to finish loading before checking content
  await page.waitForFunction(
    () => !/Loading from chain/i.test(document.body.innerText || ''),
    { timeout: 30_000 },
  ).catch(() => { /* timeout ok — we'll catch the missing-content as a regular failure */ });
  await page.waitForTimeout(500);
  // Detect Next build error overlay
  const buildErr = await page.locator('text=/Build Error|Failed to compile/i').first().isVisible({ timeout: 200 }).catch(() => false);
  if (buildErr) reasons.push('Next.js build error overlay rendered');
  const text = await page.evaluate(() => document.body.innerText || '').catch(() => '');
  for (const rx of surface.must) {
    if (!rx.test(text)) reasons.push(`missing required match: ${rx}`);
  }
  if (surface.banned) {
    const lower = text.toLowerCase();
    const hits = surface.banned.filter((w) => lower.includes(w));
    if (hits.length) reasons.push(`banned words: ${hits.join(', ')}`);
  }
  return { ok: reasons.length === 0, reasons };
}

async function snap(page: Page, label: string): Promise<void> {
  const safe = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  await page.screenshot({ path: resolve(SHOTS_DIR, `${safe}.png`), fullPage: false }).catch(() => {});
}

async function runViewport(viewport: { width: number; height: number }, label: string) {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport });
  ctx.setDefaultTimeout(60_000);
  ctx.setDefaultNavigationTimeout(120_000);
  const page = await ctx.newPage();
  console.log(`\n=== ${label} (${viewport.width}×${viewport.height}) ===`);
  for (const s of SURFACES) {
    const res = await visit(page, s);
    await snap(page, `${label}-${s.name}`);
    if (res.ok) {
      pass++;
      console.log(`   ✓ ${s.path}`);
    } else {
      fail++;
      failures.push(`${label} · ${s.path} · ${res.reasons.join(' / ')}`);
      console.log(`   ✗ ${s.path}  · ${res.reasons.join(' / ')}`);
    }
  }
  await ctx.close();
  await browser.close();
}

(async () => {
  await runViewport({ width: 1440, height: 900 }, 'desktop');
  await runViewport({ width: 375, height: 812 }, 'mobile');

  console.log(`\n=== Summary ===`);
  console.log(`pass  ${pass}`);
  console.log(`fail  ${fail}`);
  if (failures.length) {
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`   ${f}`);
  }
  console.log(`\nScreenshots: ${SHOTS_DIR}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
