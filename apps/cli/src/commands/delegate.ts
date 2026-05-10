import { Command } from 'commander';
import { Wallet, JsonRpcProvider, Contract, parseEther, sha256, toUtf8Bytes, keccak256 } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  CapabilityRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { ulid, studioUrl, type Address, type Hash } from '@ivaronix/core';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';
import { confirmAction } from '../lib/confirm.js';
import { docCommand } from './doc.js';

/**
 * Delegated AI Agent.
 *
 * "I want an AI specialist to handle my contract reviews. The AI has its own
 * identity (AgentPassportINFT). Every action it takes is signed by the
 * delegate's own wallet, not mine. I grant capabilities via on-chain
 * CapabilityRegistry; I can revoke at any time."
 *
 * Today's scope:
 * - Generate a fresh delegate keypair (operator-side, isolated under
 *   `.ivaronix/delegates/<id>/`).
 * - Fund the delegate from the user's wallet (small gas budget).
 * - Mint AgentPassportINFT for the delegate (real on-chain tx).
 * - Issue CapabilityRegistry grant from user → delegate (real on-chain tx).
 * - Run a skill with the delegate's wallet — receipts signed by the
 *   delegate, not the user. The user is provably absent from the signing
 *   path.
 * - Revoke capability cleanly.
 *
 * Threat model (planning-003 §A.3.2 · WT 66):
 *   - Defends against: the user's own signing key appearing in any receipt
 *     produced by the delegate. Receipts are signed by the delegate
 *     wallet only. The user's wallet is not used during run, so a
 *     compromised delegate cannot forge a receipt as the user.
 *   - Defends against: capability creep. Every delegate run reads its
 *     scope from CapabilityRegistry; revoking the on-chain grant
 *     invalidates future runs immediately.
 *   - Does NOT defend against: an attacker who exfiltrates the delegate
 *     private key from `.ivaronix/delegates/<id>/`. The key is plaintext
 *     on disk under operator custody; mode 0600 prevents process-level
 *     read but not whole-machine compromise.
 *   - Roadmap: replace operator-custody keys with 0G Compute TEE-derived
 *     keys generated inside the TEE on first mint. The on-chain identity
 *     model stays the same; the trust boundary moves from the operator's
 *     filesystem to the TEE.
 */

const PASSPORT_ABI = [
  'function mint(bytes32 metadataRoot) external returns (uint256)',
  'function passportOf(address) external view returns (uint256)',
];

interface DelegateManifest {
  delegateId: string;
  name: string;
  description: string;
  ownerUserWallet: Address; // who created this delegate
  delegateAddress: Address; // the delegate's own wallet
  skillsAuthorized: string[];
  passportTokenId: string | null;
  passportMintTx: string | null;
  fundingTx: string | null;
  capabilityGrants: Array<{
    skillId: string;
    grantId: string;
    grantTx: string;
    scopeHash: string;
    issuedAt: number;
    revokedAt?: number;
    revokeTx?: string;
  }>;
  createdAt: number;
  network: string;
}

function delegatesDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return resolve(dir, '.ivaronix', 'delegates');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.ivaronix', 'delegates');
}

function delegatePath(delegateId: string): string {
  return resolve(delegatesDir(), delegateId, 'manifest.json');
}

function delegateKeyPath(delegateId: string): string {
  return resolve(delegatesDir(), delegateId, 'key.json');
}

/**
 * Lightweight shape guard for DelegateManifest · HALF_BAKED §J-3
 * (sweep 159 · same pattern as parseConversationFile in
 * apps/cli/src/lib/conversation.ts). Stale delegate files (e.g.
 * missing capabilityGrants array from an older format) returned
 * partial manifests via the unchecked cast; callers then crashed at
 * `m.capabilityGrants.length`. Now we return null for malformed shapes
 * (same as for missing/unreadable files — caller sees a uniform
 * "delegate not found" signal).
 */
function isWellFormedDelegateManifest(json: unknown): json is DelegateManifest {
  if (!json || typeof json !== 'object') return false;
  const j = json as Record<string, unknown>;
  return (
    typeof j.delegateId === 'string' &&
    typeof j.name === 'string' &&
    typeof j.ownerUserWallet === 'string' &&
    typeof j.delegateAddress === 'string' &&
    Array.isArray(j.skillsAuthorized) &&
    Array.isArray(j.capabilityGrants) &&
    typeof j.createdAt === 'number' &&
    typeof j.network === 'string'
  );
}

