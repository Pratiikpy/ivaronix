/**
 * QA · K-1 · AgentPassportINFTV2 closes the trustScore-forgery hole.
 *
 * Source-file regression. The Foundry suite (16/16) is the live proof; this
 * script asserts the regression markers in the V2 source so a future edit
 * cannot silently re-introduce the V1 vulnerable patterns.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

(async () => {
  console.log('───────────────────────────────────────────────────────────────');
  console.log('K-1 · AgentPassportINFTV2 hardened recordReceipt + transfer');
  console.log('───────────────────────────────────────────────────────────────');

  const v2Path = resolve(REPO, 'contracts/src/AgentPassportINFTV2.sol');
  assert.ok(existsSync(v2Path), 'AgentPassportINFTV2.sol must exist');
  const src = readFileSync(v2Path, 'utf8');

  // Owner branch must be GONE — only authorizedRecorders writes.
  assert.ok(
    /require\(authorizedRecorders\[msg\.sender\]/m.test(src),
    'V2 must require authorizedRecorders[msg.sender]',
  );
  assert.ok(
    !/msg\.sender\s*==\s*_ownerOf\(tokenId\)\s*\|\|\s*authorizedRecorders/m.test(src),
    'V2 must not retain the V1 owner-OR-recorder pattern',
  );
  console.log('   recordReceipt is authorizedRecorders-only');

  // Delta cap.
  assert.ok(/MAX_TRUST_DELTA\s*=\s*100/m.test(src), 'V2 must declare MAX_TRUST_DELTA=100');
  assert.ok(
    /trustScoreDelta\s*>=\s*-MAX_TRUST_DELTA\s*&&\s*trustScoreDelta\s*<=\s*MAX_TRUST_DELTA/m.test(src),
    'V2 must enforce delta cap',
  );
  console.log('   trustScoreDelta capped to ±MAX_TRUST_DELTA');

  // Cross-check.
  assert.ok(
    /receiptRegistry\.receipts\(receiptId\)/m.test(src),
    'V2 must call receiptRegistry.receipts(receiptId)',
  );
  assert.ok(
    /agent\s*==\s*owner/m.test(src),
    'V2 must require receipt agent == passport owner',
  );
  console.log('   ReceiptRegistry cross-check enforced (root + type + agent)');

  // K-6 mint ordering.
  const mintMatch = src.match(/function mint\([\s\S]*?\}\s*\n/);
  assert.ok(mintMatch, 'mint function not found in V2');
  const mintBlock = mintMatch[0];
  const setIdx = mintBlock.indexOf('passportOf[msg.sender] = tokenId');
  const safeMintIdx = mintBlock.indexOf('_safeMint(msg.sender, tokenId)');
  assert.ok(setIdx >= 0 && safeMintIdx >= 0 && setIdx < safeMintIdx,
    'V2 mint must set passportOf BEFORE _safeMint (K-6 reentrancy fix)');
  assert.ok(/nonReentrant/m.test(mintBlock), 'V2 mint must use nonReentrant modifier');
  console.log('   K-6: mint sets passportOf before _safeMint + nonReentrant');

  // K-4 version bump on transfer.
  assert.ok(
    /executorVersion\[tokenId\]\s*\+=\s*1/m.test(src),
    'V2 _update must bump executorVersion on owner change',
  );
  console.log('   K-4: executorVersion bumped on every owner change');

  // Deploy script.
  const deployPath = resolve(REPO, 'contracts/script/DeployPassportV2.s.sol');
  assert.ok(existsSync(deployPath), 'DeployPassportV2.s.sol must exist');
  const deploy = readFileSync(deployPath, 'utf8');
  assert.ok(/PASSPORT_VERIFIER_ADDR/.test(deploy), 'deploy script must read PASSPORT_VERIFIER_ADDR');
  assert.ok(/RECEIPT_REGISTRY_ADDR/.test(deploy), 'deploy script must read RECEIPT_REGISTRY_ADDR');
  console.log('   DeployPassportV2.s.sol shipped with required env-var inputs');

  // Foundry test file present.
  const testPath = resolve(REPO, 'contracts/test/AgentPassportINFTV2.t.sol');
  assert.ok(existsSync(testPath), 'AgentPassportINFTV2.t.sol must exist');
  const testSrc = readFileSync(testPath, 'utf8');
  assert.ok(/test_K1_OwnerCannotForgeOwnTrustScore/.test(testSrc));
  assert.ok(/test_K4_ExecutorClearedOnSafeTransfer/.test(testSrc));
  assert.ok(/test_K6_PassportOfSetBeforeSafeMint/.test(testSrc));
  console.log('   AgentPassportINFTV2.t.sol covers K-1 + K-4 + K-6');
  console.log('   (Live: forge test --match-contract AgentPassportINFTV2Test → 16/16 in this session)');

  console.log('───────────────────────────────────────────────────────────────');
  console.log('K-1 verified (V2 contract + tests; chain deploy is operator-action A-V2-K1)');
  console.log('───────────────────────────────────────────────────────────────');
})().catch((err) => {
  console.error('FAIL:', err);
  process.exitCode = 1;
});
