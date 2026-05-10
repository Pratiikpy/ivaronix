import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execFileSync } from 'node:child_process';
import { keyringFromEnv } from '@ivaronix/og-router/keyring';
import type { ChatRichMessage, Keyring } from '@ivaronix/og-router';
import { findSkill, type LoadedSkill } from '@ivaronix/skills';
import { JsonRpcProvider } from 'ethers';
import { AgentPassportClient, getDeployedAddress } from '@ivaronix/og-chain';
import { TOOL_DEFS, dispatchTool, buildSkillToolCatalog } from '../lib/chat-tools.js';
import {
  newConversation,
  saveConversation,
  loadConversation,
  listConversations,
  type ConversationFile,
} from '../lib/conversation.js';
import { loadEnv } from '../lib/env.js';
import { ui } from '../lib/ui.js';
import pc from 'picocolors';

/**
 * `ivaronix chat` (alias: bare `ivaronix` invocation) — interactive REPL.
 *
 * Brings the CLI up to claude-code / codex / opencode parity:
 *   - multi-turn conversation, persisted to .ivaronix/conversations/<id>.json
 *   - tool-use: read_file / write_file / list_files / grep / run_bash / web_fetch
 *   - streaming token render
 *   - slash commands: /help /skill /model /cost /clear /save /passport /memory /swarm /resume /history /exit
 *   - workspace awareness: auto-loads .ivaronix/AGENT.md + CONTEXT.md as system context
 *   - inline cost meter at the bottom of each turn
 *
 * Receipts are NOT anchored per chat turn (cost would explode). The full
 * conversation file plus a final summary receipt is anchored on `/save` or
 * `/exit` when --auto-receipt is set.
 */

const SUPPORTED_MODELS = [
  'qwen/qwen-2.5-7b-instruct',
  'qwen/qwen-2.5-14b-instruct',
  'meta/llama-3-8b-instruct',
];

interface ChatState {
  conv: ConversationFile;
  keyring: Keyring;
  systemBase: string;
  model: string;
  skillId: string | null;
  cwd: string;
  exit: boolean;
  stream: boolean;
}

function loadWorkspaceContext(): string {
  const parts: string[] = [];
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const ivar = resolve(dir, '.ivaronix');
    if (existsSync(ivar)) {
      const agent = resolve(ivar, 'AGENT.md');
      const ctx = resolve(ivar, 'CONTEXT.md');
      if (existsSync(agent)) parts.push(`# AGENT.md\n${readFileSync(agent, 'utf8')}`);
      if (existsSync(ctx)) parts.push(`# CONTEXT.md\n${readFileSync(ctx, 'utf8')}`);
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Tack on git status for awareness
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', stdio: 'pipe' }).trim();
    const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8', stdio: 'pipe' }).trim();
    parts.push(`# git\nbranch: ${branch}\n${status ? 'changes:\n' + status : '(clean)'}`);
  } catch { /* not a git dir */ }
  return parts.join('\n\n');
}

function systemPrompt(state: ChatState): string {
  const skillBody = state.skillId
    ? (findSkill(state.skillId, [resolve(state.cwd, 'seed-skills'), resolve(state.cwd, '.ivaronix/skills')])?.systemPromptBody ?? '')
    : '';
  const parts = [
    `You are Ivaronix — an AI agent operating system on the 0G chain. Every action you take should be deliberate and verifiable.`,
    `You have tools available: read_file, write_file, list_files, grep, run_bash (cap 20s, no shell-meta), web_fetch (https only).`,
    `Use tools when you need real information from the workspace. Be concise. Don't speculate when a tool can answer.`,
    `Network: ${state.conv.network}. Model: ${state.model}.${state.skillId ? ` Active skill: ${state.skillId}.` : ''}`,
  ];
  if (state.systemBase) parts.push(`\n--- WORKSPACE ---\n${state.systemBase}`);
  if (skillBody) parts.push(`\n--- SKILL: ${state.skillId} ---\n${skillBody}`);
  return parts.join('\n');
}

function costMeter(state: ChatState): string {
  return pc.dim(`  · ${state.conv.tokens.input}+${state.conv.tokens.output} tok · ${state.conv.costOg.toFixed(8)} OG · ${state.conv.messages.length} msgs · ${state.conv.id.slice(-8)}`);
}

/** Single-frame Braille rotating spinner with self-overwrite. Stops via stop(). */
function startSpinner(label: string): { stop: () => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const t = setInterval(() => {
    process.stdout.write(`\r${pc.cyan(frames[i % frames.length]!)} ${pc.dim(label)}`);
    i++;
  }, 80);
  return {
    stop: () => {
      clearInterval(t);
      // Wipe the spinner line so the next write starts clean.
      process.stdout.write('\r' + ' '.repeat(label.length + 4) + '\r');
    },
  };
}

