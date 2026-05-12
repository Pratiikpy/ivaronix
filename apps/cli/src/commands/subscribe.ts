/**
 * `ivaronix subscribe` — SubscriptionEscrowV2 client + agent operations.
 *
 * Closes B-V2-35 slot 9 · subscription_skill_exec receipt-type producer.
 *
 * The `check-in` subcommand is the slot-9 producer: when an agent
 * runs a periodic check-in against an active subscription, the
 * SubscriptionEscrowV2.checkIn tx fires AND a `subscription_skill_exec`
 * receipt anchors on V3 ReceiptRegistry. Chain consumers can filter
 * receiptType==9 to find every subscription tick.
 *
 * Live-test prerequisites (per SubscriptionEscrowV2.create constraint
 * `agent != client`): need two wallets — a client wallet that creates
 * + funds the subscription, and an agent wallet that calls check-in.
 * The agent wallet must be funded with enough OG to pay the check-in
 * gas (~0.0003 OG). The client wallet funds the subscription budget
 * (perCheckIn payout per tick).
 *
 * Three subcommands ship together:
 *   create <agent>   — client creates a subscription, deposits initial budget
 *   fund <id>        — client tops up the budget
 *   check-in <id> <attestationReceiptId>
 *                    — agent fires the periodic check-in + anchors a
 *                      subscription_skill_exec receipt
 */
import { Command } from 'commander';
import { JsonRpcProvider, Wallet, Contract, parseEther } from 'ethers';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ReceiptRegistryV3Client,
  ReceiptRegistryV2Client,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { NETWORKS, sha256HexAsync, type Address, type Hash } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

const SUBSCRIPTION_ABI = [
  'function create(address agent, bytes32 skillId, uint8 mode, uint128 perCheckIn, uint128 perAlert, uint64 intervalSeconds, uint64 graceSeconds) external payable returns (uint256 id)',
  'function fund(uint256 id) external payable',
  'function checkIn(uint256 id, uint256 attestationReceiptId) external',
  'function getSubscription(uint256 id) external view returns (tuple(address client, address agent, uint128 budget, uint128 spent, uint128 perCheckIn, uint128 perAlert, uint64 intervalSeconds, uint64 nextDueAt, uint64 graceSeconds, uint64 lowBalanceAt, uint8 mode, uint8 status, bytes32 skillId))',
  'event Created(uint256 indexed id, address indexed client, address indexed agent, bytes32 skillId, uint8 mode, uint128 perCheckIn, uint128 perAlert, uint64 intervalSeconds, uint64 graceSeconds)',
];

function escrowAddress(network: 'testnet' | 'mainnet'): Address | null {
  return getDeployedAddress(network, 'SubscriptionEscrowV2') ?? getDeployedAddress(network, 'SubscriptionEscrow');
}

export const subscribeCommand = new Command('subscribe').description(
  'SubscriptionEscrowV2 client + agent operations (B-V2-35 slot 9 subscription_skill_exec producer)',
);