function loadManifest(delegateId: string): DelegateManifest | null {
  const path = delegatePath(delegateId);
  if (!existsSync(path)) return null;
  try {
    const json: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isWellFormedDelegateManifest(json)) return null;
    return json;
  } catch { return null; }
}

function saveManifest(m: DelegateManifest): void {
  const path = delegatePath(m.delegateId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(m, null, 2));
}

function loadDelegateKey(delegateId: string): string | null {
  const path = delegateKeyPath(delegateId);
  if (!existsSync(path)) return null;
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!data || typeof data !== 'object') return null;
    const pk = (data as Record<string, unknown>).privateKey;
    if (typeof pk !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(pk)) return null;
    return pk;
  } catch { return null; }
}

/**
 * Restore an env var to its prior value (or unset it if it wasn't set
 * before). Used in the delegate run's finally block to make sure the
 * temporary env-var swap doesn't pollute later commands.
 */
function restoreEnv(name: string, prev: string | undefined): void {
  if (prev === undefined) delete process.env[name];
  else process.env[name] = prev;
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

export const delegateCommand = new Command('delegate')
  .description('Delegated AI agents — agent has its own AgentPassport + on-chain capabilities; user grants/revokes at will');

// ─── delegate create ─────────────────────────────────────────────────────
delegateCommand
  .command('create')
  .description('Create a fresh delegate: generate keypair, fund it, mint AgentPassport, save manifest')
  .requiredOption('--name <name>', 'human-readable delegate name (e.g. "Adam · the term-sheet hawk")')
  .option('--description <desc>', 'one-line description of the delegate persona', '')
  .option('--skills <ids>', 'comma-separated skills the delegate is authorized to run', 'private-doc-review')
  .option('--funding <amount>', 'OG amount to fund the delegate wallet for gas', '0.05')
  .action(async (opts: { name: string; description: string; skills: string; funding: string }) => {
    const env = loadEnv();
    if (!env.privateKey || !env.walletAddress) {
      ui.fail('delegate create requires IVARONIX_SIGNER_KEY + IVARONIX_WALLET_ADDRESS in .env (legacy aliases EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS still resolve)');
      process.exitCode = 1;
      return;
    }
    const passportAddr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!passportAddr) {
      ui.fail(`AgentPassportINFT not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }

    const delegateId = ulid();
    const skills = opts.skills.split(',').map((s) => s.trim()).filter(Boolean);

    ui.title(`Creating delegate ${delegateId.slice(0, 12)}…`);
    ui.info(`name                 ${opts.name}`);
    ui.info(`description          ${opts.description || '(none)'}`);
    ui.info(`skills authorized    ${skills.join(', ')}`);
    ui.info(`network              ${env.network}`);
    ui.info(`owner (user)         ${env.walletAddress}`);
    ui.divider();

    // 1. Generate fresh keypair for the delegate
    const fresh = Wallet.createRandom();
    const delegateAddress = fresh.address as Address;
    ui.pass(`delegate wallet      ${delegateAddress}`);

    // Persist key locally. Today: operator-machine custody (mode 0600).
    // Hardened end-state is TEE-bound key custody so the operator process
    // can't extract the secret; tracked in USER_TODO §B-V2.
    mkdirSync(dirname(delegateKeyPath(delegateId)), { recursive: true });
    writeFileSync(
      delegateKeyPath(delegateId),
      JSON.stringify({ privateKey: fresh.privateKey, address: delegateAddress, createdAt: Date.now() }, null, 2),
      { mode: 0o600 },
    );
    ui.info(`key stored           ${delegateKeyPath(delegateId)} (mode 0600 · operator-machine custody; TEE-bound custody queued)`);

    // 2. Fund the delegate from the user's wallet
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const userWallet = new Wallet(env.privateKey, provider);

    ui.pending(`funding delegate with ${opts.funding} OG...`);
    const fundTx = await userWallet.sendTransaction({
      to: delegateAddress,
      value: parseEther(opts.funding),
    });
    const fundReceipt = await fundTx.wait();
    ui.pass(`fund tx              ${fundTx.hash}  block ${fundReceipt?.blockNumber ?? '?'}`);

    // 3. Mint AgentPassportINFT for the delegate
    const delegateSigner = new Wallet(fresh.privateKey, provider);
    const passport = new Contract(passportAddr, PASSPORT_ABI, delegateSigner);

    const metadata = {
      type: 'ivaronix-delegate',
      version: '0.1.0',
      delegateId,
      name: opts.name,
      description: opts.description,
      delegateAddress,
      ownerUserWallet: env.walletAddress,
      skillsAuthorized: skills,
      personality: { style: 'concise', risk: 'balanced' },
      permissionProfile: 'default-strict',
      createdAt: Date.now(),
    };
    const metadataBytes = toUtf8Bytes(JSON.stringify(metadata));
    const metadataRoot = sha256(metadataBytes) as Hash;

    ui.pending('minting AgentPassportINFT for delegate...');
    let tokenId = 0n;
    let mintTxHash: string | null = null;
    try {
      const mintTx = await passport.mint!(metadataRoot);
      mintTxHash = mintTx.hash;
      const mintReceipt = await mintTx.wait();
      tokenId = await passport.passportOf!(delegateAddress);
      ui.pass(`mint tx              ${mintTxHash}  block ${mintReceipt?.blockNumber ?? '?'}`);
      ui.pass(`tokenId              ${tokenId.toString()}`);
    } catch (err) {
      ui.fail(`mint failed`, ((err as Error).message.split('\n')[0] ?? '').slice(0, 120));
      // Continue — manifest is still saved so the user can retry mint manually
    }

    // 4. Persist delegate manifest
    const manifest: DelegateManifest = {
      delegateId,
      name: opts.name,
      description: opts.description,
      ownerUserWallet: env.walletAddress as Address,
      delegateAddress,
      skillsAuthorized: skills,
      passportTokenId: tokenId > 0n ? tokenId.toString() : null,
      passportMintTx: mintTxHash,
      fundingTx: fundTx.hash,
      capabilityGrants: [],
      createdAt: Date.now(),
      network: env.network,
    };
    saveManifest(manifest);
    ui.divider();
    ui.pass(`manifest saved       ${delegatePath(delegateId)}`);
    ui.section('Next steps');
    ui.info(`Grant a skill capability:    ivaronix delegate grant ${delegateId.slice(0, 12)} --skill <skillId>`);
    ui.info(`Run a skill via delegate:    ivaronix delegate run ${delegateId.slice(0, 12)} <doc> "question"`);
    ui.info(`Studio:                      ${studioUrl(`/delegate/${delegateId}`)}`);
  });

// ─── delegate list ───────────────────────────────────────────────────────
delegateCommand
  .command('list')
  .description('List delegates created by this user (local manifests under .ivaronix/delegates/)')
  .action(() => {
    const dir = delegatesDir();
    if (!existsSync(dir)) {
      ui.info('(no delegates yet — create one with `ivaronix delegate create --name "..."`)');
      return;
    }
    const entries = readdirSync(dir);
    if (entries.length === 0) {
      ui.info('(no delegates yet — create one with `ivaronix delegate create --name "..."`)');
      return;
    }
    ui.title(`Delegates in ${dir}`);
    for (const e of entries) {
      const m = loadManifest(e);
      if (!m) continue;
      const activeGrants = m.capabilityGrants.filter((g) => !g.revokedAt).length;
      const totalGrants = m.capabilityGrants.length;
      ui.info(`${m.delegateId.slice(0, 12)}…  ${m.name.slice(0, 36).padEnd(36)}  passport ${m.passportTokenId ?? '—'}  grants ${activeGrants}/${totalGrants}  ${m.delegateAddress.slice(0, 10)}…`);
    }
  });

// ─── delegate grant ──────────────────────────────────────────────────────
delegateCommand
  .command('grant <delegateId>')
  .description('Issue a CapabilityRegistry grant from user → delegate for a specific skill scope')
  .requiredOption('--skill <id>', 'skill id the delegate is authorized to run (e.g. private-doc-review)')
  .option('--ttl <duration>', 'grant TTL', '30d')
  .option('--reads <count>', 'reads cap', '100')
  .action(async (rawId: string, opts: { skill: string; ttl: string; reads: string }) => {
    const env = loadEnv();
    if (!env.privateKey || !env.walletAddress) {
      ui.fail('delegate grant requires IVARONIX_SIGNER_KEY + IVARONIX_WALLET_ADDRESS in .env (legacy aliases EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS still resolve)');
      process.exitCode = 1;
      return;
    }
    // Resolve full delegate id from prefix
    const dir = delegatesDir();
    let m: DelegateManifest | null = null;
    if (existsSync(dir)) {
      for (const e of readdirSync(dir)) {
        if (e.startsWith(rawId)) { m = loadManifest(e); if (m) break; }
      }
    }
    if (!m) {
      ui.fail(`delegate "${rawId}" not found in ${dir}`);
      process.exitCode = 1;
      return;
    }
    if (!m.skillsAuthorized.includes(opts.skill)) {
      ui.fail(`skill "${opts.skill}" not in delegate's authorized list (${m.skillsAuthorized.join(', ')})`);
      ui.hint(`Either pick an authorized skill, or recreate the delegate with --skills including this one.`);
      process.exitCode = 1;
      return;
    }

    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) {
      ui.fail(`CapabilityRegistry not deployed on ${env.network}`);
      process.exitCode = 1;
      return;
    }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const userWallet = new Wallet(env.privateKey, provider);
    const cap = new CapabilityRegistryClient(capAddr, userWallet);

    const scopeHash = keccak256(toUtf8Bytes(`skill:${opts.skill}`)) as Hash;
    const ttlSec = parseTtl(opts.ttl);
    const readsCap = Number(opts.reads);

    ui.title(`Granting ${opts.skill} capability to delegate ${m.delegateId.slice(0, 12)}…`);
    ui.info(`grantee              ${m.delegateAddress}`);
    ui.info(`scope hash           ${scopeHash}`);
    ui.info(`ttl                  ${opts.ttl} (${ttlSec}s)`);
    ui.info(`reads cap            ${readsCap}`);

    ui.pending('issuing grant on chain...');
    const tx = await cap.issueGrant(m.delegateAddress, scopeHash, ttlSec, readsCap);
    const receipt = await tx.wait();
    const grantIssuedTopic = keccak256(toUtf8Bytes('GrantIssued(bytes32,address,address,bytes32,uint64,uint32)'));
    const log = receipt?.logs.find((l) => l.topics[0] === grantIssuedTopic);
    const grantId = log?.topics[1] ?? '0x' + '0'.repeat(64);

    m.capabilityGrants.push({
      skillId: opts.skill,
      grantId,
      grantTx: tx.hash,
      scopeHash,
      issuedAt: Date.now(),
    });
    saveManifest(m);

    ui.divider();
    ui.pass(`grant id             ${grantId}`);
    ui.pass(`tx                   ${tx.hash}`);
    ui.pass(`block                ${receipt?.blockNumber ?? '?'}`);
    ui.hint(`Run: ivaronix delegate run ${m.delegateId.slice(0, 12)} <doc> "question"`);
  });