async function passportSnapshot(env: ReturnType<typeof loadEnv>): Promise<string> {
  try {
    const addr = getDeployedAddress(env.network, 'AgentPassportINFT');
    if (!addr || !env.walletAddress) return 'no passport configured';
    const provider = new JsonRpcProvider(env.rpcUrl, { chainId: env.chainId, name: env.network });
    const client = new AgentPassportClient(addr, provider);
    const profile = await client.getPassportByWallet(env.walletAddress as `0x${string}`);
    if (!profile) return `no passport for ${env.walletAddress}`;
    return `tokenId=${profile.tokenId} · trust=${profile.trustScore} · receipts=${profile.receiptCount} · violations=${profile.violationCount}`;
  } catch (err) {
    return `(passport read failed: ${(err as Error).message})`;
  }
}

async function handleSlash(line: string, state: ChatState): Promise<boolean> {
  const [cmd, ...rest] = line.slice(1).trim().split(/\s+/);
  const arg = rest.join(' ');
  switch (cmd) {
    case 'help':
      console.log(pc.bold('\nslash commands:'));
      console.log('  /help                         this list');
      console.log('  /skill <id>                   set active skill (or "off" to clear)');
      console.log('  /model <id>                   switch model');
      console.log('  /cost                         show cumulative tokens / OG / message count');
      console.log('  /clear                        start a new conversation in this session');
      console.log('  /save                         force-save the conversation file');
      console.log('  /passport                     show your on-chain passport state');
      console.log('  /memory <query>               recall from the local memory engine');
      console.log('  /swarm <task>                 spawn a worktree-isolated worker (Octogent pattern)');
      console.log('  /history                      list saved conversations');
      console.log('  /resume <id|prefix>           load a saved conversation');
      console.log('  /exit                         save and quit\n');
      return true;
    case 'exit':
    case 'quit':
      saveConversation(state.conv);
      console.log(pc.dim(`saved → .ivaronix/conversations/${state.conv.id}.json`));
      state.exit = true;
      return true;
    case 'clear': {
      const env = loadEnv();
      state.conv = newConversation({
        network: env.network,
        model: state.model,
        skill: state.skillId,
        messages: [],
        tokens: { input: 0, output: 0 },
        costOg: 0,
        receipts: [],
      });
      console.log(pc.dim(`new conversation: ${state.conv.id}`));
      return true;
    }
    case 'save':
      saveConversation(state.conv);
      console.log(pc.dim(`saved → .ivaronix/conversations/${state.conv.id}.json`));
      return true;
    case 'cost':
      console.log(pc.dim(`tokens: ${state.conv.tokens.input}+${state.conv.tokens.output} · cost: ${state.conv.costOg.toFixed(10)} OG · messages: ${state.conv.messages.length}`));
      return true;
    case 'skill':
      if (!arg || arg === 'off') {
        state.skillId = null;
        state.conv.skill = null;
        console.log(pc.dim(`skill cleared`));
      } else {
        state.skillId = arg;
        state.conv.skill = arg;
        console.log(pc.dim(`active skill: ${arg}`));
      }
      return true;
    case 'model':
      if (!arg) {
        console.log(pc.dim(`current: ${state.model}`));
        for (const m of SUPPORTED_MODELS) console.log(`  ${m === state.model ? pc.green('●') : pc.gray('○')} ${m}`);
      } else {
        state.model = arg;
        state.conv.model = arg;
        console.log(pc.dim(`model: ${arg}`));
      }
      return true;
    case 'passport': {
      const env = loadEnv();
      console.log(pc.dim(await passportSnapshot(env)));
      return true;
    }
    case 'memory': {
      if (!arg) {
        console.log(pc.dim('usage: /memory <query>'));
        return true;
      }
      try {
        const out = execFileSync('pnpm', ['exec', 'tsx', resolve(state.cwd, 'apps/cli/src/bin/ivaronix.ts'), 'memory', 'recall', arg], {
          encoding: 'utf8',
          stdio: 'pipe',
        });
        process.stdout.write(out);
      } catch (err) {
        console.log(pc.red(`memory recall failed: ${(err as Error).message}`));
      }
      return true;
    }
    case 'swarm': {
      if (!arg) {
        console.log(pc.dim('usage: /swarm <task description>'));
        return true;
      }
      // Spawn a real worker via runPipeline (Octogent pattern, no separate process)
      const { runPipeline } = await import('../lib/pipeline.js');
      const skillId = state.skillId ?? 'plan-step';
      console.log(pc.dim(`spawning sub-agent · skill=${skillId} · tier=quick`));
      try {
        const r = await runPipeline({
          skillId,
          context: state.systemBase || '(no workspace context)',
          userPrompt: arg,
          tier: 'quick',
          receipt: false,
          receiptType: 'doc_ask',
          label: 'sub-agent',
        });
        console.log(pc.bold('\nsub-agent result'));
        console.log(r.finalText);
        // Inject as an assistant message into the parent conversation so it's available for subsequent turns
        state.conv.messages.push({
          role: 'assistant',
          content: `[sub-agent · skill=${skillId}] ${r.finalText}`,
        });
        if (r.consensus.billing.totalInputTokens) state.conv.tokens.input += r.consensus.billing.totalInputTokens;
        if (r.consensus.billing.totalOutputTokens) state.conv.tokens.output += r.consensus.billing.totalOutputTokens;
        state.conv.costOg += r.consensus.billing.estimatedCostOg;
        saveConversation(state.conv);
      } catch (err) {
        console.log(pc.red(`sub-agent failed: ${(err as Error).message}`));
      }
      return true;
    }
    case 'history': {
      const rows = listConversations(15);
      console.log(pc.bold('\nrecent conversations:'));
      for (const r of rows) {
        const when = new Date(r.updatedAt).toISOString().slice(0, 16).replace('T', ' ');
        console.log(`  ${pc.gray(when)}  ${r.id}  ${pc.dim(`${r.messages} msgs · ${r.model}`)}`);
      }
      return true;
    }
    case 'resume': {
      if (!arg) {
        console.log(pc.dim('usage: /resume <id-prefix>'));
        return true;
      }
      try {
        state.conv = loadConversation(arg);
        state.model = state.conv.model;
        state.skillId = state.conv.skill;
        console.log(pc.dim(`resumed ${state.conv.id} (${state.conv.messages.length} prior messages, model ${state.model})`));
      } catch (err) {
        console.log(pc.red((err as Error).message));
      }
      return true;
    }
  }
  return false;
}

