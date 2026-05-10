// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @notice TEST FILE - hex-pattern private keys (0xA1A1_AAAA_..., etc.) below
 *         are deterministic placeholders with zero balance on every real
 *         chain. NEVER reuse them for any non-test purpose. If a secret
 *         scanner flags them: ignore. Closes WT 86 (planning-003 A.3.7).
 */

import {Test} from "forge-std/Test.sol";
import {SkillRegistryV2} from "../src/SkillRegistryV2.sol";

contract SkillRegistryV2Test is Test {
    SkillRegistryV2 public reg;

    address contractOwner = address(0xA11CE);
    address operator = address(0x09E2A702); // legitimate creator wallet
    address squatter = address(0xBADBAD);
    address newOwner = address(0xC0FFEE);
    address arbiter = address(0xA11CE); // same as contractOwner

    bytes32 constant SKILL_PDR = keccak256("skill:private-doc-review");
    bytes32 constant SKILL_GA = keccak256("skill:github-audit");
    bytes32 constant SKILL_NEW = keccak256("skill:new-third-party");
    bytes32 constant V1 = keccak256("v0.1.0");
    bytes32 constant V2 = keccak256("v0.2.0");
    bytes32 constant MANIFEST_A = keccak256("manifest-a");
    bytes32 constant MANIFEST_B = keccak256("manifest-b");

    function setUp() public {
        bytes32[] memory reservedIds = new bytes32[](2);
        reservedIds[0] = SKILL_PDR;
        reservedIds[1] = SKILL_GA;

        address[] memory reservedOwners = new address[](2);
        reservedOwners[0] = operator;
        reservedOwners[1] = operator;

        vm.prank(contractOwner);
        reg = new SkillRegistryV2(contractOwner, reservedIds, reservedOwners);
    }

    // ─── Reserved-list happy path ──────────────────────────────────────────────

    function test_K20_ReservedSkillsAreSetAtConstruction() public view {
        assertEq(reg.reservedFor(SKILL_PDR), operator);
        assertEq(reg.reservedFor(SKILL_GA), operator);
        assertEq(reg.reservedFor(SKILL_NEW), address(0));
    }

    function test_K20_ReservedOwnerCanFirstPublish() public {
        vm.prank(operator);
        reg.publishVersion(SKILL_PDR, V1, MANIFEST_A);

        assertEq(reg.ownerOf(SKILL_PDR), operator);
        // Reservation cleared after claim.
        assertEq(reg.reservedFor(SKILL_PDR), address(0));
    }

    function test_K20_ReservedOwnerCanPublishMultipleVersions() public {
        vm.startPrank(operator);
        reg.publishVersion(SKILL_PDR, V1, MANIFEST_A);
        reg.publishVersion(SKILL_PDR, V2, MANIFEST_B);
        vm.stopPrank();

        assertEq(reg.versionCount(SKILL_PDR), 2);
    }

    // ─── Reserved-list squatter rejection ──────────────────────────────────────

    function test_K20_SquatterCannotPublishReservedSkill() public {
        vm.prank(squatter);
        vm.expectRevert(bytes("SkillRegistryV2: reserved for another owner"));
        reg.publishVersion(SKILL_PDR, V1, MANIFEST_A);
    }

    function test_K20_SquatterCannotEvenRegisterFirst() public {
        // Even if the squatter front-runs, the reserved-list check rejects them.
        vm.prank(squatter);
        vm.expectRevert(bytes("SkillRegistryV2: reserved for another owner"));
        reg.publishVersion(SKILL_GA, V1, MANIFEST_A);
    }

    // ─── Unreserved skills · first-come-first-served ──────────────────────────

    function test_K20_UnreservedSkillIsFirstComeFirstServed() public {
        // Anyone can publish an unreserved skill name; first wallet wins.
        vm.prank(squatter);
        reg.publishVersion(SKILL_NEW, V1, MANIFEST_A);

        assertEq(reg.ownerOf(SKILL_NEW), squatter);

        // Operator cannot now publish on top.
        vm.prank(operator);
        vm.expectRevert(bytes("SkillRegistryV2: not skill owner"));
        reg.publishVersion(SKILL_NEW, V2, MANIFEST_B);
    }

    // ─── Owner-arbitration safety valve ───────────────────────────────────────

    function test_K20_ContractOwnerCanArbitrateSquatterOwnership() public {
        // Squatter publishes an unreserved skill.
        vm.prank(squatter);
        reg.publishVersion(SKILL_NEW, V1, MANIFEST_A);
        assertEq(reg.ownerOf(SKILL_NEW), squatter);

        // Off-chain evidence shows squatter is bad-faith. Contract owner arbitrates.
        vm.prank(contractOwner);
        reg.arbitrateOwnership(SKILL_NEW, operator);

        assertEq(reg.ownerOf(SKILL_NEW), operator);
    }

    function test_K20_OnlyContractOwnerCanArbitrate() public {
        vm.prank(squatter);
        reg.publishVersion(SKILL_NEW, V1, MANIFEST_A);

        // Random wallet cannot arbitrate.
        vm.prank(squatter);
        vm.expectRevert();
        reg.arbitrateOwnership(SKILL_NEW, operator);
    }

    function test_K20_ArbitrationOnNeverPublishedReverts() public {
        bytes32 unpublished = keccak256("skill:never-existed");
        vm.prank(contractOwner);
        vm.expectRevert(bytes("SkillRegistryV2: no owner to arbitrate"));
        reg.arbitrateOwnership(unpublished, operator);
    }

    // ─── Reserved-list management post-deploy ──────────────────────────────────

    function test_K20_OwnerCanReserveAdditionalNamesPostDeploy() public {
        bytes32 newReserved = keccak256("skill:future-skill");
        vm.prank(contractOwner);
        reg.reserveSkillName(newReserved, operator);

        assertEq(reg.reservedFor(newReserved), operator);

        // Squatter still rejected.
        vm.prank(squatter);
        vm.expectRevert(bytes("SkillRegistryV2: reserved for another owner"));
        reg.publishVersion(newReserved, V1, MANIFEST_A);
    }

    function test_K20_CannotReserveAlreadyPublishedSkill() public {
        vm.prank(squatter);
        reg.publishVersion(SKILL_NEW, V1, MANIFEST_A);

        vm.prank(contractOwner);
        vm.expectRevert(bytes("SkillRegistryV2: already published"));
        reg.reserveSkillName(SKILL_NEW, operator);
    }

    function test_K20_OwnerCanUnreserveBeforeFirstPublish() public {
        vm.prank(contractOwner);
        reg.unreserveSkillName(SKILL_GA);

        assertEq(reg.reservedFor(SKILL_GA), address(0));

        // Now anyone can publish.
        vm.prank(squatter);
        reg.publishVersion(SKILL_GA, V1, MANIFEST_A);
        assertEq(reg.ownerOf(SKILL_GA), squatter);
    }

    // ─── Lifecycle parity with V1 ──────────────────────────────────────────────

    function test_K20_RevokeVersionParityWithV1() public {
        vm.startPrank(operator);
        reg.publishVersion(SKILL_PDR, V1, MANIFEST_A);
        reg.revokeVersion(SKILL_PDR, V1);
        vm.stopPrank();

        SkillRegistryV2.SkillVersion memory v = reg.getVersion(SKILL_PDR, V1);
        assertTrue(v.revoked);
        assertFalse(reg.verify(SKILL_PDR, V1, MANIFEST_A));
    }

    function test_K20_TransferOwnershipParityWithV1() public {
        vm.prank(operator);
        reg.publishVersion(SKILL_PDR, V1, MANIFEST_A);

        vm.prank(operator);
        reg.transferSkillOwnership(SKILL_PDR, newOwner);

        assertEq(reg.ownerOf(SKILL_PDR), newOwner);
    }

    function test_K20_VerifyAcceptsCorrectManifest() public {
        vm.prank(operator);
        reg.publishVersion(SKILL_PDR, V1, MANIFEST_A);
        assertTrue(reg.verify(SKILL_PDR, V1, MANIFEST_A));
        assertFalse(reg.verify(SKILL_PDR, V1, MANIFEST_B));
    }

    // ─── Constructor input validation ──────────────────────────────────────────

    function test_K20_ConstructorRejectsArrayLengthMismatch() public {
        bytes32[] memory ids = new bytes32[](2);
        address[] memory owners = new address[](1);
        vm.expectRevert(bytes("SkillRegistryV2: array length mismatch"));
        new SkillRegistryV2(contractOwner, ids, owners);
    }
}