// ─── delegate revoke ─────────────────────────────────────────────────────
delegateCommand
  .command('revoke <delegateId>')
  .description('Revoke the most recent active capability grant for this delegate (revokeGrant on chain). Confirms interactively unless --yes is passed.')
  .option('--skill <id>', 'revoke a specific skill grant (default: most recent active)', '')
  .option('-y, --yes', 'skip interactive confirmation (CI / scripted use)', false)
  .action(async (rawId: string, opts: { skill: string; yes: boolean }) => {
    const env = loadEnv();
    if (!env.privateKey) { ui.fail('need IVARONIX_SIGNER_KEY (legacy alias EVM_PRIVATE_KEY still resolves)'); process.exitCode = 1; return; }

    const dir = delegatesDir();
    let m: DelegateManifest | null = null;
    if (existsSync(dir)) {
      for (const e of readdirSync(dir)) {
        if (e.startsWith(rawId)) { m = loadManifest(e); if (m) break; }
      }
    }
    if (!m) { ui.fail(`delegate "${rawId}" not found`); process.exitCode = 1; return; }

    const target = opts.skill
      ? m.capabilityGrants.find((g) => !g.revokedAt && g.skillId === opts.skill)
      : [...m.capabilityGrants].reverse().find((g) => !g.revokedAt);
    if (!target) {
      ui.fail(`no active grant${opts.skill ? ` for skill "${opts.skill}"` : ''} on this delegate`);
      process.exitCode = 1;
      return;
    }

    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) { ui.fail('CapabilityRegistry not deployed'); process.exitCode = 1; return; }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const userWallet = new Wallet(env.privateKey, provider);
    const cap = new CapabilityRegistryClient(capAddr, userWallet);

    ui.title(`Revoking grant ${target.grantId.slice(0, 18)}… for skill ${target.skillId}`);
    // HALF_BAKED §I-19 closure (sweep 169): destructive on-chain tx
    // confirms before submission unless --yes flag was passed.
    if (!opts.yes) {
      const proceed = await confirmAction(
        `This will spend gas to revoke grant ${target.grantId.slice(0, 18)}… on chain. Proceed?`,
      );
      if (!proceed) {
        ui.info('aborted (no tx submitted)');
        return;
      }
    }
    ui.pending('submitting revoke tx...');
    const tx = await cap.revokeGrant(target.grantId as Hash);
    const receipt = await tx.wait();

    target.revokedAt = Date.now();
    target.revokeTx = tx.hash;
    saveManifest(m);

    ui.pass(`revoke tx            ${tx.hash}`);
    ui.pass(`block                ${receipt?.blockNumber ?? '?'}`);
    ui.divider();
    ui.info(`The delegate can no longer run ${target.skillId} on behalf of ${m.ownerUserWallet}.`);
  });

