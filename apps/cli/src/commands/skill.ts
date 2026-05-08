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
    throw new Error('Missing EVM private key. Set EVM_PRIVATE_KEY or OG_PRIVATE_KEY in .env');
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
    const registryAddr = getDeployedAddress(opts.network, 'SkillRegistry');
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
    ui.info(`registry             ${registryAddr}`);
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
    ui.hint(`Explorer: https://chainscan-galileo.0g.ai/tx/${tx.hash}`);
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
    const registryAddr = getDeployedAddress(opts.network, 'SkillRegistry');
    if (!registryAddr) {
      ui.fail(`SkillRegistry not deployed on ${opts.network}`);
      process.exitCode = 1;
      return;
    }
    const reg = new SkillRegistryClient(registryAddr, provider);

    ui.title(`skill verify ${skill.id}@${skill.manifest.version}`);
    ui.info(`local manifestHash   ${skill.manifestHash}`);

    const scan = await scanSkill(skill, reg);
    ui.divider();
    if (!scan.registered) {
      ui.fail(`status               NOT REGISTERED`);
      ui.hint(`run 'ivaronix skill publish ${skill.id}' to anchor it`);
      process.exitCode = 1;
      return;
    }
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
 * `ivaronix skill install <url>` — install a skill from a remote source.
 *
 * Supported URL forms:
 *   - https://raw.githubusercontent.com/<owner>/<repo>/<branch>/path/to/SKILL.md
 *   - https://github.com/<owner>/<repo>/blob/<branch>/path/to/SKILL.md  (rewritten to raw)
 *   - file:///abs/path/to/SKILL.md  (local file)
 *
 * The fetched SKILL.md is validated through the same Zod schema used at
 * load time. The skill is then copied into `.ivaronix/skills/<id>/SKILL.md`
 * (project-local) so it overrides any same-id seed skill.
 */
skillCommand
  .command('install <url>')
  .description('Install a skill from a URL (GitHub raw, github.com blob URL, or file://)')
  .option('--id <id>', 'override the skill id (defaults to the manifest name)')
  .option('--force', 'overwrite an existing same-id skill')
  .action(async (url: string, opts: { id?: string; force?: boolean }) => {
    // Rewrite github.com/<owner>/<repo>/blob/... → raw.githubusercontent.com/<owner>/<repo>/...
    let fetchUrl = url;
    const githubBlob = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (githubBlob) {
      fetchUrl = `https://raw.githubusercontent.com/${githubBlob[1]}/${githubBlob[2]}/${githubBlob[3]}`;
    }

    ui.title(`skill install ${url}`);
    if (fetchUrl !== url) ui.info(`rewritten URL        ${fetchUrl}`);

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
