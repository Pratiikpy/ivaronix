import { Contract, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

export const MEMORY_ACCESS_LOG_ABI = [
  'function logAccess(address agent, bytes32 grantId, bytes32 memoryRoot, uint8 accessType, bytes32 scopeHash) external',
  'function ACCESS_READ() external view returns (uint8)',
  'function ACCESS_WRITE() external view returns (uint8)',
  'function ACCESS_DELETE() external view returns (uint8)',
  'function ACCESS_GRANT_USED() external view returns (uint8)',
  'event MemoryAccessed(address indexed agent, bytes32 indexed grantId, bytes32 indexed memoryRoot, uint8 accessType, uint64 timestamp, bytes32 scopeHash)',
] as const;

export const MEMORY_ACCESS = {
  READ: 0,
  WRITE: 1,
  DELETE: 2,
  GRANT_USED: 3,
} as const;
export type MemoryAccessType = (typeof MEMORY_ACCESS)[keyof typeof MEMORY_ACCESS];

export interface MemoryAccessEvent {
  agent: Address;
  grantId: Hash;
  memoryRoot: Hash;
  accessType: number;
  timestamp: bigint;
  scopeHash: Hash;
  txHash: Hash;
  blockNumber: number;
}

export class MemoryAccessLogClient {
  readonly address: Address;
  private contract: Contract;

  constructor(address: Address, runner: ContractRunner) {
    this.address = address;
    this.contract = new Contract(address, MEMORY_ACCESS_LOG_ABI, runner);
  }

  async logAccess(
    agent: Address,
    grantId: Hash,
    memoryRoot: Hash,
    accessType: MemoryAccessType,
    scopeHash: Hash,
  ): Promise<ContractTransactionResponse> {
    return this.contract.logAccess!(agent, grantId, memoryRoot, accessType, scopeHash);
  }

  /** Query historical access events for a given agent. Useful for the access-log audit view. */
  async listForAgent(agent: Address, lookbackBlocks = 200_000): Promise<MemoryAccessEvent[]> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('MemoryAccessLogClient: no provider attached');
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - lookbackBlocks);
    const filter = this.contract.filters.MemoryAccessed!(agent);
    const events = await this.contract.queryFilter(filter, fromBlock, latest);
    return events.map((ev) => mapEvent(ev));
  }

  /**
   * Query all historical access events across every agent in the lookback
   * window. Used by Studio's `/global` aggregate view (planning-003 §A.4.8).
   *
   * Pre-sweep-82, `/global/page.tsx:44` reached into this client's private
   * `contract` field via a `(client as unknown as {...}).contract` cast to
   * call queryFilter directly — broke encapsulation. This method exposes
   * the unfiltered scan as a first-class API so the cast is no longer
   * needed.
   */
  async listGlobal(lookbackBlocks = 200_000): Promise<MemoryAccessEvent[]> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('MemoryAccessLogClient: no provider attached');
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - lookbackBlocks);
    // Unfiltered call — no agent argument means "all agents".
    const filter = this.contract.filters.MemoryAccessed!();
    const events = await this.contract.queryFilter(filter, fromBlock, latest);
    return events.map((ev) => mapEvent(ev));
  }
}

function mapEvent(ev: { args?: unknown; transactionHash: string; blockNumber: number }): MemoryAccessEvent {
  const args = (ev as { args: unknown[] }).args;
  return {
    agent: args[0] as Address,
    grantId: args[1] as Hash,
    memoryRoot: args[2] as Hash,
    accessType: Number(args[3]),
    timestamp: args[4] as bigint,
    scopeHash: args[5] as Hash,
    txHash: ev.transactionHash as Hash,
    blockNumber: ev.blockNumber,
  };
}
