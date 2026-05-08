import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import { verifyClaimed, ReceiptV1Schema, type ReceiptV1 } from '@ivaronix/receipts';
import { ReceiptRegistryClient, getDeployedAddress } from '@ivaronix/og-chain';
import { NETWORKS, RECEIPT_TYPES, type Hash, type ReceiptType } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/** Walk up + canonical sibling locations for `.ivaronix/receipts/anchored/`. */
function findAnchoredDirs(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let dir = process.cwd();
  let workspaceRoot: string | null = null;
  for (let i = 0; i < 12; i++) {
    const candidate = resolve(dir, '.ivaronix', 'receipts', 'anchored');
    if (existsSync(candidate) && !seen.has(candidate)) { out.push(candidate); seen.add(candidate); }
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) workspaceRoot = dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (workspaceRoot) {
    for (const sib of ['apps/cli', 'apps/mcp-server', 'apps/studio']) {
      const candidate = resolve(workspaceRoot, sib, '.ivaronix', 'receipts', 'anchored');
      if (existsSync(candidate) && !seen.has(candidate)) { out.push(candidate); seen.add(candidate); }
    }
  }
  return out;
}

/**
 * Resolve a verify input to a local receipt JSON file path. Accepts:
 *   - on-chain numeric id (e.g. "169") — queries ReceiptRegistry for receiptRoot, then searches dirs
 *   - 0x bytes32 receiptRoot — searches dirs by storage.receiptRoot field
 *   - ULID (rcpt_01HV...) — searches dirs by file basename
 *   - file path (existing behavior)
 */
