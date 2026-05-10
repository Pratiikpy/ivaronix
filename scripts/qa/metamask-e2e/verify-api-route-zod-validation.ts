/**
 * Studio API route runtime-validation invariant.
 *
 * Closes HALF_BAKED §J-2 + sweeps 145-149. Every Studio API route that
 * reads a JSON body (POST/PUT/PATCH) MUST validate the body via Zod
 * `.safeParse()` before using it. The pre-sweep pattern was:
 *
 *   const body = (await req.json()) as SomeBody;
 *   if (!body.field) return 400;
 *
 * which accepts arbitrary types and sizes past the rate-limit gate.
 * The required pattern is:
 *
 *   const parsed = SomeSchema.safeParse(await req.json());
 *   if (!parsed.success) return 400;
 *
 * Contract:
 *   - Routes that call `req.json()` must also call `.safeParse(` AND
 *     import from 'zod'.
 *   - GET-only routes that never call `req.json()` are skipped.
 *   - Skip via inline `zod-allow:<reason>` marker if the route validates
 *     via a different mechanism (currently no such routes exist).
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const API_ROOT = resolve(REPO_ROOT, 'apps/studio/src/app/api');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

function walkRoutes(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkRoutes(full, out);
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      out.push(full);
    }
  }
}

const routes: string[] = [];
walkRoutes(API_ROOT, routes);
ok(`discovered ${routes.length} Studio API routes`);

const SKIP_MARKER = /zod-allow:[a-zA-Z0-9_-]+/;
const violations: Array<{ file: string; reason: string }> = [];
let validated = 0;
let bodyless = 0;

for (const file of routes) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');

  if (!/req\.json\s*\(/.test(content)) {
    bodyless++;
    continue;
  }

  if (SKIP_MARKER.test(content)) {
    validated++;
    continue;
  }

  const hasZodImport = /from\s+['"]zod['"]/.test(content);
  const hasSafeParse = /\.safeParse\s*\(/.test(content);

  if (!hasZodImport) {
    violations.push({ file: rel, reason: "calls req.json() but does not import from 'zod'" });
    continue;
  }
  if (!hasSafeParse) {
    violations.push({ file: rel, reason: 'imports zod but never calls .safeParse() — schema parse missing' });
    continue;
  }

  const legacyCast = content.match(/\bawait\s+req\.json\s*\(\s*\)\s*\)\s*as\s+\w+/);
  if (legacyCast) {
    violations.push({
      file: rel,
      reason: `legacy cast pattern still present: ${legacyCast[0].slice(0, 60)}`,
    });
    continue;
  }
  validated++;
}

if (violations.length > 0) {
  console.error('FAIL: API routes missing Zod runtime validation:');
  for (const v of violations) {
    console.error(`  ${v.file}  - ${v.reason}`);
  }
  console.error('Fix: define a Zod schema (e.g. `const BodySchema = z.object({...})`),');
  console.error('     parse via `BodySchema.safeParse(await req.json())`,');
  console.error('     return 400 with `parsed.error.issues` on failure.');
  console.error('Allow-marker: add `zod-allow:<reason>` inline if the route validates differently.');
  process.exit(1);
}

ok(`${validated} body-taking routes validated via Zod`);
ok(`${bodyless} bodyless routes (GET-only, no body parse)`);
console.log(`\n[verify-api-route-zod-validation] ${asserts} assertions passed`);
