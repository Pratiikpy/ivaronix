// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title ReceiptRegistryV2
 * @notice Receipt anchor with EIP-712-recovered agent identity (closes K-2).
 *
 * V1's `anchor()` wrote `agentAddress = msg.sender` directly. Any wallet
 * could anchor any `receiptRoot` claiming any agent identity; chain-only
 * verifiers saw the lie. V2 requires an EIP-712 typed-data signature over
 * the receipt fields plus the registry domain (`address(this)` + chainId).
 * The recovered signer becomes `agentAddress`. Replay protection is
 * per-agent monotonic nonces — every anchor consumes one and they cannot
 * be reused.
 *
 * Migration: V1 stays live for the existing 1,330+ anchored receipts —
 * chain history is immutable. V2 is a fresh deployment for new anchors.
 * Off-chain verifiers branch on `chainAnchor.registryAddress` to know
 * which contract to query.
 *
 * Threat model:
 *   - Defends against: forged agent-identity claims on anchors. The
 *     recorded agentAddress is the EIP-712-recovered signer, NOT
 *     msg.sender. A relayer can submit anchors on behalf of a signer
 *     (intended use case for fee abstraction) but cannot impersonate.
 *   - Defends against: signature replay. Per-agent monotonic nonces
 *     consume on every successful anchor; a previously-valid signature
 *     bound to nonce N becomes invalid after the first use.
 *   - Defends against: cross-domain replay. The EIP-712 domain pins
 *     verifyingContract = address(this) and chainId, so a signature
 *     valid on testnet cannot anchor on mainnet and vice versa.
 *   - Defends against: deadline-grinding. signTypedData payloads carry
 *     a deadline timestamp; expired signatures revert.
 *   - Does NOT defend against: signer wallet compromise. If the agent's
 *     private key leaks, the attacker can anchor receipts as that
 *     agent with valid signatures. Receipt-content trust then falls
 *     back to attestationHash + storageRoot integrity (independent
 *     verification path via 0G Compute broker.processResponse).
 *   - Does NOT defend against: receipt-content fabrication BEFORE
 *     signing. The contract verifies signature integrity but cannot
 *     audit what was signed. The TIER 1 vs TIER 2 distinction at the
 *     off-chain layer (TEE-attested vs external-signed) is the
 *     content-trust gate; the contract is the chain-anchor gate.
 *   - Assumed attacker capabilities: holds zero valid agent private
 *     keys; may submit arbitrary anchor() calls as msg.sender. May try
 *     to replay captured signatures, anchor on the wrong domain, or
 *     submit expired payloads. None pass signature recovery + nonce
 *     check + deadline check + domain separator.
 */
contract ReceiptRegistryV2 is Ownable2Step, Pausable, EIP712 {
    /// @notice Receipt type codes (kept identical to V1 for off-chain
    ///         compatibility — the type space is the same; only the anchor
    ///         path is hardened).
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
    ///         Every anchor consumes the current nonce + advances it by 1.
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
        EIP712("Ivaronix.ReceiptRegistry", "2")
    {}

    /**
     * @notice Calldata struct for `anchor` — packed to keep the stack depth
     *         within Solidity's 16-slot limit when the EIP-712 digest is
     *         computed from many fields. Off-chain callers build this in JS
     *         + ethers' `signTypedData` over the matching struct shape.
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
     * @dev Anyone can submit (relayer pattern). The anchored
     *      `agentAddress` is the recovered signer, not msg.sender.
     */
    function anchor(AnchorParams calldata p, bytes calldata signature)
        external
        whenNotPaused
        returns (uint256 id)
    {
        require(p.receiptRoot != bytes32(0), "ReceiptRegistryV2: empty receiptRoot");
        require(p.storageRoot != bytes32(0), "ReceiptRegistryV2: empty storageRoot");
        require(p.receiptType <= TYPE_SUBSCRIPTION_SKILL_EXEC, "ReceiptRegistryV2: invalid type");
        require(p.agentAddress != address(0), "ReceiptRegistryV2: zero agent");
        require(block.timestamp <= p.deadline, "ReceiptRegistryV2: expired");

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
        require(recovered == p.agentAddress, "ReceiptRegistryV2: signature does not match agent");

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
