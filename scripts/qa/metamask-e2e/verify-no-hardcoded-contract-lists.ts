// Regression: TypeScript files in apps/cli, apps/studio, apps/mcp-server,
// apps/telegram-bot, packages/runtime must NOT hardcode an enumeration
// of canonical contract names. Iterate Object.keys(loadDeployments(...)
// .contracts) instead — sweeps 56 (doctor) + 59 (debug chain) caught
// the same hardcoded-6-V1-contracts drift independently.
//
// Why this exists:
//   The drift class hides because the "list" looks correct at write
//   time — it enumerates exactly the contracts deployed at that moment.
//   When V2 contracts deploy later, the hardcoded array silently
//   omits them. Operators running diagnostics see the OLD set; V2 is
//   invisible until someone notices.
//
//   The fix shape that converged across sweeps:
//     Bad:  const names = ['ReceiptRegistry', 'Erc7857Verifier', ...];
//     Good: const names = Object.keys(deployments.contracts).sort();
//
// Detection rule:
//   A line containing 3+ canonical contract-name string literals
//   (`'ReceiptRegistry'`, `'AgentPassportINFT'`, etc.) within a single
//   array literal `[...]` is flagged. This catches the typical
//   `const names = [...]` shape without false-positive on isolated
//   single-name lookups (those are how `getDeployedAddress(network,
//   'ReceiptRegistry')` works).
//
// Allow-list:
//   Inline marker `hardcoded-contracts:allow:reason` on the line.
//   Useful for SKILL_TYPES enum-shape arrays or test fixtures.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
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

// Canonical contract names (the deployments-file keys). Adding a new
// contract here is as easy as adding it to the deployments file; the
// rule fires when 3+ of these appear in a single array literal.
const CONTRACT_NAMES = [
  'ReceiptRegistry',
  'ReceiptRegistryV2',
  'AgentPassportINFT',
  'AgentPassportINFTV2',
  'Erc7857Verifier',
  'CapabilityRegistry',
  'CapabilityRegistryV2',
  'MemoryAccessLog',
  'MemoryAccessLogV2',
  'SkillRegistry',
  'SkillRegistryV2',
  'SubscriptionEscrow',
  'SubscriptionEscrowV2',
];

const CONTRACT_NAME_SET = new Set(CONTRACT_NAMES);

// Walk targeted dirs; skip vendored opencode-bin (that has its own
// hardcoded patterns we don't own).
function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  const skipDirs = new Set([
    'node_modules', '.next', '.turbo', 'dist',
    'opencode-bin', 'opencode-sdk', 'opencode-core', 'opencode-plugin',
  ]);
  let entries;
  try { entries = readdirSync(dir); } catch { return []; }
  for (const entry of entries) {
    if (skipDirs.has(entry)) continue;
    const path = resolve(dir, entry);
    let stat;
    try { stat = statSync(path); } catch { continue; }
    if (stat.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(path);
    }
  }
  return out;
}

const TARGETS = [
  resolve(REPO_ROOT, 'apps', 'cli'),
  resolve(REPO_ROOT, 'apps', 'studio'),
  resolve(REPO_ROOT, 'apps', 'mcp-server'),
  resolve(REPO_ROOT, 'apps', 'telegram-bot'),
  resolve(REPO_ROOT, 'packages', 'runtime'),
];

const allFiles: string[] = [];
for (const t of TARGETS) allFiles.push(...listTsFiles(t));
ok(`scanning ${allFiles.length} TS/TSX files under apps/{cli,studio,mcp-server,telegram-bot} + packages/runtime`);

// Detect 3+ contract names within a single array OR object literal.
//
// Pre-sweep-118 the gate only checked `[...]` array literals. Sweep
// 117 caught a hardcoded-addresses bug in apps/studio/src/components/
// Footer.tsx where the registry was a `{ ReceiptRegistry: '0x...',
// AgentPassportINFT: '0x...', ... }` OBJECT literal — same drift
// class but different syntactic shape. Sweep 118 extends the scan to
// catch both `[` and `{` literals that contain 3+ contract names
// either as string-literals (array form) OR as object KEYS (registry
// form).
//
// We slide through the file looking for `[` or `{` then collecting
// contract names until matching `]` or `}`. Bracket-nesting awareness
// is overkill here — the false-positive surface (object literals
// nested in arrays containing names as keys) is negligible in
// practice.
interface Hit { file: string; line: number; matchedNames: string[]; context: string }
const hits: Hit[] = [];

