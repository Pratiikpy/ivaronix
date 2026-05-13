/**
 * FINAL_BUILD_PLAN.md Block D · CLI payment helper.
 *
 * Mirrors the server-side /api/run/estimate + /api/run/confirm flow for
 * CLI consumers (`ivaronix demo --pay`, `ivaronix run --pay`).
 *
 * The CLI signs paySkillRun directly with the IVARONIX_SIGNER_KEY (or
 * EVM_PRIVATE_KEY legacy alias) — there's no wagmi popup because the
 * CLI runs in a terminal. Operator-subsidised mode (`--subsidise`) is
 * the same code path but flags the receipt's `billing.payment.subsidised`
 * field so the UI surfaces it honestly.
 */
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes, solidityPacked, getAddress, parseUnits } from 'ethers';
import { loadEnv } from './env.js';
import { getDeployedAddress } from '@ivaronix/og-chain';

const SKILL_PRICING_ABI = [
  'function getPricing(bytes32 skillId) view returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)',
];
const SKILL_REGISTRY_ABI = ['function ownerOf(bytes32 skillId) view returns (address)'];
const SKILL_RUN_PAYMENT_ABI = [
  'function paySkillRun(bytes32 receiptRoot, address creator, uint16 creatorBps, uint16 treasuryBps) payable',
  'event SkillRunPaid(bytes32 indexed receiptRoot, address indexed payer, address indexed creator, uint256 amount, uint256 creatorShare, uint256 treasuryShare, uint16 creatorBps, uint16 treasuryBps, uint64 timestamp)',
];

export interface PaymentMetadata {
  txHash: string;
  paymentContract: string;
  payer: string;
  paidOg: string;
  creatorPaidOg: string;
  treasuryPaidOg: string;
  creator: string;
  creatorBps: number;
  treasuryBps: number;
  paidAt: number;
  subsidised: boolean;
  refunded: boolean;
  draftReceiptRoot: string;
}

export interface QuoteResult {
  needsPayment: boolean;
  priceWei: bigint;
  creator: string;
  creatorBps: number;
  treasuryBps: number;
  paymentContract: string | null;
}

export function computeDraftReceiptRoot(input: {
  skillId: string;
  contentText: string;
  question: string;
  payer: string;
  bucketSeconds: number;
}): `0x${string}` {
  const packed = solidityPacked(
    ['string', 'bytes32', 'bytes32', 'address', 'uint64'],
    [
      input.skillId,
      keccak256(toUtf8Bytes(input.contentText)),
      keccak256(toUtf8Bytes(input.question)),
      input.payer,
      input.bucketSeconds,
    ],
  );
  return keccak256(packed) as `0x${string}`;
}

/**
 * Quote a skill's price from on-chain SkillPricing. Returns `needsPayment:
 * false` when the skill is free or unpriced. Throws if the contracts aren't
 * deployed on the configured network.
 */
export async function quoteSkill(skillId: string): Promise<QuoteResult> {
  const env = loadEnv();
  const network = env.network;
  const pricingAddr = getDeployedAddress(network, 'SkillPricing');
  const registryAddr = getDeployedAddress(network, 'SkillRegistryV2');
  if (!pricingAddr || !registryAddr) {
    throw new Error(`SkillPricing or SkillRegistryV2 not deployed on ${network} — check contracts/deployments/${network}.json`);
  }

  const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: network });
  const pricing = new Contract(pricingAddr, SKILL_PRICING_ABI, provider);
  const registry = new Contract(registryAddr, SKILL_REGISTRY_ABI, provider);
  const skillIdHash = keccak256(toUtf8Bytes(`skill:${skillId}`));

  const [price, cBps, tBps, priced] = (await pricing.getFunction('getPricing')(skillIdHash)) as [bigint, number, number, boolean];
  const creator = (await registry.getFunction('ownerOf')(skillIdHash)) as string;

  if (creator === '0x0000000000000000000000000000000000000000') {
    throw new Error(`skill "${skillId}" not published on SkillRegistryV2 (creator=zero)`);
  }

  const paymentContract = getDeployedAddress(network, 'SkillRunPayment');

  return {
    needsPayment: priced && price > 0n,
    priceWei: price,
    creator: getAddress(creator),
    creatorBps: cBps,
    treasuryBps: tBps,
    paymentContract: paymentContract ?? null,
  };
}

/**
 * Send a paySkillRun tx using the operator's signing key. Returns the
 * full payment metadata block ready to splice onto a receipt body.
 *
 * For `subsidise=true`, the same call goes through (operator pays as the
 * payer); the only difference is the receipt's `payment.subsidised=true`
 * flag so the UI shows "Demo run · operator-subsidised."
 */
export async function paySkillRunFromCli(input: {
  skillId: string;
  contentText: string;
  question: string;
  subsidise?: boolean;
}): Promise<PaymentMetadata> {
  const env = loadEnv();
  const network = env.network;
  if (!env.privateKey) throw new Error('IVARONIX_SIGNER_KEY (or EVM_PRIVATE_KEY) not set');

  const quote = await quoteSkill(input.skillId);
  if (!quote.needsPayment) {
    throw new Error(`skill "${input.skillId}" is free (priceWei=0). Use --no-payment instead.`);
  }
  if (!quote.paymentContract) {
    throw new Error(`SkillRunPayment not deployed on ${network}`);
  }

  const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: network });
  const wallet = new Wallet(env.privateKey.startsWith('0x') ? env.privateKey : '0x' + env.privateKey, provider);
  const payer = wallet.address;
  const bucketSeconds = Math.floor(Date.now() / 1000 / 60) * 60;
  const draftReceiptRoot = computeDraftReceiptRoot({
    skillId: input.skillId,
    contentText: input.contentText,
    question: input.question,
    payer,
    bucketSeconds,
  });

  const payment = new Contract(quote.paymentContract, SKILL_RUN_PAYMENT_ABI, wallet);
  const tx = await payment.getFunction('paySkillRun')(
    draftReceiptRoot,
    quote.creator,
    quote.creatorBps,
    quote.treasuryBps,
    {
      value: quote.priceWei,
      gasPrice: 5_000_000_000n,
    },
  );
  await tx.wait(1);

  return {
    txHash: tx.hash,
    paymentContract: quote.paymentContract,
    payer,
    paidOg: quote.priceWei.toString(),
    creatorPaidOg: ((quote.priceWei * BigInt(quote.creatorBps)) / 10000n).toString(),
    treasuryPaidOg: ((quote.priceWei * BigInt(quote.treasuryBps)) / 10000n).toString(),
    creator: quote.creator,
    creatorBps: quote.creatorBps,
    treasuryBps: quote.treasuryBps,
    paidAt: Math.floor(Date.now() / 1000),
    subsidised: input.subsidise ?? false,
    refunded: false,
    draftReceiptRoot,
  };
}

/**
 * Post-anchor patch a receipt JSON file with the payment block. Safe to
 * call AFTER the receipt has been built+signed+anchored by the runtime —
 * because 'payment' is in HASH_EXCLUDE (Block B builder.ts change), the
 * canonical body hash is unaffected and the chain anchor remains valid.
 */
export async function patchReceiptWithPayment(
  receiptPath: string,
  payment: PaymentMetadata,
): Promise<void> {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const receiptObj = JSON.parse(readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
  const billing = receiptObj.billing as Record<string, unknown>;
  billing.payment = payment;
  writeFileSync(receiptPath, JSON.stringify(receiptObj, null, 2));
}
