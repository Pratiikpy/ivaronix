#!/usr/bin/env node
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Walk up the directory tree to find the nearest file in the monorepo root.
function findUp(startDir: string, name: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Load the base .env first.
const envPath = findUp(process.cwd(), '.env');
if (envPath) dotenvConfig({ path: envPath });

// If the operator wants mainnet (either IVARONIX_NETWORK=mainnet or
// OG_NETWORK=mainnet, set inline or in the base .env), overlay
// .env.mainnet on top so the mainnet-specific RPC, chainId, signer,
// router, and model keyring win over any testnet values lingering in
// the base .env. dotenv's `override: true` replaces vars that were
// already set.
const network = process.env.IVARONIX_NETWORK ?? process.env.OG_NETWORK ?? 'mainnet';
if (network === 'mainnet') {
  const mainnetEnvPath = findUp(process.cwd(), '.env.mainnet');
  if (mainnetEnvPath) dotenvConfig({ path: mainnetEnvPath, override: true });
  // Ensure the network var is set even when the user didn't pass it
  // inline — downstream readers in @ivaronix/runtime check this.
  if (!process.env.IVARONIX_NETWORK) process.env.IVARONIX_NETWORK = 'mainnet';
}

import { Command } from 'commander';
import { doctorCommand } from '../commands/doctor.js';
import { initCommand } from '../commands/init.js';
import { receiptCommand } from '../commands/receipt.js';
import { passportCommand } from '../commands/passport.js';
import { computeCommand } from '../commands/compute.js';
import { docCommand } from '../commands/doc.js';
import { memoryCommand } from '../commands/memory.js';
import { roomCommand } from '../commands/room.js';
import { subscribeCommand } from '../commands/subscribe.js';
import { delegateCommand } from '../commands/delegate.js';
import { skillCommand } from '../commands/skill.js';
import { planCommand } from '../commands/plan.js';
import { codeCommand } from '../commands/code.js';
import { auditCommand } from '../commands/audit.js';
import { swarmCommand } from '../commands/swarm.js';
import { watchCommand } from '../commands/watch.js';
import { updateCommand } from '../commands/update.js';
import { daemonCommand } from '../commands/daemon.js';
import { chatCommand } from '../commands/chat.js';
import { chatV2Command } from '../commands/chat-v2.js';
import { demoCommand } from '../commands/demo.js';
import { serveCommand } from '../commands/serve.js';
import { modelCommand } from '../commands/model.js';
import { openclawCommand } from '../commands/openclaw.js';
import { daCommand } from '../commands/da.js';
import { indexerCommand } from '../commands/indexer.js';
import { debugCommand } from '../commands/debug.js';
import { statsCommand } from '../commands/stats.js';
import { exportCommand, importCommand } from '../commands/export.js';
import { prCommand } from '../commands/pr.js';
import { sessionCommand } from '../commands/session.js';

const program = new Command();

program
  .name('ivaronix')
  .description('Catch the risks. Keep the receipts. — AI review for documents you can\'t paste into ChatGPT, anchored on 0G Chain.')
  .version('0.0.1');

// Init
program.addCommand(initCommand);

// Doctor
program.addCommand(doctorCommand);

// Receipts
program.addCommand(receiptCommand);

// Passport
program.addCommand(passportCommand);

// Compute / Models / Router
program.addCommand(computeCommand);

// Doc-ask · audit a private document and produce an Action Receipt.
program.addCommand(docCommand);

// Memory permissions · grant/revoke capability scopes per agent.
program.addCommand(memoryCommand);

// Confidential Data Room · multi-party encrypted document workspace with per-read receipts.
program.addCommand(roomCommand);
program.addCommand(subscribeCommand);

// Delegate · operator-side delegated agent with per-skill capability grants.
program.addCommand(delegateCommand);

// Skills (browse/inspect installed skills)
program.addCommand(skillCommand);

// Modes: plan / code (build) / audit / swarm / watch
program.addCommand(planCommand);
program.addCommand(codeCommand);
program.addCommand(auditCommand);
program.addCommand(swarmCommand);
program.addCommand(watchCommand);
program.addCommand(updateCommand);
program.addCommand(daemonCommand);
program.addCommand(chatCommand);
program.addCommand(chatV2Command);
program.addCommand(demoCommand);
program.addCommand(serveCommand);
program.addCommand(modelCommand);
program.addCommand(openclawCommand);
program.addCommand(daCommand);
program.addCommand(indexerCommand);
program.addCommand(debugCommand);
program.addCommand(statsCommand);
program.addCommand(exportCommand);
program.addCommand(importCommand);
program.addCommand(prCommand);
program.addCommand(sessionCommand);

// Bare `ivaronix` (no subcommand) drops into the Ink TUI (claude-code style).
// chat-v2 is now the default; the readline `chat` is renamed to `chat-classic`
// for SSH / piped workflows where raw-mode TTY isn't available. Detect TTY:
// fall back to chat-classic automatically when stdout isn't a TTY (piped input,
// CI, etc.).
if (process.argv.length === 2) {
  const isTty = !!process.stdout.isTTY && !!process.stdin.isTTY;
  process.argv.push(isTty ? 'chat-v2' : 'chat-classic');
}

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
