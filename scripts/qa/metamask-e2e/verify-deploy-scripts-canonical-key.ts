/**
 * Regression: every contracts/script/Deploy*.s.sol uses the canonical
 * IVARONIX_SIGNER_KEY alias chain — `vm.envOr("IVARONIX_SIGNER_KEY",
 * vm.envUint("OG_PRIVATE_KEY"))` — NOT a bare `vm.envUint("OG_PRIVATE_KEY")`.
 *
 * Why this gate exists (sweep 80 finding · closes USER_TODO B-V2-10):
 *   `packages/runtime/src/env.ts` defines IVARONIX_SIGNER_KEY as the
 *   canonical signing-key env var with OG_PRIVATE_KEY as a deprecated
 *   alias (planning-003 §A.3.4). CLI + Studio respect the canonical form,
 *   but pre-sweep-80, four of the eight Foundry deploy scripts
 *   (`DeployReceiptRegistry`, `DeployReceiptRegistryV2`, `DeployPassport`,
 *   `DeployPassportV2`) read OG_PRIVATE_KEY directly. Operators who set
 *   only IVARONIX_SIGNER_KEY (the canonical name) hit "missing
 *   OG_PRIVATE_KEY" mid-deploy.
 *
 *   Sweep 80 migrated all 8 scripts to the alias chain. This regression
 *   prevents reintroducing the bare legacy form in any future Deploy*.s.sol.
 *
 * What we check:
 *   For every `contracts/script/Deploy*.s.sol`:
 *     - find every line that calls vm.envUint("OG_PRIVATE_KEY") OR
 *       vm.envString("OG_PRIVATE_KEY")
 *     - require the SAME line to also reference "IVARONIX_SIGNER_KEY"
 *       (i.e. it's the inner-fallback of a vm.envOr call)
 *     - require every script to have at least one IVARONIX_SIGNER_KEY ref
 *
 * Captures sweep 80's closure as a permanent gate. Testnet-only — the
 * regression itself IS the durable record. CLAUDE.md §15 canonical-alias
 * rule extended from AGENTS.md to Foundry deploy scripts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const SCRIPT_DIR = resolve(REPO_ROOT, 'contracts', 'script');

interface Hit {
  file: string;
  line: number;
  text: string;
  kind: 'bare-og-key' | 'no-canonical-anywhere';
}

function listDeployScripts(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /^Deploy.*\.s\.sol$/.test(f))
    .map((f) => resolve(dir, f));
}

function scanFile(file: string): Hit[] {
  const src = readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? '';
    // Skip comment-only lines (the JSDoc `*` lines that document env
    // vars) — only check actual code calls.
    const trimmed = text.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    const usesBareLegacy = /vm\.env(?:Uint|String)\(\s*"OG_PRIVATE_KEY"\s*\)/.test(text);
    if (usesBareLegacy && !text.includes('IVARONIX_SIGNER_KEY')) {
      hits.push({ file, line: i + 1, text: text.trim(), kind: 'bare-og-key' });
    }
  }
  // Also: if the file has any vm.env*("OG_PRIVATE_KEY") at all and NO
  // IVARONIX_SIGNER_KEY anywhere in the file, that's a regression.
  if (
    /vm\.env(?:Uint|String)\(\s*"OG_PRIVATE_KEY"\s*\)/.test(src) &&
    !src.includes('IVARONIX_SIGNER_KEY')
  ) {
    hits.push({
      file,
      line: 0,
      text: '(file-level) script uses OG_PRIVATE_KEY but never references IVARONIX_SIGNER_KEY',
      kind: 'no-canonical-anywhere',
    });
  }
  return hits;
}

console.log('Foundry · Deploy scripts use IVARONIX_SIGNER_KEY canonical alias chain\n');

const scripts = listDeployScripts(SCRIPT_DIR);
const allHits: Hit[] = [];
for (const f of scripts) allHits.push(...scanFile(f));

console.log(`  scanned ${scripts.length} Deploy*.s.sol scripts`);

if (allHits.length === 0) {
  console.log(`  PASS · every script uses vm.envOr("IVARONIX_SIGNER_KEY", ...) shape`);
  process.exit(0);
}

console.error(`  FAIL · ${allHits.length} violation(s):\n`);
for (const h of allHits) {
  const rel = relative(REPO_ROOT, h.file).replace(/\\/g, '/');
  const where = h.line > 0 ? `${rel}:${h.line}` : rel;
  console.error(`    ${where}  [${h.kind}]`);
  console.error(`      ${h.text}`);
}
console.error('\n  fix: change to');
console.error('       uint256 deployerKey = vm.envOr("IVARONIX_SIGNER_KEY", vm.envUint("OG_PRIVATE_KEY"));');
console.error('       and update the JSDoc to lead with IVARONIX_SIGNER_KEY (legacy OG_PRIVATE_KEY noted).');
process.exit(1);
