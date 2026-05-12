/**
 * `apps/studio/src/**` MUST NOT import `loadDeployments` or `getDeployedAddress`
 * from `@ivaronix/og-chain`.
 *
 * Closes QA-VERCEL-CHAIN-READ regression. Both functions in og-chain walk up
 * from `process.cwd()` looking for `contracts/deployments/<network>.json`.
 * That file is NOT in the Vercel serverless function bundle, so every chain
 * client resolves to null → /r/<id> returns 404, /api/dashboard returns
 * empty, the Footer's Network column renders zero links.
 *
 * The fix is to import from `apps/studio/src/lib/deployments-bundle.ts`
 * instead — that module statically imports the JSON, so webpack traces it
 * into the function bundle. Two fixes already shipped against this pattern:
 *
 *   b342fd1  fix(studio): build-time import contracts/deployments — chain
 *            reads broken on Vercel
 *   2d9e01f  fix(studio): Footer.tsx — same Vercel chain-read bug, all 8
 *            contract links blank
 *
 * Both bugs would have been caught at pre-commit time if this regression
 * had existed. Now it does.
 *
 * Pure source-file regression — no chain, no live deploy.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const STUDIO_SRC = resolve(REPO_ROOT, 'apps', 'studio', 'src');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = resolve(dir, name);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

const studioFiles: string[] = [];
walk(STUDIO_SRC, studioFiles);
ok(`scanned ${studioFiles.length} TS/TSX files under apps/studio/src/`);

// Match imports of either loadDeployments or getDeployedAddress directly from
// '@ivaronix/og-chain'. Tolerates multi-line imports and named-alias forms.
//   import { getDeployedAddress } from '@ivaronix/og-chain';
//   import { loadDeployments, MemoryAccessLogClient } from '@ivaronix/og-chain';
//   import { getDeployedAddress as foo } from '@ivaronix/og-chain';
const importRe = /import\s*\{([^}]*)\}\s*from\s*['"]@ivaronix\/og-chain['"]/g;

const violations: Array<{ file: string; line: number; match: string }> = [];

for (const file of studioFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(importRe)) {
    const inner = m[1] ?? '';
    if (!/\b(loadDeployments|getDeployedAddress)\b/.test(inner)) continue;
    // Find the line number of the match start.
    const upto = src.slice(0, m.index ?? 0);
    const line = upto.split(/\r?\n/).length;
    violations.push({
      file: file.slice(REPO_ROOT.length + 1).replace(/\\/g, '/'),
      line,
      match: m[0].replace(/\s+/g, ' ').trim(),
    });
  }
}

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} Studio file(s) import 'loadDeployments' or 'getDeployedAddress' from '@ivaronix/og-chain':`);
  console.error('');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.match}`);
  }
  console.error('');
  console.error('Why this breaks on Vercel:');
  console.error('  These functions read contracts/deployments/<network>.json via a process.cwd() walk-up.');
  console.error('  On Vercel, contracts/ is NOT in the serverless function bundle, so the lookup returns');
  console.error('  null and every contract client resolves to null. /r/<id> returns 404, the dashboard');
  console.error('  returns empty, and the Footer Network column renders zero links.');
  console.error('');
  console.error('Fix:');
  console.error('  Swap the import to apps/studio/src/lib/deployments-bundle.ts:');
  console.error('    import { getStudioDeployedAddress as getDeployedAddress } from \'@/lib/deployments-bundle\';');
  console.error('    import { getStudioDeployments as loadDeployments } from \'@/lib/deployments-bundle\';');
  console.error('  That module statically imports the JSON so webpack traces it into the bundle.');
  console.error('');
  console.error('Closes audits VERCEL-CHAIN-READ-1 (b342fd1) and VERCEL-CHAIN-READ-2 (2d9e01f).');
  process.exit(1);
}
ok('no Studio file imports getDeployedAddress / loadDeployments from @ivaronix/og-chain');

console.log(`\n[verify-no-og-chain-deployments-import-in-studio] ${asserts} assertions passed`);
