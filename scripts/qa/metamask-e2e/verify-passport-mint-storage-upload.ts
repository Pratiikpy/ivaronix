/**
 * `ivaronix passport mint` MUST upload metadata to 0G Storage before
 * computing the chain-anchored `metadataRoot`. Closes HALF_BAKED §I-11
 * (sweep 164 shipped; sweep 208 added this structural lock).
 *
 * Pre-sweep-164 the command wrote `'0x' + sha256(JSON.stringify(metadata))`
 * to chain as `metadataRoot`. Anyone reading the passport on chainscan
 * could verify the hash but had no way to retrieve the actual metadata
 * preimage — the chain field was a commitment with no resolvable target.
 *
 * The shipped fix:
 *   1. Encode metadata as JSON bytes.
 *   2. Try `createStorageClient(...).upload(metadataBytes)` →
 *      `metadataRoot = upload.rootHash`, with `metadataRootMethod` set
 *      to `'0g-storage'`.
 *   3. On upload failure, fall back to `sha256(metadataBytes)` with
 *      `metadataRootMethod = 'local-sha256'`. The fallback is honest:
 *      the local passport JSON records WHICH method produced the root,
 *      so an operator can tell from the file whether the metadata is
 *      Storage-resolvable.
 *
 * This regression locks the three wiring symbols a regression to the
 * pre-fix shape would silently lose:
 *   - createStorageClient import
 *   - `sc.upload(metadataBytes)` call site
 *   - `metadataRootMethod` field on the local passport file
 *   - HALF_BAKED §I-11 citation
 *
 * Pure source-file regression.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

let asserts = 0;
const fail = (msg: string): never => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};
const ok = (label: string) => {
  asserts++;
  console.log(`OK: ${label}`);
};

const passportPath = resolve(REPO_ROOT, 'apps', 'cli', 'src', 'commands', 'passport.ts');
const src = readFileSync(passportPath, 'utf8');
ok(`loaded ${passportPath}`);

const wiring = [
  {
    label: 'createStorageClient import',
    pattern: /createStorageClient\s*[,}]/,
    miss: 'passport.ts must import createStorageClient from @ivaronix/og-storage (sweep 164 wiring)',
  },
  {
    label: 'sc.upload(metadataBytes) call',
    pattern: /\bsc\.upload\s*\(\s*metadataBytes\b/,
    miss: 'passport mint must call sc.upload(metadataBytes) before computing metadataRoot (§I-11 closure)',
  },
  {
    label: 'metadataRootMethod tag',
    pattern: /metadataRootMethod\s*[:=]\s*['"]0g-storage['"]/,
    miss: 'passport mint must tag metadataRootMethod = "0g-storage" on successful upload (honest provenance)',
  },
  {
    label: 'local-sha256 fallback tag',
    pattern: /metadataRootMethod\s*[:=]\s*['"]local-sha256['"]/,
    miss: 'passport mint must tag metadataRootMethod = "local-sha256" on Storage upload failure (honest fallback)',
  },
];

for (const w of wiring) {
  if (!w.pattern.test(src)) {
    fail(`${w.miss} · pattern ${w.pattern} did not match in apps/cli/src/commands/passport.ts`);
  }
  ok(`${w.label} present`);
}

if (!/HALF_BAKED §I-11/.test(src) && !/HALF_BAKED \xa7I-11/.test(src)) {
  fail('passport.ts must reference "HALF_BAKED §I-11" near the mint metadata block (sweep 164 closure citation)');
}
ok('HALF_BAKED §I-11 citation present in passport.ts');

// Anti-regression: the OLD shape was `sha256(JSON.stringify(metadata))`
// written DIRECTLY to chain without a Storage upload attempt first.
// We catch the legacy form by requiring the sha256 path to be guarded
// by a catch block (i.e. appears AFTER the storage upload, never as
// the primary write).
const sha256Idx = src.search(/sha256HexAsync\s*\(\s*metadataBytes/);
const uploadIdx = src.search(/\bsc\.upload\s*\(\s*metadataBytes\b/);
if (sha256Idx >= 0 && uploadIdx >= 0 && sha256Idx < uploadIdx) {
  fail('passport.ts has sha256(metadataBytes) BEFORE sc.upload(metadataBytes) — the pre-§I-11 shape. Storage upload must be attempted first; sha256 is the fallback.');
}
ok('sha256 fallback appears AFTER the Storage upload attempt (not before)');

console.log(`\n[verify-passport-mint-storage-upload] ${asserts} assertions passed`);
