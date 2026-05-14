// Receipt verify path reads V3 → V2 → V1 (operator-funded V3 deployed; lookup matches studio/lib/chain.ts unifiedGetReceipt order). Anchor branch for slot 10+ MCP flows (doc_room_*, memory_consolidation) still queued — tracked in USER_TODO §B-V2-37.
// Passport tool reads V2 → V1 (matches CLI passport show + Studio dashboard). Closes V1-only waiver originally queued in USER_TODO §B-V2-38.
// Memory search reads V2 → V1 for both CapabilityRegistry + MemoryAccessLog (matches Studio /memory). Closes the V1-only waivers originally queued in USER_TODO §B-V2-39 + §B-V2-41.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { JsonRpcProvider, Wallet } from 'ethers';
import {
  ReceiptRegistryClient,
  ReceiptRegistryV2Client,
  ReceiptRegistryV3Client,
  AgentPassportClient,
  SkillRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { runPipeline, loadEnv } from '@ivaronix/runtime';
import { loadSkillsFromDir, type LoadedSkill } from '@ivaronix/skills';
import { MemoryEngine } from '@ivaronix/memory';
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import type { ConsensusTier, Address } from '@ivaronix/core';

/**
 * Ivaronix MCP Server.
 *
 * Exposes Ivaronix as an MCP server so Claude Desktop / Cursor / Codex /
 * any MCP-aware client can call into the testnet runtime. Five tools:
 *   - ivaronix.ask           run a skill against text
 *   - ivaronix.verifyReceipt resolve a receipt by id and report state
 *   - ivaronix.searchMemory  search the local memory engine
 *   - ivaronix.installSkill  list-only for now (publish stays a CLI op)
 *   - ivaronix.passportShow  read passport state for a wallet
 *
 * The server signs every receipt with the workspace `.env` private key,
 * exactly the same wallet that the CLI + Studio API use. Compatible with
 * any MCP transport — this build uses stdio (the standard).
 */

// ─── Tool input schemas ──────────────────────────────────────────────────────
const AskInput = z.object({
  skillId: z.string().min(1).describe('Skill id (e.g. "github-audit", "private-doc-review")'),
  question: z.string().min(1).describe('User-facing instruction or question'),
  contentText: z.string().min(1).describe('Plaintext content the skill will analyze'),
  tier: z.enum(['quick', 'standard', 'high-stakes']).optional(),
  receipt: z.boolean().default(true).describe('Anchor a receipt on chain'),
});

const VerifyReceiptInput = z.object({
  id: z.string().min(1).describe('On-chain numeric id (e.g. "18") or 0x bytes32 receiptRoot'),
});

const SearchMemoryInput = z.object({
  query: z.string().min(1),
  k: z.number().int().min(1).max(20).default(5),
});

const InstallSkillInput = z.object({
  query: z.string().optional().describe('Filter skills whose id includes this string'),
});

const PassportShowInput = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('Wallet address'),
});

// ─── Tool handlers ───────────────────────────────────────────────────────────
async function handleAsk(params: z.infer<typeof AskInput>): Promise<CallToolResult> {
  const r = await runPipeline({
    skillId: params.skillId,
    context: params.contentText,
    userPrompt: params.question,
    tier: params.tier as ConsensusTier | undefined,
    receipt: params.receipt,
    receiptType: 'doc_ask',
  });
  const txt = [
    r.finalText,
    '',
    '---',
    `skill        ${r.skill.id}@${r.skill.manifest.version}`,
    `tokens       ${r.consensus.billing.totalInputTokens}+${r.consensus.billing.totalOutputTokens}`,
    `cost         ${r.consensus.billing.estimatedCostOg.toFixed(8)} OG`,
    `convergence  ${r.consensus.convergence.score ?? '—'}`,
    r.receiptId ? `receiptId    ${r.receiptId}` : '',
    r.receiptTxHash ? `receiptTx    ${r.receiptTxHash}` : '',
    r.receiptOnchainId !== null ? `onchainId    ${r.receiptOnchainId.toString()}` : '',
  ].filter(Boolean).join('\n');
  return { content: [{ type: 'text', text: txt }] };
}

