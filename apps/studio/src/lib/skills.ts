import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { loadSkillsFromDir, findSkill, type LoadedSkill } from '@ivaronix/skills';

/**
 * Server-side skill discovery for the Studio. Walks parent dirs from cwd to
 * find seed-skills/ + .ivaronix/skills/ — same as the CLI helper but with
 * additional sample-input lookup for the detail page.
 */
export function skillSearchDirs(): string[] {
  const cwd = process.cwd();
  const local = resolve(cwd, '.ivaronix', 'skills');
  let dir = cwd;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'seed-skills');
    if (existsSync(candidate)) return [local, candidate];
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [local];
}

export function loadAllSkills(): LoadedSkill[] {
  const seen = new Set<string>();
  const out: LoadedSkill[] = [];
  for (const d of skillSearchDirs()) {
    for (const s of loadSkillsFromDir(d)) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}

export function findSkillByIdServer(id: string): LoadedSkill | null {
  return findSkill(id, skillSearchDirs());
}

export interface SampleFile {
  filename: string;
  contentExcerpt: string;
  byteSize: number;
}

export function loadSampleFiles(skill: LoadedSkill, maxBytes = 2400): SampleFile[] {
  const testsDir = join(skill.rootPath, 'tests');
  if (!existsSync(testsDir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(testsDir);
  } catch {
    return [];
  }
  const out: SampleFile[] = [];
  for (const entry of entries) {
    const file = join(testsDir, entry);
    try {
      const stat = statSync(file);
      if (!stat.isFile()) continue;
      const content = readFileSync(file, 'utf8');
      out.push({
        filename: entry,
        contentExcerpt: content.slice(0, maxBytes),
        byteSize: stat.size,
      });
    } catch { /* skip unreadable */ }
  }
  return out;
}
