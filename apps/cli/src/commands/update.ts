import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix update` — self-update.
 *
 * Strategy:
 *   - if installed via npm/pnpm/yarn (detected by walking from the script
 *     path up to a package.json named @ivaronix/cli): re-install the
 *     latest tagged release through the same package manager.
 *   - if running from a git checkout: `git pull --ff-only` on the current
 *     branch, then `pnpm install`. The user retains control of merges.
 *   - otherwise: print install hints.
 */

interface InstallContext {
  kind: 'npm' | 'pnpm' | 'yarn' | 'git' | 'unknown';
  cwd: string;
}

function detectInstall(): InstallContext {
  // Walk up from the running script's path to look for clues
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, '.git'))) return { kind: 'git', cwd: dir };
    if (existsSync(resolve(dir, 'pnpm-lock.yaml'))) return { kind: 'pnpm', cwd: dir };
    if (existsSync(resolve(dir, 'yarn.lock'))) return { kind: 'yarn', cwd: dir };
    if (existsSync(resolve(dir, 'package-lock.json'))) return { kind: 'npm', cwd: dir };
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return { kind: 'unknown', cwd: process.cwd() };
}

function gitPullFastForward(cwd: string): { ok: boolean; output: string } {
  try {
    const out = execFileSync('git', ['pull', '--ff-only'], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output: out.trim() };
  } catch (err) {
    return { ok: false, output: (err as { stderr?: string; message: string }).stderr?.toString() ?? (err as Error).message };
  }
}

function pnpmInstall(cwd: string): { ok: boolean; output: string } {
  try {
    const out = execFileSync('pnpm', ['install'], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output: out.trim() };
  } catch (err) {
    return { ok: false, output: (err as { stderr?: string; message: string }).stderr?.toString() ?? (err as Error).message };
  }
}

export const updateCommand = new Command('update')
  .description('Self-update Ivaronix from git (working clone) or via your package manager')
  .option('--dry-run', 'detect the install mode and print the planned action without executing')
  .action(async (opts: { dryRun?: boolean }) => {
    const ctx = detectInstall();

    ui.title('ivaronix update');
    ui.info(`install kind         ${ctx.kind}`);
    ui.info(`root                 ${ctx.cwd}`);

    if (ctx.kind === 'unknown') {
      ui.fail('install method not detected');
      ui.hint('reinstall manually:  npm i -g @ivaronix/cli  ·  or clone the repo and run pnpm install');
      return;
    }

    if (opts.dryRun) {
      const planned =
        ctx.kind === 'git' ? 'git pull --ff-only && pnpm install'
        : ctx.kind === 'pnpm' ? 'pnpm up --latest @ivaronix/cli'
        : ctx.kind === 'yarn' ? 'yarn upgrade @ivaronix/cli --latest'
        : 'npm i -g @ivaronix/cli@latest';
      ui.divider();
      ui.pass(`would run            ${planned}`);
      return;
    }

    if (ctx.kind === 'git') {
      ui.pending('git pull --ff-only ...');
      const r = gitPullFastForward(ctx.cwd);
      if (!r.ok) {
        ui.fail('git pull failed', r.output.split('\n').pop() ?? '');
        ui.hint('resolve manually (rebase, stash, or push your branch first)');
        process.exitCode = 1;
        return;
      }
      ui.pass(r.output.split('\n')[0] ?? 'pulled');

      ui.pending('pnpm install ...');
      const i = pnpmInstall(ctx.cwd);
      if (!i.ok) {
        ui.fail('pnpm install failed', i.output.split('\n').pop() ?? '');
        process.exitCode = 1;
        return;
      }
      ui.pass('install done');
      ui.divider();
      ui.banner(true, '→ UPDATED ✓');
      // Print the installed CLI version for verification
      try {
        const pkg = JSON.parse(readFileSync(resolve(ctx.cwd, 'apps/cli/package.json'), 'utf8'));
        ui.hint(`now at: ${pkg.name}@${pkg.version}`);
      } catch { /* version optional */ }
      return;
    }

    // npm/pnpm/yarn package-manager paths — actual update
    const pmCmd = ctx.kind === 'pnpm' ? ['pnpm', 'up', '--latest', '@ivaronix/cli']
                : ctx.kind === 'yarn' ? ['yarn', 'upgrade', '@ivaronix/cli', '--latest']
                : ['npm', 'i', '-g', '@ivaronix/cli@latest'];
    ui.pending(`${pmCmd.join(' ')} ...`);
    try {
      execFileSync(pmCmd[0]!, pmCmd.slice(1), { cwd: ctx.cwd, stdio: 'inherit' });
      ui.divider();
      ui.banner(true, '→ UPDATED ✓');
    } catch (err) {
      ui.fail(`${pmCmd[0]} update failed`, (err as Error).message);
      process.exitCode = 1;
    }
  });
