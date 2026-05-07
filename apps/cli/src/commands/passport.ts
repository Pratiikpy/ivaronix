import { Command } from 'commander';
import { ui } from '../lib/ui.js';

export const passportCommand = new Command('passport')
  .description('Manage your ERC-7857 Agent Passport');

passportCommand
  .command('mint')
  .description('Mint your AgentPassportINFT (ERC-7857)')
  .action(() => {
    ui.hint('Passport mint arrives Phase A Day 6 (after AgentPassportINFT.sol deploys).');
  });

passportCommand
  .command('show')
  .description('Show your current passport state (on-chain + KV)')
  .action(() => {
    ui.hint('Passport show arrives Phase A Day 6.');
  });

passportCommand
  .command('restore')
  .description('Restore your passport state from on-chain + KV pointer')
  .option('--wallet <address>', 'wallet to restore (defaults to signer)')
  .action(() => {
    ui.hint('Passport restore arrives Phase A Day 6.');
  });
