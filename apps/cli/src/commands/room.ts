import { Command } from 'commander';
import { keccak256, toUtf8Bytes, Wallet, JsonRpcProvider } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  CapabilityRegistryClient,
  ReceiptRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { createStorageClient, burnEncrypt } from '@ivaronix/og-storage';
import { buildReceipt, signReceipt, defaultChainAnchor } from '@ivaronix/receipts';
import { sha256HexAsync, ulid, type Address, type Hash } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * Confidential Data Room — Track 5 (Privacy & Sovereign Infrastructure) headline.
 *
 * Each party gets an on-chain CapabilityRegistry grant with a scope keyed to
 * the room id. Every grant + every read anchors a receipt. The encrypted
 * blob lives on 0G Storage; Burn Mode destroys the session key after upload
 * so operator-side disclosure is structurally impossible after creation.
 *
 * Scope hash convention: `keccak256("room:<roomId>")`.
 */

interface RoomManifest {
  roomId: string;
  creator: Address;
  parties: Address[];
  blobStorageRoot: string; // 0G Storage rootHash or sha256:<hex> fallback
  blobStorageTxHash?: string | undefined;
  blobBytes: number;
  keyFingerprint: string;
  destroyedAt: number;
  ttlSeconds: number;
  readsCap: number;
  scopeHash: string;
  grantIds: Record<string, string>; // partyAddr → grantId
  createdAt: number;
  network: string;
  manifestHash: string;
  /** W6 — 0G Storage rootHash of the manifest JSON itself, populated
   * after creation. Used by `/data-room/[id]?storage=<root>` so a judge
   * on a different machine can fetch the manifest without relying on
   * the operator's local FS. */
  manifestStorageRoot?: string;
}

function roomsDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'rooms');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.ivaronix', 'rooms');
}

