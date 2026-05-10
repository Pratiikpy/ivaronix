/**
 * Source-file regression orchestrator. Runs every `verify-*.ts` script
 * in `scripts/qa/metamask-e2e/` that does NOT require network or browser
 * access (i.e. excludes `run.ts` itself + `verify-v2-anchor-live.ts`),
 * captures pass/fail, exits non-zero on any failure.
 *
 * Closes planning-003 §A.1.4 — wires the existing `verify-*` regressions
 * into a single test entry point so:
 *   1. `pnpm --filter qa-metamask-e2e run regressions` runs everything.
 *   2. `pnpm --filter @ivaronix/studio test` (after wiring) calls this
 *      and the Studio package gets a real `test` target instead of
 *      `echo skip`.
 *   3. CI gates on the orchestrator's exit code.
 *
 * Usage:
 *   tsx run-source-regressions.ts          # all regressions
 *   tsx run-source-regressions.ts --filter studio   # only Studio-related
 *   tsx run-source-regressions.ts --filter cli      # only CLI-related
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Filter {
  label: string;
  patterns: RegExp[];
}

const FILTERS: Record<string, Filter> = {
  all: {
    label: 'all source-file regressions',
    patterns: [/^verify-/],
  },
  studio: {
    // Pure source-file regressions — no Studio dev server required. Used
    // by `apps/studio/package.json` `test` target so CI can gate without
    // standing up the full dev environment.
    label: 'Studio source-file regressions (offline)',
    patterns: [
      /^verify-a11/, // form/schema enum
      /^verify-a13/, // Studio V2-first
      /^verify-a22/, // README screenshot grid (planning-003 §A.2.2)
      /^verify-a27/, // markdown auto-render pipeline (planning-003 §A.2.7)
      /^verify-a43/, // audit:list regex (cron-sweep finding · accepts WT 26 shape)
      /^verify-a44/, // Efficiency-Game UI (planning-003 §A.4.4)
      /^verify-a48/, // memory routes (planning-003 §A.4.8)
      /^verify-no-sprint-natspec/, // CLAUDE.md §9 · no K-N fix / Phase / sprint in contract NatSpec
      /^verify-brand-token-drift/, // CLAUDE.md §10 · hex literals must be in brand/tokens.json (or amnesty)
      /^verify-no-bare-require-esm/, // meta · bare require() inside ESM packages throws ReferenceError at runtime
      /^verify-deployments-path-canonical/, // §15 bookkeeping · docs reference contracts/deployments/ post-fb3db59 move
      /^verify-pnpm-scripts-exist/, // meta · every pnpm <verb> in CI + package.json resolves to a real script
      /^verify-numbers-vs-deployments/, // numbers.json contracts.* must match contracts/deployments/testnet.json
      /^verify-env-template-completeness/, // §15 · every IVARONIX_* var in code is in at least one env template
      /^verify-receipt-types-three-way/, // source enum ↔ RECEIPTS_SPEC ↔ numbers.json triangle stays in sync
    ],
  },
  'studio-live': {
    // Studio regressions that require a running dev server on :3300 +
    // configured env. Run locally before merging Studio changes:
    //   pnpm --filter @ivaronix/studio dev   # in one terminal
    //   pnpm --filter qa-metamask-e2e run regressions -- --filter studio-live
    label: 'Studio live regressions (requires localhost:3300)',
    patterns: [
      /^verify-s2/, // light gating on /r/[id]
      /^verify-s3/, // RunPanel pending
      /^verify-i1/, // VERIFIED chip
      /^verify-i2-k16/, // Burn Mode
      /^verify-k8-k9/, // SIWE auth on /api/run + /api/skill/save
    ],
  },
  cli: {
    label: 'CLI-related regressions',
    patterns: [
      /^verify-a12/, // CLI V2-first
      /^verify-s4/, // delegate exit code
      /^verify-h2/, // processResponse third arg
      /^verify-h1-h4/, // attestation + memoryClient
    ],
  },
  contracts: {
    label: 'Contract regressions',
    patterns: [
      /^verify-k1-passport-v2/,
      /^verify-k2-registry-v2/,
    ],
  },
};

// Exclude scripts that need network or browser access.
const NETWORK_DEPENDENT = new Set<string>([
  'verify-v2-anchor-live.ts', // needs Galileo RPC
]);

// `run.ts` is the Playwright MetaMask E2E, also browser-dependent.
const BROWSER_DEPENDENT = new Set<string>([
  'run.ts',
]);

function parseFilter(): Filter {
  const idx = process.argv.indexOf('--filter');
  if (idx < 0) return FILTERS.all!;
  const name = process.argv[idx + 1];
  if (!name || !FILTERS[name]) {
    console.error(`unknown filter: ${name}. Valid: ${Object.keys(FILTERS).join(', ')}`);
    process.exit(2);
  }
  return FILTERS[name]!;
}

function listRegressionScripts(filter: Filter): string[] {
  const all = readdirSync(HERE).filter((f) => {
    if (!f.endsWith('.ts')) return false;
    if (NETWORK_DEPENDENT.has(f)) return false;
    if (BROWSER_DEPENDENT.has(f)) return false;
    if (f === basename(fileURLToPath(import.meta.url))) return false;
    return filter.patterns.some((p) => p.test(f));
  });
  return all.sort();
}

function runOne(file: string): { file: string; pass: boolean; output: string } {
  const result = spawnSync('pnpm', ['exec', 'tsx', file], {
    cwd: HERE,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const pass = result.status === 0;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { file, pass, output };
}

function main(): void {
  const filter = parseFilter();
  const scripts = listRegressionScripts(filter);
  console.log(`\n[regressions] ${filter.label} · ${scripts.length} scripts\n`);
  const results: Array<{ file: string; pass: boolean; output: string }> = [];
  for (const s of scripts) {
    process.stdout.write(`  RUN  ${s.padEnd(50)} `);
    const r = runOne(s);
    process.stdout.write(r.pass ? 'PASS\n' : 'FAIL\n');
    results.push(r);
  }
  const failed = results.filter((r) => !r.pass);
  console.log();
  if (failed.length === 0) {
    console.log(`[regressions] all ${results.length} passed`);
    process.exit(0);
  }
  console.log(`[regressions] ${failed.length} of ${results.length} failed:\n`);
  for (const f of failed) {
    console.log(`──────── ${f.file} ────────`);
    console.log(f.output);
  }
  process.exit(1);
}

main();
