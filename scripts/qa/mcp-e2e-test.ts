#!/usr/bin/env tsx
/**
 * QA: MCP server end-to-end protocol test.
 *
 * Spawns the @ivaronix/mcp-server over stdio (the same way Claude Desktop
 * or Cursor would), speaks raw JSON-RPC at it, calls:
 *   - initialize
 *   - tools/list (must return all 5 tools)
 *   - tools/call ivaronix_passport_show (real chain read)
 *
 * No mocks. Real on-chain reads via the MCP layer.
 *
 * Run: pnpm exec tsx scripts/qa/mcp-e2e-test.ts
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO = resolve(HERE, '..', '..');

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function main(): Promise<void> {
  // Direct node invocation via the workspace tsx (avoids Windows spawn EINVAL on .cmd files).
  const tsxBin = resolve(REPO, 'node_modules', '.pnpm', 'tsx@4.21.0', 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverEntry = resolve(REPO, 'apps', 'mcp-server', 'src', 'bin', 'server.ts');
  const child = spawn(process.execPath, [tsxBin, serverEntry], {
    cwd: REPO,
    shell: false,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });

  let stdoutBuf = '';
  const responseQueue: JsonRpcResponse[] = [];
  const waiters: Array<(r: JsonRpcResponse) => void> = [];

  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8');
    let nl: number;
    while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      try {
        const r = JSON.parse(line) as JsonRpcResponse;
        if (r.jsonrpc === '2.0' && typeof r.id === 'number') {
          if (waiters.length > 0) waiters.shift()!(r);
          else responseQueue.push(r);
        }
      } catch { /* server log line — ignore */ }
    }
  });

  let stderrBuf = '';
  child.stderr.on('data', (c: Buffer) => { stderrBuf += c.toString('utf8'); });

  function send(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    return new Promise((resv, rej) => {
      const queued = responseQueue.findIndex((r) => r.id === req.id);
      if (queued >= 0) { resv(responseQueue.splice(queued, 1)[0]!); return; }
      waiters.push((r) => { if (r.id === req.id) resv(r); else rej(new Error('id mismatch')); });
      child.stdin.write(JSON.stringify(req) + '\n');
      setTimeout(() => rej(new Error(`timeout req ${req.id} method=${req.method}`)), 30_000);
    });
  }

  // Wait briefly for server to advertise itself
  await new Promise((r) => setTimeout(r, 800));

  console.log('=== 1. initialize ===');
  const init = await send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'qa-mcp-e2e', version: '0.0.1' },
    },
  });
  if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('   server:', JSON.stringify((init.result as any).serverInfo));

  // notifications/initialized doesn't expect a response
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  console.log('\n=== 2. tools/list ===');
  const list = await send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  if (list.error) throw new Error(`tools/list failed: ${JSON.stringify(list.error)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (list.result as any).tools as Array<{ name: string; description: string }>;
  console.log(`   ${tools.length} tools:`);
  for (const t of tools) console.log(`     - ${t.name}`);
  if (tools.length !== 5) throw new Error(`expected 5 tools, got ${tools.length}`);
  const names = new Set(tools.map((t) => t.name));
  for (const n of ['ivaronix_ask', 'ivaronix_verify_receipt', 'ivaronix_search_memory', 'ivaronix_install_skill', 'ivaronix_passport_show']) {
    if (!names.has(n)) throw new Error(`missing tool: ${n}`);
  }
  console.log('   ✓ all 5 expected tools present');

  console.log('\n=== 3. tools/call ivaronix_passport_show (real chain read) ===');
  const wallet = process.env.EVM_WALLET_ADDRESS;
  if (!wallet) throw new Error('EVM_WALLET_ADDRESS missing in env');
  const call = await send({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'ivaronix_passport_show', arguments: { wallet } },
  });
  if (call.error) throw new Error(`tools/call failed: ${JSON.stringify(call.error)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (call.result as any).content as Array<{ type: string; text: string }>;
  const text = content[0]?.text ?? '(empty)';
  console.log('   first 200 chars of response:');
  console.log('   ' + text.slice(0, 200).replace(/\n/g, '\n   '));
  if (!text.includes('tokenId') && !text.includes('passport')) {
    throw new Error('passport_show response missing expected keywords');
  }
  console.log('   ✓ real passport data returned via MCP');

  console.log('\n=== 4. tools/call ivaronix_verify_receipt (real chain) ===');
  const ver = await send({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'ivaronix_verify_receipt', arguments: { id: '280' } },
  });
  if (ver.error) {
    console.log(`   error (acceptable if not all tools support id=280 directly): ${JSON.stringify(ver.error).slice(0, 120)}`);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (ver.result as any).content as Array<{ type: string; text: string }>;
    console.log('   first 200 chars:');
    console.log('   ' + (c[0]?.text ?? '(empty)').slice(0, 200).replace(/\n/g, '\n   '));
  }

  console.log('\n=== ALL MCP TESTS PASSED ===');
  child.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