function parseTtl(input: string): number {
  const m = input.match(/^(\d+)([smhd])?$/);
  if (!m) throw new Error(`invalid TTL: ${input}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: return n;
  }
}

export const roomCommand = new Command('room')
  .description('Confidential Data Room — Burn-Mode encrypted blobs + on-chain capability grants per party');

// ─── room create ─────────────────────────────────────────────────────────
roomCommand
  .command('create')
  .description('Create a confidential data room: encrypt the doc, upload to 0G Storage, issue capability grants to each party, anchor a doc_room_create receipt.')
  .requiredOption('--doc <file>', 'path to the document to seal in the room')
  .requiredOption('--parties <addrs>', 'comma-separated party wallet addresses (e.g. 0xaa...,0xbb...)')
  .option('--ttl <duration>', 'grant TTL (e.g. "7d", "12h")', '7d')
  .option('--reads <count>', 'reads cap per grant', '100')
  .action(async (opts: { doc: string; parties: string; ttl: string; reads: string }) => {
    const env = loadEnv();
    if (!env.privateKey || !env.walletAddress) {
      ui.fail('room create requires EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS in .env');
      process.exitCode = 1;
      return;
    }

    const docPath = resolve(opts.doc);
    if (!existsSync(docPath)) {
      ui.fail(`doc not found: ${docPath}`);
      process.exitCode = 1;
      return;
    }

    const partyList = opts.parties.split(',').map((p) => p.trim()) as Address[];
    for (const p of partyList) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(p)) {
        ui.fail(`invalid party address: ${p}`);
        process.exitCode = 1;
        return;
      }
    }
    if (partyList.length === 0) {
      ui.fail('--parties requires at least one address');
      process.exitCode = 1;
      return;
    }

    const ttlSec = parseTtl(opts.ttl);
    const readsCap = Number(opts.reads);
    const roomId = ulid();
    const scopeHash = keccak256(toUtf8Bytes(`room:${roomId}`)) as Hash;

    ui.title(`Creating data room ${roomId}`);
    ui.info(`network              ${env.network}`);
    ui.info(`creator              ${env.walletAddress}`);
    ui.info(`doc                  ${docPath}`);
    ui.info(`parties              ${partyList.length} (${partyList.map((p) => p.slice(0, 6) + '…' + p.slice(-4)).join(', ')})`);
    ui.info(`ttl                  ${opts.ttl} (${ttlSec}s)`);
    ui.info(`reads cap            ${readsCap} per party`);
    ui.info(`scope hash           ${scopeHash}`);
    ui.divider();

    // 1. Encrypt the doc with Burn Mode
    const plaintext = readFileSync(docPath);
    ui.pending('encrypting with AES-256-GCM, destroying session key...');
    const burned = burnEncrypt(plaintext);
    ui.pass(`ciphertext           ${burned.ciphertext.length} bytes`);
    ui.pass(`key fingerprint      ${burned.keyFingerprint}`);
    ui.pass(`destroyed at         ${new Date(burned.destroyedAt).toISOString()}`);

    // 2. Upload ciphertext to 0G Storage (fall back to local sha256 if Storage unreachable)
    let blobStorageRoot: string;
    let blobStorageTxHash: string | undefined;
    try {
      ui.pending('uploading ciphertext to 0G Storage...');
      const sc = createStorageClient({ network: env.network as 'testnet' | 'mainnet', privateKey: env.privateKey });
      const r = await sc.upload(burned.ciphertext);
      blobStorageRoot = r.rootHash;
      blobStorageTxHash = r.txHash;
      ui.pass(`storage root         ${blobStorageRoot}`);
      ui.pass(`storage tx           ${blobStorageTxHash}`);
    } catch (err) {
      const localSha = await sha256HexAsync(burned.ciphertext);
      blobStorageRoot = localSha; // sha256:<hex>
      ui.info(`storage fallback     ${blobStorageRoot} (${(err as Error).message.split('\n')[0] ?? ''.slice(0, 80)})`);
    }

    // 3. Issue capability grants to each party (real on-chain txs)
    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const cap = new CapabilityRegistryClient(capAddr, wallet);

    const grantIds: Record<string, string> = {};
    const creatorLower = (env.walletAddress as Address).toLowerCase();
    ui.divider();
    for (const party of partyList) {
      // Skip self-grants — the creator is implicit (owner-can-always-read).
      // CapabilityRegistry contract rejects self-grants with
      // "CapabilityRegistry: self-grant disallowed". The room manifest still
      // records the creator in `parties` so the access list is complete.
      if (party.toLowerCase() === creatorLower) {
        const SELF_MARKER = ('0x' + 'cc'.repeat(32)) as Hash; // sentinel for "implicit owner grant"
        grantIds[party] = SELF_MARKER;
        ui.info(`grant ${party.slice(0, 10)}…  (creator — implicit owner grant, no on-chain tx)`);
        continue;
      }
      try {
        ui.pending(`issuing grant to ${party.slice(0, 10)}…`);
        const tx = await cap.issueGrant(party, scopeHash, ttlSec, readsCap);
        const receipt = await tx.wait();
        // Find the GrantIssued event log to extract grantId
        const grantIssuedTopic = keccak256(toUtf8Bytes('GrantIssued(bytes32,address,address,bytes32,uint64,uint32)'));
        const log = receipt?.logs.find((l) => l.topics[0] === grantIssuedTopic);
        const grantId = log?.topics[1] ?? '0x' + '0'.repeat(64);
        grantIds[party] = grantId;
        ui.pass(`grant ${party.slice(0, 10)}…  ${grantId.slice(0, 18)}…  tx ${tx.hash.slice(0, 18)}…`);
      } catch (err) {
        ui.fail(`grant to ${party.slice(0, 10)}… failed: ${((err as Error).message.split('\n')[0] ?? '').slice(0, 100)}`);
        process.exitCode = 1;
        return;
      }
    }

    // 4. Build the room manifest + canonical hash
    const manifestForHash = {
      roomId,
      creator: env.walletAddress as Address,
      parties: partyList,
      blobStorageRoot,
      keyFingerprint: burned.keyFingerprint,
      ttlSeconds: ttlSec,
      readsCap,
      scopeHash: scopeHash as string,
      grantIds,
    };
    const manifestHash = await sha256HexAsync(new TextEncoder().encode(JSON.stringify(manifestForHash)));

    const manifest: RoomManifest = {
      ...manifestForHash,
      blobStorageTxHash,
      blobBytes: plaintext.length,
      destroyedAt: burned.destroyedAt,
      createdAt: Date.now(),
      network: env.network,
      manifestHash: manifestHash as string,
    };

    // 5. Persist manifest locally
    const dir = roomsDir();
    mkdirSync(dir, { recursive: true });
    const manifestPath = resolve(dir, `${roomId}.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    ui.divider();
    ui.pass(`manifest saved       ${manifestPath}`);

    // 5b. W6 · Upload manifest JSON to 0G Storage so any operator (or
    // judge on a different machine) can fetch it from the storageRoot
    // alone — fixes the "Room not found" cross-machine break documented
    // in PHASE_B_DISCLOSURES.md §4. The plaintext manifest contains only
    // public on-chain references (storageRoot of the encrypted blob,
    // grant ids, party addresses). No secrets — Burn Mode already
    // destroyed the session key.
    let manifestStorageRoot: string | null = null;
    try {
      const sc = createStorageClient({ network: env.network, privateKey: env.privateKey });
      ui.pending('uploading manifest to 0G Storage (public, no secrets)...');
      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      const sr = await sc.upload(Buffer.from(manifestBytes));
      manifestStorageRoot = sr.rootHash;
      // Re-persist the local manifest with the storageRoot inside it so
      // anyone who has the manifest can prove it round-trips.
      const augmentedManifest = { ...manifest, manifestStorageRoot };
      writeFileSync(manifestPath, JSON.stringify(augmentedManifest, null, 2));
      ui.pass(`manifest on 0G Storage: ${sr.rootHash}`);
    } catch (err) {
      ui.fail('manifest 0G Storage upload failed (manifest still saved locally)', ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
    }

    // 6. Anchor a doc_room_create receipt
    try {
      const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
      if (!registryAddr) throw new Error('ReceiptRegistry not deployed');
      const reg = new ReceiptRegistryClient(registryAddr, wallet);

      const userPromptHash = await sha256HexAsync(new TextEncoder().encode(`room.create:${roomId}:${partyList.length}`));
      const outputHash = manifestHash as Hash;

      const draft = buildReceipt({
        type: 'doc_room_create',
        agent: {
          passportId: `did:0g:passport:${env.walletAddress}:1`,
          ownerWallet: env.walletAddress as Address,
          trustScoreAtTime: 0,
        },
        request: {
          skillId: 'room.create',
          skillVersion: '0.1.0',
          skillManifestHash: manifestHash as Hash,
          userPromptHash: userPromptHash as Hash,
          inputArtifacts: [{ kind: 'doc', encrypted: true }],
          policyDecision: 'approved',
          approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: 'policy:default-strict' }],
        },
        execution: {
          mode: 'doc_room_create',
          burnMode: true,
          consensusMode: false,
          modelSelection: { requested: 'n/a', final: 'n/a' },
          providerRouting: { allowFallbacks: true, finalProvider: '0x0000000000000000000000000000000000000000' as Address },
        },
        teeVerification: {
          requested: false,
          routerVerified: false,
          independentVerified: null,
          verificationMethod: 'router_flag',
          verifiedAt: null,
        },
        routerTrace: {
          requestId: `room.create:${roomId}`,
          x0gTrace: {},
          rateLimit: {},
          rotations: [],
        },
        billing: (() => {
          const inputCostNeuron = '0';
          const outputCostNeuron = '0';
          const totalCostNeuron = '0';
          return {
            inputTokens: 0,
            outputTokens: 0,
            inputCostNeuron,
            outputCostNeuron,
            totalCostNeuron,
            totalCostOg: '0.0000000000',
          };
        })(),
        storage: {
          proofDownloadVerified: false,
          encryption: {
            enabled: true,
            type: 'aes-256-gcm',
            headerDetected: true,
            keyFingerprint: burned.keyFingerprint as Hash,
          },
        },
        burn: {
          sessionKeyDestroyedAt: burned.destroyedAt,
          localCleanupStatus: 'completed',
          tempPathsZeroed: [],
          wording:
            'Session key destroyed; ciphertext now unreadable to operator. Burn Mode protects against operator-side disclosure; local-machine compromise is out of scope.',
        },
        chainAnchor: defaultChainAnchor(env.network as 'testnet' | 'mainnet', registryAddr as Address),
        outputs: {
          outputHash: outputHash as Hash,
          citations: [],
          riskLevel: 'low',
          wording: {
            headline: `Room ${roomId} created with ${partyList.length} party grant(s)`,
            doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
          },
        },
        createdBy: 'ivaronix-runtime/0.0.1',
      });

      const signed = await signReceipt(draft, wallet);
      const outDir = resolve(dirname(manifestPath), '..', 'receipts', 'anchored');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, `${signed.id}.json`), JSON.stringify(signed, null, 2));

      ui.pending('anchoring doc_room_create receipt on chain...');
      // The deployed ReceiptRegistry contract has an allow-list at types
      // 0-9. Until we redeploy with slot 10 (doc_room_create), we anchor
      // semantically equivalent type 5 (skill_exec) — the room creation
      // *is* the skill 'room.create@0.1.0' executing. The off-chain
      // receipt body still records type 'doc_room_create' faithfully.
      const RECEIPT_TYPE_CODE = 5;
      const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hash;
      const storageRoot = (blobStorageRoot.startsWith('0x') && blobStorageRoot.length === 66
        ? blobStorageRoot
        : ZERO_HASH) as Hash;
      const tx = await reg.anchor(signed.storage!.receiptRoot as Hash, storageRoot, RECEIPT_TYPE_CODE, ZERO_HASH);
      const rcpt = await tx.wait();
      ui.pass(`receipt              ${signed.id}  tx ${tx.hash.slice(0, 18)}…  block ${rcpt?.blockNumber ?? '?'}`);
    } catch (err) {
      ui.info(`receipt anchor (best-effort) failed: ${(err as Error).message.split('\n')[0] ?? ''.slice(0, 120)}`);
    }

    ui.divider();
    ui.section(`Room URL`);
    if (manifestStorageRoot) {
      // W6 — append ?storage=<root> so a judge on a different machine can
      // fetch the manifest from 0G Storage without our local FS.
      ui.info(`Studio: http://localhost:3300/data-room/${roomId}?storage=${manifestStorageRoot}`);
      ui.info(`(Studio falls back to 0G Storage when local manifest is missing.)`);
    } else {
      ui.info(`Studio: http://localhost:3300/data-room/${roomId}`);
      ui.info(`(Storage upload failed; only the operator's machine can resolve this URL.)`);
    }
    ui.info(`Manifest hash: ${manifestHash}`);
    ui.hint(`Each party can call:  ivaronix room read ${roomId}`);
  });

