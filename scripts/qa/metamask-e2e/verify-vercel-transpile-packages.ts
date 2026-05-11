/**
 * Every `@ivaronix/*` workspace package that `apps/studio/src/` imports
 * MUST appear in `apps/studio/next.config.ts` `transpilePackages`.
 *
 * Closes VERCEL-DEPLOY-AUDIT-1 (production-deploy audit, post-sweep
 * 240+). Workspace packages ship raw ESM `.ts` source with `.js`
 * import extensions (NodeNext convention). In `next dev` the webpack
 * `extensionAlias` config papers over it, but a production `next build`
 * on Vercel only transpiles packages listed in `transpilePackages` —
 * anything missing fails with "Cannot use import statement outside a
 * module" or unresolved `.js` imports. The audit caught
 * `@ivaronix/og-storage` missing while `api/onboard/metadata/route.ts`
 * + `data-room/[id]/page.tsx` import it directly.
 *
 * Rule: the set of `@ivaronix/*` specifiers imported anywhere under
 * `apps/studio/src/` must be a subset of the `transpilePackages`
 * array in `next.config.ts`. (Extra entries in `transpilePackages`
 * are harmless — only MISSING ones break the build.)
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const STUDIO_SRC = resolve(REPO_ROOT, 'apps', 'studio', 'src');
const NEXT_CONFIG = resolve(REPO_ROOT, 'apps', 'studio', 'next.config.ts');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

// 1. Collect every @ivaronix/* specifier imported under apps/studio/src/.
function walk(dir: string, out: string[]): void {
  let entries: string[];
  try { entries = readdirSync(dir); }
  catch { return; }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = resolve(dir, name);
    let stat;
    try { stat = statSync(full); }
    catch { continue; }
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
}
const studioFiles: string[] = [];
walk(STUDIO_SRC, studioFiles);
ok(`scanned ${studioFiles.length} TS/TSX files under apps/studio/src/`);

const importRe = /(?:import|export)\s+(?:[^'"]*\s+from\s+)?['"](@ivaronix\/[a-z][a-z0-9-]*)['"]/g;
const imported = new Set<string>();
for (const file of studioFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(importRe)) imported.add(m[1]!);
}
// Also catch dynamic `import('@ivaronix/...')`.
const dynRe = /import\s*\(\s*['"](@ivaronix\/[a-z][a-z0-9-]*)['"]\s*\)/g;
for (const file of studioFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(dynRe)) imported.add(m[1]!);
}
ok(`Studio imports ${imported.size} @ivaronix/* package(s): ${[...imported].sort().join(', ')}`);

// 2. Parse the transpilePackages array out of next.config.ts.
const cfgSrc = readFileSync(NEXT_CONFIG, 'utf8');
const blockMatch = cfgSrc.match(/transpilePackages\s*:\s*\[([\s\S]*?)\]/);
if (!blockMatch) fail('transpilePackages array not found in apps/studio/next.config.ts');
const listed = new Set<string>(
  [...blockMatch![1]!.matchAll(/['"](@ivaronix\/[a-z][a-z0-9-]*)['"]/g)].map((m) => m[1]!),
);
ok(`transpilePackages lists ${listed.size} @ivaronix/* package(s): ${[...listed].sort().join(', ')}`);

// 3. Every imported package must be listed. (Listed-but-not-imported is fine.)
const missing = [...imported].filter((p) => !listed.has(p)).sort();
if (missing.length > 0) {
  console.error('');
  console.error(`FAIL: ${missing.length} @ivaronix/* package(s) imported by apps/studio/src/ but NOT in next.config.ts transpilePackages:`);
  for (const p of missing) console.error(`  ${p}`);
  console.error('');
  console.error('Fix: add the missing package(s) to the `transpilePackages` array in apps/studio/next.config.ts.');
  console.error('Without this, a production `next build` (Vercel) fails to transpile the raw .ts source.');
  process.exit(1);
}
ok(`every @ivaronix/* package Studio imports is in transpilePackages — Vercel build-safe`);

console.log(`\n[verify-vercel-transpile-packages] ${asserts} assertions passed`);
