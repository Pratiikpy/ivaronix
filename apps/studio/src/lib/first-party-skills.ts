/**
 * Canonical first-party skill set + hex↔slug resolution helpers.
 *
 * Pre-2026-05-14 the 6-element first-party list was inlined 4 times
 * with drift: the home page + subgraph had the right 6 slugs; the
 * /api/run/confirm reverse-lookup (commit d352561) and /skill/<hex>
 * resolver (commit 6327749) inlined 8 slugs (added two phantom names
 * — lawyer-clean + finance-watchdog — that don't have SKILL.md on disk).
 *
 * Consolidated here so:
 *   - There's a single canonical list every consumer reads
 *   - Adding/removing a first-party skill touches 1 file
 *   - hex→slug resolution shares one implementation
 *
 * The 6 first-party slugs are the ones we maintain SKILL.md for under
 * `seed-skills/<slug>/`. The 150+ community skills under
 * `seed-skills/imports/` are not in this set; they ship as a
 * discoverability bonus, NOT a maintained promise (per CLAUDE.md §1
 * "no half-baked anything").
 */

export const FIRST_PARTY_SLUGS = [
  '0g-integration-auditor',
  'code-edit',
  'content-pitch-review',
  'github-audit',
  'plan-step',
  'private-doc-review',
  // Legal cluster (2026-05-14 directive · all 5 skills shipped fires 1-4)
  'contract-renewal-clause-detector', // fire 1
  'nda-triage-reviewer',              // fire 2
  'term-sheet-risk-scanner',          // fire 3
  'legal-citation-verifier',          // fire 4 · this commit (uses existing web_fetch builtin)
] as const;

export type FirstPartySlug = (typeof FIRST_PARTY_SLUGS)[number];

/**
 * Resolve a possibly-hex skill identifier back to its first-party slug.
 *
 * The marketplace routes carry the hex skillId (keccak256("skill:" + slug))
 * but the pipeline + skill page expect the slug (so they can locate
 * SKILL.md on disk). This helper centralises that lookup.
 *
 *   resolveSkillSlug('private-doc-review')   → 'private-doc-review' (pass-through)
 *   resolveSkillSlug('0x0934cfc2...860dcb')  → 'private-doc-review' (reverse-looked-up)
 *   resolveSkillSlug('0xdeadbeef...')        → '0xdeadbeef...' (unknown — caller handles miss)
 *
 * Returns the same string if it's already a slug OR if the hex doesn't
 * match any first-party slug. Callers should treat an unchanged hex
 * return as "skill not in first-party set" (their downstream lookup
 * will then fail with the original 404-style behaviour).
 */
export async function resolveSkillSlug(idOrHex: string): Promise<string> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(idOrHex)) return idOrHex;
  const { keccak256, toUtf8Bytes } = await import('ethers');
  const lower = idOrHex.toLowerCase();
  for (const slug of FIRST_PARTY_SLUGS) {
    if (keccak256(toUtf8Bytes(`skill:${slug}`)).toLowerCase() === lower) return slug;
  }
  return idOrHex;
}

/**
 * Synchronous (test-mode) version — used by tests and by anywhere
 * we already have ethers in scope and don't want the dynamic-import
 * overhead. Caller must provide the keccak256 + toUtf8Bytes pair.
 */
export function resolveSkillSlugSync(
  idOrHex: string,
  keccak256: (b: Uint8Array) => string,
  toUtf8Bytes: (s: string) => Uint8Array,
): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(idOrHex)) return idOrHex;
  const lower = idOrHex.toLowerCase();
  for (const slug of FIRST_PARTY_SLUGS) {
    if (keccak256(toUtf8Bytes(`skill:${slug}`)).toLowerCase() === lower) return slug;
  }
  return idOrHex;
}
