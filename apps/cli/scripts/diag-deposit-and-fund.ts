/**
 * Deposit fresh OG into Compute ledger main, then transfer to active provider sub-account.
 * Run from apps/cli workspace so @0gfoundation/0g-compute-ts-sdk is resolvable.
 */
import 'dotenv/config';
import { createZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk';
import { JsonRpcProvider, Wallet, formatEther, parseEther } from 'ethers';

async function main() {
  const SIGNER_KEY = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? '';
  if (!SIGNER_KEY) throw new Error('signer key missing');
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const wallet = new Wallet(SIGNER_KEY, provider);
  const broker = await createZGComputeNetworkBroker(wallet);

  // Deposit additional 3 OG to ledger main account
  const DEPOSIT_OG = '3.0';
  const FUND_OG = '2.0';
  const PROVIDER = '0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9';
  console.log(`Depositing ${DEPOSIT_OG} OG to ledger main...`);
  try {
    const txd = await broker.ledger.depositFund(parseEther(DEPOSIT_OG));
    console.log(`  deposit tx:`, (txd as any)?.transactionHash ?? txd);
  } catch (e: any) {
    console.log(`  deposit error: ${e.message?.slice(0, 200) ?? e}`);
  }
  console.log(`Transferring ${FUND_OG} OG to provider ${PROVIDER} sub-account...`);
  try {
    const txt = await broker.inference.transferFund(PROVIDER, parseEther(FUND_OG));
    console.log(`  transfer tx:`, (txt as any)?.transactionHash ?? txt);
  } catch (e: any) {
    console.log(`  transfer error: ${e.message?.slice(0, 200) ?? e}`);
  }

  const ledger = await broker.ledger.getLedger();
  const total = (ledger as any).totalBalance;
  const avail = (ledger as any).availableBalance;
  console.log(`Post-state · total ${formatEther(total)} OG · available ${formatEther(avail)} OG · locked ${formatEther(total - avail)} OG`);
  for (const inf of (ledger as any).inferences ?? []) {
    console.log(`  ${inf.provider}: balance=${formatEther(inf.balance)} OG · refund=${formatEther(inf.pendingRefund)}`);
  }
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
