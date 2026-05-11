/**
 * Studio API routes must not return raw `(err as Error).message` in
 * client-facing JSON. HALF_BAKED §K-11 closure lock (sweep 212).
 *
 * Pre-fix shape (the leak):
 *   return NextResponse.json({ error: (err as Error).message }, { status: 500 });
 *
 * That string can carry filesystem absolute paths, operator wallet
 * addresses, env-misconfig details, indexer URLs. A judge running a
 * failing request sees the operator's machine's `.ivaronix/` path
 * in the response.
 *
 * Required shape: wrap with `sanitizeErrorMessage(err)` from
 * `@/lib/error-sanitize`. The full err still goes to `console.error`
 * for server-log capture, but the client payload is path-stripped +
 * address-stripped + env-var-stripped + first-line + length-capped.
 *
 * In-scope: every `route.ts` under `apps/studio/src/app/api/` (recursive).
 *
 * Forbidden pattern: a JSON response constructed in the same line as
 * `(err as Error).message` without an adjacent `sanitizeErrorMessage`
 * call. We approximate "adjacent" by checking that any line referencing
 * `(err as Error).message` in this directory also has a sibling
 * `sanitizeErrorMessage` call within the same file.
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const API_ROOT = resolve(REPO_ROOT, 'apps', 'studio', 'src', 'app', 'api');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

function findRouteFiles(dir: string, out: string[]): void {
  let entries: string[];
  try { entries = readdirSync(dir); }
  catch { return; }
  for (const name of entries) {
    const full = resolve(dir, name);
    let stat;
    try { stat = statSync(full); }
    catch { continue; }
    if (stat.isDirectory()) findRouteFiles(full, out);
    else if (name === 'route.ts') out.push(full);
  }
}

const routes: string[] = [];
findRouteFiles(API_ROOT, routes);
ok(`found ${routes.length} Studio API routes under apps/studio/src/app/api/`);

// Forbidden form: `(err as Error).message` appearing in code that
// constructs a JSON response, WITHOUT a `sanitizeErrorMessage` call
// somewhere in the same file. The file-level check is conservative —
// a route MAY reference err.message in a non-leaking context (e.g.
// matching a startsWith for routing decisions, as dashboard does for
// 'invalid address'). Adding the sanitizer import + at least one
// call site is the contract.
//
// Skip pattern: inline `error-sanitize-allow:<reason>` comment.

interface Finding {
  file: string;
  leakLines: number[];
  hasSanitizer: boolean;
  hasAllowMarker: boolean;
}

const violations: Finding[] = [];
let scannedRoutes = 0;
let routesWithLeak = 0;

for (const file of routes) {
  const src = readFileSync(file, 'utf8');
  if (!/\(err\s+as\s+Error\)\.message/.test(src)) {
    scannedRoutes++;
    continue;
  }
  scannedRoutes++;
  routesWithLeak++;

  const hasSanitizer = /\bsanitizeErrorMessage\s*\(/.test(src);
  const hasAllowMarker = /error-sanitize-allow:/.test(src);

  if (hasSanitizer || hasAllowMarker) continue;

  // Find the offending lines.
  const lines = src.split(/\r?\n/);
  const leakLines: number[] = [];
  lines.forEach((line, i) => {
    if (/\(err\s+as\s+Error\)\.message/.test(line)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      // Allow err.message in a routing-decision context (e.g.
      // `if (msg.startsWith('invalid address'))`). The leak class
      // is when it lands in a JSON response.
      if (/startsWith\s*\(|includes\s*\(|===\s*['"]/.test(line)) return;
      leakLines.push(i + 1);
    }
  });
  if (leakLines.length > 0) {
    violations.push({ file, leakLines, hasSanitizer, hasAllowMarker });
  }
}

ok(`scanned ${scannedRoutes} routes; ${routesWithLeak} reference (err as Error).message`);

if (violations.length > 0) {
  console.error('');
  console.error(`FAIL: ${violations.length} API route(s) leak raw err.message in JSON responses:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)} lines ${v.leakLines.join(', ')}`);
  }
  console.error('');
  console.error('Fix: wrap with sanitizeErrorMessage(err) from @/lib/error-sanitize.');
  console.error('  import { sanitizeErrorMessage } from "@/lib/error-sanitize";');
  console.error('  // ...');
  console.error('  } catch (err) {');
  console.error('    console.error("[api/route-name] error:", err);');
  console.error('    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 });');
  console.error('  }');
  console.error('Allow-marker: `error-sanitize-allow:<reason>` inline.');
  process.exit(1);
}

ok(`every route with err.message reference has sanitizeErrorMessage adjacent`);

console.log(`\n[verify-api-route-error-sanitize] ${asserts} assertions passed`);
