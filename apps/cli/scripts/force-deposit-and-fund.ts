/**
 * Force-deposit OG to ledger + transfer to active provider, even if main balance is non-zero.
 */
import 'dotenv/config';
import { JsonRpcProvider, Wallet, formatEther, parseEther } from 'ethers';

async function main() {
  const SIGNER_KEY = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? '';
  if (!SIGNER_KEY) throw new Error('signer key missing');
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const wallet = new Wallet(SIGNER_KEY, provider);

  // Dynamic import per CLI compute.ts pattern
  const sdk: any = await import('@0gfoundation/0g-compute-ts-sdk');
  const broker = await sdk.createZGComputeNetworkBroker(wallet);

  const DEPOSIT_OG = 3;
  const FUND_OG = '2.0';
  const PROVIDER = '0x4870CbC4D07d6Ac2EE5aA865588e5985FE77a4E9';
  const fundWei = parseEther(FUND_OG);

  console.log(`Force-depositing ${DEPOSIT_OG} OG to ledger main...`);
  try {
    await broker.ledger.depositFund(DEPOSIT_OG);
    console.log(`  deposit submitted`);
  } catch (e: any) {
    console.log(`  deposit error: ${e.message?.slice(0, 200)}`);
  }
  console.log(`Transferring ${FUND_OG} OG → ${PROVIDER} sub-account...`);
  try {
    await broker.ledger.transferFund(PROVIDER, 'inference', fundWei);
    console.log(`  transfer submitted`);
  } catch (e: any) {
    console.log(`  transfer error: ${e.message?.slice(0, 200)}`);
  }
  const ledger = await broker.ledger.getLedger();
  console.log(`Post: ${formatEther(ledger[2])} OG total · ${formatEther(ledger[1])} OG locked`);
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
