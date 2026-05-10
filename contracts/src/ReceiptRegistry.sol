// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReceiptRegistry
 * @notice Anchors AI Action Receipts on 0G Chain. LEGACY (V1) — new anchors
 *         land on ReceiptRegistryV2. V1 stays live forever for the existing
 *         anchored receipts (chain history immutable).
 * @dev Spine contract for the Ivaronix 0G Agent OS. Every important AI action
 *      produces a Receipt JSON anchored here. See RECEIPTS_SPEC.md §1-4.
 *
 *      Storage packs each Receipt into a small struct (4 slots) for cheap reads.
 *      Per Provus pattern (REFERENCE_PATTERNS §2.1) — packed layout.
 *
 *      Threat model:
 *      - Defends against: receipt-id forgery on chain (each Receipt is keyed
 *        by autoincrementing nextId; ids are dense and immutable).
 *      - Defends against: receipt-content modification once anchored (struct
 *        fields are immutable after anchor()).
 *      - Defends against: anchor by paused operator (Pausable gate; owner
 *        can pause if a downstream bug is discovered).
 *      - Does NOT defend against: agentAddress impersonation. V1 records
 *        agentAddress = msg.sender; the operator-relayer model lets a
 *        relayer claim an agent identity that didn't actually sign the
 *        receipt body. ReceiptRegistryV2 hardens this with EIP-712
 *        signature recovery so agentAddress = recovered signer, not
 *        msg.sender. New anchors should use V2.
 *      - Does NOT defend against: storage-evidence forgery. The evidenceRoot
 *        bytes32 is opaque to the contract; off-chain verifiers must hash
 *        the storage blob and compare.
 *      - Does NOT defend against: a malicious owner pausing the contract
 *        indefinitely. Mitigation: Ownable2Step transfer + community review
 *        of the multisig (mainnet).
 */
contract ReceiptRegistry is Ownable2Step, Pausable {
    /// @notice Receipt type codes per RECEIPTS_SPEC.md §1
    uint8 public constant TYPE_DOC_ASK = 0;
    uint8 public constant TYPE_AUDIT = 1;
    uint8 public constant TYPE_CONSENSUS = 2;
    uint8 public constant TYPE_BURN = 3;
    uint8 public constant TYPE_MEMORY_ACCESS = 4;
    uint8 public constant TYPE_SKILL_EXEC = 5;
    uint8 public constant TYPE_CODE_CHANGE = 6;
    uint8 public constant TYPE_PASSPORT_UPDATE = 7;
    uint8 public constant TYPE_SWARM = 8;
    /// @dev Added 2026-05-08 (PASS 76 B-1) for SubscriptionEscrow check-ins
    uint8 public constant TYPE_SUBSCRIPTION_SKILL_EXEC = 9;

    struct Receipt {
        bytes32 receiptRoot;        // keccak256 of canonical receipt JSON
        bytes32 storageRoot;        // 0G Storage Merkle root of the receipt JSON file
        bytes32 attestationHash;    // TEE attestation hash (Router or independent)
        address agentAddress;       // wallet that owns the receipt (signer)
        uint64 timestamp;           // block.timestamp when anchored
        uint8 receiptType;          // 0..8 per RECEIPTS_SPEC.md §1
    }

    /// @notice receiptId => Receipt
    mapping(uint256 => Receipt) public receipts;

    /// @notice Number of receipts anchored. Also serves as the next id.
    uint256 public nextId;

    /// @notice receipts anchored by a specific agent
    mapping(address => uint256) public agentReceiptCount;

    event ReceiptAnchored(
        uint256 indexed id,
        bytes32 indexed receiptRoot,
        address indexed agent,
        uint8 receiptType,
        bytes32 storageRoot,
        bytes32 attestationHash
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Anchor a receipt on chain.
     * @param receiptRoot keccak256 of the canonical (signature-excluded) receipt JSON
     * @param storageRoot 0G Storage Merkle root of the canonical+signed receipt JSON file
     * @param receiptType receipt type code per RECEIPTS_SPEC.md §1
     * @param attestationHash TEE attestation hash (zero if N/A)
     * @return id the receipt id assigned
     */
    function anchor(
        bytes32 receiptRoot,
        bytes32 storageRoot,
        uint8 receiptType,
        bytes32 attestationHash
    ) external whenNotPaused returns (uint256 id) {
        require(receiptRoot != bytes32(0), "ReceiptRegistry: empty receiptRoot");
        require(storageRoot != bytes32(0), "ReceiptRegistry: empty storageRoot");
        require(receiptType <= TYPE_SUBSCRIPTION_SKILL_EXEC, "ReceiptRegistry: invalid type");

        id = nextId++;
        receipts[id] = Receipt({
            receiptRoot: receiptRoot,
            storageRoot: storageRoot,
            attestationHash: attestationHash,
            agentAddress: msg.sender,
            timestamp: uint64(block.timestamp),
            receiptType: receiptType
        });

        agentReceiptCount[msg.sender]++;

        emit ReceiptAnchored(id, receiptRoot, msg.sender, receiptType, storageRoot, attestationHash);
    }

    /// @notice Pause new anchors (emergency only)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume anchors
    function unpause() external onlyOwner {
        _unpause();
    }
}
