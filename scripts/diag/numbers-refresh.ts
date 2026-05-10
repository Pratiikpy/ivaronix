/**
 * Refresh `docs/numbers.json` from canonical sources:
 *   - receipts: chain reads against ReceiptRegistry + ReceiptRegistryV2
 *   - skills:   filesystem walk of `seed-skills/`
 *   - packages: pnpm workspace introspection
 *   - receiptTypes: parse `packages/core/src/types.ts` for the RECEIPT_TYPES const
 *
 * Closes planning-003 §A.2.7 first cut. The auto-render pipeline (substitution
 * via `<!-- numbers:auto:KEY -->` markers in markdown) is queued — see USER_TODO
 * §B-V2-8 for the complete pipeline + CI 24h-staleness gate.
 *
 * Usage:
 *   pnpm numbers:refresh           # writes to docs/numbers.json
 *   pnpm numbers:refresh --print   # prints to stdout, no file write
 *   pnpm numbers:refresh --check   # exits 1 if numbers.json is > 24h stale
 */
import { JsonRpcProvider } from 'ethers';
import { ReceiptRegistryClient, ReceiptRegistryV2Client, getDeployedAddress } from '@ivaronix/og-chain';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE = scripts/diag → REPO_ROOT = scripts/diag/../../ (planning-003 §A.5.6 reorg).
const REPO_ROOT = resolve(HERE, '..', '..');
const NUMBERS_PATH = resolve(REPO_ROOT, 'docs/numbers.json');

interface NumbersFile {
  $schema: string;
  lastRefreshed: string;
  network: string;
  receipts: { v1Anchored: number; v2Anchored: number; total: number; headlineLabel: string };
  receiptTypes: { count: number; labels: string[]; source: string };
  contracts: { deployed: number; foundryTests: number; list: string[]; addresses: Record<string, string> };
  skills: {
    firstParty: number;
    firstPartyList: string[];
    vendored: number;
    catalogTotal: number;
    creatorEarningsOG: string;
    creatorEarningsLabel: string;
  };
  packages: { workspaceTotal: number; apps: number; typecheckClean: number; appsList: string[] };
  polyglotHash: { languages: number; languageList: string[]; tests: Record<string, number>; ciWorkflow: string; queued: string[] };
  mainnet: { readinessChecklistGreen: string; deployedContractsToday: number; blockedOn: string };
}

async function fetchReceiptCounts(): Promise<{ v1: number; v2: number; total: number }> {
  const RPC = 'https://evmrpc-testnet.0g.ai';
  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'galileo' });
  const v1Addr = getDeployedAddress('testnet', 'ReceiptRegistry') as `0x${string}` | null | undefined;
  const v2Addr = getDeployedAddress('testnet', 'ReceiptRegistryV2') as `0x${string}` | null | undefined;
  let v1NextId = 0n;
  let v2NextId = 0n;
  if (v1Addr) {
    try {
      const v1 = new ReceiptRegistryClient(v1Addr, provider);
      v1NextId = await v1.nextId();
    } catch (err) {
      console.warn(`v1.nextId() failed: ${(err as Error).message}`);
    }
  }
  if (v2Addr) {
    try {
      const v2 = new ReceiptRegistryV2Client(v2Addr, provider);
      v2NextId = await v2.nextId();
    } catch (err) {
      console.warn(`v2.nextId() failed: ${(err as Error).message}`);
    }
  }
  // V1 + V2 both 1-indexed: anchored = nextId - 1.
  const v1Anchored = Math.max(0, Number(v1NextId) - 1);
  const v2Anchored = Math.max(0, Number(v2NextId) - 1);
  return { v1: v1Anchored, v2: v2Anchored, total: v1Anchored + v2Anchored };
}

