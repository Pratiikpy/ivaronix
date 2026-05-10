#!/usr/bin/env tsx
/**
 * Port awesome-claude-skills → Ivaronix.
 *
 * Walks the awesome-claude-skills repo, parses each SKILL.md frontmatter
 * (Anthropic standard: name + description + license), and emits an Ivaronix
 * manifest at `seed-skills/imports/<name>/SKILL.md` with a conservative
 * `og:` extension block.
 *
 * Conservative defaults:
 *   - tier=quick (no extra LLM cost on first run)
 *   - permissions: memory=none, network=[], wallet=false, writes=false,
 *     shell=none, receipt_required=true, compute_tee_required=true
 *   - hooks: pre_consensus=[redact_pii, balance_check],
 *           post_consensus=[log_tokens]
 *   - no burn auto
 *
 * Safety:
 *   - Skips files whose frontmatter doesn't include `name`
 *   - Skips skill ids that already exist under `seed-skills/`
 *   - Caps at MAX_PORTS to avoid testnet-OG burn during Day-19
 *
 * Run:
 *   pnpm tsx scripts/port-awesome-claude-skills.ts
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

// __dirname = scripts/migrations → REPO_ROOT = scripts/migrations/../.. (planning-003 §A.5.6 reorg).
const REPO_ROOT = resolve(__dirname, '..', '..');
const SOURCE_ROOT = resolve(REPO_ROOT, 'CLI Open Source Project', 'awesome-claude-skills');
const TARGET_ROOT = resolve(REPO_ROOT, 'seed-skills', 'imports');
const MAX_PORTS = 75;

// Top-level skill folders we ALWAYS port. These are the most diverse + most
// likely to be useful as Ivaronix demos. Composio skills are sampled below.
const TOP_LEVEL = [
  'artifacts-builder',
  'brand-guidelines',
  'canvas-design',
  'changelog-generator',
  'competitive-ads-extractor',
  'connect',
  'connect-apps',
  'connect-apps-plugin',
  'content-research-writer',
  'developer-growth-analysis',
  'domain-name-brainstormer',
  'file-organizer',
  'image-enhancer',
  'internal-comms',
  'invoice-organizer',
  'langsmith-fetch',
  'lead-research-assistant',
  'mcp-builder',
  'meeting-insights-analyzer',
  'raffle-winner-picker',
  'skill-creator',
  'skill-share',
  'slack-gif-creator',
  'tailored-resume-generator',
  'template-skill',
  'theme-factory',
];

// Curated composio sample — well-known SaaS, not the long-tail of niche APIs
const COMPOSIO_PICK = [
  'gmail-automation',
  'github-automation',
  'slack-automation',
  'linear-automation',
  'notion-automation',
  'jira-automation',
  'asana-automation',
  'salesforce-automation',
  'hubspot-automation',
  'stripe-automation',
  'shopify-automation',
  'discord-automation',
  'trello-automation',
  'twitter-automation',
  'youtube-automation',
  'figma-automation',
  'airtable-automation',
  'supabase-automation',
  'mongodb-automation',
  'mailchimp-automation',
  'sendgrid-automation',
  'twilio-automation',
  'zoom-automation',
  'calendly-automation',
  'cloudinary-automation',
  'cloudflare-automation',
  'auth0-automation',
  'datadog-automation',
  'sentry-automation',
  'pagerduty-automation',
  'docusign-automation',
  'canva-automation',
  'adobe-automation',
  'gong-automation',
  'aero-workflow-automation',
  'ably-automation',
  'abstract-automation',
  'accelo-automation',
  'active-campaign-automation',
  'addresszen-automation',
  'adrapid-automation',
  'adyntel-automation',
  'abuselpdb-automation',
  'accredible-certificates-automation',
  'acculynx-automation',
  'abyssale-automation',
  'adyen-automation',
  'agentql-automation',
];

interface AnthropicFm {
  name?: string;
  description?: string;
  license?: string;
  [key: string]: unknown;
}

function parseSkillMd(content: string): { fm: AnthropicFm; body: string } {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return { fm: {}, body: content };
  const endIdx = trimmed.indexOf('\n---', 3);
  if (endIdx === -1) return { fm: {}, body: content };
  const fmText = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 4).trim();
  let fm: AnthropicFm = {};
  try {
    fm = (parseYaml(fmText) as AnthropicFm) ?? {};
  } catch {
    /* fall through with empty fm */
  }
  return { fm, body };
}

