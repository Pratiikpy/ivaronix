#!/usr/bin/env tsx
/**
 * One-off migration: insert metadata.openclaw block into every imported
 * SKILL.md frontmatter that doesn't already have one. Lets the entire
 * 75-skill imports/ catalog be discoverable through OpenClaw's package
 * distribution layer.
 *
 * Idempotent — skips files that already declare metadata.openclaw.
 *
 *   pnpm exec tsx scripts/migrate-openclaw-metadata.ts
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// __dirname = scripts/migrations → seed-skills/imports = ../../seed-skills/imports
// (planning-003 §A.5.6 reorg).
const ROOT = resolve(__dirname, '..', '..', 'seed-skills', 'imports');

const OPENCLAW_BLOCK = `metadata:
  openclaw:
    install:
      - kind: node
        package: "@ivaronix/cli"
        bins: ["ivaronix"]
        os: ["linux", "darwin", "win32"]
        label: "Install Ivaronix CLI to run this skill"
    requires:
      env: ["EVM_PRIVATE_KEY", "EVM_WALLET_ADDRESS", "ZG_API_SECRET"]
`;

let touched = 0;
let skipped = 0;
let total = 0;

for (const entry of readdirSync(ROOT)) {
  const dir = join(ROOT, entry);
  if (!statSync(dir).isDirectory()) continue;
  const path = join(dir, 'SKILL.md');
  let body: string;
  try {
    body = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  total++;

  if (body.includes('metadata:\n  openclaw:')) {
    skipped++;
    continue;
  }

  // Insert after the first `license:` line at the top of the frontmatter.
  // Frontmatter is bounded by `---` lines.
  const fmEnd = body.indexOf('\n---', 4);
  if (fmEnd < 0) {
    console.warn(`! ${entry}: no frontmatter, skipping`);
    skipped++;
    continue;
  }
  const fm = body.slice(0, fmEnd);
  const rest = body.slice(fmEnd);

  // Find the `license:` line and insert the block right after it.
  const lines = fm.split('\n');
  const licenseIdx = lines.findIndex((l) => /^license:\s/.test(l));
  if (licenseIdx < 0) {
    // No license line — insert before the og: line instead.
    const ogIdx = lines.findIndex((l) => l.startsWith('og:'));
    if (ogIdx < 0) {
      console.warn(`! ${entry}: no license: or og: line, skipping`);
      skipped++;
      continue;
    }
    lines.splice(ogIdx, 0, OPENCLAW_BLOCK.trimEnd());
  } else {
    lines.splice(licenseIdx + 1, 0, OPENCLAW_BLOCK.trimEnd());
  }

  const next = lines.join('\n') + rest;
  writeFileSync(path, next);
  touched++;
}

console.log(`migration done: ${touched} touched, ${skipped} skipped, ${total} total`);
