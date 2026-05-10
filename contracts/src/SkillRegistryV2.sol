// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title SkillRegistryV2
 * @notice On-chain anchoring of Ivaronix skill manifests. V2 closes the
 *         name-squatter risk (planning-003 §A.5.11 · WT 20).
 *
 * @dev V1 is first-come-first-served: any wallet can publish
 *      `keccak256("skill:private-doc-review")` first and lock the wallet
 *      forever. The legitimate Ivaronix creator has no recourse short of
 *      using a different name. V2 ships two countermeasures:
 *
 *      1. **Reserved list.** A contract-owner-managed allow-list of
 *         canonical skill IDs (`reservedFor`) pinned to the legitimate
 *         creator wallet. Anyone trying to publish a reserved skillId
 *         from a different wallet reverts with "reserved for owner."
 *
 *      2. **Owner-arbitration.** The contract owner can call
 *         `arbitrateOwnership(skillId, newOwner)` to reassign a squatted
 *         skillId to its legitimate creator (after off-chain evidence).
 *         Emits `SkillArbitrated` for transparency. Distinct from
 *         `transferSkillOwnership` which the current owner controls;
 *         arbitration is the contract-owner safety valve.
 *
 *      Same publishVersion + revokeVersion + transferSkillOwnership
 *      surface as V1; existing CLI + Studio code paths work unchanged
 *      against the V2 address.
 *
 *      Threat model:
 *      - Defends against: skillId squatting on canonical names.
 *        Reserved list reverts unauthorized first-publishes.
 *      - Defends against: hostile re-publication of a known-good skill
 *        name. Reserved-for-owner-only check rejects the squatter.
 *      - Does NOT defend against: a squatter on an UNRESERVED skill name.
 *        Operators must reserve names BEFORE announcing them publicly,
 *        OR rely on arbitration after the fact.
 *      - Does NOT defend against: malicious arbitration. Contract owner
 *        is the trust root; if their key leaks, an attacker can reassign
 *        any skillId. Mitigation: rotate owner via Ownable2Step (two-
 *        step transfer prevents accidental reassignment).
 *
 *      Migration: V1 stays live for legacy publishes. V2 is the canonical
 *      registry going forward; reserved names ship in the constructor.
 */
