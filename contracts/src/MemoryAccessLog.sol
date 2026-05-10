// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title MemoryAccessLog
 * @notice Append-only on-chain audit trail for memory access events (SealedMind pattern).
 * @dev Stores no state — pure event emitter. The on-chain log itself is the audit trail.
 *      Indexers read the events to render per-wallet history.
 *
 *      Authorized loggers: each owner (memory holder) controls their own log entries by
 *      calling logAccess(). The memory engine calls this on every read/write/delete
 *      after consumeRead() succeeds on CapabilityRegistry.
 *
 *      Anyone can call logAccess() — the event records who logged what; indexers filter by
 *      `agent` (the indexed param) for per-wallet history. There's no ACL because the events
 *      are public anyway, and the cost of a frivolous log is the gas the caller paid.
 */
contract MemoryAccessLog {
    /// @notice Access type codes
    uint8 public constant ACCESS_READ = 0;
    uint8 public constant ACCESS_WRITE = 1;
    uint8 public constant ACCESS_DELETE = 2;
    uint8 public constant ACCESS_GRANT_USED = 3; // explicit grant consumption (extra signal)

    /// @notice Emitted on every memory access. Indexed: agent + grantId + memoryRoot.
    event MemoryAccessed(
        address indexed agent,
        bytes32 indexed grantId,
        bytes32 indexed memoryRoot,
        uint8 accessType,
        uint64 timestamp,
        bytes32 scopeHash
    );

    /**
     * @notice Log a memory access event.
     * @param agent The agent / app / wallet performing the access
     * @param grantId The CapabilityRegistry grant id that authorized this access (or 0x0 for owner self-access)
     * @param memoryRoot The memory state root hash that was accessed
     * @param accessType One of ACCESS_READ / WRITE / DELETE / GRANT_USED
     * @param scopeHash The scope being accessed (matches CapabilityRegistry scopeHash)
     */
    function logAccess(
        address agent,
        bytes32 grantId,
        bytes32 memoryRoot,
        uint8 accessType,
        bytes32 scopeHash
    ) external {
        require(accessType <= ACCESS_GRANT_USED, "MemoryAccessLog: invalid accessType");
        emit MemoryAccessed(agent, grantId, memoryRoot, accessType, uint64(block.timestamp), scopeHash);
    }
}
