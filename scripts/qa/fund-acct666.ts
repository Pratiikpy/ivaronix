/**
 * Fund Account 666 (user's MM test wallet) with operator OG so it can pay
 * for the v12 marketplace flow on Aristotle mainnet.
 *
 * Account 666 surfaced during v33 cron iteration as the operator's chosen
 * burner wallet for paid-run testing. Pre-this-script its balance was
 * 0.0000252 OG — too small to cover even paySkillRun's value (0.015 OG)
 * let alone the gas. This script sends 0.05 OG one-shot so the user can
 * exercise multiple paid flows from Account 666 without re-funding.
 */
import { JsonRpcProvider, Wallet, parseEther, formatEther } from 'ethers';
import 'dotenv/config';

const RPC = 'https://evmrpc.0g.ai'; // Aristotle mainnet
const RECIPIENT = '0x598a89e4269e91ef7ee1d088ac16c83f0972105c'; // Account 666
const AMOUNT_OG = '0.05';

async function main() {
  const key = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY;
  if (!key) throw new Error('No IVARONIX_SIGNER_KEY / EVM_PRIVATE_KEY in env');
  const provider = new JsonRpcProvider(RPC, { chainId: 16661, name: '0G' });
  const signer = new Wallet(key, provider);

  const operatorAddr = await signer.getAddress();
  const opBal = await provider.getBalance(operatorAddr);
  const recBal = await provider.getBalance(RECIPIENT);

  console.log(`Operator ${operatorAddr}: ${formatEther(opBal)} OG`);
  console.log(`Recipient ${RECIPIENT}: ${formatEther(recBal)} OG  (before)`);

  if (opBal < parseEther(AMOUNT_OG)) {
    throw new Error(`Operator balance too low: ${formatEther(opBal)} < ${AMOUNT_OG}`);
  }

  console.log(`\nSending ${AMOUNT_OG} OG from operator to ${RECIPIENT}…`);
  const tx = await signer.sendTransaction({
    to: RECIPIENT,
    value: parseEther(AMOUNT_OG),
    // Galileo + Aristotle both enforce 2 Gwei priority floor
    maxPriorityFeePerGas: 2_500_000_000n,
    maxFeePerGas: 5_000_000_000n,
  });
  console.log(`  tx: ${tx.hash}`);
  console.log(`  chainscan: https://chainscan.0g.ai/tx/${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt) throw new Error('No receipt');
  console.log(`  ✓ confirmed in block ${receipt.blockNumber}`);

  const recAfter = await provider.getBalance(RECIPIENT);
  console.log(`\nRecipient ${RECIPIENT}: ${formatEther(recAfter)} OG  (after)`);
  console.log(`Delta: +${formatEther(recAfter - recBal)} OG`);
}

main().catch((e) => { console.error(e); process.exit(1); });
