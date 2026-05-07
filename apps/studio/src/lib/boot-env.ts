/**
 * Lazy `.env` loader for server-side route handlers. Walks parent directories
 * from cwd to find a `.env` file (so the workspace-root .env is picked up
 * even though Next runs from `apps/studio/`).
 *
 * Idempotent: subsequent calls are no-ops once the env has been loaded.
 *
 * Lives outside instrumentation.ts because Next 15.0.3 bundles instrumentation
 * for both edge + nodejs runtimes, and `dotenv` requires `crypto` which the
 * edge bundle can't resolve.
 */

let loaded = false;

export async function ensureEnv(): Promise<void> {
  if (loaded) return;
  loaded = true;
  // Avoid running on edge runtime
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { config } = await import('dotenv');
    const { existsSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    let dir = process.cwd();
    for (let i = 0; i < 8; i++) {
      const candidate = resolve(dir, '.env');
      if (existsSync(candidate)) {
        config({ path: candidate });
        return;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* dotenv missing or unreadable — fall back to whatever process.env already has */
  }
}