async function resolveReceiptInput(
  input: string,
  network: 'testnet' | 'mainnet',
  rpcUrl: string,
): Promise<string | null> {
  // 1. Direct file path (absolute or relative to cwd)
  const direct = resolve(process.cwd(), input);
  if (existsSync(direct)) return direct;

  const dirs = findAnchoredDirs();

  // 2. ULID: rcpt_<26 base32-crockford chars>
  if (/^rcpt_[0-9A-Z]{26}$/.test(input)) {
    for (const dir of dirs) {
      const candidate = resolve(dir, `${input}.json`);
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  // 3. bytes32 receiptRoot — scan files for matching storage.receiptRoot
  const isRoot = /^0x[0-9a-fA-F]{64}$/.test(input);
  let targetRoot: string | null = isRoot ? input.toLowerCase() : null;

  // 4. Numeric on-chain id — resolve to receiptRoot via ReceiptRegistry
  if (!targetRoot && /^\d+$/.test(input)) {
    const registryAddr = getDeployedAddress(network, 'ReceiptRegistry');
    if (!registryAddr) return null;
    const provider = new JsonRpcProvider(rpcUrl);
    const reg = new ReceiptRegistryClient(registryAddr, provider);
    try {
      const onChain = await reg.getReceipt(BigInt(input));
      if (!onChain) return null;
      targetRoot = onChain.receiptRoot.toLowerCase();
    } catch {
      return null;
    }
  }

  if (!targetRoot) return null;

  for (const dir of dirs) {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const e of entries) {
      if (!e.endsWith('.json')) continue;
      const path = resolve(dir, e);
      try {
        const json = JSON.parse(readFileSync(path, 'utf8'));
        const root = (json?.storage?.receiptRoot as string | undefined)?.toLowerCase();
        if (root === targetRoot) return path;
      } catch { /* skip unparseable */ }
    }
  }
  return null;
}

export const receiptCommand = new Command('receipt')
  .description('Manage and verify Action Receipts');

// ─── verify ─────────────────────────────────────────────────────────────────
receiptCommand
  .command('verify <pathOrId>')
  .description('Verify a receipt — shows CLAIMED → ANCHORED → FULLY VERIFIED')
  .option('--tee-independent', 'also run independent TEE verification via broker.processResponse')
  .action(async (pathOrId: string, opts: { teeIndependent?: boolean }) => {
    const env = loadEnv();

    const filePath = await resolveReceiptInput(pathOrId, env.network, env.rpcUrl);
    if (!filePath) {
      ui.fail(`No receipt resolves "${pathOrId}"`);
      ui.hint('Pass a file path, an on-chain id (e.g. "169"), a 0x bytes32 receiptRoot, or a ULID (rcpt_01...).');
      process.exitCode = 1;
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      ui.fail(`Cannot parse JSON`, (err as Error).message);
      process.exitCode = 1;
      return;
    }

    ui.title(`Verifying ${pathOrId}` + (pathOrId !== filePath ? ` (${filePath})` : ''));
    ui.divider();

    // ─── 1. CLAIMED checks (offline) ──────────────────────────────────────
    const claimedResult = verifyClaimed(json);
    for (const check of claimedResult.checks) {
      const label = check.name.padEnd(22);
      if (check.pass) ui.pass(`${label} PASS`);
      else ui.fail(`${label} FAIL`, check.detail);
    }

    if (claimedResult.state === 'INVALID') {
      ui.divider();
      ui.banner(false, '✗ INVALID');
      process.exitCode = 1;
      return;
    }
    ui.pass(`                    → CLAIMED`);

    const receipt = json as ReceiptV1;

    // ─── 2. ANCHORED check (on-chain via ReceiptRegistry) ─────────────────
    const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!registryAddr) {
      ui.divider();
      ui.banner(true, `→ CLAIMED (chain anchor lookup skipped — no ReceiptRegistry deployment for ${env.network})`);
      return;
    }

    let onChain: Awaited<ReturnType<ReceiptRegistryClient['findByReceiptRoot']>> = null;
    try {
      const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
      const registry = new ReceiptRegistryClient(registryAddr, provider);
      onChain = await registry.findByReceiptRoot(receipt.storage.receiptRoot as Hash);
    } catch (err) {
      ui.fail('chain anchor lookup error', (err as Error).message);
      ui.banner(true, '→ CLAIMED (anchor check failed)');
      return;
    }

    if (!onChain) {
      ui.fail('chain anchor          NOT FOUND  (receipt was never anchored, or different network)');
      ui.divider();
      ui.banner(true, '→ CLAIMED (not yet anchored)');
      return;
    }

    ui.pass(`chain anchor          PASS  (id=${onChain.id} block≈${onChain.timestamp})`);
    ui.pass(`                    → ANCHORED`);

    // ─── 3. FULLY VERIFIED — independent TEE verify ───────────────────────
    if (!opts.teeIndependent) {
      ui.divider();
      ui.banner(true, '→ ANCHORED ✓');
      ui.hint('Run again with --tee-independent to advance to FULLY VERIFIED');
      return;
    }

    if (!env.privateKey) {
      ui.fail('--tee-independent requires EVM_PRIVATE_KEY in .env to construct broker');
      process.exitCode = 1;
      return;
    }

    // Use createRequire for the broker SDK because its ESM bundle has internal
    // module-resolution issues; the CJS path is stable.
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk = require('@0gfoundation/0g-compute-ts-sdk') as {
      createZGComputeNetworkBroker: (
        signer: unknown,
      ) => Promise<{
        inference: {
          processResponse: (
            providerAddress: string,
            chatID?: string,
            content?: string,
          ) => Promise<boolean | null>;
        };
      }>;
    };
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);

    let broker: Awaited<ReturnType<typeof sdk.createZGComputeNetworkBroker>>;
    try {
      ui.pending('initializing 0G Compute broker...');
      broker = await sdk.createZGComputeNetworkBroker(wallet);
    } catch (err) {
      ui.fail('Failed to create broker', (err as Error).message);
      ui.banner(true, '→ ANCHORED (TEE-independent skipped)');
      return;
    }

    // Collect (role, providerAddress, chatId, content) tuples to verify.
    type Att = { role: string; providerAddress: string; chatId?: string };
    const attestations: Att[] = [];
    if (receipt.execution.consensus?.individualAttestations) {
      for (const a of receipt.execution.consensus.individualAttestations) {
        attestations.push({ role: a.role, providerAddress: a.providerAddress, chatId: a.chatId });
      }
    } else if (receipt.routerTrace.zgResKey && receipt.teeVerification.providerAddress) {
      // Single-role (Quick tier)
      attestations.push({
        role: 'primary',
        providerAddress: receipt.teeVerification.providerAddress,
        chatId: receipt.routerTrace.zgResKey,
      });
    }

    if (attestations.length === 0) {
      ui.pending('no attestations available in receipt for independent verify');
      ui.banner(true, '→ ANCHORED (TEE-independent N/A)');
      return;
    }

    ui.pending(`verifying ${attestations.length} attestation${attestations.length > 1 ? 's' : ''} via broker.processResponse...`);

    let allPass = true;
    for (const att of attestations) {
      if (!att.chatId) {
        ui.fail(`tee:${att.role.padEnd(15)}  no chatId in receipt`);
        allPass = false;
        continue;
      }
      try {
        const ok = await broker.inference.processResponse(att.providerAddress, att.chatId);
        if (ok === true) {
          ui.pass(`tee:${att.role.padEnd(15)}  PASS  (provider ${att.providerAddress.slice(0, 10)}…)`);
        } else if (ok === false) {
          ui.fail(`tee:${att.role.padEnd(15)}  FAIL  (signature mismatch)`);
          allPass = false;
        } else {
          ui.pending(`tee:${att.role.padEnd(15)}  inconclusive (${String(ok)})`);
          allPass = false;
        }
      } catch (err) {
        ui.fail(`tee:${att.role.padEnd(15)}  error`, (err as Error).message);
        allPass = false;
      }
    }

    ui.divider();
    if (allPass) {
      ui.pass(`                    → FULLY VERIFIED`);
      ui.banner(true, '→ FULLY VERIFIED ✓');
    } else {
      ui.banner(true, '→ ANCHORED (some TEE checks failed; see above)');
    }
  });

