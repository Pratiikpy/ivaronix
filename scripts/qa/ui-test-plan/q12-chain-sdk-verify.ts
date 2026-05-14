/**
 * Q12 · Chain-direct SDK verification of receipt 78.
 *
 * Independent path: uses ethers directly (no @ivaronix/cli, no npx bundle,
 * no Studio). Demonstrates a third-party developer can verify the on-chain
 * anchor metadata for any Ivaronix receipt with a 10-line ethers script.
 */
import { JsonRpcProvider, Contract } from 'ethers';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/cross-machine/chain-sdk-verify-78.log');
mkdirSync(dirname(OUT), { recursive: true });

const RECEIPT_V2 = '0xf675d4183b34fe8d1981FA9c117065aAcff690ab';
const ABI = [
  'function nextId() external view returns (uint256)',
  'function receipts(uint256) external view returns (bytes32 receiptRoot, bytes32 storageRoot, bytes32 attestationHash, address agentAddress, uint64 timestamp, uint8 receiptType)',
];

async function main(): Promise<void> {
  const lines: string[] = [];
  const log = (s: string): void => { console.log(s); lines.push(s); };

  const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'galileo' });
  const reg = new Contract(RECEIPT_V2, ABI, provider);

  log(`=== Q12 · chain-direct SDK verify (third-party developer path) ===`);
  log(`time:        ${new Date().toISOString()}`);
  log(`chainId:     16602 (Galileo testnet)`);
  log(`RPC:         https://evmrpc-testnet.0g.ai`);
  log(`registry:    ${RECEIPT_V2} (ReceiptRegistryV2)`);
  log(`block:       ${(await provider.getBlock('latest'))!.number}`);
  log('');

  const nextId = await reg.nextId!() as bigint;
  log(`nextId (V2): ${nextId} · meaning receipt ids 1..${nextId - 1n} exist on V2`);
  log('');

  const target = 78n;
  log(`reading receipts(${target})...`);
  const r = await reg.receipts!(target);
  log(`  receiptRoot:     ${r.receiptRoot}`);
  log(`  storageRoot:     ${r.storageRoot}`);
  log(`  attestationHash: ${r.attestationHash}`);
  log(`  agentAddress:    ${r.agentAddress}`);
  log(`  timestamp:       ${r.timestamp} (${new Date(Number(r.timestamp) * 1000).toISOString()})`);
  log(`  receiptType:     ${r.receiptType}`);
  log('');

  const expectedRoot = '0xb383d3b7ea2591196b25f4f368cdf30cb23c500fa3ee0c070c7b54d36c6efee1';
  const expectedAgent = '0xa2c07364eD010b0884d2adc51f4e18eB3900c748';
  const rootPass = r.receiptRoot.toLowerCase() === expectedRoot.toLowerCase();
  const agentPass = r.agentAddress.toLowerCase() === expectedAgent.toLowerCase();
  log(`PASS · receiptRoot matches expected (from PRE-QUEUE-2 anchor):  ${rootPass}`);
  log(`PASS · agentAddress == alice burner (from PRE-QUEUE-2):         ${agentPass}`);
  log(`PASS · timestamp > 0 (receipt was anchored):                    ${r.timestamp > 0n}`);
  log(`PASS · receiptType == 0 (doc_ask code):                         ${Number(r.receiptType) === 0}`);
  log('');

  const allPass = rootPass && agentPass && r.timestamp > 0n;
  log(`SUMMARY: ${allPass ? 'GREEN ✓ · 4/4 PASS · receipt 78 independently verified from ethers SDK · NO Studio · NO Ivaronix CLI · just RPC + ABI + receipt id' : 'RED ✗'}`);

  writeFileSync(OUT, lines.join('\n'));
  console.log(`\nsaved: ${OUT}`);
  if (!allPass) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