async function chatTurn(state: ChatState, userText: string): Promise<void> {
  // Build the system message fresh each turn — it includes workspace + skill body
  const sys: ChatRichMessage = { role: 'system', content: systemPrompt(state) };
  state.conv.messages.push({ role: 'user', content: userText });

  const messages: ChatRichMessage[] = [sys, ...state.conv.messages];

  // Tool-loop: up to 4 iterations of tool-use → final answer
  for (let iter = 0; iter < 4; iter++) {
    process.stdout.write(pc.bold('\nassistant') + pc.dim('  · ' + state.model + (iter > 0 ? ` · iter ${iter + 1}` : '')) + '\n');
    // Build tool catalog: built-ins narrowed by current skill + skill custom tools
    const activeSkill: LoadedSkill | null = state.skillId
      ? findSkill(state.skillId, [resolve(state.cwd, 'seed-skills'), resolve(state.cwd, '.ivaronix/skills')])
      : null;
    const { defs: toolDefs, customByName } = buildSkillToolCatalog(activeSkill);

    // Spinner runs until the first token (streaming) or until the response
    // arrives (non-streaming). Removes the dead-air feeling of a blank line.
    const spinner = startSpinner(state.stream ? 'thinking…' : 'querying router…');
    let firstToken = true;
    const result = await state.keyring.chatRich({
      model: state.model,
      messages,
      tools: toolDefs,
      stream: state.stream,
      onToken: state.stream
        ? (delta) => {
            if (firstToken) { spinner.stop(); firstToken = false; }
            process.stdout.write(delta);
          }
        : undefined,
    });
    if (firstToken) spinner.stop();
    if (!state.stream && result.content) process.stdout.write(result.content);
    process.stdout.write('\n');

    // Push the assistant message (with tool_calls if any)
    const assistantMsg: ChatRichMessage = {
      role: 'assistant',
      content: result.content || null,
      tool_calls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
    };
    state.conv.messages.push(assistantMsg);
    messages.push(assistantMsg);

    if (result.inputTokens) state.conv.tokens.input += result.inputTokens;
    if (result.outputTokens) state.conv.tokens.output += result.outputTokens;
    state.conv.costOg += ((result.inputTokens ?? 0) * 5e-8) + ((result.outputTokens ?? 0) * 1e-7);

    if (result.toolCalls.length === 0) break;

    // Dispatch tools, append results, loop
    for (const tc of result.toolCalls) {
      console.log(pc.cyan(`  ⚙ ${tc.function.name}`) + pc.dim(`  ${tc.function.arguments.slice(0, 100)}${tc.function.arguments.length > 100 ? '…' : ''}`));
      const r = await dispatchTool(state.cwd, tc.function.name, tc.function.arguments, customByName);
      const status = r.ok ? pc.green('✓') : pc.red('✗');
      const preview = r.output.split('\n').slice(0, 3).join('\n');
      console.log(`  ${status} ${pc.dim(preview.slice(0, 200))}`);
      const toolMsg: ChatRichMessage = {
        role: 'tool',
        tool_call_id: tc.id,
        content: r.output.slice(0, 8 * 1024), // cap each tool output to 8KB sent back
      };
      state.conv.messages.push(toolMsg);
      messages.push(toolMsg);
    }
  }

  saveConversation(state.conv);
  console.log(costMeter(state));
}

