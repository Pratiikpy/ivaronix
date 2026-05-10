/**
 * Studio API route operator-write rate-limit invariant.
 *
 * Every route under `apps/studio/src/app/api/.../route.ts` that consumes
 * the operator key OR uploads to 0G Storage OR writes to chain MUST
 * import `checkRateLimit` from `@/lib/rate-limit`. Without this gate, an
 * anonymous caller can drain the operator wallet by hammering the
 * endpoint — every call pays gas or storage fees.
 *
 * Operator-write tells (any one is sufficient to require rate-limit):
 *   - `IVARONIX_SIGNER_KEY` / `OG_PRIVATE_KEY` / `EVM_PRIVATE_KEY` env reads
 *   - `createStorageClient(` call
 *   - `signTypedData(` call (off-chain anchor signature)
 *   - `wallet.connect(`, `Wallet(`, `new Wallet(` (signer hydration)
 *   - `writeContract(` call (viem/wagmi server-side write)
 *
 * Skip pattern: routes annotated with the marker
 * `rate-limit-allow:<reason>` are exempt (read-only endpoints that happen
 * to import the operator key for fingerprinting, intentional public
 * surfaces, etc.). The reason is mandatory.
 *
 * Pure source-file regression — no server needed.
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

const OPERATOR_WRITE_TELLS: RegExp[] = [
  /\bIVARONIX_SIGNER_KEY\b/,
  /\bOG_PRIVATE_KEY\b/,
  /\bEVM_PRIVATE_KEY\b/,
  /\bcreateStorageClient\s*\(/,
  /\bsignTypedData\s*\(/,
  /\bnew Wallet\s*\(/,
  /\bwriteContract\s*\(/,
  /\brunPipeline\s*\(/,
  /\brememberNote\s*\(/,
  /\bforgetNote\s*\(/,
  /\bforgetBeforeNotes\s*\(/,
];

const SKIP_MARKER = /rate-limit-allow:[a-zA-Z0-9_-]+/;

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

let writesGated = 0;
let writesSkipped = 0;
let readonly = 0;
const violations: Array<{ file: string; matched: string }> = [];

for (const file of routes) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');

  const matchedTell = OPERATOR_WRITE_TELLS.find((re) => re.test(content));
  if (!matchedTell) {
    readonly++;
    continue;
  }

  if (SKIP_MARKER.test(content)) {
    writesSkipped++;
    continue;
  }

  const hasRateLimit = /from\s+['"]@\/lib\/rate-limit['"]/.test(content) && /\bcheckRateLimit\s*\(/.test(content);
  if (!hasRateLimit) {
    violations.push({ file: rel, matched: matchedTell.source });
  } else {
    writesGated++;
  }
}

if (violations.length > 0) {
  console.error('FAIL: operator-write API routes missing checkRateLimit:');
  for (const v of violations) {
    console.error(`  ${v.file}  (matched: ${v.matched})`);
  }
  console.error('Fix: import checkRateLimit from @/lib/rate-limit and gate the route, OR add a `rate-limit-allow:<reason>` marker in a comment with the explicit reason it is safe to skip.');
  process.exit(1);
}

ok(`${writesGated} operator-write routes gated on checkRateLimit`);
ok(`${writesSkipped} routes carry an explicit rate-limit-allow marker`);
ok(`${readonly} read-only routes (no operator-write tell)`);
console.log(`\n[verify-api-route-rate-limit] ${asserts} assertions passed`);
