/**
 * Regression: every surface listed in HLD.md §1's table maps to a real
 * `apps/<name>/` directory with at least one tracked file.
 *
 * Why this gate exists (sweep 100 finding · 4th occurrence pattern
 * closure):
 *   The cron has caught four ghost-surface instances in HLD.md §1:
 *
 *     - `apps/skill-store` (planning-003) — never built; lives inside
 *       Studio at /skills.
 *     - `apps/forge-daemon` (planning-003 §A.5.18) — empty dir, no
 *       process; Studio talks to chain/storage directly.
 *     - `apps/worker` (planning-003) — never built; jobs run via
 *       scripts/wander-cycle/.
 *     - `apps/api` (sweep 99) — empty dir, no Next.js app; Studio's
 *       own /api/* routes ARE the HTTP API surface.
 *
 *   Each ghost was caught by manual audit or explicit log-line analysis
 *   in wanderingflow.md. The drift's hazard: judges and contributors
 *   read HLD §1, expect to find `apps/<name>/` source code, and find
 *   nothing. That's a Criterion 5 (Documentation) credibility leak.
 *
 *   Sweep 100 ships the gate. Future ghost surfaces fail at pre-commit.
 *
 * What we check:
 *   1. Parse HLD.md §1's surface table (markdown rows starting with
 *      `| <num> |`).
 *   2. Extract the `apps/<name>` reference from each row's "Lives where"
 *      column.
 *   3. For each extracted dir: confirm it exists AND has at least one
 *      tracked file (via git ls-files).
 *   4. ALSO check that the table count matches the trailing "All N
 *      surfaces above are real today" prose claim, so the count and
 *      the table can't drift apart.
 *
 *   In-Studio surfaces (e.g. "apps/studio/app/skills/*") are accepted
 *   as long as the parent app dir is real.
 *
 * Allow-list:
 *   None. Ghost surfaces should ALWAYS fail — the prose pattern is to
 *   move them OUT of the surface table into the trailing "no separate
 *   X" callout, not to allow-list them in place.
 *
 * Captures sweep 100's closure as a permanent gate. Testnet-only.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const HLD_PATH = resolve(REPO_ROOT, 'HLD.md');

interface SurfaceRow {
  num: number;
  name: string;
  livesWhere: string;
}

console.log('HLD.md §1 · every surface row maps to a real apps/<name>/\n');

const hld = readFileSync(HLD_PATH, 'utf8');
const lines = hld.split(/\r?\n/);

// Find §1's surface table. The shape is a markdown table where each
// data row starts with `| <num> |`. Stop at the first blank line OR
// the next `## ` heading.
const rows: SurfaceRow[] = [];
let inSection1 = false;
for (const line of lines) {
  if (/^##\s+\d+\.\s+System Surfaces\b/.test(line)) {
    inSection1 = true;
    continue;
  }
  if (inSection1 && /^##\s/.test(line)) break; // next section
  if (!inSection1) continue;
  // Match `| 1 | **Surface name** | audience | `apps/<...>` desc |`
  const m = line.match(/^\|\s*(\d+)\s*\|\s*\*\*([^*]+)\*\*[^|]*\|[^|]*\|\s*(.+?)\s*\|\s*$/);
  if (!m) continue;
  rows.push({
    num: Number.parseInt(m[1]!, 10),
    name: m[2]!.trim(),
    livesWhere: m[3]!.trim(),
  });
}

console.log(`  parsed ${rows.length} surface rows from HLD §1`);

// Get list of tracked files for membership lookups.
const trackedRaw = execFileSync('git', ['ls-files'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const tracked = new Set(trackedRaw.split(/\r?\n/).filter((s) => s.length > 0));

// Helper: does any tracked file start with `prefix/`?
function hasTrackedContent(prefix: string): boolean {
  for (const path of tracked) {
    if (path === prefix) return true;
    if (path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

interface Hit {
  row: SurfaceRow;
  reason: string;
}

const hits: Hit[] = [];

for (const r of rows) {
  // Extract the first `apps/<name>` reference from livesWhere.
  // Accepts shapes:
  //   `apps/studio` (Next.js 15 on Vercel)
  //   `apps/studio/app/skills/*` (page in Studio, no separate app)
  //   `apps/cli` (Node 20 + TypeScript binary)
  const appsMatch = r.livesWhere.match(/`(apps\/[a-zA-Z0-9_-]+)(?:\/[^`]*)?`/);
  if (!appsMatch) {
    // Some surfaces may legitimately not have an apps/<name> (e.g. all
    // pure libraries). Today every row has one — flag if not.
    hits.push({
      row: r,
      reason: 'no apps/<name> reference in "Lives where" column',
    });
    continue;
  }
  const appPath = appsMatch[1]!;
  if (!hasTrackedContent(appPath)) {
    hits.push({
      row: r,
      reason: `${appPath}/ has zero tracked files (ghost surface)`,
    });
  }
}

// Also check the trailing "All N surfaces above are real today" claim
// matches the row count.
const surfaceCountClaim = hld.match(/All\s+(\d+)\s+surfaces above are real today/);
if (!surfaceCountClaim) {
  hits.push({
    row: { num: 0, name: '(prose check)', livesWhere: '' },
    reason: 'HLD §1 missing "All N surfaces above are real today" prose claim',
  });
} else {
  const claimedCount = Number.parseInt(surfaceCountClaim[1]!, 10);
  if (claimedCount !== rows.length) {
    hits.push({
      row: { num: 0, name: '(prose check)', livesWhere: '' },
      reason: `prose claims "${claimedCount} surfaces" but table has ${rows.length} rows`,
    });
  }
}

if (hits.length === 0) {
  console.log(`  PASS · all ${rows.length} surfaces map to real apps/<name>/ dirs`);
  process.exit(0);
}

console.error(`  FAIL · ${hits.length} ghost surface(s) / drift:\n`);
for (const h of hits) {
  if (h.row.num === 0) {
    console.error(`    [prose] ${h.reason}`);
  } else {
    console.error(`    Surface ${h.row.num} · "${h.row.name}"`);
    console.error(`      Lives where: ${h.row.livesWhere}`);
    console.error(`      ${h.reason}`);
  }
}
console.error('\n  fix: either build the surface OR move it out of the §1 table into the');
console.error('       trailing "no separate <X> — here\'s what we use instead" callout.');
process.exit(1);
