// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title CapabilityRegistryV2
 * @notice On-chain memory-permission registry per SealedMind pattern. Same
 *         grant/consume/revoke surface as V1 but with PRIVATE reverse indexes.
 *
 * @dev V2 closes the social-graph leak (planning-003 §A.5.10 · WT 12). V1's
 *      `mapping(address => bytes32[]) public grantsByOwner` and
 *      `grantsByGrantee` auto-generated public getters; anyone could
 *      enumerate every grant ever issued to or from a wallet, exposing the
 *      memory access graph as a public side channel.
 *
 *      V2 stores both reverse indexes as `internal`. Reads are gated by
 *      `getGrantsByOwner(address)` and `getGrantsByGrantee(address)` which
 *      require the caller to be either the owner/grantee themselves OR an
 *      `authorizedReader` (operator-side indexer). Random visitors get
 *      revert. Off-chain indexers that need full visibility opt in via
 *      `addAuthorizedReader`; their queries are then auditable through the
 *      `IndexerAccessGranted` event.
 *
 *      Threat model:
 *      - Defends against: an attacker building a memory-access social graph
 *        from public chain reads. Reverse indexes return only to the wallet
 *        themselves or operator-vetted indexers.
 *      - Defends against: stale grants. expiresAt + revoke() unchanged from V1.
 *      - Does NOT defend against: grant existence enumeration via the
 *        `GrantIssued` event log. Events are still public; that's how
 *        off-chain indexers reconstruct state. The V2 fix prevents *random
 *        wallet → real-time queryable list*; event-replay still works for
 *        legitimate indexers, but it's slower and observable.
 *      - Does NOT defend against: the off-chain memory engine ignoring
 *        consumeRead() and serving the data anyway. Enforcement requires
 *        the memory engine to gate every read on this contract.
 *
 *      Migration: V1 stays live for legacy grants. V2 is a fresh registry;
 *      new grants issue here. Studio + CLI grant-management surfaces query
 *      both via the V2-first read pattern (planning-003 §A.1.3).
 */
