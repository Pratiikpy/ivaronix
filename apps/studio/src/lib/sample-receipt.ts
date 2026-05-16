import { getNetwork } from './chain';

/**
 * The canonical "sample receipt" used in CTAs, docs examples, embed
 * code samples, and footer links. Resolves to a real anchored receipt
 * on the active network:
 *
 *   mainnet (Aristotle · chainId 16661) → id 66 (bundled fixture · quick-tier
 *     private-doc-review · TIER 1 TEE · FULLY VERIFIED ✓)
 *   testnet (Galileo · chainId 16602) → id 1004 (legacy testnet sample)
 *
 * Bug-17 (sweep · 2026-05-16): all CTAs hardcoded /r/1004 even on
 * mainnet, which 404'd because receipt 1004 doesn't exist on Aristotle.
 * Footer's "Sample receipt" link + 5 home-page CTAs + multiple docs
 * snippets sent judges to a 404. Routing through this helper keeps the
 * sample link healthy across both networks and lets us point at fresher
 * mainnet receipts as the bundle grows.
 */
export function getSampleReceiptId(): number {
  return getNetwork() === 'mainnet' ? 66 : 1004;
}

/** `/r/<sampleId>` — receipt page path. */
export function getSampleReceiptHref(): string {
  return `/r/${getSampleReceiptId()}`;
}

/** `/embed/r/<sampleId>` — embed-widget page path. */
export function getSampleEmbedHref(): string {
  return `/embed/r/${getSampleReceiptId()}`;
}

/** Full URL for embed iframe code samples (uses canonical production host). */
export function getSampleEmbedIframeSrc(): string {
  return `https://www.ivaronix.xyz/embed/r/${getSampleReceiptId()}`;
}
