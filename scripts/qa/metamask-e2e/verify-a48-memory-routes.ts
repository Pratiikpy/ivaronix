/**
 * A.4.8 regression · Studio memory surface routes + lib are wired.
 *
 * Closes planning-003 §A.4.8 (MemoryEngine fourth product surface).
 * Asserts:
 *   1. The 4 API routes exist at the expected paths and import the
 *      shared `studio-memory` lib (so the implementation can't drift
 *      back to client-only fetch).
 *   2. The `studio-memory` lib exports the 5 expected helpers.
 *   3. Each write-side route gates on SIWE + per-IP rate-limit (no
 *      anonymous writes possible).
 *   4. The `MemoryNotesPanel` client component renders the
 *      "plaintext, per-wallet sandbox" disclosure inline (no quietly
 *      pretending it's encrypted).
 *   5. The `/memory` page mounts the new panel above the existing
 *      Permission Center.
 *   6. `private-doc-review` skill manifest opts into
 *      `memory_access: all` so it can query the user's prior context.
 *
 * Pure source-file regression — no server needed.
 */
import { existsSync, readFileSync } from 'node:fs';
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
const read = (rel: string): string => {
  const p = resolve(REPO_ROOT, rel);
  if (!existsSync(p)) fail(`expected file missing: ${rel}`);
  return readFileSync(p, 'utf8');
};
const must = (s: string, needle: string | RegExp, label: string) => {
  const found = typeof needle === 'string' ? s.includes(needle) : needle.test(s);
  if (!found) fail(`${label} (missing: ${needle.toString().slice(0, 80)})`);
  ok(label);
};

// 1. The 4 API routes exist + import the shared lib.
const remember = read('apps/studio/src/app/api/memory/remember/route.ts');
must(remember, "from '@/lib/studio-memory'", "remember route imports @/lib/studio-memory");
must(remember, 'export async function POST', 'remember route exports POST handler');

const recall = read('apps/studio/src/app/api/memory/recall/route.ts');
must(recall, "from '@/lib/studio-memory'", 'recall route imports @/lib/studio-memory');
must(recall, 'export async function POST', 'recall route exports POST handler');

const list = read('apps/studio/src/app/api/memory/list/route.ts');
must(list, "from '@/lib/studio-memory'", 'list route imports @/lib/studio-memory');
must(list, 'export async function GET', 'list route exports GET handler');

const forgetRoute = read('apps/studio/src/app/api/memory/forget/route.ts');
must(forgetRoute, "from '@/lib/studio-memory'", 'forget route imports @/lib/studio-memory');
must(forgetRoute, 'export async function POST', 'forget route exports POST handler');

// 2. The lib exports the 5 expected helpers.
const lib = read('apps/studio/src/lib/studio-memory.ts');
for (const fn of ['rememberNote', 'recallNotes', 'listNotes', 'forgetNote', 'forgetBeforeNotes']) {
  must(lib, new RegExp(`export function ${fn}\\b`), `studio-memory exports ${fn}`);
}

// 3. Write-side routes gate on SIWE + IP rate-limit. Read path (list) only
//    needs SIWE since reads can't be DoSed cheaply through the cookie-auth
//    bottleneck.
for (const [name, src] of [['remember', remember], ['recall', recall], ['forget', forgetRoute]] as const) {
  must(src, /readSession\(/, `${name} route reads SIWE session`);
  must(src, /SESSION_COOKIE_NAME/, `${name} route uses SESSION_COOKIE_NAME constant`);
  must(src, /checkRateLimit\('ip'/, `${name} route checks per-IP rate-limit`);
}
must(remember, /checkRateLimit\('memory-write'/, "remember route uses 'memory-write' wallet bucket");
must(forgetRoute, /checkRateLimit\('memory-write'/, "forget route uses 'memory-write' wallet bucket");
must(list, /readSession\(/, 'list route reads SIWE session');

// 4. Client component renders the plaintext disclosure inline.
const panel = read('apps/studio/src/components/MemoryNotesPanel.tsx');
must(panel, /plaintext/i, 'MemoryNotesPanel renders the plaintext disclosure');
must(panel, /per-wallet sandbox/i, 'MemoryNotesPanel calls out the per-wallet sandbox boundary');
must(panel, /ivaronix memory remember/, 'MemoryNotesPanel points users at the CLI for E2E-encrypted memory');

// 5. /memory page mounts the new panel.
const page = read('apps/studio/src/app/memory/page.tsx');
must(page, /import \{ MemoryNotesPanel \} from '@\/components\/MemoryNotesPanel'/, 'memory page imports MemoryNotesPanel');
must(page, /<MemoryNotesPanel \/>/, 'memory page renders <MemoryNotesPanel />');
must(page, /<MemoryPanel/, 'memory page still renders the Permission Center (Section §02)');

// 6. private-doc-review opts into memory_access: all.
const skill = read('seed-skills/private-doc-review/SKILL.md');
must(skill, /memory_access:\s*all\b/, 'private-doc-review skill manifest sets memory_access: all');

// 7. Rate-limit module accepts the new bucket key.
const rl = read('apps/studio/src/lib/rate-limit.ts');
must(rl, /'memory-write'/, 'rate-limit module declares memory-write kind');

console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
