import { Command } from 'commander';
import { keccak256, toUtf8Bytes, Wallet, JsonRpcProvider } from 'ethers';
import {
  CapabilityRegistryClient,
  MemoryAccessLogClient,
  MEMORY_ACCESS,
  getDeployedAddress,
  type MemoryAccessType,
} from '@ivaronix/og-chain';
import { NETWORKS, type Address, type Hash } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

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

export const memoryCommand = new Command('memory')
  .description('Manage on-chain memory permissions (CapabilityRegistry + MemoryAccessLog)');

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
    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
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
    ui.info(`registry             ${capAddr}`);
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
      return;
    }
    ui.pass(`grantId              ${grantId}`);
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
    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
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
    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const cap = new CapabilityRegistryClient(capAddr, provider);

    const target = (opts.to ?? opts.by ?? env.walletAddress) as Address | undefined;
    if (!target) {
      ui.fail('No target wallet — pass --by/--to or set EVM_WALLET_ADDRESS');
      return;
    }

    const ids = opts.to
      ? await cap.listGrantsByGrantee(target)
      : await cap.listGrantsByOwner(target);

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
    const logAddr = getDeployedAddress(env.network, 'MemoryAccessLog');
    if (!logAddr) {
      ui.fail(`MemoryAccessLog not deployed on ${env.network}`);
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const accessLog = new MemoryAccessLogClient(logAddr, provider);

    const target = (opts.agent ?? env.walletAddress) as Address | undefined;
    if (!target) {
      ui.fail('No target agent — pass --agent or set EVM_WALLET_ADDRESS');
      return;
    }

    ui.title(`Memory access log for ${target}`);
    ui.divider();
    const events = await accessLog.listForAgent(target, Number(opts.lookback));
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
      ui.info(`[${ts}] ${typeLabels[ev.accessType] ?? ev.accessType}  grant ${ev.grantId.slice(0, 14)}…  memRoot ${ev.memoryRoot.slice(0, 14)}…  block ${ev.blockNumber}`);
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
      return;
    }
    const logAddr = getDeployedAddress(env.network, 'MemoryAccessLog');
    if (!logAddr) {
      ui.fail(`MemoryAccessLog not deployed`);
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
