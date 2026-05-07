// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReceiptRegistry
 * @notice Anchors AI Action Receipts on 0G Chain.
 * @dev Spine contract for the Ivaronix 0G Agent OS. Every important AI action
 *      produces a Receipt JSON anchored here. See RECEIPTS_SPEC.md §1-4.
 *
 *      Storage packs each Receipt into a small struct (4 slots) for cheap reads.
 *      Per Provus pattern (REFERENCE_PATTERNS §2.1) — packed layout.
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
        require(receiptType <= TYPE_SWARM, "ReceiptRegistry: invalid type");

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
