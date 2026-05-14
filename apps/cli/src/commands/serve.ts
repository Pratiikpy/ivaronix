// /v1/receipt/<id> walks V3 → V2 → V1 + reports registry version (matches studio + mcp).
// /v1/passport/<addr> reads V2 → V1 + reports contract version (matches CLI passport show + mcp).
// /healthz returns receiptsV1, receiptsV2, receiptsV3 separately + passports (V2-first count).
// Closes V3 lookup waiver (USER_TODO §B-V2-37) and V1 passport waiver (USER_TODO §B-V2-38 · ✅ shipped) for this surface.
import { Command } from 'commander';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { JsonRpcProvider } from 'ethers';
import {
  ReceiptRegistryClient,
  ReceiptRegistryV2Client,
  ReceiptRegistryV3Client,
  AgentPassportClient,
  getDeployedAddress,
} from '@ivaronix/og-chain';
import { runPipeline, createCaptureLogger } from '@ivaronix/runtime';
import { loadSkillsFromDir } from '@ivaronix/skills';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';

/**
 * `ivaronix serve` — embedded HTTP server (PRD §3 "API + MCP").
 *
 * Endpoints:
 *   GET  /healthz                          → {ok, network, receipts, passports}
 *   GET  /v1/skills[?q=substring]          → installed skill list
 *   GET  /v1/passport/<wallet>             → passport profile
 *   GET  /v1/receipt/<id>                  → on-chain receipt state
 *   POST /v1/run                           → {skillId, context, userPrompt, tier?, receipt?}
 *                                              → runs runPipeline; returns the same
 *                                                payload Studio's /api/run returns
 *   POST /v1/chat/completions              → OpenAI-compatible single-shot chat
 *
 * Same wallet signs receipts as the CLI/MCP/Studio. No daemon-fork-required.
 */

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

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

