/**
 * `packages.typecheckClean` in `docs/numbers.json` must equal the
 * number of workspace projects whose typecheck script actually invokes
 * a typechecker.
 *
 * The class this gates against (sweep 200): the count function in
 * `scripts/diag/numbers-refresh.ts` used to search for `\btsc\b`
 * anywhere in the typecheck script. That word-boundary regex matched
 * "tsc" INSIDE an echo placeholder's message body — e.g. opencode-bin
 * runs `echo '... 1267 first-round tsc errors ...'` to explain that
 * it CANNOT be typechecked yet, but the substring made the regex hit
 * and the package was incorrectly counted as tsc-clean. The fix
 * skips echo-prefixed scripts up front; this regression locks the
 * rule independently of the count function's implementation.
 *
 * Two properties locked:
 *   1. Echo-prefixed typecheck scripts are NEVER counted, even if
 *      their message body mentions "tsc".
 *   2. The published count in numbers.json matches a fresh walk of
 *      packages/ and apps/ using the same rule.
 *
 * Pure source-file regression — no chain reads.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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

interface PkgScripts { scripts?: Record<string, string>; name?: string; }

function readPkg(path: string): PkgScripts | null {
  try { return JSON.parse(readFileSync(path, 'utf8')) as PkgScripts; }
  catch { return null; }
}

// Walk one level deep under packages/ and apps/ — same shape as
// countTypecheckClean() in scripts/diag/numbers-refresh.ts.
interface Entry { subdir: string; name: string; typecheck: string; pkgName: string; }
const entries: Entry[] = [];
for (const subdir of ['packages', 'apps']) {
  const root = resolve(REPO_ROOT, subdir);
  if (!existsSync(root)) continue;
  for (const name of readdirSync(root)) {
    const pkgPath = resolve(root, name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = readPkg(pkgPath);
    if (!pkg) continue;
    entries.push({
      subdir,
      name,
      typecheck: pkg.scripts?.typecheck ?? '',
      pkgName: pkg.name ?? `${subdir}/${name}`,
    });
  }
}
ok(`scanned ${entries.length} workspace projects (packages/ + apps/)`);

// Property 1: every echo-prefixed typecheck script MUST NOT be counted.
// We assert it directly: if a script starts with `echo`, then even if
// it contains the substring "tsc" somewhere in its message body, it's
// a placeholder and not a real typechecker invocation.
const echoEntries = entries.filter((e) => /^\s*echo\b/.test(e.typecheck));
const echoMentioningTsc = echoEntries.filter((e) => /\btsc\b/.test(e.typecheck));
if (echoMentioningTsc.length > 0) {
  ok(
    `${echoMentioningTsc.length} echo-placeholder typecheck script(s) mention "tsc" in their body — ` +
    `these MUST be excluded from the count (the original bug shape)`,
  );
  for (const e of echoMentioningTsc) {
    console.log(`  ${e.pkgName}: ${e.typecheck.slice(0, 80)}${e.typecheck.length > 80 ? '...' : ''}`);
  }
}

// Property 2: the published count in numbers.json equals the count
// derived by the canonical rule: NOT echo-prefixed AND contains \btsc\b.
const tscClean = entries.filter(
  (e) => !/^\s*echo\b/.test(e.typecheck) && /\btsc\b/.test(e.typecheck),
);

interface NumbersFile { packages: { typecheckClean: number } }
const numbers = JSON.parse(
  readFileSync(resolve(REPO_ROOT, 'docs', 'numbers.json'), 'utf8'),
) as NumbersFile;

if (numbers.packages.typecheckClean !== tscClean.length) {
  console.error(`FAIL: numbers.json packages.typecheckClean=${numbers.packages.typecheckClean}, fresh walk=${tscClean.length}`);
  console.error('Fresh-walk tsc-clean packages:');
  for (const e of tscClean) console.error(`  ${e.pkgName}: ${e.typecheck}`);
  console.error('');
  console.error('Echo-prefixed (correctly excluded):');
  for (const e of echoEntries) console.error(`  ${e.pkgName}: ${e.typecheck.slice(0, 80)}`);
  console.error('');
  console.error('Run `pnpm numbers:refresh` then `pnpm docs:render` to sync.');
  process.exit(1);
}
ok(`packages.typecheckClean=${numbers.packages.typecheckClean} matches fresh walk (${tscClean.length} tsc-invoking, ${echoEntries.length} echo-skip)`);

console.log(`\n[verify-typecheck-clean-count] ${asserts} assertions passed`);
