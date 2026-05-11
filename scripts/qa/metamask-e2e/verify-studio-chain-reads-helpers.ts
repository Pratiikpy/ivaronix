/**
 * Studio app surfaces must read chain state through helpers.
 *
 * Mirror of the CLI V2-drift trifecta (sweeps 179-183) for Studio.
 * Studio's app/ surfaces should NOT construct ReceiptRegistryClient /
 * ReceiptRegistryV2Client directly — the helpers in @/lib/chain
 * (unifiedNextId, unifiedGetReceipt, unifiedFindByAgent,
 * unifiedFindByReceiptRoot, livePassportCount) own the V2-first /
 * V1-fallback / anchored-convention logic.
 *
 * Pre-sweep audit: 0 violations. This regression locks the state so
 * any future surface adding a direct client construction fails CI.
 *
 * Skip: apps/studio/src/lib/chain.ts (the helpers themselves)
 * Inline allow: `chain-helper-allow:<reason>` for genuine exceptions.
 *
 * Pure source-file regression.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const APP_ROOT = resolve(REPO_ROOT, 'apps/studio/src/app');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
}

const files: string[] = [];
walk(APP_ROOT, files);
ok(`scanned ${files.length} Studio app files`);

const violations: Array<{ file: string; line: number; reason: string }> = [];

for (const file of files) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    if (/chain-helper-allow:/.test(text)) continue;
    // Direct ReceiptRegistry?Client construction in app surface.
    if (/\bnew\s+ReceiptRegistry(V2)?Client\b/.test(text)) {
      violations.push({
        file: rel,
        line: i + 1,
        reason: 'constructs ReceiptRegistry(V2)Client directly in an app surface — use helpers from @/lib/chain (unifiedNextId / unifiedFindByAgent / unifiedGetReceipt / unifiedFindByReceiptRoot)',
      });
    }
  }
}

if (violations.length > 0) {
  console.error('FAIL: Studio app surfaces construct chain clients directly:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  - ${v.reason}`);
  }
  console.error('Fix: import the appropriate helper from @/lib/chain. The helpers own V2-first / V1-fallback + anchored-convention math; direct construction can drift on those concerns.');
  process.exit(1);
}

ok('no direct ReceiptRegistry(V2)Client construction in apps/studio/src/app/');
console.log(`\n[verify-studio-chain-reads-helpers] ${asserts} assertions passed`);
