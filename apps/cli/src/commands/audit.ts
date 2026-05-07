import { Command } from 'commander';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { runPipeline } from '../lib/pipeline.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix audit <path>` — review-only mode.
 *
 * Walks the path (file or directory), runs the chosen skill on each matching
 * file, and emits one receipt per file. Default skill is `github-audit`.
 */

const DEFAULT_INCLUDE = ['.ts', '.tsx', '.js', '.jsx', '.sol', '.py', '.rs', '.go'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.turbo', 'coverage']);

function* walk(root: string, exts: ReadonlySet<string>): Iterable<string> {
  const stat = statSync(root);
  if (stat.isFile()) {
    if (exts.size === 0 || exts.has(extname(root))) yield root;
    return;
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = resolve(root, entry.name);
    if (entry.isDirectory()) yield* walk(full, exts);
    else if (entry.isFile() && (exts.size === 0 || exts.has(extname(entry.name)))) yield full;
  }
}

export const auditCommand = new Command('audit')
  .description('Audit a file or directory using a skill (default: github-audit)')
  .argument('<path>', 'file or directory to audit')
  .option('--skill <id>', 'audit skill to use', 'github-audit')
  .option('--ext <exts>', 'comma-separated extensions to include (overrides default)')
  .option('--max-files <n>', 'cap the number of files audited', '10')
  .option('--quick', 'force quick tier')
  .option('--consensus', 'force standard 3-role consensus')
  .option('--high-stakes', 'use 5-role high-stakes consensus')
  .option('--no-receipt', 'skip receipt anchoring')
  .option('--out-dir <dir>', 'where to write receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (target: string, opts: { skill: string; ext?: string; maxFiles: string; quick?: boolean; consensus?: boolean; highStakes?: boolean; receipt: boolean; outDir: string }) => {
    let tier: 'quick' | 'standard' | 'high-stakes' | undefined;
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    else if (opts.quick) tier = 'quick';

    const root = resolve(process.cwd(), target);
    const exts = opts.ext
      ? new Set(opts.ext.split(',').map((e) => (e.startsWith('.') ? e : '.' + e)))
      : new Set(DEFAULT_INCLUDE);
    const cap = Math.max(1, parseInt(opts.maxFiles, 10) || 10);

    const files: string[] = [];
    for (const f of walk(root, exts)) {
      files.push(f);
      if (files.length >= cap) break;
    }
    if (files.length === 0) {
      ui.fail(`no matching files under ${target}`);
      process.exitCode = 1;
      return;
    }

    ui.title(`audit: ${target}  (${files.length} file${files.length === 1 ? '' : 's'})`);
    ui.divider();

    let pass = 0;
    let fail = 0;
    const receipts: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      const relPath = relative(process.cwd(), f);
      const label = `${i + 1}/${files.length} ${relPath}`;
      try {
        const content = readFileSync(f, 'utf8').slice(0, 24_000);
        const result = await runPipeline({
          skillId: opts.skill,
          context: content,
          userPrompt: `Audit ${relPath} for security defects, logic bugs, and risks.`,
          tier,
          receipt: opts.receipt,
          outDir: opts.outDir,
          receiptType: 'audit',
          label,
        });
        ui.divider();
        console.log(result.finalText);
        ui.divider();
        if (result.receiptId) receipts.push(result.receiptId);
        pass++;
      } catch (err) {
        ui.fail(`[${label}] failed`, (err as Error).message);
        fail++;
      }
    }

    ui.divider();
    if (fail === 0) {
      ui.banner(true, `→ ${pass} file${pass === 1 ? '' : 's'} audited · ${receipts.length} receipt${receipts.length === 1 ? '' : 's'} anchored`);
    } else {
      ui.banner(false, `→ ${pass} ok · ${fail} failed · ${receipts.length} receipts`);
      process.exitCode = 1;
    }
  });
