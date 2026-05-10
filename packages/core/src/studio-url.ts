/**
 * Resolve the Studio base URL for proof links printed by the CLI,
 * telegram-bot, and any other surface that emits user-visible URLs.
 *
 * Closes HALF_BAKED §J-10. Pre-this-helper, 9 sites across CLI + 1
 * telegram-bot site hardcoded `http://localhost:3300/...` directly
 * in operator output. The proof URL printed is the one a judge or
 * counterparty copies — when the operator's Studio is on Vercel
 * production, that URL must reflect the deployment, not localhost.
 *
 * Alias chain mirrors packages/runtime/src/env.ts conventions:
 *   IVARONIX_STUDIO_BASE  (canonical)
 *   → STUDIO_BASE         (legacy)
 *   → http://localhost:3300  (dev fallback)
 *
 * @example
 *   ui.hint(`Public proof: ${studioUrl(`/r/${onChainId}`)}`);
 */
export function studioUrl(path: string): string {
  const base =
    process.env.IVARONIX_STUDIO_BASE ??
    process.env.STUDIO_BASE ??
    'http://localhost:3300';
  const trimmed = base.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${trimmed}${suffix}`;
}