function emitIvaronixManifest(name: string, description: string, license: string, body: string): string {
  // Quote the description in YAML if it contains special chars
  const safeDesc = JSON.stringify(description);
  const safeLicense = JSON.stringify(license);
  return `---
name: ${name}
version: 0.1.0
description: ${safeDesc}
license: ${safeLicense}
metadata:
  openclaw:
    install:
      - kind: node
        package: "@ivaronix/cli"
        bins: ["ivaronix"]
        os: ["linux", "darwin", "win32"]
        label: "Install Ivaronix CLI to run this skill"
    requires:
      env: ["IVARONIX_SIGNER_KEY", "IVARONIX_WALLET_ADDRESS", "IVARONIX_ROUTER_KEY"]
entrypoint: prompt.md

og:
  permissions:
    memory_access: none
    network_access: []
    wallet_access: false
    writes_files: false
    shell_access: none
    receipt_required: true
    compute_tee_required: true
    passport_min_trust: 0
  reputation:
    on_pass: { trustScore: 1, receiptCount: 1 }
    on_fail: { trustScore: -1, violationCount: 0 }
    on_violation: { trustScore: -5, locked: false }
  consensus:
    required: false
    default_tier: quick
  burn:
    auto_enable: false
  hooks:
    pre_consensus: ["redact_pii", "balance_check"]
    post_consensus: ["log_tokens"]
  creator:
    passport: "did:0g:passport:0xaa954c33810029a3eFb0bf755FEF17863E8677Ce:1"
---

${body}
`;
}

interface PortResult {
  ported: string[];
  skipped: { id: string; reason: string }[];
}

function tryPort(sourcePath: string, results: PortResult): boolean {
  if (results.ported.length >= MAX_PORTS) return false;
  const skillMd = join(sourcePath, 'SKILL.md');
  if (!existsSync(skillMd)) return false;

  let fmContent: string;
  try {
    fmContent = readFileSync(skillMd, 'utf8');
  } catch {
    return false;
  }
  const { fm, body } = parseSkillMd(fmContent);
  if (!fm.name || !fm.description) {
    results.skipped.push({ id: sourcePath, reason: 'missing name or description' });
    return false;
  }

  // Sanitize name: lowercase, hyphenated, alphanumeric/hyphen only
  const safeName = String(fm.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!safeName) {
    results.skipped.push({ id: String(fm.name), reason: 'name sanitized to empty' });
    return false;
  }

  // Skip if a skill with this id already exists in seed-skills/ root or imports
  for (const dir of ['seed-skills', 'seed-skills/imports']) {
    const existing = resolve(REPO_ROOT, dir, safeName, 'SKILL.md');
    if (existsSync(existing)) {
      results.skipped.push({ id: safeName, reason: 'already exists' });
      return false;
    }
  }

  const target = resolve(TARGET_ROOT, safeName);
  mkdirSync(target, { recursive: true });
  const description = String(fm.description).replace(/\s+/g, ' ').trim();
  const license = fm.license ? String(fm.license).slice(0, 200) : 'Apache-2.0';
  const safeDescription = description.slice(0, 600);

  writeFileSync(
    join(target, 'SKILL.md'),
    emitIvaronixManifest(safeName, safeDescription, license, body),
  );

  results.ported.push(safeName);
  return true;
}

function main() {
  if (!existsSync(SOURCE_ROOT)) {
    console.error(`Source not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }
  mkdirSync(TARGET_ROOT, { recursive: true });

  const results: PortResult = { ported: [], skipped: [] };

  // 1. Always port the curated top-level set
  for (const id of TOP_LEVEL) {
    const path = resolve(SOURCE_ROOT, id);
    if (!existsSync(path)) continue;
    if (statSync(path).isDirectory()) tryPort(path, results);
  }

  // 2. Port the curated composio sample
  const composioRoot = resolve(SOURCE_ROOT, 'composio-skills');
  if (existsSync(composioRoot)) {
    for (const id of COMPOSIO_PICK) {
      const path = resolve(composioRoot, id);
      if (!existsSync(path)) continue;
      if (statSync(path).isDirectory()) tryPort(path, results);
    }

    // 3. If still under MAX_PORTS, fill from remaining composio skills alphabetically
    if (results.ported.length < MAX_PORTS) {
      const all = readdirSync(composioRoot)
        .filter((e) => statSync(resolve(composioRoot, e)).isDirectory())
        .sort();
      for (const id of all) {
        if (results.ported.length >= MAX_PORTS) break;
        if (COMPOSIO_PICK.includes(id)) continue;
        const path = resolve(composioRoot, id);
        tryPort(path, results);
      }
    }
  }

  console.log(`\n✓ Ported ${results.ported.length} skills to seed-skills/imports/`);
  console.log(`  skipped ${results.skipped.length}`);
  if (results.ported.length > 0) {
    console.log(`\nFirst 10:\n  ${results.ported.slice(0, 10).join('\n  ')}`);
  }
}

main();
