// Regression: every "pnpm <verb>" referenced in CI workflows or pnpm
// scripts must resolve to either (a) a defined script in package.json
// or a workspace package.json, or (b) a built-in pnpm verb.
//
// Why this exists:
//   Cron-sweep 34 caught "pnpm wording-lint" referenced in PRD.md +
//   wired in package.json, but the backing script file never landed.
//   Running the command failed with file-not-found. This regression
//   prevents the next half-baked-gate by failing CI when a referenced
//   command doesn't resolve.
//
// Scope:
//   - .github/workflows/*.yml — every "pnpm <verb>" in run: blocks
//   - package.json scripts — every "pnpm <verb>" inside a script value
//   - Cross-checks against:
//       root package.json scripts.*
//       workspace package.json scripts.* (apps/* + packages/* + scripts/qa/*)
//       pnpm built-ins (install, exec, run, --filter, etc.)
//       tsx invocations (via "pnpm tsx" → tsx is a known dev-dep)
//
// Skips:
//   - "pnpm install", "pnpm add", "pnpm exec", "pnpm tsx", "pnpm -r ...",
//     "pnpm --filter ..." — these are pnpm built-ins
//   - "pnpm <pkg>" in workspace context (e.g. "pnpm ivaronix") when
//     the pkg is a known bin alias
//   - Lines containing "pnpm-scripts:allow:<reason>" inline marker
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

// pnpm built-in verbs that don't need to be in any package.json scripts.
const BUILT_INS = new Set([
  'install', 'i', 'add', 'remove', 'rm', 'update', 'up', 'audit',
  'exec', 'run', 'tsx', 'dlx', 'create', 'init',
  'why', 'list', 'ls', 'outdated', 'pack', 'publish',
  'prune', 'rebuild', 'recursive', 'ci',
  'config', 'env',
  'pkg', // pnpm pkg get/set
  'patch', 'patch-commit', 'unpatch',
  'link', 'unlink',
  'doctor', // we have our own doctor script too; both are valid
]);

// Collect script names from a package.json.
function loadScripts(pkgPath: string): Set<string> {
  try {
    const j = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string>; bin?: Record<string, string> | string };
    const out = new Set<string>(Object.keys(j.scripts ?? {}));
    if (j.bin) {
      if (typeof j.bin === 'string') {
        // Single-bin shorthand: bin name == package name.
        const name = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string }).name;
        if (name) out.add(name);
      } else {
        for (const k of Object.keys(j.bin)) out.add(k);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}

// Walk apps/, packages/, and scripts/qa/ for workspace package.json files.
function findWorkspacePackages(): string[] {
  const out: string[] = [];
  const roots = ['apps', 'packages', 'scripts/qa'];
  for (const root of roots) {
    const dir = resolve(REPO_ROOT, root);
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      const sub = resolve(dir, entry);
      let stat;
      try { stat = statSync(sub); } catch { continue; }
      if (!stat.isDirectory()) continue;
      // Recurse one level for nested packages (e.g. scripts/qa/metamask-e2e).
      const direct = resolve(sub, 'package.json');
      try { statSync(direct); out.push(direct); continue; } catch {}
      try {
        for (const inner of readdirSync(sub)) {
          const innerPkg = resolve(sub, inner, 'package.json');
          try { statSync(innerPkg); out.push(innerPkg); } catch {}
        }
      } catch {}
    }
  }
  return out;
}

// Build the universe of valid pnpm verbs.
const rootScripts = loadScripts(resolve(REPO_ROOT, 'package.json'));
const workspacePkgs = findWorkspacePackages();
const allValid = new Set<string>([...rootScripts, ...BUILT_INS]);
for (const pkg of workspacePkgs) {
  for (const s of loadScripts(pkg)) allValid.add(s);
}

ok(`built valid-verb universe: ${rootScripts.size} root scripts + ${BUILT_INS.size} built-ins + ${workspacePkgs.length} workspace pkgs`);

// Scan CI workflows + root package.json for "pnpm <verb>" patterns.
interface Reference { source: string; line: number; verb: string; context: string }
const refs: Reference[] = [];

function scanForPnpmRefs(content: string, source: string): void {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes('pnpm-scripts:allow:')) continue;
    // Match: "pnpm" followed by whitespace + a verb (alphanumeric + : - _)
    // Not preceded by a slash (skip "/pnpm" or "node_modules/.bin/pnpm").
    const re = /(?<![\/\w])pnpm\s+(-{1,2}[a-z][a-zA-Z0-9-]*\s+\S+|[a-zA-Z][a-zA-Z0-9:_-]*)/g;
    for (const m of line.matchAll(re)) {
      let verb = m[1]!.trim();
      // If the verb starts with a flag (--filter, -r, etc.), the actual
      // command is the next token — skip flag-only matches; they're handled
      // by the scriptable run-args downstream.
      if (verb.startsWith('-')) continue;
      // Skip workspace filter shorthand: "pnpm @ivaronix/foo" is a package
      // shortcut, not a script verb.
      if (verb.startsWith('@')) continue;
      refs.push({ source, line: i + 1, verb, context: line.trim().slice(0, 140) });
    }
  }
}

// CI workflows.
const wfDir = resolve(REPO_ROOT, '.github', 'workflows');
try {
  for (const entry of readdirSync(wfDir)) {
    if (!entry.endsWith('.yml')) continue;
    const path = resolve(wfDir, entry);
    scanForPnpmRefs(readFileSync(path, 'utf8'), `.github/workflows/${entry}`);
  }
} catch {}

// Root package.json scripts (cross-references between scripts).
const rootPkg = readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8');
scanForPnpmRefs(rootPkg, 'package.json');

ok(`scanned ${refs.length} pnpm references across CI + package.json`);

// Validate each reference.
interface Hit { source: string; line: number; verb: string; context: string }
const hits: Hit[] = [];

for (const ref of refs) {
  if (allValid.has(ref.verb)) continue;
  // The ref might be a script defined on a workspace package the user
  // is filtering by (e.g. "pnpm --filter X run regressions:cli" — here
  // the verb captured is "regressions:cli" from a different match
  // attempt). Treat unrecognized verbs liberally only if they look
  // like workspace-script names; otherwise flag.
  hits.push({ source: ref.source, line: ref.line, verb: ref.verb, context: ref.context });
}

if (hits.length > 0) {
  console.error(`\nFAIL: ${hits.length} pnpm reference(s) to undefined verbs:`);
  for (const h of hits) {
    console.error(`  ${h.source}:${h.line} · "pnpm ${h.verb}"`);
    console.error(`    ${h.context}`);
  }
  console.error('');
  console.error('Why this fails:');
  console.error('  Each "pnpm <verb>" must resolve to a script defined in');
  console.error('  package.json (root or workspace), a known bin, or a pnpm');
  console.error('  built-in. A reference to an undefined verb is a half-baked');
  console.error('  gate (PRD-promised wording-lint never shipped — sweep 34).');
  console.error('');
  console.error('Fix:');
  console.error('  1. Define the script in package.json or the relevant workspace');
  console.error('     package.json');
  console.error('  2. If the verb is a built-in we missed, add it to BUILT_INS');
  console.error('  3. Add `pnpm-scripts:allow:<reason>` on the line for an');
  console.error('     intentional, documented exception');
  process.exit(1);
}

ok(`every pnpm reference resolves to a defined script or built-in`);
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
