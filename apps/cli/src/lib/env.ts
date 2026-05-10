/**
 * Re-export the canonical loadEnv from @ivaronix/runtime.
 *
 * Pre-sweep-115 this file held a SECOND env-loader implementation with
 * its own pickAlias chain. Sweep 113 surfaced the cost: the dual
 * loaders had drifted (one canonical-aware, one legacy-only), causing
 * 10 amnesty-mined correctness bugs across sweeps 108-113. Sweep 113
 * patched the local copy; sweep 115 removes the local copy entirely
 * and re-exports the canonical from @ivaronix/runtime.
 *
 * Now there is exactly ONE env loader. Future schema changes happen
 * in packages/runtime/src/env.ts and propagate automatically.
 *
 * This file stays as a thin re-export so the existing 17+ CLI command
 * imports (`from '../lib/env.js'`) keep working without rewrites.
 */
export { loadEnv, type Env } from '@ivaronix/runtime';
