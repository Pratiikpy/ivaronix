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
  AgentPassportClient,
  SkillRegistryClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { runPipeline, loadEnv } from '@ivaronix/runtime';
import { loadSkillsFromDir, type LoadedSkill } from '@ivaronix/skills';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { ConsensusTier } from '@ivaronix/core';

/**
 * Ivaronix MCP Server.
 *
 * Exposes Ivaronix as an MCP server so Claude Desktop / Cursor / Codex /
 * any MCP-aware client can call into the testnet runtime. Five tools per
 * BUILD.md §Day 20:
 *   - ivaronix.ask           run a skill against text
 *   - ivaronix.verifyReceipt resolve a receipt by id and report state
 *   - ivaronix.searchMemory  search the local memory engine (Day-8)
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
  const addr = getDeployedAddress(env.network, 'ReceiptRegistry');
  if (!addr) return { content: [{ type: 'text', text: `ReceiptRegistry not deployed on ${env.network}` }], isError: true };
  const reg = new ReceiptRegistryClient(addr, provider);
  let onChain;
  if (/^\d+$/.test(params.id)) onChain = await reg.getReceipt(BigInt(params.id));
  else if (/^0x[0-9a-f]{64}$/i.test(params.id)) onChain = await reg.findByReceiptRoot(params.id as `0x${string}`, 200_000);
  if (!onChain) return { content: [{ type: 'text', text: `No receipt found for ${params.id}` }] };
  const lines = [
    `id              ${onChain.id.toString()}`,
    `receiptRoot     ${onChain.receiptRoot}`,
    `agent           ${onChain.agentAddress}`,
    `type            code ${onChain.receiptType}`,
    `anchored        block ${onChain.timestamp}`,
    `state           ANCHORED`,
  ].join('\n');
  return { content: [{ type: 'text', text: lines }] };
}

async function handleSearchMemory(params: z.infer<typeof SearchMemoryInput>): Promise<CallToolResult> {
  // The full memory engine lives in `@ivaronix/memory` and binds to better-sqlite3
  // — that's a server-only path. For Day 20 we expose a stub that points the
  // caller at the CLI; Day 22 wires the engine into the server runtime.
  return {
    content: [{
      type: 'text',
      text: `Search "${params.query}" (k=${params.k}) — run \`ivaronix memory search\` from the CLI; engine integration in MCP arrives Day 22.`,
    }],
  };
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
  const addr = getDeployedAddress(env.network, 'AgentPassportINFT');
  if (!addr) return { content: [{ type: 'text', text: `AgentPassportINFT not deployed on ${env.network}` }], isError: true };
  const client = new AgentPassportClient(addr, provider);
  const profile = await client.getPassportByWallet(params.wallet as `0x${string}`);
  if (!profile) return { content: [{ type: 'text', text: `No passport for ${params.wallet} on ${env.network}` }] };
  const lines = [
    `tokenId        ${profile.tokenId}`,
    `wallet         ${params.wallet}`,
    `trustScore     ${profile.trustScore}`,
    `receiptCount   ${profile.receiptCount}`,
    `violations     ${profile.violationCount}`,
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
