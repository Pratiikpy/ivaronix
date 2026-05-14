/**
 * Deep outcome verifier · for every on-chain action, prove the OUTCOME
 * landed (not just that the tx returned status=1).
 *
 * For each function call we verify:
 *   1. tx receipt status = 1
 *   2. expected event(s) emitted with correct topics/data
 *   3. post-call state read matches the expected change
 *   4. side-effect (e.g., wallet balance delta) lines up with the action
 *
 * Pattern: every action gets a `before` read + `tx` + `after` read +
 * `delta` assertion + `event` parse. Print one line per action with
 * PASS/FAIL/detail.
 */
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseEther,
  formatEther,
  keccak256,
  toUtf8Bytes,
  ZeroHash,
  Interface,
} from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-outcomes-deep');
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

const PASSPORT_V2 = '0x85e9dD63155836a9BF31F579BFC3a8eb2B46494d';
const SKILL_REG_V2 = '0xF05113E83146160024326ff30979c57f5adc2193';
const SKILL_PRICE = '0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F';
const SKILL_PAY = '0x9eA5FDba913AC94dA8833Fee21F2832827950A5C';
const CAPABILITY_V2 = '0x1351CD87360f0366D0A0068164e606B3c320F3E1';

const PASSPORT_ABI = [
  'function mint(bytes32 metadataRoot) external returns (uint256)',
  'function passportOf(address) external view returns (uint256)',
  'function agents(uint256) external view returns (bytes32 metadataRoot, bytes32 memoryRoot, bytes32 skillManifestRoot, uint64 receiptCount, uint64 violationCount, int128 trustScore, uint64 mintedAt, uint64 lastEvolutionAt)',
  'event PassportMinted(uint256 indexed tokenId, address indexed owner, bytes32 metadataRoot)',
];
const SKILL_REG_ABI = [
  'function publishVersion(bytes32 skillId, bytes32 versionId, bytes32 manifestHash) external',
  'function versionCount(bytes32 skillId) external view returns (uint256)',
  'function ownerOf(bytes32 skillId) external view returns (address)',
  'event SkillPublished(bytes32 indexed skillId, bytes32 indexed versionId, address indexed creator, bytes32 manifestHash, uint64 publishedAt)',
];
const SKILL_PRICE_ABI = [
  'function setPrice(bytes32 skillId, uint256 priceWei, uint16 creatorBps, uint16 treasuryBps) external',
  'function getPricing(bytes32 skillId) external view returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)',
  'function unsetPrice(bytes32 skillId) external',
  'event PriceUpdated(bytes32 indexed skillId, address indexed creator, uint256 priceWei, uint16 creatorBps, uint16 treasuryBps)',
  'event PriceUnset(bytes32 indexed skillId, address indexed by)',
];
const SKILL_PAY_ABI = [
  'function paySkillRun(bytes32 receiptRoot, address creator, uint16 creatorBps, uint16 treasuryBps) external payable',
  'function creatorBalance(address) external view returns (uint256)',
  'function creatorLifetimeEarned(address) external view returns (uint256)',
  'function treasuryBalance() external view returns (uint256)',
  'function withdrawCreator() external',
  'event SkillRunPaid(bytes32 indexed receiptRoot, address indexed payer, address indexed creator, uint256 amount, uint256 creatorShare, uint256 treasuryShare, uint16 creatorBps, uint16 treasuryBps, uint64 timestamp)',
  'event Withdrawn(address indexed by, uint256 amount, bool isTreasury)',
];
const CAP_ABI = [
  'function issueGrant(address grantee, bytes32 scopeHash, uint64 ttlSeconds, uint32 readsCap) external returns (bytes32)',
  'function isValid(bytes32 grantId, address grantee, bytes32 scopeHash) external view returns (bool)',
  'function revokeGrant(bytes32 grantId) external',
  'event GrantIssued(bytes32 indexed grantId, address indexed owner, address indexed grantee, bytes32 scopeHash, uint64 expiresAt, uint32 readsCap)',
  'event GrantRevoked(bytes32 indexed grantId, address indexed owner)',
];