subscribeCommand
  .command('create <agent>')
  .description(
    'Client creates a subscription, deposits initial budget. Agent must differ from msg.sender per SubscriptionEscrowV2.',
  )
  .option('--skill <id>', 'on-chain skill id (defaults to private-doc-review hash)', 'private-doc-review')
  .option('--per-checkin <og>', 'OG paid out per successful check-in', '0.0001')
  .option('--per-alert <og>', 'OG paid out per alert (must be ≥ perCheckIn)', '0.0002')
  .option('--interval <seconds>', 'check-in interval in seconds (0 = AGENT_AUTO mode)', '86400')
  .option('--grace <seconds>', 'grace window before cancel can expire', '3600')
  .option('--budget <og>', 'initial budget (deposited as msg.value)', '0.001')
  .action(
    async (
      agent: string,
      opts: {
        skill: string;
        perCheckin: string;
        perAlert: string;
        interval: string;
        grace: string;
        budget: string;
      },
    ) => {
      const env = loadEnv();
      if (!env.privateKey) {
        ui.fail('No private key in .env');
        process.exitCode = 1;
        return;
      }
      const addr = escrowAddress(env.network);
      if (!addr) {
        ui.fail(`SubscriptionEscrow(V2) not deployed on ${env.network}`);
        process.exitCode = 1;
        return;
      }

      const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
      const client = new Wallet(env.privateKey, provider);
      if (agent.toLowerCase() === client.address.toLowerCase()) {
        ui.fail(`agent must differ from client (msg.sender). Use a second wallet — see USER_TODO §B-V2-35 slot 9.`);
        process.exitCode = 1;
        return;
      }

      const skillIdHash = (await sha256HexAsync(new TextEncoder().encode(opts.skill))) as Hash;
      const skillIdBytes32 = ('0x' + skillIdHash.replace(/^sha256:/, '')) as `0x${string}`;
      const mode = Number(opts.interval) > 0 ? 0 /* CLIENT_SET */ : 1 /* AGENT_AUTO */;
      const escrow = new Contract(addr, SUBSCRIPTION_ABI, client);

      ui.title('Creating subscription');
      ui.info(`client (you)         ${client.address}`);
      ui.info(`agent                ${agent}`);
      ui.info(`skill                ${opts.skill}  (${skillIdBytes32.slice(0, 18)}...)`);
      ui.info(`mode                 ${mode === 0 ? 'CLIENT_SET' : 'AGENT_AUTO'}  interval=${opts.interval}s`);
      ui.info(`perCheckIn           ${opts.perCheckin} OG`);
      ui.info(`perAlert             ${opts.perAlert} OG`);
      ui.info(`grace                ${opts.grace}s`);
      ui.info(`budget (msg.value)   ${opts.budget} OG`);
      ui.divider();

      ui.pending('submitting create tx...');
      const fn = escrow['create'];
      if (!fn) {
        ui.fail('create() not available on SubscriptionEscrow ABI');
        process.exitCode = 1;
        return;
      }
      const tx = (await fn(
        agent,
        skillIdBytes32,
        mode,
        parseEther(opts.perCheckin),
        parseEther(opts.perAlert),
        Number(opts.interval),
        Number(opts.grace),
        { value: parseEther(opts.budget) },
      )) as { hash: string; wait: () => Promise<{ blockNumber?: number; logs?: { topics: string[] }[] }> };
      ui.info(`tx hash              ${tx.hash}`);
      const receipt = await tx.wait();
      ui.pass(`subscription created · block ${receipt?.blockNumber}`);
      ui.hint(`Look up the new subscription id via the Created event in the tx receipt.`);
      ui.hint(`Explorer: ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
    },
  );

subscribeCommand
  .command('fund <id>')
  .description('Top up a subscription budget. Only client can call.')
  .option('--amount <og>', 'OG to deposit', '0.0005')
  .action(async (id: string, opts: { amount: string }) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No private key in .env');
      process.exitCode = 1;
      return;
    }
    const addr = escrowAddress(env.network);
    if (!addr) {
      ui.fail(`SubscriptionEscrow(V2) not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const escrow = new Contract(addr, SUBSCRIPTION_ABI, wallet);
    ui.pending(`funding subscription ${id} with ${opts.amount} OG...`);
    const fn = escrow['fund'];
    if (!fn) {
      ui.fail('fund() not available on SubscriptionEscrow ABI');
      process.exitCode = 1;
      return;
    }
    const tx = (await fn(BigInt(id), { value: parseEther(opts.amount) })) as { hash: string; wait: () => Promise<{ blockNumber?: number }> };
    ui.info(`tx hash              ${tx.hash}`);
    const receipt = await tx.wait();
    ui.pass(`funded · block ${receipt?.blockNumber}`);
  });

subscribeCommand
  .command('check-in <id> <attestationReceiptId>')
  .description(
    'Agent fires the periodic check-in tx + anchors a subscription_skill_exec receipt (canonical slot 9). Only the subscription\'s agent address can call.',
  )
  .action(async (id: string, attestationReceiptId: string) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No private key in .env');
      process.exitCode = 1;
      return;
    }
    const addr = escrowAddress(env.network);
    if (!addr) {
      ui.fail(`SubscriptionEscrow(V2) not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const agentWallet = new Wallet(env.privateKey, provider);
    const escrow = new Contract(addr, SUBSCRIPTION_ABI, agentWallet);

    ui.title('Subscription check-in');
    ui.info(`agent (you)          ${agentWallet.address}`);
    ui.info(`subscription id      ${id}`);
    ui.info(`attestation receipt  ${attestationReceiptId}`);
    ui.divider();

    ui.pending('submitting checkIn tx...');
    const fn = escrow['checkIn'];
    if (!fn) {
      ui.fail('checkIn() not available on SubscriptionEscrow ABI');
      process.exitCode = 1;
      return;
    }
    const tx = (await fn(BigInt(id), BigInt(attestationReceiptId))) as {
      hash: string;
      wait: () => Promise<{ blockNumber?: number; gasUsed?: bigint }>;
    };
    ui.info(`checkIn tx           ${tx.hash}`);
    const txReceipt = await tx.wait();
    ui.pass(`check-in confirmed · block ${txReceipt?.blockNumber} · gas ${txReceipt?.gasUsed?.toString()}`);

    // B-V2-35 slot 9 closure: anchor a subscription_skill_exec receipt
    // (canonical slot 9) on V3 ReceiptRegistry. Chain consumers can
    // filter receiptType==9 to find every subscription tick.
    ui.divider();
    ui.pending('anchoring subscription_skill_exec receipt (B-V2-35 slot 9)...');
    try {
      const receiptRegV3 = getDeployedAddress(env.network, 'ReceiptRegistryV3');
      const receiptRegV2 = getDeployedAddress(env.network, 'ReceiptRegistryV2');
      const writeAddr = (receiptRegV3 ?? receiptRegV2) as Address | null;
      const writeVersion: 'v2' | 'v3' = receiptRegV3 ? 'v3' : 'v2';
      if (!writeAddr) {
        ui.fail(`no ReceiptRegistry V3 or V2 on ${env.network} · skipping receipt anchor`);
        return;
      }

      const userPromptHash = (await sha256HexAsync(
        new TextEncoder().encode(`subscription.checkIn:${id}:${attestationReceiptId}`),
      )) as Hash;

      const draft = buildReceipt({
        type: 'subscription_skill_exec',
        agent: {
          passportId: `did:0g:passport:${agentWallet.address}:1`,
          ownerWallet: agentWallet.address as Address,
          trustScoreAtTime: 0,
        },
        request: {
          skillId: 'subscription.checkIn',
          skillVersion: '0.1.0',
          skillManifestHash: userPromptHash,
          userPromptHash,
          inputArtifacts: [{ kind: 'memory', encrypted: false }],
          policyDecision: 'approved',
          approvalChain: [
            { gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:agent-only' },
          ],
        },
        execution: {
          mode: 'subscription_skill_exec',
          burnMode: false,
          consensusMode: false,
          modelSelection: { requested: 'none', final: 'none' },
          providerRouting: {
            allowFallbacks: false,
            finalProvider: '0x0000000000000000000000000000000000000000' as Address,
          },
        },
        teeVerification: {
          requested: false,
          routerVerified: false,
          independentVerified: null,
          verificationMethod: 'external-signed',
          verifiedAt: null,
        },
        routerTrace: {
          requestId: `subscription.checkIn:${id}:${attestationReceiptId}:${Date.now()}`,
          x0gTrace: {},
          rateLimit: {},
          rotations: [],
        },
        billing: {
          inputTokens: 0,
          outputTokens: 0,
          inputCostNeuron: '0',
          outputCostNeuron: '0',
          totalCostNeuron: '0',
          totalCostOg: '0.0000000000',
        },
        chainAnchor: defaultChainAnchor(env.network as 'testnet' | 'mainnet', writeAddr),
        storage: {
          evidenceRoot: ('0x' + userPromptHash.replace(/^sha256:/, '')) as Hash,
          proofDownloadVerified: false,
          encryption: { enabled: false, type: 'none', headerDetected: false },
        },
        outputs: {
          outputHash: userPromptHash,
          citations: [userPromptHash],
          riskLevel: 'low',
          wording: {
            headline: `Subscription ${id} check-in · attestation receipt #${attestationReceiptId}`,
            doNotSay: ['truth score', 'verified by AI'],
          },
        },
        createdBy: 'ivaronix-runtime/0.0.1',
      });
      const signed = await signReceipt(draft, agentWallet);

      const outDir = resolve('.ivaronix', 'receipts', 'anchored');
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, `${signed.id}.json`), JSON.stringify(signed, null, 2));

      const regClient =
        writeVersion === 'v3'
          ? new ReceiptRegistryV3Client(writeAddr, agentWallet)
          : new ReceiptRegistryV2Client(writeAddr, agentWallet);
      const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hash;
      const RECEIPT_TYPE_CODE = 9; // canonical slot 9 subscription_skill_exec
      const { tx: anchorTx } = await regClient.signAndAnchor(agentWallet, {
        receiptRoot: signed.storage.receiptRoot as Hash,
        storageRoot: signed.storage.evidenceRoot as Hash,
        attestationHash: ZERO_HASH,
        receiptType: RECEIPT_TYPE_CODE,
      });
      const anchorReceipt = await anchorTx.wait();
      const onChainId = (await regClient.nextId()) - 1n;
      ui.pass(`receipt              ${signed.id}`);
      ui.info(`anchor tx            ${anchorTx.hash} (${writeVersion.toUpperCase()})`);
      ui.info(`anchor block         ${anchorReceipt?.blockNumber}`);
      ui.info(`on-chain id          ${onChainId.toString()}`);
      ui.info(`receipt type         subscription_skill_exec (canonical slot 9)`);
    } catch (err) {
      ui.fail('subscription_skill_exec receipt anchor failed', (err as Error).message.split('\n')[0]);
      // Don't fail the whole command — the checkIn tx is already on chain.
    }
  });
