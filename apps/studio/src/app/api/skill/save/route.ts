import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/skill/save
 *
 * Body: { skillId: string, manifest: string }
 *
 * Writes the manifest to `.ivaronix/skills/<skillId>/SKILL.md` so the
 * CLI's `findSkill` helper picks it up immediately. Skill ids are
 * lowercase + dash-separated; we reject anything else to avoid path
 * traversal.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: { skillId?: string; manifest?: string };
  try {
    body = (await req.json()) as { skillId?: string; manifest?: string };
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const { skillId, manifest } = body;
  if (!skillId || !manifest) {
    return NextResponse.json({ error: 'skillId and manifest required' }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(skillId)) {
    return NextResponse.json(
      { error: 'skillId must match /^[a-z0-9][a-z0-9-]*[a-z0-9]$/ (no slashes, no dots, no leading/trailing dash)' },
      { status: 400 },
    );
  }
  if (manifest.length > 64_000) {
    return NextResponse.json({ error: 'manifest too large (limit 64 KiB)' }, { status: 413 });
  }

  // Find the workspace root by walking up looking for pnpm-workspace.yaml.
  let dir = process.cwd();
  let root: string | null = null;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) { root = dir; break; }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (!root) {
    return NextResponse.json({ error: 'workspace root not found' }, { status: 500 });
  }

  const target = resolve(root, '.ivaronix', 'skills', skillId, 'SKILL.md');
  // Refuse to overwrite an existing skill — caller can bump the version
  // and try again, or delete the dir manually first.
  if (existsSync(target)) {
    return NextResponse.json(
      { error: `skill "${skillId}" already exists at ${target}. Bump the version or remove the dir.` },
      { status: 409 },
    );
  }

  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, manifest, 'utf8');
  } catch (err) {
    return NextResponse.json({ error: `write failed: ${(err as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({ path: target, skillId }, { status: 201 });
}
