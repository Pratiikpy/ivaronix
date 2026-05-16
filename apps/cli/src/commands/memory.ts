import { Command } from 'commander';
import { keccak256, toUtf8Bytes, Wallet, JsonRpcProvider } from 'ethers';
import { resolve, dirname } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import {
  CapabilityRegistryClient,
  MemoryAccessLogClient,
  AgentPassportClient,
  ReceiptRegistryV3Client,
  ReceiptRegistryV2Client,
  MEMORY_ACCESS,
  getDeployedAddress,
  type MemoryAccessType,
} from '@ivaronix/og-chain';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { MemoryEngine } from '@ivaronix/memory';
import { memoryStreamId, MEMORY_STREAM_NAMESPACE, createStorageClient } from '@ivaronix/og-storage';
import { NETWORKS, sha256HexAsync, type Address, type Hash } from '@ivaronix/core';
import { writeFileSync } from 'node:fs';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';
import { confirmAction } from '../lib/confirm.js';

/** Parse a TTL like "7d" / "12h" / "300" into seconds. */
function parseTtlSeconds(input: string): number {
  const m = input.match(/^(\d+)([smhd])?$/);
  if (!m) throw new Error(`invalid TTL: ${input} (use "7d", "12h", "30m", "60s", or raw seconds)`);
  const n = Number(m[1]);
  const unit = m[2];
  switch (unit) {
    case 's':
      return n;
    case 'm':
      return n * 60;
    case 'h':
      return n * 3600;
    case 'd':
      return n * 86400;
    default:
      return n; // raw seconds
  }
}

function scopeHash(scope: string): Hash {
  return keccak256(toUtf8Bytes(`namespace:${scope}`)) as Hash;
}

/**
 * Resolve the memory SQLite path. Anchors on the workspace root (parent of
 * pnpm-workspace.yaml) so a single canonical db is shared by every surface
 * — CLI, MCP server, og-toolkit consumers. Without this, the CLI invoked
 * from apps/cli/ wrote to apps/cli/.ivaronix/memory/, and the MCP server
 * couldn't see those observations from its own cwd. Falls back to cwd
 * when invoked outside the workspace.
 */
function memoryDbPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'memory', 'ivaronix.db');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.ivaronix', 'memory', 'ivaronix.db');
}

/** Build a configured MemoryEngine. */
function buildEngine(): MemoryEngine | null {
  const env = loadEnv();
  if (!env.privateKey || !env.walletAddress) {
    ui.fail('Memory engine requires IVARONIX_SIGNER_KEY + IVARONIX_WALLET_ADDRESS in .env (legacy aliases EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS still resolve)');
    return null;
  }
  const dbPath = memoryDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  // V2-first per og-chain.md rules · same pattern used in grant/revoke/list/log-emit.
  const capAddrV2 = getDeployedAddress(env.network, 'CapabilityRegistryV2');
  const capAddrV1 = getDeployedAddress(env.network, 'CapabilityRegistry');
  const capAddr = capAddrV2 ?? capAddrV1;
  const logAddrV2 = getDeployedAddress(env.network, 'MemoryAccessLogV2');
  const logAddrV1 = getDeployedAddress(env.network, 'MemoryAccessLog');
  const logAddr = logAddrV2 ?? logAddrV1;

  return MemoryEngine.create({
    ownerWallet: env.walletAddress as Address,
    ownerPrivateKey: env.privateKey,
    dbPath,
    enableOnChainPermissions: Boolean(capAddr && logAddr),
    capabilityRegistryAddress: (capAddr ?? undefined) as Address | undefined,
    memoryAccessLogAddress: (logAddr ?? undefined) as Address | undefined,
    rpcUrl: env.rpcUrl,
    chainId: env.chainId,
  });
}

export const memoryCommand = new Command('memory')
  .description('Hybrid memory engine + on-chain permissions (CapabilityRegistry + MemoryAccessLog)');

// ─── remember ────────────────────────────────────────────────────────────────
memoryCommand
  .command('remember <text>')
  .description('Store an observation in your hybrid memory (vector + FTS + temporal)')
  .option('--tags <list>', 'comma-separated tags/scopes (e.g. work,finance)', 'general')
  .option('--source <name>', 'provenance source label', 'manual')
  .option('--receipt <id>', 'associate this observation with a receipt id')
  .option('--no-log', 'skip on-chain MemoryAccessLog emission')
  .action(async (text: string, opts: { tags: string; source: string; receipt?: string; log: boolean }) => {
    const engine = buildEngine();
    if (!engine) {
      process.exitCode = 1;
      return;
    }

    const tags = opts.tags.split(',').map((t) => t.trim()).filter(Boolean);
    ui.title('Remembering observation');
    ui.info(`tags                 ${tags.join(', ')}`);
    ui.info(`source               ${opts.source}`);
    if (opts.receipt) ui.info(`parent receipt       ${opts.receipt}`);
    ui.info(`text length          ${text.length} chars`);
    ui.divider();

    try {
      const result = await engine.remember({
        text,
        tags,
        source: opts.source,
        parentReceiptId: opts.receipt,
      });
      ui.pass(`obs id               ${result.id}`);
      ui.pass(`memory rootHash      ${result.manifest.rootHash}`);
      ui.pass(`obs count            ${result.manifest.observationCount}`);
      ui.pass(`embed dim            ${result.manifest.embedding.dim} (${result.manifest.embedding.method})`);
      if (result.logTxHash) {
        ui.pass(`access log tx        ${result.logTxHash}`);
      }
      ui.divider();
      ui.banner(true, '→ REMEMBERED ✓');
    } catch (err) {
      ui.fail('remember failed', (err as Error).message);
      process.exitCode = 1;
    } finally {
      engine.close();
    }
  });

