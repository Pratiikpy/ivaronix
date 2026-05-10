import { config as dotenvConfig } from 'dotenv';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';

dotenvConfig();

async function main() {
  const k = keyringFromEnv();
  if (!k) throw new Error('no keyring');
  const r = await k.chat({
    userPrompt: 'hi',
    model: 'qwen/qwen-2.5-7b-instruct',
    verifyTee: true,
  });
  console.log('content:        ', r.content);
  console.log('zgResKey:       ', r.zgResKey);
  console.log('providerAddress:', r.providerAddress);
  console.log('routerVerified: ', r.routerVerified);
  console.log('---rawResponse keys:', Object.keys(r.rawResponse as Record<string, unknown>));
  console.log('---rawResponse JSON:');
  console.log(JSON.stringify(r.rawResponse, null, 2).slice(0, 2000));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