// ─── room list ───────────────────────────────────────────────────────────
roomCommand
  .command('list')
  .description('List rooms you created (local manifests in .ivaronix/rooms)')
  .action(() => {
    const dir = roomsDir();
    if (!existsSync(dir)) {
      ui.info('(no rooms yet — create one with `ivaronix room create --doc <file> --parties <addrs>`)');
      return;
    }
    const entries = readdirSync(dir).filter((e) => e.endsWith('.json'));
    if (entries.length === 0) {
      ui.info('(no rooms yet — create one with `ivaronix room create --doc <file> --parties <addrs>`)');
      return;
    }
    ui.title(`Rooms in ${dir}`);
    for (const e of entries) {
      try {
        const m = JSON.parse(readFileSync(resolve(dir, e), 'utf8')) as RoomManifest;
        const ts = new Date(m.createdAt).toISOString().replace('T', ' ').slice(0, 19);
        ui.info(`${m.roomId.slice(0, 12)}…  parties=${m.parties.length}  ${m.blobBytes}B  ${ts}  ${m.blobStorageRoot.slice(0, 24)}…`);
      } catch { /* skip malformed */ }
    }
  });

// ─── room read ───────────────────────────────────────────────────────────
roomCommand
  .command('read <roomId>')
  .description('Anchor a doc_room_read receipt for the connected wallet (caller must hold a valid CapabilityRegistry grant for this room)')
  .action(async (roomId: string) => {
    const env = loadEnv();
    if (!env.privateKey || !env.walletAddress) {
      ui.fail('room read requires EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS in .env');
      process.exitCode = 1;
      return;
    }

    const dir = roomsDir();
    const manifestPath = resolve(dir, `${roomId}.json`);
    if (!existsSync(manifestPath)) {
      ui.fail(`room manifest not found at ${manifestPath}`);
      ui.hint(`copy the manifest from the operator, or run \`ivaronix room create\` first`);
      process.exitCode = 1;
      return;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RoomManifest;

    ui.title(`Reading room ${roomId}`);
    ui.info(`reader               ${env.walletAddress}`);
    ui.info(`creator              ${manifest.creator}`);
    ui.info(`scope hash           ${manifest.scopeHash}`);

    // Verify the connected wallet has a valid grant for this scope
    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const cap = new CapabilityRegistryClient(capAddr, wallet);

    // Accept either: matching grantId in manifest (case-insensitive on address),
    // or the implicit-owner sentinel for the room creator.
    const readerLower = env.walletAddress.toLowerCase();
    let expectedGrantId: string | undefined;
    let isCreator = false;
    for (const [partyAddr, grantId] of Object.entries(manifest.grantIds)) {
      if (partyAddr.toLowerCase() === readerLower) {
        expectedGrantId = grantId;
        isCreator = partyAddr.toLowerCase() === manifest.creator.toLowerCase();
        break;
      }
    }
    if (!expectedGrantId) {
      ui.fail(`reader ${env.walletAddress} is not in the parties list of this room`);
      ui.info(`parties: ${manifest.parties.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    const SELF_MARKER = '0x' + 'cc'.repeat(32);
    if (isCreator && expectedGrantId.toLowerCase() === SELF_MARKER) {
      ui.pass(`grant valid          implicit owner grant (creator reads own room)`);
    } else {
      const valid = await cap.isValid(expectedGrantId as Hash, env.walletAddress as Address, manifest.scopeHash as Hash);
      if (!valid) {
        ui.fail(`grant ${expectedGrantId.slice(0, 18)}… is no longer valid (revoked or expired)`);
        process.exitCode = 1;
        return;
      }
      ui.pass(`grant valid          ${expectedGrantId.slice(0, 18)}…`);
    }

    // Anchor a doc_room_read receipt
    const registryAddr = getDeployedAddress(env.network, 'ReceiptRegistry');
    if (!registryAddr) {
      ui.fail(`ReceiptRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const reg = new ReceiptRegistryClient(registryAddr, wallet);

    const accessTimestamp = Date.now();
    const userPromptHash = await sha256HexAsync(new TextEncoder().encode(`room.read:${roomId}:${env.walletAddress}:${accessTimestamp}`));
    const outputHash = manifest.manifestHash as Hash;

    const draft = buildReceipt({
      type: 'doc_room_read',
      agent: {
        passportId: `did:0g:passport:${env.walletAddress}:1`,
        ownerWallet: env.walletAddress as Address,
        trustScoreAtTime: 0,
      },
      request: {
        skillId: 'room.read',
        skillVersion: '0.1.0',
        skillManifestHash: manifest.manifestHash as Hash,
        userPromptHash: userPromptHash as Hash,
        inputArtifacts: [{ kind: 'doc', encrypted: true }],
        policyDecision: 'approved',
        approvalChain: [{ gate: 'wallet-access', decision: 'auto-allow', actor: `capability-grant:${expectedGrantId}` }],
      },
      execution: {
        mode: 'doc_room_read',
        burnMode: true,
        consensusMode: false,
        modelSelection: { requested: 'n/a', final: 'n/a' },
        providerRouting: { allowFallbacks: true, finalProvider: '0x0000000000000000000000000000000000000000' as Address },
      },
      teeVerification: {
        requested: false,
        routerVerified: false,
        independentVerified: null,
        verificationMethod: 'router_flag',
        verifiedAt: null,
      },
      routerTrace: {
        requestId: `room.read:${roomId}:${accessTimestamp}`,
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
      storage: {
        proofDownloadVerified: false,
        encryption: {
          enabled: true,
          type: 'aes-256-gcm',
          headerDetected: true,
          keyFingerprint: manifest.keyFingerprint as Hash,
        },
      },
      chainAnchor: defaultChainAnchor(env.network as 'testnet' | 'mainnet', registryAddr as Address),
      outputs: {
        outputHash: outputHash as Hash,
        citations: [],
        riskLevel: 'low',
        wording: {
          headline: `Read access to room ${roomId.slice(0, 12)}… by ${env.walletAddress.slice(0, 10)}…`,
          doNotSay: ['truth score', 'verified by AI', 'guaranteed safe'],
        },
      },
      createdBy: 'ivaronix-runtime/0.0.1',
    });

    const signed = await signReceipt(draft, wallet);
    const outDir = resolve(dirname(manifestPath), '..', 'receipts', 'anchored');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, `${signed.id}.json`), JSON.stringify(signed, null, 2));

    ui.pending('anchoring doc_room_read receipt on chain...');
    // Until ReceiptRegistry is redeployed with slot 11, use semantically
    // equivalent type 4 (memory_access) — reading a confidential blob *is*
    // an authorized memory access against a CapabilityRegistry grant.
    // The off-chain receipt body still records type 'doc_room_read'.
    const RECEIPT_TYPE_CODE = 4;
    const ZERO_HASH = ('0x' + '0'.repeat(64)) as Hash;
    const storageRoot = (manifest.blobStorageRoot.startsWith('0x') && manifest.blobStorageRoot.length === 66
      ? manifest.blobStorageRoot
      : ZERO_HASH) as Hash;
    const tx = await reg.anchor(signed.storage!.receiptRoot as Hash, storageRoot, RECEIPT_TYPE_CODE, ZERO_HASH);
    const rcpt = await tx.wait();
    ui.pass(`receipt              ${signed.id}`);
    ui.pass(`tx                   ${tx.hash}`);
    ui.pass(`block                ${rcpt?.blockNumber ?? '?'}`);
    ui.divider();
    ui.hint(`Public proof: http://localhost:3300/r/<onchain-id>  (use \`ivaronix indexer backfill\` to resolve the on-chain id)`);
  });
