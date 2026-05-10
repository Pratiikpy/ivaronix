import { redirect } from 'next/navigation';

/**
 * /docs is the legacy URL for the 0G primitive showcase. Renamed to /0g
 * per planning-003 §A.5.17 (the route name "docs" sounded like internal
 * documentation; "/0g" reads as the canonical "0G primitive depth proof"
 * URL we want external linkers to use).
 *
 * This redirect stays in place permanently — old bookmarks, social shares,
 * and search-engine results continue to resolve to the live page.
 */
export default function DocsRedirect(): never {
  redirect('/0g');
}
