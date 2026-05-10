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
 *         Threat model:
 *         - Defends against: gate-as-log substitution. Without this guard
 *           a calling contract typically only LOGS that a receipt ought to
 *           have existed (event emission); the guard upgrades the same
 *           pattern to a HARD gate that reverts before any state effect
 *           if the receipt is missing or mismatched.
 *         - Defends against: receipt-id range forgery. Reverts when
 *           receiptId >= registry.nextId() before any agent/type check.
 *         - Defends against: agent substitution. The recorded agentAddress
 *           in the registry MUST equal expectedAgent (passed by the
 *           caller); a receipt anchored by a different wallet won't pass.
 *         - Defends against: type substitution. The receipt's type code
 *           MUST match expectedReceiptType; a doc_ask receipt cannot
 *           satisfy a gate that requires audit (1) or skill_exec (5).
 *         - Defends against: empty-receiptRoot acceptance. Reverts when
 *           receiptRoot == bytes32(0) so a deleted/zeroed slot can't
 *           pass a gate that previously accepted it.
 *         - Does NOT defend against: V1-registry agentAddress forgery.
 *           ReceiptRegistry V1 records agentAddress = msg.sender on
 *           anchor; a guard pointed at the V1 registry inherits that
 *           weakness — any caller could anchor a receipt claiming any
 *           agent. Pass the V2 registry address (which records the
 *           EIP-712-recovered signer) for the hardened anchor path.
 *         - Does NOT defend against: receipt-content fabrication. The
 *           guard checks chain-anchor identity; receipt-body trust
 *           still rests on the off-chain TIER 1 (TEE-attested) vs
 *           TIER 2 (external-signed) distinction.
 *         - Does NOT defend against: skill-id substitution. The chain
 *           stores a numeric type code, not the canonical skill id
 *           (private-doc-review, 0g-integration-auditor, etc.). A
 *           consuming contract that wants per-skill granularity must
 *           follow the guard with a body-level check (read by an
 *           oracle, etc.).
 *         - Assumed attacker capabilities: holds zero valid agent
 *           private keys; may try to pass arbitrary (receiptId,
 *           expectedAgent, expectedReceiptType) tuples. None pass
 *           when the registry is V2 (signature-recovered agent).
 *           Only the V1-pointing case has known weakness.
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
