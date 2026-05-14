/**
 * PRE-QUEUE-2 closer · AgentPassportINFTV2.recordReceipt(tokenId, root, type, delta).
 *
 * Standalone burner script (does not depend on the failed refund step in
 * burner-final-sweep.ts). Mint a fresh passport for burner alice, anchor a
 * receipt, then operator calls recordReceipt and we verify all event +
 * state deltas.
 *
 * Output: QA_PROOF_PACK/testnet/burner-gaps/recordReceipt-{timestamp}.json
 */
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  Interface,
  parseEther,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/testnet/burner-gaps');
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
const CS = 'https://chainscan-galileo.0g.ai';

const RECEIPT_V2 = '0xf675d4183b34fe8d1981FA9c117065aAcff690ab';
const PASSPORT_V2 = '0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d';

const RECEIPT_ABI = [
  'function anchor(tuple(bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash, address agentAddress, uint256 deadline) p, bytes signature) external returns (uint256)',
  'function nextId() external view returns (uint256)',
  'function nonces(address) external view returns (uint256)',
];
const PASSPORT_ABI = [
  'function mint(bytes32) external returns (uint256)',
  'function passportOf(address) external view returns (uint256)',
  'function agents(uint256) external view returns (bytes32, bytes32, bytes32, uint64 receiptCount, uint64, int128 trustScore, uint64, uint64)',
  'function recordReceipt(uint256 tokenId, uint256 receiptId, bytes32 expectedReceiptRoot, uint8 expectedReceiptType, int128 trustScoreDelta) external',
  'function authorizedRecorders(address) external view returns (bool)',
  'event ReceiptRecorded(uint256 indexed tokenId, bytes32 indexed receiptRoot, uint256 indexed receiptId, uint8 receiptType, int128 trustScoreDelta)',
];
const GAS = { gasPrice: 5_000_000_000n, gasLimit: 400_000n };

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function check(name: string, pass: boolean, detail: string): void {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? '✓ PASS' : '✗ FAIL'}  ${name}  ·  ${detail}`);
}

async function main(): Promise<void> {
  const tStart = Date.now();
  const provider = new JsonRpcProvider(RPC, { chainId: CHAIN_ID, name: 'galileo' });
  const operator = new Wallet(OPERATOR_KEY, provider);
  const alice = Wallet.createRandom().connect(provider);

  console.log(`=== burner ===`);
  console.log(`  alice:    ${alice.address}`);
  console.log(`  operator: ${operator.address}`);

  const fundTx = await operator.sendTransaction({ to: alice.address, value: parseEther('0.02'), ...GAS });
  await fundTx.wait();
  console.log(`  fund alice: ${CS}/tx/${fundTx.hash}`);

  // Step 1 · Mint passport for alice
  console.log(`\n=== step 1 · mint passport ===`);
  const passportAlice = new Contract(PASSPORT_V2, PASSPORT_ABI, alice);
  const metadataRoot = keccak256(toUtf8Bytes(`recordReceipt-passport-${Date.now()}`));
  const mintTx = await passportAlice.mint!(metadataRoot, GAS);
  const mintRcpt = await mintTx.wait();
  if (mintRcpt?.status !== 1) throw new Error('passport mint reverted');
  const passportRO = new Contract(PASSPORT_V2, PASSPORT_ABI, provider);
  const aliceTokenId = await passportRO.passportOf!(alice.address) as bigint;
  console.log(`  alice tokenId: ${aliceTokenId}  ·  ${CS}/tx/${mintTx.hash}`);

  // Step 2 · Anchor a fresh receipt as alice
  console.log(`\n=== step 2 · anchor receipt ===`);
  const v2 = new Contract(RECEIPT_V2, RECEIPT_ABI, provider);
  const v2Op = new Contract(RECEIPT_V2, RECEIPT_ABI, operator);
  const nonceA = await v2.nonces!(alice.address) as bigint;
  const nextIdBefore = await v2.nextId!() as bigint;
  const ts = Date.now();
  const params = {
    receiptRoot: keccak256(toUtf8Bytes(`recordReceipt-root-${ts}`)),
    storageRoot: keccak256(toUtf8Bytes(`recordReceipt-storage-${ts}`)),
    receiptType: 0,
    attestationHash: keccak256(toUtf8Bytes(`recordReceipt-tee-${ts}`)),
    agentAddress: alice.address,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
  const domain = { name: 'Ivaronix.ReceiptRegistry', version: '2', chainId: CHAIN_ID, verifyingContract: RECEIPT_V2 };
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
  const sig = await alice.signTypedData(domain, types, { ...params, nonce: nonceA });
  const anchorData = v2Op.interface.encodeFunctionData('anchor', [
    [params.receiptRoot, params.storageRoot, params.receiptType, params.attestationHash, params.agentAddress, params.deadline],
    sig,
  ]);
  const anchorTx = await operator.sendTransaction({ to: RECEIPT_V2, data: anchorData, ...GAS });
  const aRcpt = await anchorTx.wait();
  if (aRcpt?.status !== 1) throw new Error('anchor reverted');
  const receiptId = nextIdBefore;
  console.log(`  anchored id=${receiptId}  ·  ${CS}/tx/${anchorTx.hash}`);

  // Step 3 · recordReceipt (operator authorized recorder)
  console.log(`\n=== step 3 · recordReceipt (operator → alice's passport) ===`);
  const isAuth = await passportRO.authorizedRecorders!(operator.address) as boolean;
  check('operator is authorized recorder', isAuth, isAuth ? 'allowed to call recordReceipt' : 'NOT authorized · K-4 access-control gating');
  if (!isAuth) throw new Error('operator NOT authorized · cannot complete recordReceipt phase · K-4 gate needs operator to call addAuthorizedRecorder(operator)');

  const beforeAgent = await passportRO.agents!(aliceTokenId);
  console.log(`  before · receiptCount=${beforeAgent.receiptCount} trustScore=${beforeAgent.trustScore}`);

  const passportOp = new Contract(PASSPORT_V2, PASSPORT_ABI, operator);
  const recordData = passportOp.interface.encodeFunctionData('recordReceipt', [aliceTokenId, receiptId, params.receiptRoot, 0, 5]);
  const recordTx = await operator.sendTransaction({ to: PASSPORT_V2, data: recordData, ...GAS });
  const recordRcpt = await recordTx.wait();
  check('recordReceipt tx success', recordRcpt?.status === 1, `tx ${recordTx.hash}`);

  const afterAgent = await passportRO.agents!(aliceTokenId);
  check('receiptCount incremented by 1', afterAgent.receiptCount - beforeAgent.receiptCount === 1n,
    `${beforeAgent.receiptCount} -> ${afterAgent.receiptCount}`);
  check('trustScore delta == +5', afterAgent.trustScore - beforeAgent.trustScore === 5n,
    `${beforeAgent.trustScore} -> ${afterAgent.trustScore}`);

  const iface = new Interface(PASSPORT_ABI);
  const recordTopic = iface.getEvent('ReceiptRecorded')!.topicHash;
  const recordLog = recordRcpt!.logs.find((l) => l.topics[0] === recordTopic);
  check('ReceiptRecorded event emitted', !!recordLog, '');
  let eventParsed: { tokenId: bigint; receiptRoot: string; receiptId: bigint; receiptType: number; trustScoreDelta: bigint } | null = null;
  if (recordLog) {
    const parsed = iface.parseLog({ topics: recordLog.topics as string[], data: recordLog.data });
    if (parsed) {
      eventParsed = {
        tokenId: parsed.args.tokenId as bigint,
        receiptRoot: parsed.args.receiptRoot as string,
        receiptId: parsed.args.receiptId as bigint,
        receiptType: Number(parsed.args.receiptType),
        trustScoreDelta: parsed.args.trustScoreDelta as bigint,
      };
      check('event.tokenId == alice token', eventParsed.tokenId === aliceTokenId, `${eventParsed.tokenId}`);
      check('event.receiptId == anchored id', eventParsed.receiptId === receiptId, `${eventParsed.receiptId}`);
      check('event.receiptRoot matches', eventParsed.receiptRoot.toLowerCase() === params.receiptRoot.toLowerCase(), '');
      check('event.trustScoreDelta == 5', eventParsed.trustScoreDelta === 5n, `${eventParsed.trustScoreDelta}`);
    }
  }

  const elapsed = (Date.now() - tStart) / 1000;
  const passCount = checks.filter((c) => c.pass).length;
  const failCount = checks.filter((c) => !c.pass).length;
  console.log(`\n=== summary ===`);
  console.log(`  ${passCount}/${checks.length} PASS · ${failCount} FAIL · elapsed ${elapsed.toFixed(1)}s`);

  const proof = {
    timestamp: new Date().toISOString(),
    elapsedSec: elapsed,
    alice: { address: alice.address, privateKey: alice.privateKey },
    operator: operator.address,
    passportTokenId: aliceTokenId.toString(),
    receiptId: receiptId.toString(),
    receiptRoot: params.receiptRoot,
    txs: {
      fundAlice: { hash: fundTx.hash, chainscan: `${CS}/tx/${fundTx.hash}` },
      mintPassport: { hash: mintTx.hash, chainscan: `${CS}/tx/${mintTx.hash}` },
      anchor: { hash: anchorTx.hash, chainscan: `${CS}/tx/${anchorTx.hash}` },
      recordReceipt: { hash: recordTx.hash, chainscan: `${CS}/tx/${recordTx.hash}` },
    },
    deltas: {
      receiptCount: { before: beforeAgent.receiptCount.toString(), after: afterAgent.receiptCount.toString() },
      trustScore: { before: beforeAgent.trustScore.toString(), after: afterAgent.trustScore.toString() },
    },
    event: eventParsed ? {
      tokenId: eventParsed.tokenId.toString(),
      receiptId: eventParsed.receiptId.toString(),
      receiptRoot: eventParsed.receiptRoot,
      receiptType: eventParsed.receiptType,
      trustScoreDelta: eventParsed.trustScoreDelta.toString(),
    } : null,
    checks,
    summary: { pass: passCount, fail: failCount, total: checks.length },
  };
  const outFile = resolve(OUT, `recordReceipt-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(proof, null, 2));
  console.log(`\nproof: ${outFile}`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err.message ?? err); process.exit(1); });
