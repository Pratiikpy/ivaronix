// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ReceiptRegistry} from "./ReceiptRegistry.sol";

/**
 * @title IvaronixReceiptGuard
 * @notice Receipt-as-firewall library for any external contract that wants
 *         to gate a transaction on a verifiable Ivaronix receipt
 *         (planning-01 §3C).
 *
 *         Inspired by Don't Get Drained's Safe-Guard pattern: instead of
 *         logging events post-hoc, the guard makes the receipt a
 *         pre-condition. A Safe-style wallet, an x402-billing contract,
 *         a vendor approval flow — any contract that calls
 *         `IvaronixReceiptGuard.requireValidReceipt(...)` becomes a *gate*,
 *         not just a *log*.
 *
 *         Trust model:
 *         - The receipt MUST exist on the named ReceiptRegistry deployment.
 *         - The receipt's agent address MUST equal `expectedAgent`.
 *         - The receipt's type code MUST equal `expectedReceiptType`.
 *         - Reverts with a string reason on any mismatch — caller can
 *           branch on the revert message.
 *
 *         Skill-id matching is intentionally OUT of the on-chain guard:
 *         the chain stores a numeric type code, not the canonical skill
 *         id (`private-doc-review`, `0g-integration-auditor`, etc.). Skill
 *         identity belongs to the off-chain receipt body. A consuming
 *         contract that wants per-skill granularity should follow the
 *         guard with a body-level check (read by an oracle, etc.).
 *
 *         Library, not a contract: zero deployment cost, zero state. The
 *         caller's contract embeds the guard at compile time.
 */
library IvaronixReceiptGuard {
    /// @notice Reverts if the receipt is not anchored or does not match.
    /// @param registry The deployed `ReceiptRegistry` contract.
    /// @param receiptId The on-chain receipt id assigned by `anchor()`.
    /// @param expectedAgent The wallet that signed the receipt.
    /// @param expectedReceiptType The receipt type code (0..N) per RECEIPTS_SPEC.md §1.
    function requireValidReceipt(
        ReceiptRegistry registry,
        uint256 receiptId,
        address expectedAgent,
        uint8 expectedReceiptType
    ) internal view {
        require(receiptId < registry.nextId(), "IvaronixReceiptGuard: receipt not anchored");

        (
            bytes32 receiptRoot,
            ,                         /* storageRoot */
            ,                         /* attestationHash */
            address agentAddress,
            ,                         /* timestamp */
            uint8 receiptType
        ) = registry.receipts(receiptId);

        require(receiptRoot != bytes32(0), "IvaronixReceiptGuard: empty receiptRoot");
        require(agentAddress == expectedAgent, "IvaronixReceiptGuard: agent mismatch");
        require(receiptType == expectedReceiptType, "IvaronixReceiptGuard: type mismatch");
    }

    /// @notice Returns true / false instead of reverting. Use when the
    ///         caller wants to branch (e.g. emit a soft-warning event)
    ///         rather than abort.
    function isValidReceipt(
        ReceiptRegistry registry,
        uint256 receiptId,
        address expectedAgent,
        uint8 expectedReceiptType
    ) internal view returns (bool) {
        if (receiptId >= registry.nextId()) return false;
        (
            bytes32 receiptRoot,
            ,
            ,
            address agentAddress,
            ,
            uint8 receiptType
        ) = registry.receipts(receiptId);
        if (receiptRoot == bytes32(0)) return false;
        if (agentAddress != expectedAgent) return false;
        if (receiptType != expectedReceiptType) return false;
        return true;
    }
}
