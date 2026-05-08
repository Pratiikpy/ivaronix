// Smoke test: upload "hello-ivaronix-<ts>" to 0G Storage (testnet) and
// confirm we get back rootHash + txHash. Verifies the B-1 blocker is gone
// after the @0glabs/0g-ts-sdk → @0gfoundation/0g-ts-sdk SDK bump.
import { StorageClient } from '@ivaronix/og-storage';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function findEnv(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const c = resolve(dir, '.env');
    if (existsSync(c)) return c;
    const p = dirname(dir);
    if (p === dir) return null;
    dir = p;
  }
  return null;
}

const envPath = findEnv(process.cwd());
if (envPath) dotenvConfig({ path: envPath });

const pk = process.env.EVM_PRIVATE_KEY;
if (!pk) {
  console.error('EVM_PRIVATE_KEY missing');
  process.exit(1);
}

const sc = new StorageClient({ network: 'testnet', privateKey: pk });

async function main() {
  const ping = await sc.ping();
  console.log('ping:', ping);

  const payload = new TextEncoder().encode(`hello-ivaronix-${Date.now()}`);
  console.log(`uploading ${payload.length} bytes ...`);
  const start = Date.now();
  try {
    const r = await sc.upload(payload);
    console.log('upload OK in', Date.now() - start, 'ms');
    console.log('rootHash:', r.rootHash);
    console.log('txHash:  ', r.txHash);
    console.log('size:    ', r.size);
  } catch (err) {
    console.error('upload FAILED in', Date.now() - start, 'ms');
    console.error((err as Error).message);
    process.exit(2);
  }
}
main();
