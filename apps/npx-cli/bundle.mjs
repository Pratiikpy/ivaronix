/**
 * Bundles the entire `@ivaronix/cli` (and every workspace dep it pulls in)
 * into a single ESM file at `dist/ivaronix.mjs`. The result is shipped to
 * npm under the bare package name `ivaronix` so `npx ivaronix doc ask ...`
 * just works without users needing to clone the monorepo.
 */

import esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, chmodSync, mkdirSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(__dirname, '../cli/src/bin/ivaronix.ts');
const OUT_DIR = resolve(__dirname, 'dist');
const OUT = resolve(OUT_DIR, 'ivaronix.mjs');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

await esbuild.build({
  entryPoints: [ENTRY],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: OUT,
  // entry has its own #!/usr/bin/env node shebang; don't double it
  external: [
    'better-sqlite3',
    'fsevents',
    'dotenv',
    '@0gfoundation/0g-compute-ts-sdk',
    // Native .node bindings — esbuild can't bundle these. The npm
    // install step on the user's machine pulls the platform-specific
    // binary down. Pulled in as a transitive dep via the embedding /
    // memory layers (transformers.js → onnxruntime-node).
    'onnxruntime-node',
    '@xenova/transformers',
    // ink's React DevTools integration is optional (dev-mode only) but
    // esbuild fails closed when the import isn't resolvable. Mark it
    // external so the bundle skips it entirely; ink falls back to
    // production rendering at runtime when react-devtools-core isn't
    // installed.
    'react-devtools-core',
  ],
  legalComments: 'linked',
  sourcemap: false,
  logLevel: 'info',
});

chmodSync(OUT, 0o755);
console.log(`bundled to ${OUT}`);

// Per planning-003 §A.5.22 the npx-cli README is now hand-curated
// source (~30 lines: tagline + install + verify-output transcript +
// command bullets + setup + license). The bundle script used to
// overwrite it with a 7-line stub on every build, which silently
// erased the curated copy. The README is committed alongside this
// script and ships in the npm package via `files: ["dist", "README.md", "LICENSE"]`
// in package.json — no regeneration needed.
