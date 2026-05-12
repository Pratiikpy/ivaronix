/**
 * Regenerate `apps/studio/src/lib/fonts/Outfit-SemiBold.b64.ts` from the
 * source TTF.
 *
 * Why this exists: `next/og`'s `ImageResponse` (satori) needs a TTF font.
 * Vendoring the .ttf and loading it via `new URL(..., import.meta.url)` +
 * `fileURLToPath` works in `next dev` and local `next build`, but throws
 * `ERR_INVALID_ARG_TYPE` on Vercel runtime because webpack's URL-asset
 * rewrite hands back a `URL` from a different module realm than
 * `node:url`'s native check expects. See `docs/USER_TODO.md` §B-V2-2 for
 * the 4 attempted fixes and why this base64-inline approach (option 4)
 * is the "guaranteed to work" path.
 *
 * Run: `pnpm tsx scripts/diag/regenerate-og-font-b64.ts`
 *
 * Output: `apps/studio/src/lib/fonts/Outfit-SemiBold.b64.ts`
 *
 * Size: ~48 KB TTF → ~65 KB base64. Inlined string lives in one file,
 * imported by `apps/studio/src/lib/og-font.ts` which decodes via
 * `Buffer.from(b64, 'base64')` at module-init.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const TTF_PATH = resolve(REPO_ROOT, 'apps/studio/src/lib/fonts/Outfit-SemiBold.ttf');
const OUT_PATH = resolve(REPO_ROOT, 'apps/studio/src/lib/fonts/Outfit-SemiBold.b64.ts');

const buf = readFileSync(TTF_PATH);
const b64 = buf.toString('base64');

const lines: string[] = [];
for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));

const header =
  `// AUTO-GENERATED · do not edit by hand · regenerate with:\n` +
  `//   pnpm tsx scripts/diag/regenerate-og-font-b64.ts\n` +
  `//\n` +
  `// Source: apps/studio/src/lib/fonts/Outfit-SemiBold.ttf (${buf.length} bytes · weight 600 TTF from Google Fonts)\n` +
  `// Base64 size: ${b64.length} chars (~${Math.round(b64.length / 1024)} KB inline)\n` +
  `// Why inline: see apps/studio/src/lib/og-font.ts header for the Vercel ImageResponse\n` +
  `// font-load failure (\`ERR_INVALID_ARG_TYPE\` from \`fileURLToPath\` on the URL-asset-\n` +
  `// rewritten import URL). USER_TODO §B-V2-2 (✅ SHIPPED 2026-05-12) documents the\n` +
  `// closure chain.\n` +
  `//\n` +
  `// Trade-off: ~65 KB of inline base64 in the serverless bundle. The next-best\n` +
  `// alternative (publishing the TTF as its own npm package) is more moving parts\n` +
  `// for one font. Note: the font-path fix was necessary but not sufficient — the\n` +
  `// route 500 also required removing the satori-unsupported SVG <text> element\n` +
  `// (commit 3fbb570).\n\n`;

const body = `export const OUTFIT_SEMIBOLD_B64 =\n  ${lines.map((l) => `'${l}'`).join(' +\n  ')};\n`;

writeFileSync(OUT_PATH, header + body);

console.log(`✓ regenerated ${OUT_PATH}`);
console.log(`  source ${TTF_PATH} (${buf.length} bytes)`);
console.log(`  output ${b64.length} chars base64 in ${lines.length} lines`);
