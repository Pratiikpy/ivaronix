/**
 * Regression: no empty catch blocks in first-party code.
 *
 * Why this gate exists (sweep 91 finding · CLAUDE.md silent-failure
 * rule):
 *   CLAUDE.md "Don't add error handling, fallbacks, or validation for
 *   scenarios that can't happen" + the silent-failure-hunter agent
 *   guidance both warn against `try { ... } catch {}` — the catch
 *   block that swallows errors without logging, propagating, or
 *   transforming them. The pattern hides bugs that the type system
 *   can't see (only runtime can produce the throw).
 *
 *   Verified zero `catch {}` / `catch (err) {}` / `catch (_) {}` in
 *   first-party code today (apps + packages, excluding vendored
 *   opencode-*). Sweep 91 captures that state as a permanent gate.
 *
 *   What's still allowed:
 *     - `catch (err) { ...explicit-reason-comment... }` — empty body
 *       BUT a comment explaining why silence is correct here. Forces
 *       the contributor to articulate the reasoning.
 *     - `catch (err) { ignore(err); }` (or similar named-helper that
 *       documents the intent at the call site).
 *     - `catch (err) { return defaultValue; }` — non-empty body that
 *       handles the case.
 *
 *   What's flagged:
 *     - `catch {}` (true empty)
 *     - `catch (e) {}` (empty with named param)
 *     - `catch (_) {}` (empty with discarded param — the underscore
 *       form is sometimes a "I'm aware" signal but still hides errors)
 *
 *   Allow-list: `// silent-catch-allow:<reason>` inline marker for
 *   the rare case where empty truly is correct AND a comment isn't
 *   feasible (none today).
 *
 * Captures sweep 91's closure as a permanent gate. Testnet-only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

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

interface Hit {
  file: string;
  line: number;
  text: string;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Directory missing — skip silently. (This catch is intentional;
    // the helper handles "directory not found" as "no files." It's
    // also the empty-catch test case that justifies the pattern's
    // exception when the cause is a recoverable enumerated state.)
    // silent-catch-allow:directory-enumeration-not-found
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

const ALLOW_TAG = /silent-catch-allow:/;

function scanFile(file: string): Hit[] {
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const hits: Hit[] = [];

  // Match catch (...) { followed by zero-or-only-whitespace until }.
  // Multiline-aware: a catch block can span lines but be empty.
  // Pattern: `catch` `(...)` (optional) `{` then any-whitespace `}`.
  // Use a regex with `s` (dotall) modifier on the flat source string,
  // capturing the offset to compute line number.
  const re = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
  for (const m of src.matchAll(re)) {
    const offset = m.index ?? 0;
    // Determine the line number.
    let line = 1;
    for (let i = 0; i < offset; i += 1) if (src[i] === '\n') line += 1;
    // Check if the same line OR the immediately preceding line has the
    // allow-tag (the marker can sit either inline above the try/catch).
    const prevLine = lines[line - 2] ?? '';
    const thisLine = lines[line - 1] ?? '';
    if (ALLOW_TAG.test(prevLine) || ALLOW_TAG.test(thisLine)) continue;
    hits.push({ file, line, text: m[0].replace(/\s+/g, ' ') });
  }
  return hits;
}

console.log('First-party · no empty catch blocks\n');

const allFiles: string[] = [];
for (const root of FIRST_PARTY_ROOTS) allFiles.push(...listFiles(resolve(REPO_ROOT, root)));

const allHits: Hit[] = [];
for (const f of allFiles) allHits.push(...scanFile(f));

console.log(`  scanned ${allFiles.length} files`);

if (allHits.length === 0) {
  console.log(`  PASS · zero empty-catch blocks in first-party code`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} empty catch block(s):\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  console.error(`    ${rel}:${h.line}  ${h.text}`);
}
console.error('\n  fix: add a comment explaining why silence is correct, OR handle the error,');
console.error('       OR add a `// silent-catch-allow:<reason>` allow marker on the same/prev line.');
process.exit(1);
