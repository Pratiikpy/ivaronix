import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { Wallet, JsonRpcProvider } from 'ethers';
import {
  loadSkillsFromDir,
  findSkill,
  scanSkill,
  skillIdFromName,
  versionIdFromSemver,
  manifestHashToBytes32,
  SkillRegistryClient,
  type LoadedSkill,
} from '@ivaronix/skills';
import { NETWORKS } from '@ivaronix/core';
import { getDeployedAddress } from '@ivaronix/og-chain';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';
import { addScheduleCommand } from './skill-schedule.js';
import { addRegistryExportCommand } from './skill-registry-export.js';

/** Search dirs in priority order: project local skills → seed-skills (root) */
function skillSearchDirs(): string[] {
  const cwd = process.cwd();
  const localSkills = resolve(cwd, '.ivaronix', 'skills');
  // Walk up to find seed-skills/ (repo root)
  let dir = cwd;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'seed-skills');
    if (existsSync(candidate)) {
      return [localSkills, candidate];
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return [localSkills];
}

function requireKey(k: string | undefined): string {
  if (!k) {
    throw new Error('Missing signer key. Set IVARONIX_SIGNER_KEY (legacy: OG_PRIVATE_KEY · EVM_PRIVATE_KEY) in .env');
  }
  return k;
}

function loadAllSkills(): LoadedSkill[] {
  const dirs = skillSearchDirs();
  const seen = new Set<string>();
  const all: LoadedSkill[] = [];
  for (const d of dirs) {
    for (const s of loadSkillsFromDir(d)) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      all.push(s);
    }
  }
  return all;
}

export const skillCommand = new Command('skill').description('Browse and inspect installed skills');

// ─── list ────────────────────────────────────────────────────────────────────
skillCommand
  .command('list')
  .description('List all available skills')
  .action(() => {
    const skills = loadAllSkills();
    if (skills.length === 0) {
      ui.hint('No skills found. Run from the repo root or in a project with .ivaronix/skills/');
      return;
    }
    ui.title(`Skills available (${skills.length})`);
    ui.divider();
    for (const s of skills) {
      const tier = s.manifest.og.consensus.default_tier;
      const burn = s.manifest.og.burn.auto_enable ? '🔒 burn' : '';
      const tee = s.manifest.og.permissions.compute_tee_required ? '🛡  tee' : '';
      ui.pass(`${s.id.padEnd(28)}  v${s.manifest.version}  tier=${tier}  ${burn} ${tee}`.trimEnd());
      console.log(`     ${s.manifest.description}`);
    }
    ui.divider();
  });

// ─── inspect ─────────────────────────────────────────────────────────────────
skillCommand
  .command('inspect <id>')
  .description('Show full manifest + permissions for a skill')
  .action((id: string) => {
    const skill = findSkill(id, skillSearchDirs());
    if (!skill) {
      ui.fail(`No skill named "${id}"`);
      return;
    }
    ui.title(skill.id);
    ui.info(`version              ${skill.manifest.version}`);
    ui.info(`license              ${skill.manifest.license}`);
    ui.info(`description          ${skill.manifest.description}`);
    ui.info(`manifestHash         ${skill.manifestHash}`);
    ui.info(`rootPath             ${skill.rootPath}`);
    ui.divider();
    ui.section('permissions');
    const p = skill.manifest.og.permissions;
    ui.info(`memory_access        ${p.memory_access}`);
    ui.info(`network_access       ${p.network_access.length > 0 ? p.network_access.join(', ') : '(none)'}`);
    ui.info(`wallet_access        ${p.wallet_access ? '⚠ YES' : 'no'}`);
    ui.info(`writes_files         ${p.writes_files ? '⚠ YES' : 'no'}`);
    ui.info(`shell_access         ${p.shell_access}`);
    ui.info(`receipt_required     ${p.receipt_required}`);
    ui.info(`compute_tee_required ${p.compute_tee_required}`);
    ui.info(`passport_min_trust   ${p.passport_min_trust}`);
    ui.divider();
    ui.section('reputation');
    ui.info(`on_pass              trustScore +${skill.manifest.og.reputation.on_pass.trustScore}, receiptCount +${skill.manifest.og.reputation.on_pass.receiptCount}`);
    ui.info(`on_fail              trustScore ${skill.manifest.og.reputation.on_fail.trustScore}`);
    ui.info(`on_violation         trustScore ${skill.manifest.og.reputation.on_violation.trustScore}, locked=${skill.manifest.og.reputation.on_violation.locked}`);
    ui.divider();
    ui.section('consensus + burn');
    ui.info(`required             ${skill.manifest.og.consensus.required}`);
    ui.info(`default_tier         ${skill.manifest.og.consensus.default_tier}`);
    ui.info(`burn.auto_enable     ${skill.manifest.og.burn.auto_enable}`);
    ui.divider();
    ui.section('prompt body (first 600 chars)');
    console.log(skill.systemPromptBody.slice(0, 600) + (skill.systemPromptBody.length > 600 ? '…' : ''));
  });

