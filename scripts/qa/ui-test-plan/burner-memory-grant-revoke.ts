/**
 * 2-burner memory grant/revoke flow · Must-Ship #4 part A.
 *
 * Pattern C per CLAUDE.md §16/§17 + the locked
 * feedback_burner_wallet_compulsory.md memory: any grant-bearing feature
 * needs two real wallets to prove the cross-wallet path works.
 *
 * Roles:
 *   - Operator (treasury proxy): pre-funds Grantor + Grantee.
 *   - Alice (grantor): issueGrant on CapabilityRegistryV2.
 *   - Bob (grantee): the address the grant authorises.
 *
 * Real on-chain side effects:
 *   - Fund Alice + Bob (0.01 OG each from operator)
 *   - Alice issueGrant(bob, scopeHash, ttl, readsCap) → emits grantId
 *   - Chain read: isValid(grantId, bob, scopeHash) → true
 *   - Alice revokeGrant(grantId)
 *   - Chain read: isValid → false (the flip is the proof)
 *
 * Proof: tx hashes for fund/issue/revoke + before/after isValid booleans.
 */
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  Interface,
  parseEther,
  formatEther,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-memory');
mkdirSync(OUT, { recursive: true });

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(REPO, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch {}
  return env;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const OPERATOR_KEY = (env.IVARONIX_SIGNER_KEY ?? env.EVM_PRIVATE_KEY ?? '').replace(/^0x/, '');
  if (!OPERATOR_KEY) throw new Error('FAIL: IVARONIX_SIGNER_KEY missing in .env');

  const RPC = env.IVARONIX_RPC_URL ?? env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
  const CAP_V2 = '0x1351CD87360f0366D0A0068164e606B3c320F3E1'; // CapabilityRegistryV2 (testnet)

  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'galileo' });
  const operator = new Wallet(OPERATOR_KEY, provider);
  const alice = Wallet.createRandom().connect(provider);
  const bob = Wallet.createRandom().connect(provider);

  console.log('=== burner wallets ===');
  console.log('  alice (grantor):', alice.address);
  console.log('  bob   (grantee):', bob.address);
  console.log('  operator       :', operator.address);

  const GAS = { gasPrice: 5_000_000_000n, gasLimit: 400_000n };

  console.log('\n=== funding alice + bob (0.01 OG each) ===');
  const fundA = await operator.sendTransaction({ to: alice.address, value: parseEther('0.01'), ...GAS });
  const fundARcpt = await fundA.wait();
  console.log('  fund alice tx:', fundA.hash, 'block', fundARcpt?.blockNumber);
  const fundB = await operator.sendTransaction({ to: bob.address, value: parseEther('0.01'), ...GAS });
  const fundBRcpt = await fundB.wait();
  console.log('  fund bob   tx:', fundB.hash, 'block', fundBRcpt?.blockNumber);

  const CAP_ABI = [
    'function issueGrant(address grantee, bytes32 scopeHash, uint64 ttlSeconds, uint32 readsCap) external returns (bytes32)',
    'function isValid(bytes32 grantId, address grantee, bytes32 scopeHash) external view returns (bool)',
    'function revokeGrant(bytes32 grantId) external',
    'event GrantIssued(bytes32 indexed grantId, address indexed owner, address indexed grantee, bytes32 scopeHash, uint64 expiresAt, uint32 readsCap)',
  ];
  const capW = new Contract(CAP_V2, CAP_ABI, alice);
  const capR = new Contract(CAP_V2, CAP_ABI, provider);
  const scopeHash = keccak256(toUtf8Bytes(`memory:burner-test:${Date.now()}`));
  const ttl = 3600n; // 1 hour
  const reads = 10;

  console.log('\n=== alice issueGrant(bob, scope, ttl, reads) ===');
  console.log('  scopeHash:', scopeHash);
  const grantTx = await capW.issueGrant!(bob.address, scopeHash, ttl, reads, GAS);
  const grantRcpt = await grantTx.wait();
  console.log('  issueGrant tx:', grantTx.hash, 'block', grantRcpt?.blockNumber);

  // Parse GrantIssued event for the grantId
  const evIface = new Interface(CAP_ABI);
  let grantId: string | null = null;
  for (const log of grantRcpt?.logs ?? []) {
    try {
      const parsed = evIface.parseLog(log);
      if (parsed?.name === 'GrantIssued') {
        grantId = String(parsed.args[0]);
        break;
      }
    } catch { /* not our event */ }
  }
  if (!grantId) throw new Error('FAIL: GrantIssued event not found in tx logs');
  console.log('  grantId:', grantId);

  console.log('\n=== chain read · isValid before revoke ===');
  const validBefore = await capR.isValid!(grantId, bob.address, scopeHash);
  console.log('  isValid:', validBefore);
  if (validBefore !== true) throw new Error('FAIL: grant should be valid right after issue');

  console.log('\n=== alice revokeGrant(grantId) ===');
  const revokeTx = await capW.revokeGrant!(grantId, GAS);
  const revokeRcpt = await revokeTx.wait();
  console.log('  revoke tx:', revokeTx.hash, 'block', revokeRcpt?.blockNumber);

  console.log('\n=== chain read · isValid after revoke ===');
  const validAfter = await capR.isValid!(grantId, bob.address, scopeHash);
  console.log('  isValid:', validAfter);
  if (validAfter !== false) throw new Error('FAIL: grant should be invalid after revoke');

  const proof = {
    runAt: new Date().toISOString(),
    network: 'testnet',
    chainId: 16602,
    capabilityRegistryV2: CAP_V2,
    burner: { alice: alice.address, bob: bob.address },
    operator: operator.address,
    fundTxs: { alice: fundA.hash, bob: fundB.hash },
    grant: {
      grantId,
      scopeHash,
      ttlSeconds: Number(ttl),
      readsCap: reads,
      issueTx: grantTx.hash,
      issueBlock: grantRcpt?.blockNumber,
    },
    revoke: { tx: revokeTx.hash, block: revokeRcpt?.blockNumber },
    chainReads: { isValidBefore: validBefore, isValidAfter: validAfter },
    explorerBase: 'https://chainscan-galileo.0g.ai/tx/',
    verdict: validBefore === true && validAfter === false
      ? 'PASS · grant lifecycle proven on chain · before=true after=false'
      : 'FAIL',
  };
  const proofPath = resolve(OUT, `proof-${Date.now()}.json`);
  writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log('\n=== proof written ===');
  console.log(' ', proofPath);
  console.log(`\n✓ 2-burner memory grant/revoke: ${proof.verdict}`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
