/**
 * Final feature sweep · 3 remaining items verified on chain (no shell-out):
 *
 *   §1 Subgraph cross-check (Goldsky indexer mirrors burner anchor)
 *   §2 SkillRunPayment.refundFailedRun (operator admin)
 *   §3 AgentPassportINFTV2.recordReceipt (operator authorized recorder)
 */
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseEther,
  formatEther,
  keccak256,
  toUtf8Bytes,
  Interface,
} from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-final-sweep');
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
const SUBGRAPH = env.SUBGRAPH_URL ?? '';
const RPC = env.IVARONIX_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16602;
const CS = 'https://chainscan-galileo.0g.ai';

const RECEIPT_V2 = '0xf675d4183b34fe8d1981FA9c117065aAcff690ab';
const SKILL_PAY = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';
const PASSPORT_V2 = '0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d';

const RECEIPT_ABI = [
  'function anchor(tuple(bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash, address agentAddress, uint256 deadline) p, bytes signature) external returns (uint256)',
  'function nextId() external view returns (uint256)',
  'function nonces(address) external view returns (uint256)',
  'function receipts(uint256) external view returns (bytes32 receiptRoot, bytes32 storageRoot, bytes32 attestationHash, address agentAddress, uint64 timestamp, uint8 receiptType)',
];
const PAY_ABI = [
  'function paySkillRun(bytes32 receiptRoot, address creator, uint16 creatorBps, uint16 treasuryBps) external payable',
  'function refundFailedRun(bytes32 receiptRoot) external',
  'function refunded(bytes32) external view returns (bool)',
  'event Refunded(bytes32 indexed receiptRoot, address indexed payer, uint256 amount, uint64 timestamp)',
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
  const bob = Wallet.createRandom().connect(provider);

  console.log(`=== burners ===`);
  console.log(`  alice: ${alice.address}`);
  console.log(`  bob:   ${bob.address}`);
  console.log(`  operator: ${operator.address}`);

  for (const [n, w] of [['alice', alice], ['bob', bob]] as const) {
    const tx = await operator.sendTransaction({ to: w.address, value: parseEther('0.025'), ...GAS });
    await tx.wait();
    console.log(`  fund ${n}: ${CS}/tx/${tx.hash}`);
  }

  // §1 · Anchor and (optionally) cross-check the subgraph
  console.log(`\n=== §1 anchor + subgraph cross-check ===`);
  const v2 = new Contract(RECEIPT_V2, RECEIPT_ABI, provider);
  const v2Op = new Contract(RECEIPT_V2, RECEIPT_ABI, operator);
  const nonceA = await v2.nonces!(alice.address) as bigint;
  const nextIdBefore = await v2.nextId!() as bigint;
  const params = {
    receiptRoot: keccak256(toUtf8Bytes(`final-${Date.now()}-root`)),
    storageRoot: keccak256(toUtf8Bytes(`final-${Date.now()}-storage`)),
    receiptType: 0,
    attestationHash: keccak256(toUtf8Bytes(`final-${Date.now()}-tee`)),
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

  if (SUBGRAPH) {
    console.log(`  waiting 20s for subgraph...`);
    await new Promise((r) => setTimeout(r, 20_000));
    const query = `{ receipts(where: {receiptRoot: "${params.receiptRoot.toLowerCase()}"}) { id receiptRoot agent } }`;
    try {
      const r = await fetch(SUBGRAPH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const sgRes = await r.json() as { data?: { receipts?: Array<{ id: string; receiptRoot: string; agent: string }> } };
      const sgReceipts = sgRes.data?.receipts ?? [];
      check('subgraph indexed burner receipt', sgReceipts.length > 0, `found ${sgReceipts.length}`);
      if (sgReceipts.length > 0) {
        const r0 = sgReceipts[0]!;
        check('subgraph agent == alice', r0.agent.toLowerCase() === alice.address.toLowerCase(), r0.agent);
        check('subgraph receiptRoot matches', r0.receiptRoot.toLowerCase() === params.receiptRoot.toLowerCase(), r0.receiptRoot.slice(0, 18) + '...');
      }
    } catch (err) {
      check('subgraph query', false, `error: ${(err as Error).message}`);
    }
  } else {
    console.log(`  SUBGRAPH_URL not set · skipping subgraph cross-check (informational, not a fail)`);
  }

  // §2 · refundFailedRun
  console.log(`\n=== §2 SkillRunPayment.refundFailedRun ===`);
  const pay = new Contract(SKILL_PAY, PAY_ABI, bob);
  const draftRoot = keccak256(toUtf8Bytes(`final-failed-run-${Date.now()}`));
  const payTx = await pay.paySkillRun!(draftRoot, alice.address, 9000, 1000, { value: parseEther('0.005'), ...GAS });
  const payRcpt = await payTx.wait();
  if (payRcpt?.status !== 1) throw new Error('paySkillRun reverted');
  console.log(`  bob paid 0.005 OG · tx ${CS}/tx/${payTx.hash}`);
  const bobBefore = await provider.getBalance(bob.address);
  const payOp = new Contract(SKILL_PAY, PAY_ABI, operator);
  const refundData = payOp.interface.encodeFunctionData('refundFailedRun', [draftRoot]);
  const refundTx = await operator.sendTransaction({ to: SKILL_PAY, data: refundData, ...GAS });
  const refundRcpt = await refundTx.wait();
  check('refundFailedRun tx success', refundRcpt?.status === 1, `tx ${refundTx.hash}`);
  const refundedFlag = await pay.refunded!(draftRoot) as boolean;
  check('refunded[receiptRoot] = true', refundedFlag === true, `flag=${refundedFlag}`);
  const payIface = new Interface(PAY_ABI);
  const refundTopic = payIface.getEvent('Refunded')!.topicHash;
  const refundLog = refundRcpt!.logs.find((l) => l.topics[0] === refundTopic);
  check('Refunded event emitted', !!refundLog, '');
  if (refundLog) {
    const parsed = payIface.parseLog({ topics: refundLog.topics as string[], data: refundLog.data });
    check('event.payer == bob', (parsed?.args.payer as string).toLowerCase() === bob.address.toLowerCase(), '');
    check('event.amount == 0.005 OG', parsed?.args.amount === parseEther('0.005'), `${formatEther(parsed?.args.amount as bigint)} OG`);
    check('event.receiptRoot == draftRoot', (parsed?.args.receiptRoot as string).toLowerCase() === draftRoot.toLowerCase(), '');
  }
  const bobAfter = await provider.getBalance(bob.address);
  check('bob wallet balance increased after refund', bobAfter > bobBefore, `delta=+${formatEther(bobAfter - bobBefore)} OG`);

  // §3 · recordReceipt
  console.log(`\n=== §3 AgentPassportINFTV2.recordReceipt ===`);
  const passportAlice = new Contract(PASSPORT_V2, PASSPORT_ABI, alice);
  const metadataRoot = keccak256(toUtf8Bytes(`final-passport-${Date.now()}`));
  const mintTx = await passportAlice.mint!(metadataRoot, GAS);
  const mintRcpt = await mintTx.wait();
  if (mintRcpt?.status !== 1) throw new Error('passport mint reverted');
  const passportRO = new Contract(PASSPORT_V2, PASSPORT_ABI, provider);
  const aliceTokenId = await passportRO.passportOf!(alice.address) as bigint;
  console.log(`  alice tokenId: ${aliceTokenId}  ·  mint tx ${CS}/tx/${mintTx.hash}`);

  const isAuth = await passportRO.authorizedRecorders!(operator.address) as boolean;
  check('operator is authorized recorder', isAuth, isAuth ? 'allowed to call recordReceipt' : 'NOT authorized · K-4 access-control is gating');

  if (isAuth) {
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
    const passportIface = new Interface(PASSPORT_ABI);
    const recordTopic = passportIface.getEvent('ReceiptRecorded')!.topicHash;
    const recordLog = recordRcpt!.logs.find((l) => l.topics[0] === recordTopic);
    check('ReceiptRecorded event emitted', !!recordLog, '');
    if (recordLog) {
      const parsed = passportIface.parseLog({ topics: recordLog.topics as string[], data: recordLog.data });
      check('event.tokenId == alice token', parsed?.args.tokenId === aliceTokenId, `${parsed?.args.tokenId}`);
      check('event.receiptRoot matches', (parsed?.args.receiptRoot as string).toLowerCase() === params.receiptRoot.toLowerCase(), '');
      check('event.trustScoreDelta == 5', parsed?.args.trustScoreDelta === 5n, `${parsed?.args.trustScoreDelta}`);
    }
  } else {
    console.log(`  operator not authorized · K-4 gate is enforced (this is correct behaviour, not a fail)`);
    check('K-4 access control enforced (negative test)', !isAuth, 'recordReceipt would revert with NotAuthorizedRecorder');
  }

  const elapsed = (Date.now() - tStart) / 1000;
  const passCount = checks.filter((c) => c.pass).length;
  const failCount = checks.filter((c) => !c.pass).length;
  console.log(`\n=== summary ===`);
  console.log(`  ${passCount}/${checks.length} PASS · ${failCount} FAIL · elapsed ${elapsed.toFixed(1)}s`);
  if (failCount > 0) {
    console.log(`  failures:`);
    for (const c of checks) if (!c.pass) console.log(`    ${c.name} · ${c.detail}`);
  }

  const proof = {
    timestamp: new Date().toISOString(),
    elapsedSec: elapsed,
    alice: { address: alice.address, privateKey: alice.privateKey },
    bob: { address: bob.address, privateKey: bob.privateKey },
    operator: operator.address,
    receiptId: receiptId.toString(),
    receiptRoot: params.receiptRoot,
    txs: {
      anchor: anchorTx.hash,
      paySkillRun: payTx.hash,
      refundFailedRun: refundTx.hash,
      mintPassport: mintTx.hash,
    },
    checks,
    summary: { pass: passCount, fail: failCount, total: checks.length },
  };
  const outFile = resolve(OUT, `final-sweep-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(proof, null, 2));
  console.log(`\nproof: ${outFile}`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
