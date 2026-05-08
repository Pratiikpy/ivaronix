import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { runPipeline } from '../lib/pipeline.js';
import { ui } from '../lib/ui.js';
import { runInteractiveApply } from '../lib/diff-interactive.js';

/**
 * `ivaronix code <task> --files <paths...>` — build mode.
 *
 * Proposes a unified diff for the task given source context. With --apply,
 * the diff is applied to the working tree via `git apply` after a confirm
 * step (mirrors OpenCode's edit-with-confirm flow). Receipts are always
 * anchored because edits are accountable.
 */

function extractDiff(text: string): string | null {
  // Match the FIRST fenced ```diff block; tolerate language tag absence.
  const match = text.match(/```(?:diff)?\n([\s\S]*?)\n```/);
  return match ? match[1]!.trim() : null;
}

/** Walk up from `start` looking for the git root (a directory containing `.git`). */
function findGitRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function applyDiff(diff: string, gitRoot: string): { ok: boolean; output: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'ivaronix-code-'));
  const patchFile = join(tmp, 'patch.diff');
  writeFileSync(patchFile, diff + '\n', 'utf8');
  try {
    // First check if the patch applies cleanly. If yes, apply.
    execFileSync('git', ['apply', '--check', patchFile], { stdio: 'pipe', encoding: 'utf8', cwd: gitRoot });
    const output = execFileSync('git', ['apply', patchFile], { stdio: 'pipe', encoding: 'utf8', cwd: gitRoot });
    return { ok: true, output: output || `applied ${patchFile}` };
  } catch (err) {
    return { ok: false, output: (err as { stderr?: string; message: string }).stderr ?? (err as Error).message };
  }
}

export const codeCommand = new Command('code')
  .description('Propose code changes for a task — emits a unified diff; --apply patches the working tree')
  .argument('<task>', 'task description')
  .requiredOption('-f, --files <paths...>', 'source files providing context')
  .option('--skill <id>', 'code-edit skill to use', 'code-edit')
  .option('--quick', 'force quick tier')
  .option('--consensus', 'force standard 3-role consensus (default for code-edit)')
  .option('--high-stakes', 'use 5-role high-stakes consensus')
  .option('--no-receipt', 'skip receipt anchoring (for ad-hoc dry runs)')
  .option('--apply', 'apply the diff to the working tree via `git apply` (with --check first)')
  .option('--interactive', 'with --apply, walk hunks one-by-one with y/N/a/q prompts (PASS 77 F-codediff)')
  .option('--out-dir <dir>', 'where to write the receipt JSON', '.ivaronix/receipts/anchored')
  .action(async (task: string, opts: { files: string[]; skill: string; quick?: boolean; consensus?: boolean; highStakes?: boolean; receipt: boolean; apply?: boolean; interactive?: boolean; outDir: string }) => {
    let tier: 'quick' | 'standard' | 'high-stakes' | undefined;
    if (opts.highStakes) tier = 'high-stakes';
    else if (opts.consensus) tier = 'standard';
    else if (opts.quick) tier = 'quick';

    const parts: string[] = [];
    for (const f of opts.files) {
      const path = resolve(process.cwd(), f);
      try {
        const content = readFileSync(path, 'utf8');
        parts.push(`=== ${f} ===\n${content.slice(0, 24_000)}`);
      } catch (err) {
        ui.fail(`failed to read ${f}`, (err as Error).message);
        process.exitCode = 1;
        return;
      }
    }
    const context = parts.join('\n\n');

    ui.title(`code: ${task}`);
    ui.divider();

    try {
      const result = await runPipeline({
        skillId: opts.skill,
        context,
        userPrompt: task,
        tier,
        receipt: opts.receipt,
        outDir: opts.outDir,
        receiptType: 'code_change',
      });
      ui.divider();
      console.log(result.finalText);
      ui.divider();

      if (opts.apply) {
        const diff = extractDiff(result.finalText);
        if (!diff) {
          ui.fail('--apply: no fenced ```diff block in the model output');
          ui.hint('the skill may have refused the task; try a smaller scope or --consensus');
        } else {
          const gitRoot = findGitRoot(process.cwd());
          if (!gitRoot) {
            ui.fail('--apply: not inside a git repo. Run from anywhere under a git working tree.');
          } else if (opts.interactive) {
            // PASS 77 F-codediff: walk hunks with y/N/a/q prompts
            ui.pending('--apply --interactive: walking hunks…');
            ui.divider();
            const r = await runInteractiveApply(diff, gitRoot);
            ui.divider();
            ui.info(`accepted hunks       ${r.acceptedHunks}`);
            ui.info(`rejected hunks       ${r.rejectedHunks}`);
            if (r.quit) ui.info('user quit early');
            if (r.applied) {
              ui.pass(`--apply: patch applied (gitRoot=${gitRoot})`);
              ui.hint('Review with `git diff` and stage with `git add`. Revert with `git checkout -- <file>`.');
            } else if (r.acceptedHunks === 0) {
              ui.info('nothing applied (all hunks rejected or user quit before accepting any)');
            } else {
              ui.fail('--apply: filtered patch failed', r.applyOutput.split('\n')[0]);
              ui.hint('Review the rejected hunks; --interactive lets you skip the conflicting ones');
            }
          } else {
            ui.pending(`--apply: running git apply --check ...`);
            const r = applyDiff(diff, gitRoot);
            if (r.ok) {
              ui.pass(`--apply: patch applied (gitRoot=${gitRoot})`);
              ui.hint('Review with `git diff` and stage with `git add`. Revert with `git checkout -- <file>`.');
            } else {
              ui.fail('--apply: patch failed', r.output.split('\n')[0]);
              ui.hint('the diff didn\'t apply cleanly; try --interactive to skip conflicting hunks');
            }
          }
        }
        ui.divider();
      }

      if (result.receiptId) {
        ui.banner(true, '→ ANCHORED ✓');
        if (!opts.apply) {
          ui.hint(`Apply diff with \`ivaronix code <task> --files ... --apply\` or \`git apply\` manually. Receipt: ${result.receiptPath}`);
        } else {
          ui.hint(`Receipt: ${result.receiptPath}`);
        }
      } else {
        ui.banner(true, '→ COMPLETE');
      }
    } catch (err) {
      ui.fail('code failed', (err as Error).message);
      process.exitCode = 1;
    }
  });
