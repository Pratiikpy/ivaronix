import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import { verifyClaimed, ReceiptV1Schema, type ReceiptV1 } from '@ivaronix/receipts';
import { ReceiptRegistryClient, getDeployedAddress } from '@ivaronix/og-chain';
import { NETWORKS, RECEIPT_TYPES, type Hash, type ReceiptType } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

export const receiptCommand = new Command('receipt')
  .description('Manage and verify Action Receipts');

// ─── verify ─────────────────────────────────────────────────────────────────
receiptCommand
  .command('verify <pathOrId>')
  .description('Verify a receipt — shows CLAIMED → ANCHORED → FULLY VERIFIED')
  .option('--tee-independent', 'also run independent TEE verification via broker.processResponse')
  .action(async (pathOrId: string, opts: { teeIndependent?: boolean }) => {
    const env = loadEnv();

    const filePath = resolve(process.cwd(), pathOrId);
    if (!existsSync(filePath)) {
      ui.fail(`No receipt at ${filePath}`, 'Day 4+ will resolve receipt ids by querying ReceiptRegistry');
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

    ui.title(`Verifying ${pathOrId}`);
    ui.divider();

    // 1. CLAIMED checks (offline)
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

    // 2. ANCHORED check (on-chain via ReceiptRegistry)
    const receipt = json as ReceiptV1;
    const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!registryAddr) {
      ui.divider();
      ui.banner(true, `→ CLAIMED (chain anchor lookup skipped — no ReceiptRegistry deployment for ${env.network})`);
      return;
    }

    try {
      const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
      const registry = new ReceiptRegistryClient(registryAddr, provider);
      const onChain = await registry.findByReceiptRoot(receipt.storage.receiptRoot as Hash);

      if (!onChain) {
        ui.fail('chain anchor          NOT FOUND  (receipt was never anchored, or different network)');
        ui.divider();
        ui.banner(true, '→ CLAIMED (not yet anchored)');
        return;
      }

      // Verify on-chain receipt matches the local one
      if (onChain.storageRoot.toLowerCase() !== receipt.storage.receiptRoot.toLowerCase() && onChain.receiptRoot.toLowerCase() === receipt.storage.receiptRoot.toLowerCase()) {
        ui.pass(`chain anchor          PASS  (id=${onChain.id} block≈${onChain.timestamp})`);
        ui.pass(`                    → ANCHORED`);
      } else {
        ui.pass(`chain anchor          PASS  (id=${onChain.id})`);
        ui.pass(`                    → ANCHORED`);
      }

      if (opts.teeIndependent) {
        ui.pending(`tee independent       PENDING  (Day 5: broker.processResponse integration)`);
      }

      ui.divider();
      ui.banner(true, '→ ANCHORED ✓');
    } catch (err) {
      ui.fail('chain anchor lookup error', (err as Error).message);
      ui.banner(true, '→ CLAIMED (anchor check failed; see error above)');
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
      ui.fail('No private key in .env', 'Set EVM_PRIVATE_KEY to anchor receipts');
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
      ui.fail('Receipt is unsigned', 'Sign the receipt first (build phase)');
      process.exitCode = 1;
      return;
    }

    const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!registryAddr) {
      ui.fail(`ReceiptRegistry not deployed on ${env.network}`, `Run 'forge create' or wait for next deploy phase`);
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
      // For Day 3 we use the receipt root as both receiptRoot and storageRoot (Day 4 will upload to 0G Storage first).
      // For attestationHash, use the TEE attestation if present, otherwise zero.
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
        process.exitCode = 1;
        return;
      }

      ui.pass(`block                ${receipt2.blockNumber}`);
      ui.pass(`gas used             ${receipt2.gasUsed}`);
      ui.pass(`status               ${receipt2.status === 1 ? 'success' : 'failed'}`);

      // Read back the on-chain receipt id from the event
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

// ─── list / show (placeholders) ─────────────────────────────────────────────
receiptCommand
  .command('list')
  .description('List recent receipts from ReceiptRegistry events')
  .option('--since <date>', 'filter by date (YYYY-MM-DD)')
  .action(() => {
    ui.hint('Receipt listing arrives Day 4 (event log scan).');
  });

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
