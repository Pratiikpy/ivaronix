/**
 * One-off operator script: publish + price the 5 first-party skills
 * that are on disk but not on SkillRegistryV2 yet, so the marketplace
 * listing shows all 6 first-party skills instead of only private-doc-
 * review.
 *
 * Discovered 2026-05-14 cron iter: chain reads showed
 *   private-doc-review     owner: 0xaa954c33  priced: 0.005 OG  ✓
 *   0g-integration-auditor owner: 0x0        priced: false
 *   code-edit              owner: 0x0        priced: false
 *   content-pitch-review   owner: 0x0        priced: false
 *   github-audit           owner: 0x0        priced: false
 *   plan-step              owner: 0x0        priced: false
 *
 * Each skill needs 2 txs:
 *   1. SkillRegistryV2.publishVersion(skillId, versionId, manifestHash)
 *   2. SkillPricing.setPrice(skillId, priceWei, creatorBps, treasuryBps)
 *
 * Uniform pricing for the v1 launch: 0.005 OG per run · 90/10 split
 * (same as private-doc-review). Operator can re-price later via
 * /marketplace/new or by calling setPrice directly.
 *
 * Gas: ~0.0016 OG per skill (400k gas × 4 Gwei) → 0.008 OG total.
 * Operator wallet has 68+ OG so this is trivial.
 *
 * Idempotent: each skill is checked first; already-published skills
 * are skipped.
 */
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from 'ethers';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

function loadOperatorKey(): string {
  const envPath = resolve(REPO, '.env');
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(k in process.env)) process.env[k] = v;
    }
  }
  const k = process.env.IVARONIX_SIGNER_KEY ?? process.env.EVM_PRIVATE_KEY ?? '';
  if (!k) throw new Error('IVARONIX_SIGNER_KEY missing from .env');
  return k.startsWith('0x') ? k : `0x${k}`;
}

const REGISTRY_ADDR = '0xF05113E83146160024326ff30979c57f5adc2193';
const PRICING_ADDR  = '0xc3369C9BD74D81E9c7226e5fc9427D19c12B718F';

const REGISTRY_ABI = [
  'function ownerOf(bytes32 skillId) view returns (address)',
  'function publishVersion(bytes32 skillId, bytes32 versionId, bytes32 manifestHash)',
  'function getVersion(bytes32 skillId, bytes32 versionId) view returns (tuple(address creator, bytes32 manifestHash, uint64 publishedAt, bool revoked))',
];

const PRICING_ABI = [
  'function getPricing(bytes32 skillId) view returns (uint256,uint16,uint16,bool)',
  'function setPrice(bytes32 skillId, uint256 priceWei, uint16 creatorBps, uint16 treasuryBps)',
];

// All 6 first-party slugs — re-publish under canonical v-prefix versionId
// because the first pass (and the original V2 private-doc-review publish)
// stored entries under keccak256(version) which is unreachable by
// versionIdFromSemver.
const SLUGS_TO_PUBLISH = [
  '0g-integration-auditor',
  'code-edit',
  'content-pitch-review',
  'github-audit',
  'plan-step',
  'private-doc-review',
] as const;

// v1 launch defaults — uniform across first-party skills
const PRICE_WEI = 5_000_000_000_000_000n; // 0.005 OG
const CREATOR_BPS = 9000; // 90%
const TREASURY_BPS = 1000; // 10%

