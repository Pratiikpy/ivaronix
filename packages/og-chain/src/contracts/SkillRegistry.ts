import { Contract, keccak256, toUtf8Bytes, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

export const SKILL_REGISTRY_ABI = [
  'function publishVersion(bytes32 skillId, bytes32 versionId, bytes32 manifestHash) external',
  'function revokeVersion(bytes32 skillId, bytes32 versionId) external',
  'function transferSkillOwnership(bytes32 skillId, address newOwner) external',
  'function getVersion(bytes32 skillId, bytes32 versionId) external view returns (tuple(address creator, bytes32 manifestHash, uint64 publishedAt, bool revoked))',
  'function latestVersion(bytes32 skillId) external view returns (bytes32 versionId, tuple(address creator, bytes32 manifestHash, uint64 publishedAt, bool revoked) v)',
  'function versionCount(bytes32 skillId) external view returns (uint256)',
  'function versionAt(bytes32 skillId, uint256 idx) external view returns (bytes32)',
  'function ownerOf(bytes32 skillId) external view returns (address)',
  'function verify(bytes32 skillId, bytes32 versionId, bytes32 manifestHash) external view returns (bool)',
  'event SkillPublished(bytes32 indexed skillId, bytes32 indexed versionId, address indexed creator, bytes32 manifestHash, uint64 publishedAt)',
  'event SkillRevoked(bytes32 indexed skillId, bytes32 indexed versionId, address indexed by)',
  'event SkillOwnershipTransferred(bytes32 indexed skillId, address indexed previousOwner, address indexed newOwner)',
] as const;

export interface SkillVersionData {
  creator: Address;
  manifestHash: Hash;
  publishedAt: bigint;
  revoked: boolean;
}

/** Compute deterministic skillId from a human name. Mirror of the spec used elsewhere. */
export function skillIdFromName(name: string): Hash {
  return keccak256(toUtf8Bytes(`skill:${name.toLowerCase()}`)) as Hash;
}

/** Deterministic versionId from a semver tag like "0.1.0". */
export function versionIdFromSemver(version: string): Hash {
  return keccak256(toUtf8Bytes(`v${version}`)) as Hash;
}

/** Convert "sha256:abc…" or "0x…" or raw 64-hex to bytes32 hex (0x-prefixed). */
export function manifestHashToBytes32(input: string): Hash {
  const stripped = input.startsWith('sha256:') ? input.slice('sha256:'.length) : input;
  const hex = stripped.startsWith('0x') ? stripped.slice(2) : stripped;
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`SkillRegistry: invalid manifestHash "${input}" (expected 32 bytes hex)`);
  }
  return ('0x' + hex.toLowerCase()) as Hash;
}

export class SkillRegistryClient {
  readonly address: Address;
  private contract: Contract;

  constructor(address: Address, runner: ContractRunner) {
    this.address = address;
    this.contract = new Contract(address, SKILL_REGISTRY_ABI, runner);
  }

  async publishVersion(skillId: Hash, versionId: Hash, manifestHash: Hash): Promise<ContractTransactionResponse> {
    return this.contract.publishVersion!(skillId, versionId, manifestHash);
  }

  async revokeVersion(skillId: Hash, versionId: Hash): Promise<ContractTransactionResponse> {
    return this.contract.revokeVersion!(skillId, versionId);
  }

  async transferSkillOwnership(skillId: Hash, newOwner: Address): Promise<ContractTransactionResponse> {
    return this.contract.transferSkillOwnership!(skillId, newOwner);
  }

  async ownerOf(skillId: Hash): Promise<Address> {
    return (await this.contract.ownerOf!(skillId)) as Address;
  }

  async getVersion(skillId: Hash, versionId: Hash): Promise<SkillVersionData | null> {
    const r = await this.contract.getVersion!(skillId, versionId);
    // tuple struct returned positionally + namedly in ethers v6
    const creator = (r[0] ?? r.creator) as Address;
    if (creator === '0x0000000000000000000000000000000000000000') return null;
    return {
      creator,
      manifestHash: (r[1] ?? r.manifestHash) as Hash,
      publishedAt: (r[2] ?? r.publishedAt) as bigint,
      revoked: (r[3] ?? r.revoked) as boolean,
    };
  }

  async latestVersion(skillId: Hash): Promise<{ versionId: Hash; data: SkillVersionData } | null> {
    try {
      const r = await this.contract.latestVersion!(skillId);
      const versionId = (r[0] ?? r.versionId) as Hash;
      const v = r[1] ?? r.v;
      return {
        versionId,
        data: {
          creator: (v[0] ?? v.creator) as Address,
          manifestHash: (v[1] ?? v.manifestHash) as Hash,
          publishedAt: (v[2] ?? v.publishedAt) as bigint,
          revoked: (v[3] ?? v.revoked) as boolean,
        },
      };
    } catch {
      return null; // "SkillRegistry: no versions"
    }
  }

  async versionCount(skillId: Hash): Promise<bigint> {
    return (await this.contract.versionCount!(skillId)) as bigint;
  }

  async verify(skillId: Hash, versionId: Hash, manifestHash: Hash): Promise<boolean> {
    return (await this.contract.verify!(skillId, versionId, manifestHash)) as boolean;
  }
}
