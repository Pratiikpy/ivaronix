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