async function handleVerifyReceipt(params: z.infer<typeof VerifyReceiptInput>): Promise<CallToolResult> {
  const env = loadEnv();
  const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
  // V3 → V2 → V1 read order matches apps/studio/src/lib/chain.ts
  // unifiedGetReceipt. V3 admits canonical slots 10/11/12 (doc_room_*,
  // memory_consolidation); V2 is the active type-0 anchor target; V1
  // is the legacy registry with 1644+ historical receipts.
  const addrV3 = getDeployedAddress(env.network, 'ReceiptRegistryV3');
  const addrV2 = getDeployedAddress(env.network, 'ReceiptRegistryV2');
  const addrV1 = getDeployedAddress(env.network, 'ReceiptRegistry');
  if (!addrV1 && !addrV2 && !addrV3) {
    return { content: [{ type: 'text', text: `ReceiptRegistry not deployed on ${env.network}` }], isError: true };
  }
  const regV3 = addrV3 ? new ReceiptRegistryV3Client(addrV3, provider) : null;
  const regV2 = addrV2 ? new ReceiptRegistryV2Client(addrV2, provider) : null;
  const regV1 = addrV1 ? new ReceiptRegistryClient(addrV1, provider) : null;
  let onChain;
  let registryVersion: 'v1' | 'v2' | 'v3' | null = null;
  if (/^\d+$/.test(params.id)) {
    const id = BigInt(params.id);
    if (regV3) { const r = await regV3.getReceipt(id); if (r) { onChain = r; registryVersion = 'v3'; } }
    if (!onChain && regV2) { const r = await regV2.getReceipt(id); if (r) { onChain = r; registryVersion = 'v2'; } }
    if (!onChain && regV1) { const r = await regV1.getReceipt(id); if (r) { onChain = r; registryVersion = 'v1'; } }
  } else if (/^0x[0-9a-f]{64}$/i.test(params.id)) {
    const root = params.id as `0x${string}`;
    if (regV3) { const r = await regV3.findByReceiptRoot(root, 200_000); if (r) { onChain = r; registryVersion = 'v3'; } }
    if (!onChain && regV2) { const r = await regV2.findByReceiptRoot(root, 200_000); if (r) { onChain = r; registryVersion = 'v2'; } }
    if (!onChain && regV1) { const r = await regV1.findByReceiptRoot(root, 200_000); if (r) { onChain = r; registryVersion = 'v1'; } }
  }
  if (!onChain) return { content: [{ type: 'text', text: `No receipt found for ${params.id}` }] };
  const lines = [
    `id              ${onChain.id.toString()}`,
    `receiptRoot     ${onChain.receiptRoot}`,
    `agent           ${onChain.agentAddress}`,
    `type            code ${onChain.receiptType}`,
    `anchored        block ${onChain.timestamp}`,
    `registry        ${registryVersion?.toUpperCase() ?? '?'}`,
    `state           ANCHORED`,
  ].join('\n');
  return { content: [{ type: 'text', text: lines }] };
}

