import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Bundled brand font for `next/og`'s `ImageResponse`.
 *
 * Why bundled, not fetched: satori (inside `next/og`) parses TTF / OTF /
 * WOFF — not WOFF2 — and `ImageResponse` has no usable default font in the
 * Vercel function bundle, so `fonts: []` / `undefined` throws "No fonts are
 * loaded." Fetching from fonts.googleapis.com at request time was both
 * format-fragile (browser UAs get .woff2) and a request-time network
 * dependency. A vendored `.ttf` removes both problems.
 *
 * `Outfit-SemiBold.ttf` is the weight-600 TTF straight from Google Fonts
 * (the brand display weight per CLAUDE.md §10), 48 KB. The
 * `new URL(..., import.meta.url)` pattern is what `@vercel/og` itself uses
 * for its default font, so Next's bundler emits the asset alongside the
 * compiled module and @vercel/nft traces it into each OG function.
 *
 * Note: `fileURLToPath` is fed `.href` (a string), not the `URL` object —
 * webpack's URL-asset rewrite can hand back a `URL` from a different module
 * realm, which `fileURLToPath` rejects with ERR_INVALID_ARG_TYPE; the
 * string form sidesteps that.
 *
 * Returns `[]` if the read ever fails — callers must treat empty as "render
 * something other than an ImageResponse" (a bare 503), since satori can't
 * lay out text with zero fonts.
 */
export type OgFont = { name: string; data: ArrayBuffer; style: 'normal'; weight: 600 };

let cached: ArrayBuffer | null = null;

export async function loadBrandFont(): Promise<OgFont[]> {
  try {
    if (!cached) {
      const url = new URL('./fonts/Outfit-SemiBold.ttf', import.meta.url);
      const buf = await readFile(fileURLToPath(url.href));
      if (buf.byteLength === 0) return [];
      cached = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    return [{ name: 'Outfit', data: cached, style: 'normal', weight: 600 }];
  } catch {
    return [];
  }
}
