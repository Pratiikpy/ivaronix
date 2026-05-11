/**
 * `ivaronix memory snapshot` MUST keep its `--upload` flag wired to a
 * real 0G Storage upload call. Closes HALF_BAKED §I-12 (sweep 201).
 *
 * Pre-sweep-201 the snapshot command only printed the manifest and
 * pointed at a §B-V2 queue with no concrete code path. The blob-upload
 * half is now real: with IVARONIX_SIGNER_KEY set, the command writes
 * the manifest JSON bytes to 0G Storage via createStorageClient().
 *
 * This regression locks the wiring against silent regression — a
 * future refactor could drop the `--upload` option declaration, drop
 * the `createStorageClient` import, or drop the `.upload(` call site,
 * and the command would still PRINT a manifest. The half-baked surface
 * would silently reappear.
 *
 * Property locked: `apps/cli/src/commands/memory.ts` references all
 * three required wiring symbols in the same file.
 *
 * Pure source-file regression — no runtime.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
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

const memoryPath = resolve(REPO_ROOT, 'apps', 'cli', 'src', 'commands', 'memory.ts');
const src = readFileSync(memoryPath, 'utf8');
ok(`loaded ${memoryPath}`);

// Required wiring symbols. Each represents one leg of the upload path:
//   1. `createStorageClient` — the only path to a real Storage upload
//      from a CLI command (used in doc.ts / passport.ts / room.ts too).
//   2. `--upload` Commander option declaration. Without it the action
//      handler can't be reached.
//   3. `.upload(` method call site. Without it the upload doesn't fire
//      even when the flag is parsed.
const wiring = [
  {
    label: 'createStorageClient import',
    pattern: /createStorageClient\s*[,}]/,
    miss: 'memory.ts must import createStorageClient from @ivaronix/og-storage (sweep 201 wiring)',
  },
  {
    label: '--upload Commander option',
    pattern: /\.option\(\s*['"]--upload['"]/,
    miss: 'memory snapshot must declare `.option("--upload", ...)` (sweep 201 wiring)',
  },
  {
    label: 'sc.upload(...) call site',
    pattern: /\bsc\.upload\s*\(/,
    miss: 'memory snapshot must call `sc.upload(bytes)` to actually persist the manifest (sweep 201 wiring)',
  },
];

for (const w of wiring) {
  if (!w.pattern.test(src)) {
    fail(`${w.miss} · pattern ${w.pattern} did not match in apps/cli/src/commands/memory.ts`);
  }
  ok(`${w.label} present`);
}

// Anchor the rule to a comment trail so future readers find the linkage.
if (!/HALF_BAKED §I-12/.test(src) && !/HALF_BAKED \xa7I-12/.test(src)) {
  fail('memory.ts must reference "HALF_BAKED §I-12" near the snapshot command (sweep 201 closure citation)');
}
ok('HALF_BAKED §I-12 citation present in memory.ts');

console.log(`\n[verify-memory-snapshot-upload] ${asserts} assertions passed`);
