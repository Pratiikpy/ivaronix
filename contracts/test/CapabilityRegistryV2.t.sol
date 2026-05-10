// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @notice TEST FILE - hex-pattern private keys (0xA1A1_AAAA_..., etc.) below
 *         are deterministic placeholders with zero balance on every real
 *         chain. NEVER reuse them for any non-test purpose. If a secret
 *         scanner flags them: ignore. Closes WT 86 (planning-003 A.3.7).
 */

import {Test} from "forge-std/Test.sol";
import {CapabilityRegistryV2} from "../src/CapabilityRegistryV2.sol";

contract CapabilityRegistryV2Test is Test {
    CapabilityRegistryV2 public reg;

    address owner = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address indexer = address(0x1DEEEE);
    address stranger = address(0xC0FFEE);

    bytes32 constant SCOPE_WORK = keccak256("memory:work");
    bytes32 constant SCOPE_LEGAL = keccak256("memory:legal");

    function setUp() public {
        vm.prank(owner);
        reg = new CapabilityRegistryV2(owner);
    }

    function _issue(address granter, address grantee, bytes32 scope) internal returns (bytes32 grantId) {
        vm.prank(granter);
        grantId = reg.issueGrant(grantee, scope, 0, type(uint32).max);
    }

    // ─── Privacy: random wallets cannot read reverse indexes ──────────────────

    function test_K12_StrangerCannotReadGrantsByOwner() public {
        _issue(alice, bob, SCOPE_WORK);

        // Stranger trying to enumerate alice's grants reverts.
        vm.prank(stranger);
        vm.expectRevert(bytes("CapabilityRegistryV2: not owner or authorized indexer"));
        reg.getGrantsByOwner(alice);
    }

    function test_K12_StrangerCannotReadGrantsByGrantee() public {
        _issue(alice, bob, SCOPE_WORK);

        vm.prank(stranger);
        vm.expectRevert(bytes("CapabilityRegistryV2: not grantee or authorized indexer"));
        reg.getGrantsByGrantee(bob);
    }

    // ─── Self-read: owner / grantee can read their own indexes ─────────────────

    function test_K12_OwnerCanReadOwnGrants() public {
        bytes32 g1 = _issue(alice, bob, SCOPE_WORK);
        bytes32 g2 = _issue(alice, bob, SCOPE_LEGAL);

        vm.prank(alice);
        bytes32[] memory list = reg.getGrantsByOwner(alice);
        assertEq(list.length, 2);
        assertEq(list[0], g1);
        assertEq(list[1], g2);
    }

    function test_K12_GranteeCanReadOwnGrants() public {
        bytes32 g1 = _issue(alice, bob, SCOPE_WORK);

        vm.prank(bob);
        bytes32[] memory list = reg.getGrantsByGrantee(bob);
        assertEq(list.length, 1);
        assertEq(list[0], g1);
    }

    function test_K12_SelfReadConvenienceMethods() public {
        bytes32 g1 = _issue(alice, bob, SCOPE_WORK);

        // alice reads her own owner-side index without passing her address.
        vm.prank(alice);
        bytes32[] memory ownerList = reg.listMyOwnerGrants();
        assertEq(ownerList.length, 1);
        assertEq(ownerList[0], g1);

        // bob reads his own grantee-side index.
        vm.prank(bob);
        bytes32[] memory granteeList = reg.listMyGranteeGrants();
        assertEq(granteeList.length, 1);
        assertEq(granteeList[0], g1);
    }

    // ─── Authorized indexer: contract owner can grant indexer access ───────────

    function test_K12_AuthorizedIndexerCanReadAnyOwnerGrants() public {
        bytes32 g1 = _issue(alice, bob, SCOPE_WORK);

        // Owner authorizes the indexer.
        vm.prank(owner);
        reg.addAuthorizedReader(indexer);
        assertTrue(reg.authorizedReaders(indexer));

        // Indexer can now enumerate alice's grants.
        vm.prank(indexer);
        bytes32[] memory list = reg.getGrantsByOwner(alice);
        assertEq(list.length, 1);
        assertEq(list[0], g1);
    }

    function test_K12_AuthorizedIndexerCanReadAnyGranteeGrants() public {
        bytes32 g1 = _issue(alice, bob, SCOPE_WORK);

        vm.prank(owner);
        reg.addAuthorizedReader(indexer);

        vm.prank(indexer);
        bytes32[] memory list = reg.getGrantsByGrantee(bob);
        assertEq(list.length, 1);
        assertEq(list[0], g1);
    }

    function test_K12_RevokedIndexerLosesAccess() public {
        _issue(alice, bob, SCOPE_WORK);

        vm.startPrank(owner);
        reg.addAuthorizedReader(indexer);
        reg.removeAuthorizedReader(indexer);
        vm.stopPrank();

        vm.prank(indexer);
        vm.expectRevert(bytes("CapabilityRegistryV2: not owner or authorized indexer"));
        reg.getGrantsByOwner(alice);
    }

    function test_K12_OnlyOwnerCanAddAuthorizedReader() public {
        vm.prank(stranger);
        vm.expectRevert();
        reg.addAuthorizedReader(indexer);
    }

    // ─── Grant lifecycle parity with V1 (sanity check) ─────────────────────────

    function test_K12_GrantLifecycleParity() public {
        bytes32 grantId = _issue(alice, bob, SCOPE_WORK);

        assertTrue(reg.isValid(grantId, bob, SCOPE_WORK));

        // consumeRead returns true while reads remain.
        assertTrue(reg.consumeRead(grantId));

        // Revocation works.
        vm.prank(alice);
        reg.revokeGrant(grantId);
        assertFalse(reg.isValid(grantId, bob, SCOPE_WORK));
        assertFalse(reg.consumeRead(grantId));
    }
}
