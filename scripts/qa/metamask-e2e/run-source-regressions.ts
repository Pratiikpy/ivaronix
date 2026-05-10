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
      /^verify-no-bare-numbers-in-rendered-docs/, // every numbers.json value (>= 100) in target docs lives inside a numbers:auto marker
      /^verify-agents-md-canonical-aliases/, // §15 · AGENTS.md leads with canonical IVARONIX_* (not legacy alias)
      /^verify-no-orphan-regressions/, // meta · every verify-*.ts is wired to a domain filter
      /^verify-no-hardcoded-contract-lists/, // meta · 3+ contract names in one array literal · iterate loadDeployments instead
      /^verify-no-frozen-lockfile-bypass/, // meta · CI workflows must use strict --frozen-lockfile (sweep 74)
      /^verify-no-ci-suppress-exit/, // meta · no '|| true' / 'continue-on-error: true' silent-failure suppressions (sweep 75)
      /^verify-no-ts-ignore-first-party/, // meta · no @ts-ignore / @ts-nocheck / bare @ts-expect-error in first-party code (sweep 83)
      /^verify-as-any-budget/, // meta · 'as any' cast budget (max 3) in first-party code (sweep 84)
      /^verify-no-tracked-but-ignored/, // meta · no tracked file matches a gitignore rule (sweep 86 · third occurrence pattern closure)
      /^verify-markdown-internal-links/, // meta · every internal markdown link in render-target docs resolves to an existing file (sweep 88)
      /^verify-no-empty-catch/, // meta · no empty catch blocks in first-party code (sweep 91)
      /^verify-no-stale-port-3000/, // meta · stale-port-3000-allow:meta-wiring · no `:3000` references (Studio runs on :3300) (sweep 92)
      /^verify-no-stale-numeric-snapshots/, // meta · operational surfaces (NatSpec, JSDoc, comments, spec docs) don't hardcode numbers.json values without unit-word context (sweep 94)
      /^verify-no-ghost-surfaces/, // meta · every HLD §1 surface row maps to a real apps/<name>/ with tracked files (sweep 100)
      /^verify-seed-skill-manifests/, // .claude/rules/skills.md · every first-party SKILL.md parses against the canonical schema (sweep 103)
      /^verify-canonical-env-aliases-everywhere/, // §15 · every legacy env-var alias has canonical IVARONIX_* counterpart adjacent (sweep 107 · amnesty pattern)
      /^verify-no-direct-legacy-env-reads/, // §15 · no process.env.<LEGACY> read without canonical fallback (sweep 114 · locks 10 amnesty-mined bugs)
      /^verify-api-route-rate-limit/, // K-8 family · every operator-write Studio API route gates on checkRateLimit (sweep 119 · /api/onboard/metadata gap fix)
      /^verify-studio-security-headers/, // HALF_BAKED §G Tier-A item 6 · X-Frame-Options + nosniff + Referrer-Policy + HSTS (sweep 130)
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
      /^verify-hero/, // hero band live render (requires dev server)
      /^verify-room/, // data-room flow (requires dev server + wallet)
      /^verify-all-surfaces/, // full E2E sweep across all routes (live)
      /^verify-2[abcd]/, // wallet/onboard flow regressions (live · phase 2 · includes 2a-and-audit + 2a-pages)
      /^verify-3[bd]/, // chain-write regressions (live · phase 3 · MetaMask popup)
      /^verify-4[ac]/, // post-anchor UI regressions (live · phase 4)
      /^verify-w-batch/, // bulk-flow regression (live · doc bulk audit)
    ],
  },
  'live-chain': {
    // Regressions that require a funded wallet + live RPC. Used by
    // .github/workflows/chain-smoke.yml on PR label `run-chain-smoke`
    // and by the nightly cron. NOT run in pre-commit or normal CI.
    label: 'Chain-write live regressions (requires RPC + funded wallet)',
    patterns: [
      /^verify-v2-anchor-live/, // synthetic V2 receipt anchor smoke
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
      /^verify-deploy-scripts-canonical-key/, // §15 · Foundry deploy scripts use IVARONIX_SIGNER_KEY alias chain (sweep 80)
      /^verify-contract-threat-model/, // .claude/rules/contracts.md · every contracts/src/*.sol has a Threat model block (sweep 102)
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
