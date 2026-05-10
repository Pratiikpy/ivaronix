#!/usr/bin/env tsx
import { dispatchTool } from '../apps/cli/src/lib/chat-tools.js';

async function main() {
  const cwd = process.cwd();
  const r1 = await dispatchTool(cwd, 'list_files', JSON.stringify({ dir: 'seed-skills', ext: 'md' }));
  console.log('--- list_files seed-skills ---');
  console.log(r1.output.split('\n').slice(0, 6).join('\n'));

  const r2 = await dispatchTool(cwd, 'grep', JSON.stringify({ pattern: 'tier=quick', dir: 'seed-skills', ext: 'md' }));
  console.log('\n--- grep tier=quick ---');
  console.log(r2.output.split('\n').slice(0, 4).join('\n'));

  const r3 = await dispatchTool(cwd, 'run_bash', JSON.stringify({ cmd: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] }));
  console.log('\n--- run_bash git branch ---');
  console.log(r3.output.trim());

  const r4 = await dispatchTool(cwd, 'read_file', JSON.stringify({ path: 'seed-skills/plan-step/SKILL.md' }));
  console.log('\n--- read_file plan-step ---');
  console.log(r4.output.split('\n').slice(0, 5).join('\n'));
}

main().catch((err) => { console.error(err); process.exit(1); });