// ─── anchor ─────────────────────────────────────────────────────────────────
receiptCommand
  .command('anchor <pathToSignedReceipt>')
  .description('Anchor a signed receipt on chain (calls ReceiptRegistry.anchor)')
  .option('--write-back', 'update the local file with the chainAnchor tx info', true)
  .action(async (pathToSignedReceipt: string, opts: { writeBack?: boolean }) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No private key in .env');
      process.exitCode = 1;
      return;
    }

    const filePath = resolve(process.cwd(), pathToSignedReceipt);
    if (!existsSync(filePath)) {
      ui.fail(`No receipt at ${filePath}`);
      process.exitCode = 1;
      return;
    }

    const json = JSON.parse(readFileSync(filePath, 'utf8'));
    const parsed = ReceiptV1Schema.safeParse(json);
    if (!parsed.success) {
      ui.fail('Invalid receipt JSON', parsed.error.message);
      process.exitCode = 1;
      return;
    }
    const receipt = parsed.data;

    if (!receipt.signature) {
      ui.fail('Receipt is unsigned');
      process.exitCode = 1;
      return;
    }

    const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!registryAddr) {
      ui.fail(`ReceiptRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    ui.title(`Anchoring ${receipt.id}`);
    ui.info(`network              ${env.network}`);
    ui.info(`registry             ${registryAddr}`);
    ui.info(`receiptRoot          ${receipt.storage.receiptRoot}`);
    ui.info(`type                 ${receipt.type} (code ${RECEIPT_TYPES[receipt.type as ReceiptType]})`);
    ui.divider();

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const registry = new ReceiptRegistryClient(registryAddr, wallet);

    try {
      const typeCode = RECEIPT_TYPES[receipt.type as ReceiptType];
      const attestationHash: Hash = (receipt.teeVerification.attestationHash ?? ('0x' + '0'.repeat(64))) as Hash;
      const storageRoot: Hash = (receipt.storage.evidenceRoot ?? receipt.storage.receiptRoot) as Hash;

      ui.pending('Submitting anchor tx...');
      const tx = await registry.anchor(
        receipt.storage.receiptRoot as Hash,
        storageRoot,
        typeCode,
        attestationHash,
      );
      ui.info(`tx hash              ${tx.hash}`);

      ui.pending('Waiting for confirmation...');
      const receipt2 = await tx.wait();
      if (!receipt2) {
        ui.fail('Transaction did not return a receipt');
        return;
      }

      ui.pass(`block                ${receipt2.blockNumber}`);
      ui.pass(`gas used             ${receipt2.gasUsed}`);

      const onChain = await registry.findByReceiptRoot(receipt.storage.receiptRoot as Hash, 50);
      if (onChain) {
        ui.pass(`receipt id           ${onChain.id}`);
        ui.pass(`explorer             ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
      }

      if (opts.writeBack) {
        const updated: ReceiptV1 = {
          ...receipt,
          chainAnchor: {
            ...receipt.chainAnchor,
            anchorTxHash: tx.hash as Hash,
            anchorBlockNumber: receipt2.blockNumber,
            anchorTimestamp: Math.floor(Date.now() / 1000),
          },
        };
        writeFileSync(filePath, JSON.stringify(updated, null, 2));
        ui.pass(`updated              ${pathToSignedReceipt} (chainAnchor block written back)`);
      }

      ui.divider();
      ui.banner(true, '→ ANCHORED ✓');
    } catch (err) {
      ui.fail('Anchor tx failed', (err as Error).message);
      process.exitCode = 1;
    }
  });

