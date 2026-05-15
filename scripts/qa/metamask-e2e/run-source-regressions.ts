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
      /^verify-typecheck-clean-count/, // sweep 200 · numbers.json packages.typecheckClean excludes echo-prefixed placeholders even if message body mentions "tsc"
      /^verify-env-template-completeness/, // §15 · every IVARONIX_* var in code is in at least one env template
      /^verify-receipt-types-three-way/, // source enum ↔ RECEIPTS_SPEC ↔ numbers.json triangle stays in sync
      /^verify-receipt-types-have-producers/, // B-V2-35 closure · every RECEIPT_TYPES slot has at least 1 producer in shipped code
      /^verify-no-dead-domain-fallbacks/, // iter-103/104 closure · no 'ivaronix.studio' hardcodes + no localhost-only fallbacks without Vercel-env chain
      /^verify-tee-verification-method-honesty/, // iter-113 closure · routerVerified=false + TIER-1 verificationMethod is a brand overclaim
      /^verify-v3-aware-registry-destructure/, // iter-119 closure · prevents iter-114's V3-blindness destructure bug from recurring
      /^verify-v3-lookup-coexists-with-v2/, // iter-120 closure · any V2 lookup must have sibling V3 lookup (writer revert + reader undercount protection)
      /^verify-agent-passport-v2-coexists-with-v1/, // iter-121 closure · AgentPassportV1 lookup must have sibling V2 lookup (K-1/K-4/K-6 security-fix coverage)
      /^verify-capability-registry-v2-coexists-with-v1/, // iter-122 closure · CapabilityRegistry V1 lookup must have sibling V2 lookup (B-V2-15 social-graph leak fix coverage)
      /^verify-skill-registry-v2-coexists-with-v1/, // iter-123 closure · SkillRegistry V1 lookup must have sibling V2 lookup (B-V2-17 squatter-fix coverage)
      /^verify-memory-access-log-v2-coexists-with-v1/, // iter-124 closure · MemoryAccessLog V1 lookup must have sibling V2 lookup (B-V2-16 log-spoofing fix coverage · completes V2-rollout cascade)
      /^verify-qa-plan-regression-counts/, // iter-126 closure · the user's QA plan "Source-File Regression Suite" numeric claims must match actual file/filter counts (was 9-files stale at iter-125)
      /^verify-qa-plan-pending-vs-user-todo/, // iter-128 closure · QA plan PENDING markers must not reference USER_TODO entries already marked ✅ SHIPPED/CLOSED/CODE-COMPLETE/DEPLOYED/FIXED
      /^verify-qa-plan-v2-deploy-tense/, // iter-129 closure · QA plan must not describe V2 deploys as future events (still-on-V1 / on-each-V2-redeploy / test-on-redeploy-day phrasing)
      /^verify-qa-plan-receipt-registry-v3-coverage/, // iter-130 closure · QA plan ReceiptRegistry reads must be described as V3-first (not V2-first) per iter-119 cascade
      /^verify-qa-plan-paths-exist/, // iter-131 closure · every full repo path cited in QA plan must resolve to a real file
      /^verify-burn-keyfingerprint-before-zero/, // iter-131 closure · packages/og-storage/src/burn.ts must compute keyFingerprint before key.fill(0) (CRYPTO_NOTES privacy story)
      /^verify-b-v2-references-resolve/, // iter-132 closure · every B-V2-N reference in QA plan + code resolves to a real USER_TODO header
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
      /^verify-studio-public-manifest-cache-headers/, // B-V2-45 closure · Cache-Control on /r/:id /embed/r/:id /data-room/:id per PRIVACY_NOTES.md §1
      /^verify-privacy-terms-routes/, // HALF_BAKED §G Tier-A item 7 · /privacy + /terms routes + footer links (sweep 131)
      /^verify-share-surface-fonts/, // HALF_BAKED §G Tier-A item 8 · brand fonts on /r/[id]/print + /embed/r/[id] (sweep 132)
      /^verify-first-party-slugs-canonical/, // §15 · FIRST_PARTY_SLUGS lives only in lib/first-party-skills.ts; no inline array drift across consumers (2026-05-14)
      /^verify-no-bare-auto-1fr/, // HALF_BAKED §G Tier-A item 9 · grid `auto 1fr` mobile-overflow (sweep 133)
      /^verify-api-route-zod-validation/, // HALF_BAKED §J-2 · every body-taking API route validates via Zod safeParse (sweeps 145-149 fixed; sweep 150 locks)
      /^verify-publishable-metadata/, // HALF_BAKED §J-14 · npm-publishable packages have description/license/homepage/repository/bugs/engines (sweep 155)
      /^verify-fully-verified-gates-on-verifyclaimed/, // I-1 mirror · FULLY VERIFIED chip on every tamper-sensitive surface requires verifyClaimed pass (sweeps 175-176)
      /^verify-unified-nextid-anchored-convention/, // sweep 184+185 · unifiedNextId.total uses anchored convention (nextId-1 sum), not raw nextId sum
      /^verify-studio-passport-count-helper/, // sweep 186-188 · Studio passport-count reads via livePassportCount() helper (no direct nextTokenId() drift)
      /^verify-studio-chain-reads-helpers/, // sweep 189 · Studio app surfaces use @/lib/chain helpers (no direct ReceiptRegistry(V2)Client construction)
      /^verify-readme-pnpm-scripts-exist/, // sweep 190+191 · every `pnpm <script>` in render-target docs is a real script in root package.json
      /^verify-readme-ivaronix-commands-exist/, // sweep 192 · every `ivaronix <subcommand>` in render-target docs maps to a real Commander binding
      /^verify-user-todo-deploy-markers/, // sweep 199 · USER_TODO §A-V2 deploy entries match contracts/deployments/testnet.json (✅ DEPLOYED markers stay fresh)
      /^verify-half-baked-closure-citations/, // sweep 203 · every ✅ <STATUS> header in HALF_BAKED.md cites a sha / sweep / date / address / verification phrase (locks the "ship fix + forget to close the doc" drift class sweep 202 caught manually)
      /^verify-studio-disk-receipt-safety/, // sweep 205 · HALF_BAKED §J-3 closure · Studio disk-receipt reads go through safeReadReceiptBody validator instead of raw JSON.parse-as-ReceiptBody cast
      /^verify-no-console-log-in-libs/, // sweep 207 · HALF_BAKED §J-11 third rule · no console.log/debug in library packages (warn/error/info still allowed for operator-facing signals)
      /^verify-no-tee-bound-overclaim/, // sweep 211 · HALF_BAKED §I-6 closure · no capital-B "TEE-Bound" in app source or render-target docs (judge-facing surfaces)
      /^verify-api-route-error-sanitize/, // sweep 212 · HALF_BAKED §K-11 closure · API routes wrap err.message with sanitizeErrorMessage before responding
      /^verify-no-jsdoc-glob-terminator/, // sweep 212 meta-regression · forbid the JSDoc terminator token inside a multi-line comment (third-occurrence prevention)
      /^verify-siwe-cookie-samesite-strict/, // sweep 217 · HALF_BAKED §K-13 primary CSRF defense · SIWE session cookies must stay sameSite: 'strict'
      /^verify-pipeline-storage-upload/, // sweep 218 · HALF_BAKED §H-3 closure · Studio runtime pipeline uploads evidence to 0G Storage before anchoring
      /^verify-known-registries-vs-deployments/, // sweep 219 · HALF_BAKED §K-17 closure · KNOWN_RECEIPT_REGISTRIES in core stays in sync with contracts/deployments/{network}.json
      /^verify-b-v2-crossref-status/, // sweep 228 · code + docs §B-V2-N references must agree with USER_TODO.md ✅ SHIPPED status (catches sweep 227 drift class structurally)
      /^verify-vercel-transpile-packages/, // VERCEL-DEPLOY-AUDIT-1 · every @ivaronix/* package Studio imports must be in next.config.ts transpilePackages (else production `next build` on Vercel fails)
      /^verify-no-og-chain-deployments-import-in-studio/, // VERCEL-CHAIN-READ-1/2 · apps/studio MUST NOT import loadDeployments/getDeployedAddress from @ivaronix/og-chain (fails on Vercel cwd walk-up); use @/lib/deployments-bundle instead. Closes b342fd1 + 2d9e01f drift class structurally.
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
      /^verify-no-hardcoded-studio-base/, // HALF_BAKED §J-10 · CLI proof URLs use studioUrl() not hardcoded localhost (sweep 144)
      /^verify-cli-receipt-count-unified/, // sweep 178+179 · CLI receipt-count headlines read both V1 + V2 (post-K-2 unified) — locks the V1-only drift pattern
      /^verify-cli-findbyagent-unified/, // sweep 180+181 · CLI findByAgent calls iterate V1 + V2 (post-K-2 unified) — locks per-agent V1-only drift
      /^verify-cli-findbyreceiptroot-unified/, // sweep 182 · CLI findByReceiptRoot calls iterate V1 + V2 — completes the V2-drift trifecta
      /^verify-cli-getreceipt-unified/, // sweep 183 · CLI chain getReceipt calls iterate V1 + V2 — 4th member of V2-drift reader-pattern lockdown
      /^verify-memory-snapshot-upload/, // sweep 201 · HALF_BAKED §I-12 partial closure · memory snapshot --upload wires createStorageClient.upload
      /^verify-cli-disk-json-safety/, // sweep 206 · HALF_BAKED §J-3 CLI-half closure · no CLI file casts disk JSON to a named type without going through validator/unknown narrow
      /^verify-passport-mint-storage-upload/, // sweep 208 · HALF_BAKED §I-11 closure · passport mint uploads metadata to 0G Storage before computing chain metadataRoot (sha256 fallback only on upload failure)
      /^verify-cross-machine-network-resolution/, // 2026-05-16 · CLI receipt verify honors receipt.chainAnchor.network for cross-machine ANCHORED lookup · locks the JUDGE_GUIDE Step 1 'independently replayable' trust claim
    ],
  },
  contracts: {
    label: 'Contract regressions',
    patterns: [
      /^verify-k1-passport-v2/,
      /^verify-k2-registry-v2/,
      /^verify-deploy-scripts-canonical-key/, // §15 · Foundry deploy scripts use IVARONIX_SIGNER_KEY alias chain (sweep 80)
      /^verify-contract-threat-model/, // .claude/rules/contracts.md · every contracts/src/*.sol has a Threat model block (sweep 102)
      /^verify-skill-run-payment-deployed/, // FINAL_BUILD_PLAN.md Block A · SkillRunPayment address sync across deployments JSON + KNOWN_PAYMENT_CONTRACTS + README/MAINNET_READINESS
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
