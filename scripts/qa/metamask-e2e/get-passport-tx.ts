import { JsonRpcProvider } from 'ethers';

async function main() {
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const wallet = '0xe7b11Dd3C10FD5DF7e2F3b523A2702f17fE5AAdC';
  const passportV2 = '0x5D724659A7d4B0B0917F5DAe9579423D2c85a6Ad';
  const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const block = await provider.getBlockNumber();
  const logs = await provider.getLogs({
    address: passportV2,
    topics: [transferTopic, null, '0x000000000000000000000000' + wallet.slice(2).toLowerCase()],
    fromBlock: block - 2000,
    toBlock: block,
  });
  console.log('block:', block);
  console.log(JSON.stringify(logs.map((l) => ({ tx: l.transactionHash, block: l.blockNumber, topic2: l.topics[2] })), null, 2));
}
main().catch(console.error);