// ─── recall ──────────────────────────────────────────────────────────────────
memoryCommand
  .command('recall <query>')
  .description('Retrieve top-K observations matching the query (vector + FTS hybrid score)')
  .option('--tags <list>', 'comma-separated tags to restrict scope')
  .option('--top-k <n>', 'how many results to return', '5')
  .option('--from <ts>', 'unix-ms lower bound')
  .option('--to <ts>', 'unix-ms upper bound')
  .action(async (query: string, opts: { tags?: string; topK: string; from?: string; to?: string }) => {
    const engine = buildEngine();
    if (!engine) {
      process.exitCode = 1;
      return;
    }

    const tags = opts.tags ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    ui.title(`Recalling: "${query}"`);
    if (tags) ui.info(`tags                 ${tags.join(', ')}`);
    ui.info(`top-k                ${opts.topK}`);
    ui.divider();

    try {
      const { hits, logTxHash } = await engine.recall({
        text: query,
        tags,
        topK: Number(opts.topK),
        fromTime: opts.from ? Number(opts.from) : undefined,
        toTime: opts.to ? Number(opts.to) : undefined,
      });
      if (hits.length === 0) {
        ui.hint('(no matches)');
      } else {
        for (const [i, h] of hits.entries()) {
          ui.pass(`#${i + 1}  score ${h.score.toFixed(3)}  vec ${h.vectorScore.toFixed(3)}  fts ${h.ftsScore.toFixed(3)}  tags [${h.tags.join(', ')}]`);
          console.log(`     ${h.text.slice(0, 200)}${h.text.length > 200 ? '…' : ''}`);
        }
      }
      if (logTxHash) {
        ui.divider();
        ui.pass(`access log tx        ${logTxHash}`);
      }
      ui.divider();
      ui.banner(hits.length > 0, hits.length > 0 ? `→ RECALLED ${hits.length} ✓` : '→ NO MATCHES');
    } catch (err) {
      ui.fail('recall failed', (err as Error).message);
      process.exitCode = 1;
    } finally {
      engine.close();
    }
  });

