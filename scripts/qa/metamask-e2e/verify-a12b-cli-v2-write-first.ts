/**
 * Regression: every CLI write that anchors a receipt branches V2-first.
 *
 * Why this gate exists (sweep 98 finding · companion to verify-a12-
 * cli-v2-first which covers READS):
 *   Sweeps 95 + 96 + 97 migrated 6 anchor sites across 4 CLI commands
 *   (doc.ts, room.ts × 2, model.ts, passport-consolidate.ts) from
 *   V1-only WRITES to V2-first. The migration was significant: pre-
 *   sweep-95, operators using `ivaronix doc ask` got V1-anchored
 *   receipts even though V2 has been the canonical target since
 *   sweep 65 (~30 sweeps ago).
 *
 *   The gate captures the migration's invariant: any CLI command
 *   that WRITES (anchors) a receipt must use the V2-first branch
 *   pattern, NOT a bare ReceiptRegistryClient.anchor() call.
 *
 * What we check:
 *   For every file in apps/cli/src/commands/*.ts:
 *     If the file imports + uses ReceiptRegistryClient AND calls
 *     `.anchor(` on it (write-side), then:
 *       - The file MUST also import ReceiptRegistryV2Client.
 *       - The file MUST also call `.signAndAnchor(` somewhere.
 *       - A `registryVersion` (or `writeVersion`) variable should
 *         drive the branch.
 *
 *   The check is structural — we don't trace control flow, just
 *   confirm the V2-first machinery EXISTS in any file that writes.
 *   Refactors that legitimately move write logic out (e.g., to a
 *   shared helper) should update this gate.
 *
 * Allow-list:
 *   `// cli-v1-write-allow:<reason>` inline marker on the same line
 *   as a `.anchor(` call. Use only when V2 path is genuinely
 *   inappropriate (e.g., a backfill tool that explicitly targets V1).
 *   None today.
 *
 * Captures sweep 98's closure as a permanent gate. Testnet-only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const CLI_COMMANDS = resolve(REPO_ROOT, 'apps', 'cli', 'src', 'commands');

interface Hit {
  file: string;
  line: number;
  text: string;
  reason: 'bare-v1-anchor' | 'v1-anchor-no-v2-branch';
}

const ALLOW_TAG = /cli-v1-write-allow:/;

function listCommandFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => resolve(dir, f));
}

function scanFile(file: string): Hit[] {
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const hits: Hit[] = [];

  // Find every line that calls `.anchor(` on what looks like a registry.
  // The legacy V1 shape: `<var>.anchor(receiptRoot, ...)`. The V2 shape
  // doesn't appear here — V2 uses `.signAndAnchor(`.
  const v1AnchorLines: { line: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (ALLOW_TAG.test(text)) continue;
    // Skip comments — JSDoc and inline comments mention `.anchor(` in prose.
    const trimmed = text.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (/\.anchor\(/.test(text) && !/\.signAndAnchor\(/.test(text)) {
      v1AnchorLines.push({ line: i + 1, text: text.trim() });
    }
  }

  if (v1AnchorLines.length === 0) {
    // No V1 anchor — file is either read-only or already pure V2.
    return [];
  }

  // The file has at least one V1-shaped `.anchor(`. Confirm V2 machinery
  // also exists. If yes, the V1 anchor is the legacy fallback branch
  // (V2/V1 dual-path). If no, the file writes V1-only — flag.
  const hasV2Import = /\bReceiptRegistryV2Client\b/.test(src);
  const hasV2SignAndAnchor = /\.signAndAnchor\(/.test(src);
  const hasVersionBranch = /\b(registryVersion|writeVersion)\b/.test(src);

  if (!hasV2Import || !hasV2SignAndAnchor || !hasVersionBranch) {
    // Flag every V1 anchor line in this file as "no V2 branch."
    for (const v1 of v1AnchorLines) {
      hits.push({
        file,
        line: v1.line,
        text: v1.text,
        reason: 'v1-anchor-no-v2-branch',
      });
    }
  }
  return hits;
}

console.log('CLI commands · V2-first write pattern\n');

const files = listCommandFiles(CLI_COMMANDS);
const allHits: Hit[] = [];
for (const f of files) allHits.push(...scanFile(f));

console.log(`  scanned ${files.length} CLI command files`);

if (allHits.length === 0) {
  console.log(`  PASS · every V1 anchor has an accompanying V2 signAndAnchor branch`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} V1-only anchor(s) without V2 branch:\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  console.error(`    ${rel}:${h.line}  [${h.reason}]`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: add the V2-first branch (parallels packages/runtime/src/pipeline.ts:794-828):');
console.error('       1. import ReceiptRegistryV2Client from @ivaronix/og-chain');
console.error('       2. lookup BOTH addresses; prefer V2');
console.error('       3. registryVersion = registryAddrV2 ? \'v2\' : \'v1\'');
console.error('       4. branch on registryVersion: V2 → signAndAnchor, V1 → anchor');
console.error('       5. normalize tx + blockNumber output downstream');
process.exit(1);
