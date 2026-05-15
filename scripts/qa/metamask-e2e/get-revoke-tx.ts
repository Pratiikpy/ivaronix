import { JsonRpcProvider, id } from 'ethers';

async function main() {
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const wallet = '0x57A9BD142F74fc66731a97a76b42A4d505673919';
  const cap = '0x41fEad4b86DE042845D25Be71aae857E19a8089E';
  const topic = id('GrantRevoked(bytes32,address)');
  const block = await provider.getBlockNumber();
  const logs = await provider.getLogs({
    address: cap,
    topics: [topic, null, '0x000000000000000000000000' + wallet.slice(2).toLowerCase()],
    fromBlock: block - 500,
    toBlock: block,
  });
  console.log('block:', block);
  console.log(JSON.stringify(logs.map((l) => ({ tx: l.transactionHash, grantId: l.topics[1] })), null, 2));
}
main().catch(console.error);
