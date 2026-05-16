/**
 * iter-126 closure regression for QA plan numeric drift.
 *
 * The user's `Ivaronix_User_QA_Test_Plan.md` (the canonical QA contract
 * fired by the cron loop) cites specific regression counts in its
 * "Source-File Regression Suite" section:
 *   - total verify-*.ts files on disk
 *   - automated (Studio offline + CLI + contracts)
 *   - live-server (studio-live filter)
 *   - per-filter Studio / CLI / Contracts counts
 *
 * Pre-iter-126 those numbers were last refreshed at cron iteration 17
 * (Studio offline = 59 · total = 95). Each iter-120-125 added regressions
 * or extended scope without touching the plan; by iter-125 the plan
 * was 9 files (~10%) stale on the studio count and silently misleading
 * a tester expecting "59 PASS".
 *
 * This regression parses the QA plan's numbers:auto markers + auto-
 * derives the canonical counts from the filesystem and the orchestrator
 * filter blocks. Drift fails CI.
 *
 * The plan uses `<!-- regressions:auto:KEY -->VALUE<!-- /regressions:auto:KEY -->`
 * markers (mirroring the numbers:auto pattern in README + MAINNET_READINESS).
 * Keys: total, automated, live, studio, cli, contracts.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const QA_PLAN = resolve(REPO_ROOT, 'Ivaronix_User_QA_Test_Plan.md');
const RUNNER = resolve(HERE, 'run-source-regressions.ts');
const REGRESSIONS_DIR = HERE;

// QA plan is local-only after privacy scrub (bc2c636). Skip on CI.
if (!existsSync(QA_PLAN)) {
  console.log(`SKIP: ${QA_PLAN.split(/[\\/]/).pop()} not in working tree (private doc).`);
  process.exit(0);
}

let asserts = 0;
const ok = (label: string): void => {
  asserts += 1;
  console.log(`OK: ${label}`);
};
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

// Same exclusion set as run-source-regressions.ts (line 172-179 there).
const NETWORK_DEPENDENT = new Set(['verify-v2-anchor-live.ts']);
const BROWSER_DEPENDENT = new Set(['run.ts']);
const SELF = 'verify-qa-plan-regression-counts.ts';

const allFiles = readdirSync(REGRESSIONS_DIR)
  .filter((n) => n.startsWith('verify-') && n.endsWith('.ts'))
  .filter((n) => {
    const stat = statSync(resolve(REGRESSIONS_DIR, n));
    return stat.isFile();
  });
const totalFiles = allFiles.length;
ok(`counted ${totalFiles} verify-*.ts files on disk`);

const runnerSrc = readFileSync(RUNNER, 'utf8');

function extractFilterPatterns(filterKey: 'studio' | 'cli' | 'contracts'): RegExp[] {
  const blockRe = new RegExp(`${filterKey}:\\s*\\{[\\s\\S]*?patterns:\\s*\\[([\\s\\S]*?)\\n\\s*\\]`, 'm');
  const m = blockRe.exec(runnerSrc);
  if (!m) fail(`could not locate filter '${filterKey}' patterns block in run-source-regressions.ts`);
  const block = m[1]!;
  // Each pattern is on its own line, of form `/^verify-foo/,` (sometimes with
  // character classes or alternations like `/^verify-2[abcd]/`).
  const patterns: RegExp[] = [];
  for (const line of block.split('\n')) {
    const lit = /\/(\^verify-[^/]+)\/[gimsuy]*/.exec(line);
    if (lit) patterns.push(new RegExp(lit[1]!));
  }
  return patterns;
}

function countFilesMatchingFilter(filterKey: 'studio' | 'cli' | 'contracts'): number {
  const patterns = extractFilterPatterns(filterKey);
  let count = 0;
  for (const file of allFiles) {
    if (NETWORK_DEPENDENT.has(file)) continue;
    if (BROWSER_DEPENDENT.has(file)) continue;
    // SELF IS counted — it's a real regression that runs in the studio
    // filter, matching the orchestrator's behaviour.
    if (patterns.some((p) => p.test(file))) count += 1;
  }
  return count;
}

const studioCount = countFilesMatchingFilter('studio');
const cliCount = countFilesMatchingFilter('cli');
const contractsCount = countFilesMatchingFilter('contracts');
const automated = studioCount + cliCount + contractsCount;
// Live = total minus excluded (NETWORK_DEPENDENT + BROWSER_DEPENDENT) minus automated.
// NETWORK_DEPENDENT counts as live (it needs Galileo RPC, runs in the chain-smoke filter).
const totalEligible = allFiles.length - BROWSER_DEPENDENT.size; // run.ts excluded; chain-smoke regressions count
const live = totalEligible - automated - 1; // -1 because this file is its own thing
// Simpler: live = files not matched by any offline filter, minus self.
const offlinePatterns = [
  ...extractFilterPatterns('studio'),
  ...extractFilterPatterns('cli'),
  ...extractFilterPatterns('contracts'),
];
let liveCount = 0;
for (const file of allFiles) {
  if (BROWSER_DEPENDENT.has(file)) continue;
  // SELF counted because it matches an offline filter (studio); the
  // live count is "files not matched by any offline filter".
  if (!offlinePatterns.some((p) => p.test(file))) liveCount += 1;
}
const liveFinal = liveCount;
void live; // keep for clarity above; liveFinal is authoritative
void SELF;

ok(`parsed runner filters: studio=${studioCount} cli=${cliCount} contracts=${contractsCount} -> automated=${automated} live=${liveFinal}`);

const qaSrc = readFileSync(QA_PLAN, 'utf8');

const expected: Record<string, number> = {
  total: totalFiles,
  automated,
  live: liveFinal,
  studio: studioCount,
  cli: cliCount,
  contracts: contractsCount,
};

const drift: { key: string; planValue: number; actualValue: number }[] = [];
for (const key of Object.keys(expected)) {
  const re = new RegExp(`<!--\\s*regressions:auto:${key}\\s*-->(\\d+)<!--\\s*/regressions:auto:${key}\\s*-->`, 'g');
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(qaSrc)) !== null) {
    const planValue = Number(m[1]);
    if (planValue !== expected[key]) {
      drift.push({ key, planValue, actualValue: expected[key]! });
    }
    count += 1;
  }
  if (count === 0) {
    fail(`QA plan has no regressions:auto:${key} marker -- add the marker to the Source-File Regression Suite section`);
  }
}

if (drift.length > 0) {
  console.error(`\nFAIL: ${drift.length} regression-count drift(s) in Ivaronix_User_QA_Test_Plan.md:`);
  const seen = new Set<string>();
  for (const d of drift) {
    const id = `${d.key}:${d.planValue}-${d.actualValue}`;
    if (seen.has(id)) continue;
    seen.add(id);
    console.error(`  ${d.key.padEnd(12)}  plan says ${d.planValue}, actual is ${d.actualValue}`);
  }
  console.error(`\nFix: update the values inside the <!-- regressions:auto:<key> --> markers in`);
  console.error(`     Ivaronix_User_QA_Test_Plan.md "Source-File Regression Suite" section.`);
  process.exit(1);
}

ok(`QA plan regression counts match actual file/filter counts`);
console.log(`\n[verify-qa-plan-regression-counts] ${asserts}/3 assertions passed`);
