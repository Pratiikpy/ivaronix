import { Command } from 'commander';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ui } from '../lib/ui.js';

export const initCommand = new Command('init')
  .description('Create a .ivaronix/ project folder in the current directory')
  .action(() => {
    const root = join(process.cwd(), '.ivaronix');
    if (existsSync(root)) {
      ui.fail(`.ivaronix/ already exists at ${root}`);
      return;
    }

    const dirs = [
      'policies',
      'receipts/local',
      'receipts/pending',
      'receipts/anchored',
      'skills',
      'workspaces',
      'memory/snapshots',
      'memory/burn',
      'memory/vector',
      'memory/graph/episodes',
      'memory/graph/facts',
      'snapshots',
      'worktrees',
      'traces',
      'kv-cache',
    ];
    for (const d of dirs) {
      mkdirSync(join(root, d), { recursive: true });
    }

    writeFileSync(join(root, 'config.json'), JSON.stringify({ network: 'testnet', daemonPort: 8787 }, null, 2));
    writeFileSync(join(root, 'AGENT.md'), '# Agent\n\n(passport summary will appear here once minted)\n');
    writeFileSync(join(root, 'CONTEXT.md'), '# Context\n\nDescribe the current scope.\n');
    writeFileSync(join(root, 'todo.md'), '# Todo\n\n- [ ] First task\n');
    writeFileSync(join(root, 'notes.md'), '# Notes\n\nWorking notes go here.\n');
    writeFileSync(
      join(root, 'hooks.yml'),
      `# Lifecycle hooks (claude-mem pattern)
PreToolUse:
  - match: "wallet.*"
    run: "ivaronix safety-check wallet"
PostToolUse:
  - match: "shell|file_write|skill_exec"
    run: "ivaronix observation extract"
SessionEnd:
  - run: "ivaronix memory consolidate"
PreCompact:
  - run: "ivaronix memory snapshot --upload"
`,
    );

    ui.pass(`.ivaronix/ initialized at ${root}`);
    ui.hint('Next: run `ivaronix doctor` to verify network/router/storage health.');
  });
