import { Command } from 'commander';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { runPipeline } from '../lib/pipeline.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix watch <path>` — daemon mode.
 *
 * Periodically re-audits a target. Foreground process (Hermes-style — no
 * detached daemon yet). Stops after `--max-runs` or after `--duration`
 * elapses, whichever fires first.
 */

const DEFAULT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.sol', '.py', '.rs', '.go']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.turbo', 'coverage']);

function* walk(root: string, exts: ReadonlySet<string>): Iterable<string> {
  const stat = statSync(root);
  if (stat.isFile()) {
    if (exts.has(extname(root))) yield root;
    return;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) yield* walk(full, exts);
    else if (entry.isFile() && exts.has(extname(entry.name))) yield full;
  }
}

function parseDurationMs(input: string): number {
  const m = input.match(/^(\d+)([smhd])$/);
  if (!m) throw new Error(`bad duration "${input}" — use Ns / Nm / Nh / Nd`);
  const n = parseInt(m[1]!, 10);
  return { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd']! * n;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const watchCommand = new Command('watch')
  .description('Periodically run an audit on a target — foreground daemon')
  .argument('<path>', 'file or directory to monitor')
  .option('--interval <dur>', 'time between runs (e.g. 30s, 5m, 1h)', '5m')
  .option('--max-runs <n>', 'stop after N runs', '3')
  .option('--duration <dur>', 'stop after wall time elapses (e.g. 1h, 30m)')
  .option('--skill <id>', 'audit skill', 'github-audit')
  .option('--ext <exts>', 'comma-separated extensions to include')
  .option('--max-files <n>', 'cap the number of files audited per run', '5')
  .option('--quick', 'force quick tier')
  .option('--consensus', 'force standard 3-role consensus')
  .option('--high-stakes', 'use 5-role high-stakes consensus')
  .option('--no-receipt', 'skip receipt anchoring per run')
  .option('--out-dir <dir>', 'where to write receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (target: string, opts: { interval: string; maxRuns: string; duration?: string; skill: string; ext?: string; maxFiles: string; quick?: boolean; consensus?: boolean; highStakes?: boolean; receipt: boolean; outDir: string }) => {
    let tier: 'quick' | 'standard' | 'high-stakes' | undefined;
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    else if (opts.quick) tier = 'quick';

    const intervalMs = parseDurationMs(opts.interval);
    const durationMs = opts.duration ? parseDurationMs(opts.duration) : Infinity;
    const maxRuns = Math.max(1, parseInt(opts.maxRuns, 10) || 3);
    const root = resolve(process.cwd(), target);
    const exts = opts.ext
      ? new Set(opts.ext.split(',').map((e) => (e.startsWith('.') ? e : '.' + e)))
      : DEFAULT_EXTS;
    const fileCap = Math.max(1, parseInt(opts.maxFiles, 10) || 5);

    ui.title(`watch: ${target}  every ${opts.interval}  max=${maxRuns}  skill=${opts.skill}`);
    ui.divider();

    const startedAt = Date.now();
    let runs = 0;
    let totalReceipts = 0;
    let totalFailures = 0;

    while (runs < maxRuns && Date.now() - startedAt < durationMs) {
      runs++;
      ui.section(`run ${runs}/${maxRuns} @ ${new Date().toISOString()}`);
      const files: string[] = [];
      for (const f of walk(root, exts)) {
        files.push(f);
        if (files.length >= fileCap) break;
      }
      if (files.length === 0) {
        ui.fail('no matching files', `nothing to audit under ${target}`);
        break;
      }

      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const relPath = relative(process.cwd(), f);
        const label = `r${runs} ${i + 1}/${files.length} ${relPath}`;
        try {
          const content = readFileSync(f, 'utf8').slice(0, 24_000);
          const result = await runPipeline({
            skillId: opts.skill,
            context: content,
            userPrompt: `Audit ${relPath}`,
            tier,
            receipt: opts.receipt,
            outDir: opts.outDir,
            receiptType: 'audit',
            label,
          });
          if (result.receiptId) totalReceipts++;
        } catch (err) {
          ui.fail(`[${label}] failed`, (err as Error).message);
          totalFailures++;
        }
      }

      if (runs < maxRuns && Date.now() - startedAt + intervalMs < durationMs) {
        ui.hint(`sleeping ${opts.interval}…`);
        await sleep(intervalMs);
      }
    }

    ui.divider();
    if (totalFailures === 0) {
      ui.banner(true, `→ ${runs} run${runs === 1 ? '' : 's'} · ${totalReceipts} receipt${totalReceipts === 1 ? '' : 's'} anchored`);
    } else {
      ui.banner(false, `→ ${runs} runs · ${totalReceipts} receipts · ${totalFailures} failures`);
      process.exitCode = 1;
    }
  });
