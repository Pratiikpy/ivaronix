/**
 * inventory-drive-v8-cli · drive every safe CLI read command.
 *
 * Judges clone the repo + run CLI commands to validate the product. Each
 * command should return non-error output. This batch drives every
 * read-only CLI surface (no chain writes, no payments, no state changes)
 * and asserts the output looks healthy.
 *
 * Skip: receipt verify (already covered in v7), demo (already exercised).
 * Cover: --help · skill list · passport show · memory list · indexer stats ·
 *        stats · compute balance · session list · receipt show.
 *
 * Uses spawnSync with explicit argv array (no shell) for security; the
 * commands themselves are static literals, no user-controlled input.
 */
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const ITER = `iter-${Date.now()}`;
const PROOF_DIR = resolve(REPO, 'QA_PROOF_PACK', 'inventory-drive', ITER);
mkdirSync(PROOF_DIR, { recursive: true });

type Result = {
  cmd: string;
  outcome: 'PASS' | 'FAIL';
  evidence: string;
  exit: number;
};
const results: Result[] = [];

function log(r: Result) {
  results.push(r);
  const icon = r.outcome === 'PASS' ? '✓' : '✗';
  // eslint-disable-next-line no-console
  console.log(`  ${icon} ${r.cmd} · exit=${r.exit} · ${r.evidence}`);
}

function runCli(argv: string[], opts: { mustContain?: string[]; mustNotContain?: string[]; timeoutMs?: number } = {}): void {
  const argvFull = ['--filter', '@ivaronix/cli', 'dev', ...argv];
  const res = spawnSync('pnpm', argvFull, {
    cwd: REPO,
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? 90_000,
    shell: process.platform === 'win32', // pnpm.cmd on Windows requires shell=true
  });
  const exit = res.status ?? -1;
  const stdout = (res.stdout ?? '') + (res.stderr ?? '');
  // Filter ANSI escape codes for matching
  const plain = stdout.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  const missing = (opts.mustContain ?? []).filter((s) => !plain.includes(s));
  const wrong = (opts.mustNotContain ?? []).filter((s) => plain.includes(s));
  const passes = exit === 0 && missing.length === 0 && wrong.length === 0;
  log({
    cmd: argv.join(' '),
    outcome: passes ? 'PASS' : 'FAIL',
    evidence: passes
      ? `output ${plain.length}B`
      : `missing=[${missing.join(', ')}] wrong=[${wrong.join(', ')}] tail=${plain.slice(-100).replace(/\n/g, '\\n')}`,
    exit,
  });
}

// eslint-disable-next-line no-console
console.log(`\n========== INVENTORY-DRIVE-V8-CLI ${ITER} ==========`);

// 1. --help — top-level CLI surface
runCli(['--help'], {
  mustContain: ['demo', 'receipt', 'skill', 'passport', 'memory', 'doctor'],
});

// 2. skill list
runCli(['skill', 'list'], {
  mustContain: ['private-doc-review', 'legal-citation-verifier', 'term-sheet-risk-scanner', 'nda-triage-reviewer', 'contract-renewal-clause-detector'],
});

// 3. passport show
runCli(['passport', 'show'], {
  mustContain: ['tokenId', 'trust'],
  mustNotContain: ['execution reverted', 'TypeError'],
});

// 4. memory list
runCli(['memory', 'list'], {
  mustNotContain: ['execution reverted', 'TypeError'],
});

// 5. indexer stats — Bug-50 verified V3 column
runCli(['indexer', 'stats'], {
  mustContain: ['V1', 'V2', 'V3'],
  mustNotContain: ['execution reverted', 'TypeError'],
});

// 6. stats
runCli(['stats'], {
  mustNotContain: ['execution reverted', 'TypeError'],
});

// 7. compute balance — Bug-31 verified
runCli(['compute', 'balance'], {
  mustNotContain: ['execution reverted', 'TypeError'],
});

// 8. receipt show 124 (just-anchored, fixture available)
// receipt show prints ON-CHAIN summary only (receiptRoot, storageRoot, agent,
// timestamp, type, registry) — skill name lives in body and is shown via
// receipt verify, not receipt show.
runCli(['receipt', 'show', '124'], {
  mustContain: ['receiptRoot', '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce', 'V3'],
  mustNotContain: ['execution reverted', 'TypeError'],
});

// 9. session list
runCli(['session', 'list'], {
  mustNotContain: ['execution reverted', 'TypeError'],
});

// SUMMARY
const pass = results.filter((r) => r.outcome === 'PASS').length;
const fail = results.filter((r) => r.outcome === 'FAIL').length;
// eslint-disable-next-line no-console
console.log(`\n========== ${pass} PASS · ${fail} FAIL (${results.length} CLI commands) ==========`);

const md = [
  `# inventory-drive-v8-cli · ${ITER}`,
  '',
  `**Total commands:** ${results.length} · **PASS:** ${pass} · **FAIL:** ${fail}`,
  '',
  '| # | Command | Outcome | Exit | Evidence |',
  '|---|---|---|---|---|',
  ...results.map((r, i) =>
    `| ${i + 1} | \`pnpm ivaronix ${r.cmd}\` | **${r.outcome}** | ${r.exit} | ${r.evidence} |`,
  ),
].join('\n');
writeFileSync(resolve(PROOF_DIR, 'report.md'), md, 'utf8');
writeFileSync(resolve(PROOF_DIR, 'results.json'), JSON.stringify({ iter: ITER, pass, fail, results }, null, 2), 'utf8');
// eslint-disable-next-line no-console
console.log(`\nReport: ${resolve(PROOF_DIR, 'report.md')}`);
process.exit(fail > 0 ? 1 : 0);