async function handleSearchMemory(params: z.infer<typeof SearchMemoryInput>): Promise<CallToolResult> {
  // Wires the @ivaronix/memory engine into the MCP runtime. Reads the same
  // SQLite db the CLI writes to (.ivaronix/memory/ivaronix.db), so an
  // observation stored via `ivaronix memory remember` is immediately
  // recallable from any MCP-aware client. Skips the on-chain access-log
  // emission because read paths already log via engine.recall().
  const env = loadEnv();
  if (!env.privateKey || !env.walletAddress) {
    return {
      content: [{
        type: 'text',
        text: 'memory engine requires IVARONIX_SIGNER_KEY + IVARONIX_WALLET_ADDRESS (legacy: EVM_PRIVATE_KEY + EVM_WALLET_ADDRESS) in the server env',
      }],
    };
  }
  // The CLI writes the memory db to `<cwd>/.ivaronix/memory/ivaronix.db`,
  // which in practice is `apps/cli/.ivaronix/...` for most workflows.
  // Resolve relative to the workspace root (parent of pnpm-workspace.yaml)
  // so the MCP server picks up whichever package's db exists. Search order:
  //   1. existing .ivaronix/memory/ivaronix.db at workspace root
  //   2. existing one under apps/cli/.ivaronix/memory/ (the CLI default)
  //   3. fall back to creating at workspace root
  const dbPath = (() => {
    let dir = process.cwd();
    let workspaceRoot: string | null = null;
    for (let i = 0; i < 8; i++) {
      if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) { workspaceRoot = dir; break; }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    const candidates = [
      workspaceRoot && resolve(workspaceRoot, '.ivaronix', 'memory', 'ivaronix.db'),
      workspaceRoot && resolve(workspaceRoot, 'apps', 'cli', '.ivaronix', 'memory', 'ivaronix.db'),
    ].filter(Boolean) as string[];
    for (const c of candidates) if (existsSync(c)) return c;
    return candidates[0] ?? resolve(process.cwd(), '.ivaronix', 'memory', 'ivaronix.db');
  })();
  mkdirSync(dirname(dbPath), { recursive: true });
  // V2-first capability + access-log addresses; V1 fallback for the
  // older deploys still on chain. Studio /memory already reads V2.
  const capAddr = getDeployedAddress(env.network, 'CapabilityRegistryV2')
    ?? getDeployedAddress(env.network, 'CapabilityRegistry');
  const logAddr = getDeployedAddress(env.network, 'MemoryAccessLogV2')
    ?? getDeployedAddress(env.network, 'MemoryAccessLog');
  const engine = MemoryEngine.create({
    ownerWallet: env.walletAddress as Address,
    ownerPrivateKey: env.privateKey,
    dbPath,
    enableOnChainPermissions: Boolean(capAddr && logAddr),
    capabilityRegistryAddress: (capAddr ?? undefined) as Address | undefined,
    memoryAccessLogAddress: (logAddr ?? undefined) as Address | undefined,
    rpcUrl: env.rpcUrl,
    chainId: env.chainId,
  });
  const { hits, logTxHash } = await engine.recall({ text: params.query, topK: params.k });
  if (hits.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No matches for "${params.query}".${logTxHash ? `\n(access log tx ${logTxHash})` : ''}`,
      }],
    };
  }
  const lines = hits.map(
    (h, i) =>
      `#${i + 1}  score ${h.score.toFixed(3)}  vec ${h.vectorScore.toFixed(3)}  fts ${h.ftsScore.toFixed(3)}  [${h.tags.join(', ')}]\n    ${h.text}`,
  );
  if (logTxHash) lines.push(`\naccess log tx ${logTxHash}`);
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

function findSeedSkillsRoot(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, 'seed-skills');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function handleInstallSkill(params: z.infer<typeof InstallSkillInput>): Promise<CallToolResult> {
  const root = findSeedSkillsRoot();
  const all: LoadedSkill[] = root ? loadSkillsFromDir(root) : [];
  const filter = params.query?.toLowerCase();
  const list = filter ? all.filter((s: LoadedSkill) => s.id.toLowerCase().includes(filter)) : all;
  const lines = list.slice(0, 30).map((s: LoadedSkill) => `${s.id.padEnd(40)} v${s.manifest.version}  tier=${s.manifest.og.consensus.default_tier}`);
  const total = list.length;
  const text = [
    `Found ${total} skill${total === 1 ? '' : 's'}${filter ? ` matching "${filter}"` : ''}.`,
    '',
    ...lines,
    total > 30 ? `… (${total - 30} more)` : '',
  ].filter(Boolean).join('\n');
  return { content: [{ type: 'text', text }] };
}

async function handlePassportShow(params: z.infer<typeof PassportShowInput>): Promise<CallToolResult> {
  const env = loadEnv();
  const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
  // V2-first read per .claude/rules/og-chain.md. Operator-funded V2 is
  // the active passport target; V1 is preserved for legacy passports
  // minted before the K-2 migration. Same shape as CLI passport show
  // (apps/cli/src/commands/passport.ts:217-242) and Studio dashboard.
  const addrV2 = getDeployedAddress(env.network, 'AgentPassportINFTV2');
  const addrV1 = getDeployedAddress(env.network, 'AgentPassportINFT');
  if (!addrV1 && !addrV2) {
    return { content: [{ type: 'text', text: `AgentPassportINFT not deployed on ${env.network}` }], isError: true };
  }
  let profile;
  let passportVersion: 'v1' | 'v2' | null = null;
  if (addrV2) {
    const v2 = new AgentPassportClient(addrV2, provider);
    profile = await v2.getPassportByWallet(params.wallet as `0x${string}`);
    if (profile) passportVersion = 'v2';
  }
  if (!profile && addrV1) {
    const v1 = new AgentPassportClient(addrV1, provider);
    profile = await v1.getPassportByWallet(params.wallet as `0x${string}`);
    if (profile) passportVersion = 'v1';
  }
  if (!profile) return { content: [{ type: 'text', text: `No passport for ${params.wallet} on ${env.network}` }] };
  const lines = [
    `tokenId        ${profile.tokenId}`,
    `wallet         ${params.wallet}`,
    `trustScore     ${profile.trustScore}`,
    `receiptCount   ${profile.receiptCount}`,
    `violations     ${profile.violationCount}`,
    `contract       ${passportVersion?.toUpperCase() ?? '?'}`,
    `network        ${env.network}`,
  ].join('\n');
  return { content: [{ type: 'text', text: lines }] };
}

// ─── Server wiring ───────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'ivaronix_ask',
    description: 'Run an Ivaronix skill against text input. Optionally anchors a verifiable Action Receipt on 0G Chain. Use when the user wants to audit a document/contract/code or get any skill-driven answer.',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string', description: 'Skill id (e.g. github-audit, private-doc-review)' },
        question: { type: 'string', description: 'User-facing instruction' },
        contentText: { type: 'string', description: 'Plaintext content to analyze' },
        tier: { type: 'string', enum: ['quick', 'standard', 'high-stakes'] },
        receipt: { type: 'boolean', default: true },
      },
      required: ['skillId', 'question', 'contentText'],
    },
  },
  {
    name: 'ivaronix_verify_receipt',
    description: 'Resolve a receipt by on-chain numeric id or 0x bytes32 receiptRoot and report its state.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'ivaronix_search_memory',
    description: 'Search the local Ivaronix memory engine (4-way hybrid: vector + FTS + temporal + KV).',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, k: { type: 'number' } },
      required: ['query'],
    },
  },
  {
    name: 'ivaronix_install_skill',
    description: 'List available Ivaronix skills, optionally filtered by substring of the skill id.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
    },
  },
  {
    name: 'ivaronix_passport_show',
    description: 'Read the on-chain AgentPassport profile for a wallet address.',
    inputSchema: {
      type: 'object',
      properties: { wallet: { type: 'string' } },
      required: ['wallet'],
    },
  },
] as const;

export function createIvaronixMcpServer(): Server {
  const server = new Server(
    { name: 'ivaronix-mcp', version: '0.0.1' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS as unknown as Array<typeof TOOLS[number]> }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      switch (req.params.name) {
        case 'ivaronix_ask':       return await handleAsk(AskInput.parse(req.params.arguments));
        case 'ivaronix_verify_receipt': return await handleVerifyReceipt(VerifyReceiptInput.parse(req.params.arguments));
        case 'ivaronix_search_memory':  return await handleSearchMemory(SearchMemoryInput.parse(req.params.arguments));
        case 'ivaronix_install_skill':  return await handleInstallSkill(InstallSkillInput.parse(req.params.arguments));
        case 'ivaronix_passport_show':  return await handlePassportShow(PassportShowInput.parse(req.params.arguments));
        default:
          return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
      }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }], isError: true };
    }
  });

  return server;
}
