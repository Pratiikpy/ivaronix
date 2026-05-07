import { Contract, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

/** Minimal ABI for the ReceiptRegistry contract — covers all functions + events Ivaronix uses. */
export const RECEIPT_REGISTRY_ABI = [
  // anchor(receiptRoot, storageRoot, receiptType, attestationHash) → uint256 id
  'function anchor(bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash) external returns (uint256)',
  // receipts(id) → tuple
  'function receipts(uint256 id) external view returns (bytes32 receiptRoot, bytes32 storageRoot, bytes32 attestationHash, address agentAddress, uint64 timestamp, uint8 receiptType)',
  'function nextId() external view returns (uint256)',
  'function agentReceiptCount(address) external view returns (uint256)',
  'function owner() external view returns (address)',
  'function paused() external view returns (bool)',
  'function pause() external',
  'function unpause() external',
  // Event
  'event ReceiptAnchored(uint256 indexed id, bytes32 indexed receiptRoot, address indexed agent, uint8 receiptType, bytes32 storageRoot, bytes32 attestationHash)',
] as const;

export interface OnChainReceipt {
  id: bigint;
  receiptRoot: Hash;
  storageRoot: Hash;
  attestationHash: Hash;
  agentAddress: Address;
  timestamp: bigint;
  receiptType: number;
}

export class ReceiptRegistryClient {
  readonly address: Address;
  private contract: Contract;

  constructor(address: Address, runner: ContractRunner) {
    this.address = address;
    this.contract = new Contract(address, RECEIPT_REGISTRY_ABI, runner);
  }

  /** Anchor a receipt on chain. Returns tx response (caller awaits .wait() for confirmation). */
  async anchor(
    receiptRoot: Hash,
    storageRoot: Hash,
    receiptType: number,
    attestationHash: Hash,
  ): Promise<ContractTransactionResponse> {
    return this.contract.anchor!(receiptRoot, storageRoot, receiptType, attestationHash);
  }

  /** Read a receipt by id. Returns null if id ≥ nextId. */
  async getReceipt(id: bigint | number): Promise<OnChainReceipt | null> {
    const idBn = typeof id === 'number' ? BigInt(id) : id;
    const next = await this.nextId();
    if (idBn >= next) return null;

    const r = await this.contract.receipts!(idBn);
    return {
      id: idBn,
      receiptRoot: r[0] as Hash,
      storageRoot: r[1] as Hash,
      attestationHash: r[2] as Hash,
      agentAddress: r[3] as Address,
      timestamp: r[4] as bigint,
      receiptType: Number(r[5]),
    };
  }

  /** Find on-chain receipt by receiptRoot via ReceiptAnchored event. Returns null if not found. */
  async findByReceiptRoot(receiptRoot: Hash, lookbackBlocks = 100_000): Promise<OnChainReceipt | null> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('ReceiptRegistryClient: no provider attached to runner');

    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - lookbackBlocks);

    const filter = this.contract.filters.ReceiptAnchored!(undefined, receiptRoot);
    const events = await this.contract.queryFilter(filter, fromBlock, latest);
    if (events.length === 0) return null;

    const ev = events[events.length - 1]!;
    // ev.args = [id, receiptRoot, agent, receiptType, storageRoot, attestationHash]
    const args = (ev as { args: unknown[] }).args;
    return {
      id: args[0] as bigint,
      receiptRoot: args[1] as Hash,
      storageRoot: args[4] as Hash,
      attestationHash: args[5] as Hash,
      agentAddress: args[2] as Address,
      timestamp: BigInt((await provider.getBlock(ev.blockNumber))?.timestamp ?? 0),
      receiptType: Number(args[3]),
    };
  }

  async nextId(): Promise<bigint> {
    return (await this.contract.nextId!()) as bigint;
  }

  async agentReceiptCount(agent: Address): Promise<bigint> {
    return (await this.contract.agentReceiptCount!(agent)) as bigint;
  }

  async paused(): Promise<boolean> {
    return (await this.contract.paused!()) as boolean;
  }
}
