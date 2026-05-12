/**
 * iter-103 → iter-104 cron sweep closure regression.
 *
 * Five separate stale-URL fallbacks were caught + fixed in 2 iters:
 *
 *   apps/studio/src/app/layout.tsx                metadataBase localhost
 *   apps/studio/src/app/r/[id]/print/page.tsx     verifyUrl ivaronix.studio
 *   apps/studio/src/app/embed/r/[id]/page.tsx     "View full receipt" link
 *   apps/studio/src/app/0g/opengraph-image.tsx    bottom-text label
 *   apps/studio/src/app/r/[id]/opengraph-image.tsx bottom-text label
 *
 * Pattern: hardcoded 'https://ivaronix.studio' or 'http://localhost:3300'
 * as the production fallback. Both are wrong on Vercel deploys —
 * ivaronix.studio doesn't resolve via DNS, and localhost is only
 * meaningful in dev. The Vercel-canonical fallback chain is:
 *
 *   NEXT_PUBLIC_BASE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL → localhost
 *
 * This regression fails CI if any TS/TSX file in apps/studio/src or
 * packages/widget/src reintroduces a hardcoded 'ivaronix.studio' OR
 * a localhost-only fallback for a publicly-visible URL (metadataBase,
 * og:image, verify-from-any-machine links).
 *
 * Allowlist (intentional refs):
 *   - JSON Schema $schema URIs are conventionally stable identifiers
 *     (apps/cli/src/commands/skill-registry-export.ts:113 with comment)
 *   - Historical-comment refs (JSDoc explaining past bugs) — allowed
 *     when the line contains "Pre-fix" or "iter-103" or "dead domain"
 *
 * Scope: apps/studio/src + packages/widget/src (the user-facing
 * surfaces that render URLs into HTML / PNG / embedded widgets).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};

const SCAN_DIRS = [
  resolve(REPO_ROOT, 'apps/studio/src'),
  resolve(REPO_ROOT, 'packages/widget/src'),
];

const SKIP_FILE_SUFFIXES = ['.test.ts', '.test.tsx', '.spec.ts'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'out']);

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (stat.isFile()) {
      if (SKIP_FILE_SUFFIXES.some((s) => entry.endsWith(s))) continue;
      if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(path);
    }
  }
  return out;
}

const files: string[] = [];
for (const d of SCAN_DIRS) files.push(...listTsFiles(d));
ok(`scanned ${files.length} user-facing TypeScript files in apps/studio + packages/widget`);

const violations: { file: string; line: number; text: string; reason: string }[] = [];
const DEAD_DOMAIN = /https?:\/\/ivaronix\.studio/i;
const LOCALHOST_FALLBACK = /\?\?\s*'http:\/\/localhost:3300'/;
const HAS_VERCEL_ENV_USAGE = /process\.env\.(VERCEL_URL|VERCEL_PROJECT_PRODUCTION_URL)/;

for (const file of files) {
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  // File-level allow: if the file uses VERCEL_URL or VERCEL_PROJECT_PRODUCTION_URL
  // anywhere, then a terminal `?? 'http://localhost:3300'` at the end of the
  // chain is the CORRECT dev fallback (iter-103 fix shape) — not a violation.
  const usesVercelEnv = HAS_VERCEL_ENV_USAGE.test(src);

  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Skip lines that are pure comments documenting the historical bug
    // (must contain "Pre-fix" / "iter-103" / "dead domain" markers).
    const isHistoricalComment =
      /^\s*(\/\/|\*)/.test(line) &&
      /(Pre-fix|iter-10[34]|dead domain|stays stable|JSON Schema|hardcoded)/.test(line);
    if (isHistoricalComment) continue;

    if (DEAD_DOMAIN.test(line)) {
      violations.push({
        file,
        line: i + 1,
        text: line.trim().slice(0, 100),
        reason: "hardcoded 'ivaronix.studio' (dead domain · use Vercel-env-aware chain)",
      });
    }
    if (LOCALHOST_FALLBACK.test(line) && !usesVercelEnv) {
      violations.push({
        file,
        line: i + 1,
        text: line.trim().slice(0, 100),
        reason: "'?? localhost:3300' fallback without Vercel-env chain (Vercel deploys fall through to localhost · add VERCEL_PROJECT_PRODUCTION_URL + VERCEL_URL chain)",
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`\nFAIL: ${violations.length} dead-domain / localhost-only fallback(s) in user-facing code:`);
  for (const v of violations) {
    console.error(`  ${relative(REPO_ROOT, v.file)}:${v.line}`);
    console.error(`    text: ${v.text}`);
    console.error(`    reason: ${v.reason}`);
  }
  console.error(`\nFix: use the Vercel-env-aware chain documented in apps/studio/src/app/layout.tsx`);
  console.error(`     resolveMetadataBase() (NEXT_PUBLIC_BASE_URL → VERCEL_PROJECT_PRODUCTION_URL → VERCEL_URL → localhost).`);
  process.exit(1);
}

ok(`no dead-domain or localhost-only fallbacks in user-facing code`);
console.log(`\n[verify-no-dead-domain-fallbacks] ${asserts}/2 assertions passed`);
