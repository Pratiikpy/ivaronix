// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @notice TEST FILE - hex-pattern private keys (0xA1A1_AAAA_..., etc.) below
 *         are deterministic placeholders with zero balance on every real
 *         chain. NEVER reuse them for any non-test purpose. If a secret
 *         scanner flags them: ignore. Closes WT 86 (planning-003 A.3.7).
 */

import {Test} from "forge-std/Test.sol";
import {MemoryAccessLogV2} from "../src/MemoryAccessLogV2.sol";
import {CapabilityRegistryV2} from "../src/CapabilityRegistryV2.sol";

contract MemoryAccessLogV2Test is Test {
    MemoryAccessLogV2 public mlog;
    // Using `mlog` instead of `log` — forge-std's StdAssertions defines
    // `event log(string)` and the name shadow breaks the parser.
    CapabilityRegistryV2 public registry;

    address owner = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address attacker = address(0xC0FFEE);

    bytes32 constant SCOPE_WORK = keccak256("memory:work");
    bytes32 constant SCOPE_LEGAL = keccak256("memory:legal");
    bytes32 constant MEMORY_ROOT = keccak256("memory:root:1");

    function setUp() public {
        vm.prank(owner);
        registry = new CapabilityRegistryV2(owner);
        mlog = new MemoryAccessLogV2(address(registry));
    }

    // ─── Self-log: msg.sender == agent always allowed ─────────────────────────

    function test_K12_SelfLogAllowed() public {
        vm.prank(alice);
        mlog.logAccess(alice, bytes32(0), MEMORY_ROOT, 0, SCOPE_WORK);
        // No revert · success path
    }

    // ─── Spoofing: random wallet cannot log against another wallet's audit ────

    function test_K12_AttackerCannotSpoofAgent() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("MemoryAccessLogV2: not agent (grantId required)"));
        mlog.logAccess(alice, bytes32(0), MEMORY_ROOT, 0, SCOPE_WORK);
    }

    function test_K12_AttackerCannotSpoofWithFakeGrantId() public {
        bytes32 fakeGrantId = keccak256("fake-grant");

        vm.prank(attacker);
        vm.expectRevert(bytes("MemoryAccessLogV2: invalid grant for caller+scope"));
        mlog.logAccess(alice, fakeGrantId, MEMORY_ROOT, 0, SCOPE_WORK);
    }

    // ─── Grant-backed: valid grantee can log on behalf of an agent ────────────

    function test_K12_GranteeCanLogWithValidGrant() public {
        // Alice issues a grant to Bob for SCOPE_WORK.
        vm.prank(alice);
        bytes32 grantId = registry.issueGrant(bob, SCOPE_WORK, 0, type(uint32).max);

        // Bob can now log a memory_access event recording that the agent
        // (alice) was accessed via this grant.
        vm.prank(bob);
        mlog.logAccess(alice, grantId, MEMORY_ROOT, 0, SCOPE_WORK);
        // No revert · success path
    }

    function test_K12_GrantWrongScopeRejected() public {
        // Alice issues a grant for SCOPE_WORK.
        vm.prank(alice);
        bytes32 grantId = registry.issueGrant(bob, SCOPE_WORK, 0, type(uint32).max);

        // Bob tries to log against SCOPE_LEGAL using the WORK grant — rejected.
        vm.prank(bob);
        vm.expectRevert(bytes("MemoryAccessLogV2: invalid grant for caller+scope"));
        mlog.logAccess(alice, grantId, MEMORY_ROOT, 0, SCOPE_LEGAL);
    }

    function test_K12_RevokedGrantBlocksLog() public {
        vm.prank(alice);
        bytes32 grantId = registry.issueGrant(bob, SCOPE_WORK, 0, type(uint32).max);

        vm.prank(alice);
        registry.revokeGrant(grantId);

        // Bob's grant is now revoked; logging should revert.
        vm.prank(bob);
        vm.expectRevert(bytes("MemoryAccessLogV2: invalid grant for caller+scope"));
        mlog.logAccess(alice, grantId, MEMORY_ROOT, 0, SCOPE_WORK);
    }

    function test_K12_NonGranteeCannotUseSomeoneElsesGrant() public {
        vm.prank(alice);
        bytes32 grantId = registry.issueGrant(bob, SCOPE_WORK, 0, type(uint32).max);

        // Attacker holds a real grantId (intercepted via events) but they
        // are NOT the grantee. The grant cross-check must reject.
        vm.prank(attacker);
        vm.expectRevert(bytes("MemoryAccessLogV2: invalid grant for caller+scope"));
        mlog.logAccess(alice, grantId, MEMORY_ROOT, 0, SCOPE_WORK);
    }

    // ─── Validation: invalid accessType rejected ──────────────────────────────

    function test_K12_InvalidAccessTypeReverts() public {
        vm.prank(alice);
        vm.expectRevert(bytes("MemoryAccessLogV2: invalid accessType"));
        mlog.logAccess(alice, bytes32(0), MEMORY_ROOT, 99, SCOPE_WORK);
    }

    // ─── Constructor: zero registry rejected ──────────────────────────────────

    function test_K12_ConstructorRejectsZeroRegistry() public {
        vm.expectRevert(bytes("MemoryAccessLogV2: zero registry"));
        new MemoryAccessLogV2(address(0));
    }

    // ─── Event shape unchanged from V1 ────────────────────────────────────────

    /// @dev Re-declares the event signature so vm.expectEmit can match against it.
    event MemoryAccessed(
        address indexed agent,
        bytes32 indexed grantId,
        bytes32 indexed memoryRoot,
        uint8 accessType,
        uint64 timestamp,
        bytes32 scopeHash
    );

    function test_K12_EventShapeMatchesV1() public {
        // Match on the indexed topics (agent / grantId / memoryRoot) and the
        // accessType + scopeHash payload. Skip timestamp (depends on block.timestamp).
        vm.expectEmit(true, true, true, false, address(mlog));
        emit MemoryAccessed(alice, bytes32(0), MEMORY_ROOT, 1, 0, SCOPE_WORK);

        vm.prank(alice);
        mlog.logAccess(alice, bytes32(0), MEMORY_ROOT, 1, SCOPE_WORK);
    }
}
