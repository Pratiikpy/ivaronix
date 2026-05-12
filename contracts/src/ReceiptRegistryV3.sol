// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ReceiptRegistryV3
 * @notice Receipt anchor with EIP-712-recovered agent identity + extended
 *         receipt-type range (closes the V2 chain-cap coercion gap).
 *
 * Closes audit B-V2-32. V2 capped receiptType at 9 (TYPE_SUBSCRIPTION_SKILL_EXEC),
 * so slots 10 (doc_room_create) / 11 (doc_room_read) / 12 (memory_consolidation)
 * in the off-chain RECEIPT_TYPES enum had no faithful on-chain encoding —
 * CLI commands hardcoded a type-4 (memory_access) coercion for those slots.
 * V3 admits the full 0-12 range so chain events filtered by receiptType
 * surface faithful results for every off-chain type.
 *
 * Per .claude/rules/contracts.md "V2 = new contract, NOT upgrade": V3 is
 * a fresh deployment at a new address. V2 stays live for the existing 7
 * V2-anchored receipts. Off-chain readers branch on chainAnchor.registry-
 * Address (V3 first, V2 fallback, V1 fallback) per the unifiedX helper
 * pattern in apps/studio/src/lib/chain.ts.
 *
 * Threat model:
 *   - Defends against: forged agent-identity claims (V2 EIP-712 invariant
 *     preserved). recorded agentAddress is the signature-recovered signer,
 *     NOT msg.sender.
 *   - Defends against: signature replay (V2 per-agent nonce invariant
 *     preserved).
 *   - Defends against: cross-domain replay (V2 EIP-712 domain pin
 *     preserved). The domain version bumps to "3" so a V2 signature
 *     CANNOT replay on V3 — same recipe shape, different versioning byte,
 *     different domain separator.
 *   - Defends against: deadline-grinding (V2 deadline check preserved).
 *   - Does NOT defend against: signer wallet compromise (V2 limitation
 *     preserved — content trust falls back to attestationHash + 0G
 *     Compute broker.processResponse independent re-verify).
 *   - Does NOT defend against: receipt-content fabrication BEFORE signing
 *     (V2 limitation preserved — TIER 1 vs TIER 2 off-chain distinction
 *     is the content-trust gate; the contract is the chain-anchor gate).
 *   - Assumed attacker capabilities: holds zero valid agent private keys;
 *     may submit arbitrary anchor() calls as msg.sender; may try to
 *     replay captured V2 signatures against V3 (fails on domain separator
 *     mismatch — different EIP-712 version "3" produces different digest).
 */
