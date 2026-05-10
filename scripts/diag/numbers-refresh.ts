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
    contracts: {
      ...existing.contracts,
    },
    skills: {
      firstParty: firstPartySkills.length,
      firstPartyList: firstPartySkills,
      vendored: existing.skills.vendored,
      catalogTotal: firstPartySkills.length + existing.skills.vendored,
      creatorEarningsOG: existing.skills.creatorEarningsOG,
      creatorEarningsLabel: existing.skills.creatorEarningsLabel,
    },
    packages: {
      workspaceTotal: packageDirs.length + apps.length,
      apps: apps.length,
      typecheckClean: countTypecheckClean(),
      appsList: apps,
    },
    polyglotHash: existing.polyglotHash,
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
