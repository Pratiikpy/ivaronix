/**
 * Smoke test: boot `@ivaronix/mcp-server` over stdio and verify the
 * 5 tools enumerate via JSON-RPC `tools/list`. Closes a real gap in
 * P18 (test plan §P18 calls the MCP server PASS but never freshly
 * smoke-tests it — this script lets the cron re-verify on demand).
 *
 * Protocol: MCP wire = JSON-RPC over newline-delimited JSON on stdio.
 * https://spec.modelcontextprotocol.io/specification/basic/transports/
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

async function main(): Promise<void> {
  const cwd = resolve(REPO, 'apps/mcp-server');
  const child = spawn('pnpm', ['dev'], {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  child.stdout?.on('data', (d) => { stdoutBuf += d.toString(); });
  child.stderr?.on('data', (d) => { stderrBuf += d.toString(); });

  // Initialize handshake
  const init = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'cron-smoke', version: '0.0.1' },
    },
  });
  const listTools = JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });
  // After Iter 10 V3-aware fix: verify_receipt now walks V3 → V2 → V1.
  // Call it for: V3 id 1 (should report registry V3), V2 id 31 (V2).
  const callVerifyV3 = JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'ivaronix_verify_receipt', arguments: { id: '1' } },
  });
  const callVerifyV2 = JSON.stringify({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'ivaronix_verify_receipt', arguments: { id: '31' } },
  });

  // Wait for child to be ready (pnpm dev needs to print its banner first)
  await new Promise((r) => setTimeout(r, 2_000));

  child.stdin?.write(init + '\n');
  await new Promise((r) => setTimeout(r, 500));
  child.stdin?.write(listTools + '\n');
  await new Promise((r) => setTimeout(r, 1_000));
  child.stdin?.write(callVerifyV3 + '\n');
  await new Promise((r) => setTimeout(r, 4_000));
  child.stdin?.write(callVerifyV2 + '\n');
  await new Promise((r) => setTimeout(r, 4_000));

  child.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 500));

  // Parse out the tools/list response from stdout
  const lines = stdoutBuf.split('\n').filter((l) => l.trim().startsWith('{'));
  let toolsResponse: { result?: { tools?: Array<{ name: string }> } } | null = null;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.id === 2 && parsed.result?.tools) {
        toolsResponse = parsed;
        break;
      }
    } catch { /* skip non-JSON */ }
  }

  if (!toolsResponse) {
    console.error('✗ No tools/list response received');
    console.error('stdout:', stdoutBuf.slice(-2000));
    console.error('stderr:', stderrBuf.slice(-2000));
    process.exit(1);
  }

  const tools = toolsResponse.result?.tools ?? [];
  console.log(`✓ MCP server returned ${tools.length} tool(s):`);
  for (const t of tools) console.log(`  • ${t.name}`);

  const expected = ['ivaronix_ask', 'ivaronix_verify_receipt', 'ivaronix_search_memory', 'ivaronix_install_skill', 'ivaronix_passport_show'];
  const actual = new Set(tools.map((t) => t.name));
  const missing = expected.filter((n) => !actual.has(n));
  if (missing.length > 0) {
    console.error(`✗ Missing expected tools: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ All 5 expected tools enumerated.`);

  // Now check that the verify_receipt CALL responses (id 3 + 4) hit V3 and V2.
  let v3Resp: { result?: { content?: Array<{ text?: string }> } } | null = null;
  let v2Resp: { result?: { content?: Array<{ text?: string }> } } | null = null;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.id === 3) v3Resp = parsed;
      if (parsed.id === 4) v2Resp = parsed;
    } catch { /* skip */ }
  }
  if (!v3Resp || !v2Resp) {
    console.error('✗ Did not receive both verify_receipt responses (id 3 + 4)');
    console.error('stdout tail:', stdoutBuf.slice(-1500));
    process.exit(1);
  }
  const v3Text = v3Resp.result?.content?.[0]?.text ?? '';
  const v2Text = v2Resp.result?.content?.[0]?.text ?? '';
  if (!/registry\s+V3/.test(v3Text) || !/state\s+ANCHORED/.test(v3Text)) {
    console.error('✗ V3 verify_receipt did not return registry V3 + ANCHORED:');
    console.error(v3Text);
    process.exit(1);
  }
  if (!/registry\s+V2/.test(v2Text) || !/state\s+ANCHORED/.test(v2Text)) {
    console.error('✗ V2 verify_receipt did not return registry V2 + ANCHORED:');
    console.error(v2Text);
    process.exit(1);
  }
  console.log(`✓ verify_receipt id=1 → V3 ANCHORED`);
  console.log(`✓ verify_receipt id=31 → V2 ANCHORED`);
}

main().catch((err) => { console.error(err); process.exit(1); });
