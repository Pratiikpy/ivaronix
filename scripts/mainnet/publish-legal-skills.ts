/**
 * Phase 2 step 5 · Publish 5 legal skills on mainnet SkillRegistryV2 +
 * set price via SkillPricing.
 *
 * For each skill in {private-doc-review, contract-renewal-clause-detector,
 * legal-citation-verifier, nda-triage-reviewer, term-sheet-risk-scanner}:
 *   1. read SKILL.md · extract version + skill id (slug) + creator bps
 *   2. compute manifestHash = keccak256(SKILL.md raw bytes)
 *   3. compute versionId = keccak256(version-string-bytes)
 *   4. compute skillId = keccak256("skill:<slug>")
 *   5. call SkillRegistryV2.publishVersion(skillId, versionId, manifestHash)
 *   6. call SkillPricing.setPrice(skillId, priceWei, creatorBps, treasuryBps)
 *   7. capture both tx hashes
 *
 * private-doc-review is pre-reserved to operator wallet in the V2
 * constructor; the other 4 slugs need first-publisher claim.
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
dotenv.config({ path: resolve(process.cwd(), '.env.mainnet'), override: true });

import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes, parseEther, formatEther } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const RPC = process.env.IVARONIX_RPC_URL || 'https://evmrpc.0g.ai';
const SIGNER_KEY = process.env.IVARONIX_SIGNER_KEY!;
const REGISTRY = '0x080f87A9E93e9bd0a9e0eB94F97123bf333b1Dde';
const PRICING = '0x08d25653638c3ed40C3b82840fA20CAe9c94563E';

const REGISTRY_ABI = [
  'function publishVersion(bytes32 skillId, bytes32 versionId, bytes32 manifestHash) external',
  'function latestVersion(bytes32 skillId) external view returns (bytes32 versionId, tuple(bytes32 manifestHash, address creator, uint64 publishedAt, bool revoked) data)',
];
const PRICING_ABI = [
  'function setPrice(bytes32 skillId, uint256 priceWei, uint16 creatorBps, uint16 treasuryBps) external',
  'function getPricing(bytes32 skillId) external view returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)',
];

// Per-skill default pricing in OG · tier-based
// (per MAINNET_PERFECT_PLAN §3 + brand/Ivaronix.html pricing notes)
const SKILLS: Array<{ slug: string; tier: string; priceOg: string; creatorBps: number; treasuryBps: number }> = [
  { slug: 'private-doc-review',              tier: 'high-stakes', priceOg: '0.015', creatorBps: 9000, treasuryBps: 1000 },
  { slug: 'contract-renewal-clause-detector', tier: 'standard',    priceOg: '0.005', creatorBps: 9000, treasuryBps: 1000 },
  { slug: 'legal-citation-verifier',         tier: 'high-stakes', priceOg: '0.015', creatorBps: 9000, treasuryBps: 1000 },
  { slug: 'nda-triage-reviewer',             tier: 'standard',    priceOg: '0.005', creatorBps: 9000, treasuryBps: 1000 },
  { slug: 'term-sheet-risk-scanner',         tier: 'high-stakes', priceOg: '0.015', creatorBps: 9000, treasuryBps: 1000 },
];

const GAS = { gasPrice: 5_000_000_000n, gasLimit: 400_000n };

function readVersion(skillSlug: string): string {
  const content = readFileSync(`seed-skills/${skillSlug}/SKILL.md`, 'utf8');
  // YAML frontmatter is between two `---` lines
  const match = content.match(/^---[\s\S]*?^version:\s*([^\s\n]+)/m);
  return match ? match[1]! : '0.1.0';
}

async function main(): Promise<void> {
  const provider = new JsonRpcProvider(RPC, { chainId: 16661, name: 'aristotle' });
  const wallet = new Wallet(SIGNER_KEY, provider);
  console.log('=== Phase 2 step 5 · publish 5 legal skills on mainnet SkillRegistryV2 ===');
  console.log(`Operator: ${wallet.address}`);
  console.log(`Registry: ${REGISTRY}`);
  console.log(`Pricing:  ${PRICING}`);

  const registry = new Contract(REGISTRY, REGISTRY_ABI, wallet);
  const pricing = new Contract(PRICING, PRICING_ABI, wallet);

  const results: Array<{
    slug: string;
    version: string;
    skillId: string;
    versionId: string;
    manifestHash: string;
    priceOg: string;
    publishTx?: string;
    setPriceTx?: string;
    error?: string;
  }> = [];

  for (const s of SKILLS) {
    const version = readVersion(s.slug);
    const skillId = keccak256(toUtf8Bytes('skill:' + s.slug));
    const versionId = keccak256(toUtf8Bytes(version));
    const skillMd = readFileSync(`seed-skills/${s.slug}/SKILL.md`);
    const manifestHash = keccak256(skillMd);
    const priceWei = parseEther(s.priceOg);

    console.log(`\n--- ${s.slug} v${version} (${s.tier} · ${s.priceOg} OG) ---`);
    console.log(`  skillId:      ${skillId}`);
    console.log(`  versionId:    ${versionId}`);
    console.log(`  manifestHash: ${manifestHash}`);

    const entry: typeof results[0] = { slug: s.slug, version, skillId, versionId, manifestHash, priceOg: s.priceOg };

    try {
      const publishTx = await registry.publishVersion!(skillId, versionId, manifestHash, GAS);
      console.log(`  publish tx:   ${publishTx.hash}`);
      await publishTx.wait();
      entry.publishTx = publishTx.hash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  publish FAILED: ${msg.slice(0, 200)}`);
      entry.error = `publish: ${msg.slice(0, 200)}`;
    }

    if (entry.publishTx) {
      try {
        const setPriceTx = await pricing.setPrice!(skillId, priceWei, s.creatorBps, s.treasuryBps, GAS);
        console.log(`  setPrice tx:  ${setPriceTx.hash}`);
        await setPriceTx.wait();
        entry.setPriceTx = setPriceTx.hash;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  setPrice FAILED: ${msg.slice(0, 200)}`);
        entry.error = (entry.error || '') + ` setPrice: ${msg.slice(0, 200)}`;
      }
    }

    results.push(entry);
  }

  // Summary
  const success = results.filter((r) => r.publishTx && r.setPriceTx).length;
  console.log(`\n=== ${success}/${SKILLS.length} skills published + priced ===`);

  const md = `# Phase 2 step 5 · 5 legal skills published on mainnet SkillRegistryV2

> Skill registry + pricing per MAINNET_PERFECT_PLAN §3. ${success}/${SKILLS.length} skills landed on chain.

## Per-skill on-chain state

| Slug | Version | skillId | publishVersion tx | setPrice tx | Price | Tier |
|---|---|---|---|---|---:|---|
${results.map((r) => `| \`${r.slug}\` | ${r.version} | \`${r.skillId.slice(0, 18)}...\` | ${r.publishTx ? `[${r.publishTx.slice(0, 12)}](https://chainscan.0g.ai/tx/${r.publishTx})` : '✗ ' + (r.error?.slice(0, 50) ?? 'failed')} | ${r.setPriceTx ? `[${r.setPriceTx.slice(0, 12)}](https://chainscan.0g.ai/tx/${r.setPriceTx})` : '—'} | ${r.priceOg} OG | ${SKILLS.find((s) => s.slug === r.slug)?.tier} |`).join('\n')}

## Full skill identifiers (for stranger replay)

\`\`\`
${results.map((r) => `${r.slug}:\n  skillId      = ${r.skillId}\n  versionId    = ${r.versionId}\n  manifestHash = ${r.manifestHash}\n  publishTx    = ${r.publishTx ?? 'FAILED'}\n  setPriceTx   = ${r.setPriceTx ?? 'FAILED'}`).join('\n\n')}
\`\`\`

## Marketplace impact

After these tx land, the mainnet \`/marketplace\` page (post-Studio-cutover) reads 5 skills via subgraph or direct-chain-read from SkillRegistryV2. Buyers can pay via SkillRunPayment + the 90/10 split tested in Phase 3 step 5.

— agent · Phase 2 step 5 · ${new Date().toISOString()}
`;
  const proofPath = resolve(process.cwd(), 'QA_PROOF_PACK/mainnet/skill-publishes/5-legal-skills.md');
  mkdirSync(dirname(proofPath), { recursive: true });
  writeFileSync(proofPath, md);
  writeFileSync(resolve(process.cwd(), 'QA_PROOF_PACK/mainnet/skill-publishes/5-legal-skills.json'), JSON.stringify(results, null, 2));
  console.log(`\nProof: ${proofPath}`);
}

main().catch((e) => { console.error('FAIL:', e instanceof Error ? e.message : String(e)); process.exit(1); });
