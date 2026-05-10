/**
 * Studio HTTP security headers regression.
 *
 * apps/studio/next.config.ts MUST set the four safe defence-in-depth
 * headers (HALF_BAKED §G-Tier-A item 6 closure):
 *
 *   - X-Frame-Options: DENY                            (clickjacking)
 *   - X-Content-Type-Options: nosniff                  (MIME-sniff XSS)
 *   - Referrer-Policy: strict-origin-when-cross-origin (referer leakage)
 *   - Strict-Transport-Security: max-age=63072000; includeSubDomains; preload (HSTS)
 *
 * Source-file regression — reads next.config.ts as text and asserts
 * each header key + value pair is present. Intentionally NOT live HTTP
 * request testing: that needs a running server and is covered by the
 * studio-live filter when wired.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

const NEXT_CONFIG = resolve(REPO_ROOT, 'apps/studio/next.config.ts');
const content = readFileSync(NEXT_CONFIG, 'utf8');

const REQUIRED: Array<{ key: string; value: string }> = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

if (!/async\s+headers\s*\(\s*\)/.test(content)) {
  fail('next.config.ts is missing the `async headers()` block');
}
ok('next.config.ts declares async headers() function');

for (const { key, value } of REQUIRED) {
  // Look for a literal `key: '<KEY>'` or `key: "<KEY>"` and a matching
  // value: '<VALUE>'.
  const keyRe = new RegExp(`key:\\s*['"]${key.replace(/[/\\]/g, '\\$&')}['"]`);
  if (!keyRe.test(content)) {
    fail(`next.config.ts missing header: ${key}`);
  }
  const valRe = new RegExp(`value:\\s*['"]${value.replace(/[/\\]/g, '\\$&')}['"]`);
  if (!valRe.test(content)) {
    fail(`next.config.ts has ${key} but value does not match expected: ${value}`);
  }
  ok(`${key}: ${value}`);
}

console.log(`\n[verify-studio-security-headers] ${asserts} assertions passed`);
