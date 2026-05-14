/**
 * Q2 · Independent chain-side cross-check of alice's grant lifecycle.
 *
 * Reads CapabilityRegistryV2 directly for the grantId from the burner-memory
 * proof and verifies: granter == alice · grantee == bob · isValid == false
 * (after revoke). This bypasses the CLI's wallet-bound default to get alice's
 * specific grant state.
 */
import { JsonRpcProvider, Contract } from 'ethers';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/multi-wallet/memory-grant-revoke/cli-cross-check.log');

const PROOF = JSON.parse(
  readFileSync(resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-memory/proof-1778781835807.json'), 'utf8')
) as {
  capabilityRegistryV2: string;
  burner: { alice: string; bob: string };
  grant: { grantId: string; scopeHash: string; ttlSeconds: number; readsCap: number };
  revoke: { tx: string; block: number };
};

const CAP_ABI = [
  'function grants(bytes32) external view returns (address owner, address grantee, bytes32 scopeHash, uint64 issuedAt, uint64 expiresAt, uint32 readsRemaining, bool revoked)',
  'function isValid(bytes32 grantId, address grantee, bytes32 scopeHash) external view returns (bool)',
];

async function main(): Promise<void> {
  const lines: string[] = [];
  const log = (s: string): void => { console.log(s); lines.push(s); };

  const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const cap = new Contract(PROOF.capabilityRegistryV2, CAP_ABI, provider);

  log(`=== Q2 · independent CapabilityRegistryV2 cross-check ===`);
  log(`time:   ${new Date().toISOString()}`);
  log(`block:  ${(await provider.getBlock('latest'))!.number}`);
  log(`registry: ${PROOF.capabilityRegistryV2}`);
  log(`grantId: ${PROOF.grant.grantId}`);
  log(`expected granter: ${PROOF.burner.alice}`);
  log(`expected grantee: ${PROOF.burner.bob}`);
  log('');

  const grant = await cap.grants!(PROOF.grant.grantId);
  log(`grants(${PROOF.grant.grantId.slice(0, 18)}...)`);
  log(`  owner:           ${grant.owner}`);
  log(`  grantee:         ${grant.grantee}`);
  log(`  scopeHash:       ${grant.scopeHash}`);
  log(`  issuedAt:        ${grant.issuedAt} (${new Date(Number(grant.issuedAt) * 1000).toISOString()})`);
  log(`  expiresAt:       ${grant.expiresAt} (${new Date(Number(grant.expiresAt) * 1000).toISOString()})`);
  log(`  readsRemaining:  ${grant.readsRemaining}`);
  log(`  revoked:         ${grant.revoked}`);
  log('');

  const ownerPass = grant.owner.toLowerCase() === PROOF.burner.alice.toLowerCase();
  const granteePass = grant.grantee.toLowerCase() === PROOF.burner.bob.toLowerCase();
  const scopeHashPass = grant.scopeHash.toLowerCase() === PROOF.grant.scopeHash.toLowerCase();
  const readsCapPass = Number(grant.readsRemaining) === PROOF.grant.readsCap;
  const ttlPass = Number(grant.expiresAt) - Number(grant.issuedAt) === PROOF.grant.ttlSeconds;
  const revokedPass = grant.revoked === true;

  log(`  PASS · owner == alice burner:    ${ownerPass}`);
  log(`  PASS · grantee == bob burner:    ${granteePass}`);
  log(`  PASS · scopeHash matches proof:  ${scopeHashPass}`);
  log(`  PASS · readsRemaining == 10:     ${readsCapPass} (${grant.readsRemaining})`);
  log(`  PASS · expiresAt - issuedAt == ttl 3600: ${ttlPass}`);
  log(`  PASS · revoked flag == true:     ${revokedPass}`);

  const isValid = await cap.isValid!(PROOF.grant.grantId, PROOF.burner.bob, PROOF.grant.scopeHash);
  log(`  PASS · isValid(grantId, bob, scope) == false: ${!isValid} (${isValid})`);
  log('');

  log(`=== TX recipts cross-check ===`);
  const issueRcpt = await provider.getTransactionReceipt('0x8387b43a96c78e45a136319a07533a271b3a240f1e07f99e49f543d954db0168');
  log(`issue tx 0x8387b43a... · status=${issueRcpt?.status} · block=${issueRcpt?.blockNumber} · from=${issueRcpt?.from}`);
  const issueFromPass = issueRcpt?.from.toLowerCase() === PROOF.burner.alice.toLowerCase() && issueRcpt?.status === 1;
  log(`  PASS · issue tx from alice + success: ${issueFromPass}`);

  const revokeRcpt = await provider.getTransactionReceipt(PROOF.revoke.tx);
  log(`revoke tx ${PROOF.revoke.tx.slice(0, 18)}... · status=${revokeRcpt?.status} · block=${revokeRcpt?.blockNumber} · from=${revokeRcpt?.from}`);
  const revokeFromPass = revokeRcpt?.from.toLowerCase() === PROOF.burner.alice.toLowerCase() && revokeRcpt?.status === 1;
  log(`  PASS · revoke tx from alice + success: ${revokeFromPass}`);
  log('');

  const allPass = ownerPass && granteePass && scopeHashPass && readsCapPass && ttlPass && revokedPass && !isValid && issueFromPass && revokeFromPass;
  log(`=== SUMMARY ===`);
  log(`  ${allPass ? 'GREEN ✓ · 9/9 PASS · grant lifecycle independently verified on chain' : 'RED ✗'}`);

  writeFileSync(OUT, lines.join('\n'));
  console.log(`\nsaved: ${OUT}`);
  if (!allPass) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
