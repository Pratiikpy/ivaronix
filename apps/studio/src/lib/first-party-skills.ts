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
 * Forward lookup: slug → hex manifestHash. The inverse of resolveSkillSlug.
 *
 *   skillSlugToHex('private-doc-review') → '0x0934cfc2...860dcb'
 *   skillSlugToHex('0xdeadbeef...')      → '0xdeadbeef...' (pass-through)
 *   skillSlugToHex('unknown-slug')       → 'unknown-slug' (pass-through)
 *
 * Closes Bug #22 (v33 UI sweep · 2026-05-16): /marketplace/[skillId]
 * was doing a case-insensitive find against the skillId returned by
 * the subgraph/chain (always hex). When the URL carries a slug like
 * 'private-doc-review' (the marketplace card link target), the find
 * never matches and renders "Skill not found". This helper makes the
 * detail page accept either form by converting slugs to hex before
 * the lookup. Same shape as the previously-shipped /skill/<hex> →
 * slug resolver in /skill/[id]/page.tsx.
 */
export async function skillSlugToHex(slugOrHex: string): Promise<string> {
  if (/^0x[0-9a-fA-F]{64}$/.test(slugOrHex)) return slugOrHex;
  if (!(FIRST_PARTY_SLUGS as readonly string[]).includes(slugOrHex)) return slugOrHex;
  const { keccak256, toUtf8Bytes } = await import('ethers');
  return keccak256(toUtf8Bytes(`skill:${slugOrHex}`));
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
