/**
 * Build a hello-world signed receipt for end-to-end smoke testing.
 * Run: pnpm tsx scripts/build-hello-receipt.ts <output.json>
 */
import { Wallet, JsonRpcProvider } from 'ethers';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { sha256HexAsync, NETWORKS } from '@ivaronix/core';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { getDeployedAddress } from '@ivaronix/og-chain';

dotenvConfig();

const outPath = process.argv[2] ?? 'tmp/hello-receipt.json';
const network = (process.env.OG_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

async function main() {
  const pk = process.env.EVM_PRIVATE_KEY ?? process.env.OG_PRIVATE_KEY;
  if (!pk) throw new Error('Set EVM_PRIVATE_KEY in .env');

  const cfg = NETWORKS[network];
  const provider = new JsonRpcProvider(cfg.rpcUrl, { chainId: cfg.chainId, name: cfg.name });
  const wallet = new Wallet(pk, provider);

  const registryAddr = getDeployedAddress(network, 'ReceiptRegistry');
  if (!registryAddr) throw new Error(`ReceiptRegistry not deployed on ${network}`);

  const draft = buildReceipt({
    type: 'doc_ask',
    agent: {
      passportId: `did:0g:passport:${wallet.address}:1`,
      ownerWallet: wallet.address as `0x${string}`,
      trustScoreAtTime: 0,
    },
    request: {
      skillId: 'hello-world',
      skillVersion: '0.0.1',
      skillManifestHash: sha256HexAsync('hello-skill-manifest'),
      userPromptHash: sha256HexAsync('Hello, frontier.'),
      inputArtifacts: [],
      policyDecision: 'approved',
      approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
    },
    execution: {
      mode: 'doc_ask',
      burnMode: false,
      consensusMode: false,
      modelSelection: { requested: 'qwen/qwen-2.5-7b-instruct', final: 'qwen/qwen-2.5-7b-instruct' },
      providerRouting: {
        allowFallbacks: true,
        finalProvider: '0xa48f01287233509FD694a22Bf840225062E67836' as `0x${string}`,
      },
    },
    routerTrace: {
      requestId: 'hello-' + Date.now(),
      x0gTrace: {},
      rateLimit: {},
      rotations: [],
    },
    teeVerification: {
      requested: false,
      routerVerified: false,
      independentVerified: null,
      verificationMethod: 'router_flag',
      verifiedAt: null,
    },
    billing: {
      inputTokens: 5,
      outputTokens: 3,
      inputCostNeuron: '250000',
      outputCostNeuron: '300000',
      totalCostNeuron: '550000',
      totalCostOg: '0.00000055',
    },
    storage: {
      proofDownloadVerified: false,
      encryption: { enabled: false, type: 'none', headerDetected: false },
    },
    chainAnchor: defaultChainAnchor(network, registryAddr),
    outputs: {
      outputHash: sha256HexAsync('Hello yourself, agent.'),
      citations: [],
    },
    createdBy: 'ivaronix-forge/0.0.1',
  });

  const signed = await signReceipt(draft, wallet);

  const fullPath = resolve(outPath);
  writeFileSync(fullPath, JSON.stringify(signed, null, 2));
  console.log(`Built signed receipt:   ${signed.id}`);
  console.log(`Signer wallet:          ${signed.signature.signer}`);
  console.log(`Receipt root:           ${signed.storage.receiptRoot}`);
  console.log(`Wrote:                  ${fullPath}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
