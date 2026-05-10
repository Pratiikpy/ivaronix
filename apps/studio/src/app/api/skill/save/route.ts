import { NextResponse } from 'next/server';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { checkRateLimit, rateLimitHeaders, readClientIp } from '@/lib/rate-limit';
import { readSession, SESSION_COOKIE_NAME } from '@/lib/siwe-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Runtime body validation per HALF_BAKED §J-2 (sweep 146).
 * Pre-Zod, the body was a TS cast + ad-hoc checks. Now the structural
 * shape is enforced once, returning a clean 400 with `issues[]` on
 * malformed input. Caps:
 *   skillId  matches /^[a-z0-9][a-z0-9-]*[a-z0-9]$/ (no path traversal,
 *            no leading/trailing dash)
 *   manifest ≤ 64 KiB (operator-paid disk write + YAML parse budget)
 */
const SaveBodySchema = z.object({
  skillId: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  manifest: z.string().min(20).max(64_000),
});

/**
 * POST /api/skill/save
 *
 * Body: { skillId: string, manifest: string }
 *
 * K-9 fix per HALF_BAKED.md:
 *  - Requires an active SIWE session. Without one we'd be writing files to
 *    the operator's filesystem on behalf of an anonymous attacker — and the
 *    next CLI run would load that manifest's hooks (RCE-class).
 *  - Writes are scoped to a per-wallet sandbox: `.ivaronix/skills/<wallet>/<skillId>/`.
 *    Cross-wallet writes are blocked by the path itself.
 *  - Manifest is parsed as YAML + validated for the dangerous fields:
 *    `og.hooks.*` paths must stay inside the per-wallet sandbox; nothing
 *    is allowed to point at /etc, ~/, ../, or absolute filesystem paths.
 *  - Per-wallet rate limit: 5 saves/hr (K-9).
 *
 * Skill ids are still constrained by the `^[a-z0-9][a-z0-9-]*[a-z0-9]$`
 * regex to avoid path traversal at the leaf level.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // K-9: per-IP rate limit even before parsing the body, to bound DoS load.
  const clientIp = readClientIp(req.headers);
  const ipLimit = checkRateLimit('ip', clientIp);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: 'rate limit exceeded (per-IP)' },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  // K-9: require an active SIWE session.
  const sessionCookie = req.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1];
  const session = readSession(sessionCookie);
  if (!session) {
    return NextResponse.json(
      { error: 'authentication required — POST /api/auth/siwe/verify first' },
      { status: 401 },
    );
  }

  // K-9: per-wallet rate limit (5 saves/hr).
  const walletLimit = checkRateLimit('skill-save', session.wallet);
  if (!walletLimit.ok) {
    return NextResponse.json(
      { error: 'rate limit exceeded (per-wallet skill saves)' },
      { status: 429, headers: rateLimitHeaders(walletLimit) },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const parsed = SaveBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid body',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  }
  const { skillId, manifest } = parsed.data;

  // K-9: parse + validate manifest YAML. Reject any hook path that escapes
  // the per-wallet sandbox or contains shell-injection characters.
  const fmMatch = manifest.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  if (!fmMatch) {
    return NextResponse.json(
      { error: 'manifest must start with YAML frontmatter (--- … ---)' },
      { status: 400 },
    );
  }
  // fmMatch[1] is the YAML frontmatter capture; the regex has one capture
  // group, and we only reach this line if fmMatch was non-null, so [1] is
  // present. noUncheckedIndexedAccess (tsconfig.base.json) widens it to
  // string|undefined; coalesce to '' so the type narrows.
  let parsedFm: unknown;
  try {
    parsedFm = parseYaml(fmMatch[1] ?? '');
  } catch (err) {
    return NextResponse.json(
      { error: `manifest YAML parse error: ${(err as Error).message}` },
      { status: 400 },
    );
  }
  const fmAny = parsedFm as { og?: { hooks?: Record<string, unknown> } } | null;
  const hooksMap = fmAny?.og?.hooks;
  if (hooksMap && typeof hooksMap === 'object') {
    for (const [stage, refs] of Object.entries(hooksMap)) {
      if (!Array.isArray(refs)) continue;
      for (const ref of refs) {
        if (typeof ref !== 'string') continue;
        // Built-in hook names like "log-call" are fine. Reject path-like
        // references that escape the sandbox or contain shell metachars.
        if (
          ref.startsWith('/') ||
          ref.startsWith('~') ||
          ref.includes('..') ||
          ref.includes(';') ||
          ref.includes('&&') ||
          ref.includes('|') ||
          ref.includes('`') ||
          ref.includes('$(')
        ) {
          return NextResponse.json(
            {
              error: `hooks.${stage} contains an unsafe path or shell metachar: ${ref}`,
            },
            { status: 400 },
          );
        }
      }
    }
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

  // K-9: per-wallet sandbox. The session wallet (lowercase 0x…40-hex) is the
  // path namespace; cross-wallet writes are impossible because the path is
  // bound to session.wallet, not to anything the body controls.
  const target = resolve(root, '.ivaronix', 'skills', session.wallet, skillId, 'SKILL.md');

  // Defence in depth: confirm the resolved target is genuinely inside the
  // per-wallet sandbox. Catches OS-level resolve quirks even though the
  // skillId regex already blocks traversal.
  const sandboxRoot = resolve(root, '.ivaronix', 'skills', session.wallet) + (process.platform === 'win32' ? '\\' : '/');
  if (!target.startsWith(sandboxRoot)) {
    return NextResponse.json(
      { error: 'resolved path escaped the per-wallet sandbox' },
      { status: 400 },
    );
  }

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

  return NextResponse.json({ path: target, skillId, wallet: session.wallet }, { status: 201 });
}
