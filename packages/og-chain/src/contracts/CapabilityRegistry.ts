import { Contract, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

export const CAPABILITY_REGISTRY_ABI = [
  'function issueGrant(address grantee, bytes32 scopeHash, uint64 ttlSeconds, uint32 readsCap) external returns (bytes32)',
  'function revokeGrant(bytes32 grantId) external',
  'function consumeRead(bytes32 grantId) external returns (bool)',
  'function isValid(bytes32 grantId, address grantee, bytes32 scopeHash) external view returns (bool)',
  'function grants(bytes32 grantId) external view returns (address owner, address grantee, bytes32 scopeHash, uint64 issuedAt, uint64 expiresAt, uint32 readsRemaining, bool revoked)',
  // V1 read names (legacy testnet deployment). Public — no auth.
  'function listGrantsByOwner(address owner) external view returns (bytes32[])',
  'function listGrantsByGrantee(address grantee) external view returns (bytes32[])',
  // V2 read names. V2 added a privacy gate (require msg.sender == owner OR
  // authorized indexer per CapabilityRegistryV2.sol:219-237). Plain
  // eth_call from a Provider sets msg.sender=0x0, which always fails the
  // gate. The client uses these via `from: <wallet>` overrides — see
  // CapabilityRegistryClient.listGrantsByOwner below.
  'function getGrantsByOwner(address owner) external view returns (bytes32[])',
  'function getGrantsByGrantee(address grantee) external view returns (bytes32[])',
  // V2 self-read views — no auth needed because they read msg.sender's
  // own index. The client prefers these when the target == caller wallet,
  // which is the common case (CLI's `memory list` with no --by/--to flag).
  'function listMyOwnerGrants() external view returns (bytes32[])',
  'function listMyGranteeGrants() external view returns (bytes32[])',
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

  /**
   * List grants issued by `owner`. Walks the deployment versions:
   *   - V2 self-read (listMyOwnerGrants) when caller wallet == owner: no auth
   *     required, common case for CLI's `memory list` with no --by/--to flag.
   *   - V2 indexer read (getGrantsByOwner) when an `eth_call from` override
   *     can satisfy the V2 privacy gate (caller is owner or authorized).
   *   - V1 public read (listGrantsByOwner) as legacy testnet fallback.
   *
   * The `callerWallet` argument is optional; when omitted only the V1 path
   * is tried (V2's privacy gate would always revert on `from: 0x0`).
   */
  async listGrantsByOwner(owner: Address, callerWallet?: Address): Promise<Hash[]> {
    // V2 self-read: zero-auth when caller == owner.
    if (callerWallet && callerWallet.toLowerCase() === owner.toLowerCase()) {
      try {
        return (await this.contract.listMyOwnerGrants!({ from: callerWallet })) as Hash[];
      } catch {
        // V1 contracts don't have listMyOwnerGrants; fall through to V1 path.
      }
    }
    // V2 indexer read with `from` override (works when caller is owner or
    // an authorized reader on V2; works on V1 too since V1 ignores `from`).
    if (callerWallet) {
      try {
        return (await this.contract.getGrantsByOwner!(owner, { from: callerWallet })) as Hash[];
      } catch {
        // V1 contracts don't have getGrantsByOwner; fall through.
      }
    }
    // V1 public read.
    return (await this.contract.listGrantsByOwner!(owner)) as Hash[];
  }

  async listGrantsByGrantee(grantee: Address, callerWallet?: Address): Promise<Hash[]> {
    if (callerWallet && callerWallet.toLowerCase() === grantee.toLowerCase()) {
      try {
        return (await this.contract.listMyGranteeGrants!({ from: callerWallet })) as Hash[];
      } catch {
        // fall through
      }
    }
    if (callerWallet) {
      try {
        return (await this.contract.getGrantsByGrantee!(grantee, { from: callerWallet })) as Hash[];
      } catch {
        // fall through
      }
    }
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
