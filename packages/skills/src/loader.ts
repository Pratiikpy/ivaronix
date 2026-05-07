import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { SkillManifestSchema, type SkillManifest } from './manifest.js';

/**
 * A loaded skill = parsed SKILL.md frontmatter + body, plus the on-disk path
 * and a content-addressable manifest hash (used for on-chain anchoring Day 10).
 */
export interface LoadedSkill {
  id: string;             // skill folder name == manifest.name
  manifest: SkillManifest;
  systemPromptBody: string; // markdown body of SKILL.md (the prompt)
  rootPath: string;       // absolute path to the skill folder
  manifestHash: `sha256:${string}`; // content-addressable digest of canonical manifest JSON
}

/** Parse a SKILL.md file: split YAML frontmatter from markdown body. */
export function parseSkillMd(content: string): { frontmatter: unknown; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, body: content };
  }
  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }
  const fmText = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 4).trim();
  const frontmatter = parseYaml(fmText);
  return { frontmatter, body };
}

/** Compute a content-addressable hash of the canonical manifest JSON. */
export function manifestHash(manifest: SkillManifest): `sha256:${string}` {
  const sortKeys = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    if (typeof obj !== 'object') return obj;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[k] = sortKeys((obj as Record<string, unknown>)[k]);
    }
    return sorted;
  };
  // Strip the anchor.manifest_hash field itself before hashing (otherwise self-reference)
  const stripped: SkillManifest = JSON.parse(JSON.stringify(manifest));
  if (stripped.og.anchor) delete stripped.og.anchor.manifest_hash;
  const json = JSON.stringify(sortKeys(stripped));
  return `sha256:${createHash('sha256').update(json, 'utf8').digest('hex')}` as `sha256:${string}`;
}

/** Load a skill from a folder containing SKILL.md. */
export function loadSkillFromPath(folderPath: string): LoadedSkill {
  const skillMdPath = resolve(folderPath, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    throw new Error(`No SKILL.md at ${folderPath}`);
  }
  const content = readFileSync(skillMdPath, 'utf8');
  const { frontmatter, body } = parseSkillMd(content);

  const parsed = SkillManifestSchema.safeParse(frontmatter);
  if (!parsed.success) {
    throw new Error(`Invalid SKILL.md frontmatter at ${folderPath}: ${parsed.error.message}`);
  }
  const manifest = parsed.data;

  // The skill folder name should match manifest.name (or at least be sluggable)
  const id = basename(folderPath);

  return {
    id,
    manifest,
    systemPromptBody: body,
    rootPath: resolve(folderPath),
    manifestHash: manifestHash(manifest),
  };
}

/**
 * Discover all skills under a directory. When a sub-directory does NOT contain
 * a SKILL.md (e.g. `seed-skills/imports/`), recurse one level deeper so
 * grouping folders work. Recursion is capped at depth 2 to avoid surprise
 * walks of deep node_modules-style trees.
 */
export function loadSkillsFromDir(dirPath: string, depth = 0): LoadedSkill[] {
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath);
  const skills: LoadedSkill[] = [];
  for (const entry of entries) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const subdir = join(dirPath, entry);
    if (!statSync(subdir).isDirectory()) continue;
    const skillMd = join(subdir, 'SKILL.md');
    if (existsSync(skillMd)) {
      try {
        skills.push(loadSkillFromPath(subdir));
      } catch (err) {
        console.error(`Skipping ${entry}: ${(err as Error).message}`);
      }
    } else if (depth < 2) {
      // Container dir (e.g. seed-skills/imports/) — descend one level
      skills.push(...loadSkillsFromDir(subdir, depth + 1));
    }
  }
  return skills;
}

/**
 * Find a skill by id starting from the user's project + falling back to
 * seed-skills. Searches one level of grouping folders (e.g. `imports/`) too,
 * matching the recursive walk in `loadSkillsFromDir`.
 */
export function findSkill(id: string, searchDirs: string[]): LoadedSkill | null {
  for (const dir of searchDirs) {
    const direct = join(dir, id);
    if (existsSync(join(direct, 'SKILL.md'))) return loadSkillFromPath(direct);
    // Try one-level-down containers (e.g. dir/imports/<id>/SKILL.md)
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const sub = join(dir, entry, id);
      if (existsSync(join(sub, 'SKILL.md'))) return loadSkillFromPath(sub);
    }
  }
  return null;
}
