import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Wallet, JsonRpcProvider } from 'ethers';
import { sha256HexAsync, NETWORKS, type Hash, type Address } from '@ivaronix/core';
import { AgentPassportClient, getDeployedAddress } from '@ivaronix/og-chain';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

interface LocalPassportFile {
  network: string;
  tokenId: string;
  ownerWallet: Address;
  metadataRoot: Hash;
  metadata: {
    name: string;
    handle: string;
    avatarUri?: string;
    role?: string;
    personality: { style: string; risk: string };
    modelHistory: string[];
    skillsInstalled: string[];
    permissionProfile: string;
    createdAt: number;
  };
  mintTxHash: Hash;
}

const DEFAULT_PASSPORT_PATH = '.ivaronix/passport.json';

export const passportCommand = new Command('passport')
  .description('Manage your ERC-7857 Agent Passport');

// ─── mint ────────────────────────────────────────────────────────────────────
passportCommand
  .command('mint')
  .description('Mint your AgentPassportINFT (ERC-7857)')
  .option('--name <name>', 'agent name', 'My Ivaronix Agent')
  .option('--handle <handle>', 'public handle (alphanumeric, no @)', 'ivaronix-user')
  .option('--out <path>', 'where to save the passport metadata locally', DEFAULT_PASSPORT_PATH)
  .action(async (opts: { name: string; handle: string; out: string }) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No private key in .env');
      process.exitCode = 1;
      return;
    }

    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!passportAddr) {
      ui.fail(`AgentPassportINFT not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const passport = new AgentPassportClient(passportAddr, wallet);

    // One-passport-per-wallet check
    const existing = await passport.passportOf(wallet.address as Address);
    if (existing !== 0n) {
      ui.fail(`Wallet ${wallet.address} already has a passport (tokenId ${existing})`);
      ui.hint(`Run 'ivaronix passport show' to inspect, or 'ivaronix passport restore --wallet ${wallet.address}' to fetch state.`);
      process.exitCode = 1;
      return;
    }

    ui.title('Minting Agent Passport (ERC-7857)');
    ui.info(`network              ${env.network}`);
    ui.info(`contract             ${passportAddr}`);
    ui.info(`owner wallet         ${wallet.address}`);
    ui.info(`name                 ${opts.name}`);
    ui.info(`handle               ${opts.handle}`);
    ui.divider();

    // Build the metadata blob (encrypted-on-Storage in future once B-1 is fixed)
    const metadata = {
      name: opts.name,
      handle: opts.handle,
      ownerWallet: wallet.address,
      personality: { style: 'concise', risk: 'balanced' },
      modelHistory: ['qwen/qwen-2.5-7b-instruct'],
      skillsInstalled: [] as string[],
      permissionProfile: 'default-strict',
      createdAt: Date.now(),
    };
    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    const sha = sha256HexAsync(metadataBytes); // sha256:<hex>
    const metadataRoot = ('0x' + sha.replace(/^sha256:/, '')) as Hash;
    ui.info(`metadataRoot         ${metadataRoot}`);

    ui.pending('submitting mint tx...');
    let tokenId: bigint;
    let txHash: string;
    try {
      const tx = await passport.mint(metadataRoot);
      txHash = tx.hash;
      ui.info(`tx hash              ${txHash}`);
      const receipt = await tx.wait();
      if (!receipt) {
        ui.fail('mint tx did not return a receipt');
        return;
      }
      ui.pass(`block                ${receipt.blockNumber}`);
      ui.pass(`gas used             ${receipt.gasUsed}`);

      tokenId = await passport.passportOf(wallet.address as Address);
      ui.pass(`tokenId              ${tokenId}`);
    } catch (err) {
      ui.fail('Mint failed', (err as Error).message);
      process.exitCode = 1;
      return;
    }

    // Write passport.json locally
    const file: LocalPassportFile = {
      network: env.network,
      tokenId: tokenId.toString(),
      ownerWallet: wallet.address as Address,
      metadataRoot,
      metadata: {
        name: metadata.name,
        handle: metadata.handle,
        personality: metadata.personality,
        modelHistory: metadata.modelHistory,
        skillsInstalled: metadata.skillsInstalled,
        permissionProfile: metadata.permissionProfile,
        createdAt: metadata.createdAt,
      },
      mintTxHash: txHash as Hash,
    };
    const outPath = resolve(process.cwd(), opts.out);
    mkdirSync(resolve(outPath, '..'), { recursive: true });
    writeFileSync(outPath, JSON.stringify(file, null, 2));
    ui.pass(`written              ${outPath}`);

    ui.divider();
    ui.banner(true, '→ PASSPORT MINTED ✓');
    ui.hint(`Show:      ivaronix passport show`);
    ui.hint(`Explorer:  ${NETWORKS[env.network].chainExplorer}/tx/${txHash}`);
  });

// ─── show ────────────────────────────────────────────────────────────────────
passportCommand
  .command('show')
  .description('Show your current passport state (on-chain)')
  .option('--wallet <address>', 'inspect a different wallet')
  .action(async (opts: { wallet?: string }) => {
    const env = loadEnv();
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!passportAddr) {
      ui.fail(`AgentPassportINFT not deployed on ${env.network}`);
      return;
    }

    const target = (opts.wallet ?? env.walletAddress) as Address | undefined;
    if (!target) {
      ui.fail('No target wallet — pass --wallet <address> or set EVM_WALLET_ADDRESS in .env');
      return;
    }

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const passport = new AgentPassportClient(passportAddr, provider);
    const data = await passport.getPassportByWallet(target);

    if (!data) {
      ui.fail(`No passport for ${target}`);
      ui.hint(`Mint one: ivaronix passport mint`);
      return;
    }

    ui.title(`Passport for ${target}`);
    ui.divider();
    ui.info(`tokenId              ${data.tokenId}`);
    ui.info(`owner                ${data.owner}`);
    ui.info(`metadataRoot         ${data.metadataRoot}`);
    ui.info(`memoryRoot           ${data.memoryRoot === '0x0000000000000000000000000000000000000000000000000000000000000000' ? '(none yet)' : data.memoryRoot}`);
    ui.info(`skillManifestRoot    ${data.skillManifestRoot === '0x0000000000000000000000000000000000000000000000000000000000000000' ? '(none yet)' : data.skillManifestRoot}`);
    ui.divider();
    ui.section('reputation');
    ui.pass(`receiptCount         ${data.receiptCount}`);
    if (data.violationCount > 0n) ui.fail(`violationCount       ${data.violationCount}`);
    else ui.pass(`violationCount       ${data.violationCount}`);
    const ts = Number(data.trustScore);
    if (ts >= 0) ui.pass(`trustScore           ${ts}`);
    else ui.fail(`trustScore           ${ts}`);
    ui.divider();
    ui.section('lifecycle');
    ui.info(`mintedAt             ${data.mintedAt}  (${new Date(Number(data.mintedAt) * 1000).toISOString()})`);
    ui.info(`lastEvolutionAt      ${data.lastEvolutionAt}  (${new Date(Number(data.lastEvolutionAt) * 1000).toISOString()})`);
    ui.divider();
    ui.hint(`Explorer: ${NETWORKS[env.network].chainExplorer}/address/${passportAddr}`);
  });

// ─── restore ─────────────────────────────────────────────────────────────────
passportCommand
  .command('restore')
  .description('Fetch your passport state from chain and write a local passport.json')
  .option('--wallet <address>', 'wallet to restore (defaults to signer)')
  .option('--out <path>', 'output path', DEFAULT_PASSPORT_PATH)
  .action(async (opts: { wallet?: string; out: string }) => {
    const env = loadEnv();
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!passportAddr) {
      ui.fail(`AgentPassportINFT not deployed on ${env.network}`);
      return;
    }

    const target = (opts.wallet ?? env.walletAddress) as Address | undefined;
    if (!target) {
      ui.fail('No target wallet');
      return;
    }

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const passport = new AgentPassportClient(passportAddr, provider);
    const data = await passport.getPassportByWallet(target);
    if (!data) {
      ui.fail(`No passport found for ${target}`);
      return;
    }

    // Try to read any existing local passport.json for richer metadata
    const outPath = resolve(process.cwd(), opts.out);
    let prior: Partial<LocalPassportFile> = {};
    if (existsSync(outPath)) {
      try {
        prior = JSON.parse(readFileSync(outPath, 'utf8')) as LocalPassportFile;
      } catch {
        /* ignore parse errors */
      }
    }

    const file: LocalPassportFile = {
      network: env.network,
      tokenId: data.tokenId.toString(),
      ownerWallet: data.owner,
      metadataRoot: data.metadataRoot,
      metadata: prior.metadata ?? {
        name: 'Restored Agent',
        handle: 'ivaronix-user',
        personality: { style: 'concise', risk: 'balanced' },
        modelHistory: ['qwen/qwen-2.5-7b-instruct'],
        skillsInstalled: [],
        permissionProfile: 'default-strict',
        createdAt: Number(data.mintedAt) * 1000,
      },
      mintTxHash: prior.mintTxHash ?? ('0x' + '0'.repeat(64)) as Hash,
    };

    mkdirSync(resolve(outPath, '..'), { recursive: true });
    writeFileSync(outPath, JSON.stringify(file, null, 2));

    ui.title('Passport restored from chain');
    ui.pass(`tokenId              ${data.tokenId}`);
    ui.pass(`receiptCount         ${data.receiptCount}`);
    ui.pass(`trustScore           ${data.trustScore}`);
    ui.pass(`written              ${outPath}`);
  });

// ─── authorize ───────────────────────────────────────────────────────────────
passportCommand
  .command('authorize <executor>')
  .description('Authorize an executor address to record receipts against your passport for ttlSeconds')
  .option('--ttl <duration>', 'TTL like "7d" / "12h" / "30m" / "60s" / raw seconds', '7d')
  .action(async (executor: string, opts: { ttl: string }) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No EVM_PRIVATE_KEY in .env — cannot sign the authorizeExecutor tx');
      process.exitCode = 1;
      return;
    }
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!passportAddr) {
      ui.fail(`AgentPassportINFT not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const ttlMatch = opts.ttl.match(/^(\d+)([smhd])?$/);
    if (!ttlMatch) {
      ui.fail(`bad --ttl "${opts.ttl}" — use 7d / 12h / 30m / 60s / raw seconds`);
      process.exitCode = 1;
      return;
    }
    const n = Number(ttlMatch[1]);
    const ttlSeconds = ttlMatch[2] === 'h' ? n * 3600 : ttlMatch[2] === 'm' ? n * 60 : ttlMatch[2] === 'd' ? n * 86400 : ttlMatch[2] === 's' ? n : n;

    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const client = new AgentPassportClient(passportAddr, wallet);
    const tokenId = await client.passportOf(wallet.address as Address);
    if (tokenId === 0n) {
      ui.fail(`No passport for ${wallet.address} — mint one first with 'ivaronix passport mint'`);
      process.exitCode = 1;
      return;
    }
    ui.title(`authorizing executor ${executor}`);
    ui.info(`tokenId              ${tokenId}`);
    ui.info(`ttl                  ${opts.ttl} (${ttlSeconds}s)`);
    ui.divider();
    const tx = await client.authorizeExecutor(tokenId, executor as Address, ttlSeconds);
    ui.pending(`tx ${tx.hash}`);
    const receipt = await tx.wait();
    ui.pass(`block                ${receipt?.blockNumber}`);
    const expiry = await client.executorExpiry(tokenId, executor as Address);
    ui.pass(`expires              ${new Date(Number(expiry) * 1000).toISOString()}`);
    ui.divider();
    ui.banner(true, '→ AUTHORIZED ✓');
    ui.hint(`Verify:    ivaronix passport executor ${executor}`);
    ui.hint(`Explorer:  ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
  });

// ─── revoke ──────────────────────────────────────────────────────────────────
passportCommand
  .command('revoke <executor>')
  .description('Revoke an executor address')
  .action(async (executor: string) => {
    const env = loadEnv();
    if (!env.privateKey) {
      ui.fail('No EVM_PRIVATE_KEY in .env');
      process.exitCode = 1;
      return;
    }
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!passportAddr) {
      ui.fail(`AgentPassportINFT not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const wallet = new Wallet(env.privateKey, provider);
    const client = new AgentPassportClient(passportAddr, wallet);
    const tokenId = await client.passportOf(wallet.address as Address);
    if (tokenId === 0n) {
      ui.fail(`No passport for ${wallet.address}`);
      process.exitCode = 1;
      return;
    }
    ui.title(`revoking executor ${executor}`);
    ui.divider();
    const tx = await client.revokeExecutor(tokenId, executor as Address);
    ui.pending(`tx ${tx.hash}`);
    const receipt = await tx.wait();
    ui.pass(`block                ${receipt?.blockNumber}`);
    ui.divider();
    ui.banner(true, '→ REVOKED ✓');
    ui.hint(`Explorer:  ${NETWORKS[env.network].chainExplorer}/tx/${tx.hash}`);
  });

// ─── executor (status) ───────────────────────────────────────────────────────
passportCommand
  .command('executor <executor>')
  .description('Show whether an executor is currently authorized for your passport')
  .action(async (executor: string) => {
    const env = loadEnv();
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!passportAddr) {
      ui.fail(`AgentPassportINFT not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    if (!env.walletAddress) {
      ui.fail('No EVM_WALLET_ADDRESS in .env');
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const client = new AgentPassportClient(passportAddr, provider);
    const tokenId = await client.passportOf(env.walletAddress as Address);
    if (tokenId === 0n) {
      ui.fail(`No passport for ${env.walletAddress}`);
      return;
    }
    const allowed = await client.isAuthorizedExecutor(tokenId, executor as Address);
    const expiry = await client.executorExpiry(tokenId, executor as Address);
    ui.title(`executor ${executor} for tokenId ${tokenId}`);
    ui.divider();
    if (allowed) {
      ui.pass(`status               AUTHORIZED`);
      ui.info(`expires              ${new Date(Number(expiry) * 1000).toISOString()}`);
    } else if (expiry > 0n) {
      ui.fail(`status               EXPIRED`);
      ui.info(`expired at           ${new Date(Number(expiry) * 1000).toISOString()}`);
    } else {
      ui.info(`status               NEVER AUTHORIZED`);
    }
  });
