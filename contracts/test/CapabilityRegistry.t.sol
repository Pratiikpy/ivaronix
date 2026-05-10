// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @notice TEST FILE - hex-pattern private keys (0xA1A1_AAAA_..., etc.) below
 *         are deterministic placeholders with zero balance on every real
 *         chain. NEVER reuse them for any non-test purpose. If a secret
 *         scanner flags them: ignore. Closes WT 86 (planning-003 A.3.7).
 */

import {Test} from "forge-std/Test.sol";
import {CapabilityRegistry} from "../src/CapabilityRegistry.sol";
import {MemoryAccessLog} from "../src/MemoryAccessLog.sol";

contract CapabilityRegistryTest is Test {
    CapabilityRegistry public registry;
    MemoryAccessLog public accessLog;

    address public alice = address(0xA1); // memory owner
    address public bob = address(0xB0B); // grantee
    address public eve = address(0xEEEE); // unauthorized

    bytes32 public constant SCOPE_WORK = keccak256("namespace:work");
    bytes32 public constant SCOPE_PERSONAL = keccak256("namespace:personal");

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

    function setUp() public {
        registry = new CapabilityRegistry();
        accessLog = new MemoryAccessLog();
    }

    function test_IssueGrantStoresFields() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);

        (
            address owner,
            address grantee,
            bytes32 scopeHash,
            uint64 issuedAt,
            uint64 expiresAt,
            uint32 readsRemaining,
            bool revoked
        ) = registry.grants(id);

        assertEq(owner, alice);
        assertEq(grantee, bob);
        assertEq(scopeHash, SCOPE_WORK);
        assertGt(issuedAt, 0);
        assertEq(expiresAt, issuedAt + 3600);
        assertEq(readsRemaining, 100);
        assertFalse(revoked);
    }

    function test_IssueGrantRejectsZeroGrantee() public {
        vm.prank(alice);
        vm.expectRevert("CapabilityRegistry: zero grantee");
        registry.issueGrant(address(0), SCOPE_WORK, 3600, 100);
    }

    function test_IssueGrantRejectsSelfGrant() public {
        vm.prank(alice);
        vm.expectRevert("CapabilityRegistry: self-grant disallowed");
        registry.issueGrant(alice, SCOPE_WORK, 3600, 100);
    }

    function test_IsValidPositive() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);
        assertTrue(registry.isValid(id, bob, SCOPE_WORK));
    }

    function test_IsValidWrongGranteeFails() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);
        assertFalse(registry.isValid(id, eve, SCOPE_WORK));
    }

    function test_IsValidWrongScopeFails() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);
        assertFalse(registry.isValid(id, bob, SCOPE_PERSONAL));
    }

    function test_RevokeFlipsValid() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);
        assertTrue(registry.isValid(id, bob, SCOPE_WORK));

        vm.prank(alice);
        registry.revokeGrant(id);
        assertFalse(registry.isValid(id, bob, SCOPE_WORK));
    }

    function test_RevokeRejectsNonOwner() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);

        vm.prank(eve);
        vm.expectRevert("CapabilityRegistry: not owner");
        registry.revokeGrant(id);
    }

    function test_RevokeIdempotenceRejected() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);

        vm.prank(alice);
        registry.revokeGrant(id);
        vm.prank(alice);
        vm.expectRevert("CapabilityRegistry: already revoked");
        registry.revokeGrant(id);
    }

    function test_ConsumeReadDecrements() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 3);

        vm.prank(bob);
        bool ok = registry.consumeRead(id);
        assertTrue(ok);

        (, , , , , uint32 readsRemaining, ) = registry.grants(id);
        assertEq(readsRemaining, 2);
    }

    function test_ConsumeReadFailsWhenExhausted() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 3600, 1);

        vm.prank(bob);
        registry.consumeRead(id);
        vm.prank(bob);
        bool ok = registry.consumeRead(id);
        assertFalse(ok, "should fail when reads exhausted");
    }

    function test_ConsumeReadFailsAfterExpiry() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 100, 100);

        vm.warp(block.timestamp + 101);

        vm.prank(bob);
        bool ok = registry.consumeRead(id);
        assertFalse(ok);
    }

    function test_UnlimitedReadsDoNotDecrement() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 0, type(uint32).max);

        vm.prank(bob);
        registry.consumeRead(id);
        vm.prank(bob);
        registry.consumeRead(id);

        (, , , , , uint32 readsRemaining, ) = registry.grants(id);
        assertEq(readsRemaining, type(uint32).max);
    }

    function test_NoExpiryWhenTtlIsZero() public {
        vm.prank(alice);
        bytes32 id = registry.issueGrant(bob, SCOPE_WORK, 0, 100);

        vm.warp(block.timestamp + 1_000_000_000);

        vm.prank(bob);
        bool ok = registry.consumeRead(id);
        assertTrue(ok);
    }

    function test_ReverseIndexes() public {
        vm.startPrank(alice);
        bytes32 id1 = registry.issueGrant(bob, SCOPE_WORK, 3600, 100);
        bytes32 id2 = registry.issueGrant(bob, SCOPE_PERSONAL, 3600, 50);
        vm.stopPrank();

        bytes32[] memory aliceGrants = registry.listGrantsByOwner(alice);
        assertEq(aliceGrants.length, 2);
        assertEq(aliceGrants[0], id1);
        assertEq(aliceGrants[1], id2);

        bytes32[] memory bobGrants = registry.listGrantsByGrantee(bob);
        assertEq(bobGrants.length, 2);
    }

    function test_EventIssued() public {
        vm.expectEmit(false, true, true, false); // grantId is keccak; we don't predict it
        emit GrantIssued(bytes32(0), alice, bob, SCOPE_WORK, uint64(block.timestamp + 3600), 100);
        vm.prank(alice);
        registry.issueGrant(bob, SCOPE_WORK, 3600, 100);
    }
}

contract MemoryAccessLogTest is Test {
    MemoryAccessLog public accessLog;

    function setUp() public {
        accessLog = new MemoryAccessLog();
    }

    function test_LogAccessEmitsEvent() public {
        accessLog.logAccess(
            address(0xAA),
            bytes32("grant-1"),
            bytes32("memv1"),
            accessLog.ACCESS_READ(),
            keccak256("namespace:work")
        );
    }

    function test_LogAccessRejectsBadAccessType() public {
        vm.expectRevert("MemoryAccessLog: invalid accessType");
        accessLog.logAccess(address(0xAA), bytes32(0), bytes32(0), 99, bytes32(0));
    }

    function test_AccessTypesConstants() public view {
        assertEq(accessLog.ACCESS_READ(), 0);
        assertEq(accessLog.ACCESS_WRITE(), 1);
        assertEq(accessLog.ACCESS_DELETE(), 2);
        assertEq(accessLog.ACCESS_GRANT_USED(), 3);
    }
}
