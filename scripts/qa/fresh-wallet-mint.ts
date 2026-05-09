/**
 * QA: passport mint with a freshly-generated wallet.
 *
 * The main wallet 0xaa95...77Ce already holds tokenId 1, so its mint
 * always reverts. To prove the mint code path actually works on a
 * never-seen-before address, we:
 *   1. Generate a fresh private key.
 *   2. Send 0.5 OG to it from the funded wallet.
 *   3. Call AgentPassportINFT.mint() from the fresh wallet.
 *   4. Read passportOf() to confirm the new tokenId.
 *   5. Return the metadataRoot, tokenId, anchor tx, and explorer URL.
 *
 * After this run the punch-list item "passport mint confirmed" can move
 * from "blocked: fresh wallet needed" → verified end-to-end with proof.
 */
import { JsonRpcProvider, Wallet, Contract, parseEther, sha256, toUtf8Bytes } from 'ethers';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

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

const env = loadEnv();
const RPC = env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const FUNDED_PK = env.EVM_PRIVATE_KEY;
if (!FUNDED_PK) { console.error('FAIL: EVM_PRIVATE_KEY missing'); process.exit(1); }

const PASSPORT_ABI = [
  'function mint(bytes32 metadataRoot) external returns (uint256)',
  'function passportOf(address) external view returns (uint256)',
  'function getPassport(uint256 tokenId) external view returns (tuple(bytes32 metadataRoot, bytes32 memoryRoot, bytes32 skillManifestRoot, uint256 trustScore, uint256 receiptCount, uint256 violationCount, uint256 mintedAt, uint256 lastEvolutionAt))',
];

const deployments = JSON.parse(readFileSync(resolve(REPO, 'deployments/testnet.json'), 'utf8'));
const PASSPORT_ADDR = deployments.contracts.AgentPassportINFT.address as `0x${string}`;

(async () => {
  console.log('=== passport mint · fresh-wallet test ===');
  const provider = new JsonRpcProvider(RPC);
  const funded = new Wallet(FUNDED_PK, provider);
  const fundedBalBefore = await provider.getBalance(funded.address);
  console.log(`funded wallet         ${funded.address}  balance=${(Number(fundedBalBefore) / 1e18).toFixed(4)} OG`);

  // 1. Generate a fresh private key
  const fresh = Wallet.createRandom().connect(provider);
  console.log(`fresh wallet          ${fresh.address}  (private key not logged)`);

  // 2. Confirm fresh wallet has zero balance + zero passport
  const passportRO = new Contract(PASSPORT_ADDR, PASSPORT_ABI, provider);
  const existingId = await passportRO.passportOf(fresh.address);
  console.log(`passportOf(fresh)     ${existingId.toString()}  (must be 0)`);
  if (existingId !== 0n) { console.error('FAIL: fresh wallet already has a passport — entropy collision?'); process.exit(1); }

  // 3. Fund the fresh wallet with 0.05 OG (enough for one mint + buffer)
  console.log(`\n--- step 1: fund fresh wallet ---`);
  const fundTx = await funded.sendTransaction({ to: fresh.address, value: parseEther('0.05') });
  console.log(`fund tx               ${fundTx.hash}`);
  const fundReceipt = await fundTx.wait();
  console.log(`fund block            ${fundReceipt?.blockNumber}`);
  const freshBal = await provider.getBalance(fresh.address);
  console.log(`fresh balance         ${(Number(freshBal) / 1e18).toFixed(4)} OG`);

  // 4. Build metadataRoot (sha256 of the metadata blob)
  const metadata = {
    name: 'Ivaronix QA Mint',
    handle: 'qa-fresh-' + Date.now().toString(36).slice(-6),
    ownerWallet: fresh.address,
    personality: { style: 'concise', risk: 'balanced' },
    modelHistory: ['qwen/qwen-2.5-7b-instruct'],
    skillsInstalled: [],
    permissionProfile: 'default-strict',
    createdAt: Date.now(),
  };
  const metadataBytes = toUtf8Bytes(JSON.stringify(metadata));
  const metadataRoot = sha256(metadataBytes) as `0x${string}`;
  console.log(`metadataRoot          ${metadataRoot}`);

  // 5. Mint from the fresh wallet
  console.log(`\n--- step 2: mint passport ---`);
  const passportRW = new Contract(PASSPORT_ADDR, PASSPORT_ABI, fresh);
  const mintTx = await passportRW.mint(metadataRoot);
  console.log(`mint tx               ${mintTx.hash}`);
  const mintReceipt = await mintTx.wait();
  console.log(`mint block            ${mintReceipt?.blockNumber}`);
  console.log(`gas used              ${mintReceipt?.gasUsed?.toString() ?? '?'}`);

  // 6. Read the new tokenId
  const newTokenId = await passportRO.passportOf(fresh.address);
  console.log(`\n--- step 3: confirm on chain ---`);
  console.log(`tokenId               ${newTokenId.toString()}`);
  if (newTokenId === 0n) { console.error('FAIL: passportOf returned 0 after mint'); process.exit(1); }

  // 7. Read full passport state
  const profile = await passportRO.getPassport(newTokenId);
  console.log(`metadataRoot (chain)  ${profile.metadataRoot}`);
  console.log(`trustScore            ${profile.trustScore.toString()}`);
  console.log(`receiptCount          ${profile.receiptCount.toString()}`);
  console.log(`violationCount        ${profile.violationCount.toString()}`);
  console.log(`mintedAt              ${new Date(Number(profile.mintedAt) * 1000).toISOString()}`);

  console.log(`\n=== SUCCESS ===`);
  console.log(`fresh wallet          ${fresh.address}`);
  console.log(`new tokenId           #${newTokenId.toString()}`);
  console.log(`mint tx               https://chainscan-galileo.0g.ai/tx/${mintTx.hash}`);
  console.log(`passport explorer     https://chainscan-galileo.0g.ai/address/${PASSPORT_ADDR}`);
})().catch((e: Error) => { console.error('FAIL:', e.message); console.error(e.stack); process.exit(1); });
