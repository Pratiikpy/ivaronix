/**
 * README + render-target docs must only reference real CLI commands.
 *
 * Mirror of sweep 191's pnpm-scripts regression for the CLI side. Catches
 * the same first-touch-failure bug class — a judge typing
 * `ivaronix <foo>` from a doc and getting "Unknown command" because
 * the example references a subcommand that never existed.
 *
 * Implementation: parse `addCommand(X)` registrations in
 * apps/cli/src/bin/ivaronix.ts plus the per-command file's
 * `new Command('name')` strings. Walk the render-target docs for
 * `ivaronix <token>` patterns and assert each token resolves.
 *
 * Pure source-file regression.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

// Find every `new Command('xxx')` literal in apps/cli/src/commands/.
const COMMANDS_DIR = resolve(REPO_ROOT, 'apps/cli/src/commands');
const registered = new Set<string>();
for (const fname of readdirSync(COMMANDS_DIR)) {
  if (!fname.endsWith('.ts') && !fname.endsWith('.tsx')) continue;
  const content = readFileSync(join(COMMANDS_DIR, fname), 'utf8');
  const re = /new\s+Command\s*\(\s*['"]([a-zA-Z][\w-]*)['"]/g;
  const matches = content.matchAll(re);
  for (const m of matches) {
    const n = m[1];
    if (n) registered.add(n);
  }
}
ok(`extracted ${registered.size} registered Commander command names from apps/cli/src/commands/`);

// A few special bare-invocations: `ivaronix` alone falls into chat-v2
// (or chat-classic on non-TTY) per bin/ivaronix.ts:119-122. Anything
// looking like an argument file (verb followed by --flag or punctuation)
// is also benign.
const KNOWN_NON_SUBCOMMANDS = new Set<string>([
  'app',  // "ivaronix app …" doesn't exist; flagged as a write
  'this', // appears in prose "ivaronix this …"
  'cli',  // "Ivaronix CLI" prose
]);

const TARGET_DOCS = [
  'README.md',
  'docs/PITCH.md',
  'docs/JUDGE_GUIDE.md',
  'docs/MAINNET_READINESS.md',
];

const violations: Array<{ file: string; line: number; cmd: string }> = [];
const ivaronixPattern = /\bivaronix\s+([a-z][\w-]*)/g;

for (const rel of TARGET_DOCS) {
  let content: string;
  try {
    content = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
  } catch {
    continue;
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (/ivaronix-cmd-allow:/.test(text)) continue;
    const matches = text.matchAll(ivaronixPattern);
    for (const m of matches) {
      const cmd = m[1];
      if (!cmd || KNOWN_NON_SUBCOMMANDS.has(cmd)) continue;
      if (!registered.has(cmd)) {
        violations.push({ file: rel, line: i + 1, cmd: m[0] });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('FAIL: docs reference ivaronix subcommands that don\'t exist in apps/cli/src/commands/:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  -> ${v.cmd}`);
  }
  console.error('Fix: rename the doc example to a real subcommand, OR add the missing Commander binding in apps/cli/src/commands/.');
  console.error('Allow-marker: `ivaronix-cmd-allow:<reason>` inline for intentionally aspirational examples.');
  process.exit(1);
}

ok('all ivaronix <subcommand> references in render-target docs map to real CLI commands');
console.log(`\n[verify-readme-ivaronix-commands-exist] ${asserts} assertions passed`);
