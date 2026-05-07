import { Command } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import {
  loadSkillsFromDir,
  findSkill,
  type LoadedSkill,
} from '@ivaronix/skills';
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
