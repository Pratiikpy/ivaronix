/**
 * Loads a Google-hosted font for `next/og`'s `ImageResponse`.
 *
 * Two gotchas this navigates:
 *   1. `next/og`'s satori renderer parses TTF / OTF / WOFF — NOT WOFF2
 *      (Brotli-compressed). Google Fonts' CSS API serves a `.woff2` `src`
 *      line to browser User-Agents and a `.ttf` line to everything else, so
 *      we deliberately fetch with NO browser UA and match the `.ttf` URL.
 *   2. `ImageResponse` has no usable bundled default font in the Vercel
 *      function bundle — passing `fonts: []` (or `undefined`) throws
 *      "No fonts are loaded." So callers must only render once this returns
 *      a non-empty array.
 *
 * Returns `[]` on any failure (network / parse). If that ever happens at
 * request time the OG route 500s; bundling a fallback `.ttf` for full
 * offline robustness is queued in docs/USER_TODO.md.
 */
export type OgFont = { name: string; data: ArrayBuffer; style: 'normal'; weight: 400 | 600 };

export async function loadGoogleFont(name: string, spec: string, weight: 400 | 600): Promise<OgFont[]> {
  try {
    // No User-Agent header → Google Fonts answers with the `.ttf` variant
    // (satori can't parse `.woff2`).
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`).then((r) => r.text());
    const url =
      css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/)?.[1] ??
      css.match(/src:\s*url\((https:\/\/[^)]+\.otf)\)/)?.[1] ??
      css.match(/src:\s*url\((https:\/\/[^)]+\.woff)\)/)?.[1]; // WOFF1 only — never .woff2
    if (!url) return [];
    const data = await fetch(url).then((r) => r.arrayBuffer());
    if (data.byteLength === 0) return [];
    return [{ name, data, style: 'normal', weight }];
  } catch {
    return [];
  }
}
