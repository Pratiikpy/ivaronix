/**
 * Regression: every `pnpm install` invocation in `.github/workflows/*.yml`
 * uses strict `--frozen-lockfile`, NOT the permissive `--frozen-lockfile=false`.
 *
 * Why this gate exists (sweep 74 finding):
 *   Sweep 73 caught a 45-line `pnpm-lock.yaml` drift from sweep 55 — npx-cli
 *   runtime deps (better-sqlite3, dotenv, @0gfoundation/0g-compute-ts-sdk +
 *   optional onnxruntime-node, @xenova/transformers, fsevents) were added to
 *   `apps/npx-cli/package.json` but the regenerated lockfile was never
 *   committed. The drift sat invisible across 18 sweeps because every
 *   `pnpm install` step in `.github/workflows/ci.yml` (and chain-smoke.yml)
 *   used `--frozen-lockfile=false` — meaning CI silently regenerated the
 *   lockfile on each run, and the §15 bookkeeping miss never surfaced.
 *
 *   `--frozen-lockfile=false` is an anti-pattern in CI:
 *     1. Mask §15 lockfile-drift bugs (the actual incident class above).
 *     2. Reduce reproducibility — transitive deps can float between runs
 *        as upstream packages publish new patch versions of unpinned ranges.
 *     3. Defeat the purpose of `pnpm-lock.yaml` (which exists to pin the
 *        full resolution graph).
 *
 *   The legitimate use-cases for `=false` are:
 *     a. A forced workspace dep-rotation week (temporary, opt-in).
 *     b. Stand-alone scripts that intentionally regenerate the lockfile.
 *
 *   Neither applies to our CI today. Sweep 74 flipped all 5 `=false`
 *   instances in `ci.yml` + `chain-smoke.yml` to strict `--frozen-lockfile`.
 *   This regression prevents a future PR from re-introducing the bypass.
 *
 * What we check:
 *   For every `.yml` file under `.github/workflows/`:
 *     - find every `pnpm install` line
 *     - assert it does NOT contain `--frozen-lockfile=false`
 *     - assert it DOES contain `--frozen-lockfile` (positive form)
 *
 *   The positive-form assertion catches the case where someone removes the
 *   flag entirely thinking that's "safe" — pnpm's default for non-CI envs is
 *   `--frozen-lockfile=false`, so omitting the flag is equivalent to
 *   bypassing on local pnpm versions even though GH Actions' env auto-flips
 *   it. Belt-and-braces: explicit > implicit.
 *
 * Captures the §15 sweep-74 closure as a permanent gate. Testnet-only
 * change (no mainnet implications), so no USER_TODO entry needed —
 * the regression itself IS the durable record.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const WORKFLOWS = resolve(REPO_ROOT, '.github', 'workflows');

interface Hit {
  file: string;
  line: number;
  text: string;
  kind: 'bypass' | 'missing-flag';
}

function listYmlFiles(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = resolve(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      out = out.concat(listYmlFiles(p));
    } else if (e.endsWith('.yml') || e.endsWith('.yaml')) {
      out.push(p);
    }
  }
  return out;
}

function scanFile(file: string): Hit[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    // Match `pnpm install` only (not `pnpm i` or other forms — keep the
    // regression tight to the canonical CI shape; if a workflow uses a
    // non-canonical install command, that's a separate fix).
    if (!/\bpnpm install\b/.test(text)) continue;
    if (text.includes('--frozen-lockfile=false')) {
      hits.push({ file, line: i + 1, text: text.trim(), kind: 'bypass' });
    } else if (!/--frozen-lockfile\b/.test(text)) {
      // No flag at all — implicit default differs across environments.
      hits.push({ file, line: i + 1, text: text.trim(), kind: 'missing-flag' });
    }
  }
  return hits;
}

console.log('CI · no --frozen-lockfile=false bypass\n');

const files = listYmlFiles(WORKFLOWS);
const allHits: Hit[] = [];
for (const f of files) allHits.push(...scanFile(f));

const installCount = files
  .map((f) => readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /\bpnpm install\b/.test(l)).length)
  .reduce((a, b) => a + b, 0);

console.log(`  scanned ${files.length} workflow files · ${installCount} pnpm install lines`);

if (allHits.length === 0) {
  console.log(`  PASS · every pnpm install uses strict --frozen-lockfile`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} violation(s):\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  const tag = h.kind === 'bypass' ? '`--frozen-lockfile=false` bypass' : 'missing `--frozen-lockfile`';
  console.error(`    ${rel}:${h.line}  ${tag}`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: change to `pnpm install --frozen-lockfile`');
console.error('       or document the exception with a comment + add to allow-list above.');
process.exit(1);
