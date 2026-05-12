import { Contract, Signer, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

/**
 * Minimal ABI for the ReceiptRegistryV3 contract — extends V2 to admit
 * receipt-type slots 10/11/12 (doc_room_create · doc_room_read ·
 * memory_consolidation). Closes audit B-V2-32. The ABI shape is identical
 * to V2 — only the contract-side constants + require differ. Off-chain
 * the only-observable change is the EIP-712 domain version "2" → "3"
 * (different domain separator so V2 signatures cannot replay).
 *
 * Per .claude/rules/contracts.md "V2 = new contract, NOT upgrade": V3
 * is a fresh deployment at a new address. The shipped V2 instance at
 * 0xf675d4183b34fe8d1981FA9c117065aAcff690ab stays live for the 7
 * V2-anchored receipts. Off-chain readers branch on
 * chainAnchor.registryAddress (V3 first, V2 fallback, V1 fallback)
 * per the unifiedX helper pattern in apps/studio/src/lib/chain.ts.
 */
export const RECEIPT_REGISTRY_V3_ABI = [
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
  // Event — identical to V2 shape (B-V2-32 keeps the event signature
  // stable so existing off-chain consumers don't need to fork their
  // event parsers).
  'event ReceiptAnchored(uint256 indexed id, bytes32 indexed receiptRoot, address indexed agent, uint8 receiptType, bytes32 storageRoot, bytes32 attestationHash, address relayer, uint256 nonce)',
] as const;

export interface OnChainReceiptV3 {
  id: bigint;
  receiptRoot: Hash;
  storageRoot: Hash;
  attestationHash: Hash;
  agentAddress: Address;
  timestamp: bigint;
  receiptType: number;
  /** Marker for off-chain consumers — distinguishes V3 from V2/V1 in the same union. */
  registryVersion: 3;
}

export interface AnchorParamsV3 {
  receiptRoot: Hash;
  storageRoot: Hash;
  receiptType: number;
  attestationHash: Hash;
  agentAddress: Address;
  deadline: bigint;
}

/**
 * EIP-712 domain for ReceiptRegistryV3. Constructor pinned to
 * `EIP712("Ivaronix.ReceiptRegistry", "3")`. The verifyingContract +
 * chainId come from the deployed instance.
 */
export interface RegistryV3Domain {
  name: 'Ivaronix.ReceiptRegistry';
  version: '3';
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

export class ReceiptRegistryV3Client {
  readonly address: Address;
  private contract: Contract;

  constructor(address: Address, runner: ContractRunner) {
    this.address = address;
    this.contract = new Contract(address, RECEIPT_REGISTRY_V3_ABI, runner);
  }

  /** Build the EIP-712 domain · v3 differs from v2 in the version byte. */
  domain(chainId: number): RegistryV3Domain {
    return {
      name: 'Ivaronix.ReceiptRegistry',
      version: '3',
      chainId,
      verifyingContract: this.address,
    };
  }

  /** Sign + anchor in one call · same shape as V2. */
  async signAndAnchor(
    signer: Signer,
    params: Omit<AnchorParamsV3, 'agentAddress' | 'deadline'> & { agentAddress?: Address; deadline?: bigint },
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

  async getReceipt(id: bigint | number): Promise<OnChainReceiptV3 | null> {
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
      registryVersion: 3,
    };
  }

  async findByReceiptRoot(receiptRoot: Hash, lookbackBlocks = 5_000_000): Promise<OnChainReceiptV3 | null> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('ReceiptRegistryV3Client: no provider attached to runner');
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - lookbackBlocks);
    return this.findByReceiptRootInRange(receiptRoot, fromBlock, latest);
  }

  async findByReceiptRootInRange(
    receiptRoot: Hash,
    fromBlock: number,
    toBlock: number,
  ): Promise<OnChainReceiptV3 | null> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('ReceiptRegistryV3Client: no provider attached to runner');
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
      registryVersion: 3,
    };
  }

  async findByAgent(agent: Address, limit = 10, lookbackBlocks = 100_000): Promise<OnChainReceiptV3[]> {
    const provider = this.contract.runner?.provider;
    if (!provider) throw new Error('ReceiptRegistryV3Client: no provider attached to runner');
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - lookbackBlocks);
    const filter = this.contract.filters.ReceiptAnchored!(undefined, undefined, agent);
    const events = await this.contract.queryFilter(filter, fromBlock, latest);
    const sorted = events.slice().reverse().slice(0, limit);
    const out: OnChainReceiptV3[] = [];
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
        registryVersion: 3,
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
}
