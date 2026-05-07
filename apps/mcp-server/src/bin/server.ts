#!/usr/bin/env node
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Load .env from the workspace root the same way the CLI does
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
import { createIvaronixMcpServer } from '../server.js';

async function main() {
  const server = createIvaronixMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error('[ivaronix-mcp] connected over stdio');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[ivaronix-mcp] fatal:', err);
  process.exit(1);
});
