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
  ],
  legalComments: 'linked',
  sourcemap: false,
  logLevel: 'info',
});

chmodSync(OUT, 0o755);
console.log(`bundled to ${OUT}`);

writeFileSync(
  resolve(OUT_DIR, '..', 'README.md'),
  '# ivaronix\n\n> The 0G Agent Operating System.\n>\n> Catch the risks. Keep the receipts.\n\n```bash\nnpx ivaronix doctor --network\nnpx ivaronix doc ask contract.pdf "find risky clauses" --skill private-doc-review --consensus\n```\n\nFull docs: https://ivaronix.app\n',
);
console.log('wrote README.md');
