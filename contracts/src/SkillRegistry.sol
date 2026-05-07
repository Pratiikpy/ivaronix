// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title SkillRegistry
 * @notice On-chain anchoring of Ivaronix skill manifests (Day 10).
 * @dev Each skill is identified by `skillId = keccak256("skill:<lowercase-name>")` and may
 *      have many immutable versions. The first wallet to publish a `skillId` becomes its
 *      creator — subsequent versions must be published from the same wallet (or the
 *      transferred owner). Versions are revocable; revoking does not delete the record,
 *      so verifiers can still see "this version existed and was revoked at block X".
 *
 *      Receipts produced by `runSkill()` reference `skillManifestHash`. Any verifier can
 *      look up `(skillId, versionId)` here, confirm the `manifestHash` matches what the
 *      receipt claims, and that the version is not revoked — proving the receipt was
 *      produced by a canonical, attested skill version.
 */
contract SkillRegistry {
    struct SkillVersion {
        address creator;       // who published this version
        bytes32 manifestHash;  // canonical-JSON sha256 of the validated frontmatter
        uint64 publishedAt;
        bool revoked;
    }

    /// @notice skillId => versionId => SkillVersion
    mapping(bytes32 => mapping(bytes32 => SkillVersion)) private _versions;

    /// @notice skillId => append-only list of versionIds (history, also exposes ordering)
    mapping(bytes32 => bytes32[]) private _versionList;

    /// @notice skillId => current owning wallet (locked on first publish, transferable)
    mapping(bytes32 => address) public ownerOf;

    event SkillPublished(
        bytes32 indexed skillId,
        bytes32 indexed versionId,
        address indexed creator,
        bytes32 manifestHash,
        uint64 publishedAt
    );
    event SkillRevoked(bytes32 indexed skillId, bytes32 indexed versionId, address indexed by);
    event SkillOwnershipTransferred(
        bytes32 indexed skillId,
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @notice Publish a new immutable skill version.
     * @dev Reverts if (skillId, versionId) was already published OR if msg.sender is not
     *      the existing owner of skillId. The first publish locks ownership to msg.sender.
     */
    function publishVersion(
        bytes32 skillId,
        bytes32 versionId,
        bytes32 manifestHash
    ) external {
        require(skillId != bytes32(0), "SkillRegistry: zero skillId");
        require(versionId != bytes32(0), "SkillRegistry: zero versionId");
        require(manifestHash != bytes32(0), "SkillRegistry: zero manifestHash");

        SkillVersion storage existing = _versions[skillId][versionId];
        require(existing.creator == address(0), "SkillRegistry: version already published");

        address skillOwner = ownerOf[skillId];
        if (skillOwner == address(0)) {
            // First publish — lock ownership to msg.sender
            ownerOf[skillId] = msg.sender;
        } else {
            require(skillOwner == msg.sender, "SkillRegistry: not skill owner");
        }

        uint64 ts = uint64(block.timestamp);
        _versions[skillId][versionId] = SkillVersion({
            creator: msg.sender,
            manifestHash: manifestHash,
            publishedAt: ts,
            revoked: false
        });
        _versionList[skillId].push(versionId);

        emit SkillPublished(skillId, versionId, msg.sender, manifestHash, ts);
    }

    /**
     * @notice Permanently mark a version revoked (e.g., security regression).
     *         Only the current skill owner may revoke; revocation does not erase the record.
     */
    function revokeVersion(bytes32 skillId, bytes32 versionId) external {
        require(ownerOf[skillId] == msg.sender, "SkillRegistry: not skill owner");
        SkillVersion storage v = _versions[skillId][versionId];
        require(v.creator != address(0), "SkillRegistry: version not published");
        require(!v.revoked, "SkillRegistry: already revoked");
        v.revoked = true;
        emit SkillRevoked(skillId, versionId, msg.sender);
    }

    /**
     * @notice Transfer skill ownership (for hand-offs / DAO migrations).
     */
    function transferSkillOwnership(bytes32 skillId, address newOwner) external {
        require(ownerOf[skillId] == msg.sender, "SkillRegistry: not skill owner");
        require(newOwner != address(0), "SkillRegistry: zero newOwner");
        address prev = ownerOf[skillId];
        ownerOf[skillId] = newOwner;
        emit SkillOwnershipTransferred(skillId, prev, newOwner);
    }

    // ─── views ───────────────────────────────────────────────────────────────

    function getVersion(bytes32 skillId, bytes32 versionId)
        external
        view
        returns (SkillVersion memory)
    {
        return _versions[skillId][versionId];
    }

    /// @notice Returns the most recently published version (whether or not revoked).
    function latestVersion(bytes32 skillId)
        external
        view
        returns (bytes32 versionId, SkillVersion memory v)
    {
        bytes32[] storage list = _versionList[skillId];
        require(list.length > 0, "SkillRegistry: no versions");
        versionId = list[list.length - 1];
        v = _versions[skillId][versionId];
    }

    function versionCount(bytes32 skillId) external view returns (uint256) {
        return _versionList[skillId].length;
    }

    function versionAt(bytes32 skillId, uint256 idx) external view returns (bytes32) {
        return _versionList[skillId][idx];
    }

    /**
     * @notice Convenience verifier — does this manifestHash match the recorded one and is
     *         the version not revoked? Any verifier (CLI, off-chain ledger) can call this.
     */
    function verify(
        bytes32 skillId,
        bytes32 versionId,
        bytes32 manifestHash
    ) external view returns (bool) {
        SkillVersion storage v = _versions[skillId][versionId];
        if (v.creator == address(0)) return false;
        if (v.revoked) return false;
        return v.manifestHash == manifestHash;
    }
}
