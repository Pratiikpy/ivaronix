#!/usr/bin/env node
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Walk up the directory tree to find the nearest .env file (supports monorepo run-from-anywhere).
function findEnvFile(startDir: string): string | null {
  let dir = startDir;
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

import { Command } from 'commander';
import { doctorCommand } from '../commands/doctor.js';
import { initCommand } from '../commands/init.js';
import { receiptCommand } from '../commands/receipt.js';
import { passportCommand } from '../commands/passport.js';
import { computeCommand } from '../commands/compute.js';
import { docCommand } from '../commands/doc.js';
import { memoryCommand } from '../commands/memory.js';
import { skillCommand } from '../commands/skill.js';
import { planCommand } from '../commands/plan.js';
import { codeCommand } from '../commands/code.js';
import { auditCommand } from '../commands/audit.js';
import { swarmCommand } from '../commands/swarm.js';
import { watchCommand } from '../commands/watch.js';
import { updateCommand } from '../commands/update.js';
import { daemonCommand } from '../commands/daemon.js';

const program = new Command();

program
  .name('ivaronix')
  .description('The 0G Agent Operating System — Catch the risks. Keep the receipts.')
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

// Doc-ask (the killer demo)
program.addCommand(docCommand);

// Memory permissions
program.addCommand(memoryCommand);

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

program.parseAsync(process.argv).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
