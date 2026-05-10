// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title IGrantViewV2
 * @notice Minimal view interface against CapabilityRegistry / V2. Only the
 *         shape MemoryAccessLogV2 needs for the cross-check.
 */
interface IGrantViewV2 {
    function isValid(bytes32 grantId, address grantee, bytes32 scopeHash) external view returns (bool);
}

/**
 * @title MemoryAccessLogV2
 * @notice Append-only audit trail for memory access events. V2 closes the
 *         log-spoofing vector (planning-003 §A.5.12 · WT 32) where V1 let
 *         any wallet emit a `MemoryAccessed(agent=X, grantId=Y, ...)` event
 *         for ~$0.001 of gas, polluting X's audit trail.
 *
 * @dev Two enforcement paths on logAccess():
 *      1. Self-log: msg.sender == agent · always allowed (the wallet owns
 *         its own audit row).
 *      2. Grant-backed log: msg.sender holds a valid CapabilityRegistry
 *         grant where grantee == msg.sender + scope == scopeHash + grantId
 *         matches. Verified via IGrantViewV2.isValid against the
 *         CapabilityRegistry address pinned at construction.
 *
 *      Both paths emit `MemoryAccessed` with the SAME shape as V1, so
 *      existing indexers don't break. The new behaviour is the revert
 *      on unauthorized callers.
 *
 *      Threat model:
 *      - Defends against: log spoofing. A random wallet calling
 *        logAccess(agent=victim, grantId=anything, ...) reverts with
 *        "MemoryAccessLogV2: not agent or grantee".
 *      - Defends against: grantee-impersonation. The grant cross-check
 *        verifies grantee == msg.sender, so a wallet that knows a grantId
 *        but isn't the grantee cannot log against it.
 *      - Does NOT defend against: a memory engine bypassing the log
 *        entirely (off-chain enforcement gap, same as V1).
 *      - Does NOT defend against: the CapabilityRegistry's own social-graph
 *        leak (V1's public mappings) — that's planning-003 §A.5.10's job
 *        (CapabilityRegistryV2 ships private reverse indexes).
 *
 *      Migration: V1 stays live for legacy events (chain history immutable).
 *      New writes target V2 once Studio + memory engine point at it.
 */
contract MemoryAccessLogV2 {
    /// @notice Access type codes (same as V1).
    uint8 public constant ACCESS_READ = 0;
    uint8 public constant ACCESS_WRITE = 1;
    uint8 public constant ACCESS_DELETE = 2;
    uint8 public constant ACCESS_GRANT_USED = 3;

    /// @notice CapabilityRegistry contract used for the grant cross-check.
    /// Pinned at construction; cannot change. New CapabilityRegistry → new
    /// MemoryAccessLogV2 (same V1→V2 pattern as ReceiptRegistry).
    address public immutable capabilityRegistry;

    /// @notice Emitted on every memory access. Same shape as V1.
    event MemoryAccessed(
        address indexed agent,
        bytes32 indexed grantId,
        bytes32 indexed memoryRoot,
        uint8 accessType,
        uint64 timestamp,
        bytes32 scopeHash
    );

    constructor(address capabilityRegistry_) {
        require(capabilityRegistry_ != address(0), "MemoryAccessLogV2: zero registry");
        capabilityRegistry = capabilityRegistry_;
    }

    /**
     * @notice Log a memory access event. Authorization rules:
     *   - msg.sender == agent · self-log, always allowed
     *   - OR msg.sender holds a valid grant on `capabilityRegistry` where
     *     grantee == msg.sender + scopeHash matches + grantId matches
     *
     * @param agent The agent / app / wallet performing the access
     * @param grantId Required for non-self logs · the CapabilityRegistry grant
     *        id that authorized this access. Pass 0x0 only when self-logging.
     * @param memoryRoot The memory state root hash that was accessed
     * @param accessType One of ACCESS_READ / WRITE / DELETE / GRANT_USED
     * @param scopeHash The scope being accessed (must match the grant's scope)
     */
    function logAccess(
        address agent,
        bytes32 grantId,
        bytes32 memoryRoot,
        uint8 accessType,
        bytes32 scopeHash
    ) external {
        require(accessType <= ACCESS_GRANT_USED, "MemoryAccessLogV2: invalid accessType");

        if (msg.sender != agent) {
            // Non-self log requires a valid grant where the caller is the grantee.
            require(grantId != bytes32(0), "MemoryAccessLogV2: not agent (grantId required)");
            bool valid = IGrantViewV2(capabilityRegistry).isValid(grantId, msg.sender, scopeHash);
            require(valid, "MemoryAccessLogV2: invalid grant for caller+scope");
        }

        emit MemoryAccessed(agent, grantId, memoryRoot, accessType, uint64(block.timestamp), scopeHash);
    }
}
