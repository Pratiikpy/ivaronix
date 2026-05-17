/**
 * Resolve a user-supplied path from the user's invocation directory.
 *
 * pnpm and npm set INIT_CWD to the directory where the script was
 * invoked. process.cwd() points at the package's own directory when
 * running via `pnpm --filter @ivaronix/cli dev <cmd>`, which means
 * relative paths the user typed (e.g., `seed-skills/foo/SKILL.md`)
 * fail to resolve.
 *
 * Bug-49 class: every CLI command that accepts a user-supplied path
 * MUST route through this helper. doc.ts (aaeabe2) was the first; the
 * pattern caught openclaw.ts (b008c48) on re-USE.
 *
 * If neither INIT_CWD nor cwd is set, fall back to '.' so resolve()
 * still produces a valid path; callers will fail open on missing file.
 */
import { resolve as pathResolve } from 'node:path';

export function userCwd(): string {
  return process.env.INIT_CWD ?? process.cwd();
}

export function resolveUserPath(input: string): string {
  return pathResolve(userCwd(), input);
}