const GAS = { gasPrice: 5_000_000_000n, gasLimit: 400_000n };

type CheckRow = { action: string; pass: boolean; detail: string };
const checks: CheckRow[] = [];

function check(action: string, condition: boolean, detail: string): void {
  checks.push({ action, pass: condition, detail });
  const tag = condition ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${tag}  ${action}  ·  ${detail}`);
}

function findEvent(receipt: { logs: ReadonlyArray<{ topics: ReadonlyArray<string>; data: string }> }, iface: Interface, name: string) {
  const topic = iface.getEvent(name)!.topicHash;
  const log = receipt.logs.find((l) => l.topics[0] === topic);
  if (!log) return null;
  return iface.parseLog({ topics: log.topics as string[], data: log.data });
}

async function main(): Promise<void> {
  const tStart = Date.now();
  const provider = new JsonRpcProvider(RPC, { chainId: CHAIN_ID, name: 'galileo' });
  const operator = new Wallet(OPERATOR_KEY, provider);

  const alice = Wallet.createRandom().connect(provider);
  const bob = Wallet.createRandom().connect(provider);
  const carol = Wallet.createRandom().connect(provider);

  console.log('=== burners ===');
  console.log(`  alice (creator): ${alice.address}`);
  console.log(`  bob   (buyer):   ${bob.address}`);
  console.log(`  carol (grantee): ${carol.address}`);
  console.log(`  operator:        ${operator.address}`);

  // Fund all three
  for (const [name, w] of [['alice', alice], ['bob', bob], ['carol', carol]] as const) {
    const tx = await operator.sendTransaction({ to: w.address, value: parseEther('0.03'), ...GAS });
    await tx.wait();
    console.log(`  fund ${name}: ${CS}/tx/${tx.hash}`);
  }

  // ── §1 · AgentPassportINFTV2.mint · verify event + state ────────────────
  console.log(`\n=== §1 PASSPORT MINT outcomes ===`);
  const passportIface = new Interface(PASSPORT_ABI);
  const passport = new Contract(PASSPORT_V2, PASSPORT_ABI, alice);
  const passportRO = new Contract(PASSPORT_V2, PASSPORT_ABI, provider);
  const metadataRoot = keccak256(toUtf8Bytes(`outcomes-${Date.now()}`));
  const mintTx = await passport.mint!(metadataRoot, GAS);
  const mintRcpt = await mintTx.wait();
  check('mint tx status', mintRcpt?.status === 1, `tx ${mintTx.hash}`);
  const ev = findEvent(mintRcpt!, passportIface, 'PassportMinted');
  check('PassportMinted event emitted', ev !== null, ev ? `tokenId=${ev.args.tokenId} owner=${ev.args.owner}` : 'event missing');
  check('event.owner == alice', ev?.args.owner.toLowerCase() === alice.address.toLowerCase(), ev?.args.owner ?? '-');
  check('event.metadataRoot == provided', ev?.args.metadataRoot === metadataRoot, '');
  const tokenId = await passportRO.passportOf!(alice.address) as bigint;
  check('passportOf(alice) > 0', tokenId > 0n, `tokenId=${tokenId}`);
  const agentData = await passportRO.agents!(tokenId);
  check('agent.metadataRoot stored correctly', agentData.metadataRoot === metadataRoot, '');
  check('agent.trustScore initial = 0', agentData.trustScore === 0n, `trustScore=${agentData.trustScore}`);
  check('agent.receiptCount initial = 0', agentData.receiptCount === 0n, `receiptCount=${agentData.receiptCount}`);

  // ── §2 · SkillRegistryV2.publishVersion · event + state ────────────────
  console.log(`\n=== §2 SKILL PUBLISH outcomes ===`);
  const slug = `outcomes-${Date.now().toString(36)}`;
  const skillId = keccak256(toUtf8Bytes('skill:' + slug));
  const versionId = keccak256(toUtf8Bytes('v0.1.0'));
  const manifestHash = keccak256(toUtf8Bytes(`outcomes manifest ${slug}`));
  const regIface = new Interface(SKILL_REG_ABI);
  const reg = new Contract(SKILL_REG_V2, SKILL_REG_ABI, alice);
  const regRO = new Contract(SKILL_REG_V2, SKILL_REG_ABI, provider);
  const pubTx = await reg.publishVersion!(skillId, versionId, manifestHash, GAS);
  const pubRcpt = await pubTx.wait();
  check('publishVersion tx status', pubRcpt?.status === 1, `tx ${pubTx.hash}`);
  const pubEv = findEvent(pubRcpt!, regIface, 'SkillPublished');
  check('SkillPublished event emitted', pubEv !== null, pubEv ? `skill=${pubEv.args.skillId.slice(0, 14)}...` : 'missing');
  check('event.creator == alice', pubEv?.args.creator.toLowerCase() === alice.address.toLowerCase(), '');
  check('event.versionId matches', pubEv?.args.versionId === versionId, '');
  check('event.manifestHash matches', pubEv?.args.manifestHash === manifestHash, '');
  const owner = await regRO.ownerOf!(skillId) as string;
  check('ownerOf(skillId) == alice', owner.toLowerCase() === alice.address.toLowerCase(), owner);
  const vCount = await regRO.versionCount!(skillId) as bigint;
  check('versionCount == 1', vCount === 1n, `count=${vCount}`);

  // ── §3 · SkillPricing.setPrice · event + getPricing ────────────────────
  console.log(`\n=== §3 SET PRICE outcomes ===`);
  const priceIface = new Interface(SKILL_PRICE_ABI);
  const pricing = new Contract(SKILL_PRICE, SKILL_PRICE_ABI, alice);
  const pricingRO = new Contract(SKILL_PRICE, SKILL_PRICE_ABI, provider);
  const price = parseEther('0.005');
  const setTx = await pricing.setPrice!(skillId, price, 9000, 1000, GAS);
  const setRcpt = await setTx.wait();
  check('setPrice tx status', setRcpt?.status === 1, `tx ${setTx.hash}`);
  const priceEv = findEvent(setRcpt!, priceIface, 'PriceUpdated');
  check('PriceUpdated event emitted', priceEv !== null, '');
  check('event.priceWei matches', priceEv?.args.priceWei === price, `priceWei=${formatEther(priceEv?.args.priceWei as bigint)} OG`);
  check('event.creatorBps == 9000', priceEv?.args.creatorBps === 9000n, '');
  check('event.treasuryBps == 1000', priceEv?.args.treasuryBps === 1000n, '');
  const pData = await pricingRO.getPricing!(skillId);
  check('getPricing.priced = true', pData[3] === true, `priced=${pData[3]}`);
  check('getPricing.price matches', pData[0] === price, `${formatEther(pData[0])} OG`);

  // ── §4 · paySkillRun · event + state delta + balance ───────────────────
  console.log(`\n=== §4 PAY SKILL RUN outcomes ===`);
  const payIface = new Interface(SKILL_PAY_ABI);
  const payBob = new Contract(SKILL_PAY, SKILL_PAY_ABI, bob);
  const payRO = new Contract(SKILL_PAY, SKILL_PAY_ABI, provider);
  const aliceBalBefore = await payRO.creatorBalance!(alice.address) as bigint;
  const treasuryBefore = await payRO.treasuryBalance!() as bigint;
  const aliceLifetimeBefore = await payRO.creatorLifetimeEarned!(alice.address) as bigint;
  const draftRoot = keccak256(toUtf8Bytes(`outcomes-run-${Date.now()}`));
  const payTx = await payBob.paySkillRun!(draftRoot, alice.address, 9000, 1000, { value: price, ...GAS });
  const payRcpt = await payTx.wait();
  check('paySkillRun tx status', payRcpt?.status === 1, `tx ${payTx.hash}`);
  const payEv = findEvent(payRcpt!, payIface, 'SkillRunPaid');
  check('SkillRunPaid event emitted', payEv !== null, '');
  check('event.payer == bob', payEv?.args.payer.toLowerCase() === bob.address.toLowerCase(), '');
  check('event.creator == alice', payEv?.args.creator.toLowerCase() === alice.address.toLowerCase(), '');
  const expectedCreator = (price * 9000n) / 10000n;
  const expectedTreasury = (price * 1000n) / 10000n;
  check('event.creatorShare = 90% of price', payEv?.args.creatorShare === expectedCreator, `${formatEther((payEv?.args.creatorShare as bigint) ?? 0n)} OG`);
  check('event.treasuryShare = 10% of price', payEv?.args.treasuryShare === expectedTreasury, `${formatEther((payEv?.args.treasuryShare as bigint) ?? 0n)} OG`);
  check('event.amount == price', payEv?.args.amount === price, `${formatEther((payEv?.args.amount as bigint) ?? 0n)} OG`);
  const aliceBalAfter = await payRO.creatorBalance!(alice.address) as bigint;
  const treasuryAfter = await payRO.treasuryBalance!() as bigint;
  const aliceLifetimeAfter = await payRO.creatorLifetimeEarned!(alice.address) as bigint;
  check('alice creatorBalance delta == 90%', aliceBalAfter - aliceBalBefore === expectedCreator, `+${formatEther(aliceBalAfter - aliceBalBefore)} OG`);
  check('treasury delta == 10%', treasuryAfter - treasuryBefore === expectedTreasury, `+${formatEther(treasuryAfter - treasuryBefore)} OG`);
  check('alice lifetimeEarned delta == 90%', aliceLifetimeAfter - aliceLifetimeBefore === expectedCreator, '');

  // ── §5 · withdrawCreator · event + wallet balance delta ────────────────
  console.log(`\n=== §5 WITHDRAW CREATOR outcomes ===`);
  const aliceWalletBefore = await provider.getBalance(alice.address);
  const payAlice = new Contract(SKILL_PAY, SKILL_PAY_ABI, alice);
  const wData = payAlice.interface.encodeFunctionData('withdrawCreator', []);
  const wTx = await alice.sendTransaction({ to: SKILL_PAY, data: wData, ...GAS });
  const wRcpt = await wTx.wait();
  check('withdrawCreator tx status', wRcpt?.status === 1, `tx ${wTx.hash}`);
  const wEv = findEvent(wRcpt!, payIface, 'Withdrawn');
  check('Withdrawn event emitted', wEv !== null, '');
  check('event.amount == alice prior balance', wEv?.args.amount === aliceBalAfter, `${formatEther((wEv?.args.amount as bigint) ?? 0n)} OG`);
  check('event.isTreasury == false (creator path)', wEv?.args.isTreasury === false, `isTreasury=${wEv?.args.isTreasury}`);
  const aliceBalAfterW = await payRO.creatorBalance!(alice.address) as bigint;
  check('creatorBalance(alice) zeroed', aliceBalAfterW === 0n, '');
  const aliceWalletAfter = await provider.getBalance(alice.address);
  const gasCost = wRcpt!.gasUsed * wRcpt!.gasPrice;
  const expectedDelta = aliceBalAfter - gasCost;
  const actualDelta = aliceWalletAfter - aliceWalletBefore;
  check('alice wallet balance delta ~= earned - gas', actualDelta === expectedDelta, `delta=${formatEther(actualDelta)} OG (expected ${formatEther(expectedDelta)} OG)`);

  // ── §6 · unsetPrice · event + getPricing flips ─────────────────────────
  console.log(`\n=== §6 UNSET PRICE outcomes ===`);
  const unsetTx = await pricing.unsetPrice!(skillId, GAS);
  const unsetRcpt = await unsetTx.wait();
  check('unsetPrice tx status', unsetRcpt?.status === 1, `tx ${unsetTx.hash}`);
  const unsetEv = findEvent(unsetRcpt!, priceIface, 'PriceUnset');
  check('PriceUnset event emitted', unsetEv !== null, '');
  const pDataAfter = await pricingRO.getPricing!(skillId);
  check('getPricing.priced = false after unset', pDataAfter[3] === false, `priced=${pDataAfter[3]}`);
  check('getPricing.price = 0 after unset', pDataAfter[0] === 0n, `price=${formatEther(pDataAfter[0])}`);

  // ── §7 · issueGrant + revokeGrant · events + isValid flip ──────────────
  console.log(`\n=== §7 GRANT + REVOKE outcomes ===`);
  const capIface = new Interface(CAP_ABI);
  const cap = new Contract(CAPABILITY_V2, CAP_ABI, alice);
  const capRO = new Contract(CAPABILITY_V2, CAP_ABI, provider);
  const scopeHash = keccak256(toUtf8Bytes('outcomes:memory:scope'));
  const grantTx = await cap.issueGrant!(carol.address, scopeHash, 3600, 100, GAS);
  const grantRcpt = await grantTx.wait();
  check('issueGrant tx status', grantRcpt?.status === 1, `tx ${grantTx.hash}`);
  const grantEv = findEvent(grantRcpt!, capIface, 'GrantIssued');
  check('GrantIssued event emitted', grantEv !== null, '');
  check('event.owner == alice', grantEv?.args.owner.toLowerCase() === alice.address.toLowerCase(), '');
  check('event.grantee == carol', grantEv?.args.grantee.toLowerCase() === carol.address.toLowerCase(), '');
  check('event.scopeHash matches', grantEv?.args.scopeHash === scopeHash, '');
  const grantId = grantEv?.args.grantId as string;
  const validBefore = await capRO.isValid!(grantId, carol.address, scopeHash) as boolean;
  check('isValid = true before revoke', validBefore, '');
  const revokeTx = await cap.revokeGrant!(grantId, GAS);
  const revokeRcpt = await revokeTx.wait();
  check('revokeGrant tx status', revokeRcpt?.status === 1, `tx ${revokeTx.hash}`);
  const revokeEv = findEvent(revokeRcpt!, capIface, 'GrantRevoked');
  check('GrantRevoked event emitted', revokeEv !== null, '');
  check('event.grantId matches', revokeEv?.args.grantId === grantId, '');
  const validAfter = await capRO.isValid!(grantId, carol.address, scopeHash) as boolean;
  check('isValid = false after revoke', !validAfter, '');

  const elapsed = (Date.now() - tStart) / 1000;
  const passCount = checks.filter((c) => c.pass).length;
  const failCount = checks.filter((c) => !c.pass).length;
  console.log(`\n=== summary ===`);
  console.log(`  ${passCount}/${checks.length} outcome assertions PASS · ${failCount} FAIL`);
  console.log(`  elapsed: ${elapsed.toFixed(1)}s`);
  if (failCount > 0) {
    console.log(`\n  failures:`);
    for (const c of checks) if (!c.pass) console.log(`    ✗ ${c.action} · ${c.detail}`);
  }

  // Write proof
  const proof = {
    timestamp: new Date().toISOString(),
    elapsedSec: elapsed,
    burners: {
      alice: { address: alice.address, privateKey: alice.privateKey },
      bob:   { address: bob.address,   privateKey: bob.privateKey   },
      carol: { address: carol.address, privateKey: carol.privateKey },
    },
    checks,
    summary: { pass: passCount, fail: failCount, total: checks.length },
  };
  const outFile = resolve(OUT, `outcomes-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(proof, null, 2));
  console.log(`\nProof: ${outFile}`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
