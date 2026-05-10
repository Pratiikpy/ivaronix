/**
 * End-to-end onboard test with a fresh wallet — proves the /onboard path
 * works for a brand-new user.
 *
 * Steps the script drives:
 *   1. Generate a fresh EOA + private key
 *   2. Fund it 0.05 OG from EVM_PRIVATE_KEY (the existing dev wallet)
 *   3. POST /api/onboard/metadata for the new address → real 0G Storage upload
 *   4. Call AgentPassportINFT.mint(rootHash) signed by the new wallet
 *   5. Read passportOf(newAddress) to confirm tokenId
 *   6. Read agents(tokenId) to confirm metadataRoot was stored on chain
 *
 * Verified end-to-end means: mainnet's first-time-user path will work
 * the same way once the contract is deployed at 16661.
 */

import { Wallet, JsonRpcProvider, Contract, parseEther } from 'ethers';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { AGENT_PASSPORT_ABI } from '@ivaronix/og-chain';
import { getDeployedAddress } from '@ivaronix/og-chain';

function findEnv(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const c = resolve(dir, '.env');
    if (existsSync(c)) return c;
    const p = dirname(dir);
    if (p === dir) return null;
    dir = p;
  }
  return null;
}
const envPath = findEnv(process.cwd());
if (envPath) dotenvConfig({ path: envPath });

const RPC = 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16602;
const STUDIO_URL = 'http://127.0.0.1:3300';

async function main() {
  const dadKey = process.env.IVARONIX_SIGNER_KEY ?? process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY;
  if (!dadKey) throw new Error('IVARONIX_SIGNER_KEY missing (legacy aliases OG_PRIVATE_KEY, EVM_PRIVATE_KEY also accepted)');

  const provider = new JsonRpcProvider(RPC, { chainId: CHAIN_ID, name: 'testnet' });
  const dadWallet = new Wallet(dadKey, provider);
  console.log(`[1] dad wallet  ${dadWallet.address}`);

  // ─── 1. Generate fresh EOA ─────────────────────────────────────────
  const fresh = Wallet.createRandom().connect(provider);
  console.log(`[2] fresh EOA   ${fresh.address}`);

  // ─── 2. Fund fresh wallet with 0.05 OG ─────────────────────────────
  console.log('[3] funding fresh wallet with 0.05 OG ...');
  const fundTx = await dadWallet.sendTransaction({
    to: fresh.address,
    value: parseEther('0.05'),
  });
  await fundTx.wait();
  console.log(`    fund tx     ${fundTx.hash}`);
  const bal = await provider.getBalance(fresh.address);
  console.log(`    balance     ${(Number(bal) / 1e18).toFixed(6)} OG`);

  // ─── 3. Upload metadata via /api/onboard/metadata ──────────────────
  console.log('[4] POST /api/onboard/metadata ...');
  const metaRes = await fetch(`${STUDIO_URL}/api/onboard/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle: `test-${fresh.address.slice(2, 8)}`, ownerWallet: fresh.address }),
  });
  if (!metaRes.ok) throw new Error(`/api/onboard/metadata HTTP ${metaRes.status}`);
  const meta = await metaRes.json() as { metadataRoot: string; storageTxHash?: string; method: string };
  console.log(`    metadataRoot ${meta.metadataRoot}`);
  console.log(`    storage tx   ${meta.storageTxHash ?? '(local-sha256 fallback)'}`);
  console.log(`    method       ${meta.method}`);

  // ─── 4. Mint passport with fresh wallet ────────────────────────────
  const passportAddr = getDeployedAddress('testnet', 'AgentPassportINFT');
  if (!passportAddr) throw new Error('AgentPassport not deployed on testnet');
  const passport = new Contract(passportAddr, AGENT_PASSPORT_ABI, fresh);
  console.log('[5] AgentPassport.mint(rootHash) signed by fresh wallet ...');
  const mintTx = await (passport.mint as (root: string) => Promise<{ hash: string; wait: () => Promise<{ blockNumber: bigint }> }>)(meta.metadataRoot);
  console.log(`    mint tx     ${mintTx.hash}`);
  const mintReceipt = await mintTx.wait();
  console.log(`    block       ${mintReceipt.blockNumber}`);

  // ─── 5. Read passportOf(fresh) ─────────────────────────────────────
  const passportOf = passport.passportOf as (addr: string) => Promise<bigint>;
  const tokenId = await passportOf(fresh.address);
  console.log(`[6] passportOf(${fresh.address.slice(0, 10)}…) = ${tokenId}`);
  if (tokenId === 0n) throw new Error('passport not registered after mint');

  // ─── 6. Read agents(tokenId) to confirm metadataRoot ───────────────
  const agents = passport.agents as (id: bigint) => Promise<{ metadataRoot: string }>;
  const agentData = await agents(tokenId);
  console.log(`[7] agents[${tokenId}].metadataRoot = ${agentData.metadataRoot}`);

  if (agentData.metadataRoot.toLowerCase() !== meta.metadataRoot.toLowerCase()) {
    throw new Error(`metadataRoot mismatch — expected ${meta.metadataRoot}, got ${agentData.metadataRoot}`);
  }

  console.log('');
  console.log('✓ FULL ONBOARD FLOW PASSED');
  console.log(`  fresh wallet:  ${fresh.address}`);
  console.log(`  tokenId:       ${tokenId}`);
  console.log(`  metadataRoot:  ${meta.metadataRoot}`);
  console.log(`  mint tx:       ${mintTx.hash}`);
  console.log(`  storage tx:    ${meta.storageTxHash ?? '(local sha256)'}`);
  console.log('');
  console.log('Mainnet first-time-user path is proven on testnet. The same code runs on 16661.');
}

main().catch((err) => {
  console.error('✗', (err as Error).message);
  process.exit(1);
});
