// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {SkillRegistry} from "../src/SkillRegistry.sol";

contract SkillRegistryTest is Test {
    SkillRegistry public reg;

    address public alice = address(0xA1); // creator
    address public bob = address(0xB0B);   // not creator
    address public dao = address(0xD40);   // future owner

    bytes32 public constant SKILL_REVIEW = keccak256("skill:private-doc-review");
    bytes32 public constant SKILL_AUDIT = keccak256("skill:github-audit");
    bytes32 public constant V1 = keccak256("v0.1.0");
    bytes32 public constant V2 = keccak256("v0.2.0");

    bytes32 public constant HASH_A = keccak256("manifest-a");
    bytes32 public constant HASH_B = keccak256("manifest-b");

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

    function setUp() public {
        reg = new SkillRegistry();
    }

    // ─── publish ─────────────────────────────────────────────────────────────

    function test_PublishLocksOwnership() public {
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        assertEq(reg.ownerOf(SKILL_REVIEW), alice);

        SkillRegistry.SkillVersion memory v = reg.getVersion(SKILL_REVIEW, V1);
        assertEq(v.creator, alice);
        assertEq(v.manifestHash, HASH_A);
        assertGt(v.publishedAt, 0);
        assertFalse(v.revoked);
    }

    function test_PublishEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit SkillPublished(SKILL_REVIEW, V1, alice, HASH_A, uint64(block.timestamp));
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
    }

    function test_PublishMultipleVersionsSameOwner() public {
        vm.startPrank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        reg.publishVersion(SKILL_REVIEW, V2, HASH_B);
        vm.stopPrank();

        assertEq(reg.versionCount(SKILL_REVIEW), 2);
        (bytes32 latestId, SkillRegistry.SkillVersion memory latest) = reg.latestVersion(SKILL_REVIEW);
        assertEq(latestId, V2);
        assertEq(latest.manifestHash, HASH_B);
    }

    function test_PublishMultipleSkillsSameWallet() public {
        vm.startPrank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        reg.publishVersion(SKILL_AUDIT, V1, HASH_B);
        vm.stopPrank();

        assertEq(reg.ownerOf(SKILL_REVIEW), alice);
        assertEq(reg.ownerOf(SKILL_AUDIT), alice);
    }

    function test_PublishRejectsDuplicateVersion() public {
        vm.startPrank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        vm.expectRevert("SkillRegistry: version already published");
        reg.publishVersion(SKILL_REVIEW, V1, HASH_B);
        vm.stopPrank();
    }

    function test_PublishRejectsNonOwner() public {
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);

        vm.prank(bob);
        vm.expectRevert("SkillRegistry: not skill owner");
        reg.publishVersion(SKILL_REVIEW, V2, HASH_B);
    }

    function test_PublishRejectsZeros() public {
        vm.startPrank(alice);
        vm.expectRevert("SkillRegistry: zero skillId");
        reg.publishVersion(bytes32(0), V1, HASH_A);
        vm.expectRevert("SkillRegistry: zero versionId");
        reg.publishVersion(SKILL_REVIEW, bytes32(0), HASH_A);
        vm.expectRevert("SkillRegistry: zero manifestHash");
        reg.publishVersion(SKILL_REVIEW, V1, bytes32(0));
        vm.stopPrank();
    }

    // ─── revoke ──────────────────────────────────────────────────────────────

    function test_RevokeMarksVersionRevoked() public {
        vm.startPrank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        reg.revokeVersion(SKILL_REVIEW, V1);
        vm.stopPrank();

        SkillRegistry.SkillVersion memory v = reg.getVersion(SKILL_REVIEW, V1);
        assertTrue(v.revoked);
    }

    function test_RevokeRejectsNonOwner() public {
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);

        vm.prank(bob);
        vm.expectRevert("SkillRegistry: not skill owner");
        reg.revokeVersion(SKILL_REVIEW, V1);
    }

    function test_RevokeRejectsTwice() public {
        vm.startPrank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        reg.revokeVersion(SKILL_REVIEW, V1);
        vm.expectRevert("SkillRegistry: already revoked");
        reg.revokeVersion(SKILL_REVIEW, V1);
        vm.stopPrank();
    }

    // ─── verify ──────────────────────────────────────────────────────────────

    function test_VerifyMatchesPublished() public {
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        assertTrue(reg.verify(SKILL_REVIEW, V1, HASH_A));
    }

    function test_VerifyRejectsBadHash() public {
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        assertFalse(reg.verify(SKILL_REVIEW, V1, HASH_B));
    }

    function test_VerifyRejectsRevoked() public {
        vm.startPrank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);
        reg.revokeVersion(SKILL_REVIEW, V1);
        vm.stopPrank();
        assertFalse(reg.verify(SKILL_REVIEW, V1, HASH_A));
    }

    function test_VerifyRejectsUnknown() public {
        assertFalse(reg.verify(SKILL_REVIEW, V1, HASH_A));
    }

    // ─── ownership transfer ──────────────────────────────────────────────────

    function test_TransferOwnership() public {
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);

        vm.prank(alice);
        reg.transferSkillOwnership(SKILL_REVIEW, dao);
        assertEq(reg.ownerOf(SKILL_REVIEW), dao);

        // New owner can publish next version
        vm.prank(dao);
        reg.publishVersion(SKILL_REVIEW, V2, HASH_B);

        // Previous owner cannot
        vm.prank(alice);
        vm.expectRevert("SkillRegistry: not skill owner");
        reg.publishVersion(SKILL_REVIEW, keccak256("v0.3.0"), HASH_A);
    }

    function test_TransferOwnershipRejectsZero() public {
        vm.prank(alice);
        reg.publishVersion(SKILL_REVIEW, V1, HASH_A);

        vm.prank(alice);
        vm.expectRevert("SkillRegistry: zero newOwner");
        reg.transferSkillOwnership(SKILL_REVIEW, address(0));
    }
}
