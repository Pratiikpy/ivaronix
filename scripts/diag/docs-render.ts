/**
 * Render `<!-- numbers:auto:KEY -->VALUE<!-- /numbers:auto:KEY -->` markers
 * in markdown docs against the canonical `docs/numbers.json` source of
 * truth.
 *
 * Closes the markdown-render half of planning-003 §A.2.7 (the numbers
 * + skills consolidation; numeric claims drift across README + PITCH +
 * JUDGE_GUIDE + MAINNET_READINESS without a render pass).
 *
 * Marker shape:
 *   <!-- numbers:auto:KEY -->ANYTHING<!-- /numbers:auto:KEY -->
 *
 * The script replaces ANYTHING (between the open + close markers) with
 * the resolved value of `KEY` from numbers.json. Dotted paths walk the
 * JSON structure: `receipts.headlineLabel`, `contracts.deployed`,
 * `polyglotHash.tests.ts`.
 *
 * Two scaffolded render targets:
 *   <!-- numbers:auto:receipts.total -->1,644+<!-- /numbers:auto:receipts.total -->
 *   <!-- numbers:auto:contracts.deployed -->8<!-- /numbers:auto:contracts.deployed -->
 *
 * Usage:
 *   pnpm docs:render            # render in-place
 *   pnpm docs:render --check    # CI gate · exit 1 on drift OR stale numbers.json
 *
 * The --check mode also enforces a 24h staleness window: if numbers.json's
 * `lastRefreshed` is more than 24h behind today, exits 1 so CI catches
 * stale stats before they ship.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const NUMBERS_PATH = resolve(REPO_ROOT, 'docs', 'numbers.json');
const DEPLOYMENTS_PATH = resolve(REPO_ROOT, 'contracts', 'deployments', 'testnet.json');
const MAINNET_DEPLOYMENTS_PATH = resolve(REPO_ROOT, 'contracts', 'deployments', 'mainnet.json');

/**
 * Markdown docs that consume `<!-- numbers:auto:KEY -->` markers.
 * Filtered to docs that exist in the tree — internal MDs may be
 * gitignored on a contributor's checkout and skipping them keeps the
 * render pass idempotent rather than crashing on a missing target.
 */
const TARGET_DOCS_CANDIDATES = [
  'README.md',
  'docs/PITCH.md',
  'docs/JUDGE_GUIDE.md',
  'docs/MAINNET_READINESS.md',
];
const TARGET_DOCS = TARGET_DOCS_CANDIDATES.filter((p) => existsSync(resolve(REPO_ROOT, p)));

const STALENESS_HOURS = 24;

interface CliOpts {
  check: boolean;
}

function parseArgs(argv: string[]): CliOpts {
  return { check: argv.includes('--check') };
}

function lookupValue(json: Record<string, unknown>, key: string): string | null {
  const parts = key.split('.');
  let cur: unknown = json;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur === null || cur === undefined) return null;
  if (typeof cur === 'string' || typeof cur === 'number' || typeof cur === 'boolean') return String(cur);
  // Don't try to render arrays/objects — only leaf values.
  return null;
}

const MARKER = /<!--\s*numbers:auto:([\w.]+)\s*-->([\s\S]*?)<!--\s*\/numbers:auto:\1\s*-->/g;

// Block-level marker for auto-generated contracts table. Pulls
// directly from contracts/deployments/testnet.json so the table can
// never drift from the canonical address record. Each row carries the
// chainscan link inline; V1/V2 rows get a context tag pulled from the
// deployments file's `note` field (truncated for table density).
const CONTRACTS_BLOCK = /<!--\s*contracts:auto:start\s*-->([\s\S]*?)<!--\s*contracts:auto:end\s*-->/g;
const CONTRACTS_MAINNET_BLOCK = /<!--\s*contracts:auto:mainnet:start\s*-->([\s\S]*?)<!--\s*contracts:auto:mainnet:end\s*-->/g;

interface ContractEntry { address: string; explorer: string; note?: string }
interface DeploymentManifest { contracts: Record<string, ContractEntry> }

function loadDeployments(): DeploymentManifest {
  return JSON.parse(readFileSync(DEPLOYMENTS_PATH, 'utf8')) as DeploymentManifest;
}