contract SkillRegistryV2 is Ownable2Step {
    struct SkillVersion {
        address creator;       // who published this version
        bytes32 manifestHash;  // canonical-JSON sha256 of the validated frontmatter
        uint64 publishedAt;
        bool revoked;
    }

    /// @notice skillId => versionId => SkillVersion
    mapping(bytes32 => mapping(bytes32 => SkillVersion)) private _versions;

    /// @notice skillId => append-only list of versionIds
    mapping(bytes32 => bytes32[]) private _versionList;

    /// @notice skillId => current owning wallet (locked on first publish, transferable)
    mapping(bytes32 => address) public ownerOf;

    /// @notice skillId => reserved owner (set at construction or via reserveSkillName).
    /// Reserved skillIds may only be FIRST published by their reserved owner.
    /// Once published, ownerOf takes over (reserved-for becomes irrelevant).
    mapping(bytes32 => address) public reservedFor;

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
    event SkillNameReserved(bytes32 indexed skillId, address indexed reservedOwner);
    event SkillNameUnreserved(bytes32 indexed skillId);
    event SkillArbitrated(
        bytes32 indexed skillId,
        address indexed previousOwner,
        address indexed newOwner,
        address arbiter
    );

    /**
     * @param initialOwner Contract-owner wallet (manages reserved list + arbitration).
     * @param reservedSkillIds Skill IDs to reserve at deploy time.
     * @param reservedOwners Wallet to reserve each skillId for. Must match length of reservedSkillIds.
     */
    constructor(
        address initialOwner,
        bytes32[] memory reservedSkillIds,
        address[] memory reservedOwners
    ) Ownable(initialOwner) {
        require(reservedSkillIds.length == reservedOwners.length, "SkillRegistryV2: array length mismatch");
        for (uint256 i = 0; i < reservedSkillIds.length; i++) {
            bytes32 skillId = reservedSkillIds[i];
            address resOwner = reservedOwners[i];
            require(skillId != bytes32(0), "SkillRegistryV2: zero skillId in reserved list");
            require(resOwner != address(0), "SkillRegistryV2: zero owner in reserved list");
            reservedFor[skillId] = resOwner;
            emit SkillNameReserved(skillId, resOwner);
        }
    }

    // ─── Reserved-name management (owner-only) ────────────────────────────────

    /// @notice Add a skillId to the reserved list post-deploy. Owner-only.
    function reserveSkillName(bytes32 skillId, address resOwner) external onlyOwner {
        require(skillId != bytes32(0), "SkillRegistryV2: zero skillId");
        require(resOwner != address(0), "SkillRegistryV2: zero owner");
        require(ownerOf[skillId] == address(0), "SkillRegistryV2: already published");
        reservedFor[skillId] = resOwner;
        emit SkillNameReserved(skillId, resOwner);
    }

    /// @notice Remove a skillId from the reserved list. Owner-only.
    /// Has no effect on already-published skillIds.
    function unreserveSkillName(bytes32 skillId) external onlyOwner {
        require(reservedFor[skillId] != address(0), "SkillRegistryV2: not reserved");
        reservedFor[skillId] = address(0);
        emit SkillNameUnreserved(skillId);
    }

    // ─── Arbitration (owner-only safety valve) ─────────────────────────────────

    /**
     * @notice Reassign skill ownership. Distinct from transferSkillOwnership
     *         (which the current owner controls); this is the contract-owner
     *         safety valve for documented squatter cases.
     */
    function arbitrateOwnership(bytes32 skillId, address newOwner) external onlyOwner {
        require(newOwner != address(0), "SkillRegistryV2: zero newOwner");
        address prev = ownerOf[skillId];
        require(prev != address(0), "SkillRegistryV2: no owner to arbitrate");
        require(prev != newOwner, "SkillRegistryV2: same owner");
        ownerOf[skillId] = newOwner;
        emit SkillArbitrated(skillId, prev, newOwner, msg.sender);
    }

    // ─── Skill lifecycle (same surface as V1, plus reserved-name check) ───────

    function publishVersion(
        bytes32 skillId,
        bytes32 versionId,
        bytes32 manifestHash
    ) external {
        require(skillId != bytes32(0), "SkillRegistryV2: zero skillId");
        require(versionId != bytes32(0), "SkillRegistryV2: zero versionId");
        require(manifestHash != bytes32(0), "SkillRegistryV2: zero manifestHash");

        SkillVersion storage existing = _versions[skillId][versionId];
        require(existing.creator == address(0), "SkillRegistryV2: version already published");

        address skillOwner = ownerOf[skillId];
        if (skillOwner == address(0)) {
            // First publish — check reserved list FIRST, then lock ownership.
            address resOwner = reservedFor[skillId];
            if (resOwner != address(0)) {
                require(resOwner == msg.sender, "SkillRegistryV2: reserved for another owner");
                // Reserved-and-claimed: clear the reservation, ownerOf takes over.
                reservedFor[skillId] = address(0);
            }
            ownerOf[skillId] = msg.sender;
        } else {
            require(skillOwner == msg.sender, "SkillRegistryV2: not skill owner");
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

    function revokeVersion(bytes32 skillId, bytes32 versionId) external {
        require(ownerOf[skillId] == msg.sender, "SkillRegistryV2: not skill owner");
        SkillVersion storage v = _versions[skillId][versionId];
        require(v.creator != address(0), "SkillRegistryV2: version not published");
        require(!v.revoked, "SkillRegistryV2: already revoked");
        v.revoked = true;
        emit SkillRevoked(skillId, versionId, msg.sender);
    }

    function transferSkillOwnership(bytes32 skillId, address newOwner) external {
        require(ownerOf[skillId] == msg.sender, "SkillRegistryV2: not skill owner");
        require(newOwner != address(0), "SkillRegistryV2: zero newOwner");
        address prev = ownerOf[skillId];
        ownerOf[skillId] = newOwner;
        emit SkillOwnershipTransferred(skillId, prev, newOwner);
    }

    // ─── Views (same shape as V1) ─────────────────────────────────────────────

    function getVersion(bytes32 skillId, bytes32 versionId)
        external
        view
        returns (SkillVersion memory)
    {
        return _versions[skillId][versionId];
    }

    function latestVersion(bytes32 skillId)
        external
        view
        returns (bytes32 versionId, SkillVersion memory v)
    {
        bytes32[] storage list = _versionList[skillId];
        require(list.length > 0, "SkillRegistryV2: no versions");
        versionId = list[list.length - 1];
        v = _versions[skillId][versionId];
    }

    function versionCount(bytes32 skillId) external view returns (uint256) {
        return _versionList[skillId].length;
    }

    function versionAt(bytes32 skillId, uint256 idx) external view returns (bytes32) {
        return _versionList[skillId][idx];
    }

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