// ─── show ───────────────────────────────────────────────────────────────────
receiptCommand
  .command('show <id>')
  .description('Show full receipt by on-chain id')
  .action(async (id: string) => {
    const env = loadEnv();
    const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!registryAddr) {
      ui.fail(`ReceiptRegistry not deployed on ${env.network}`);
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const registry = new ReceiptRegistryClient(registryAddr, provider);
    const r = await registry.getReceipt(BigInt(id));
    if (!r) {
      ui.fail(`No receipt with id ${id}`);
      return;
    }
    ui.title(`Receipt ${r.id}`);
    ui.info(`receiptRoot          ${r.receiptRoot}`);
    ui.info(`storageRoot          ${r.storageRoot}`);
    ui.info(`attestationHash      ${r.attestationHash}`);
    ui.info(`agent                ${r.agentAddress}`);
    ui.info(`timestamp            ${r.timestamp}  (${new Date(Number(r.timestamp) * 1000).toISOString()})`);
    ui.info(`type                 ${r.receiptType}`);
  });

// ─── list ───────────────────────────────────────────────────────────────────
receiptCommand
  .command('list')
  .description('List recent receipts from ReceiptRegistry events')
  .option('--agent <addr>', 'filter to receipts anchored by this wallet (default: configured wallet)')
  .option('--since <date>', 'only show receipts after this ISO date (YYYY-MM-DD)')
  .option('--limit <n>', 'max rows to print', '20')
  .action(async (opts: { agent?: string; since?: string; limit: string }) => {
    const env = loadEnv();
    const addr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!addr) {
      ui.fail(`ReceiptRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const reg = new ReceiptRegistryClient(addr, provider);
    const agent = (opts.agent ?? env.walletAddress) as `0x${string}` | undefined;
    if (!agent) {
      ui.fail('No agent address — pass --agent or set EVM_WALLET_ADDRESS');
      process.exitCode = 1;
      return;
    }
    const limit = Math.max(1, parseInt(opts.limit, 10) || 20);
    const sinceTs = opts.since ? Math.floor(new Date(opts.since).getTime() / 1000) : 0;

    ui.title(`receipts by ${agent.slice(0, 10)}…${agent.slice(-4)} on ${env.network}`);
    const events = await reg.findByAgent(agent, limit, 200_000);
    const filtered = sinceTs > 0 ? events.filter((e) => Number(e.timestamp) >= sinceTs) : events;
    if (filtered.length === 0) {
      ui.hint(`no receipts found${opts.since ? ` since ${opts.since}` : ''}`);
      return;
    }
    ui.divider();
    for (const r of filtered) {
      const iso = new Date(Number(r.timestamp) * 1000).toISOString().replace('T', ' ').slice(0, 19);
      ui.pass(`#${r.id.toString().padStart(3, ' ')}  type=${r.receiptType}  ${iso}  ${r.receiptRoot.slice(0, 10)}…${r.receiptRoot.slice(-6)}`);
    }
    ui.divider();
    ui.hint(`${filtered.length} row${filtered.length === 1 ? '' : 's'}`);
  });