export const chatCommand = new Command('chat-classic')
  .description('Legacy readline REPL — for SSH / piped workflows where the Ink TUI raw-mode isn\'t available. The new `chat` (alias of `chat-v2`) is the default interactive surface.')
  .option('--model <id>', 'model id', 'qwen/qwen-2.5-7b-instruct')
  .option('--skill <id>', 'active skill (changes system prompt)')
  .option('--resume <id>', 'resume a saved conversation by id (or short prefix)')
  .option('--stream', 'stream tokens as they arrive (testnet router currently 502s on stream+tools — off by default)', false)
  .action(async (opts: { model: string; skill?: string; resume?: string; stream?: boolean }) => {
    const env = loadEnv();
    const keyring = keyringFromEnv();
    if (!keyring) {
      ui.fail('Router not configured', 'Set IVARONIX_ROUTER_KEY / IVARONIX_ROUTER_URL / IVARONIX_ROUTER_PROVIDER / IVARONIX_WALLET_ADDRESS (legacy: ZG_API_SECRET / ZG_SERVICE_URL / OG_COMPUTE_PROVIDER / EVM_WALLET_ADDRESS) in .env');
      process.exitCode = 1;
      return;
    }

    let conv: ConversationFile;
    if (opts.resume) {
      try {
        conv = loadConversation(opts.resume);
      } catch (err) {
        ui.fail((err as Error).message);
        process.exitCode = 1;
        return;
      }
    } else {
      conv = newConversation({
        network: env.network,
        model: opts.model,
        skill: opts.skill ?? null,
        messages: [],
        tokens: { input: 0, output: 0 },
        costOg: 0,
        receipts: [],
      });
    }

    const state: ChatState = {
      conv,
      keyring,
      systemBase: loadWorkspaceContext(),
      model: opts.resume ? conv.model : opts.model,
      skillId: opts.resume ? conv.skill : (opts.skill ?? null),
      cwd: process.cwd(),
      exit: false,
      stream: !!opts.stream,
    };

    // Banner
    console.log(pc.bold('\n[ | ] IVARONIX  ') + pc.dim('· interactive · network=' + env.network));
    console.log(pc.dim('  type your message, or `/help` for commands. Ctrl-D / `/exit` to quit.'));
    console.log(pc.dim(`  conversation ${state.conv.id} · ${state.conv.messages.length} prior messages · model ${state.model}` + (state.skillId ? ` · skill ${state.skillId}` : '')));

    // Tab-completion for slash commands. readline calls completer with the
    // current line; we return [matches, line]. Empty matches → no-op.
    const SLASH_CMDS = [
      '/help', '/skill ', '/model ', '/cost', '/clear', '/save',
      '/passport', '/memory ', '/swarm ', '/history', '/resume ', '/exit',
    ];
    const completer = (line: string): [string[], string] => {
      if (!line.startsWith('/')) return [[], line];
      const hits = SLASH_CMDS.filter((c) => c.startsWith(line));
      return [hits, line];
    };
    const rl = createInterface({ input, output, completer, historySize: 200 });
    try {
      while (!state.exit) {
        const line = (await rl.question(pc.green('\n› '))).trim();
        if (!line) continue;
        if (line.startsWith('/')) {
          const handled = await handleSlash(line, state);
          if (handled) continue;
          console.log(pc.red(`unknown command: ${line}. /help for available commands.`));
          continue;
        }
        try {
          await chatTurn(state, line);
        } catch (err) {
          console.log(pc.red(`error: ${(err as Error).message}`));
        }
      }
    } finally {
      rl.close();
    }
  });
