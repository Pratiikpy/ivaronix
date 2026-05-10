// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title CapabilityRegistry
 * @notice On-chain memory-permission registry per SealedMind pattern (REFERENCE_PATTERNS §2.3).
 * @dev Memory owners issue scoped, time-bound, optionally read-capped grants to grantees
 *      (other agents, apps, or wallets). Grants live on chain so any party can audit who
 *      has access, when it expires, and how many reads remain. Revocation is on-chain too.
 *
 *      The hybrid memory engine queries this on every memory read to enforce
 *      the grant. Off-chain readers can also query directly to audit who has
 *      access to a given owner's memory.
 */
contract CapabilityRegistry {
    struct Grant {
        address owner;          // memory owner (the wallet that issued the grant)
        address grantee;        // who can access (agent / app / wallet)
        bytes32 scopeHash;      // hash of allowed scope: namespace, skill ID, doc collection, etc.
        uint64 issuedAt;        // when granted
        uint64 expiresAt;       // when grant auto-expires (0 = never)
        uint32 readsRemaining;  // soft read cap (0xFFFFFFFF = unlimited)
        bool revoked;           // owner-set revocation flag
    }

    /// @notice grantId => Grant. grantId is keccak(owner, grantee, scopeHash, issuedAt-block)
    mapping(bytes32 => Grant) public grants;

    /// @notice Reverse index for the UI: owner => grantId[]
    mapping(address => bytes32[]) public grantsByOwner;
    mapping(address => bytes32[]) public grantsByGrantee;

    event GrantIssued(
        bytes32 indexed grantId,
        address indexed owner,
        address indexed grantee,
        bytes32 scopeHash,
        uint64 expiresAt,
        uint32 readsCap
    );
    event GrantRevoked(bytes32 indexed grantId, address indexed owner);
    event GrantConsumed(bytes32 indexed grantId, uint32 readsRemaining);

    /**
     * @notice Issue a new capability grant.
     * @param grantee The address that may access this scope
     * @param scopeHash Hash of the allowed scope (e.g., keccak(namespace="work", skill="legal-review"))
     * @param ttlSeconds How long the grant lives; 0 = never expires
     * @param readsCap Soft cap on reads; 0xFFFFFFFF = unlimited
     * @return grantId The id for this grant; pass it to consumeRead / revoke
     */
    function issueGrant(
        address grantee,
        bytes32 scopeHash,
        uint64 ttlSeconds,
        uint32 readsCap
    ) external returns (bytes32 grantId) {
        require(grantee != address(0), "CapabilityRegistry: zero grantee");
        require(grantee != msg.sender, "CapabilityRegistry: self-grant disallowed");

        uint64 issuedAt = uint64(block.timestamp);
        uint64 expiresAt = ttlSeconds == 0 ? 0 : issuedAt + ttlSeconds;

        grantId = keccak256(abi.encode(msg.sender, grantee, scopeHash, issuedAt, block.number));

        grants[grantId] = Grant({
            owner: msg.sender,
            grantee: grantee,
            scopeHash: scopeHash,
            issuedAt: issuedAt,
            expiresAt: expiresAt,
            readsRemaining: readsCap,
            revoked: false
        });

        grantsByOwner[msg.sender].push(grantId);
        grantsByGrantee[grantee].push(grantId);

        emit GrantIssued(grantId, msg.sender, grantee, scopeHash, expiresAt, readsCap);
    }

    /**
     * @notice Owner-initiated revocation. Permanent.
     */
    function revokeGrant(bytes32 grantId) external {
        Grant storage g = grants[grantId];
        require(g.owner == msg.sender, "CapabilityRegistry: not owner");
        require(!g.revoked, "CapabilityRegistry: already revoked");
        g.revoked = true;
        emit GrantRevoked(grantId, msg.sender);
    }

    /**
     * @notice Decrement readsRemaining and return whether the grant is still valid.
     *         Called by the memory engine on every read.
     * @return ok true if the grant is still valid (not revoked, not expired, reads available)
     */
    function consumeRead(bytes32 grantId) external returns (bool ok) {
        Grant storage g = grants[grantId];
        if (g.owner == address(0)) return false; // grant doesn't exist
        if (g.revoked) return false;
        if (g.expiresAt != 0 && block.timestamp > g.expiresAt) return false;
        if (g.readsRemaining == 0) return false;

        if (g.readsRemaining != type(uint32).max) {
            g.readsRemaining -= 1;
            emit GrantConsumed(grantId, g.readsRemaining);
        }
        return true;
    }

    /**
     * @notice View-only check — does the grant currently allow access for the given grantee + scope?
     */
    function isValid(
        bytes32 grantId,
        address grantee,
        bytes32 scopeHash
    ) external view returns (bool) {
        Grant storage g = grants[grantId];
        if (g.owner == address(0)) return false;
        if (g.revoked) return false;
        if (g.grantee != grantee) return false;
        if (g.scopeHash != scopeHash) return false;
        if (g.expiresAt != 0 && block.timestamp > g.expiresAt) return false;
        if (g.readsRemaining == 0) return false;
        return true;
    }

    function listGrantsByOwner(address owner) external view returns (bytes32[] memory) {
        return grantsByOwner[owner];
    }

    function listGrantsByGrantee(address grantee) external view returns (bytes32[] memory) {
        return grantsByGrantee[grantee];
    }
}
