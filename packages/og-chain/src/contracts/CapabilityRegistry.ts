import { Contract, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

export const CAPABILITY_REGISTRY_ABI = [
  'function issueGrant(address grantee, bytes32 scopeHash, uint64 ttlSeconds, uint32 readsCap) external returns (bytes32)',
  'function revokeGrant(bytes32 grantId) external',
  'function consumeRead(bytes32 grantId) external returns (bool)',
  'function isValid(bytes32 grantId, address grantee, bytes32 scopeHash) external view returns (bool)',
  'function grants(bytes32 grantId) external view returns (address owner, address grantee, bytes32 scopeHash, uint64 issuedAt, uint64 expiresAt, uint32 readsRemaining, bool revoked)',
  'function listGrantsByOwner(address owner) external view returns (bytes32[])',
  'function listGrantsByGrantee(address grantee) external view returns (bytes32[])',
  'event GrantIssued(bytes32 indexed grantId, address indexed owner, address indexed grantee, bytes32 scopeHash, uint64 expiresAt, uint32 readsCap)',
  'event GrantRevoked(bytes32 indexed grantId, address indexed owner)',
  'event GrantConsumed(bytes32 indexed grantId, uint32 readsRemaining)',
] as const;

export interface GrantData {
  grantId: Hash;
  owner: Address;
  grantee: Address;
  scopeHash: Hash;
  issuedAt: bigint;
  expiresAt: bigint;
  readsRemaining: bigint;
  revoked: boolean;
}

export class CapabilityRegistryClient {
  readonly address: Address;
  private contract: Contract;

  constructor(address: Address, runner: ContractRunner) {
    this.address = address;
    this.contract = new Contract(address, CAPABILITY_REGISTRY_ABI, runner);
  }

  async issueGrant(grantee: Address, scopeHash: Hash, ttlSeconds: number | bigint, readsCap: number = 0xffffffff): Promise<ContractTransactionResponse> {
    const ttl = typeof ttlSeconds === 'number' ? BigInt(ttlSeconds) : ttlSeconds;
    return this.contract.issueGrant!(grantee, scopeHash, ttl, readsCap);
  }

  async revokeGrant(grantId: Hash): Promise<ContractTransactionResponse> {
    return this.contract.revokeGrant!(grantId);
  }

  /** Decrement reads on a grant; returns tx (caller awaits .wait()). */
  async consumeRead(grantId: Hash): Promise<ContractTransactionResponse> {
    return this.contract.consumeRead!(grantId);
  }

  async getGrant(grantId: Hash): Promise<GrantData | null> {
    const r = await this.contract.grants!(grantId);
    if (r[0] === '0x0000000000000000000000000000000000000000') return null;
    return {
      grantId,
      owner: r[0] as Address,
      grantee: r[1] as Address,
      scopeHash: r[2] as Hash,
      issuedAt: r[3] as bigint,
      expiresAt: r[4] as bigint,
      readsRemaining: r[5] as bigint,
      revoked: r[6] as boolean,
    };
  }

  async listGrantsByOwner(owner: Address): Promise<Hash[]> {
    return (await this.contract.listGrantsByOwner!(owner)) as Hash[];
  }

  async listGrantsByGrantee(grantee: Address): Promise<Hash[]> {
    return (await this.contract.listGrantsByGrantee!(grantee)) as Hash[];
  }

  async isValid(grantId: Hash, grantee: Address, scopeHash: Hash): Promise<boolean> {
    return (await this.contract.isValid!(grantId, grantee, scopeHash)) as boolean;
  }

  /** Helper: extract the issued grantId from the GrantIssued event log on a tx receipt */
  async grantIdFromTx(tx: ContractTransactionResponse): Promise<Hash | null> {
    const receipt = await tx.wait();
    if (!receipt) return null;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'GrantIssued') return parsed.args[0] as Hash;
      } catch {
        /* not our event */
      }
    }
    return null;
  }
}
