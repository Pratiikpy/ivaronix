/**
 * Regression: no silent-failure suppressions in `.github/workflows/*.yml`.
 *
 * Why this gate exists (sweep 75 finding):
 *   `ci.yml` had `pnpm exec tsx ... receipt verify "$FIRST" || true` on the
 *   `Receipt verify roundtrip` job, meaning the verify step ALWAYS exited
 *   0 — even on schema/hash/signature/chain-anchor failure. Combined with
 *   the gitignored `.ivaronix/receipts/anchored/` path the verify pointed
 *   at (so CI took the `else` branch and verified nothing), the gate had
 *   been a complete no-op for weeks. A judge running `gh run list --status
 *   success` would see green, but the green meant "the script didn't crash
 *   the runner," not "a receipt verified."
 *
 *   Sweep 74 closed the same class for `--frozen-lockfile=false` (lockfile
 *   bypass). Sweep 75 closes it for shell-level exit suppression.
 *
 * What we check:
 *   For every `.yml` file under `.github/workflows/`:
 *     - find every line that contains `|| true` outside a comment
 *     - find every line that contains `|| :` (the POSIX no-op equivalent)
 *     - find every job-level `continue-on-error: true`
 *     - assert none exist (the regression list is empty)
 *
 *   `set +e` is a related anti-pattern but not yet checked — opt-in via
 *   the inline `# wording-lint:allow:set-plus-e <reason>` comment shape
 *   when truly needed (none today).
 *
 * Allow-list:
 *   When a step LEGITIMATELY needs exit-code suppression (e.g. a probe
 *   that checks "does this command exist" and continues either way), the
 *   line must be tagged with `# ci-allow:suppress-exit:<reason>` on the
 *   same line. None today.
 *
 * Captures the §15 sweep-75 closure as a permanent gate. Testnet-only
 * change (CI workflows). No mainnet USER_TODO entry — the regression
 * itself IS the durable record.
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
  kind: '|| true' | '|| :' | 'continue-on-error: true';
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

const ALLOW_TAG = /#\s*ci-allow:suppress-exit:/;

// Strip the YAML inline comment portion (everything after a `#` that's not
// inside quotes). Cheap heuristic — workflows here don't use quoted hashes.
function stripComment(line: string): string {
  const idx = line.indexOf('#');
  return idx < 0 ? line : line.slice(0, idx);
}

function scanFile(file: string): Hit[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    if (ALLOW_TAG.test(raw)) continue;
    const code = stripComment(raw);

    // `|| true` — the canonical exit-suppression
    if (/\|\|\s*true\b/.test(code)) {
      hits.push({ file, line: i + 1, text: raw.trim(), kind: '|| true' });
    }
    // `|| :` — POSIX no-op equivalent
    if (/\|\|\s*:\s*$/.test(code) || /\|\|\s*:\s*[;&]/.test(code)) {
      hits.push({ file, line: i + 1, text: raw.trim(), kind: '|| :' });
    }
    // `continue-on-error: true` at any indent (job- or step-level)
    if (/^\s*continue-on-error\s*:\s*true\s*$/.test(raw)) {
      hits.push({ file, line: i + 1, text: raw.trim(), kind: 'continue-on-error: true' });
    }
  }
  return hits;
}

console.log('CI · no silent-failure exit suppressions\n');

const files = listYmlFiles(WORKFLOWS);
const allHits: Hit[] = [];
for (const f of files) allHits.push(...scanFile(f));

console.log(`  scanned ${files.length} workflow files`);

if (allHits.length === 0) {
  console.log(`  PASS · no '|| true', '|| :', or 'continue-on-error: true' found`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} suppression(s):\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  console.error(`    ${rel}:${h.line}  [${h.kind}]`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: remove the suppression, or tag the line with');
console.error('       `# ci-allow:suppress-exit:<reason>` if genuinely needed.');
process.exit(1);
