/**
 * MCP server stdio smoke test.
 *
 * Spawns apps/mcp-server/src/bin/server.ts via tsx · pipes JSON-RPC
 * messages over stdin · captures stdout responses.
 *
 * Tests:
 *  1. tools/list
 *  2. tools/call · verify_receipt id=4 network=mainnet
 *  3. tools/call · passport_show OR receipt_show (whatever's safe + read-only)
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), 'QA_PROOF_PACK/submission-final/mcp-smoke');
mkdirSync(OUT, { recursive: true });

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function smoke(): Promise<void> {
  console.log('Spawning MCP server (tsx src/bin/server.ts) ...');
  // Spawn tsx directly against the MCP server entrypoint (avoids Windows pnpm.cmd ENOENT)
  const mcpEntry = resolve(process.cwd(), 'apps/mcp-server/src/bin/server.ts');
  const proc = spawn('npx', ['tsx', mcpEntry], {
    cwd: resolve(process.cwd(), 'apps/mcp-server'),
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, IVARONIX_NETWORK: 'mainnet', IVARONIX_RPC_URL: 'https://evmrpc.0g.ai', IVARONIX_CHAIN_ID: '16661' },
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  proc.stdout.on('data', (b) => { stdoutBuf += b.toString(); });
  proc.stderr.on('data', (b) => { stderrBuf += b.toString(); });

  // Helper to send a JSON-RPC request and wait for the matching response
  const responses: JsonRpcResponse[] = [];
  let idCounter = 1;
  async function call(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = idCounter++;
    const req = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    console.log(`-> ${method}`);
    proc.stdin.write(req);
    // Wait for response with matching id (timeout 30s)
    const startedAt = Date.now();
    while (Date.now() - startedAt < 30_000) {
      const lines = stdoutBuf.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        try {
          const j = JSON.parse(lines[i]!) as JsonRpcResponse;
          if (j.id === id) {
            // Trim the consumed line from buffer
            stdoutBuf = lines.slice(i + 1).join('\n');
            responses.push(j);
            return j;
          }
        } catch { /* skip non-json line */ }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`timeout waiting for response id ${id}`);
  }

  // Initialize handshake (MCP spec)
  await call('initialize', { protocolVersion: '2024-11-05', capabilities: { tools: {} }, clientInfo: { name: 'ivaronix-judge-mcp-smoke', version: '0.0.1' } });

  // 1. List tools
  const listResp = await call('tools/list', {});
  console.log(`tools/list response keys: ${listResp.result ? Object.keys(listResp.result).join(', ') : 'no result'}`);
  const toolList = (listResp.result as { tools?: Array<{ name: string; description?: string }> })?.tools ?? [];
  console.log(`Found ${toolList.length} MCP tools:`);
  for (const t of toolList) console.log(`  - ${t.name}: ${(t.description ?? '').slice(0, 80)}`);

  // 2. Find a verify_receipt tool name (could be receipt_verify or verify_receipt)
  const verifyTool = toolList.find((t) => /verify.?receipt|receipt.?verify/i.test(t.name));
  let verifyResp: JsonRpcResponse | null = null;
  if (verifyTool) {
    console.log(`\nCalling ${verifyTool.name} for receipt 4 mainnet...`);
    verifyResp = await call('tools/call', { name: verifyTool.name, arguments: { id: '4', network: 'mainnet' } });
  } else {
    console.log('No verify_receipt tool found in tool catalog');
  }

  // 3. Find a passport/agent-show tool
  const passportTool = toolList.find((t) => /passport.?show|show.?passport|agent.?show/i.test(t.name));
  let passportResp: JsonRpcResponse | null = null;
  if (passportTool) {
    console.log(`\nCalling ${passportTool.name} for operator wallet...`);
    passportResp = await call('tools/call', { name: passportTool.name, arguments: { wallet: '0xaa954c33810029a3eFb0bf755FEF17863E8677Ce', network: 'mainnet' } });
  } else {
    console.log('No passport_show tool found in tool catalog');
  }

  // Capture everything
  writeFileSync(resolve(OUT, 'tools-list.json'), JSON.stringify(listResp, null, 2));
  if (verifyResp) writeFileSync(resolve(OUT, 'verify-receipt-4.json'), JSON.stringify(verifyResp, null, 2));
  if (passportResp) writeFileSync(resolve(OUT, 'passport-show.json'), JSON.stringify(passportResp, null, 2));
  writeFileSync(resolve(OUT, 'stderr.log'), stderrBuf);

  const md = `# MCP server stdio smoke · ${new Date().toISOString()}\n\n## Tools listed (${toolList.length})\n\n${toolList.map((t) => `- \`${t.name}\` — ${(t.description ?? '(no description)').slice(0, 120)}`).join('\n')}\n\n## Receipt verify (${verifyTool?.name ?? 'NOT AVAILABLE'})\n\n${verifyResp ? '```json\n' + JSON.stringify(verifyResp.result ?? verifyResp.error, null, 2).slice(0, 1500) + '\n```' : 'tool not found in catalog'}\n\n## Passport show (${passportTool?.name ?? 'NOT AVAILABLE'})\n\n${passportResp ? '```json\n' + JSON.stringify(passportResp.result ?? passportResp.error, null, 2).slice(0, 1500) + '\n```' : 'tool not found in catalog'}\n\n## stderr (last 2KB)\n\n\`\`\`\n${stderrBuf.slice(-2000)}\n\`\`\`\n`;
  writeFileSync(resolve(OUT, 'SUMMARY.md'), md);

  proc.kill();
  console.log(`\nMCP smoke complete · ${toolList.length} tools listed · verify=${verifyResp?.result ? 'OK' : 'see logs'} · passport=${passportResp?.result ? 'OK' : 'see logs'}`);
  console.log(`Artifacts at ${OUT}`);
}

smoke().catch((e) => { console.error('FATAL:', e instanceof Error ? e.message : String(e)); process.exit(1); });