export const serveCommand = new Command('serve')
  .description('Embedded HTTP API exposing the same surface as MCP + Studio /api/run')
  .option('-p, --port <n>', 'port to bind', '8788')
  .option('-h, --host <addr>', 'host to bind', '127.0.0.1')
  .action(async (opts: { port: string; host: string }) => {
    const env = loadEnv();
    const port = Math.max(1, parseInt(opts.port, 10) || 8788);

    const server = createServer(async (req, res) => {
      try {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.end();
          return;
        }

        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

        if (req.method === 'GET' && url.pathname === '/healthz') {
          const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
          const regV1 = getDeployedAddress(env.network, 'ReceiptRegistry');
          const regV2 = getDeployedAddress(env.network, 'ReceiptRegistryV2');
          const regV3 = getDeployedAddress(env.network, 'ReceiptRegistryV3');
          // Passport count from V2 (active target post-K-2); V1 fallback
          // for chains that haven't deployed V2 yet. Total counts mirror
          // CLI doctor + Studio /global headline.
          const passportV2 = getDeployedAddress(env.network, 'AgentPassportINFTV2');
          const passportV1 = getDeployedAddress(env.network, 'AgentPassportINFT');
          // Anchored count = nextId - 1 on each registry (1-indexed).
          // Sum V1 + V2 + V3 for the total receipts count exposed via /healthz.
          const [v1, v2, v3, p] = await Promise.all([
            regV1 ? new ReceiptRegistryClient(regV1, provider).nextId().then((n) => Math.max(0, Number(n) - 1)).catch(() => null) : null,
            regV2 ? new ReceiptRegistryV2Client(regV2, provider).nextId().then((n) => Math.max(0, Number(n) - 1)).catch(() => null) : null,
            regV3 ? new ReceiptRegistryV3Client(regV3, provider).nextId().then((n) => Math.max(0, Number(n) - 1)).catch(() => null) : null,
            // V2 passport is the active target; V1 fallback when V2 is not deployed
            (passportV2
              ? new AgentPassportClient(passportV2, provider).nextTokenId().then((n) => Math.max(0, Number(n) - 1)).catch(() => null)
              : passportV1
                ? new AgentPassportClient(passportV1, provider).nextTokenId().then((n) => Math.max(0, Number(n) - 1)).catch(() => null)
                : null),
          ]);
          const receipts = (v1 ?? 0) + (v2 ?? 0) + (v3 ?? 0);
          return json(res, 200, {
            ok: true,
            network: env.network,
            receipts,
            receiptsV1: v1,
            receiptsV2: v2,
            receiptsV3: v3,
            passports: p,
          });
        }

        if (req.method === 'GET' && url.pathname === '/v1/skills') {
          const root = findSeedSkillsRoot();
          const all = root ? loadSkillsFromDir(root) : [];
          const q = url.searchParams.get('q')?.toLowerCase() ?? '';
          const filtered = q ? all.filter((s) => s.id.toLowerCase().includes(q)) : all;
          return json(res, 200, {
            count: filtered.length,
            skills: filtered.map((s) => ({
              id: s.id,
              version: s.manifest.version,
              description: s.manifest.description,
              defaultTier: s.manifest.og.consensus.default_tier,
              burnAuto: s.manifest.og.burn.auto_enable,
              manifestHash: s.manifestHash,
            })),
          });
        }

        const passportMatch = url.pathname.match(/^\/v1\/passport\/(0x[0-9a-fA-F]{40})$/);
        if (req.method === 'GET' && passportMatch) {
          const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
          // V2-first read (matches CLI passport show + Studio dashboard).
          // Operator-funded V2 is the active passport target.
          const addrV2 = getDeployedAddress(env.network, 'AgentPassportINFTV2');
          const addrV1 = getDeployedAddress(env.network, 'AgentPassportINFT');
          if (!addrV1 && !addrV2) {
            return json(res, 503, { error: `AgentPassportINFT not deployed on ${env.network}` });
          }
          let profile;
          let passportVersion: 'v1' | 'v2' | null = null;
          if (addrV2) {
            profile = await new AgentPassportClient(addrV2, provider)
              .getPassportByWallet(passportMatch[1] as `0x${string}`)
              .catch(() => null);
            if (profile) passportVersion = 'v2';
          }
          if (!profile && addrV1) {
            profile = await new AgentPassportClient(addrV1, provider)
              .getPassportByWallet(passportMatch[1] as `0x${string}`)
              .catch(() => null);
            if (profile) passportVersion = 'v1';
          }
          if (!profile) return json(res, 404, { error: `no passport for ${passportMatch[1]}` });
          return json(res, 200, {
            tokenId: profile.tokenId.toString(),
            wallet: passportMatch[1],
            trustScore: profile.trustScore.toString(),
            receiptCount: profile.receiptCount.toString(),
            violationCount: profile.violationCount.toString(),
            contract: passportVersion ?? 'unknown',
            network: env.network,
          });
        }

        const receiptMatch = url.pathname.match(/^\/v1\/receipt\/(.+)$/);
        if (req.method === 'GET' && receiptMatch) {
          const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
          const v1Addr = getDeployedAddress(env.network, 'ReceiptRegistry');
          const v2Addr = getDeployedAddress(env.network, 'ReceiptRegistryV2');
          const v3Addr = getDeployedAddress(env.network, 'ReceiptRegistryV3');
          if (!v1Addr && !v2Addr && !v3Addr) {
            return json(res, 503, { error: `ReceiptRegistry (V1, V2, or V3) not deployed on ${env.network}` });
          }
          const id = receiptMatch[1]!;
          // V3 → V2 → V1 read order matches apps/studio/src/lib/chain.ts
          // unifiedGetReceipt + apps/mcp-server/src/server.ts. V3 admits
          // canonical slots 10/11/12; V2 is active type-0 anchor target;
          // V1 holds 1644+ legacy receipts.
          let onChain;
          let registryVersion: 'v1' | 'v2' | 'v3' | null = null;
          if (v3Addr) {
            const reg = new ReceiptRegistryV3Client(v3Addr, provider);
            if (/^\d+$/.test(id)) onChain = await reg.getReceipt(BigInt(id)).catch(() => null);
            else if (/^0x[0-9a-f]{64}$/i.test(id)) onChain = await reg.findByReceiptRoot(id as `0x${string}`, 200_000).catch(() => null);
            if (onChain) registryVersion = 'v3';
          }
          if (!onChain && v2Addr) {
            const reg = new ReceiptRegistryV2Client(v2Addr, provider);
            if (/^\d+$/.test(id)) onChain = await reg.getReceipt(BigInt(id)).catch(() => null);
            else if (/^0x[0-9a-f]{64}$/i.test(id)) onChain = await reg.findByReceiptRoot(id as `0x${string}`, 200_000).catch(() => null);
            if (onChain) registryVersion = 'v2';
          }
          if (!onChain && v1Addr) {
            const reg = new ReceiptRegistryClient(v1Addr, provider);
            if (/^\d+$/.test(id)) onChain = await reg.getReceipt(BigInt(id)).catch(() => null);
            else if (/^0x[0-9a-f]{64}$/i.test(id)) onChain = await reg.findByReceiptRoot(id as `0x${string}`, 200_000).catch(() => null);
            if (onChain) registryVersion = 'v1';
          }
          if (!onChain) return json(res, 404, { error: `no receipt for ${id}` });
          return json(res, 200, {
            id: onChain.id.toString(),
            receiptRoot: onChain.receiptRoot,
            agent: onChain.agentAddress,
            type: onChain.receiptType,
            timestamp: onChain.timestamp.toString(),
            registry: registryVersion ?? 'unknown',
            state: 'ANCHORED',
          });
        }

        if (req.method === 'POST' && url.pathname === '/v1/run') {
          const body = await readBody(req);
          if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid JSON body' });
          const b = body as { skillId?: string; context?: string; userPrompt?: string; tier?: 'quick' | 'standard' | 'high-stakes'; receipt?: boolean };
          if (!b.skillId || !b.context || !b.userPrompt) {
            return json(res, 400, { error: 'skillId, context, userPrompt required' });
          }
          const { logger, entries } = createCaptureLogger();
          try {
            const r = await runPipeline({
              skillId: b.skillId,
              context: b.context,
              userPrompt: b.userPrompt,
              tier: b.tier,
              receipt: !!b.receipt,
              receiptType: 'doc_ask',
              logger,
            });
            return json(res, 200, {
              ok: true,
              finalText: r.finalText,
              consensusMs: r.consensusMs,
              inputTokens: r.consensus.billing.totalInputTokens,
              outputTokens: r.consensus.billing.totalOutputTokens,
              costOg: r.consensus.billing.estimatedCostOg,
              receiptId: r.receiptId,
              receiptTxHash: r.receiptTxHash,
              receiptOnchainId: r.receiptOnchainId !== null ? r.receiptOnchainId.toString() : null,
              skill: { id: r.skill.id, version: r.skill.manifest.version },
              logs: entries,
            });
          } catch (err) {
            return json(res, 500, { ok: false, error: (err as Error).message, logs: entries });
          }
        }

        if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
          // OpenAI-compatible single-shot chat through the runtime keyring
          const body = await readBody(req);
          if (!body || typeof body !== 'object') return json(res, 400, { error: 'invalid JSON body' });
          const b = body as { messages?: { role: string; content: string }[]; model?: string };
          if (!b.messages || b.messages.length === 0) return json(res, 400, { error: 'messages[] required' });
          const { keyringFromEnv } = await import('@ivaronix/og-router/keyring');
          const keyring = keyringFromEnv();
          if (!keyring) return json(res, 503, { error: 'router not configured' });
          const last = b.messages[b.messages.length - 1]!;
          const sys = b.messages.find((m) => m.role === 'system')?.content;
          const r = await keyring.chat({
            model: b.model ?? env.defaultModel,
            systemPrompt: sys,
            userPrompt: last.content,
          });
          return json(res, 200, {
            id: `cmpl-${Date.now()}`,
            object: 'chat.completion',
            model: b.model ?? env.defaultModel,
            choices: [{ index: 0, message: { role: 'assistant', content: r.content }, finish_reason: 'stop' }],
            usage: { prompt_tokens: r.inputTokens ?? 0, completion_tokens: r.outputTokens ?? 0 },
          });
        }

        json(res, 404, { error: `route ${req.method} ${url.pathname} not found` });
      } catch (err) {
        json(res, 500, { error: (err as Error).message });
      }
    });

    server.listen(port, opts.host, () => {
      ui.title('ivaronix serve');
      ui.pass(`listening            http://${opts.host}:${port}`);
      ui.info(`network              ${env.network}`);
      ui.divider();
      ui.hint(`GET  /healthz`);
      ui.hint(`GET  /v1/skills[?q=...]`);
      ui.hint(`GET  /v1/passport/<wallet>`);
      ui.hint(`GET  /v1/receipt/<id-or-root>`);
      ui.hint(`POST /v1/run                  {skillId,context,userPrompt,tier?,receipt?}`);
      ui.hint(`POST /v1/chat/completions     OpenAI-compatible single-shot`);
    });
  });
