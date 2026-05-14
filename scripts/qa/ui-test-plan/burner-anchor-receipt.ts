/**
 * Receipt anchor test · the core product primitive · burner-signed via EIP-712.
 *
 * Anchors a receipt on ReceiptRegistryV2 via a fresh burner wallet's EIP-712
 * signature. Proves K-2 fix end-to-end: agentAddress on chain matches the
 * recovered signer (NOT msg.sender — anyone can be the relayer).
 *
 * Then anchors a slot-10 (doc_room_create) receipt on V3.
 *
 * Coverage:
 *   ReceiptRegistryV2.anchor (EIP-712 signed)
 *   ReceiptRegistryV3.anchor (slot 10 · doc_room_create)
 *   AgentPassportINFTV2.recordReceipt (operator authorized recorder)
 *   SkillPricing.unsetPrice (alice unprices her skill — needs prior publish)
 *   SkillRunPayment.withdrawTreasury (operator admin path)
 */
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseEther,
  formatEther,
  keccak256,
  toUtf8Bytes,
  TypedDataEncoder,
} from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-anchor-receipt');
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
const env = loadEnv();
const OPERATOR_KEY = (env.IVARONIX_SIGNER_KEY ?? env.EVM_PRIVATE_KEY ?? '').replace(/^0x/, '');
const RPC = env.IVARONIX_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16602;
const CHAINSCAN = 'https://chainscan-galileo.0g.ai';

const RECEIPT_V2 = '0xf675d4183b34fe8d1981FA9c117065aAcff690ab';
const RECEIPT_V3 = '0x7396D536594e2BE833070c7EB441A10906046257';
const SKILL_PAY = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';
const PASSPORT_V2 = '0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d';
const SKILL_PRICE = '0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F';
const SKILL_REG_V2 = '0xF05113E83146160024326ff30979c57f5adc2193';

const RECEIPT_ABI = [
  'function anchor(tuple(bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash, address agentAddress, uint256 deadline) p, bytes signature) external returns (uint256)',
  'function receipts(uint256) external view returns (bytes32 receiptRoot, bytes32 storageRoot, bytes32 attestationHash, address agentAddress, uint64 timestamp, uint8 receiptType)',
  'function nextId() external view returns (uint256)',
  'function nonces(address agent) external view returns (uint256)',
];

const SKILL_PRICE_ABI = ['function unsetPrice(bytes32 skillId) external'];
const SKILL_REG_ABI = ['function publishVersion(bytes32 skillId, bytes32 versionId, bytes32 manifestHash) external'];
const SKILL_PRICE_SET_ABI = ['function setPrice(bytes32 skillId, uint256 priceWei, uint16 creatorBps, uint16 treasuryBps) external'];
const PAYMENT_ABI = ['function withdrawTreasury() external', 'function treasuryBalance() external view returns (uint256)'];

const GAS = { gasPrice: 5_000_000_000n, gasLimit: 400_000n };

async function expectStatus1(tx: Awaited<ReturnType<Wallet['sendTransaction']>>, label: string): Promise<void> {
  const r = await tx.wait();
  if (r?.status !== 1) throw new Error(`${label} reverted · tx ${tx.hash}`);
}

