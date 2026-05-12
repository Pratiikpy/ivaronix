import { Command } from 'commander';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { sha256HexAsync } from '@ivaronix/core';
import { loadSkillsFromDir, RegistrySchema, type Registry, type RegistryEntry } from '@ivaronix/skills';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * Export the canonical skills/registry.json (planning-002 W8).
 *
 * Walks both `seed-skills/<id>/` (first-party) and
 * `seed-skills/imports/<id>/` (community ports of awesome-claude-skills).
 * For each, reads the SKILL.md frontmatter, hashes it, and emits an entry
 * in the registry. Output is validated against the zod schema before write.
 *
 * Discovery layer only — the on-chain SkillRegistry contract is the
 * canonical truth. If a registry entry's manifestHash does not match the
 * chain's record, the chain wins. The `on_chain` flag is left false at
 * export time and can be filled in by a separate `verify` pass that calls
 * SkillRegistryClient. We do not block export on the chain check so the
 * registry stays generatable offline.
 */

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function addRegistryExportCommand(parent: Command): void {
  parent
    .command('export')
    .description('Generate canonical skills/registry.json — public discovery catalogue (planning-002 W8)')
    .option('--out <path>', 'output path (relative to repo root)', 'skills/registry.json')
    .option('--include-imports', 'include the 150 community-ported imports/* skills (default: yes)', true)
    .action(async (opts: { out: string; includeImports: boolean }) => {
      const env = loadEnv();
      const repoRoot = findRepoRoot();
      const seedDir = resolve(repoRoot, 'seed-skills');
      const importsDir = resolve(seedDir, 'imports');

      ui.title('Skills registry export');
      ui.info(`repo root            ${repoRoot}`);
      ui.info(`network              ${env.network}`);

      // Load first-party (skip the `imports` subdir; it's loaded separately)
      const firstParty = loadSkillsFromDir(seedDir).filter((s) => !s.rootPath.includes(`${seedDir}${'/'}imports`) && !s.rootPath.includes(`${seedDir}\\imports`));
      ui.pass(`first-party found    ${firstParty.length}`);

      const imports = opts.includeImports && existsSync(importsDir) ? loadSkillsFromDir(importsDir) : [];
      ui.pass(`imports found        ${imports.length}`);

      const all = [...firstParty, ...imports];
      ui.pending(`hashing ${all.length} manifests...`);

      const skills: RegistryEntry[] = [];
      for (const s of all) {
        const isImport = s.rootPath.includes(`${'imports'}`) && (s.rootPath.includes(`${seedDir}/imports`) || s.rootPath.includes(`${seedDir}\\imports`));
        const skillDirName = basename(s.rootPath);
        // Read raw SKILL.md to hash the frontmatter exactly as filesystem stores it.
        let manifestHash: string | undefined;
        try {
          const raw = readFileSync(resolve(s.rootPath, 'SKILL.md'), 'utf8');
          // Hash up through the closing `---` of frontmatter to keep it body-agnostic.
          const fmEnd = raw.indexOf('\n---', raw.indexOf('---') + 3);
          const fmText = fmEnd > 0 ? raw.slice(0, fmEnd + 4) : raw;
          manifestHash = (await sha256HexAsync(new TextEncoder().encode(fmText))) as `sha256:${string}`;
        } catch { /* skip; entry will lack hash */ }

        // Path relative to repo root for portability.
        const relPath = s.rootPath.replace(repoRoot.replace(/\\/g, '/'), '').replace(repoRoot, '').replace(/^[\\/]+/, '').replace(/\\/g, '/');

        skills.push({
          id: s.id,
          version: s.manifest.version,
          description: s.manifest.description,
          source: isImport ? 'imports' : 'first-party',
          default_tier: s.manifest.og.consensus.default_tier,
          burn_auto: s.manifest.og.burn.auto_enable,
          path: `${relPath}/SKILL.md`,
          ...(manifestHash ? { manifestHash } : {}),
          ...(s.manifest.og.creator?.fee_split
            ? {
                fee_split: {
                  creator: s.manifest.og.creator.fee_split.creator,
                  treasury: s.manifest.og.creator.fee_split.treasury,
                },
              }
            : {}),
          on_chain: false,
        });
        // Also emit a console line for transparency
        if (skills.length <= 8 || skills.length === all.length) {
          ui.info(`${skills.length}/${all.length}  ${s.id.padEnd(36)}  ${(manifestHash ?? '—').slice(0, 24)}…`);
        } else if (skills.length === 9) {
          ui.info(`...  ${all.length - 9} more (use --quiet to silence)`);
        }
      }

      // Sort: first-party alphabetical, then imports alphabetical.
      skills.sort((a, b) => {
        if (a.source !== b.source) return a.source === 'first-party' ? -1 : 1;
        return a.id.localeCompare(b.id);
      });

      const registry: Registry = {
        // JSON Schema $schema URIs are conventionally stable identifiers,
        // not resolvable URLs. The Zod literal in packages/skills/src/
        // registry-schema.ts locks this exact string. Changing it would
        // break backwards-compat with every existing registry export.
        // The 'ivaronix.studio' host doesn't resolve via DNS — that's
        // expected behavior; the URI identifies the schema version, not
        // a URL to fetch.
        $schema: 'https://ivaronix.studio/schemas/skills-registry/1.0',
        generated_at: new Date().toISOString(),
        total: skills.length,
        counts: {
          first_party: skills.filter((s) => s.source === 'first-party').length,
          imports: skills.filter((s) => s.source === 'imports').length,
        },
        network: env.network as 'testnet' | 'mainnet',
        skills,
      };

      // Validate before write — refuse to ship a malformed registry.
      const result = RegistrySchema.safeParse(registry);
      if (!result.success) {
        ui.fail('registry failed schema validation', JSON.stringify(result.error.issues.slice(0, 3)));
        process.exitCode = 1;
        return;
      }

      const outPath = resolve(repoRoot, opts.out);
      // Ensure parent dir exists (skills/ may not be tracked initially).
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n');
      ui.divider();
      ui.pass(`exported             ${outPath}`);
      ui.pass(`total                ${registry.total} skills (${registry.counts.first_party} first-party + ${registry.counts.imports} imports)`);
      ui.hint(`Reviewers can browse this catalogue without a wallet. Each entry's manifestHash is computable; on_chain flag verifiable via SkillRegistryClient.`);
    });
}
