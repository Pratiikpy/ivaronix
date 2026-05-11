/**
 * SIWE session cookies must be set with `sameSite: 'strict'`.
 *
 * HALF_BAKED §K-13 closure lock (sweep 217).
 *
 * K-13 named CSRF on state-changing routes as a Medium severity. The
 * primary CSRF defense is the SIWE cookie's SameSite attribute: a
 * browser will refuse to attach the cookie to a cross-origin POST,
 * so a malicious third-party page cannot cause the user's session
 * to authorize a `/api/run` request even with `credentials: 'include'`.
 *
 * If a future refactor relaxes the cookie to `sameSite: 'lax'` or
 * removes the attribute, that primary defense is silently lost. This
 * regression locks it.
 *
 * Scope: both SIWE handshake routes that set the session cookie
 * (`/api/auth/siwe/nonce` + `/api/auth/siwe/verify`). The cookie is
 * the only state-change-authenticating credential in the system, so
 * locking these two files covers the whole surface.
 *
 * Pure source-file regression.
 */
import { readFileSync, existsSync } from 'node:fs';
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

const routes = [
  resolve(REPO_ROOT, 'apps', 'studio', 'src', 'app', 'api', 'auth', 'siwe', 'nonce', 'route.ts'),
  resolve(REPO_ROOT, 'apps', 'studio', 'src', 'app', 'api', 'auth', 'siwe', 'verify', 'route.ts'),
];

for (const file of routes) {
  if (!existsSync(file)) {
    fail(`SIWE route file missing: ${file}`);
  }
  const src = readFileSync(file, 'utf8');

  // Every cookie-set call site in these files must declare
  // sameSite: 'strict'. The cookie shape is constructed via an object
  // literal, so we look for the property value pair.
  if (!/sameSite\s*:\s*['"]strict['"]/.test(src)) {
    fail(`${file}: SIWE cookie must be set with sameSite: 'strict' (CSRF primary defense, §K-13). Did a refactor relax to 'lax' or remove the attribute?`);
  }

  // Belt-and-suspenders: forbid any sameSite that ISN'T strict in
  // these files. Catches a future refactor that adds an `if`-branch
  // setting `sameSite: 'lax'` for some condition.
  const matches = src.match(/sameSite\s*:\s*['"](\w+)['"]/g) ?? [];
  for (const m of matches) {
    const v = m.match(/['"](\w+)['"]/)?.[1];
    if (v !== 'strict') {
      fail(`${file}: forbidden sameSite value "${v}" — only 'strict' allowed on SIWE cookies (§K-13).`);
    }
  }
  ok(`${file.split(/[\\/]/).slice(-3).join('/')}: sameSite 'strict' confirmed (${matches.length} occurrence(s))`);
}

console.log(`\n[verify-siwe-cookie-samesite-strict] ${asserts} assertions passed`);
