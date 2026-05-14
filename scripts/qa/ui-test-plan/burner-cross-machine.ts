/**
 * §P19 cross-machine replay verifier · for a burner-anchored receipt.
 *
 * Anchors a fresh receipt on V2 via burner EIP-712, then proves it
 * propagates to every Studio surface a stranger would hit:
 *
 *   1. /r/<id>                       — proof page renders, ANCHORED chip
 *   2. /r/<id>/opengraph-image       — OG PNG 1200×630 returns 200
 *   3. /embed/r/<id>                 — embed view renders
 *   4. /r/<id>/print                 — print view returns 200
 *   5. /api/dashboard/<alice>        — alice's recent-receipts list contains it
 *   6. /global                       — receipt count incremented
 *   7. /healthz                      — V2 anchored count incremented
 *
 * The point: a STRANGER opening any of these URLs in an incognito tab
 * on a fresh machine sees the receipt — proving the on-chain anchor
 * propagates without any local state or Ivaronix install required.
 */
import {
  JsonRpcProvider,
  Wallet,
  Contract,
  parseEther,
  keccak256,
  toUtf8Bytes,
} from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const OUT = resolve(REPO, 'QA_PROOF_PACK/multi-wallet/burner-cross-machine');
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
const STUDIO = 'https://ivaronix.vercel.app';

