/**
 * Walk the rolling audit ledger from git log + cross-reference against
 * `docs/HALF_BAKED.md` (open ledger) so future agents can answer "what
 * audits closed when, and what's still open" with a single command.
 *
 * Closes USER_TODO §B-V2-13 (and the operational half of planning-003
 * §A.4.3). The CHANGELOG.md tables are the human-readable view; this
 * script is the queryable view.
 *
 * Usage:
 *   pnpm audit:list                  # full table, every audit-closing commit
 *   pnpm audit:list --since 2w       # last 2 weeks
 *   pnpm audit:list --grep A.5       # filter by audit-id substring
 *   pnpm audit:list --json           # JSON for downstream tooling
 *
 * Implementation note: uses `execFileSync` (NOT `execSync`) so the
 * `--grep` / `--since` user-supplied strings can't be shell-injected
 * into the git invocation. Each is passed as a positional arg to git.
 */

import { execFileSync } from 'node:child_process';

interface CliOpts {
  since?: string;
  grep?: string;
  json?: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--since') opts.since = argv[++i];
    else if (a === '--grep') opts.grep = argv[++i];
    else if (a === '--json') opts.json = true;
  }
  return opts;
}

interface AuditClosure {
  commitHash: string;
  commitDate: string; // ISO 8601 short
  subject: string;
  auditIds: string[];
}

/**
 * `git log --grep` returns every commit whose subject OR body matches
 * the pattern. We then parse out the `Closes audit <ID>` trailers from
 * the body. Each commit may close multiple IDs (e.g. batched polish
 * commits), so the same commit can show up in multiple rows of the
 * output table.
 */
function readClosures(opts: CliOpts): AuditClosure[] {
  // Custom format with NUL separators between fields and a sentinel
  // character (RS = \x1e) between commits so multi-line bodies don't
  // confuse parsing.
  const FORMAT = '--pretty=format:%H%x00%cI%x00%s%x00%b%x1e';
  const args = ['log', '--grep=Closes audit', FORMAT];
  if (opts.since) args.push(`--since=${opts.since}`);

  let raw: string;
  try {
    raw = execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (err) {
    throw new Error(`git log failed: ${(err as Error).message}`);
  }

  const out: AuditClosure[] = [];
  for (const block of raw.split('\x1e')) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('\x00');
    if (parts.length < 4) continue;
    const [hash, dateIso, subject, body] = parts;
    if (!hash || !dateIso || !subject) continue;
    const ids = Array.from(new Set(
      [...body!.matchAll(/Closes audit\s+([A-Za-z0-9._\-]+)/g)].map((m) => m[1]!),
    ));
    if (ids.length === 0) continue;
    if (opts.grep && !ids.some((id) => id.includes(opts.grep!))) continue;
    out.push({
      commitHash: hash.slice(0, 7),
      commitDate: dateIso.slice(0, 10),
      subject,
      auditIds: ids,
    });
  }
  return out;
}

function renderTable(closures: AuditClosure[]): void {
  // Pivot to {auditId → {hash, date, subject}} so the table reads
  // "audit X closed in commit Y on date Z." When one commit closes
  // multiple audits the rows share the same hash/date but each gets
  // its own ID.
  type Row = { id: string; hash: string; date: string; subject: string };
  const rows: Row[] = [];
  for (const c of closures) {
    for (const id of c.auditIds) {
      rows.push({ id, hash: c.commitHash, date: c.commitDate, subject: c.subject });
    }
  }
  rows.sort((a, b) => (b.date.localeCompare(a.date) || a.id.localeCompare(b.id)));

  const idCol = Math.max(8, ...rows.map((r) => r.id.length));
  const hashCol = 8;
  const dateCol = 11;
  const subjectMax = 80;

  const fmt = (s: string, w: number) => s.length >= w ? s : s + ' '.repeat(w - s.length);
  const trunc = (s: string, w: number) => s.length <= w ? s : s.slice(0, w - 1) + '…';

  console.log(`${fmt('AUDIT', idCol)}  ${fmt('COMMIT', hashCol)}  ${fmt('DATE', dateCol)}  SUBJECT`);
  console.log(`${'-'.repeat(idCol)}  ${'-'.repeat(hashCol)}  ${'-'.repeat(dateCol)}  ${'-'.repeat(subjectMax)}`);
  for (const r of rows) {
    console.log(`${fmt(r.id, idCol)}  ${fmt(r.hash, hashCol)}  ${fmt(r.date, dateCol)}  ${trunc(r.subject, subjectMax)}`);
  }
  console.log('');
  console.log(`${rows.length} audit closure(s) across ${closures.length} commit(s).`);
}

const opts = parseArgs(process.argv.slice(2));
const closures = readClosures(opts);
if (opts.json) {
  console.log(JSON.stringify(closures, null, 2));
} else {
  renderTable(closures);
}