// ─── stream-id ───────────────────────────────────────────────────────────────
// Per docs/PLAN_pass76.md S-2 — wallet-derived deterministic stream ID for the
// memory store. Same wallet → same ID anywhere, so memory is portable across
// machines without needing a server-side index. Defaults to the env wallet;
// pass an explicit address to inspect another wallet's slot.
memoryCommand
  .command('stream-id [address]')
  .description('Print the deterministic 0G KV stream-ID for a wallet\'s memory snapshots')
  .action((address?: string) => {
    const env = loadEnv();
    const target = address ?? env.walletAddress;
    if (!target) {
      ui.fail('No address. Pass one as argument or set IVARONIX_WALLET_ADDRESS in .env (legacy: EVM_WALLET_ADDRESS).');
      process.exitCode = 1;
      return;
    }
    let id: string;
    try {
      id = memoryStreamId(target);
    } catch (err) {
      ui.fail(`invalid address: ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }
    ui.title('Memory stream-ID');
    ui.info(`namespace            ${MEMORY_STREAM_NAMESPACE}`);
    ui.info(`address              ${target}`);
    ui.info(`stream-ID            ${id}`);
    ui.divider();
    ui.hint('Same address → same ID on any machine. Wired into snapshot/restore once S-1 (local KV) lands.');
  });

// ─── snapshot ────────────────────────────────────────────────────────────────
memoryCommand
  .command('snapshot')
  .description('Compute the current memory manifest (rootHash + observation count). Pass --upload to also persist the manifest JSON to 0G Storage. Pass --anchor-on-chain to also write the resulting storage rootHash into your AgentPassport.memoryRoot via updateMemoryRoot.')
  .option('--upload', 'persist manifest JSON to 0G Storage (requires IVARONIX_SIGNER_KEY in env)', false)
  .option('--anchor-on-chain', 'after --upload, call AgentPassportINFTV2.updateMemoryRoot(tokenId, storageRoot) so the chain canonically points at the latest snapshot. Burns ~0.0002 OG per update. Requires a minted passport for the signer wallet.', false)
  .action(async (opts: { upload: boolean; anchorOnChain: boolean }) => {
    // HALF_BAKED §I-12 + USER_TODO §B-V2-24 (both ✅ SHIPPED 2026-05-13):
    // pre-sweep this command only printed the manifest. With --upload it
    // writes a JSON blob to 0G Storage and prints the storage rootHash
    // + tx. With --anchor-on-chain it also resolves tokenId and calls
    // AgentPassportINFTV2.updateMemoryRoot so the passport.memoryRoot
    // field on chain canonically points at the latest storage manifest
    // — closing the full snapshot → storage → chain lifecycle.
    const engine = buildEngine();
    if (!engine) {
      process.exitCode = 1;
      return;
    }
    try {
      const m = engine.computeManifest();
      ui.title('Memory snapshot');
      ui.info(`owner                ${m.ownerWallet}`);
      ui.info(`observations         ${m.observationCount}`);
      ui.info(`rootHash             ${m.rootHash}`);
      ui.info(`lastWriteAt          ${m.lastWriteAt > 0 ? new Date(m.lastWriteAt).toISOString() : '(never)'}`);
      ui.info(`embedding            ${m.embedding.method} dim=${m.embedding.dim}`);

      if (!opts.upload) {
        ui.divider();
        ui.hint('Manifest stays local until --upload is passed. With --upload it writes a JSON blob to 0G Storage; pass --anchor-on-chain to also call AgentPassportINFTV2.updateMemoryRoot (USER_TODO §B-V2-24 · ✅ SHIPPED).');
        return;
      }

      const env = loadEnv();
      if (!env.privateKey) {
        ui.divider();
        ui.fail('--upload needs IVARONIX_SIGNER_KEY in env (legacy: OG_PRIVATE_KEY / EVM_PRIVATE_KEY).');
        process.exitCode = 1;
        return;
      }
      // Canonical JSON: stable key order so the same manifest bytes
      // produce the same Storage rootHash on a re-upload. The Storage
      // SDK keccak-merkles the bytes; key reordering would produce a
      // different blob hash for the same logical manifest.
      const json = JSON.stringify({
        ownerWallet: m.ownerWallet,
        observationCount: m.observationCount,
        rootHash: m.rootHash,
        lastWriteAt: m.lastWriteAt,
        embedding: { method: m.embedding.method, dim: m.embedding.dim },
      });
      const bytes = new TextEncoder().encode(json);
      try {
        const sc = createStorageClient({ network: env.network, privateKey: env.privateKey });
        ui.pending(`uploading manifest (${bytes.length} bytes) to 0G Storage...`);
        const sr = await sc.upload(bytes);
        ui.divider();
        ui.pass(`manifest on 0G Storage: ${sr.rootHash}`);
        ui.info(`upload tx            ${sr.txHash}`);
        ui.info(`bytes                ${sr.size}`);

        // B-V2-24 closure · optional on-chain anchor of the storage rootHash
        // into the AgentPassport's memoryRoot field.
        if (opts.anchorOnChain) {
          ui.divider();
          ui.pending('anchoring storage rootHash to AgentPassport.memoryRoot on-chain...');
          try {
            const netCfg = NETWORKS[env.network];
            const provider = new JsonRpcProvider(netCfg.rpcUrl, { chainId: netCfg.chainId, name: netCfg.name });
            const signer = new Wallet(env.privateKey, provider);
            // Prefer V2 (current active mint target). Fall back to V1 for any
            // wallets still on the legacy passport.
            const v2Addr = getDeployedAddress(env.network, 'AgentPassportINFTV2');
            const v1Addr = getDeployedAddress(env.network, 'AgentPassportINFT');
            const passportAddr = v2Addr ?? v1Addr;
            if (!passportAddr) {
              ui.fail(`no AgentPassportINFT address for network=${env.network}`);
              process.exitCode = 1;
              return;
            }
            // Read tokenId via the V1 client ABI (V2 keeps the same passportOf
            // mapping signature; both V1 and V2 return uint256).
            const passportRead = new AgentPassportClient(passportAddr, provider);
            const tokenId = await passportRead.passportOf(signer.address as Address);
            if (tokenId === 0n) {
              ui.fail(`wallet ${signer.address} has no AgentPassport · mint one first via \`ivaronix onboard\` or Studio /onboard`);
              process.exitCode = 1;
              return;
            }
            const passportWrite = new AgentPassportClient(passportAddr, signer);
            const tx = await passportWrite.updateMemoryRoot(tokenId, sr.rootHash as Hash);
            ui.info(`updateMemoryRoot tx  ${tx.hash}`);
            ui.pending('waiting for confirmation...');
            const receipt = await tx.wait();
            ui.pass(`anchored on chain · block ${receipt?.blockNumber} · gas ${receipt?.gasUsed.toString()}`);
            ui.info(`passport tokenId     ${tokenId.toString()}`);
            ui.info(`memoryRoot           ${sr.rootHash}`);
            ui.info(`registry             ${passportAddr} (${v2Addr ? 'V2' : 'V1 legacy'})`);

            // B-V2-35 slot 7 closure: anchor a passport_update receipt
            // (canonical slot 7) on V3 ReceiptRegistry so chain consumers
            // can find every passport.memoryRoot update by filtering
            // receiptType==7. The receipt body cites the updateMemoryRoot
            // tx as the underlying chain action.
            ui.divider();
            ui.pending('anchoring passport_update receipt (B-V2-35 slot 7)...');
            try {
              const receiptRegV3 = getDeployedAddress(env.network, 'ReceiptRegistryV3');
              const receiptRegV2 = getDeployedAddress(env.network, 'ReceiptRegistryV2');
              const writeAddr = (receiptRegV3 ?? receiptRegV2) as Address | null;
              const writeVersion: 'v2' | 'v3' = receiptRegV3 ? 'v3' : 'v2';
              if (!writeAddr) {
                ui.fail(`no ReceiptRegistry V3 or V2 on ${env.network} · skipping passport_update receipt`);
              } else {
                const updateTxHash = tx.hash as Hash;
                const userPromptHash = (await sha256HexAsync(new TextEncoder().encode(`passport.update.memoryRoot:${tokenId.toString()}:${sr.rootHash}`))) as Hash;
                const draft = buildReceipt({
                  type: 'passport_update',
                  agent: {
                    passportId: `did:0g:passport:${signer.address}:${tokenId.toString()}`,
                    ownerWallet: signer.address as Address,
                    trustScoreAtTime: 0,
                  },
                  request: {
                    skillId: 'passport.update',
                    skillVersion: '0.1.0',
                    skillManifestHash: userPromptHash,
                    userPromptHash,
                    inputArtifacts: [{ kind: 'memory', encrypted: false }],
                    policyDecision: 'approved',
                    approvalChain: [
                      { gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:self-update' },
                    ],
                  },
                  execution: {
                    mode: 'passport_update',
                    burnMode: false,
                    consensusMode: false,
                    modelSelection: { requested: 'none', final: 'none' },
                    providerRouting: {
                      allowFallbacks: false,
                      finalProvider: '0x0000000000000000000000000000000000000000' as Address,
                    },
                  },
                  teeVerification: {
                    requested: false,
                    routerVerified: false,
                    independentVerified: null,
                    verificationMethod: 'external-signed',
                    verifiedAt: null,
                  },
                  routerTrace: {
                    requestId: `passport.update:${tokenId.toString()}:${Date.now()}`,
                    x0gTrace: {},
                    rateLimit: {},
                    rotations: [],
                  },
                  billing: {
                    inputTokens: 0,
                    outputTokens: 0,
                    inputCostNeuron: '0',
                    outputCostNeuron: '0',
                    totalCostNeuron: '0',
                    totalCostOg: '0.0000000000',
                  },
                  chainAnchor: defaultChainAnchor(env.network as 'testnet' | 'mainnet', writeAddr),
                  storage: {
                    evidenceRoot: sr.rootHash as Hash,
                    proofDownloadVerified: false,
                    encryption: { enabled: false, type: 'none', headerDetected: false },
                  },
                  outputs: {
                    outputHash: userPromptHash,
                    citations: [userPromptHash], // sha256:<64-hex> · ties back to the tokenId+storageRoot tuple cited in updateMemoryRoot
                    riskLevel: 'low',
                    wording: {
                      headline: `Passport ${tokenId.toString()} memoryRoot updated to ${sr.rootHash.slice(0, 10)}...`,
                      doNotSay: ['truth score', 'verified by AI'],
                    },
                  },
                  createdBy: 'ivaronix-runtime/0.0.1',
                });
                const signed = await signReceipt(draft, signer);

                // Persist locally first (so the file exists even if anchor fails).
                const outDir = resolve('.ivaronix', 'receipts', 'anchored');
                if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
                const localPath = resolve(outDir, `${signed.id}.json`);
                writeFileSync(localPath, JSON.stringify(signed, null, 2));

                const regClient =
                  writeVersion === 'v3'
                    ? new ReceiptRegistryV3Client(writeAddr, signer)
                    : new ReceiptRegistryV2Client(writeAddr, signer);
                const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hash;
                const RECEIPT_TYPE_CODE = 7; // canonical slot 7 passport_update
                const { tx: anchorTx } = await regClient.signAndAnchor(signer, {
                  receiptRoot: signed.storage.receiptRoot as Hash,
                  storageRoot: sr.rootHash as Hash,
                  attestationHash: ZERO_HASH,
                  receiptType: RECEIPT_TYPE_CODE,
                });
                const anchorReceipt = await anchorTx.wait();
                const onChainId = (await regClient.nextId()) - 1n;
                ui.pass(`receipt              ${signed.id}`);
                ui.info(`anchor tx            ${anchorTx.hash} (${writeVersion.toUpperCase()})`);
                ui.info(`anchor block         ${anchorReceipt?.blockNumber}`);
                ui.info(`on-chain id          ${onChainId.toString()}`);
                ui.info(`receipt type         passport_update (canonical slot 7)`);
              }
            } catch (err) {
              ui.fail('passport_update receipt anchor failed', (err as Error).message.split('\n')[0]);
              // Don't fail the whole command — the updateMemoryRoot tx already succeeded.
            }
          } catch (err) {
            ui.fail('on-chain anchor failed', (err as Error).message.split('\n')[0]);
            process.exitCode = 1;
          }
        } else {
          ui.divider();
          ui.hint(`Storage blob is content-addressed; anyone with the rootHash can re-fetch the manifest JSON. Pass --anchor-on-chain to also write the rootHash into AgentPassport.memoryRoot (~0.0002 OG · B-V2-24).`);
        }
      } catch (err) {
        ui.divider();
        ui.fail('manifest upload failed', (err as Error).message.split('\n')[0]);
        process.exitCode = 1;
      }
    } finally {
      engine.close();
    }
  });