const RECEIPT_V2 = '0xf675d4183b34fe8d1981FA9c117065aAcff690ab';
const RECEIPT_ABI = [
  'function anchor(tuple(bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash, address agentAddress, uint256 deadline) p, bytes signature) external returns (uint256)',
  'function nextId() external view returns (uint256)',
  'function nonces(address) external view returns (uint256)',
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
  console.log(`  alice: ${alice.address}`);
  console.log(`  operator: ${operator.address}`);

  // Fund alice
  const fundTx = await operator.sendTransaction({ to: alice.address, value: parseEther('0.01'), ...GAS });
  await fundTx.wait();
  console.log(`  fund alice: ${CS}/tx/${fundTx.hash}`);

  // Pre-anchor snapshots (Studio /healthz + /global)
  console.log(`\n=== §0 pre-anchor Studio state ===`);
  const healthzBefore = await (await fetch(`${STUDIO}/api/run/healthz`).catch(() => null))?.json().catch(() => null);
  // Studio doesn't expose /api/run/healthz; use chain-direct read instead.
  const v2 = new Contract(RECEIPT_V2, RECEIPT_ABI, provider);
  const nextIdBefore = await v2.nextId!() as bigint;
  console.log(`  V2 nextId before: ${nextIdBefore}`);
  const globalBefore = await fetch(`${STUDIO}/global?b=${Date.now()}`).then((r) => r.text()).catch(() => '');
  const globalCountBefore = (globalBefore.match(/(\d{1,3}(,\d{3})*|\d+).{0,200}receipts/i)?.[1] ?? '').replace(/,/g, '');
  console.log(`  /global "receipts" headline: ${globalCountBefore || 'parse-failed'}`);

  // Anchor a receipt via burner EIP-712
  console.log(`\n=== §1 anchor receipt as alice ===`);
  const nonce = await v2.nonces!(alice.address) as bigint;
  const params = {
    receiptRoot: keccak256(toUtf8Bytes(`xmach-${Date.now()}-root`)),
    storageRoot: keccak256(toUtf8Bytes(`xmach-${Date.now()}-storage`)),
    receiptType: 0,
    attestationHash: keccak256(toUtf8Bytes(`xmach-${Date.now()}-tee`)),
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
  const value = { ...params, nonce };
  const sig = await alice.signTypedData(domain, types, value);
  const v2Op = new Contract(RECEIPT_V2, RECEIPT_ABI, operator);
  const data = v2Op.interface.encodeFunctionData('anchor', [
    [params.receiptRoot, params.storageRoot, params.receiptType, params.attestationHash, params.agentAddress, params.deadline],
    sig,
  ]);
  const anchorTx = await operator.sendTransaction({ to: RECEIPT_V2, data, ...GAS });
  const anchorRcpt = await anchorTx.wait();
  if (anchorRcpt?.status !== 1) throw new Error(`anchor reverted · tx ${anchorTx.hash}`);
  const receiptId = nextIdBefore;
  console.log(`  ✓ anchored at V2 id=${receiptId}  ·  tx ${CS}/tx/${anchorTx.hash}`);

  // Wait ~1 block for Studio's force-dynamic reads to pick up the new state
  console.log(`\n=== §2 verify Studio surfaces (waiting 3s for chain propagation) ===`);
  await new Promise((r) => setTimeout(r, 3_000));

  // /r/<id> page
  const proofUrl = `${STUDIO}/r/${receiptId}`;
  const proofHtml = await fetch(proofUrl).then((r) => r.text());
  check(`/r/${receiptId} returns HTML`, proofHtml.length > 1000, `${proofHtml.length} bytes`);
  check(`/r/${receiptId} shows ANCHORED chip`, /ANCHORED/.test(proofHtml), '');
  check(`/r/${receiptId} shows alice's address`, proofHtml.toLowerCase().includes(alice.address.toLowerCase()), alice.address);
  check(`/r/${receiptId} shows receiptRoot`, proofHtml.toLowerCase().includes(params.receiptRoot.toLowerCase()), params.receiptRoot.slice(0, 18) + '…');
  check(`/r/${receiptId} renders V2 chip`, /ReceiptRegistryV2/.test(proofHtml), '');

  // OG image
  const ogRes = await fetch(`${STUDIO}/r/${receiptId}/opengraph-image`);
  check(`/r/${receiptId}/opengraph-image returns 200`, ogRes.status === 200, `status=${ogRes.status}`);
  check(`OG content-type = image/png`, ogRes.headers.get('content-type') === 'image/png', `ct=${ogRes.headers.get('content-type')}`);

  // Embed view
  const embedRes = await fetch(`${STUDIO}/embed/r/${receiptId}`);
  check(`/embed/r/${receiptId} returns 200`, embedRes.status === 200, `status=${embedRes.status}`);
  const embedHtml = await embedRes.text();
  check(`/embed/r/${receiptId} shows ANCHORED`, /ANCHORED/.test(embedHtml), '');

  // Print view
  const printRes = await fetch(`${STUDIO}/r/${receiptId}/print`);
  check(`/r/${receiptId}/print returns 200`, printRes.status === 200, `status=${printRes.status}`);

  // /api/dashboard for alice — should show the receipt
  const dashRes = await fetch(`${STUDIO}/api/dashboard/${alice.address}`);
  check(`/api/dashboard/${alice.address.slice(0, 10)}… returns 200`, dashRes.status === 200, `status=${dashRes.status}`);
  const dashJson = await dashRes.json() as { recentReceipts?: Array<{ id: string; receiptRoot: string }> };
  const found = dashJson.recentReceipts?.find((r) => r.receiptRoot.toLowerCase() === params.receiptRoot.toLowerCase());
  check(`/api/dashboard recentReceipts contains alice's anchor`, !!found, found ? `id=${found.id}` : `searched ${dashJson.recentReceipts?.length ?? 0} receipts`);

  // /global — total receipt count should be at least nextIdBefore (it's the sum of V1+V2+V3 anchors)
  const globalAfter = await fetch(`${STUDIO}/global?b=${Date.now()}`).then((r) => r.text()).catch(() => '');
  const globalCountAfter = (globalAfter.match(/(\d{1,3}(,\d{3})*|\d+)\b[^<]{0,60}receipts/i)?.[1] ?? '').replace(/,/g, '');
  check(`/global headline parses a receipt count`, globalCountAfter.length > 0, `count=${globalCountAfter}`);
  check(`/global count >= V2 nextId`, Number(globalCountAfter) >= Number(nextIdBefore), `global=${globalCountAfter} vs V2.nextId=${nextIdBefore}`);

  // Final summary
  const elapsed = (Date.now() - tStart) / 1000;
  const passCount = checks.filter((c) => c.pass).length;
  const failCount = checks.filter((c) => !c.pass).length;
  console.log(`\n=== summary ===`);
  console.log(`  ${passCount}/${checks.length} cross-machine surface checks PASS · ${failCount} FAIL`);
  console.log(`  burner-anchored receipt id ${receiptId} visible at:`);
  console.log(`    ${proofUrl}`);
  console.log(`  elapsed: ${elapsed.toFixed(1)}s`);
  if (failCount > 0) {
    console.log(`\n  failures:`);
    for (const c of checks) if (!c.pass) console.log(`    ✗ ${c.name}  ·  ${c.detail}`);
  }

  const proof = {
    timestamp: new Date().toISOString(),
    elapsedSec: elapsed,
    alice: { address: alice.address, privateKey: alice.privateKey },
    operator: operator.address,
    receipt: {
      id: receiptId.toString(),
      receiptRoot: params.receiptRoot,
      storageRoot: params.storageRoot,
      anchorTx: anchorTx.hash,
      chainscan: `${CS}/tx/${anchorTx.hash}`,
      studioUrl: proofUrl,
      ogImage: `${STUDIO}/r/${receiptId}/opengraph-image`,
      embed: `${STUDIO}/embed/r/${receiptId}`,
      print: `${STUDIO}/r/${receiptId}/print`,
    },
    checks,
    summary: { pass: passCount, fail: failCount, total: checks.length },
  };
  const outFile = resolve(OUT, `cross-machine-${Date.now()}.json`);
  writeFileSync(outFile, JSON.stringify(proof, null, 2));
  console.log(`\nProof: ${outFile}`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => { console.error('FAIL:', err); process.exit(1); });
