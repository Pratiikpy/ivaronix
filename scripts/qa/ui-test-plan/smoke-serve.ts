/**
 * Smoke test for `ivaronix serve` REST API. Boots the local server on
 * a free port, hits /healthz + /v1/passport + /v1/receipt, asserts the
 * V3 aware fields landed correctly.
 *
 * Closes the V3-lookup + V1-passport waivers proven this iter (12) —
 * a regression here means a future contributor reverted the V2-first
 * pattern across the serve.ts surface.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

async function main(): Promise<void> {
  // Pick an ephemeral port to avoid conflict with any running server.
  const PORT = String(8800 + Math.floor(Math.random() * 199));
  const child = spawn('pnpm', ['dev', 'serve', '--port', PORT], {
    cwd: resolve(REPO, 'apps/cli'),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, IVARONIX_QUIET_ALIAS_WARNINGS: '1' },
  });

  let stderr = '';
  let exited = false;
  child.stderr?.on('data', (d) => { stderr += d.toString(); });
  child.on('exit', () => { exited = true; });

  // Wait for the server to be listening — fail fast if the child exits.
  let booted = false;
  for (let i = 0; i < 30; i++) {
    if (exited) {
      console.error('✗ Server child exited before binding. stderr:\n', stderr.slice(-1500));
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1_000));
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/healthz`);
      if (r.status === 200) { booted = true; break; }
    } catch { /* not up yet */ }
  }
  if (!booted) {
    child.kill('SIGTERM');
    console.error('✗ Server did not boot within 30s. stderr tail:\n', stderr.slice(-1500));
    process.exit(1);
  }

  try {
    // 1) /healthz returns V3 fields
    const healthz = await fetch(`http://127.0.0.1:${PORT}/healthz`).then((r) => r.json());
    if (typeof healthz.receiptsV3 !== 'number') {
      throw new Error(`/healthz did not return receiptsV3 field: ${JSON.stringify(healthz)}`);
    }
    if (typeof healthz.receipts !== 'number' || healthz.receipts !== (healthz.receiptsV1 + healthz.receiptsV2 + healthz.receiptsV3)) {
      throw new Error(`/healthz receipts total ≠ V1+V2+V3 sum: ${JSON.stringify(healthz)}`);
    }
    console.log(`✓ /healthz · receipts V1=${healthz.receiptsV1} V2=${healthz.receiptsV2} V3=${healthz.receiptsV3} total=${healthz.receipts} passports=${healthz.passports}`);

    // 2) /v1/passport for operator returns contract V2
    const passport = await fetch(`http://127.0.0.1:${PORT}/v1/passport/0xaa954c33810029a3eFb0bf755FEF17863E8677Ce`).then((r) => r.json());
    if (passport.contract !== 'v2') {
      throw new Error(`/v1/passport for operator did not return contract: v2: ${JSON.stringify(passport)}`);
    }
    console.log(`✓ /v1/passport · operator → contract V2 tokenId ${passport.tokenId} trustScore ${passport.trustScore}`);

    // 3) /v1/receipt/1 returns registry V3
    const r3 = await fetch(`http://127.0.0.1:${PORT}/v1/receipt/1`).then((r) => r.json());
    if (r3.registry !== 'v3' || r3.state !== 'ANCHORED') {
      throw new Error(`/v1/receipt/1 did not return registry v3 + ANCHORED: ${JSON.stringify(r3)}`);
    }
    console.log(`✓ /v1/receipt/1 · registry V3 · ANCHORED · root ${r3.receiptRoot.slice(0, 16)}…`);

    // 4) /v1/receipt/31 returns registry V2
    const r2 = await fetch(`http://127.0.0.1:${PORT}/v1/receipt/31`).then((r) => r.json());
    if (r2.registry !== 'v2' || r2.state !== 'ANCHORED') {
      throw new Error(`/v1/receipt/31 did not return registry v2 + ANCHORED: ${JSON.stringify(r2)}`);
    }
    console.log(`✓ /v1/receipt/31 · registry V2 · ANCHORED · root ${r2.receiptRoot.slice(0, 16)}…`);

    // 5) /v1/receipt/1004 returns registry V1 (LEGACY)
    const r1 = await fetch(`http://127.0.0.1:${PORT}/v1/receipt/1004`).then((r) => r.json());
    if (r1.registry !== 'v1' || r1.state !== 'ANCHORED') {
      throw new Error(`/v1/receipt/1004 did not return registry v1 + ANCHORED: ${JSON.stringify(r1)}`);
    }
    console.log(`✓ /v1/receipt/1004 · registry V1 (legacy) · ANCHORED · root ${r1.receiptRoot.slice(0, 16)}…`);
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