function shortNote(note: string | undefined): string {
  if (!note) return '';
  // Strip internal sprint labels so the rendered public table reads as
  // a clean capability description. The underlying deployment JSON
  // keeps the audit trail; the table the readers see does not need it.
  let cleaned = note
    .replace(/^V\d;\s*/, '')
    .replace(/^(K-\d+(\s*[+,]\s*K-\d+)*\s*(fix|fix·|closure)?\s*[·—]?\s*)/i, '')
    .replace(/^(B-V\d+-\d+(\s+fix)?\s*[·—]?\s*)/i, '')
    .replace(/^FINAL_BUILD_PLAN\.md\s+(Block\s+\w+(\.\d+)?\s*[·—]?\s*)?/i, '')
    .replace(/planning-\d+\s+§[\w.]+\s*/gi, '')
    .replace(/HALF_BAKED\.md\s+§?K-\d+\s*(fix|DoS fix)?\s*/gi, '')
    .replace(/USER_TODO\.md\s+§?[\w-]+\s*/gi, '')
    .replace(/See\s+HALF_BAKED\.md.*$/i, '')
    .replace(/Closes\s+USER_TODO\.md.*$/i, '')
    .replace(/iter-\d+\s+of\s+cron\s+\w+\s+run.*$/i, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  let snippet = cleaned.split(/[.·—]/)[0] ?? '';
  snippet = snippet.trim();
  if (snippet.length > 80) snippet = snippet.slice(0, 77) + '…';
  return snippet ? ` — ${snippet}` : '';
}

function renderContractsTable(): string {
  const m = loadDeployments();
  // Stable order: V1 then V2 of the same family adjacent, then the
  // standalone supports. Sort alphabetically — V2 sorts after V1
  // automatically because the suffix is appended.
  const names = Object.keys(m.contracts).sort();
  const lines: string[] = [
    '',
    '| Contract              | Address                                                                                                                                            |',
    '|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|',
  ];
  for (const name of names) {
    const c = m.contracts[name]!;
    const nameCell = `\`${name}\``.padEnd(22);
    const cell = `[\`${c.address}\`](${c.explorer})${shortNote(c.note)}`;
    lines.push(`| ${nameCell} | ${cell} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderContractsBlocks(source: string): { rendered: string; replacements: number } {
  let replacements = 0;
  let rendered = source.replace(CONTRACTS_BLOCK, () => {
    replacements++;
    return `<!-- contracts:auto:start -->${renderContractsTable()}<!-- contracts:auto:end -->`;
  });
  rendered = rendered.replace(CONTRACTS_MAINNET_BLOCK, () => {
    replacements++;
    return `<!-- contracts:auto:mainnet:start -->${renderMainnetContractsTable()}<!-- contracts:auto:mainnet:end -->`;
  });
  return { rendered, replacements };
}

interface MainnetContractEntry { address: string; txHash?: string }
interface MainnetDeploymentManifest { contracts: Record<string, MainnetContractEntry>; deployedAt?: string }

function loadMainnetDeployments(): MainnetDeploymentManifest {
  try {
    return JSON.parse(readFileSync(MAINNET_DEPLOYMENTS_PATH, 'utf8')) as MainnetDeploymentManifest;
  } catch {
    return { contracts: {} };
  }
}

function renderMainnetContractsTable(): string {
  const m = loadMainnetDeployments();
  const names = Object.keys(m.contracts).sort();
  if (names.length === 0) {
    return '\n\n_Mainnet contracts not yet deployed._\n\n';
  }
  const lines: string[] = [
    '',
    '| Contract              | Address                                                                                                                                            |',
    '|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|',
  ];
  for (const name of names) {
    const c = m.contracts[name]!;
    const explorer = `https://chainscan.0g.ai/address/${c.address}`;
    const nameCell = `\`${name}\``.padEnd(22);
    const cell = `[\`${c.address}\`](${explorer})`;
    lines.push(`| ${nameCell} | ${cell} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderDoc(source: string, numbers: Record<string, unknown>): { rendered: string; replacements: number; misses: string[] } {
  const misses: string[] = [];
  let replacements = 0;
  const rendered = source.replace(MARKER, (full, key: string, _existing: string) => {
    const value = lookupValue(numbers, key);
    if (value === null) {
      misses.push(key);
      return full; // leave as-is; the misses list will be reported
    }
    replacements++;
    return `<!-- numbers:auto:${key} -->${value}<!-- /numbers:auto:${key} -->`;
  });
  return { rendered, replacements, misses };
}

function checkStaleness(numbers: Record<string, unknown>): { stale: boolean; ageHours: number } {
  const stamp = numbers.lastRefreshed;
  if (typeof stamp !== 'string') return { stale: true, ageHours: Infinity };
  const ts = Date.parse(stamp);
  if (Number.isNaN(ts)) return { stale: true, ageHours: Infinity };
  const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
  return { stale: ageHours > STALENESS_HOURS, ageHours };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const numbersRaw = readFileSync(NUMBERS_PATH, 'utf8');
  const numbers = JSON.parse(numbersRaw) as Record<string, unknown>;

  let drifted = false;
  let totalReplacements = 0;
  let totalMisses = 0;

  for (const rel of TARGET_DOCS) {
    const path = resolve(REPO_ROOT, rel);
    let source: string;
    try {
      source = readFileSync(path, 'utf8');
    } catch {
      console.warn(`SKIP: ${rel} not found`);
      continue;
    }
    const numbersResult = renderDoc(source, numbers);
    const contractsResult = renderContractsBlocks(numbersResult.rendered);
    const rendered = contractsResult.rendered;
    const replacements = numbersResult.replacements + contractsResult.replacements;
    const misses = numbersResult.misses;
    totalReplacements += replacements;
    totalMisses += misses.length;
    if (replacements === 0 && misses.length === 0) continue;
    if (rendered !== source) {
      if (opts.check) {
        console.error(`DRIFT: ${rel} (${replacements} markers out of date — run \`pnpm docs:render\`)`);
        drifted = true;
      } else {
        writeFileSync(path, rendered, 'utf8');
        console.log(`OK: ${rel} (${replacements} marker(s) rendered)`);
      }
    } else if (replacements > 0) {
      console.log(`OK: ${rel} (${replacements} marker(s) already in sync)`);
    }
    if (misses.length > 0) {
      for (const k of misses) console.warn(`  WARN: ${rel} references unknown numbers key: ${k}`);
    }
  }

  if (opts.check) {
    const { stale, ageHours } = checkStaleness(numbers);
    if (stale) {
      console.error(`DRIFT: docs/numbers.json is ${ageHours.toFixed(1)}h old (max ${STALENESS_HOURS}h). Run \`pnpm numbers:refresh\` to refresh against live chain.`);
      drifted = true;
    } else {
      console.log(`OK: docs/numbers.json is ${ageHours.toFixed(1)}h old (max ${STALENESS_HOURS}h)`);
    }
  }

  console.log('');
  console.log(`${totalReplacements} marker(s) checked across ${TARGET_DOCS.length} target docs · ${totalMisses} unknown-key warning(s).`);

  if (opts.check && drifted) process.exit(1);
}

main();
