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

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const NUMBERS_PATH = resolve(REPO_ROOT, 'docs', 'numbers.json');

/** Markdown docs that consume `<!-- numbers:auto:KEY -->` markers. */
const TARGET_DOCS = [
  'README.md',
  'docs/PITCH.md',
  'docs/JUDGE_GUIDE.md',
  'docs/MAINNET_READINESS.md',
];

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
    const { rendered, replacements, misses } = renderDoc(source, numbers);
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
