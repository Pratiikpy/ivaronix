/**
 * Loads a Google-hosted font for `next/og`'s `ImageResponse`.
 *
 * Google Fonts serves `.woff2` only to browser User-Agents — a bare
 * server-side `fetch()` gets a `.ttf` `src` line back instead. The OG
 * routes' woff2-only regex missed that, so the loader returned `[]`, and
 * `new ImageResponse(..., { fonts: [] })` throws (satori needs at least one
 * font) → the route 500s in production. Sending a browser UA gets the woff2
 * variant, and the regex falls back to `.ttf` if Google ever changes again.
 *
 * Returns `[]` on any failure (font fetch is best-effort). Callers MUST pass
 * `undefined` — not `[]` — to `ImageResponse` when this is empty, so it
 * falls back to its own bundled default font instead of throwing.
 */
export type OgFont = { name: string; data: ArrayBuffer; style: 'normal'; weight: 400 | 600 };

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function loadGoogleFont(name: string, spec: string, weight: 400 | 600): Promise<OgFont[]> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, {
      headers: { 'User-Agent': BROWSER_UA },
    }).then((r) => r.text());
    const url =
      css.match(/src:\s*url\((https:\/\/[^)]+\.woff2)\)/)?.[1] ??
      css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
    if (!url) return [];
    const data = await fetch(url).then((r) => r.arrayBuffer());
    return [{ name, data, style: 'normal', weight }];
  } catch {
    return [];
  }
}