// ─── delegate run ────────────────────────────────────────────────────────
delegateCommand
  .command('run <delegateId> <doc>')
  .description('Run a skill via the delegate (delegate signs the receipt, not the user)')
  .option('--skill <id>', 'skill id (default: first authorized)', '')
  .option('--question <q>', 'question to ask', 'What is the worst clause?')
  .option('--tier <tier>', 'consensus tier', 'quick')
  .action(async (rawId: string, doc: string, opts: { skill: string; question: string; tier: string }) => {
    const env = loadEnv();
    if (!env.privateKey) { ui.fail('need IVARONIX_SIGNER_KEY in .env (legacy alias EVM_PRIVATE_KEY still resolves)'); process.exitCode = 1; return; }

    const dir = delegatesDir();
    let m: DelegateManifest | null = null;
    if (existsSync(dir)) {
      for (const e of readdirSync(dir)) {
        if (e.startsWith(rawId)) { m = loadManifest(e); if (m) break; }
      }
    }
    if (!m) { ui.fail(`delegate "${rawId}" not found`); process.exitCode = 1; return; }

    const skillId = opts.skill || m.skillsAuthorized[0];
    if (!skillId) { ui.fail('no authorized skill on this delegate'); process.exitCode = 1; return; }

    // Find the active grant for this skill
    const grant = m.capabilityGrants.find((g) => !g.revokedAt && g.skillId === skillId);
    if (!grant) {
      ui.fail(`no active capability grant for skill "${skillId}"`);
      ui.hint(`Run: ivaronix delegate grant ${m.delegateId.slice(0, 12)} --skill ${skillId}`);
      process.exitCode = 1;
      return;
    }

    // Verify grant is still valid on chain
    const capAddr = getDeployedAddress(env.network, 'CapabilityRegistry');
    if (!capAddr) { ui.fail('CapabilityRegistry not deployed'); process.exitCode = 1; return; }
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const userWallet = new Wallet(env.privateKey, provider);
    const cap = new CapabilityRegistryClient(capAddr, userWallet);
    const valid = await cap.isValid(grant.grantId as Hash, m.delegateAddress, grant.scopeHash as Hash);
    if (!valid) {
      ui.fail(`grant ${grant.grantId.slice(0, 18)}… is no longer valid (revoked or expired)`);
      process.exitCode = 1;
      return;
    }

    const delegateKey = loadDelegateKey(m.delegateId);
    if (!delegateKey) { ui.fail('delegate key file missing'); process.exitCode = 1; return; }

    ui.title(`Running ${skillId} via delegate ${m.delegateId.slice(0, 12)}…`);
    ui.info(`delegate wallet      ${m.delegateAddress}`);
    ui.info(`grant id             ${grant.grantId.slice(0, 18)}…`);
    ui.info(`receipt will be signed by the DELEGATE, not the user.`);
    ui.divider();

    const docPath = resolve(doc);
    if (!existsSync(docPath)) { ui.fail(`doc not found: ${docPath}`); process.exitCode = 1; return; }

    // In-process invocation: swap the signer-key + wallet-address env
    // vars in process.env, then call docCommand.parseAsync directly.
    // loadEnv reads process.env fresh on every call (see
    // src/lib/env.ts), so every downstream signing path picks up the
    // delegate's identity. We restore env vars in `finally` so we
    // don't pollute later commands.
    //
    // We must touch ALL alias names (canonical IVARONIX_SIGNER_KEY +
    // legacy OG_PRIVATE_KEY + legacy EVM_PRIVATE_KEY) per
    // packages/runtime/src/env.ts SIGNER_KEY_ALIASES order. loadEnv
    // tries IVARONIX_SIGNER_KEY first, falls back to OG_PRIVATE_KEY,
    // falls back to EVM_PRIVATE_KEY. If we only swap one alias and an
    // earlier-priority alias is set, the swap silently no-ops and the
    // delegated run uses the OPERATOR's key, not the delegate's —
    // exactly the bug we're guarding against. Same shape for the
    // wallet-address alias chain.
    const tierFlag = opts.tier === 'quick' ? '--quick'
      : opts.tier === 'standard' ? '--consensus'
      : opts.tier === 'high-stakes' ? '--high-stakes'
      : '--quick';
    const args = ['node', 'doc', 'ask', docPath, opts.question, '--skill', skillId, tierFlag];

    ui.info(`invoking:            ivaronix ${args.slice(2).join(' ')}`);
    ui.info(`signing identity:    delegate (${m.delegateAddress})`);
    ui.divider();

    // Save every alias (canonical + legacy) so the finally block can
    // restore exactly what was set before this delegate run.
    const savedIvSigner = process.env.IVARONIX_SIGNER_KEY;
    const savedOgKey = process.env.OG_PRIVATE_KEY;
    const savedEvmKey = process.env.EVM_PRIVATE_KEY;
    const savedIvAddr = process.env.IVARONIX_WALLET_ADDRESS;
    const savedEvmAddr = process.env.EVM_WALLET_ADDRESS;

    // Set the canonical alias to the delegate's key/address. Delete the
    // legacy aliases so loadEnv's resolveAlias chain unambiguously
    // resolves to the canonical (delegate) value. If we left them set,
    // resolveAlias would still pick canonical first (correct) — but
    // deletion makes the swap visible in `pnpm env:check` output too.
    process.env.IVARONIX_SIGNER_KEY = delegateKey;
    process.env.IVARONIX_WALLET_ADDRESS = m.delegateAddress;
    delete process.env.OG_PRIVATE_KEY;
    delete process.env.EVM_PRIVATE_KEY;
    delete process.env.EVM_WALLET_ADDRESS;

    let runOk = false;
    try {
      await docCommand.parseAsync(args);
      runOk = process.exitCode !== 1;
    } catch (err) {
      ui.fail('delegate run threw', ((err as Error).message.split('\n')[0] ?? '').slice(0, 160));
    } finally {
      // Restore original env (or undefined if not set before).
      // We do NOT reset the exit code here. The previous version zeroed it
      // unconditionally at the end of finally to reset commander's internal
      // state for repeated subcommand parses; that mutation defeated
      // scripted callers checking $?, so a failed delegate run always
      // reported success. S-4 fix per HALF_BAKED.md: propagate runOk to
      // the exit code below the finally block instead.
      restoreEnv('IVARONIX_SIGNER_KEY', savedIvSigner);
      restoreEnv('OG_PRIVATE_KEY', savedOgKey);
      restoreEnv('EVM_PRIVATE_KEY', savedEvmKey);
      restoreEnv('IVARONIX_WALLET_ADDRESS', savedIvAddr);
      restoreEnv('EVM_WALLET_ADDRESS', savedEvmAddr);
    }

    ui.divider();
    if (runOk) {
      ui.pass(`delegate run complete`);
      ui.hint(`Receipt agent.ownerWallet = ${m.delegateAddress}, NOT ${env.walletAddress}.`);
      ui.hint(`Auditable proof: the user delegated, the agent acted, the user's signing key was never invoked.`);
      // Honest exit-code propagation: `delegate run` only succeeds when the
      // inner doc-ask command succeeded. A scripted caller now sees `$? == 0`
      // for a real success and `$? == 1` for any inner failure.
      process.exitCode = 0;
    } else {
      ui.fail(`delegate run failed`);
      process.exitCode = 1;
    }
  });
