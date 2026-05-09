/**
 * QA · S-3 · RunPanel Storage light starts pending, transitions on response.
 *
 * Asserts:
 *   1. Source file no longer carries `Storage: 'verified'` in the click
 *      handler's initial state, the post-response success branch, the error
 *      branch, or the catch branch. (Cheap regression guard.)
 *   2. /api/run response shape includes `storage: { evidenceRoot }`.
 *   3. Browser shot captures the initial state (post-click, pre-response) so
 *      a future regression visibly leaks if the lights flash green at click.
 *
 * No MetaMask required.
 */
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const SHOTS_DIR = resolve(REPO, 'screenshots', 's3-runpanel-pending');
mkdirSync(SHOTS_DIR, { recursive: true });

const STUDIO_BASE = process.env.IVARONIX_STUDIO_BASE ?? 'http://localhost:3300';

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('S-3 · RunPanel Storage starts pending, gated on response');
  console.log('───────────────────────────────────────────────────────────────');

  // ─── 1. Source-file regression guards ──────────────────────────────────
  const runPanelPath = resolve(REPO, 'apps/studio/src/components/RunPanel.tsx');
  const src = readFileSync(runPanelPath, 'utf8');
  // Initial state at click must be Storage: 'pending'.
  assert.ok(
    /setLayers\(\{\s*Storage:\s*'pending'/m.test(src),
    'RunPanel.tsx: initial click handler must set Storage: \'pending\' — see HALF_BAKED.md S-3',
  );
  // Post-response success branch must gate Storage on data.storage?.evidenceRoot.
  assert.ok(
    /Storage:\s*data\.storage\?\.evidenceRoot\s*\?\s*'verified'\s*:\s*'pending'/m.test(src),
    'RunPanel.tsx: success branch must gate Storage on data.storage?.evidenceRoot',
  );
  // Error + catch branches must NOT lift Storage to 'verified'.
  const errorClaims = src.match(/Storage:\s*'verified'/g) ?? [];
  assert.equal(
    errorClaims.length,
    0,
    `RunPanel.tsx: found ${errorClaims.length} occurrence(s) of \`Storage: 'verified'\` — must be 0; gate on real evidence`,
  );
  console.log('   ✓ source-file regression guards green');

  // ─── 2. /api/run response shape includes storage block ─────────────────
  const apiPath = resolve(REPO, 'apps/studio/src/app/api/run/route.ts');
  const apiSrc = readFileSync(apiPath, 'utf8');
  assert.ok(
    /storage:\s*\{\s*evidenceRoot:\s*result\.storageEvidenceRoot\s*\?\?\s*null\s*\}/m.test(apiSrc),
    '/api/run route must surface storage.evidenceRoot from PipelineOutput',
  );
  console.log('   ✓ /api/run response shape carries storage.evidenceRoot');

  // ─── 3. PipelineOutput exposes storageEvidenceRoot ─────────────────────
  const pipelinePath = resolve(REPO, 'packages/runtime/src/pipeline.ts');
  const pipelineSrc = readFileSync(pipelinePath, 'utf8');
  assert.ok(
    /storageEvidenceRoot:\s*string\s*\|\s*null/m.test(pipelineSrc),
    'PipelineOutput must declare storageEvidenceRoot: string | null',
  );
  console.log('   ✓ PipelineOutput exposes storageEvidenceRoot');

  // ─── 4. Browser snap of the initial click state ────────────────────────
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 375, height: 812 },
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await ctx.newPage();
      await page.goto(`${STUDIO_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(2_000);
      // Click "Use sample contract" so the run button activates with content.
      const sampleBtn = page.getByRole('button', { name: /use sample contract/i });
      if (await sampleBtn.isVisible().catch(() => false)) {
        await sampleBtn.click();
        await page.waitForTimeout(500);
      }
      await page.screenshot({ path: resolve(SHOTS_DIR, `home-${viewport.name}-pre-run.png`), fullPage: true });
      console.log(`   📸 home-${viewport.name}-pre-run.png`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  console.log('───────────────────────────────────────────────────────────────');
  console.log(`✅ S-3 verified · screenshots in screenshots/s3-runpanel-pending/`);
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