// ─── publish ─────────────────────────────────────────────────────────────────
skillCommand
  .command('publish <id>')
  .description('Anchor this skill\'s manifestHash on the SkillRegistry contract')
  .option('--network <net>', 'testnet | mainnet', 'testnet')
  .action(async (id: string, opts: { network: 'testnet' | 'mainnet' }) => {
    const env = loadEnv();
    const skill = findSkill(id, skillSearchDirs());
    if (!skill) {
      ui.fail(`No skill named "${id}"`);
      process.exitCode = 1;
      return;
    }

    const net = NETWORKS[opts.network];
    if (!net) {
      ui.fail(`Unknown network "${opts.network}"`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(net.rpcUrl);
    const wallet = new Wallet(requireKey(env.privateKey), provider);
    // V2-first WRITE per iter-123 (B-V2-17 squatter-risk fix). V2 ships a
    // reserved-name allow-list (6 first-party skill IDs pre-reserved) plus
    // owner-arbitration for squatted names. V1 stays live for legacy publishes.
    // publishVersion signature is identical V1↔V2 so the V1 client works
    // against V2's address.
    const registryAddrV2 = getDeployedAddress(opts.network, 'SkillRegistryV2');
    const registryAddrV1 = getDeployedAddress(opts.network, 'SkillRegistry');
    const registryAddr = registryAddrV2 ?? registryAddrV1;
    const registryVersion: 'v1' | 'v2' = registryAddrV2 ? 'v2' : 'v1';
    if (!registryAddr) {
      ui.fail(`SkillRegistry not deployed on ${opts.network}`);
      process.exitCode = 1;
      return;
    }
    const reg = new SkillRegistryClient(registryAddr, wallet);

    const skillId = skillIdFromName(skill.id);
    const versionId = versionIdFromSemver(skill.manifest.version);
    const manifestHash = manifestHashToBytes32(skill.manifestHash);

    ui.title(`skill publish ${skill.id}@${skill.manifest.version}`);
    ui.info(`registry             ${registryAddr} (${registryVersion.toUpperCase()})`);
    ui.info(`skillId              ${skillId}`);
    ui.info(`versionId            ${versionId}`);
    ui.info(`manifestHash         ${manifestHash}`);
    ui.divider();

    // Pre-flight: is this version already published?
    const existing = await reg.getVersion(skillId, versionId);
    if (existing) {
      if (existing.manifestHash.toLowerCase() === manifestHash.toLowerCase()) {
        ui.pass(`already published with the same manifestHash — nothing to do`);
        if (existing.revoked) ui.fail(`note: this version is REVOKED on chain`);
        return;
      }
      ui.fail(`version ${skill.manifest.version} is already published with a DIFFERENT manifestHash:`);
      ui.info(`  on chain:  ${existing.manifestHash}`);
      ui.info(`  local:     ${manifestHash}`);
      ui.hint(`bump the skill's version (e.g. ${skill.manifest.version} → next patch) and retry`);
      process.exitCode = 1;
      return;
    }

    ui.info(`publishing on ${opts.network}...`);
    const tx = await reg.publishVersion(skillId, versionId, manifestHash);
    ui.info(`tx hash              ${tx.hash}`);
    const receipt = await tx.wait();
    ui.pass(`block                ${receipt?.blockNumber}`);
    ui.pass(`gas used             ${receipt?.gasUsed}`);
    ui.divider();
    ui.pass(`Status: → ANCHORED ✓`);
    // Use network-aware explorer URL · CLAUDE.md §15 ship-X-discover-X.
    ui.hint(`Explorer: ${NETWORKS[opts.network].chainExplorer}/tx/${tx.hash}`);
  });

// ─── verify ──────────────────────────────────────────────────────────────────
skillCommand
  .command('verify <id>')
  .description('Compare local manifest against the on-chain SkillRegistry record')
  .option('--network <net>', 'testnet | mainnet', 'testnet')
  .action(async (id: string, opts: { network: 'testnet' | 'mainnet' }) => {
    const env = loadEnv();
    const skill = findSkill(id, skillSearchDirs());
    if (!skill) {
      ui.fail(`No skill named "${id}"`);
      process.exitCode = 1;
      return;
    }
    const net = NETWORKS[opts.network];
    const provider = new JsonRpcProvider(net.rpcUrl);
    // V2-first read per iter-123 (B-V2-17). V2 carries canonical first-party
    // skill IDs (6 pre-reserved on deploy); V1 is legacy fallback.
    const registryAddrV2 = getDeployedAddress(opts.network, 'SkillRegistryV2');
    const registryAddrV1 = getDeployedAddress(opts.network, 'SkillRegistry');
    if (!registryAddrV2 && !registryAddrV1) {
      ui.fail(`SkillRegistry not deployed on ${opts.network}`);
      process.exitCode = 1;
      return;
    }

    ui.title(`skill verify ${skill.id}@${skill.manifest.version}`);
    ui.info(`local manifestHash   ${skill.manifestHash}`);

    // Try V2 first (canonical); fall back to V1 (legacy). Use whichever
    // returns a registered hit; if neither has it, use the V1 (or V2-only)
    // empty result so the downstream "NOT REGISTERED" path renders.
    let scan: Awaited<ReturnType<typeof scanSkill>>;
    let foundOn: 'v1' | 'v2' | null = null;
    if (registryAddrV2) {
      const regV2 = new SkillRegistryClient(registryAddrV2, provider);
      scan = await scanSkill(skill, regV2);
      if (scan.registered) foundOn = 'v2';
    } else {
      const regV1 = new SkillRegistryClient(registryAddrV1!, provider);
      scan = await scanSkill(skill, regV1);
      if (scan.registered) foundOn = 'v1';
    }
    if (!scan.registered && registryAddrV1 && registryAddrV1 !== registryAddrV2) {
      const regV1 = new SkillRegistryClient(registryAddrV1, provider);
      const v1Scan = await scanSkill(skill, regV1);
      if (v1Scan.registered) { scan = v1Scan; foundOn = 'v1'; }
    }

    ui.divider();
    if (!scan.registered) {
      ui.fail(`status               NOT REGISTERED`);
      ui.hint(`run 'ivaronix skill publish ${skill.id}' to anchor it`);
      process.exitCode = 1;
      return;
    }
    ui.info(`found on             ${foundOn === 'v2' ? 'V2 (canonical)' : 'V1 (legacy)'}`);
    if (scan.revoked) {
      ui.fail(`status               REVOKED`);
      ui.info(`onchain hash         ${scan.onchainManifestHash}`);
      ui.info(`creator              ${scan.creator}`);
      process.exitCode = 1;
      return;
    }
    if (!scan.matches) {
      ui.fail(`status               MISMATCH`);
      ui.info(`onchain hash         ${scan.onchainManifestHash}`);
      ui.info(`reason               ${scan.reason}`);
      process.exitCode = 1;
      return;
    }
    ui.pass(`status               MATCH`);
    ui.pass(`onchain hash         ${scan.onchainManifestHash}`);
    ui.pass(`creator              ${scan.creator}`);
    ui.pass(`publishedAt          ${new Date(scan.publishedAt! * 1000).toISOString()}`);
    if (env) { /* env is loaded; no-op to silence ts unused */ }
  });

// ─── install ─────────────────────────────────────────────────────────────────
/**
 * `ivaronix skill install <ref>` — install a skill from a name OR a URL.
 *
 * Supported `<ref>` forms:
 *   - bare skill id (e.g. `plan-step`) — resolves to `seed-skills/<id>/SKILL.md`
 *     in the repo. Catches the QA bug where `ivaronix skill install plan-step`
 *     died with "Failed to parse URL".
 *   - https://raw.githubusercontent.com/<owner>/<repo>/<branch>/path/to/SKILL.md
 *   - https://github.com/<owner>/<repo>/blob/<branch>/path/to/SKILL.md  (rewritten to raw)
 *   - file:///abs/path/to/SKILL.md  (local file)
 *
 * The fetched SKILL.md is validated through the same Zod schema used at
 * load time. The skill is then copied into `.ivaronix/skills/<id>/SKILL.md`
 * (project-local) so it overrides any same-id seed skill.
 */
skillCommand
  .command('install <ref>')
  .description('Install a skill from a name (e.g. plan-step) OR a URL (GitHub raw / github.com blob / file://)')
  .option('--id <id>', 'override the skill id (defaults to the manifest name)')
  .option('--force', 'overwrite an existing same-id skill')
  .action(async (ref: string, opts: { id?: string; force?: boolean }) => {
    // Step 1: resolve `<ref>` to a fetchable URL.
    // If `<ref>` looks like a bare skill id (no scheme, no slash), try to
    // resolve against the local seed-skills directories first.
    let fetchUrl = ref;
    if (!/^(https?|file):\/\//.test(ref) && !ref.includes('/')) {
      const { existsSync } = await import('node:fs');
      const dirs = skillSearchDirs();
      let found: string | null = null;
      for (const d of dirs) {
        const candidate = resolve(d, ref, 'SKILL.md');
        if (existsSync(candidate)) { found = candidate; break; }
      }
      if (found) {
        // Convert local path → file:// URL with proper Windows escaping
        const urlPath = found.replace(/\\/g, '/');
        fetchUrl = process.platform === 'win32'
          ? `file:///${urlPath}`
          : `file://${urlPath}`;
      } else {
        ui.fail(`skill "${ref}" not found in local catalog`);
        ui.hint('Available bare names:');
        for (const d of dirs) {
          try {
            const { readdirSync } = await import('node:fs');
            for (const e of readdirSync(d)) {
              const sub = resolve(d, e, 'SKILL.md');
              if (existsSync(sub)) ui.info(`  ${e}`);
            }
          } catch { /* skip */ }
        }
        ui.hint('Or pass a URL: `ivaronix skill install https://raw.githubusercontent.com/<owner>/<repo>/main/SKILL.md`');
        process.exitCode = 1;
        return;
      }
    }
    // Rewrite github.com/<owner>/<repo>/blob/... → raw.githubusercontent.com/<owner>/<repo>/...
    const githubBlob = fetchUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (githubBlob) {
      fetchUrl = `https://raw.githubusercontent.com/${githubBlob[1]}/${githubBlob[2]}/${githubBlob[3]}`;
    }
    // Rewrite Git-Bash style file URLs: file:///c/Users/... → file:///C:/Users/...
    // Node's URL parser rejects /c/... as non-absolute on Windows; the spec
    // requires file:///C:/path. Same fix pattern as chat-tools (Round 9).
    if (process.platform === 'win32') {
      const gitBash = fetchUrl.match(/^file:\/\/\/([a-z])\/(.*)$/);
      if (gitBash) fetchUrl = `file:///${gitBash[1]!.toUpperCase()}:/${gitBash[2]!}`;
    }

    ui.title(`skill install ${ref}`);
    if (fetchUrl !== ref) ui.info(`resolved             ${fetchUrl}`);

    let body: string;
    try {
      if (fetchUrl.startsWith('file://')) {
        const { readFileSync } = await import('node:fs');
        body = readFileSync(new URL(fetchUrl), 'utf8');
      } else {
        const res = await fetch(fetchUrl);
        if (!res.ok) {
          ui.fail(`HTTP ${res.status}`, await res.text().catch(() => 'no body'));
          process.exitCode = 1;
          return;
        }
        body = await res.text();
      }
    } catch (err) {
      ui.fail(`fetch failed`, (err as Error).message);
      process.exitCode = 1;
      return;
    }

    // Validate the manifest by writing to a tmp dir + loadSkillFromPath
    const { mkdtempSync, writeFileSync, mkdirSync, copyFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { loadSkillFromPath } = await import('@ivaronix/skills');

    const tmp = mkdtempSync(join(tmpdir(), 'ivaronix-install-'));
    writeFileSync(join(tmp, 'SKILL.md'), body, 'utf8');

    let loaded;
    try {
      loaded = loadSkillFromPath(tmp);
    } catch (err) {
      ui.fail(`manifest invalid`, (err as Error).message);
      process.exitCode = 1;
      return;
    }
    const id = opts.id ?? loaded.manifest.name;
    ui.pass(`manifest valid       ${id}@${loaded.manifest.version}`);
    ui.pass(`manifestHash         ${loaded.manifestHash}`);

    // Install into .ivaronix/skills/<id>/SKILL.md
    const targetRoot = resolve(process.cwd(), '.ivaronix', 'skills', id);
    const targetMd = join(targetRoot, 'SKILL.md');
    if (existsSync(targetMd) && !opts.force) {
      ui.fail(`already installed at ${targetRoot}`, 'pass --force to overwrite');
      process.exitCode = 1;
      return;
    }
    mkdirSync(targetRoot, { recursive: true });
    copyFileSync(join(tmp, 'SKILL.md'), targetMd);

    // Copy tests/ fixtures if the source is a local file:// path · used to skip
    // tests/, breaking `skill eval <id>` against the installed copy.
    if (fetchUrl.startsWith('file://')) {
      const { fileURLToPath } = await import('node:url');
      const { readdirSync, statSync } = await import('node:fs');
      const { dirname } = await import('node:path');
      const srcSkillPath = fileURLToPath(fetchUrl);
      const srcRoot = dirname(srcSkillPath);
      const srcTests = join(srcRoot, 'tests');
      if (existsSync(srcTests) && statSync(srcTests).isDirectory()) {
        const destTests = join(targetRoot, 'tests');
        mkdirSync(destTests, { recursive: true });
        for (const f of readdirSync(srcTests)) {
          const src = join(srcTests, f);
          if (statSync(src).isFile()) copyFileSync(src, join(destTests, f));
        }
        ui.info(`tests copied         ${readdirSync(destTests).length} fixture(s) → ${destTests}`);
      }
    }

    ui.divider();
    ui.banner(true, '→ INSTALLED ✓');
    ui.hint(`run: ivaronix doc ask <file> "..." --skill ${id}`);
    ui.hint(`if you trust the source, anchor it: ivaronix skill publish ${id}`);
  });

// ─── eval ────────────────────────────────────────────────────────────────────
skillCommand
  .command('eval <id>')
  .description('Run the skill against every fixture under tests/; score outputs (claude-mem evals pattern)')
  .option('--receipt', 'anchor a receipt per fixture (off by default to avoid OG burn)', false)
  .action(async (id: string, opts: { receipt?: boolean }) => {
    const skill = findSkill(id, skillSearchDirs());
    if (!skill) {
      ui.fail(`No skill named "${id}"`);
      process.exitCode = 1;
      return;
    }
    // Manifest demands a receipt — auto-enable so the sandbox doesn't refuse.
    // We tell the user upfront how much OG this will cost.
    const requiresReceipt = skill.manifest.og.permissions.receipt_required;
    if (requiresReceipt && !opts.receipt) {
      opts.receipt = true;
      ui.hint(`skill requires receipts — auto-enabling --receipt (≈0.004 OG / fixture)`);
    }
    const { join: jp } = await import('node:path');
    const { readdirSync, readFileSync, existsSync, statSync } = await import('node:fs');
    const testsDir = jp(skill.rootPath, 'tests');
    if (!existsSync(testsDir)) {
      ui.fail(`no tests/ folder for ${id}`);
      ui.hint(`add tests/<sample>.txt fixtures to enable eval`);
      process.exitCode = 1;
      return;
    }
    const fixtures = readdirSync(testsDir).filter((e) => {
      const f = jp(testsDir, e);
      try { return statSync(f).isFile() && !e.endsWith('.expects.txt'); }
      catch { return false; }
    });
    if (fixtures.length === 0) {
      ui.fail(`no fixtures in ${testsDir}`);
      process.exitCode = 1;
      return;
    }
    const { runPipeline } = await import('../lib/pipeline.js');
    ui.title(`eval ${id} v${skill.manifest.version}`);
    ui.info(`fixtures             ${fixtures.length}`);
    ui.divider();
    let totalPass = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const rows: { fixture: string; pass: boolean; reason: string; tokens: number; ms: number }[] = [];
    for (const f of fixtures) {
      const path = jp(testsDir, f);
      const content = readFileSync(path, 'utf8').slice(0, 16_000);
      const expectsPath = jp(testsDir, `${f}.expects.txt`);
      const expects = existsSync(expectsPath)
        ? readFileSync(expectsPath, 'utf8').split('\n').map((l: string) => l.trim()).filter(Boolean)
        : [];
      try {
        const result = await runPipeline({
          skillId: id,
          context: content,
          userPrompt: `Run your prescribed analysis on this fixture.`,
          tier: 'quick',
          receipt: !!opts.receipt,
          receiptType: 'audit',
          label: f,
        });
        const out = result.finalText;
        const tokens = result.consensus.billing.totalInputTokens + result.consensus.billing.totalOutputTokens;
        totalTokens += tokens;
        totalCost += result.consensus.billing.estimatedCostOg;
        const reasons: string[] = [];
        if (out.length < 80) reasons.push(`output<80 chars (${out.length})`);
        if ((result.consensus.convergence.score ?? 1) < 0.5) reasons.push(`convergence<0.5`);
        for (const exp of expects) {
          const isRegex = exp.startsWith('/') && exp.endsWith('/');
          const ok = isRegex ? new RegExp(exp.slice(1, -1)).test(out) : out.includes(exp);
          if (!ok) reasons.push(`missing expected: ${exp}`);
        }
        const pass = reasons.length === 0;
        if (pass) totalPass++;
        rows.push({ fixture: f, pass, reason: pass ? 'ok' : reasons.join('; '), tokens, ms: result.consensusMs });
      } catch (err) {
        rows.push({ fixture: f, pass: false, reason: (err as Error).message, tokens: 0, ms: 0 });
      }
    }
    for (const r of rows) {
      const fn = r.pass ? ui.pass : ui.fail;
      fn(`${r.fixture}`, `${r.pass ? 'pass' : r.reason} · ${r.tokens} tok · ${r.ms}ms`);
    }
    ui.divider();
    if (totalPass === rows.length) {
      ui.banner(true, `→ ${totalPass}/${rows.length} pass · ${totalTokens} tok · ${totalCost.toFixed(8)} OG`);
    } else {
      ui.banner(false, `→ ${totalPass}/${rows.length} pass · ${totalTokens} tok · ${totalCost.toFixed(8)} OG`);
      process.exitCode = 1;
    }
  });

// ─── fee-split ───────────────────────────────────────────────────────────────
skillCommand
  .command('fee-split <id>')
  .description('Show og.creator.fee_split + simulate the per-actor allocation for a given total cost')
  .option('--total <neuron>', 'total cost in neuron (default 1e15 = 0.001 OG)', '1000000000000000')
  .action(async (id: string, opts: { total: string }) => {
    const { allocateFeeSplit } = await import('@ivaronix/receipts');
    const skill = findSkill(id, skillSearchDirs());
    if (!skill) {
      ui.fail(`No skill named "${id}"`);
      process.exitCode = 1;
      return;
    }
    const fs = skill.manifest.og.creator?.fee_split;
    const passport = skill.manifest.og.creator?.passport;
    ui.title(`${skill.id} · fee split`);
    ui.divider();
    if (!fs) {
      ui.info('og.creator.fee_split  (none declared)');
      ui.hint('Add `og.creator.fee_split: { creator: 9000, treasury: 1000 }` to the manifest');
      return;
    }
    ui.info(`creator passport     ${passport ?? '(none — set og.creator.passport)'}`);
    ui.info(`creator bps          ${fs.creator}  (${(fs.creator / 100).toFixed(2)}%)`);
    ui.info(`treasury bps         ${fs.treasury}  (${(fs.treasury / 100).toFixed(2)}%)`);
    ui.divider();
    const alloc = allocateFeeSplit({
      totalCostNeuron: opts.total,
      creatorBps: fs.creator,
      treasuryBps: fs.treasury,
      creatorPassport: passport,
    });
    const totalOg = (Number(BigInt(opts.total)) / 1e18).toFixed(8);
    const creatorOg = (Number(BigInt(alloc.creatorNeuron)) / 1e18).toFixed(8);
    const treasuryOg = (Number(BigInt(alloc.treasuryNeuron)) / 1e18).toFixed(8);
    ui.section(`for total ${totalOg} OG`);
    ui.pass(`creator earns        ${creatorOg} OG  (${alloc.creatorNeuron} neuron)`);
    ui.pass(`treasury earns       ${treasuryOg} OG  (${alloc.treasuryNeuron} neuron)`);
    ui.divider();
    ui.hint('Each skill_exec receipt anchors `billing.feeSplit` with the same shape — verifiable on chain.');
  });

// ─── earn-history ─────────────────────────────────────────────────────────────
// Aggregates billing.feeSplit across every anchored receipt for this skill,
// proving the Track 3 (Agentic Economy) wedge: creator settlement is
// *receipt-gated* — earnings only accrue when a TIER 1 TEE receipt is signed
// and anchored, not just when a task completes. AgentPay/zer0Gig demo
// payment rails; this demos receipt-gated payment rails.
skillCommand
  .command('earn-history [id]')
  .description('Aggregate fee-split earnings across all anchored receipts for a skill (or all skills)')
  .action(async (id: string | undefined) => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    // Find every .ivaronix/receipts/anchored directory under cwd ancestors
    // (same walk as Studio's local-receipt resolver).
    const dirs: string[] = [];
    let dir = process.cwd();
    let workspaceRoot: string | null = null;
    for (let i = 0; i < 12; i++) {
      const candidate = resolve(dir, '.ivaronix', 'receipts', 'anchored');
      if (existsSync(candidate)) dirs.push(candidate);
      if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) workspaceRoot = dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (workspaceRoot) {
      for (const sib of ['apps/cli', 'apps/mcp-server', 'apps/studio']) {
        const c = resolve(workspaceRoot, sib, '.ivaronix', 'receipts', 'anchored');
        if (existsSync(c) && !dirs.includes(c)) dirs.push(c);
      }
    }

    interface Row {
      skillId: string;
      skillVersion: string;
      runs: number;
      totalCostNeuron: bigint;
      creatorNeuron: bigint;
      treasuryNeuron: bigint;
      creatorPassport?: string;
    }
    const byKey = new Map<string, Row>();
    let scanned = 0;
    for (const d of dirs) {
      let entries: string[];
      try { entries = readdirSync(d); } catch { continue; }
      for (const e of entries) {
        if (!e.endsWith('.json')) continue;
        try {
          if (!statSync(resolve(d, e)).isFile()) continue;
          const r = JSON.parse(readFileSync(resolve(d, e), 'utf8')) as {
            request?: { skillId?: string; skillVersion?: string };
            billing?: { feeSplit?: { creatorNeuron?: string; treasuryNeuron?: string; totalCostNeuron?: string; creatorPassport?: string } };
          };
          scanned++;
          const sId = r.request?.skillId;
          const sVer = r.request?.skillVersion ?? '?';
          const fs = r.billing?.feeSplit;
          if (!sId || !fs) continue;
          if (id && sId !== id) continue;
          const key = `${sId}@${sVer}`;
          let row = byKey.get(key);
          if (!row) {
            row = {
              skillId: sId,
              skillVersion: sVer,
              runs: 0,
              totalCostNeuron: 0n,
              creatorNeuron: 0n,
              treasuryNeuron: 0n,
              creatorPassport: fs.creatorPassport,
            };
            byKey.set(key, row);
          }
          row.runs += 1;
          row.totalCostNeuron += BigInt(fs.totalCostNeuron ?? 0n);
          row.creatorNeuron += BigInt(fs.creatorNeuron ?? 0n);
          row.treasuryNeuron += BigInt(fs.treasuryNeuron ?? 0n);
        } catch { /* skip malformed */ }
      }
    }

    ui.title(`skill earn-history${id ? ` · ${id}` : ' · all skills'}`);
    ui.info(`scanned              ${scanned} local receipts in ${dirs.length} dir(s)`);
    ui.divider();
    if (byKey.size === 0) {
      ui.info('(no receipts with billing.feeSplit found)');
      ui.hint('Anchor a receipt: `ivaronix demo` or any `skill eval <id>` with --receipt.');
      return;
    }
    const rows = [...byKey.values()].sort((a, b) =>
      Number(b.creatorNeuron - a.creatorNeuron),
    );
    for (const r of rows) {
      const creatorOg = (Number(r.creatorNeuron) / 1e18).toFixed(10);
      const treasuryOg = (Number(r.treasuryNeuron) / 1e18).toFixed(10);
      const totalOg = (Number(r.totalCostNeuron) / 1e18).toFixed(10);
      ui.section(`${r.skillId}@${r.skillVersion}`);
      ui.info(`runs                 ${r.runs}`);
      ui.info(`total cost           ${totalOg} OG`);
      ui.pass(`creator earned       ${creatorOg} OG  (${r.creatorNeuron.toString()} neuron)`);
      ui.info(`treasury earned      ${treasuryOg} OG  (${r.treasuryNeuron.toString()} neuron)`);
      if (r.creatorPassport) ui.info(`creator passport     ${r.creatorPassport}`);
    }
    ui.divider();
    const totalCreator = rows.reduce((acc, r) => acc + r.creatorNeuron, 0n);
    const totalTreasury = rows.reduce((acc, r) => acc + r.treasuryNeuron, 0n);
    const totalRuns = rows.reduce((acc, r) => acc + r.runs, 0);
    ui.pass(`TOTAL  · ${totalRuns} runs · creator ${(Number(totalCreator) / 1e18).toFixed(10)} OG · treasury ${(Number(totalTreasury) / 1e18).toFixed(10)} OG`);
    ui.hint('Receipt-gated settlement: creator only accrues when a TIER 1 TEE receipt anchors on chain.');
  });

// ─── schedule (planning-01 §2C) ──────────────────────────────────────────
addScheduleCommand(skillCommand);

// ─── registry export (planning-002 W8) ───────────────────────────────────
const registryGroup = skillCommand
  .command('registry')
  .description('Public skills-registry tools (planning-002 W8)');
addRegistryExportCommand(registryGroup);