function listFirstPartySkills(): string[] {
  const dir = resolve(REPO_ROOT, 'seed-skills');
  return readdirSync(dir)
    .filter((entry) => {
      // Only directories, and skip the `imports/` housekeeping dir.
      if (entry === 'imports') return false;
      try {
        return statSync(resolve(dir, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function listApps(): string[] {
  const dir = resolve(REPO_ROOT, 'apps');
  return readdirSync(dir)
    .filter((entry) => {
      try {
        return statSync(resolve(dir, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function listWorkspacePackages(): string[] {
  const dir = resolve(REPO_ROOT, 'packages');
  return readdirSync(dir)
    .filter((entry) => {
      try {
        return statSync(resolve(dir, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Count workspace projects (packages + apps) that have a real
 * `typecheck` script in their package.json — i.e. one that runs `tsc`
 * (or equivalent) rather than `echo skip`. Static count, no actual
 * `tsc` invocation; deletes / additions of project dirs reflect
 * automatically. Closes the cron-sweep gap on 2026-05-10 where
 * `typecheckClean` was a hand-frozen value preserved across refreshes.
 */
function countTypecheckClean(): number {
  let count = 0;
  for (const subdir of ['packages', 'apps']) {
    const root = resolve(REPO_ROOT, subdir);
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const pkgPath = resolve(root, entry, 'package.json');
      if (!existsSync(pkgPath)) continue;
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
        const tc = pkg.scripts?.typecheck ?? '';
        // Real typechecks invoke tsc / tsc -b / tsc --noEmit; the
        // `echo skip` placeholders don't count. opencode-bin's typecheck
        // currently echoes a status message about needing port work
        // (1267 first-round tsc errors); that doesn't count either.
        if (/\btsc\b/.test(tc)) count += 1;
      } catch {
        // Malformed package.json — skip silently.
      }
    }
  }
  return count;
}

function parseReceiptTypes(): { count: number; labels: string[] } {
  const tsPath = resolve(REPO_ROOT, 'packages/core/src/types.ts');
  const src = readFileSync(tsPath, 'utf8');
  const match = src.match(/RECEIPT_TYPES\s*=\s*\{([\s\S]*?)\}\s*as\s+const/);
  if (!match) return { count: 0, labels: [] };
  const body = match[1] ?? '';
  const labels: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*([a-z_]+)\s*:\s*\d+\s*,?\s*$/);
    if (m && m[1]) labels.push(m[1]);
  }
  return { count: labels.length, labels };
}

/**
 * Count keys in `deployments/testnet.json`'s `contracts` object. Same
 * anti-staleness rationale as countTypecheckClean: the value previously
 * preserved verbatim across refreshes, drifting silently when contracts
 * were added (V2 migration) or removed.
 */
function countDeployedContracts(): number {
  return Object.keys(readDeployments().contracts).length;
}

interface Deployments { contracts: Record<string, { address: string }> }

function readDeployments(): Deployments {
  // Canonical location: contracts/deployments/<network>.json (matches docs +
  // packages/og-chain/src/deployments.ts walk-up). Legacy fallback retained
  // for transition; will warn if used.
  const canonical = resolve(REPO_ROOT, 'contracts', 'deployments', 'testnet.json');
  const legacy = resolve(REPO_ROOT, 'deployments', 'testnet.json');
  const path = existsSync(canonical) ? canonical : legacy;
  if (!existsSync(path)) return { contracts: {} };
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Deployments;
  } catch {
    return { contracts: {} };
  }
}

/**
 * Count test cases for the polyglot canonical-hash references. Each
 * language uses a different test-runner convention, so we grep for the
 * convention's marker:
 *   TS:     `test('…', …)` calls in `packages/core/src/jcs.test.ts`
 *           (Node's built-in `node:test` runner).
 *   Python: `def test_` in `scripts/verifier-py/test_jcs.py`.
 *   Rust:   `#[test]` attributes in `ivaronix-verifier-rs/src/lib.rs`.
 */
function countPolyglotTests(): { ts: number; python: number; rust: number } {
  const tsPath = resolve(REPO_ROOT, 'packages', 'core', 'src', 'jcs.test.ts');
  const pyPath = resolve(REPO_ROOT, 'scripts', 'verifier-py', 'test_jcs.py');
  const rsPath = resolve(REPO_ROOT, 'ivaronix-verifier-rs', 'src', 'lib.rs');
  const ts = existsSync(tsPath) ? (readFileSync(tsPath, 'utf8').match(/^\s*test\(/gm) ?? []).length : 0;
  const python = existsSync(pyPath) ? (readFileSync(pyPath, 'utf8').match(/^\s*def test_/gm) ?? []).length : 0;
  const rust = existsSync(rsPath) ? (readFileSync(rsPath, 'utf8').match(/^\s*#\[test\]/gm) ?? []).length : 0;
  return { ts, python, rust };
}

/**
 * Count Foundry tests by grepping `function test_` markers across every
 * `.t.sol` file in `contracts/test/`. Static count, no `forge test`
 * invocation (which would 30+ seconds per refresh). Drift driver:
 * every V2 contract migration ships its own `.t.sol` file (planning-003
 * §A.5.9–§A.5.12 added 4×; without auto-derivation, the headline
 * "121/121 Foundry tests" claim drifted to 167 actual tests by the time
 * the V2 work landed).
 *
 * Note: this counts `function test_…()` only. Foundry also accepts
 * `function testFuzz_` (fuzz tests) and `function invariant_`
 * (invariant tests); our `.t.sol` files don't use those today, so the
 * simple regex covers all current cases. If we add fuzz/invariant
 * tests, extend the regex to `/function (test_|testFuzz_|invariant_)/`.
 */
function countFoundryTests(): number {
  const dir = resolve(REPO_ROOT, 'contracts', 'test');
  if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).filter((f) => f.endsWith('.t.sol'));
  let count = 0;
  for (const f of files) {
    const src = readFileSync(resolve(dir, f), 'utf8');
    count += (src.match(/function test_/g) ?? []).length;
  }
  return count;
}

/**
 * Count vendored skills under `seed-skills/imports/` (each sub-directory
 * is one community-imported skill). Drift driver: every PR that imports
 * a new skill from `awesome-claude-skills/` adds a sub-dir here. Without
 * auto-derivation, the headline "156 skills in catalog" claim drifts the
 * moment a new import lands.
 */
function countVendoredSkills(): number {
  const dir = resolve(REPO_ROOT, 'seed-skills', 'imports');
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((entry) => {
    try {
      return statSync(resolve(dir, entry)).isDirectory();
    } catch {
      return false;
    }
  }).length;
}

/**
 * Count entries in the `VECTORS: list = [...]` block in
 * `scripts/verifier-py/cross_check.py`. Each entry is one byte-equality
 * test vector across TS / Python / Rust. The count drifts when test
 * vectors are added (e.g. a new edge case found by an audit) — without
 * auto-derivation, the README's "29/29 byte-equal" claim goes stale.
 *
 * Python list bodies can contain nested objects, so we walk character-
 * by-character with a depth counter and split on commas at depth 0.
 */
function countCrossImplVectors(): number {
  const path = resolve(REPO_ROOT, 'scripts', 'verifier-py', 'cross_check.py');
  if (!existsSync(path)) return 0;
  const src = readFileSync(path, 'utf8');
  const match = src.match(/VECTORS\s*:\s*list\s*=\s*\[([\s\S]*?)\n\]/);
  if (!match) return 0;
  const body = match[1] ?? '';
  let depth = 0;
  let entries = 0;
  let started = false;
  for (const ch of body) {
    if (ch === '[' || ch === '{' || ch === '(') {
      depth++;
      started = true;
    } else if (ch === ']' || ch === '}' || ch === ')') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      if (started) {
        entries++;
        started = false;
      }
    } else if (!/\s/.test(ch)) {
      started = true;
    }
  }
  if (started) entries++;
  return entries;
}

async function buildSnapshot(): Promise<NumbersFile> {
  const [receipts] = await Promise.all([fetchReceiptCounts()]);
  const firstPartySkills = listFirstPartySkills();
  const apps = listApps();
  const packageDirs = listWorkspacePackages();
  const receiptTypes = parseReceiptTypes();

  const today = new Date().toISOString().slice(0, 10);

  // Pull existing snapshot for fields we don't auto-derive (e.g. foundry test
  // count requires a full forge invocation; vendored skill count depends on
  // catalog scrape; creator earnings come from chainscan event filters).
  const existing: NumbersFile = JSON.parse(readFileSync(NUMBERS_PATH, 'utf8'));

  return {
    $schema: existing.$schema,
    lastRefreshed: today,
    network: existing.network,
    receipts: {
      v1Anchored: receipts.v1,
      v2Anchored: receipts.v2,
      total: receipts.total,
      headlineLabel: `${receipts.total.toLocaleString()}+ receipts anchored across V1 + V2 registries`,
    },
    receiptTypes: {
      count: receiptTypes.count,
      labels: receiptTypes.labels,
      source: existing.receiptTypes.source,
    },
    contracts: (() => {
      // Auto-derive list + addresses from contracts/deployments/testnet.json
      // so all three fields (deployed, list, addresses) update together
      // when new contracts deploy. Hand-frozen list drifted in cron-sweep
      // 2026-05-10: numbers.json contracts.list claimed SubscriptionEscrow
      // was deployed (it is not), and was MISSING MemoryAccessLog (which
      // is). Caught by the verify-numbers-vs-deployments regression.
      const dep = readDeployments();
      const list = Object.keys(dep.contracts).sort();
      const addresses: Record<string, string> = {};
      for (const name of list) {
        addresses[name] = dep.contracts[name]!.address;
      }
      return {
        deployed: list.length,
        // Auto-derived from `function test_` markers across contracts/test/*.t.sol
        // so V2 migration test additions reflect without invoking `forge test`.
        foundryTests: countFoundryTests(),
        list,
        addresses,
      };
    })(),
    skills: (() => {
      // Auto-derive vendored count from filesystem; the original
      // hand-frozen value drifted whenever a new import landed without
      // a matching numbers.json edit (cron-sweep finding · 2026-05-10).
      const vendored = countVendoredSkills();
      return {
        firstParty: firstPartySkills.length,
        firstPartyList: firstPartySkills,
        vendored,
        catalogTotal: firstPartySkills.length + vendored,
        creatorEarningsOG: existing.skills.creatorEarningsOG,
        creatorEarningsLabel: existing.skills.creatorEarningsLabel,
      };
    })(),
    packages: {
      workspaceTotal: packageDirs.length + apps.length,
      apps: apps.length,
      typecheckClean: countTypecheckClean(),
      appsList: apps,
    },
    polyglotHash: {
      ...existing.polyglotHash,
      // Auto-derived from each language's test-runner convention so
      // adding a new test in any of the 3 languages reflects without
      // hand-editing. Same anti-staleness rationale as
      // countTypecheckClean (cron-sweep finding · 2026-05-10).
      // crossImplVectors counts entries in the VECTORS list of
      // scripts/verifier-py/cross_check.py.
      tests: {
        ...existing.polyglotHash.tests,
        ...countPolyglotTests(),
        crossImplVectors: countCrossImplVectors(),
      },
    },
    mainnet: existing.mainnet,
  };
}

async function main(): Promise<void> {
  const flags = new Set(process.argv.slice(2));
  if (flags.has('--check')) {
    const cur: NumbersFile = JSON.parse(readFileSync(NUMBERS_PATH, 'utf8'));
    const ageMs = Date.now() - new Date(cur.lastRefreshed).getTime();
    const ageHours = ageMs / 3_600_000;
    if (ageHours > 24) {
      console.error(`numbers.json is ${ageHours.toFixed(1)}h old · re-run pnpm numbers:refresh`);
      process.exit(1);
    }
    console.log(`numbers.json is ${ageHours.toFixed(1)}h old · within 24h window ✓`);
    return;
  }

  const snap = await buildSnapshot();
  const out = JSON.stringify(snap, null, 2) + '\n';

  if (flags.has('--print')) {
    process.stdout.write(out);
    return;
  }

  writeFileSync(NUMBERS_PATH, out);
  console.log(`numbers.json refreshed · ${NUMBERS_PATH}`);
  console.log(`  receipts.total          ${snap.receipts.total.toLocaleString()}`);
  console.log(`  receipts.v1Anchored     ${snap.receipts.v1Anchored.toLocaleString()}`);
  console.log(`  receipts.v2Anchored     ${snap.receipts.v2Anchored.toLocaleString()}`);
  console.log(`  receiptTypes.count      ${snap.receiptTypes.count}`);
  console.log(`  skills.firstParty       ${snap.skills.firstParty}`);
  console.log(`  skills.catalogTotal     ${snap.skills.catalogTotal}`);
  console.log(`  packages.workspaceTotal ${snap.packages.workspaceTotal}`);
  console.log(`  packages.apps           ${snap.packages.apps}`);
}

main().catch((err) => {
  console.error('numbers-refresh failed:', err);
  process.exit(1);
});
