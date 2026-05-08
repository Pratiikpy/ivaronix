#!/usr/bin/env node
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

function findEnvFile(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
const envPath = findEnvFile(process.cwd());
if (envPath) dotenvConfig({ path: envPath });

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createIvaronixMcpServer } from '../server.js';

const TRANSPORT = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();
const HTTP_PORT = parseInt(process.env.MCP_PORT ?? '8788', 10);
const HTTP_HOST = process.env.MCP_HOST ?? '127.0.0.1';

async function startStdio() {
  const server = createIvaronixMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error('[ivaronix-mcp] connected over stdio');
}

async function startHttp() {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createIvaronixMcpServer();
  await server.connect(transport);

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== '/mcp' && req.url !== '/') {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    transport.handleRequest(req, res).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[ivaronix-mcp] http handler error:', err);
      try { res.statusCode = 500; res.end('Internal Server Error'); } catch { /* ignore */ }
    });
  });

  httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
    // eslint-disable-next-line no-console
    console.error(`[ivaronix-mcp] listening on http://${HTTP_HOST}:${HTTP_PORT}/mcp (StreamableHTTP transport)`);
  });
}

async function main() {
  if (TRANSPORT === 'http') return startHttp();
  return startStdio();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[ivaronix-mcp] fatal:', err);
  process.exit(1);
});
