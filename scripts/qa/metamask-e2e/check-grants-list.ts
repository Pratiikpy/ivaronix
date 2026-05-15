import { JsonRpcProvider, Interface } from 'ethers';

async function main() {
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const wallet = '0x458eecF0FC22c2CAFC3902269c78A9063e5d2661';
  const cap = '0x41fEad4b86DE042845D25Be71aae857E19a8089E';
  const iface = new Interface(['function getGrantsByOwner(address owner) external view returns (bytes32[])']);
  const data = iface.encodeFunctionData('getGrantsByOwner', [wallet]);
  const result = await provider.call({ to: cap, data });
  const decoded = iface.decodeFunctionResult('getGrantsByOwner', result);
  console.log('grantIds for', wallet, ':', JSON.stringify(decoded[0], null, 2));
}
main().catch(console.error);
