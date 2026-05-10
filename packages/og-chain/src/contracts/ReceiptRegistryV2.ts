import { Contract, Signer, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

/**
 * Minimal ABI for the ReceiptRegistryV2 contract — covers all functions +
 * events Ivaronix uses. K-2 fix per HALF_BAKED.md: anchor() takes a
 * struct + signature, recovers `agentAddress` from the EIP-712 signature
 * (no longer trusting `msg.sender`).
 */
export const RECEIPT_REGISTRY_V2_ABI = [
  // anchor((root, storageRoot, type, attHash, agent, deadline), signature) -> uint256 id
  'function anchor((bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash, address agentAddress, uint256 deadline) p, bytes signature) external returns (uint256)',
  // EIP-712 helper
  'function digestFor(bytes32 receiptRoot, bytes32 storageRoot, uint8 receiptType, bytes32 attestationHash, address agentAddress, uint256 nonce, uint256 deadline) external view returns (bytes32)',
  // Reads
  'function receipts(uint256 id) external view returns (bytes32 receiptRoot, bytes32 storageRoot, bytes32 attestationHash, address agentAddress, uint64 timestamp, uint8 receiptType)',
  'function nextId() external view returns (uint256)',
  'function agentReceiptCount(address) external view returns (uint256)',
  'function nonces(address) external view returns (uint256)',
  'function ANCHOR_TYPEHASH() external view returns (bytes32)',
  'function owner() external view returns (address)',
  'function paused() external view returns (bool)',
  // Event — note V2 adds `relayer` and `nonce` versus V1's shape.
  'event ReceiptAnchored(uint256 indexed id, bytes32 indexed receiptRoot, address indexed agent, uint8 receiptType, bytes32 storageRoot, bytes32 attestationHash, address relayer, uint256 nonce)',
] as const;

export interface OnChainReceiptV2 {
  id: bigint;
  receiptRoot: Hash;
  storageRoot: Hash;
  attestationHash: Hash;
  agentAddress: Address;
  timestamp: bigint;
  receiptType: number;
  /** Marker for off-chain consumers — distinguishes V1 from V2 receipts in the same union. */
  registryVersion: 2;
}

export interface AnchorParams {
  receiptRoot: Hash;
  storageRoot: Hash;
  receiptType: number;
  attestationHash: Hash;
  agentAddress: Address;
  deadline: bigint;
}

/**
 * EIP-712 domain for ReceiptRegistryV2. Constructor pinned to
 * `EIP712("Ivaronix.ReceiptRegistry", "2")`. The `verifyingContract` +
 * `chainId` come from the deployed instance.
 */
export interface RegistryV2Domain {
  name: 'Ivaronix.ReceiptRegistry';
  version: '2';
  chainId: number;
  verifyingContract: Address;
}

const ANCHOR_TYPES = {
  Anchor: [
    { name: 'receiptRoot', type: 'bytes32' },
    { name: 'storageRoot', type: 'bytes32' },
    { name: 'receiptType', type: 'uint8' },
    { name: 'attestationHash', type: 'bytes32' },
    { name: 'agentAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

export class ReceiptRegistryV2Client {
  readonly address: Address;
  private contract: Contract;

  constructor(address: Address, runner: ContractRunner) {
    this.address = address;
    this.contract = new Contract(address, RECEIPT_REGISTRY_V2_ABI, runner);
  }

  /** Build the EIP-712 domain. */
  domain(chainId: number): RegistryV2Domain {
    return {
      name: 'Ivaronix.ReceiptRegistry',
      version: '2',
      chainId,
      verifyingContract: this.address,
    };
  }

  /**
   * Sign + anchor in one call. The `runner` MUST be a Signer matching
   * `params.agentAddress` — the contract recovers the signer and reverts
   * if it does not match the claimed agent.
   *
   * `nonce` is read from chain when omitted. `deadline` defaults to
   * `now + 1 hour`.
   *
   * Anyone (any wallet, including an operator-side relayer) can submit
   * the tx; the recorded `agentAddress` is the signer regardless of
   * `msg.sender`.
   */
  async signAndAnchor(
    signer: Signer,
    params: Omit<AnchorParams, 'agentAddress' | 'deadline'> & { agentAddress?: Address; deadline?: bigint },
    options?: { chainId?: number; nonce?: bigint; relayer?: Signer },
  ): Promise<{ tx: ContractTransactionResponse; signature: `0x${string}`; nonce: bigint; deadline: bigint }> {
    const agentAddress = (params.agentAddress ?? (await signer.getAddress())) as Address;
    const deadline = params.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = options?.nonce ?? (await this.nonces(agentAddress));
    const chainId = options?.chainId ?? Number((await signer.provider!.getNetwork()).chainId);

    const signature = (await signer.signTypedData(
      this.domain(chainId),
      ANCHOR_TYPES,
      {
        receiptRoot: params.receiptRoot,
        storageRoot: params.storageRoot,
        receiptType: params.receiptType,
        attestationHash: params.attestationHash,
        agentAddress,
        nonce,
        deadline,
      },
    )) as `0x${string}`;

    const submitter = options?.relayer ?? signer;
    const contractWithSubmitter = this.contract.connect(submitter) as Contract;

    const struct = {
      receiptRoot: params.receiptRoot,
      storageRoot: params.storageRoot,
      receiptType: params.receiptType,
      attestationHash: params.attestationHash,
      agentAddress,
      deadline,
    };

    const tx = (await contractWithSubmitter.anchor!(struct, signature)) as ContractTransactionResponse;
    return { tx, signature, nonce, deadline };
  }

  async getReceipt(id: bigint | number): Promise<OnChainReceiptV2 | null> {
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
      registryVersion: 2,
    };
  }

  // lookbackBlocks default raised to 5_000_000 in sweep 61 to cover
  // most testnet history at 3s block time (~150 days). The previous
  // 100_000 default missed receipts older than ~3 days. Same fix
  // applied to ReceiptRegistry V1 for consistency.
  async findByReceiptRoot(receiptRoot: Hash, lookbackBlocks = 5_000_000): Promise<OnChainReceiptV2 | null> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('ReceiptRegistryV2Client: no provider attached to runner');
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - lookbackBlocks);
    return this.findByReceiptRootInRange(receiptRoot, fromBlock, latest);
  }

  /**
   * Tight-range variant: same shape as ReceiptRegistry V1's helper.
   * Used by the verifier when the receipt's chainAnchor carries an
   * anchorBlockNumber hint (sweep 61).
   */
  async findByReceiptRootInRange(
    receiptRoot: Hash,
    fromBlock: number,
    toBlock: number,
  ): Promise<OnChainReceiptV2 | null> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('ReceiptRegistryV2Client: no provider attached to runner');
    const filter = this.contract.filters.ReceiptAnchored!(undefined, receiptRoot);
    const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
    if (events.length === 0) return null;
    const ev = events[events.length - 1]!;
    const args = (ev as { args: unknown[] }).args;
    return {
      id: args[0] as bigint,
      receiptRoot: args[1] as Hash,
      storageRoot: args[4] as Hash,
      attestationHash: args[5] as Hash,
      agentAddress: args[2] as Address,
      timestamp: BigInt((await provider.getBlock(ev.blockNumber))?.timestamp ?? 0),
      receiptType: Number(args[3]),
      registryVersion: 2,
    };
  }

  async findByAgent(agent: Address, limit = 10, lookbackBlocks = 100_000): Promise<OnChainReceiptV2[]> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('ReceiptRegistryV2Client: no provider attached to runner');
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - lookbackBlocks);
    const filter = this.contract.filters.ReceiptAnchored!(undefined, undefined, agent);
    const events = await this.contract.queryFilter(filter, fromBlock, latest);
    const sorted = events.slice().reverse().slice(0, limit);
    const out: OnChainReceiptV2[] = [];
    for (const ev of sorted) {
      const args = (ev as { args: unknown[] }).args;
      const block = await provider.getBlock(ev.blockNumber);
      out.push({
        id: args[0] as bigint,
        receiptRoot: args[1] as Hash,
        storageRoot: args[4] as Hash,
        attestationHash: args[5] as Hash,
        agentAddress: args[2] as Address,
        timestamp: BigInt(block?.timestamp ?? 0),
        receiptType: Number(args[3]),
        registryVersion: 2,
      });
    }
    return out;
  }

  async nextId(): Promise<bigint> {
    return (await this.contract.nextId!()) as bigint;
  }

  async nonces(agent: Address): Promise<bigint> {
    return (await this.contract.nonces!(agent)) as bigint;
  }

  async agentReceiptCount(agent: Address): Promise<bigint> {
    return (await this.contract.agentReceiptCount!(agent)) as bigint;
  }

  async paused(): Promise<boolean> {
    return (await this.contract.paused!()) as boolean;
  }
}

/**
 * Resolve the active ReceiptRegistry version for a given network.
 * Returns 'v2' when `ReceiptRegistryV2` is deployed; falls back to 'v1'.
 * Off-chain callers use this to decide which client to construct.
 */
export type RegistryVersionLabel = 'v1' | 'v2';

export function activeRegistryVersion(
  v2Address: Address | null,
  v1Address: Address | null,
): { version: RegistryVersionLabel; address: Address } | null {
  if (v2Address) return { version: 'v2', address: v2Address };
  if (v1Address) return { version: 'v1', address: v1Address };
  return null;
}