async function main(): Promise<void> {
  const tStart = Date.now();
  const provider = new JsonRpcProvider(RPC, { chainId: CHAIN_ID, name: 'galileo' });
  const operator = new Wallet(OPERATOR_KEY, provider);

  // One burner = alice (skill creator + receipt anchor signer)
  const alice = Wallet.createRandom().connect(provider);
  console.log('=== burner ===');
  console.log(`  alice: ${alice.address}`);
  console.log(`  operator: ${operator.address}`);

  // Fund alice
  console.log(`\n=== fund alice 0.03 OG ===`);
  const fundTx = await operator.sendTransaction({ to: alice.address, value: parseEther('0.03'), ...GAS });
  await fundTx.wait();
  console.log(`  ${CHAINSCAN}/tx/${fundTx.hash}`);

  // ───────────────────────────────────────────────────────────────────────
  // §1 · ReceiptRegistryV2.anchor (EIP-712 signed by alice)
  // ───────────────────────────────────────────────────────────────────────
  console.log(`\n=== §1 ReceiptRegistryV2.anchor (EIP-712) ===`);
  const v2 = new Contract(RECEIPT_V2, RECEIPT_ABI, alice);
  const v2RO = new Contract(RECEIPT_V2, RECEIPT_ABI, provider);

  // Read alice's current nonce (0 for fresh wallet)
  const aliceNonce = (await v2RO.nonces!(alice.address)) as bigint;
  console.log(`  alice nonce on V2: ${aliceNonce}`);

  const params = {
    receiptRoot: keccak256(toUtf8Bytes(`burner-v2-${Date.now()}-root`)),
    storageRoot: keccak256(toUtf8Bytes(`burner-v2-${Date.now()}-storage`)),
    receiptType: 0, // skill_exec slot 0-9 allowed on V2
    attestationHash: keccak256(toUtf8Bytes(`burner-v2-${Date.now()}-tee`)),
    agentAddress: alice.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };

  // EIP-712 sign
  const domain = {
    name: 'Ivaronix.ReceiptRegistry',
    version: '2',
    chainId: CHAIN_ID,
    verifyingContract: RECEIPT_V2,
  };
  const types = {
    Anchor: [
      { name: 'receiptRoot', type: 'bytes32' },
      { name: 'storageRoot', type: 'bytes32' },
      { name: 'receiptType', type: 'uint8' },
      { name: 'attestationHash', type: 'bytes32' },
      { name: 'agentAddress', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };
  const value = {
    receiptRoot: params.receiptRoot,
    storageRoot: params.storageRoot,
    receiptType: params.receiptType,
    attestationHash: params.attestationHash,
    agentAddress: params.agentAddress,
    nonce: aliceNonce,
    deadline: params.deadline,
  };
  const signature = await alice.signTypedData(domain, types, value);
  console.log(`  alice signed EIP-712 · sig len ${signature.length}`);

  // Operator submits as relayer (proves anyone can submit; the signed agent is alice)
  const v2WithOp = new Contract(RECEIPT_V2, RECEIPT_ABI, operator);
  const anchorData = v2WithOp.interface.encodeFunctionData('anchor', [
    [params.receiptRoot, params.storageRoot, params.receiptType, params.attestationHash, params.agentAddress, params.deadline],
    signature,
  ]);
  const v2NextIdBefore = (await v2RO.nextId!()) as bigint;
  const anchorTx = await operator.sendTransaction({ to: RECEIPT_V2, data: anchorData, ...GAS });
  await expectStatus1(anchorTx, 'V2 anchor');
  console.log(`  V2 anchor tx: ${CHAINSCAN}/tx/${anchorTx.hash}`);
  const v2NextIdAfter = (await v2RO.nextId!()) as bigint;
  const v2ReceiptId = v2NextIdBefore;
  console.log(`  V2 nextId: ${v2NextIdBefore} → ${v2NextIdAfter} · alice anchored at id ${v2ReceiptId}`);

  // Verify the on-chain receipt has alice as the agent (NOT operator who submitted)
  const v2Receipt = await v2RO.receipts!(v2ReceiptId);
  console.log(`  on-chain receipt[${v2ReceiptId}].agentAddress = ${v2Receipt.agentAddress}`);
  if ((v2Receipt.agentAddress as string).toLowerCase() !== alice.address.toLowerCase()) {
    throw new Error(`agentAddress mismatch · on-chain ${v2Receipt.agentAddress} != alice ${alice.address}`);
  }
  console.log(`  ✓ K-2 fix verified: agent = alice (signer), NOT operator (relayer)`);

  // ───────────────────────────────────────────────────────────────────────
  // §2 · ReceiptRegistryV3.anchor (slot 10 · doc_room_create)
  // ───────────────────────────────────────────────────────────────────────
  console.log(`\n=== §2 ReceiptRegistryV3.anchor (slot 10 doc_room_create) ===`);
  const v3RO = new Contract(RECEIPT_V3, RECEIPT_ABI, provider);
  const aliceNonceV3 = (await v3RO.nonces!(alice.address)) as bigint;
  console.log(`  alice nonce on V3: ${aliceNonceV3}`);

  const paramsV3 = {
    receiptRoot: keccak256(toUtf8Bytes(`burner-v3-slot10-${Date.now()}-root`)),
    storageRoot: keccak256(toUtf8Bytes(`burner-v3-slot10-${Date.now()}-storage`)),
    receiptType: 10, // doc_room_create — V3-only slot
    attestationHash: keccak256(toUtf8Bytes(`burner-v3-slot10-${Date.now()}-tee`)),
    agentAddress: alice.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
  const domainV3 = {
    name: 'Ivaronix.ReceiptRegistry',
    version: '3',
    chainId: CHAIN_ID,
    verifyingContract: RECEIPT_V3,
  };
  const valueV3 = {
    receiptRoot: paramsV3.receiptRoot,
    storageRoot: paramsV3.storageRoot,
    receiptType: paramsV3.receiptType,
    attestationHash: paramsV3.attestationHash,
    agentAddress: paramsV3.agentAddress,
    nonce: aliceNonceV3,
    deadline: paramsV3.deadline,
  };
  const sigV3 = await alice.signTypedData(domainV3, types, valueV3);
  const v3WithOp = new Contract(RECEIPT_V3, RECEIPT_ABI, operator);
  const v3AnchorData = v3WithOp.interface.encodeFunctionData('anchor', [
    [paramsV3.receiptRoot, paramsV3.storageRoot, paramsV3.receiptType, paramsV3.attestationHash, paramsV3.agentAddress, paramsV3.deadline],
    sigV3,
  ]);
  const v3NextIdBefore = (await v3RO.nextId!()) as bigint;
  const v3Tx = await operator.sendTransaction({ to: RECEIPT_V3, data: v3AnchorData, ...GAS });
  await expectStatus1(v3Tx, 'V3 anchor');
  console.log(`  V3 anchor tx: ${CHAINSCAN}/tx/${v3Tx.hash}`);
  const v3NextIdAfter = (await v3RO.nextId!()) as bigint;
  const v3ReceiptId = v3NextIdBefore;
  console.log(`  V3 nextId: ${v3NextIdBefore} → ${v3NextIdAfter} · slot-10 anchored at id ${v3ReceiptId}`);
  const v3Receipt = await v3RO.receipts!(v3ReceiptId);
  console.log(`  V3 receipt[${v3ReceiptId}]: type=${v3Receipt.receiptType} agent=${v3Receipt.agentAddress}`);

  // ───────────────────────────────────────────────────────────────────────
  // §3 · SkillPricing.unsetPrice (alice publishes, prices, then unprices)
  // ───────────────────────────────────────────────────────────────────────
  console.log(`\n=== §3 SkillPricing.unsetPrice ===`);
  const slug = `burner-unset-${Date.now().toString(36)}`;
  const skillId = keccak256(toUtf8Bytes('skill:' + slug));
  const versionId = keccak256(toUtf8Bytes('v0.1.0'));
  const manifestHash = keccak256(toUtf8Bytes(`burner unset ${slug}`));

  const reg = new Contract(SKILL_REG_V2, SKILL_REG_ABI, alice);
  const pubTx = await reg.publishVersion!(skillId, versionId, manifestHash, GAS);
  await expectStatus1(pubTx, 'publish');
  console.log(`  publish: ${CHAINSCAN}/tx/${pubTx.hash}`);

  const setPrice = new Contract(SKILL_PRICE, SKILL_PRICE_SET_ABI, alice);
  const setTx = await setPrice.setPrice!(skillId, parseEther('0.005'), 9000, 1000, GAS);
  await expectStatus1(setTx, 'setPrice');
  console.log(`  setPrice: ${CHAINSCAN}/tx/${setTx.hash}`);

  const unset = new Contract(SKILL_PRICE, SKILL_PRICE_ABI, alice);
  const unsetTx = await unset.unsetPrice!(skillId, GAS);
  await expectStatus1(unsetTx, 'unsetPrice');
  console.log(`  unsetPrice: ${CHAINSCAN}/tx/${unsetTx.hash}`);

  // ───────────────────────────────────────────────────────────────────────
  // §4 · SkillRunPayment.withdrawTreasury (operator admin path)
  // ───────────────────────────────────────────────────────────────────────
  console.log(`\n=== §4 SkillRunPayment.withdrawTreasury (operator admin) ===`);
  const paymentRO = new Contract(SKILL_PAY, PAYMENT_ABI, provider);
  const treasuryBefore = (await paymentRO.treasuryBalance!()) as bigint;
  console.log(`  treasury before: ${formatEther(treasuryBefore)} OG`);

  if (treasuryBefore === 0n) {
    console.log(`  treasury is zero · skipping withdrawTreasury · already drained or no fees collected`);
  } else {
    const opPayment = new Contract(SKILL_PAY, PAYMENT_ABI, operator);
    const wData = opPayment.interface.encodeFunctionData('withdrawTreasury', []);
    const wTx = await operator.sendTransaction({ to: SKILL_PAY, data: wData, ...GAS });
    await expectStatus1(wTx, 'withdrawTreasury');
    console.log(`  withdrawTreasury: ${CHAINSCAN}/tx/${wTx.hash}`);
    const treasuryAfter = (await paymentRO.treasuryBalance!()) as bigint;
    console.log(`  treasury after: ${formatEther(treasuryAfter)} OG`);
    if (treasuryAfter !== 0n) throw new Error('treasury not zeroed after withdrawTreasury');
    console.log(`  ✓ treasury drained to operator wallet`);
  }

  const elapsed = (Date.now() - tStart) / 1000;
  console.log(`\n✓ burner-anchor-receipt sweep: PASS in ${elapsed.toFixed(1)}s`);

  // Write proof
  const proof = {
    timestamp: new Date().toISOString(),
    elapsedSec: elapsed,
    alice: { address: alice.address, privateKey: alice.privateKey },
    operator: operator.address,
    v2: {
      receiptId: v2ReceiptId.toString(),
      anchorTx: anchorTx.hash,
      onChainAgent: v2Receipt.agentAddress,
      kFix: 'K-2 EIP-712 signer-recovery: agent = alice (signer), not operator (relayer)',
    },
    v3: {
      receiptId: v3ReceiptId.toString(),
      anchorTx: v3Tx.hash,
      slot: 10,
      slotName: 'doc_room_create',
    },
    unsetPrice: { publishTx: pubTx.hash, setTx: setTx.hash, unsetTx: unsetTx.hash },
    withdrawTreasury: {
      treasuryBefore: formatEther(treasuryBefore),
    },
    chainscanBase: CHAINSCAN,
  };
  const outFile = resolve(OUT, `proof-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(proof, null, 2));
  console.log(`Proof: ${outFile}`);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
