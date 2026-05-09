/**
 * QA · K-8 · /api/run rate-limit + SIWE
 * QA · K-9 · /api/skill/save SIWE + per-wallet sandbox + manifest validation
 *
 * Live tests against the running studio:
 *   1. GET /api/auth/siwe/nonce returns 200 + nonce + httpOnly cookie.
 *   2. POST /api/skill/save without a session → 401.
 *   3. POST /api/run with `userWallet` claim but no session → 401.
 *   4. POST /api/run with malformed `userWallet` → 400.
 *   5. Per-IP rate limit on /api/run kicks in after 10 anonymous hits.
 *
 * Source-file regression on the four touched files (route handlers + libs).
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const STUDIO_BASE = process.env.IVARONIX_STUDIO_BASE ?? 'http://localhost:3300';

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('K-8 + K-9 · auth gates + rate limit on /api/run + /api/skill/save');
  console.log('───────────────────────────────────────────────────────────────');

  // ─── 1. Source-file regression ─────────────────────────────────────────
  for (const [path, mustContain] of [
    ['apps/studio/src/lib/rate-limit.ts', /export function checkRateLimit/],
    ['apps/studio/src/lib/siwe-session.ts', /export function issueSession/],
    ['apps/studio/src/app/api/auth/siwe/nonce/route.ts', /issueNonce/],
    ['apps/studio/src/app/api/auth/siwe/verify/route.ts', /SiweMessage/],
    ['apps/studio/src/app/api/run/route.ts', /readSession\(sessionCookie\)/],
    ['apps/studio/src/app/api/run/route.ts', /checkRateLimit\('ip'/],
    ['apps/studio/src/app/api/skill/save/route.ts', /checkRateLimit\('ip'/],
    ['apps/studio/src/app/api/skill/save/route.ts', /readSession\(sessionCookie\)/],
    ['apps/studio/src/app/api/skill/save/route.ts', /sandboxRoot/],
  ] as const) {
    const src = readFileSync(resolve(REPO, path), 'utf8');
    assert.ok(mustContain.test(src), `${path} regression: missing pattern ${mustContain}`);
  }
  console.log('   source-file regressions green');

  // ─── 2. Live: nonce endpoint ───────────────────────────────────────────
  const nonceRes = await fetch(`${STUDIO_BASE}/api/auth/siwe/nonce`);
  assert.equal(nonceRes.status, 200, `nonce: status ${nonceRes.status}`);
  const nonceBody = (await nonceRes.json()) as { nonce?: string };
  assert.ok(nonceBody.nonce && /^[0-9a-f]{32}$/.test(nonceBody.nonce), 'nonce body shape');
  const setCookie = nonceRes.headers.get('set-cookie') ?? '';
  assert.ok(/iv-siwe-nonce=/.test(setCookie), 'nonce cookie not set');
  assert.ok(/HttpOnly/i.test(setCookie), 'nonce cookie missing HttpOnly');
  assert.ok(/SameSite=strict/i.test(setCookie), 'nonce cookie missing SameSite=strict');
  console.log('   nonce endpoint returns 200 + httpOnly + SameSite=strict cookie');

  // ─── 3. Live: skill/save without session → 401 ─────────────────────────
  const noSessRes = await fetch(`${STUDIO_BASE}/api/skill/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ skillId: 'k9-anon-attempt', manifest: '---\nname: x\n---\n' }),
  });
  assert.equal(noSessRes.status, 401, `skill/save no-session: status ${noSessRes.status}`);
  console.log('   skill/save anonymous → 401');

  // ─── 4. Live: run with userWallet but no session → 401 ─────────────────
  const claimedNoSess = await fetch(`${STUDIO_BASE}/api/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      skillId: 'private-doc-review',
      question: 'q',
      contentText: 't',
      userWallet: '0x' + '1'.repeat(40),
    }),
  });
  assert.equal(claimedNoSess.status, 401, `run with userWallet no-session: status ${claimedNoSess.status}`);
  console.log('   /api/run with userWallet but no session → 401');

  // ─── 5. Live: malformed userWallet → 400 ──────────────────────────────
  const badWallet = await fetch(`${STUDIO_BASE}/api/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      skillId: 'private-doc-review',
      question: 'q',
      contentText: 't',
      userWallet: 'not-a-wallet',
    }),
  });
  assert.equal(badWallet.status, 400, `run malformed userWallet: status ${badWallet.status}`);
  console.log('   /api/run with malformed userWallet → 400');

  // ─── 6. Live: per-IP rate limit kicks in ───────────────────────────────
  // We've already burned several hits in this test; just confirm that
  // hammering the endpoint eventually returns 429 (within the same window).
  let saw429 = false;
  for (let i = 0; i < 15; i++) {
    const r = await fetch(`${STUDIO_BASE}/api/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ skillId: 'no-such-skill', question: 'q', contentText: 't' }),
    });
    if (r.status === 429) { saw429 = true; break; }
  }
  assert.ok(saw429, 'per-IP rate limit on /api/run never triggered 429 in 15 hits');
  console.log('   /api/run per-IP rate limit triggers 429');

  console.log('───────────────────────────────────────────────────────────────');
  console.log('K-8 + K-9 verified');
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
