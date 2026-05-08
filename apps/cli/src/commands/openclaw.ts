import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSkillMd } from '@ivaronix/skills';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix openclaw …` — bridge commands for OpenClaw integration.
 *
 * `verify <path>` parses a SKILL.md against OpenClaw's exact frontmatter
 * contract (mirrored from openclaw/src/agents/skills/types.ts) and prints
 * PASS/FAIL with reasons. This is what proves `openclaw skills install
 * <our-skill>` will not 404 — without having to install OpenClaw locally.
 */

const VALID_KINDS = ['brew', 'node', 'go', 'uv', 'download'] as const;
type InstallKind = (typeof VALID_KINDS)[number];

type InstallSpec = {
  id?: string;
  kind?: string;
  label?: string;
  bins?: unknown;
  os?: unknown;
  formula?: string;
  package?: string;
  module?: string;
  url?: string;
  archive?: string;
  extract?: boolean;
  stripComponents?: number;
  targetDir?: string;
};

type Issue = { level: 'error' | 'warn'; field: string; msg: string };

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'string');
}

function validateInstallSpec(spec: InstallSpec, idx: number): Issue[] {
  const issues: Issue[] = [];
  const prefix = `metadata.openclaw.install[${idx}]`;
  if (!spec.kind) {
    issues.push({ level: 'error', field: `${prefix}.kind`, msg: 'missing' });
    return issues;
  }
  if (!VALID_KINDS.includes(spec.kind as InstallKind)) {
    issues.push({
      level: 'error',
      field: `${prefix}.kind`,
      msg: `must be one of: ${VALID_KINDS.join(', ')}; got "${spec.kind}"`,
    });
  }
  if (spec.bins !== undefined && !isStringArray(spec.bins)) {
    issues.push({ level: 'error', field: `${prefix}.bins`, msg: 'must be string[]' });
  }
  if (spec.os !== undefined && !isStringArray(spec.os)) {
    issues.push({ level: 'error', field: `${prefix}.os`, msg: 'must be string[]' });
  }

  switch (spec.kind as InstallKind) {
    case 'node':
      if (!spec.package) issues.push({ level: 'error', field: `${prefix}.package`, msg: 'node install requires "package"' });
      break;
    case 'uv':
      if (!spec.package) issues.push({ level: 'error', field: `${prefix}.package`, msg: 'uv install requires "package"' });
      break;
    case 'go':
      if (!spec.module) issues.push({ level: 'error', field: `${prefix}.module`, msg: 'go install requires "module"' });
      break;
    case 'brew':
      if (!spec.formula) issues.push({ level: 'error', field: `${prefix}.formula`, msg: 'brew install requires "formula"' });
      break;
    case 'download':
      if (!spec.url) issues.push({ level: 'error', field: `${prefix}.url`, msg: 'download install requires "url"' });
      else if (!/^https?:\/\//.test(spec.url)) issues.push({ level: 'error', field: `${prefix}.url`, msg: 'url must be http(s)://' });
      break;
  }
  if (!spec.label) {
    issues.push({ level: 'warn', field: `${prefix}.label`, msg: 'missing — UX-degrading but not blocking' });
  }
  return issues;
}

function validateOpenclawManifest(fm: Record<string, unknown>): Issue[] {
  const issues: Issue[] = [];
  if (typeof fm.name !== 'string' || !fm.name.length) {
    issues.push({ level: 'error', field: 'name', msg: 'missing or not a string' });
  }
  if (typeof fm.description !== 'string' || !fm.description.length) {
    issues.push({ level: 'error', field: 'description', msg: 'missing or not a string' });
  }

  const meta = fm.metadata as Record<string, unknown> | undefined;
  const oc = (meta?.openclaw ?? null) as Record<string, unknown> | null;
  if (!oc) {
    issues.push({
      level: 'error',
      field: 'metadata.openclaw',
      msg: 'missing — `openclaw skills install` cannot resolve install path',
    });
    return issues;
  }

  const installs = oc.install;
  if (!Array.isArray(installs) || installs.length === 0) {
    issues.push({
      level: 'error',
      field: 'metadata.openclaw.install',
      msg: 'must be a non-empty array of install specs',
    });
  } else {
    installs.forEach((s, i) => issues.push(...validateInstallSpec(s as InstallSpec, i)));
  }

  const requires = oc.requires as Record<string, unknown> | undefined;
  if (requires?.bins !== undefined && !isStringArray(requires.bins)) {
    issues.push({ level: 'error', field: 'metadata.openclaw.requires.bins', msg: 'must be string[]' });
  }
  if (requires?.env !== undefined && !isStringArray(requires.env)) {
    issues.push({ level: 'error', field: 'metadata.openclaw.requires.env', msg: 'must be string[]' });
  }

  if (!fm.og) {
    issues.push({
      level: 'warn',
      field: 'og',
      msg: 'no Ivaronix `og:` extension — manifest will install on OpenClaw but lose 0G semantics',
    });
  }

  return issues;
}

export const openclawCommand = new Command('openclaw').description('OpenClaw integration commands');

openclawCommand
  .command('verify <skillMdPath>')
  .description('Parse a SKILL.md and validate it against the OpenClaw frontmatter contract')
  .option('--check-env', 'also assert that every metadata.openclaw.requires.env var is set in the current shell')
  .action(async (skillMdPath: string, opts: { checkEnv?: boolean }) => {
    const abs = resolve(process.cwd(), skillMdPath);
    if (!existsSync(abs)) {
      ui.fail(`SKILL.md not found at ${skillMdPath}`);
      process.exitCode = 1;
      return;
    }

    ui.title('OpenClaw · verify SKILL.md');
    ui.info(`path                 ${abs}`);
    ui.divider();

    let parsed: { frontmatter: unknown; body: string };
    try {
      parsed = parseSkillMd(readFileSync(abs, 'utf8'));
    } catch (err) {
      ui.fail('frontmatter parse error', (err as Error).message);
      process.exitCode = 1;
      return;
    }

    const fm = parsed.frontmatter as Record<string, unknown>;
    const issues = validateOpenclawManifest(fm);
    const errors = issues.filter((i) => i.level === 'error');
    const warns = issues.filter((i) => i.level === 'warn');

    ui.info(`name                 ${String(fm.name ?? '∅')}`);
    ui.info(`description chars    ${String((fm.description as string | undefined)?.length ?? 0)}`);
    const installs = (fm.metadata as { openclaw?: { install?: unknown[] } } | undefined)?.openclaw?.install;
    ui.info(`install specs        ${Array.isArray(installs) ? installs.length : 0}`);
    if (Array.isArray(installs)) {
      installs.forEach((s, i) => {
        const spec = s as InstallSpec;
        ui.info(`  [${i}] ${spec.kind ?? '?'}/${spec.id ?? '?'} → ${spec.package ?? spec.formula ?? spec.module ?? spec.url ?? '∅'}`);
      });
    }
    const og = fm.og ? '✓' : '✗';
    ui.info(`og: extension        ${og}`);

    // --check-env: assert every requires.env var is set in the current shell.
    // Lets a CI step or pre-publish hook catch missing config before the
    // skill is invoked. Reports per-var pass/fail; missing vars fail the
    // whole verify run.
    let envFailures: string[] = [];
    if (opts.checkEnv) {
      const requires = (fm.metadata as { openclaw?: { requires?: { env?: string[] } } } | undefined)?.openclaw?.requires;
      const envVars = Array.isArray(requires?.env) ? requires!.env! : [];
      if (envVars.length === 0) {
        ui.info(`env check            (no metadata.openclaw.requires.env declared)`);
      } else {
        ui.divider();
        ui.info(`env check            ${envVars.length} required var(s)`);
        for (const v of envVars) {
          if (process.env[v]) {
            ui.pass(`  ${v.padEnd(22)} set`);
          } else {
            ui.fail(`  ${v.padEnd(22)} MISSING`);
            envFailures.push(v);
          }
        }
      }
    }
    ui.divider();

    if (errors.length === 0 && envFailures.length === 0) {
      ui.pass(`PASS · ${installs?.length ?? 0} install spec(s) valid · ${warns.length} warning(s)`);
      warns.forEach((w) => ui.hint(`warn  · ${w.field}: ${w.msg}`));
    } else {
      const total = errors.length + envFailures.length;
      ui.fail(`FAIL · ${total} error(s)`);
      errors.forEach((e) => ui.hint(`error · ${e.field}: ${e.msg}`));
      envFailures.forEach((v) => ui.hint(`error · env: ${v} not set in shell`));
      warns.forEach((w) => ui.hint(`warn  · ${w.field}: ${w.msg}`));
      process.exitCode = 1;
    }
  });
