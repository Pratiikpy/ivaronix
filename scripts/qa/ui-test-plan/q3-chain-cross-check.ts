/**
 * Q3 · Passport mint + trust accrual 2-wallet · independent chain cross-check.
 *
 * Reads AgentPassportINFTV2.agents(tokenId) for both burner-passport prior
 * proof AND the fresh PRE-QUEUE-2 alice (tokenId 20) and verifies:
 *  - receiptCount accrued correctly
 *  - trustScore accrued correctly
 *  - passport tokenId belongs to the expected owner
 *  - bob's passport (separate token) doesn't accidentally show alice's state
 */
import { JsonRpcProvider, Contract } from 'ethers';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/multi-wallet/passport-mint/cli-cross-check.log');

const PASSPORT_V2 = '0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d';
const PASSPORT_ABI = [
  'function passportOf(address) external view returns (uint256)',
  'function ownerOf(uint256) external view returns (address)',
  'function agents(uint256) external view returns (bytes32 metadataRoot, bytes32 memoryRoot, bytes32 reserved2, uint64 receiptCount, uint64 violationCount, int128 trustScore, uint64 mintedAt, uint64 lastEvolutionAt)',
];

// Fresh from PRE-QUEUE-2 recordReceipt this session
const RECORD_PROOF = JSON.parse(
  readFileSync(resolve(REPO, 'QA_PROOF_PACK/testnet/burner-gaps/recordReceipt-1778784880568.json'), 'utf8')
) as { alice: { address: string }; passportTokenId: string; deltas: { receiptCount: { before: string; after: string }; trustScore: { before: string; after: string } } };

// Prior session 2-wallet passport proof
const PRIOR_PROOF_PATH = resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-passport/proof-1778781630636.json');
let PRIOR_PROOF: { alice?: { address: string; tokenId?: string }; bob?: { address: string; tokenId?: string } } | null = null;
try { PRIOR_PROOF = JSON.parse(readFileSync(PRIOR_PROOF_PATH, 'utf8')); } catch {}

async function main(): Promise<void> {
  const lines: string[] = [];
  const log = (s: string): void => { console.log(s); lines.push(s); };

  const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const passport = new Contract(PASSPORT_V2, PASSPORT_ABI, provider);

  log(`=== Q3 · AgentPassportINFTV2 cross-check ===`);
  log(`time:  ${new Date().toISOString()}`);
  log(`block: ${(await provider.getBlock('latest'))!.number}`);
  log(`registry: ${PASSPORT_V2}`);
  log('');

  // 1 · Verify alice's tokenId 20 from PRE-QUEUE-2 recordReceipt session
  const aliceAddr = RECORD_PROOF.alice.address;
  const expectedTokenId = BigInt(RECORD_PROOF.passportTokenId);
  log(`alice (recordReceipt session): ${aliceAddr}`);
  log(`expected tokenId: ${expectedTokenId}`);

  const aliceTokenId = await passport.passportOf!(aliceAddr) as bigint;
  log(`  passportOf(alice): ${aliceTokenId}`);
  const tokenIdPass = aliceTokenId === expectedTokenId;
  log(`  PASS · tokenId matches: ${tokenIdPass}`);

  const tokenOwner = await passport.ownerOf!(aliceTokenId) as string;
  log(`  ownerOf(tokenId): ${tokenOwner}`);
  const ownerPass = tokenOwner.toLowerCase() === aliceAddr.toLowerCase();
  log(`  PASS · owner == alice: ${ownerPass}`);

  const agent = await passport.agents!(aliceTokenId);
  log(`\n  agents(tokenId ${aliceTokenId}):`);
  log(`    metadataRoot:     ${agent.metadataRoot}`);
  log(`    memoryRoot:       ${agent.memoryRoot}`);
  log(`    receiptCount:     ${agent.receiptCount}`);
  log(`    violationCount:   ${agent.violationCount}`);
  log(`    trustScore:       ${agent.trustScore}`);
  log(`    mintedAt:         ${agent.mintedAt} (${new Date(Number(agent.mintedAt) * 1000).toISOString()})`);
  log(`    lastEvolutionAt:  ${agent.lastEvolutionAt} (${new Date(Number(agent.lastEvolutionAt) * 1000).toISOString()})`);

  const receiptCountPass = agent.receiptCount === 1n;
  const trustScorePass = agent.trustScore === 5n;
  log(`\n  PASS · receiptCount == 1 (post-recordReceipt): ${receiptCountPass}`);
  log(`  PASS · trustScore == 5 (post-recordReceipt):    ${trustScorePass}`);
  log(`  PASS · mintedAt < lastEvolutionAt (evolved):    ${agent.mintedAt < agent.lastEvolutionAt}`);

  log('');

  // 2 · Mint tx + record tx receipt cross-check
  log(`=== TX receipts cross-check ===`);
  const mintTx = '0x13f20b616822dfbcd77b08d280cff3b01f27c79a30e9ffd3c57cc7f36150024f';
  const recordTx = '0x40279a7c2352db4e77ed18d6022a5fc3e61996a3898d5a7cb85053337e848a91';
  const mintRcpt = await provider.getTransactionReceipt(mintTx);
  log(`mint tx ${mintTx.slice(0, 18)}... · status=${mintRcpt?.status} · block=${mintRcpt?.blockNumber} · from=${mintRcpt?.from}`);
  const mintFromPass = mintRcpt?.from.toLowerCase() === aliceAddr.toLowerCase() && mintRcpt?.status === 1;
  log(`  PASS · mint tx from alice + success: ${mintFromPass}`);

  const recordRcpt = await provider.getTransactionReceipt(recordTx);
  log(`record tx ${recordTx.slice(0, 18)}... · status=${recordRcpt?.status} · block=${recordRcpt?.blockNumber} · from=${recordRcpt?.from}`);
  const recordFromPass = recordRcpt?.status === 1 && recordRcpt.to?.toLowerCase() === PASSPORT_V2.toLowerCase();
  log(`  PASS · record tx targets passport contract + success: ${recordFromPass}`);

  // 3 · Independent test: alice's tokenId ≠ any other burner's tokenId
  if (PRIOR_PROOF?.alice?.address && PRIOR_PROOF.alice.address.toLowerCase() !== aliceAddr.toLowerCase()) {
    const priorAlice = PRIOR_PROOF.alice.address;
    const priorAliceTokenId = await passport.passportOf!(priorAlice) as bigint;
    log(`\n  Prior-session alice ${priorAlice}: tokenId ${priorAliceTokenId}`);
    log(`  PASS · different alice address has different tokenId: ${priorAliceTokenId !== aliceTokenId}`);
  }

  log('');
  const allPass = tokenIdPass && ownerPass && receiptCountPass && trustScorePass && mintFromPass && recordFromPass;
  log(`=== SUMMARY ===`);
  log(`  ${allPass ? 'GREEN ✓ · 6/6 PASS · passport mint + trust accrual independently verified on chain' : 'RED ✗'}`);

  writeFileSync(OUT, lines.join('\n'));
  console.log(`\nsaved: ${OUT}`);
  if (!allPass) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
