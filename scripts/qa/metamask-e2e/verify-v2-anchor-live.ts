/**
 * Live smoke: anchor a synthetic receipt on ReceiptRegistryV2 to prove
 * the off-chain wiring (signTypedData → anchor((struct), sig) → recover
 * agent) works end-to-end on Galileo.
 *
 * Pre-reqs: .env has IVARONIX_SIGNER_KEY (legacy aliases OG_PRIVATE_KEY,
 * EVM_PRIVATE_KEY also accepted); contracts/deployments/testnet.json has
 * the V2 address from the earlier deploy.
 */
import { Wallet, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { ReceiptRegistryV2Client, getDeployedAddress } from '@ivaronix/og-chain';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Walk up from this script's location to find the repo-root .env.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
config({ path: resolve(REPO_ROOT, '.env') });

(async () => {
  const key = process.env.IVARONIX_SIGNER_KEY ?? process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY;
  if (!key) throw new Error('IVARONIX_SIGNER_KEY missing from .env (legacy aliases OG_PRIVATE_KEY, EVM_PRIVATE_KEY also accepted)');

  const v2Addr = getDeployedAddress('testnet', 'ReceiptRegistryV2');
  if (!v2Addr) throw new Error('ReceiptRegistryV2 not in contracts/deployments/testnet.json');
  console.log(`V2 address: ${v2Addr}`);

  const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const wallet = new Wallet(key, provider);
  const agent = await wallet.getAddress();
  console.log(`Agent (signer): ${agent}`);

  const registry = new ReceiptRegistryV2Client(v2Addr as `0x${string}`, wallet);

  const before = await registry.nextId();
  console.log(`nextId before anchor: ${before}`);

  // Synthetic receipt fields. The receiptRoot + storageRoot are
  // deterministic strings; the chain doesn't validate their content,
  // only that the signed typed-data bound to (root, storage, type,
  // attHash, agent, nonce, deadline) recovers to `agent`.
  const seed = `v2-smoke-${Date.now()}`;
  const receiptRoot = keccak256(toUtf8Bytes(`root:${seed}`)) as `0x${string}`;
  const storageRoot = keccak256(toUtf8Bytes(`storage:${seed}`)) as `0x${string}`;
  const attestationHash = keccak256(toUtf8Bytes(`attest:${seed}`)) as `0x${string}`;

  console.log(`receiptRoot: ${receiptRoot}`);

  const { tx, signature, nonce, deadline } = await registry.signAndAnchor(wallet, {
    receiptRoot,
    storageRoot,
    receiptType: 0,
    attestationHash,
  });
  console.log(`signature: ${signature.slice(0, 20)}…`);
  console.log(`nonce: ${nonce}  deadline: ${deadline}`);
  console.log(`tx: ${tx.hash}`);
  console.log(`waiting for confirmation…`);
  const receipt = await tx.wait();
  console.log(`block: ${receipt?.blockNumber}`);

  const after = await registry.nextId();
  console.log(`nextId after anchor: ${after}`);
  if (after !== before + 1n) {
    throw new Error(`expected nextId to advance by 1; got ${before} -> ${after}`);
  }

  const anchored = await registry.getReceipt(after - 1n);
  if (!anchored) throw new Error('anchor wrote nothing');
  console.log(`anchored.id: ${anchored.id}`);
  console.log(`anchored.agent: ${anchored.agentAddress}`);
  console.log(`anchored.receiptRoot: ${anchored.receiptRoot}`);
  if (anchored.agentAddress.toLowerCase() !== agent.toLowerCase()) {
    throw new Error(`agent mismatch: chain says ${anchored.agentAddress}, signer is ${agent}`);
  }
  if (anchored.receiptRoot.toLowerCase() !== receiptRoot.toLowerCase()) {
    throw new Error(`receiptRoot mismatch on chain`);
  }

  const newNonce = await registry.nonces(agent as `0x${string}`);
  console.log(`nonce after: ${newNonce} (was ${nonce})`);
  if (newNonce !== nonce + 1n) {
    throw new Error(`nonce did not advance: ${nonce} -> ${newNonce}`);
  }

  console.log('───────────────────────────────────────────────────────────');
  console.log(`✅ V2 anchor live · receipt #${anchored.id} agent=${anchored.agentAddress.slice(0, 10)}… nonce ${nonce}->${newNonce} · tx ${tx.hash}`);
  console.log(`   chainscan: https://chainscan-galileo.0g.ai/tx/${tx.hash}`);
})();
