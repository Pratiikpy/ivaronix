import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Wallet, JsonRpcProvider, type ContractRunner } from 'ethers';
import { verifyClaimed, ReceiptV1Schema, type ReceiptV1 } from '@ivaronix/receipts';
import {
  ReceiptRegistryClient,
  ReceiptRegistryV2Client,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { NETWORKS, RECEIPT_TYPES, type Hash, type ReceiptType } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * Read-side registry resolution. Returns the deployed registries in V2-first
 * priority order, so every read path (verify, show, list, resolve-by-id)
 * queries V2 before falling back to V1.
 *
 * Closes the V1-blindness regression (planning-003 §A.1.2, WT 88) that would
 * have broken the gold-standard `ivaronix receipt verify <id>` command for
 * every V2 receipt anchored after the K-2 mainnet redeploy.
 */
type RegistryEntry =
  | { client: ReceiptRegistryV2Client; version: 'v2'; address: string }
  | { client: ReceiptRegistryClient; version: 'v1'; address: string };

interface OnChainReadRow {
  id: bigint;
  receiptRoot: Hash;
  storageRoot: Hash;
  attestationHash: Hash;
  agentAddress: string;
  timestamp: bigint;
  receiptType: number;
  registryVersion: 'v1' | 'v2';
}

function buildReadRegistries(
  network: 'testnet' | 'mainnet',
  runner: ContractRunner,
): RegistryEntry[] {
  const v2Addr = getDeployedAddress(network, 'ReceiptRegistryV2') as
    | `0x${string}`
    | null
    | undefined;
  const v1Addr = getDeployedAddress(network, 'ReceiptRegistry') as
    | `0x${string}`
    | null
    | undefined;
  const out: RegistryEntry[] = [];
  if (v2Addr) {
    out.push({
      client: new ReceiptRegistryV2Client(v2Addr, runner),
      version: 'v2',
      address: v2Addr,
    });
  }
  if (v1Addr) {
    out.push({
      client: new ReceiptRegistryClient(v1Addr, runner),
      version: 'v1',
      address: v1Addr,
    });
  }
  return out;
}

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

  // 4. Numeric on-chain id — resolve to receiptRoot via ReceiptRegistryV2
  //    (preferred, post K-2) or fall back to V1 (legacy receipts).
  if (!targetRoot && /^\d+$/.test(input)) {
    const provider = new JsonRpcProvider(rpcUrl);
    const registries = buildReadRegistries(network, provider);
    if (registries.length === 0) return null;
    for (const r of registries) {
      try {
        const onChain = await r.client.getReceipt(BigInt(input));
        if (onChain) {
          targetRoot = onChain.receiptRoot.toLowerCase();
          break;
        }
      } catch {
        // try next registry
      }
    }
    if (!targetRoot) return null;
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

    // ─── 2. ANCHORED check · V2-first, V1 fallback ────────────────────────
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const registries = buildReadRegistries(env.network, provider);
    if (registries.length === 0) {
      ui.divider();
      ui.banner(true, `→ CLAIMED (chain anchor lookup skipped — no ReceiptRegistry deployment for ${env.network})`);
      return;
    }

    let onChain: OnChainReadRow | null = null;
    let anchoredOn: 'v1' | 'v2' | null = null;

    // Three-tier chain-anchor lookup strategy (sweep 62):
    //
    //   1. If pathOrId is numeric, query getReceipt(id) directly on
    //      each registry. One deterministic RPC call · doesn't depend
    //      on event-scan block ranges. This is the cheapest+most
    //      reliable path because the user already TOLD us the id.
    //
    //   2. If receipt JSON has chainAnchor.anchorBlockNumber, query
    //      findByReceiptRootInRange around that block (±1000 blocks).
    //      Single RPC call within the RPC's eth_getLogs cap.
    //
    //   3. Fallback: findByReceiptRoot with default lookback. Only
    //      runs when neither the id NOR the block hint is available
    //      (rare · receipt without anchor metadata that wasn't looked
    //      up by id).
    //
    // Sweep 61 fixed (1)+(2) was missing entirely; sweep 62 adds
    // (1) for cases where the local receipt JSON's chainAnchor lacks
    // anchorBlockNumber (e.g. receipts anchored from a different
    // machine and copied to this local cache).
    const numericId = /^\d+$/.test(pathOrId) ? BigInt(pathOrId) : null;
    const anchorHint = receipt.chainAnchor?.anchorBlockNumber ?? null;

    for (const r of registries) {
      try {
        let found = null;
        if (numericId !== null) {
          // Tier 1: direct id lookup
          const row = await r.client.getReceipt(numericId);
          if (row && row.receiptRoot.toLowerCase() === receipt.storage.receiptRoot.toLowerCase()) {
            found = row;
          }
        }
        if (!found && anchorHint) {
          // Tier 2: block-hint range
          found = await r.client.findByReceiptRootInRange(
            receipt.storage.receiptRoot as Hash,
            Math.max(0, anchorHint - 1000),
            anchorHint + 1000,
          );
        }
        if (!found) {
          // Tier 3: lookback scan
          found = await r.client.findByReceiptRoot(
            receipt.storage.receiptRoot as Hash,
            anchorHint ? 2000 : 100_000,
          );
        }
        if (found) {
          // The id from the row is what makes this an authoritative
          // chain-anchor confirmation; downstream code prints it.
          onChain = { ...found, registryVersion: r.version };
          anchoredOn = r.version;
          break;
        }
      } catch (err) {
        ui.fail(`chain anchor lookup error on ${r.version.toUpperCase()}`, (err as Error).message);
      }
    }

    if (!onChain) {
      ui.fail(
        `chain anchor          NOT FOUND on ${registries.map((r) => r.version.toUpperCase()).join(' or ')} (receipt was never anchored, or different network)`,
      );
      ui.divider();
      ui.banner('pending', '→ CLAIMED (not yet anchored — not verified)');
      return;
    }

    const versionTag = anchoredOn === 'v2' ? 'V2' : 'V1 LEGACY';
    ui.pass(
      `chain anchor          PASS  (id=${onChain.id} block≈${onChain.timestamp}) · ${versionTag}`,
    );
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
    // `provider` is in scope from the ANCHORED block above. Reuse it.
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
    // Content is the third argument the broker SDK accepts — when present,
    // processResponse verifies the response content matches what was billed.
    // When absent (legacy receipts pre-dating H-2), fall back to 2-arg form
    // (chatId-only check) with an honest warning.
    type Att = { role: string; providerAddress: string; chatId?: string; content?: string };
    const attestations: Att[] = [];
    if (receipt.execution.consensus?.individualAttestations) {
      for (const a of receipt.execution.consensus.individualAttestations) {
        attestations.push({
          role: a.role,
          providerAddress: a.providerAddress,
          chatId: a.chatId,
          content: a.content,
        });
      }
    } else if (receipt.routerTrace.zgResKey && receipt.teeVerification.providerAddress) {
      // Single-role (Quick tier). The receipt's outputs.wording.headline is
      // the closest stand-in for the response content; better than nothing.
      attestations.push({
        role: 'primary',
        providerAddress: receipt.teeVerification.providerAddress,
        chatId: receipt.routerTrace.zgResKey,
        content: receipt.outputs?.wording?.headline,
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
        // H-2: pass content as the third argument when the receipt carries
        // it. Provus and AIsphere both pass content during live inference;
        // we match that depth on offline verify by persisting per-role
        // content in `consensus.individualAttestations[*].content`. When the
        // receipt is older than H-2 and content is missing, the SDK's 2-arg
        // form still verifies the chat ID was billed — degrading honestly.
        const hasContent = typeof att.content === 'string' && att.content.length > 0;
        const ok = hasContent
          ? await broker.inference.processResponse(att.providerAddress, att.chatId, att.content)
          : await broker.inference.processResponse(att.providerAddress, att.chatId);
        if (ok === true) {
          const depth = hasContent ? 'PASS' : 'PASS (chatId-only; legacy receipt)';
          ui.pass(`tee:${att.role.padEnd(15)}  ${depth}  (provider ${att.providerAddress.slice(0, 10)}…)`);
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
  .description('Show full receipt by on-chain id (V2-first, V1 fallback)')
  .action(async (id: string) => {
    const env = loadEnv();
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const registries = buildReadRegistries(env.network, provider);
    if (registries.length === 0) {
      ui.fail(`No ReceiptRegistry (V1 or V2) deployed on ${env.network}`);
      return;
    }

    let row: OnChainReadRow | null = null;
    let foundOn: 'v1' | 'v2' | null = null;
    for (const r of registries) {
      try {
        const found = await r.client.getReceipt(BigInt(id));
        if (found) {
          row = { ...found, registryVersion: r.version };
          foundOn = r.version;
          break;
        }
      } catch (err) {
        ui.fail(
          `lookup failed on ${r.version.toUpperCase()} (${r.address})`,
          (err as Error).message,
        );
      }
    }

    if (!row) {
      ui.fail(
        `No receipt with id ${id} on ${registries.map((r) => r.version.toUpperCase()).join(' or ')}`,
      );
      return;
    }

    const versionTag = foundOn === 'v2' ? 'V2' : 'V1 LEGACY';
    ui.title(`Receipt ${row.id} · ${versionTag}`);
    ui.info(`receiptRoot          ${row.receiptRoot}`);
    ui.info(`storageRoot          ${row.storageRoot}`);
    ui.info(`attestationHash      ${row.attestationHash}`);
    ui.info(`agent                ${row.agentAddress}`);
    ui.info(`timestamp            ${row.timestamp}  (${new Date(Number(row.timestamp) * 1000).toISOString()})`);
    ui.info(`type                 ${row.receiptType}`);
    ui.info(`registry             ${versionTag}`);
  });

// ─── list ───────────────────────────────────────────────────────────────────
receiptCommand
  .command('list')
  .description('List recent receipts from V1 + V2 ReceiptRegistry events (merged + sorted)')
  .option('--agent <addr>', 'filter to receipts anchored by this wallet (default: configured wallet)')
  .option('--since <date>', 'only show receipts after this ISO date (YYYY-MM-DD)')
  .option('--limit <n>', 'max rows to print', '20')
  .action(async (opts: { agent?: string; since?: string; limit: string }) => {
    const env = loadEnv();
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const registries = buildReadRegistries(env.network, provider);
    if (registries.length === 0) {
      ui.fail(`No ReceiptRegistry (V1 or V2) deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    const agent = (opts.agent ?? env.walletAddress) as `0x${string}` | undefined;
    if (!agent) {
      ui.fail('No agent address — pass --agent or set EVM_WALLET_ADDRESS');
      process.exitCode = 1;
      return;
    }
    const limit = Math.max(1, parseInt(opts.limit, 10) || 20);
    const sinceTs = opts.since ? Math.floor(new Date(opts.since).getTime() / 1000) : 0;

    ui.title(`receipts by ${agent.slice(0, 10)}…${agent.slice(-4)} on ${env.network}`);

    // Merge findByAgent results from V1 + V2 (when both deployed). Tag each
    // row with its registry version, sort by timestamp desc, slice to limit.
    const merged: OnChainReadRow[] = [];
    for (const r of registries) {
      try {
        const events = await r.client.findByAgent(agent, limit * 2, 200_000);
        for (const e of events) {
          merged.push({ ...e, registryVersion: r.version });
        }
      } catch (err) {
        ui.fail(
          `findByAgent failed on ${r.version.toUpperCase()}`,
          (err as Error).message,
        );
      }
    }

    merged.sort((a, b) => Number(b.timestamp - a.timestamp));
    const filtered = (sinceTs > 0 ? merged.filter((e) => Number(e.timestamp) >= sinceTs) : merged).slice(0, limit);

    if (filtered.length === 0) {
      ui.hint(`no receipts found${opts.since ? ` since ${opts.since}` : ''}`);
      return;
    }
    ui.divider();
    for (const r of filtered) {
      const iso = new Date(Number(r.timestamp) * 1000).toISOString().replace('T', ' ').slice(0, 19);
      const tag = r.registryVersion === 'v2' ? 'V2' : 'V1';
      ui.pass(
        `#${r.id.toString().padStart(3, ' ')}  ${tag}  type=${r.receiptType}  ${iso}  ${r.receiptRoot.slice(0, 10)}…${r.receiptRoot.slice(-6)}`,
      );
    }
    ui.divider();
    ui.hint(`${filtered.length} row${filtered.length === 1 ? '' : 's'} · merged from ${registries.length} registr${registries.length === 1 ? 'y' : 'ies'}`);
  });