for (const file of allFiles) {
  const relPath = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  // Walk lines, looking for an opening `[` and counting contract-name
  // string literals until the matching `]` on the same line OR up to
  // 5 lines below (covers multi-line arrays).
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes('hardcoded-contracts:allow:')) continue;

    // Find every `[` OR `{` start. For each, extend up to 7 lines (object
    // literals tend to be longer than arrays · 6 contract entries fit) and
    // count contract-name occurrences before the matching close-bracket.
    let scanFrom = 0;
    while (true) {
      const arrIdx = line.indexOf('[', scanFrom);
      const objIdx = line.indexOf('{', scanFrom);
      // Pick the nearest open-bracket on this line; bail if neither.
      let openIdx: number;
      let openCh: '[' | '{';
      let closeCh: ']' | '}';
      if (arrIdx === -1 && objIdx === -1) break;
      if (arrIdx === -1) { openIdx = objIdx; openCh = '{'; closeCh = '}'; }
      else if (objIdx === -1) { openIdx = arrIdx; openCh = '['; closeCh = ']'; }
      else if (arrIdx < objIdx) { openIdx = arrIdx; openCh = '['; closeCh = ']'; }
      else { openIdx = objIdx; openCh = '{'; closeCh = '}'; }

      let scan = line.slice(openIdx);
      let extraLines = 0;
      const maxLookahead = openCh === '{' ? 12 : 5;
      while (!scan.includes(closeCh) && i + extraLines < lines.length - 1 && extraLines < maxLookahead) {
        extraLines++;
        scan += '\n' + lines[i + extraLines];
      }
      const closeIdx = scan.indexOf(closeCh);
      const literalContent = closeIdx >= 0 ? scan.slice(0, closeIdx + 1) : scan;
      // Skip if the literal spans an allow marker on any of its lines.
      let allowed = false;
      for (let j = i; j <= i + extraLines && j < lines.length; j++) {
        if (lines[j]!.includes('hardcoded-contracts:allow:')) {
          allowed = true;
          break;
        }
      }
      if (allowed) {
        scanFrom = openIdx + 1;
        continue;
      }
      // Match contract names as either:
      //   array form: `'ReceiptRegistry'` or `"ReceiptRegistry"`
      //   object form: `ReceiptRegistry:` (bare identifier followed by `:`)
      const matched = new Set<string>();
      const stringLiteralRe = /['"]([A-Za-z][A-Za-z0-9_]+)['"]/g;
      for (const m of literalContent.matchAll(stringLiteralRe)) {
        if (CONTRACT_NAME_SET.has(m[1]!)) matched.add(m[1]!);
      }
      const objKeyRe = /(?:^|[\s,{])([A-Z][A-Za-z0-9_]+)\s*:/g;
      for (const m of literalContent.matchAll(objKeyRe)) {
        if (CONTRACT_NAME_SET.has(m[1]!)) matched.add(m[1]!);
      }
      if (matched.size >= 3) {
        hits.push({
          file: relPath,
          line: i + 1,
          matchedNames: Array.from(matched).sort(),
          context: line.trim().slice(0, 140),
        });
        break; // one hit per starting line is enough
      }
      scanFrom = openIdx + 1;
    }
  }
}

if (hits.length > 0) {
  console.error(`\nFAIL: ${hits.length} hardcoded contract-name list(s):`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line} · matched [${h.matchedNames.join(', ')}]`);
    console.error(`    ${h.context}`);
  }
  console.error('');
  console.error('Why this fails:');
  console.error('  Hardcoded contract-name enumerations silently miss V2 deploys.');
  console.error('  Sweeps 56 (doctor) + 59 (debug chain) caught the exact same drift.');
  console.error('');
  console.error('Resolution:');
  console.error('  Replace the hardcoded array with:');
  console.error('    const deployments = loadDeployments(network);');
  console.error('    const names = Object.keys(deployments.contracts).sort();');
  console.error('  This auto-derives from contracts/deployments/*.json so future deploys');
  console.error('  surface automatically.');
  console.error('');
  console.error('  OR add `hardcoded-contracts:allow:<reason>` on the line for an');
  console.error('  intentional, documented exception (e.g. SKILL_TYPES enum, test');
  console.error('  fixtures with specific contract subset).');
  process.exit(1);
}

ok(`no hardcoded contract-name lists across ${allFiles.length} files`);
console.log(`\n${asserts}/${asserts} assertions passed`);
process.exit(0);
