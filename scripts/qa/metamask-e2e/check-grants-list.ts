import { JsonRpcProvider, Interface } from 'ethers';

async function main() {
  const provider = new JsonRpcProvider('https://evmrpc.0g.ai', { chainId: 16661, name: 'aristotle' });
  const wallet = '0xd3dd37612f703cEAD89cD85984B81721CBc0A186';
  const cap = '0x41fEad4b86DE042845D25Be71aae857E19a8089E';
  const iface = new Interface(['function listGrantsByOwner(address owner) external view returns (bytes32[])']);
  const data = iface.encodeFunctionData('listGrantsByOwner', [wallet]);
  const result = await provider.call({ to: cap, data });
  const decoded = iface.decodeFunctionResult('listGrantsByOwner', result);
  console.log('grantIds for', wallet, ':', JSON.stringify(decoded[0], null, 2));
}
main().catch(console.error);