async function main(): Promise<void> {
  const operatorKey = loadOperatorKey();
  const provider = new JsonRpcProvider('https://evmrpc-testnet.0g.ai', { chainId: 16602, name: 'testnet' });
  const wallet = new Wallet(operatorKey, provider);
  const registry = new Contract(REGISTRY_ADDR, REGISTRY_ABI, wallet);
  const pricing = new Contract(PRICING_ADDR, PRICING_ABI, wallet);

  console.log(`Operator wallet: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${(Number(balance) / 1e18).toFixed(6)} OG\n`);

  for (const slug of SLUGS_TO_PUBLISH) {
    const skillId = keccak256(toUtf8Bytes(`skill:${slug}`));
    const manifestPath = resolve(REPO, 'seed-skills', slug, 'SKILL.md');
    if (!existsSync(manifestPath)) {
      console.log(`  ✗ ${slug}: SKILL.md missing at ${manifestPath} — skip`);
      continue;
    }
    const manifestBytes = readFileSync(manifestPath);
    const manifestHash = keccak256(manifestBytes);

    // Read manifest to get version
    const manifestText = manifestBytes.toString('utf8');
    const versionMatch = manifestText.match(/^version:\s*([0-9.]+)/m);
    const version = versionMatch ? versionMatch[1] : '0.1.0';
    // versionIdFromSemver convention: keccak256("v" + version). The first
    // pass of this script (and the original V2 deploy of private-doc-review)
    // used keccak256(version) without the "v" prefix, leaving orphan entries
    // on chain that /skills + scanSkill could never look up. Re-publishing
    // under the canonical versionId now (idempotent — old entries stay but
    // are unreachable by the helper-pair callers).
    const versionId = keccak256(toUtf8Bytes(`v${version}`));

    // Check if the canonical-versionId entry exists. ownerOf is the
    // skill-level mapping (set on first publish under any versionId) so
    // it's already non-zero — but the canonical versionId record may
    // still be missing if the original publish used the wrong encoding.
    const canonicalVersion = (await registry.getVersion(skillId, versionId).catch(() => null)) as { creator: string } | null;
    if (canonicalVersion && canonicalVersion.creator !== '0x0000000000000000000000000000000000000000') {
      console.log(`  · ${slug}: canonical versionId already on chain — skip publishVersion`);
    } else {
      console.log(`  → ${slug}: publishVersion · version=v${version} · manifestHash=${manifestHash.slice(0, 18)}…`);
      try {
        const tx = await registry.publishVersion(skillId, versionId, manifestHash, { gasLimit: 300_000n });
        const receipt = await tx.wait();
        console.log(`    ✓ tx ${tx.hash} block ${receipt.blockNumber}`);
      } catch (e) {
        console.log(`    ✗ publishVersion failed: ${(e as Error).message.split('\n')[0]}`);
        continue;
      }
    }

    // Check already-priced
    const [currentPrice, , , priced] = (await pricing.getPricing(skillId)) as [bigint, number, number, boolean];
    if (priced && currentPrice === PRICE_WEI) {
      console.log(`  · ${slug}: already priced at 0.005 OG — skip`);
      continue;
    }

    console.log(`  → ${slug}: setPrice · 0.005 OG · 90/10`);
    try {
      const tx = await pricing.setPrice(skillId, PRICE_WEI, CREATOR_BPS, TREASURY_BPS, { gasLimit: 200_000n });
      const receipt = await tx.wait();
      console.log(`    ✓ tx ${tx.hash} block ${receipt.blockNumber}\n`);
    } catch (e) {
      console.log(`    ✗ setPrice failed: ${(e as Error).message.split('\n')[0]}\n`);
    }
  }

  console.log('\n=== Final state ===');
  const ALL_SLUGS = ['0g-integration-auditor','code-edit','content-pitch-review','github-audit','plan-step','private-doc-review'];
  for (const slug of ALL_SLUGS) {
    const skillId = keccak256(toUtf8Bytes(`skill:${slug}`));
    const owner = (await registry.ownerOf(skillId).catch(() => '0x0')) as string;
    const [pw, cb, tb, p] = (await pricing.getPricing(skillId).catch(() => [0n, 0, 0, false])) as [bigint, number, number, boolean];
    console.log(`  ${slug.padEnd(28)} owner: ${owner.slice(0, 10)}… priced: ${p} · ${(Number(pw) / 1e18).toFixed(3)} OG · ${cb / 100}/${tb / 100}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
