/**
 * Fire 9 of 10 of the LEGAL VERTICAL HARD-LAUNCH PIVOT directive.
 *
 * Burner-wallet drive of the legal cluster · proves end-to-end functional
 * readiness per the locked feedback_burner_wallet_compulsory.md memory.
 *
 * Flow:
 *   1. ethers.Wallet.createRandom() — generate a fresh disposable burner
 *   2. Fund 0.05 OG from operator wallet (just enough for a few receipts)
 *   3. Spawn `pnpm ivaronix doc ask` with IVARONIX_SIGNER_KEY=burner.privateKey
 *      against `seed-skills/contract-renewal-clause-detector/tests/sample-vendor-contract.txt`
 *   4. Parse stdout for receiptId, tx hash, on-chain id
 *   5. Curl https://ivaronix.vercel.app/r/<onChainId> and confirm 200
 *   6. Persist proof to QA_PROOF_PACK/legal-cluster/burner-drive-proof.json
 */
import { Wallet, JsonRpcProvider, parseEther, formatEther } from 'ethers';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
loadDotenv({ path: resolve(REPO, '.env') });

const RPC = process.env.IVARONIX_RPC_URL ?? process.env.OG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const OPERATOR_PK = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY;
if (!OPERATOR_PK) {
  console.error('FAIL: no operator key in env (IVARONIX_SIGNER_KEY or EVM_PRIVATE_KEY)');
  process.exit(1);
}

const STUDIO = 'https://ivaronix.vercel.app';
const PROOF_DIR = resolve(REPO, 'QA_PROOF_PACK', 'legal-cluster');
mkdirSync(PROOF_DIR, { recursive: true });

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, { chainId: 16602, name: 'galileo' });
  const operator = new Wallet(OPERATOR_PK!, provider);
  console.log('OPERATOR  ', operator.address);
  console.log('  balance', formatEther(await provider.getBalance(operator.address)), 'OG');

  // 1. Generate burner
  const burner = Wallet.createRandom().connect(provider);
  console.log('\nBURNER (fresh)');
  console.log('  address ', burner.address);

  // 2. Fund 0.05 OG (enough for a receipt anchor at ~0.005 OG/run, with margin)
  const fundAmount = parseEther('0.05');
  console.log('\nFunding 0.05 OG from operator...');
  const fundTx = await operator.sendTransaction({
    to: burner.address,
    value: fundAmount,
    gasPrice: 5_000_000_000n, // Galileo 2 Gwei priority-fee floor; 5 Gwei is safe
  });
  const fundReceipt = await fundTx.wait();
  console.log('  tx     ', fundTx.hash);
  console.log('  block  ', fundReceipt?.blockNumber);
  console.log('  balance', formatEther(await provider.getBalance(burner.address)), 'OG');

  // 3. Spawn `pnpm ivaronix doc ask` with burner key in env
  const skill = 'contract-renewal-clause-detector';
  const vector = resolve(REPO, 'seed-skills', skill, 'tests', 'sample-vendor-contract.txt');
  const question = 'Scan this contract for auto-renewal and price-uplift clauses.';

  console.log(`\nRunning skill ${skill} AS BURNER...`);
  const env = { ...process.env, IVARONIX_SIGNER_KEY: burner.privateKey, EVM_PRIVATE_KEY: burner.privateKey, IVARONIX_QUIET_ALIAS_WARNINGS: '1' };
  const proc = spawn(
    'pnpm',
    ['--filter', '@ivaronix/cli', 'dev', 'doc', 'ask', vector, question, '--skill', skill],
    { env, cwd: REPO, shell: true },
  );

  let stdout = '';
  proc.stdout.on('data', (d: Buffer) => {
    const chunk = d.toString();
    stdout += chunk;
    // stream the structured lines
    chunk.split('\n').forEach((line) => {
      if (line.match(/receiptId|tx hash|block |on-chain id|Status:|ANCHORED|FAIL/)) {
        console.log('  ' + line.replace(/\x1b\[[0-9;]*m/g, '').trim());
      }
    });
  });
  proc.stderr.on('data', (d: Buffer) => {
    process.stderr.write(d);
  });

  const exitCode = await new Promise<number>((res) => proc.on('close', res));
  console.log(`\nCLI exit code: ${exitCode}`);

  // 4. Parse stdout for the key fields (strip ANSI first)
  const clean = stdout.replace(/\x1b\[[0-9;]*m/g, '');
  const receiptId = clean.match(/receiptId\s+(rcpt_[A-Z0-9]+)/)?.[1] ?? null;
  const txHash = clean.match(/tx hash\s+(0x[a-f0-9]{64})/)?.[1] ?? null;
  const onChainId = clean.match(/receipt on-chain id\s+(\d+)/)?.[1] ?? null;
  const block = clean.match(/block\s+(\d+)/)?.[1] ?? null;
  console.log('\nParsed receipt:');
  console.log('  receiptId  ', receiptId);
  console.log('  onChainId  ', onChainId);
  console.log('  block      ', block);
  console.log('  txHash     ', txHash);

  // 5. Curl /r/<onChainId> to confirm prod renders it
  let receiptPageStatus: number | null = null;
  if (onChainId) {
    const receiptUrl = `${STUDIO}/r/${onChainId}`;
    console.log(`\nFetching ${receiptUrl}...`);
    try {
      const res = await fetch(receiptUrl);
      receiptPageStatus = res.status;
      console.log(`  status  ${receiptPageStatus}`);
    } catch (err) {
      console.error('  fetch failed:', (err as Error).message);
    }
  }

  // 6. Save proof
  const proof = {
    runAt: new Date().toISOString(),
    network: 'testnet',
    chainId: 16602,
    burner: {
      address: burner.address,
      // NEVER log the private key in proof — but it's a throwaway anyway
      fundingTxHash: fundTx.hash,
      fundingBlock: fundReceipt?.blockNumber,
      fundedAmountOg: '0.05',
    },
    operator: operator.address,
    skill,
    vector: 'tests/sample-vendor-contract.txt',
    question,
    receipt: {
      receiptId,
      onChainId: onChainId ? Number(onChainId) : null,
      block: block ? Number(block) : null,
      txHash,
      receiptUrl: onChainId ? `${STUDIO}/r/${onChainId}` : null,
      chainscanTx: txHash ? `https://chainscan-galileo.0g.ai/tx/${txHash}` : null,
      receiptPageStatus,
    },
    cliExitCode: exitCode,
    verdict:
      exitCode === 0 && onChainId && receiptPageStatus === 200
        ? 'PASS · burner-driven receipt anchored + receipt page resolves on prod'
        : 'INVESTIGATE',
  };
  const proofPath = resolve(PROOF_DIR, 'burner-drive-proof.json');
  writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log(`\nProof written: ${proofPath}`);
  console.log(`Verdict: ${proof.verdict}`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