contract CapabilityRegistryV2 is Ownable2Step {
    struct Grant {
        address owner;          // memory owner (the wallet that issued the grant)
        address grantee;        // who can access (agent / app / wallet)
        bytes32 scopeHash;      // hash of allowed scope: namespace, skill ID, doc collection, etc.
        uint64 issuedAt;        // when granted
        uint64 expiresAt;       // when grant auto-expires (0 = never)
        uint32 readsRemaining;  // soft read cap (0xFFFFFFFF = unlimited)
        bool revoked;           // owner-set revocation flag
    }

    /// @notice grantId => Grant. grantId is keccak(owner, grantee, scopeHash, issuedAt-block).
    /// Public read kept so a holder of a known grantId can verify it directly.
    mapping(bytes32 => Grant) public grants;

    /// @notice PRIVATE reverse indexes per V2 social-graph fix.
    mapping(address => bytes32[]) internal _grantsByOwner;
    mapping(address => bytes32[]) internal _grantsByGrantee;

    /// @notice Operator-vetted indexers that may read the reverse indexes for any wallet.
    mapping(address => bool) public authorizedReaders;

    /// @notice Operator-vetted relayers authorised to decrement a grant's
    ///         readsRemaining on behalf of a grantee. Without this gate, an
    ///         attacker scraping grantIds from the public GrantIssued event log
    ///         could call consumeRead from any wallet and deplete the grantee's
    ///         read budget — a clean Denial-of-Service surface. With this map,
    ///         only the grantee themselves OR an owner-allowlisted relayer can
    ///         consume reads. The relayer pattern preserves the off-chain memory
    ///         engine (operator signs on behalf of users) while removing the
    ///         open-call DoS path.
    mapping(address => bool) public authorizedRelayers;

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
    event IndexerAccessGranted(address indexed indexer, address indexed grantedBy);
    event IndexerAccessRevoked(address indexed indexer, address indexed revokedBy);
    event RelayerAdded(address indexed relayer, address indexed addedBy);
    event RelayerRemoved(address indexed relayer, address indexed removedBy);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Authorized-reader management ─────────────────────────────────────────

    /// @notice Owner-only. Add an indexer that may read other wallets' reverse indexes.
    function addAuthorizedReader(address indexer) external onlyOwner {
        require(indexer != address(0), "CapabilityRegistryV2: zero indexer");
        require(!authorizedReaders[indexer], "CapabilityRegistryV2: already authorized");
        authorizedReaders[indexer] = true;
        emit IndexerAccessGranted(indexer, msg.sender);
    }

    /// @notice Owner-only. Remove an indexer.
    function removeAuthorizedReader(address indexer) external onlyOwner {
        require(authorizedReaders[indexer], "CapabilityRegistryV2: not authorized");
        authorizedReaders[indexer] = false;
        emit IndexerAccessRevoked(indexer, msg.sender);
    }

    // ─── Authorized-relayer management (consumeRead DoS gate) ───────────────

    /// @notice Owner-only. Add a relayer wallet that may call consumeRead on behalf
    ///         of grantees. The operator's signing wallet is typically the first
    ///         relayer added post-deploy so the off-chain memory engine continues
    ///         to function.
    function addAuthorizedRelayer(address relayer) external onlyOwner {
        require(relayer != address(0), "CapabilityRegistryV2: zero relayer");
        require(!authorizedRelayers[relayer], "CapabilityRegistryV2: already relayer");
        authorizedRelayers[relayer] = true;
        emit RelayerAdded(relayer, msg.sender);
    }

    /// @notice Owner-only. Remove a relayer.
    function removeAuthorizedRelayer(address relayer) external onlyOwner {
        require(authorizedRelayers[relayer], "CapabilityRegistryV2: not relayer");
        authorizedRelayers[relayer] = false;
        emit RelayerRemoved(relayer, msg.sender);
    }

    // ─── Grant lifecycle (same surface as V1) ────────────────────────────────

    function issueGrant(
        address grantee,
        bytes32 scopeHash,
        uint64 ttlSeconds,
        uint32 readsCap
    ) external returns (bytes32 grantId) {
        require(grantee != address(0), "CapabilityRegistryV2: zero grantee");
        require(grantee != msg.sender, "CapabilityRegistryV2: self-grant disallowed");

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

        _grantsByOwner[msg.sender].push(grantId);
        _grantsByGrantee[grantee].push(grantId);

        emit GrantIssued(grantId, msg.sender, grantee, scopeHash, expiresAt, readsCap);
    }

    function revokeGrant(bytes32 grantId) external {
        Grant storage g = grants[grantId];
        require(g.owner == msg.sender, "CapabilityRegistryV2: not owner");
        require(!g.revoked, "CapabilityRegistryV2: already revoked");
        g.revoked = true;
        emit GrantRevoked(grantId, msg.sender);
    }

    /// @notice Decrements the grant's readsRemaining budget by one.
    ///
    ///         Caller authorisation: only the grantee themselves OR an
    ///         owner-allowlisted relayer can consume reads. Without this gate,
    ///         any wallet could deplete any grantee's budget by scraping
    ///         grantIds from the public GrantIssued event log — a clean DoS.
    ///         The grantee can always self-call; the relayer pattern lets the
    ///         off-chain memory engine (operator signs on behalf of users)
    ///         continue to function. Anyone else reverts cleanly.
    function consumeRead(bytes32 grantId) external returns (bool ok) {
        Grant storage g = grants[grantId];
        if (g.owner == address(0)) return false;
        // Caller-authorisation gate before any state read/write.
        require(
            msg.sender == g.grantee || authorizedRelayers[msg.sender],
            "CapabilityRegistryV2: not grantee or relayer"
        );
        if (g.revoked) return false;
        if (g.expiresAt != 0 && block.timestamp > g.expiresAt) return false;
        if (g.readsRemaining == 0) return false;

        if (g.readsRemaining != type(uint32).max) {
            g.readsRemaining -= 1;
            emit GrantConsumed(grantId, g.readsRemaining);
        }
        return true;
    }

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

    // ─── Privacy-gated reverse-index reads ────────────────────────────────────

    /**
     * @notice Reverse-index read for the OWNER side. Caller must be the owner
     *         themselves OR an authorized indexer. Random visitors revert.
     */
    function getGrantsByOwner(address owner) external view returns (bytes32[] memory) {
        require(
            msg.sender == owner || authorizedReaders[msg.sender],
            "CapabilityRegistryV2: not owner or authorized indexer"
        );
        return _grantsByOwner[owner];
    }

    /**
     * @notice Reverse-index read for the GRANTEE side. Caller must be the
     *         grantee themselves OR an authorized indexer.
     */
    function getGrantsByGrantee(address grantee) external view returns (bytes32[] memory) {
        require(
            msg.sender == grantee || authorizedReaders[msg.sender],
            "CapabilityRegistryV2: not grantee or authorized indexer"
        );
        return _grantsByGrantee[grantee];
    }

    /**
     * @notice Self-read. Always allowed (caller reading their own owner-side index).
     *         Convenience for wallet UIs that want to skip the explicit address arg.
     */
    function listMyOwnerGrants() external view returns (bytes32[] memory) {
        return _grantsByOwner[msg.sender];
    }

    /**
     * @notice Self-read. Always allowed (caller reading their own grantee-side index).
     */
    function listMyGranteeGrants() external view returns (bytes32[] memory) {
        return _grantsByGrantee[msg.sender];
    }
}
