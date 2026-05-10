/**
 * A.1.1 regression · skill/new form derives memory_access + shell_access
 * options from the canonical Zod schema in @ivaronix/skills, NOT from
 * hardcoded literal arrays.
 *
 * Closes WT 43 + 44 + 85 from wanderingthoughts.md:
 *   - Form had `SHELL_OPTIONS = ['none','read','read-write']` while the
 *     Zod schema requires `['none','sandbox-only','full']`. Every default-
 *     form save was failing Zod validation at /api/skill/save.
 *   - Same shape for `MEMORY_OPTIONS = ['none','project_only','cross_project']`
 *     vs schema `['none','project_only','all']`.
 *
 * Three assertions:
 *   1. Schema enums match expected canonical values (defends manifest.ts).
 *   2. Form file imports `Permissions` from `@ivaronix/skills` (defends
 *      against re-introducing the parallel literal arrays).
 *   3. Form file does NOT contain the legacy literal values that triggered
 *      the original bug.
 */
import { MemoryAccessEnum, ShellAccessEnum, ConsensusTierEnum } from '@ivaronix/skills';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const FORM_PATH = resolve(REPO_ROOT, 'apps/studio/src/app/skill/new/page.tsx');

let failures = 0;
function check(label: string, pass: boolean, detail = ''): void {
  if (pass) {
    console.log(`  PASS · ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL · ${label}${detail ? ` · ${detail}` : ''}`);
  }
}

console.log('A.1.1 · skill/new form schema parity\n');

// 1. Schema enums match expected canonical values.
const memoryEnum = MemoryAccessEnum.options;
const shellEnum = ShellAccessEnum.options;
const tierEnum = ConsensusTierEnum.options;
check('schema memory_access enum', JSON.stringify(memoryEnum) === JSON.stringify(['none', 'project_only', 'all']), `got ${JSON.stringify(memoryEnum)}`);
check('schema shell_access enum', JSON.stringify(shellEnum) === JSON.stringify(['none', 'sandbox-only', 'full']), `got ${JSON.stringify(shellEnum)}`);
// Per planning-003 §A.5.20 the audit tier landed; the canonical 4-value
// list is now ['quick','standard','high-stakes','audit'].
check('schema consensus tier enum', JSON.stringify(tierEnum) === JSON.stringify(['quick', 'standard', 'high-stakes', 'audit']), `got ${JSON.stringify(tierEnum)}`);
check('schema memory_access has 3 values', memoryEnum.length === 3);
check('schema shell_access has 3 values', shellEnum.length === 3);
check('schema consensus tier has 4 values', tierEnum.length === 4);

// 2. Form file derives options from schema.
check('form file exists', existsSync(FORM_PATH), FORM_PATH);
const formSrc = existsSync(FORM_PATH) ? readFileSync(FORM_PATH, 'utf8') : '';
check(
  'form imports MemoryAccessEnum + ShellAccessEnum + ConsensusTierEnum from @ivaronix/skills (or /manifest sub-path)',
  // Accept either the bare barrel `@ivaronix/skills` OR the schema-only
  // sub-path `@ivaronix/skills/manifest` — sweep 67 switched to the
  // sub-path to avoid pulling node:fs into the client bundle. Both
  // import paths expose the same three enum schemas; the regression
  // cares about WHICH module the form derives from, not which path
  // string the import line uses.
  /import\s*\{[\s\S]*?\bMemoryAccessEnum\b[\s\S]*?\bShellAccessEnum\b[\s\S]*?\bConsensusTierEnum\b[\s\S]*?\}\s*from\s*['"]@ivaronix\/skills(?:\/manifest)?['"]/.test(formSrc),
  'expected import of all three enum schemas from @ivaronix/skills or @ivaronix/skills/manifest',
);
check(
  'form derives MEMORY_OPTIONS from MemoryAccessEnum.options',
  /MEMORY_OPTIONS\s*=\s*MemoryAccessEnum\.options/.test(formSrc),
);
check(
  'form derives SHELL_OPTIONS from ShellAccessEnum.options',
  /SHELL_OPTIONS\s*=\s*ShellAccessEnum\.options/.test(formSrc),
);
check(
  'form derives TIER_OPTIONS from ConsensusTierEnum.options',
  /TIER_OPTIONS\s*=\s*ConsensusTierEnum\.options/.test(formSrc),
);

// 3. Form file does NOT contain the legacy literal values.
check(
  'form has no hardcoded "cross_project" string (legacy memory enum)',
  !formSrc.includes("'cross_project'") && !formSrc.includes('"cross_project"'),
);
check(
  'form has no hardcoded "read-write" string (legacy shell enum)',
  !formSrc.includes("'read-write'") && !formSrc.includes('"read-write"'),
);
check(
  'form does not redeclare MEMORY_OPTIONS as inline literal array',
  !/MEMORY_OPTIONS\s*=\s*\[\s*['"]none['"]/.test(formSrc),
);
check(
  'form does not redeclare SHELL_OPTIONS as inline literal array',
  !/SHELL_OPTIONS\s*=\s*\[\s*['"]none['"]/.test(formSrc),
);
check(
  'form does not redeclare TIER_OPTIONS as inline literal array',
  !/TIER_OPTIONS\s*=\s*\[\s*['"]quick['"]/.test(formSrc),
);

console.log();
if (failures > 0) {
  console.error(`A.1.1 · ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('A.1.1 · all assertions passed · form/schema parity holds');
