/**
 * Regression: every internal markdown link in render-target docs points
 * to a file that exists.
 *
 * Why this gate exists (sweep 88 finding):
 *   The render-target docs (README, PITCH, JUDGE_GUIDE, MAINNET_READINESS,
 *   plus the navigation anchors RECEIPT_SCHEMA, USER_TODO, CHANGELOG)
 *   carry dozens of links between themselves and to other repo files.
 *   When a doc is renamed or moved (e.g. doc subdir restructure per
 *   USER_TODO B-V2-20), the linking documents silently break. A judge
 *   clicking a 404'd link in README sees "this team can't keep its own
 *   docs in sync" — exactly the impression we don't want.
 *
 *   Sweep 88 verified all 22 links in README.md resolve. This regression
 *   captures that state as a permanent gate. Any future PR that renames
 *   a target without updating the linking sites fails CI.
 *
 * Scope:
 *   Render-target docs + navigation hub docs:
 *     - README.md
 *     - docs/JUDGE_GUIDE.md
 *     - docs/PITCH.md
 *     - docs/MAINNET_READINESS.md
 *     - docs/RECEIPT_SCHEMA.md
 *     - docs/USER_TODO.md
 *     - CHANGELOG.md
 *
 *   Link patterns:
 *     - Markdown link `[text](path)` where path is internal:
 *         relative path starting with `./` or `../`
 *         repo-rooted path starting with a known top dir (docs/,
 *           apps/, packages/, contracts/, scripts/, brand/, .github/)
 *         bare filename in same dir (e.g. `[X](FOO.md)`)
 *     - Anchor-only links (`[text](#section)`) are skipped — they're
 *       intra-doc anchors.
 *     - External links (http://, https://, mailto:) are skipped — they
 *       need network access to verify.
 *
 *   The link target is normalized:
 *     - Strip `#anchor` suffix (the file part is what we check)
 *     - Resolve relative paths against the linking doc's directory
 *     - Repo-root-style paths resolve against REPO_ROOT
 *
 * Captures sweep 88's closure as a permanent gate. Testnet-only.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const TARGET_DOCS_CANDIDATES = [
  'README.md',
  'docs/JUDGE_GUIDE.md',
  'docs/PITCH.md',
  'docs/MAINNET_READINESS.md',
  'docs/RECEIPT_SCHEMA.md',
  'docs/USER_TODO.md',
  'CHANGELOG.md',
];
// Skip docs that aren't in the tree — internal MDs may be gitignored
// on a contributor's checkout. The gate still fires on every public
// render-target that exists.
const TARGET_DOCS = TARGET_DOCS_CANDIDATES.filter((p) => existsSync(resolve(REPO_ROOT, p)));

const REPO_TOP_DIRS = ['docs', 'apps', 'packages', 'contracts', 'scripts', 'brand', '.github', 'tests', '_archive'];

interface BrokenLink {
  doc: string;
  line: number;
  target: string;
  resolved: string;
}

const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;

function isExternal(url: string): boolean {
  return /^(https?:|mailto:|ftp:|file:)/.test(url);
}

function isAnchorOnly(url: string): boolean {
  return url.startsWith('#');
}

function stripAnchor(url: string): string {
  const idx = url.indexOf('#');
  return idx < 0 ? url : url.slice(0, idx);
}

function resolveLinkTarget(target: string, fromFile: string): string {
  // Strip query string + anchor.
  const fileOnly = stripAnchor(target).split('?')[0] ?? '';
  if (fileOnly.length === 0) return ''; // pure anchor
  if (fileOnly.startsWith('/')) {
    // Treat absolute paths (rare, e.g. `/docs/X`) as repo-rooted.
    return resolve(REPO_ROOT, fileOnly.slice(1));
  }
  if (fileOnly.startsWith('./') || fileOnly.startsWith('../')) {
    return resolve(dirname(fromFile), fileOnly);
  }
  // No leading dot: heuristic — if the first segment is a known
  // top-level dir, treat as repo-rooted; otherwise relative to the
  // doc's dir.
  const firstSeg = fileOnly.split('/')[0]!;
  if (REPO_TOP_DIRS.includes(firstSeg)) {
    return resolve(REPO_ROOT, fileOnly);
  }
  return resolve(dirname(fromFile), fileOnly);
}

console.log('Render-target docs · internal links resolve\n');

let totalLinks = 0;
const broken: BrokenLink[] = [];

for (const docRel of TARGET_DOCS) {
  const docPath = resolve(REPO_ROOT, docRel);
  if (!existsSync(docPath)) {
    console.error(`  WARN · target doc missing: ${docRel}`);
    continue;
  }
  const content = readFileSync(docPath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    linkRe.lastIndex = 0;
    for (const m of line.matchAll(linkRe)) {
      const target = m[2]!.trim();
      if (isExternal(target)) continue;
      if (isAnchorOnly(target)) continue;
      totalLinks += 1;
      const resolved = resolveLinkTarget(target, docPath);
      if (resolved.length === 0) continue;
      if (!existsSync(resolved)) {
        broken.push({ doc: docRel, line: i + 1, target, resolved });
        continue;
      }
      // Reject linking to a directory unless explicitly trailing slash.
      // (Some markdown renderers handle dir links; our gate is strict.)
      const stat = statSync(resolved);
      if (stat.isDirectory() && !target.endsWith('/')) {
        broken.push({
          doc: docRel,
          line: i + 1,
          target,
          resolved: `${resolved} (directory · add trailing /)`,
        });
      }
    }
  }
}

console.log(`  scanned ${TARGET_DOCS.length} docs · ${totalLinks} internal links`);

if (broken.length === 0) {
  console.log(`  PASS · every internal link resolves`);
  process.exit(0);
}

console.error(`  FAIL · ${broken.length} broken link(s):\n`);
for (const b of broken) {
  console.error(`    ${b.doc}:${b.line}  →  [${b.target}]`);
  console.error(`      resolved to: ${b.resolved}`);
}
console.error('\n  fix: rename the link target, or update the linking doc.');
process.exit(1);