// ─── forget ──────────────────────────────────────────────────────────────────
memoryCommand
  .command('forget <id>')
  .description('Permanently delete an observation by id. Confirms interactively unless --yes is passed.')
  .option('-y, --yes', 'skip interactive confirmation (CI / scripted use)', false)
  .action(async (id: string, opts: { yes: boolean }) => {
    // HALF_BAKED §I-19 closure (sweep 170): forget is destructive both
    // locally (note removed from the SQLite store) and on-chain (the
    // MemoryAccessLog anchor records the forget event with gas). A
    // mistyped id with no confirm spends gas to log a forget for an
    // observation that didn't need forgetting.
    if (!opts.yes) {
      const proceed = await confirmAction(
        `This will permanently delete memory observation "${id}" and anchor a forget event on chain. Proceed?`,
      );
      if (!proceed) {
        ui.info('aborted (nothing deleted)');
        return;
      }
    }
    const engine = buildEngine();
    if (!engine) {
      process.exitCode = 1;
      return;
    }
    try {
      const r = await engine.forget(id);
      ui.pass(`forgot               ${id}`);
      if (r.logTxHash) ui.pass(`access log tx        ${r.logTxHash}`);
    } catch (err) {
      ui.fail('forget failed', (err as Error).message);
      process.exitCode = 1;
    } finally {
      engine.close();
    }
  });

