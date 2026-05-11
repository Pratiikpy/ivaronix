/**
 * Error-message sanitizer for API route responses. HALF_BAKED §K-11
 * closure (sweep 212).
 *
 * Pre-fix shape (the leak):
 *   return NextResponse.json({ error: (err as Error).message }, { status: 500 });
 *
 * That string can carry:
 *   - filesystem absolute paths (`C:\Users\prate\Downloads\oglabs\...`)
 *   - operator's wallet address (`0xabc...def`)
 *   - env-misconfig details (`IVARONIX_SIGNER_KEY missing`)
 *   - indexer URLs (`https://indexer-storage-testnet-turbo.0g.ai`)
 *   - stack traces with file paths
 *
 * What we strip:
 *   - absolute paths (Windows + POSIX) → `<path>`
 *   - 0x-prefixed addresses (20 bytes / 32 bytes) → `<address>` / `<hash>`
 *   - the operator's env-var names → `<env>`
 *
 * What we keep:
 *   - high-level error class so the user knows what to do
 *   - first line only (no stack)
 *   - capped at 240 chars
 *
 * Pure side-effect-free helper. The route's `catch` block should also
 * `console.error(err)` so the full stack is captured in server logs;
 * sanitize() only governs the client-facing payload.
 */

/** Absolute-path patterns: Windows `C:\...`, POSIX `/Users/...`, `/home/...`, `/tmp/...`. */
const PATH_RE = /(?:[A-Z]:[\\/][^\s'"\)]+|\/(?:Users|home|tmp|var|opt|etc|root)\/[^\s'"\)]+)/g;
/** 0x-prefixed addresses (20 bytes, checksummed) and hashes (32 bytes). */
const ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const HASH_RE = /\b0x[a-fA-F0-9]{64}\b/g;
/** IVARONIX_* / OG_* / EVM_* env-var names. */
const ENV_RE = /\b(?:IVARONIX|OG|EVM|ZG|NVIDIA|SENTRY|UPSTASH)_[A-Z0-9_]+\b/g;

const MAX_LEN = 240;

export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return 'internal error';
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split('\n')[0] ?? '';
  const stripped = firstLine
    .replace(PATH_RE, '<path>')
    .replace(HASH_RE, '<hash>') // 32-byte before 20-byte so hashes don't match address regex first
    .replace(ADDRESS_RE, '<address>')
    .replace(ENV_RE, '<env>');
  if (stripped.length <= MAX_LEN) return stripped;
  return stripped.slice(0, MAX_LEN - 3) + '...';
}
