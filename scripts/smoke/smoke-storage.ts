/**
 * Smoke test: upload a small buffer to 0G Storage testnet, print root hash + tx hash.
 * Usage: pnpm tsx scripts/smoke-storage.ts
 */
import { config as dotenvConfig } from 'dotenv';
import { createStorageClient, burnEncrypt } from '@ivaronix/og-storage';

dotenvConfig();

async function main() {
  const pk = process.env.IVARONIX_SIGNER_KEY ?? process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY;
  if (!pk) throw new Error('Set IVARONIX_SIGNER_KEY in .env (legacy aliases OG_PRIVATE_KEY, EVM_PRIVATE_KEY also accepted)');

  const storage = createStorageClient({ network: 'testnet', privateKey: pk });

  console.log('--- Plaintext upload ---');
  const plaintext = new TextEncoder().encode(`Hello, 0G Storage. Ts=${Date.now()}`);
  const ptResult = await storage.upload(plaintext);
  console.log('  rootHash:', ptResult.rootHash);
  console.log('  txHash:  ', ptResult.txHash);
  console.log('  size:    ', ptResult.size, 'bytes');

  console.log('\n--- Burn-mode upload ---');
  const sensitive = new TextEncoder().encode(`Confidential: ${Date.now()}`);
  const burnResult = await storage.uploadEncryptedBurn(sensitive);
  console.log('  rootHash:        ', burnResult.rootHash);
  console.log('  txHash:          ', burnResult.txHash);
  console.log('  size:            ', burnResult.size, 'bytes (ciphertext)');
  console.log('  encryptionType:  ', burnResult.burn.encryptionType);
  console.log('  keyFingerprint:  ', burnResult.burn.keyFingerprint);
  console.log('  destroyedAt:     ', new Date(burnResult.burn.destroyedAt).toISOString());
  console.log('\n  Note: session key was destroyed. Ciphertext on Storage is now unreadable to operator.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
