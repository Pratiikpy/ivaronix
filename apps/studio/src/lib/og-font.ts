import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Bundled brand font for `next/og`'s `ImageResponse`.
 *
 * Why bundled, not fetched: satori (inside `next/og`) parses TTF / OTF /
 * WOFF — not WOFF2 — and `ImageResponse` has no usable default font in the
 * Vercel function bundle, so `fonts: []` / `undefined` throws "No fonts are
 * loaded." Fetching from fonts.googleapis.com at request time was both
 * format-fragile (browser UAs get .woff2) and a network dependency that
 * 500'd the route when it failed. A vendored `.ttf` removes both problems.
 *
 * `Outfit-SemiBold.ttf` is the weight-600 TTF straight from Google Fonts
 * (the brand display weight per CLAUDE.md §10). 48 KB. The
 * `new URL(..., import.meta.url)` pattern is what `@vercel/og` itself uses
 * for its default font, so Next's bundler emits the asset alongside the
 * compiled module and @vercel/nft traces it into the function.
 */
export type OgFont = { name: string; data: ArrayBuffer; style: 'normal'; weight: 600 };

let cached: ArrayBuffer | null = null;

export async function loadBrandFont(): Promise<OgFont[]> {
  if (!cached) {
    const buf = await readFile(fileURLToPath(new URL('./fonts/Outfit-SemiBold.ttf', import.meta.url)));
    cached = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  return [{ name: 'Outfit', data: cached, style: 'normal', weight: 600 }];
}