contract ReceiptRegistryV3 is Ownable2Step, Pausable, EIP712 {
    /// @notice Receipt type codes · extends V2's 0-9 range to 0-12.
    ///         Off-chain RECEIPT_TYPES enum (packages/core/src/types.ts:70)
    ///         is the source of truth for the canonical slot assignments;
    ///         this contract mirrors them faithfully so chain events
    ///         filtered by receiptType produce one-to-one results.
    uint8 public constant TYPE_DOC_ASK = 0;
    uint8 public constant TYPE_AUDIT = 1;
    uint8 public constant TYPE_CONSENSUS = 2;
    uint8 public constant TYPE_BURN = 3;
    uint8 public constant TYPE_MEMORY_ACCESS = 4;
    uint8 public constant TYPE_SKILL_EXEC = 5;
    uint8 public constant TYPE_CODE_CHANGE = 6;
    uint8 public constant TYPE_PASSPORT_UPDATE = 7;
    uint8 public constant TYPE_SWARM = 8;
    uint8 public constant TYPE_SUBSCRIPTION_SKILL_EXEC = 9;
    uint8 public constant TYPE_DOC_ROOM_CREATE = 10;
    uint8 public constant TYPE_DOC_ROOM_READ = 11;
    uint8 public constant TYPE_MEMORY_CONSOLIDATION = 12;

    /// @notice EIP-712 typed-data hash for an anchor request.
    bytes32 public constant ANCHOR_TYPEHASH = keccak256(
        "Anchor(bytes32 receiptRoot,bytes32 storageRoot,uint8 receiptType,bytes32 attestationHash,address agentAddress,uint256 nonce,uint256 deadline)"
    );

    struct Receipt {
        bytes32 receiptRoot;
        bytes32 storageRoot;
        bytes32 attestationHash;
        address agentAddress;       // recovered from signature, NOT msg.sender
        uint64 timestamp;
        uint8 receiptType;
    }

    mapping(uint256 => Receipt) public receipts;
    uint256 public nextId;
    mapping(address => uint256) public agentReceiptCount;

    /// @notice Per-agent monotonic nonce for replay protection.
    mapping(address => uint256) public nonces;

    event ReceiptAnchored(
        uint256 indexed id,
        bytes32 indexed receiptRoot,
        address indexed agent,
        uint8 receiptType,
        bytes32 storageRoot,
        bytes32 attestationHash,
        address relayer,
        uint256 nonce
    );

    constructor(address initialOwner)
        Ownable(initialOwner)
        EIP712("Ivaronix.ReceiptRegistry", "3")
    {}

    /**
     * @notice Calldata struct for `anchor`.
     */
    struct AnchorParams {
        bytes32 receiptRoot;
        bytes32 storageRoot;
        uint8 receiptType;
        bytes32 attestationHash;
        address agentAddress;
        uint256 deadline;
    }

    /**
     * @notice Anchor a receipt with an EIP-712 signature recovering the agent.
     * @dev Anyone can submit (relayer pattern). The recorded agentAddress is
     *      the recovered signer, not msg.sender. V3 extends the receiptType
     *      cap from 9 to 12.
     */
    function anchor(AnchorParams calldata p, bytes calldata signature)
        external
        whenNotPaused
        returns (uint256 id)
    {
        require(p.receiptRoot != bytes32(0), "ReceiptRegistryV3: empty receiptRoot");
        require(p.storageRoot != bytes32(0), "ReceiptRegistryV3: empty storageRoot");
        require(p.receiptType <= TYPE_MEMORY_CONSOLIDATION, "ReceiptRegistryV3: invalid type");
        require(p.agentAddress != address(0), "ReceiptRegistryV3: zero agent");
        require(block.timestamp <= p.deadline, "ReceiptRegistryV3: expired");

        uint256 nonce = nonces[p.agentAddress];
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            ANCHOR_TYPEHASH,
            p.receiptRoot,
            p.storageRoot,
            p.receiptType,
            p.attestationHash,
            p.agentAddress,
            nonce,
            p.deadline
        )));
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == p.agentAddress, "ReceiptRegistryV3: signature does not match agent");

        unchecked { nonces[p.agentAddress] = nonce + 1; }

        id = nextId++;
        receipts[id] = Receipt({
            receiptRoot: p.receiptRoot,
            storageRoot: p.storageRoot,
            attestationHash: p.attestationHash,
            agentAddress: p.agentAddress,
            timestamp: uint64(block.timestamp),
            receiptType: p.receiptType
        });
        agentReceiptCount[p.agentAddress]++;

        emit ReceiptAnchored(
            id,
            p.receiptRoot,
            p.agentAddress,
            p.receiptType,
            p.storageRoot,
            p.attestationHash,
            msg.sender,
            nonce
        );
    }

    /// @notice Build the EIP-712 digest off-chain wallets must sign.
    function digestFor(
        bytes32 receiptRoot,
        bytes32 storageRoot,
        uint8 receiptType,
        bytes32 attestationHash,
        address agentAddress,
        uint256 nonce,
        uint256 deadline
    ) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            ANCHOR_TYPEHASH,
            receiptRoot,
            storageRoot,
            receiptType,
            attestationHash,
            agentAddress,
            nonce,
            deadline
        )));
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
