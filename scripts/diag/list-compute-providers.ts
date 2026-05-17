/**
 * List all Compute provider sub-account balances on mainnet for the operator.
 */
import 'dotenv/config';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import { JsonRpcProvider, Wallet, formatEther } from 'ethers';

async function main() {
  const SIGNER_KEY = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? '';
  if (!SIGNER_KEY) throw new Error('signer key missing');
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const wallet = new Wallet(SIGNER_KEY, provider);
  const broker = await createZGComputeNetworkBroker(wallet);

  console.log('Listing all inference services...');
  const services = await broker.inference.listService();
  console.log(`Services count: ${services.length}`);
  for (const s of services) {
    console.log(`  ${s.provider} · model=${(s as any).model ?? '?'} · url=${((s as any).url ?? '').slice(0, 60)}`);
  }
  console.log('');
  console.log('Account ledger:');
  const ledger = await broker.ledger.getLedger();
  const total = (ledger as any).totalBalance;
  const avail = (ledger as any).availableBalance;
  console.log(`  total: ${formatEther(total)} OG · available: ${formatEther(avail)} OG · locked: ${formatEther(total - avail)} OG`);
  console.log('');
  console.log('Per-provider sub-account balances:');
  for (const inf of (ledger as any).inferences ?? []) {
    console.log(`  provider ${inf.provider}: balance=${formatEther(inf.balance)} OG · pendingRefund=${formatEther(inf.pendingRefund)} OG`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
