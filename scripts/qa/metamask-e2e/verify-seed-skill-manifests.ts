/**
 * Regression: every first-party seed-skills/<id>/SKILL.md frontmatter
 * parses cleanly against the canonical SkillManifestSchema.
 *
 * Why this gate exists (sweep 103 finding):
 *   .claude/rules/skills.md mandates several first-party invariants:
 *     - receipt_required: true (no exceptions)
 *     - creator.fee_split block (creator + treasury === 10000)
 *     - compute_tee_required: true on user-data skills
 *     - sandbox enums match Zod canonical values
 *
 *   The runtime path (`apps/cli/src/lib/skills.ts → loadSkillFromPath`)
 *   already calls `SkillManifestSchema.safeParse(...)` and throws on
 *   failure. But that fires at runtime — when an operator runs `ivaronix
 *   doc ask` for the first time after a manifest edit. A bad manifest
 *   slips through commit, slips through CI typecheck, breaks the runtime
 *   on first use.
 *
 *   Sweep 103 audit shows all 6 first-party skills today have valid
 *   manifests. This gate captures that state — any future edit that
 *   breaks the schema fails at pre-commit instead of breaking a user's
 *   first run.
 *
 * What we check:
 *   For every `seed-skills/<id>/SKILL.md`:
 *     - Parse the YAML frontmatter (between the leading `---` markers).
 *     - Run it through the canonical SkillManifestSchema.
 *     - Fail with the Zod error if the parse fails.
 *
 *   Implicit checks via Zod:
 *     - receipt_required is a literal `true`
 *     - creator.fee_split.creator + creator.fee_split.treasury === 10000
 *     - memory_access ∈ {none, project_only, all}
 *     - shell_access ∈ {none, sandbox-only, full}
 *     - default_tier ∈ {quick, standard, high-stakes, audit}
 *     - hooks reference known stages
 *     - All required fields present
 *
 * Captures sweep 103's closure as a permanent gate. Testnet-only.
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSkillFromPath } from '@ivaronix/skills';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const SEED_SKILLS = resolve(REPO_ROOT, 'seed-skills');

interface Hit {
  path: string;
  reason: string;
}

console.log('First-party skills · SKILL.md manifests parse against canonical schema\n');

const skillDirs: string[] = [];
for (const entry of readdirSync(SEED_SKILLS)) {
  const dir = resolve(SEED_SKILLS, entry);
  if (!statSync(dir).isDirectory()) continue;
  // Skip imports/ — those are upstream-owned; their manifests don't
  // have to match our first-party convention exactly (they might use
  // different fee splits, missing fields, etc.).
  if (entry === 'imports') continue;
  const skillMd = resolve(dir, 'SKILL.md');
  if (existsSync(skillMd)) skillDirs.push(dir);
}

const hits: Hit[] = [];

for (const dir of skillDirs) {
  const skillMd = resolve(dir, 'SKILL.md');
  try {
    // loadSkillFromPath does the YAML parse + SkillManifestSchema validation
    // in one call. Throws on either failure.
    const loaded = loadSkillFromPath(dir);

    // Defense-in-depth: Zod confirms creator + treasury === 10000 via a
    // schema refinement, but log loudly here for the failure message if
    // the schema's refinement is ever loosened.
    const fs = loaded.manifest.og?.creator?.fee_split;
    if (fs) {
      const sum = fs.creator + fs.treasury;
      if (sum !== 10000) {
        hits.push({
          path: skillMd,
          reason: `fee_split sums to ${sum}, expected 10000 (creator+treasury)`,
        });
      }
    }
  } catch (err) {
    hits.push({
      path: skillMd,
      reason: (err as Error).message.split('\n')[0] ?? 'unknown error',
    });
  }
}

console.log(`  scanned ${skillDirs.length} first-party skill manifest(s)`);

if (hits.length === 0) {
  console.log(`  PASS · every first-party SKILL.md parses against the canonical schema`);
  process.exit(0);
}

console.error(`  FAIL · ${hits.length} manifest issue(s):\n`);
for (const h of hits) {
  const rel = relative(REPO_ROOT, h.path).replace(/\\/g, '/');
  console.error(`    ${rel}`);
  console.error(`      ${h.reason}`);
}
console.error('\n  fix: edit the SKILL.md frontmatter to match `packages/skills/src/manifest.ts`');
console.error('       SkillManifestSchema. Hot fields: receipt_required, creator.fee_split,');
console.error('       memory_access enum, shell_access enum, default_tier, hooks shape.');
process.exit(1);
