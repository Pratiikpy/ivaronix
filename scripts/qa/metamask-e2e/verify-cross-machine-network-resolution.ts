// Cross-machine network resolution · regression sentinel.
//
// Fix history: 2026-05-16 · receipt verify hardcoded `env.network` as the
// query target for the ANCHORED check, so a mainnet receipt body verified
// from a testnet-defaulted CLI returned "NOT FOUND on V3/V2/V1" instead of
// ANCHORED. The fix reads `receipt.chainAnchor.network` as the canonical
// source of truth and falls back to env.network only when the receipt body
// omits the field.
//
// This regression keeps the fix locked: a future refactor that reverts to
// `buildReadRegistries(env.network, ...)` without honoring the receipt body
// would break the JUDGE_GUIDE Step 1 trust claim ("independently replayable
// on a different machine, with no account"). The cron must catch the
// regression before it ships.
//
// Run: pnpm tsx scripts/qa/metamask-e2e/verify-cross-machine-network-resolution.ts
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

const VERIFY_PATH = resolve(REPO_ROOT, 'apps/cli/src/commands/receipt.ts');
const verifySrc = readFileSync(VERIFY_PATH, 'utf8');

// ─── 1. The fix shape MUST be present ────────────────────────────────
// declaredNetwork derives from receipt.chainAnchor.network; targetNetwork
// applies the fallback to env.network. The regex allows arbitrary type
// cast and chained access between `chainAnchor` and `.network` — what
// matters is that the value comes from the RECEIPT BODY's chainAnchor
// block, not from env.network or some other source.
const declaredNetworkPattern = /declaredNetwork\s*=[\s\S]{0,200}receipt\.chainAnchor[\s\S]{0,200}\.network/;
if (!declaredNetworkPattern.test(verifySrc)) {
  fail(`apps/cli/src/commands/receipt.ts: receipt.chainAnchor.network is no longer the source for declaredNetwork. The cross-machine network resolution fix has regressed. See JUDGE_GUIDE.md Step 1 — the verifier MUST honor the receipt body's declared network for the chain anchor lookup, otherwise a judge running verify on a mainnet receipt from a testnet-defaulted CLI gets "NOT FOUND" instead of ANCHORED.`);
}
ok('receipt.ts derives declaredNetwork from receipt.chainAnchor.network');

if (!/targetNetwork\s*=\s*declaredNetwork\s*\?\?\s*env\.network/.test(verifySrc)) {
  fail(`apps/cli/src/commands/receipt.ts: targetNetwork no longer falls back to env.network for legacy receipts without chainAnchor.network. The fallback must remain so pre-W6 receipts (no body-declared network field) still verify cleanly.`);
}
ok('receipt.ts falls back to env.network when receipt body omits chainAnchor.network');

// ─── 2. buildReadRegistries MUST receive targetNetwork ──────────────
// Not env.network — that's the bug shape we are guarding against.
if (!/buildReadRegistries\(\s*targetNetwork\s*,/.test(verifySrc)) {
  fail(`apps/cli/src/commands/receipt.ts: buildReadRegistries() is no longer called with targetNetwork. If it reverts to env.network the cross-machine fix is broken.`);
}
ok('receipt.ts calls buildReadRegistries(targetNetwork, ...)');

// ─── 3. JsonRpcProvider MUST use targetCfg, not raw env.rpcUrl ──────
// The provider has to follow the resolved network — a mainnet receipt
// verified through a testnet RPC will return null for every chain query
// even after the registry addresses are correct.
const providerPattern = /new\s+JsonRpcProvider\(\s*targetCfg\.rpcUrl/;
if (!providerPattern.test(verifySrc)) {
  fail(`apps/cli/src/commands/receipt.ts: JsonRpcProvider for the ANCHORED check no longer uses targetCfg.rpcUrl. If it reverts to env.rpcUrl the RPC will point at the wrong chain and every cross-machine verify will fail.`);
}
ok('receipt.ts builds JsonRpcProvider from targetCfg.rpcUrl');

// ─── 4. Cross-machine info line should fire when networks differ ────
// The verifier prints which network it used so an operator debugging
// "why did this verify ANCHORED when my .env says testnet?" sees the
// right answer at a glance.
if (!/network\s+\$\{targetNetwork\}\s*\(receipt body\s*·\s*cross-machine\)/.test(verifySrc)) {
  fail(`apps/cli/src/commands/receipt.ts: the cross-machine info line ("network <X> (receipt body · cross-machine) · CLI default was <Y>") is missing or has drifted. The line keeps the override transparent — without it an operator can't tell why the verifier chose mainnet over their CLI default.`);
}
ok('receipt.ts surfaces the cross-machine network override in UI');

console.log(`\n${asserts}/${asserts} assertions passed`);