// ─── grant ───────────────────────────────────────────────────────────────────
memoryCommand
  .command('grant <grantee>')
  .description('Issue a memory-access grant to another wallet/agent (CapabilityRegistry)')
  .option('--scope <name>', 'memory scope/namespace', 'project')
  .option('--ttl <duration>', 'TTL like "7d", "12h", "0" (no expiry)', '7d')
  .option('--reads <count>', 'cap on reads (default: unlimited)', '0xFFFFFFFF')
  .action(async (grantee: string, opts: { scope: string; ttl: string; reads: string }) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No private key in .env');
      process.exitCode = 1;
      return;
    }
    // V2-first WRITE per iter-122. V2 closes the social-graph leak (B-V2-15
    // / WT 12): V1's `grantsByOwner[]` mapping had a public auto-generated
    // getter that let any attacker enumerate every grant ever issued to/from
    // any wallet. V2 makes the reverse indexes internal + gated via
    // `getGrantsByOwner` (access-controlled). New grants MUST issue on V2;
    // V1 stays live for legacy grants only. issueGrant signature is identical
    // in V1 and V2 — same client works against both addresses.
    const capAddrV2 = getDeployedAddress(env.network, 'CapabilityRegistryV2');
    const capAddrV1 = getDeployedAddress(env.network, 'CapabilityRegistry');
    const capAddr = capAddrV2 ?? capAddrV1;
    const capVersion: 'v1' | 'v2' = capAddrV2 ? 'v2' : 'v1';
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const cap = new CapabilityRegistryClient(capAddr, wallet);

    const ttlSec = parseTtlSeconds(opts.ttl);
    const reads = opts.reads.toLowerCase().startsWith('0x')
      ? parseInt(opts.reads, 16)
      : Number(opts.reads);
    const sh = scopeHash(opts.scope);

    ui.title('Issuing memory grant');
    ui.info(`network              ${env.network}`);
    ui.info(`registry             ${capAddr} (${capVersion.toUpperCase()})`);
    ui.info(`grantee              ${grantee}`);
    ui.info(`scope                ${opts.scope}  (${sh})`);
    ui.info(`ttl                  ${ttlSec === 0 ? 'no expiry' : `${ttlSec}s`}`);
    ui.info(`reads cap            ${reads === 0xffffffff ? 'unlimited' : reads}`);
    ui.divider();

    ui.pending('submitting grant tx...');
    const tx = await cap.issueGrant(grantee as Address, sh, ttlSec, reads);
    ui.info(`tx hash              ${tx.hash}`);
    const grantId = await cap.grantIdFromTx(tx);
    if (!grantId) {
      ui.fail('Could not extract grantId from event log');
      process.exitCode = 1;
      return;
    }
    ui.pass(`grantId              ${grantId}`);
    ui.divider();

    // B-V2-35 slot 4 closure: anchor a memory_access receipt (canonical
    // slot 4) on V3 ReceiptRegistry. Chain consumers can now filter
    // receiptType==4 to find every memory-grant event. The receipt body
    // cites the CapabilityRegistry grant tx as the underlying chain action.
    ui.pending('anchoring memory_access receipt (B-V2-35 slot 4)...');
    try {
      const receiptRegV3 = getDeployedAddress(env.network, 'ReceiptRegistryV3');
      const receiptRegV2 = getDeployedAddress(env.network, 'ReceiptRegistryV2');
      const writeAddr = (receiptRegV3 ?? receiptRegV2) as Address | null;
      const writeVersion: 'v2' | 'v3' = receiptRegV3 ? 'v3' : 'v2';
      if (!writeAddr) {
        ui.fail(`no ReceiptRegistry V3 or V2 on ${env.network} · skipping memory_access receipt`);
      } else {
        const userPromptHash = (await sha256HexAsync(
          new TextEncoder().encode(`memory.grant:${grantee}:${opts.scope}:${grantId}`),
        )) as Hash;
        const draft = buildReceipt({
          type: 'memory_access',
          agent: {
            passportId: `did:0g:passport:${wallet.address}:1`,
            ownerWallet: wallet.address as Address,
            trustScoreAtTime: 0,
          },
          request: {
            skillId: 'memory.grant',
            skillVersion: '0.1.0',
            skillManifestHash: userPromptHash,
            userPromptHash,
            inputArtifacts: [{ kind: 'memory', encrypted: false }],
            policyDecision: 'approved',
            approvalChain: [
              { gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:self-grant-allowed' },
            ],
          },
          execution: {
            mode: 'memory_access',
            burnMode: false,
            consensusMode: false,
            modelSelection: { requested: 'none', final: 'none' },
            providerRouting: {
              allowFallbacks: false,
              finalProvider: '0x0000000000000000000000000000000000000000' as Address,
            },
          },
          teeVerification: {
            requested: false,
            routerVerified: false,
            independentVerified: null,
            verificationMethod: 'external-signed',
            verifiedAt: null,
          },
          routerTrace: {
            requestId: `memory.grant:${grantId}:${Date.now()}`,
            x0gTrace: {},
            rateLimit: {},
            rotations: [],
          },
          billing: {
            inputTokens: 0,
            outputTokens: 0,
            inputCostNeuron: '0',
            outputCostNeuron: '0',
            totalCostNeuron: '0',
            totalCostOg: '0.0000000000',
          },
          chainAnchor: defaultChainAnchor(env.network as 'testnet' | 'mainnet', writeAddr),
          storage: {
            evidenceRoot: sh,
            proofDownloadVerified: false,
            encryption: { enabled: false, type: 'none', headerDetected: false },
          },
          outputs: {
            outputHash: userPromptHash,
            citations: [userPromptHash],
            riskLevel: 'low',
            wording: {
              headline: `Memory grant issued · ${grantee.slice(0, 10)}... scope=${opts.scope}`,
              doNotSay: ['truth score', 'verified by AI'],
            },
          },
          createdBy: 'ivaronix-runtime/0.0.1',
        });
        const signed = await signReceipt(draft, wallet);

        const outDir = resolve('.ivaronix', 'receipts', 'anchored');
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
        writeFileSync(resolve(outDir, `${signed.id}.json`), JSON.stringify(signed, null, 2));

        const regClient =
          writeVersion === 'v3'
            ? new ReceiptRegistryV3Client(writeAddr, wallet)
            : new ReceiptRegistryV2Client(writeAddr, wallet);
        const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hash;
        const RECEIPT_TYPE_CODE = 4; // canonical slot 4 memory_access
        const { tx: anchorTx } = await regClient.signAndAnchor(wallet, {
          receiptRoot: signed.storage.receiptRoot as Hash,
          storageRoot: sh,
          attestationHash: ZERO_HASH,
          receiptType: RECEIPT_TYPE_CODE,
        });
        const anchorReceipt = await anchorTx.wait();
        const onChainId = (await regClient.nextId()) - 1n;
        ui.pass(`receipt              ${signed.id}`);
        ui.info(`anchor tx            ${anchorTx.hash} (${writeVersion.toUpperCase()})`);
        ui.info(`anchor block         ${anchorReceipt?.blockNumber}`);
        ui.info(`on-chain id          ${onChainId.toString()}`);
        ui.info(`receipt type         memory_access (canonical slot 4)`);
      }
    } catch (err) {
      ui.fail('memory_access receipt anchor failed', (err as Error).message.split('\n')[0]);
      // Don't fail the whole command — the grant tx is already on chain.
    }

    ui.divider();
    ui.banner(true, '→ GRANT ISSUED ✓');
    ui.hint(`Revoke: ivaronix memory revoke ${grantId}`);
    ui.hint(`Explorer: ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
  });

// ─── revoke ──────────────────────────────────────────────────────────────────
memoryCommand
  .command('revoke <grantId>')
  .description('Revoke a memory-access grant')
  .action(async (grantId: string) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No private key in .env');
      process.exitCode = 1;
      return;
    }
    // V2-first per og-chain.md rules · matches grant's address resolution above.
    const capAddrV2 = getDeployedAddress(env.network, 'CapabilityRegistryV2');
    const capAddrV1 = getDeployedAddress(env.network, 'CapabilityRegistry');
    const capAddr = capAddrV2 ?? capAddrV1;
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const cap = new CapabilityRegistryClient(capAddr, wallet);

    ui.title('Revoking grant');
    ui.info(`grantId              ${grantId}`);
    ui.pending('submitting revoke tx...');
    const tx = await cap.revokeGrant(grantId as Hash);
    const r = await tx.wait();
    if (!r) {
      ui.fail('revoke tx did not return a receipt');
      return;
    }
    ui.pass(`block                ${r.blockNumber}`);
    ui.banner(true, '→ GRANT REVOKED ✓');
  });

// ─── list ────────────────────────────────────────────────────────────────────
memoryCommand
  .command('list')
  .description('List grants you issued (or filter by --grantee or --by <wallet>)')
  .option('--by <address>', 'list grants issued by this address (default: your wallet)')
  .option('--to <address>', 'list grants issued TO this address (instead of by-owner)')
  .action(async (opts: { by?: string; to?: string }) => {
    const env = loadEnv();
    // V2-first per og-chain.md rules · matches grant's address resolution.
    const capAddrV2 = getDeployedAddress(env.network, 'CapabilityRegistryV2');
    const capAddrV1 = getDeployedAddress(env.network, 'CapabilityRegistry');
    const capAddr = capAddrV2 ?? capAddrV1;
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const cap = new CapabilityRegistryClient(capAddr, provider);

    const target = (opts.to ?? opts.by ?? env.walletAddress) as Address | undefined;
    if (!target) {
      ui.fail('No target wallet — pass --by/--to or set IVARONIX_WALLET_ADDRESS (legacy: EVM_WALLET_ADDRESS)');
      process.exitCode = 1;
      return;
    }

    // Pass callerWallet so the V2 client path can use listMyOwnerGrants /
    // listMyGranteeGrants when the target matches the operator's wallet.
    // V2 added a privacy gate on the by-address reverse-indexes; the self-read
    // method skips that gate when caller == target, which is the common case.
    const ids = opts.to
      ? await cap.listGrantsByGrantee(target, env.walletAddress as Address | undefined)
      : await cap.listGrantsByOwner(target, env.walletAddress as Address | undefined);

    ui.title(opts.to ? `Grants issued TO ${target}` : `Grants issued BY ${target}`);
    if (ids.length === 0) {
      ui.hint('(none)');
      return;
    }

    ui.divider();
    for (const id of ids) {
      const g = await cap.getGrant(id);
      if (!g) continue;
      const expiresLabel =
        g.expiresAt === 0n ? 'no expiry' : new Date(Number(g.expiresAt) * 1000).toISOString();
      const status = g.revoked
        ? 'REVOKED'
        : g.expiresAt !== 0n && BigInt(Math.floor(Date.now() / 1000)) > g.expiresAt
          ? 'EXPIRED'
          : 'ACTIVE';
      const reads = g.readsRemaining === BigInt(0xffffffff) ? '∞' : g.readsRemaining.toString();
      const tag = status === 'ACTIVE' ? ui.pass : ui.fail;
      tag(`${id.slice(0, 18)}…  ${status.padEnd(8)} grantee ${g.grantee.slice(0, 10)}…  reads ${reads}  expires ${expiresLabel}`);
    }
    ui.divider();
  });

// ─── log ─────────────────────────────────────────────────────────────────────
memoryCommand
  .command('log')
  .description('Show MemoryAccessLog events for a wallet')
  .option('--agent <address>', 'agent to look up (default: your wallet)')
  .option('--lookback <blocks>', 'how far back to scan (default 50000)', '50000')
  .action(async (opts: { agent?: string; lookback: string }) => {
    const env = loadEnv();
    // V2-first read per iter-124 (B-V2-16 log-spoofing fix). V2 events have
    // identical shape to V1, so the same client decodes both. Merge results
    // across V1 + V2 for a complete audit trail; V1 stays live for historical
    // events anchored before V2 deploy.
    const logAddrV2 = getDeployedAddress(env.network, 'MemoryAccessLogV2');
    const logAddrV1 = getDeployedAddress(env.network, 'MemoryAccessLog');
    if (!logAddrV2 && !logAddrV1) {
      ui.fail(`MemoryAccessLog not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });

    const target = (opts.agent ?? env.walletAddress) as Address | undefined;
    if (!target) {
      ui.fail('No target agent — pass --agent or set IVARONIX_WALLET_ADDRESS (legacy: EVM_WALLET_ADDRESS)');
      process.exitCode = 1;
      return;
    }

    ui.title(`Memory access log for ${target}`);
    ui.divider();
    const lookback = Number(opts.lookback);
    type EventRow = Awaited<ReturnType<MemoryAccessLogClient['listForAgent']>>[number] & { source: 'v1' | 'v2' };
    const events: EventRow[] = [];
    if (logAddrV2) {
      try {
        const logV2 = new MemoryAccessLogClient(logAddrV2, provider);
        const v2Events = await logV2.listForAgent(target, lookback);
        for (const ev of v2Events) events.push({ ...ev, source: 'v2' });
      } catch (err) {
        ui.info(`V2 scan skipped (${(err as Error).message.split('\n')[0]})`);
      }
    }
    if (logAddrV1) {
      try {
        const logV1 = new MemoryAccessLogClient(logAddrV1, provider);
        const v1Events = await logV1.listForAgent(target, lookback);
        for (const ev of v1Events) events.push({ ...ev, source: 'v1' });
      } catch (err) {
        ui.info(`V1 scan skipped (${(err as Error).message.split('\n')[0]})`);
      }
    }
    events.sort((a, b) => Number(b.timestamp - a.timestamp));
    if (events.length === 0) {
      ui.hint('(no events found)');
      return;
    }
    const typeLabels: Record<number, string> = {
      [MEMORY_ACCESS.READ]: 'READ',
      [MEMORY_ACCESS.WRITE]: 'WRITE',
      [MEMORY_ACCESS.DELETE]: 'DELETE',
      [MEMORY_ACCESS.GRANT_USED]: 'GRANT_USED',
    };
    for (const ev of events) {
      const ts = new Date(Number(ev.timestamp) * 1000).toISOString();
      const tag = ev.source === 'v2' ? 'V2' : 'V1';
      ui.info(`[${ts}] ${tag} ${typeLabels[ev.accessType] ?? ev.accessType}  grant ${ev.grantId.slice(0, 14)}…  memRoot ${ev.memoryRoot.slice(0, 14)}…  block ${ev.blockNumber}`);
    }
    ui.divider();
    ui.pass(`${events.length} events`);
  });

