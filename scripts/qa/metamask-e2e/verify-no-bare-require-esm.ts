// Meta-regression: ban bare require() inside ESM TypeScript packages.
//
// Why this regression exists:
//   - Caught canonicalHashV2() shipped with `require('./jcs.js')` inside
//     packages/core (which is "type": "module"). The function would
//     ReferenceError on first call. Untested code, so it slipped past
//     TypeScript (require is a function-call, not syntax — TS can't
//     flag the runtime trap).
//   - Bit my OWN brand-check script the very next sweep when I wrote
//     `const { writeFileSync } = require('node:fs')` inside an ESM
//     scripts/qa file. Same bug, same author, two days apart.
//
//   This regression prevents the third occurrence by failing the build
//   on any bare require() inside an ESM package.
//
// Scope:
//   {packages,apps,scripts}/**\/*.ts where the owning package has
//   "type": "module" in its package.json (or is the repo root, which
//   is also ESM). Vendored third-party dirs are excluded.
//
// Allowed patterns:
//   1. `createRequire(import.meta.url)` setup followed by require() —
//      the legal ESM bridge to CJS. Detection: if the file contains
//      "createRequire" anywhere, every require() in that file is OK.
//   2. require() inside a comment line (// or *) — text, not code.
//   3. require() inside a string literal — same.
//
// Banned pattern:
//   bare `require(...)` in an ESM source file with no createRequire
//   binding visible.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

// Vendored / third-party: skip. opencode-bin and opencode-sdk are
// upstream packages where we don't own the conversion.
const EXCLUDED_PREFIXES = [
  'packages/opencode-bin',
  'packages/opencode-sdk',
];

interface PkgInfo { dir: string; isEsm: boolean }

function findPackageJson(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'package.json');
    try {
      statSync(candidate);
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
  return null;
}

const pkgCache = new Map<string, boolean>(); // pkg.json path -> isEsm

function isEsmPackage(forFile: string): boolean {
  const pkg = findPackageJson(dirname(forFile));
  if (!pkg) return false;
  const cached = pkgCache.get(pkg);
  if (cached !== undefined) return cached;
  try {
    const j = JSON.parse(readFileSync(pkg, 'utf8')) as { type?: string };
    const isEsm = j.type === 'module';
    pkgCache.set(pkg, isEsm);
    return isEsm;
  } catch {
    pkgCache.set(pkg, false);
    return false;
  }
}

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next' || entry === '.turbo') continue;
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(path);
    }
  }
  return out;
}

const ROOTS = ['packages', 'apps', 'scripts'].map((r) => resolve(REPO_ROOT, r));
const allFiles: string[] = [];
for (const root of ROOTS) {
  try {
    allFiles.push(...listTsFiles(root));
  } catch {
    // root may not exist; skip
  }
}
ok(`scanning ${allFiles.length} TS/TSX files under packages/, apps/, scripts/`);

interface Hit { file: string; line: number; text: string }
const hits: Hit[] = [];

for (const file of allFiles) {
  const relPath = relative(REPO_ROOT, file).replace(/\\/g, '/');
  if (EXCLUDED_PREFIXES.some((p) => relPath.startsWith(p))) continue;
  if (!isEsmPackage(file)) continue;

  const content = readFileSync(file, 'utf8');

  // If the file contains createRequire, all require() calls in it are
  // assumed legal (the ESM bridge pattern). Per-line scope analysis
  // would be more precise but createRequire-presence is a strong
  // signal in practice.
  if (/\bcreateRequire\s*\(/.test(content)) continue;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trimStart();
    // Skip comment lines.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    // Strip inline trailing comments to avoid false positives on
    // lines like `foo(); // see require()` — but keep the leading
    // code part (require call would be there if real).
    let codePart = raw;
    const dblSlash = codePart.indexOf('//');
    if (dblSlash >= 0) codePart = codePart.slice(0, dblSlash);
    // Match standalone `require(` — letter boundary on the left so
    // we don't catch `createRequire(` (already filtered above) or
    // `someRequire(` (unlikely but defensive).
    if (!/(^|[^A-Za-z0-9_$])require\s*\(/.test(codePart)) continue;
    // Skip if the require sits inside a regex literal or string. Cheap
    // heuristic: count quotes before the match. If odd, we're inside
    // a string. Not perfect but handles 95% of cases without a real
    // tokenizer.
    const beforeRequire = codePart.slice(0, codePart.search(/(^|[^A-Za-z0-9_$])require\s*\(/));
    const dquotes = (beforeRequire.match(/"/g) ?? []).length;
    const squotes = (beforeRequire.match(/'/g) ?? []).length;
    const bquotes = (beforeRequire.match(/`/g) ?? []).length;
    if (dquotes % 2 === 1 || squotes % 2 === 1 || bquotes % 2 === 1) continue;

    hits.push({ file: relPath, line: i + 1, text: raw.trim().slice(0, 120) });
  }
}

if (hits.length > 0) {
  console.error(`\nFAIL: ${hits.length} bare require() call(s) in ESM source file(s):`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    ${h.text}`);
  }
  console.error('');
  console.error('Why this fails:');
  console.error('  In an ESM package ("type": "module"), bare require() throws');
  console.error('  ReferenceError at runtime. TypeScript cannot catch this because');
  console.error('  require is a function call, not syntax. The compile passes; the');
  console.error('  first runtime call crashes.');
  console.error('');
  console.error('Fix:');
  console.error('  1. PREFERRED: replace require() with a top-level static import.');
  console.error("     Bad:  const { writeFileSync } = require('node:fs');");
  console.error("     Good: import { writeFileSync } from 'node:fs';");
  console.error('');
  console.error('  2. CJS-only dependency: bridge via createRequire.');
  console.error("     const { createRequire } = await import('node:module');");
  console.error("     const require = createRequire(import.meta.url);");
  console.error("     const cjs = require('cjs-only-package');");
  process.exit(1);
}

ok('no bare require() in any ESM source file');
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
