import { Contract, type ContractRunner, type ContractTransactionResponse } from 'ethers';
import type { Address, Hash } from '@ivaronix/core';

export const AGENT_PASSPORT_ABI = [
  // Mint + state
  'function mint(bytes32 metadataRoot) external returns (uint256)',
  'function nextTokenId() external view returns (uint256)',
  'function passportOf(address) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function balanceOf(address owner) external view returns (uint256)',
  // Agent data tuple: (metadataRoot, memoryRoot, skillManifestRoot, receiptCount, violationCount, trustScore, mintedAt, lastEvolutionAt)
  'function agents(uint256 tokenId) external view returns (bytes32 metadataRoot, bytes32 memoryRoot, bytes32 skillManifestRoot, uint64 receiptCount, uint64 violationCount, int128 trustScore, uint64 mintedAt, uint64 lastEvolutionAt)',

  // Reputation
  'function recordReceipt(uint256 tokenId, bytes32 receiptRoot, uint8 receiptType, int128 trustScoreDelta) external',
  'function recordViolation(uint256 tokenId, int128 trustScoreDelta, string reason) external',
  'function authorizedRecorders(address) external view returns (bool)',
  'function addAuthorizedRecorder(address recorder) external',
  'function removeAuthorizedRecorder(address recorder) external',

  // State updates
  'function updateMemoryRoot(uint256 tokenId, bytes32 newRoot) external',
  'function updateSkillManifestRoot(uint256 tokenId, bytes32 newRoot) external',
  'function rotateMetadata(uint256 tokenId, bytes32 newRoot) external',

  // Authorized executors
  'function authorizeExecutor(uint256 tokenId, address executor, uint64 ttlSeconds) external',
  'function revokeExecutor(uint256 tokenId, address executor) external',
  'function isAuthorizedExecutor(uint256 tokenId, address executor) external view returns (bool)',
  'function executorAuthorizations(uint256 tokenId, address executor) external view returns (uint64)',

  // ERC-7857 transfer
  'function iTransferFrom(address from, address to, uint256 tokenId, bytes32 newMetadataRoot, bytes32 nonce, bytes attestorSignature) external',

  // Pausable
  'function paused() external view returns (bool)',
  'function pause() external',
  'function unpause() external',

  // Verifier
  'function verifier() external view returns (address)',

  // Events
  'event PassportMinted(uint256 indexed tokenId, address indexed owner, bytes32 metadataRoot)',
  'event ReceiptRecorded(uint256 indexed tokenId, bytes32 indexed receiptRoot, uint8 receiptType, int128 trustScoreDelta)',
  'event MemoryRootUpdated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot)',
  'event SkillManifestRootUpdated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot)',
  'event MetadataRotated(uint256 indexed tokenId, bytes32 oldRoot, bytes32 newRoot)',
  'event ExecutorAuthorized(uint256 indexed tokenId, address indexed executor, uint64 expiresAt)',
  'event ExecutorRevoked(uint256 indexed tokenId, address indexed executor)',
  'event ViolationRecorded(uint256 indexed tokenId, int128 trustScoreDelta, string reason)',
] as const;

export interface PassportData {
  tokenId: bigint;
  owner: Address;
  metadataRoot: Hash;
  memoryRoot: Hash;
  skillManifestRoot: Hash;
  receiptCount: bigint;
  violationCount: bigint;
  trustScore: bigint; // int128 — may be negative
  mintedAt: bigint;
  lastEvolutionAt: bigint;
}

export class AgentPassportClient {
  readonly address: Address;
  private contract: Contract;

  constructor(address: Address, runner: ContractRunner) {
    this.address = address;
    this.contract = new Contract(address, AGENT_PASSPORT_ABI, runner);
  }

  async mint(metadataRoot: Hash): Promise<ContractTransactionResponse> {
    return this.contract.mint!(metadataRoot);
  }

  async nextTokenId(): Promise<bigint> {
    return (await this.contract.nextTokenId!()) as bigint;
  }

  async passportOf(wallet: Address): Promise<bigint> {
    return (await this.contract.passportOf!(wallet)) as bigint;
  }

  async getPassport(tokenId: bigint | number): Promise<PassportData | null> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    if (id === 0n) return null;
    try {
      const [
        metadataRoot,
        memoryRoot,
        skillManifestRoot,
        receiptCount,
        violationCount,
        trustScore,
        mintedAt,
        lastEvolutionAt,
      ] = await this.contract.agents!(id);
      const owner = (await this.contract.ownerOf!(id)) as Address;
      return {
        tokenId: id,
        owner,
        metadataRoot: metadataRoot as Hash,
        memoryRoot: memoryRoot as Hash,
        skillManifestRoot: skillManifestRoot as Hash,
        receiptCount: receiptCount as bigint,
        violationCount: violationCount as bigint,
        trustScore: trustScore as bigint,
        mintedAt: mintedAt as bigint,
        lastEvolutionAt: lastEvolutionAt as bigint,
      };
    } catch {
      return null;
    }
  }

  async getPassportByWallet(wallet: Address): Promise<PassportData | null> {
    const tokenId = await this.passportOf(wallet);
    if (tokenId === 0n) return null;
    return this.getPassport(tokenId);
  }

  async recordReceipt(
    tokenId: bigint | number,
    receiptRoot: Hash,
    receiptType: number,
    trustScoreDelta: bigint | number,
  ): Promise<ContractTransactionResponse> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    const delta = typeof trustScoreDelta === 'number' ? BigInt(trustScoreDelta) : trustScoreDelta;
    return this.contract.recordReceipt!(id, receiptRoot, receiptType, delta);
  }

  async updateMemoryRoot(tokenId: bigint | number, newRoot: Hash): Promise<ContractTransactionResponse> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    return this.contract.updateMemoryRoot!(id, newRoot);
  }

  async updateSkillManifestRoot(tokenId: bigint | number, newRoot: Hash): Promise<ContractTransactionResponse> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    return this.contract.updateSkillManifestRoot!(id, newRoot);
  }

  /** Authorize an executor address for tokenId for ttlSeconds (sliding window). */
  async authorizeExecutor(
    tokenId: bigint | number,
    executor: Address,
    ttlSeconds: bigint | number,
  ): Promise<ContractTransactionResponse> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    const ttl = typeof ttlSeconds === 'number' ? BigInt(ttlSeconds) : ttlSeconds;
    return this.contract.authorizeExecutor!(id, executor, ttl);
  }

  /** Revoke an executor's authorization for a tokenId. */
  async revokeExecutor(
    tokenId: bigint | number,
    executor: Address,
  ): Promise<ContractTransactionResponse> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    return this.contract.revokeExecutor!(id, executor);
  }

  /** True iff the executor is currently authorized (and not expired) for the tokenId. */
  async isAuthorizedExecutor(tokenId: bigint | number, executor: Address): Promise<boolean> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    return (await this.contract.isAuthorizedExecutor!(id, executor)) as boolean;
  }

  /** Returns the absolute unix-second expiry for the executor (0 = never authorized). */
  async executorExpiry(tokenId: bigint | number, executor: Address): Promise<bigint> {
    const id = typeof tokenId === 'number' ? BigInt(tokenId) : tokenId;
    return (await this.contract.executorAuthorizations!(id, executor)) as bigint;
  }
}
