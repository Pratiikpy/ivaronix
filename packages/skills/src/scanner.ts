import {
  SkillRegistryClient,
  skillIdFromName,
  versionIdFromSemver,
  manifestHashToBytes32,
} from '@ivaronix/og-chain';
import type { LoadedSkill } from './loader.js';

export interface ScanResult {
  /** True iff the locally-loaded manifest matches what's anchored on chain. */
  matches: boolean;
  /** Has the skill+version been published at all? */
  registered: boolean;
  /** Has this version been revoked on chain? */
  revoked: boolean;
  /** The on-chain manifestHash (32-byte hex with 0x prefix) when registered, else null. */
  onchainManifestHash: string | null;
  /** Block timestamp the version was published at (seconds since epoch). */
  publishedAt: number | null;
  /** Wallet that published the version. */
  creator: string | null;
  /** Reason string if the scan failed. */
  reason: string | null;
}

/**
 * Look up the loaded skill on-chain and compare its manifestHash. Pure
 * observation — does not block execution. The sandbox decides what to do
 * with the result based on policy.
 */
export async function scanSkill(skill: LoadedSkill, registry: SkillRegistryClient): Promise<ScanResult> {
  const skillId = skillIdFromName(skill.id);
  const versionId = versionIdFromSemver(skill.manifest.version);
  const localBytes32 = manifestHashToBytes32(skill.manifestHash);

  const v = await registry.getVersion(skillId, versionId);
  if (!v) {
    return {
      matches: false,
      registered: false,
      revoked: false,
      onchainManifestHash: null,
      publishedAt: null,
      creator: null,
      reason: `${skill.id}@${skill.manifest.version} not registered on SkillRegistry`,
    };
  }
  if (v.revoked) {
    return {
      matches: false,
      registered: true,
      revoked: true,
      onchainManifestHash: v.manifestHash,
      publishedAt: Number(v.publishedAt),
      creator: v.creator,
      reason: `${skill.id}@${skill.manifest.version} was revoked on chain`,
    };
  }

  const matches = v.manifestHash.toLowerCase() === localBytes32.toLowerCase();
  return {
    matches,
    registered: true,
    revoked: false,
    onchainManifestHash: v.manifestHash,
    publishedAt: Number(v.publishedAt),
    creator: v.creator,
    reason: matches
      ? null
      : `local manifestHash (${localBytes32}) differs from on-chain (${v.manifestHash}) — manifest was tampered with after publication`,
  };
}