// ─── log:emit (manual demo) ─────────────────────────────────────────────────
memoryCommand
  .command('log-emit')
  .description('Manually emit a MemoryAccessLog event (for demo/testing)')
  .option('--agent <address>', 'agent address (defaults to your wallet)')
  .option('--grant <hash>', 'grantId (or 0x0 for self-access)', '0x' + '0'.repeat(64))
  .option('--root <hash>', 'memory root hash (or 0x0)', '0x' + '0'.repeat(64))
  .option('--type <type>', 'read | write | delete | grant_used', 'read')
  .option('--scope <name>', 'scope name', 'project')
  .action(async (opts: { agent?: string; grant: string; root: string; type: string; scope: string }) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No private key');
      process.exitCode = 1;
      return;
    }
    // V2-first per og-chain.md rules · matches `memory log` read pattern at lines 782-783.
    const logAddrV2 = getDeployedAddress(env.network, 'MemoryAccessLogV2');
    const logAddrV1 = getDeployedAddress(env.network, 'MemoryAccessLog');
    const logAddr = logAddrV2 ?? logAddrV1;
    if (!logAddr) {
      ui.fail(`MemoryAccessLog not deployed`);
      process.exitCode = 1;
      return;
    }

    const typeMap: Record<string, MemoryAccessType> = {
      read: MEMORY_ACCESS.READ,
      write: MEMORY_ACCESS.WRITE,
      delete: MEMORY_ACCESS.DELETE,
      grant_used: MEMORY_ACCESS.GRANT_USED,
    };
    const accessType = typeMap[opts.type.toLowerCase()];
    if (accessType === undefined) {
      ui.fail(`Bad --type ${opts.type}; use read/write/delete/grant_used`);
      process.exitCode = 1;
      return;
    }

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const accessLog = new MemoryAccessLogClient(logAddr, wallet);

    const agent = (opts.agent ?? wallet.address) as Address;
    ui.pending('emitting log event...');
    const tx = await accessLog.logAccess(
      agent,
      opts.grant as Hash,
      opts.root as Hash,
      accessType,
      scopeHash(opts.scope),
    );
    const r = await tx.wait();
    ui.pass(`tx ${tx.hash} block ${r?.blockNumber ?? '?'}`);
  });
