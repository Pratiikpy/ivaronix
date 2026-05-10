/**
 * Regression: no `@ts-ignore` / `@ts-nocheck` in first-party code.
 * `@ts-expect-error` allowed ONLY with an inline reason comment on the
 * same line.
 *
 * Why this gate exists (sweep 83 finding):
 *   Sweep 82 caught a type-launder cast on a private field
 *   (apps/studio/src/app/global/page.tsx:44) — a textbook escape-hatch
 *   used to access `client.contract` without exposing a proper public
 *   API. The fix added `listGlobal()` as a first-class method.
 *
 *   `@ts-ignore` is the broader-class same-shape problem: a comment
 *   that disables type-checking on the next line. It hides bugs that
 *   tsc would otherwise catch. CLAUDE.md doesn't ban it explicitly, but
 *   the §1 rule "production-ready option · choose the strongest
 *   practical implementation" implies type-clean over type-ignored.
 *
 *   Sweep 83 verified zero `@ts-ignore` in first-party `apps/` + first-
 *   party `packages/` (excluding vendored opencode-*). This regression
 *   captures that state as a permanent gate. Future PRs that try to
 *   sneak in `// @ts-ignore` get caught at pre-commit.
 *
 * Scope:
 *   First-party code: apps/{cli,studio,mcp-server,telegram-bot}/src,
 *   apps/npx-cli/{src,bundle.mjs}, packages/{core,consensus,receipts,
 *   skills,memory,og-chain,og-router,og-storage,trust-layer,og-kv,
 *   og-da,indexer,runtime,widget,og-toolkit}/src.
 *
 *   Vendored exclusion: packages/opencode-{bin,sdk,core,plugin,
 *   function,script}/** is upstream-owned per CLAUDE.md §3 + the
 *   ci.yml workspace filter.
 *
 * What we check:
 *   - `@ts-ignore` (any form): flagged unconditionally — there is no
 *     justifiable reason in our codebase.
 *   - `@ts-nocheck`: flagged unconditionally — disables a whole file.
 *   - `@ts-expect-error`: ALLOWED if followed by a non-empty reason
 *     on the same line (e.g. `// @ts-expect-error · ethers v6 type
 *     drift in the X path`). Bare `// @ts-expect-error` is flagged.
 *
 * Allow-list:
 *   - Inline marker on the same line: `ts-suppress-allow:<reason>`.
 *     Use only when the type-system genuinely can't express the truth
 *     (rare — most cases have a structural fix).
 *
 * Captures sweep 83's closure. Testnet-only — the regression IS the
 * durable record.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

interface Hit {
  file: string;
  line: number;
  text: string;
  kind: '@ts-ignore' | '@ts-nocheck' | 'bare @ts-expect-error';
}

const FIRST_PARTY_ROOTS = [
  'apps/cli/src',
  'apps/studio/src',
  'apps/mcp-server/src',
  'apps/telegram-bot/src',
  'apps/npx-cli',
  'packages/core/src',
  'packages/consensus/src',
  'packages/receipts/src',
  'packages/skills/src',
  'packages/memory/src',
  'packages/og-chain/src',
  'packages/og-router/src',
  'packages/og-storage/src',
  'packages/trust-layer/src',
  'packages/og-kv/src',
  'packages/og-da/src',
  'packages/indexer/src',
  'packages/runtime/src',
  'packages/widget/src',
  'packages/og-toolkit/src',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git']);
const VALID_EXT = new Set(['.ts', '.tsx', '.mjs']);

function listFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...listFiles(path));
    } else {
      const dot = entry.lastIndexOf('.');
      if (dot >= 0 && VALID_EXT.has(entry.slice(dot))) {
        out.push(path);
      }
    }
  }
  return out;
}

const ALLOW_TAG = /ts-suppress-allow:/;

function scanFile(file: string): Hit[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (ALLOW_TAG.test(text)) continue;
    if (/@ts-ignore\b/.test(text)) {
      hits.push({ file, line: i + 1, text: text.trim(), kind: '@ts-ignore' });
      continue;
    }
    if (/@ts-nocheck\b/.test(text)) {
      hits.push({ file, line: i + 1, text: text.trim(), kind: '@ts-nocheck' });
      continue;
    }
    // @ts-expect-error allowed if a reason follows on the SAME line.
    // Acceptable shapes:
    //   // @ts-expect-error · reason text
    //   // @ts-expect-error: reason
    //   // @ts-expect-error reason
    // Bare `// @ts-expect-error` (with nothing after) → flag.
    const expectMatch = text.match(/@ts-expect-error\b(.*)$/);
    if (expectMatch) {
      const tail = (expectMatch[1] ?? '').trim();
      // Strip leading punctuation that's typically separator: ·, :, -, —
      const reason = tail.replace(/^[·:\-—\s]+/, '');
      if (reason.length === 0) {
        hits.push({ file, line: i + 1, text: text.trim(), kind: 'bare @ts-expect-error' });
      }
    }
  }
  return hits;
}

console.log('First-party · no @ts-ignore / @ts-nocheck / bare @ts-expect-error\n');

const allFiles: string[] = [];
for (const root of FIRST_PARTY_ROOTS) allFiles.push(...listFiles(resolve(REPO_ROOT, root)));

const allHits: Hit[] = [];
for (const f of allFiles) allHits.push(...scanFile(f));

console.log(`  scanned ${allFiles.length} files across ${FIRST_PARTY_ROOTS.length} first-party roots`);

if (allHits.length === 0) {
  console.log(`  PASS · zero TS suppression in first-party code`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} suppression(s):\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  console.error(`    ${rel}:${h.line}  [${h.kind}]`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: rewrite to be type-clean (preferred) or add an explicit reason on');
console.error('       a `// @ts-expect-error · <reason>` line. Genuine "type system can\'t');
console.error('       express this" cases get a `ts-suppress-allow:<reason>` allow marker.');
process.exit(1);
