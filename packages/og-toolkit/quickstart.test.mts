/**
 * Plan §1453 · live verification of the README quickstart.
 *
 * Runs the exact code from packages/og-toolkit/README.md:
 *   1. createOg({ network: 'testnet', privateKey })
 *   2. og.chain.verifyChainId()
 *   3. og.storage.upload(myBuffer) — a small 100-byte buffer
 *
 * Confirms a stranger using the SDK on a clean machine following the
 * README literally would see chain + storage primitives work today.
 *
 * Does NOT call runSkill (that costs OG + Router credits; covered by
 * iter-157 submission-day smoke).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
function findEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
const envPath = findEnvFile(HERE);
if (envPath) {
  // Minimal dotenv parser — og-toolkit doesn't ship the dotenv dep
  // and we want a no-deps demo of the SDK itself. Reads KEY=VAL lines.
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

import { createOg } from './src/index.js';

const privateKey = process.env.IVARONIX_SIGNER_KEY ?? process.env.OG_PRIVATE_KEY ?? process.env.EVM_PRIVATE_KEY;
if (!privateKey) {
  console.error('FAIL: no IVARONIX_SIGNER_KEY (or legacy alias) in env');
  process.exit(1);
}

// === Step 1: README-literal createOg ===
console.log('=== og-toolkit README quickstart · iter-167 ===\n');
console.log('Step 1: createOg({ network: testnet, privateKey })');
const og = createOg({
  network: 'testnet',
  privateKey,
});
console.log(`   og.network            = ${og.network}`);
console.log(`   og.chain typeof       = ${typeof og.chain}`);
console.log(`   og.storage typeof     = ${typeof og.storage}`);
console.log(`   og.kv typeof          = ${typeof og.kv}`);
console.log(`   og.compute typeof     = ${typeof og.compute}  (null = no router credentials passed)`);
console.log(`   og.runSkill typeof    = ${typeof og.runSkill}`);

// === Step 2: og.chain.verifyChainId() ===
console.log('\nStep 2: og.chain.verifyChainId()');
const chainOk = await og.chain.verifyChainId();
console.log(`   result = ${JSON.stringify(chainOk)}`);
if (!chainOk.ok) {
  console.error(`FAIL: chain verify failed · reason: ${chainOk.reason}`);
  process.exit(1);
}
console.log('   PASS · chain ID matches');

// === Step 3: og.storage.upload(<small buffer>) ===
console.log('\nStep 3: og.storage.upload(small buffer)');
const buf = new TextEncoder().encode(
  `# og-toolkit README quickstart proof · iter-167 · ${new Date().toISOString()}\nThis is a 100-ish byte buffer uploaded via the README-literal SDK call.`,
);
console.log(`   uploading ${buf.byteLength} bytes...`);
try {
  const result = await og.storage.upload(buf);
  console.log(`   rootHash = ${result.rootHash}`);
  console.log(`   tx       = ${result.tx ?? '(no tx returned)'}`);
  console.log('   PASS · upload succeeded');
} catch (e) {
  console.error(`FAIL: storage upload threw: ${(e as Error).message}`);
  process.exit(1);
}

console.log('\n=== og-toolkit README quickstart · ALL STEPS PASS ===');
