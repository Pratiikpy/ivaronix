// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";

contract ReceiptRegistryTest is Test {
    ReceiptRegistry public registry;
    address public owner = address(0xA11CE);
    address public alice = address(0xA1);
    address public bob = address(0xB0B);

    // Mirror of the event so we can use `emit` in expectEmit assertions.
    event ReceiptAnchored(
        uint256 indexed id,
        bytes32 indexed receiptRoot,
        address indexed agent,
        uint8 receiptType,
        bytes32 storageRoot,
        bytes32 attestationHash
    );

    function setUp() public {
        vm.prank(owner);
        registry = new ReceiptRegistry(owner);
    }

    function test_AnchorIncrementsId() public {
        vm.prank(alice);
        uint256 id0 = registry.anchor(bytes32("r0"), bytes32("s0"), 0, bytes32("a0"));
        assertEq(id0, 0);

        vm.prank(alice);
        uint256 id1 = registry.anchor(bytes32("r1"), bytes32("s1"), 1, bytes32("a1"));
        assertEq(id1, 1);

        assertEq(registry.nextId(), 2);
    }

    function test_AnchorStoresAllFields() public {
        vm.warp(1000);
        vm.prank(alice);
        uint256 id = registry.anchor(bytes32("root"), bytes32("storage"), 2, bytes32("att"));

        (
            bytes32 receiptRoot,
            bytes32 storageRoot,
            bytes32 attestationHash,
            address agent,
            uint64 timestamp,
            uint8 receiptType
        ) = registry.receipts(id);

        assertEq(receiptRoot, bytes32("root"));
        assertEq(storageRoot, bytes32("storage"));
        assertEq(attestationHash, bytes32("att"));
        assertEq(agent, alice);
        assertEq(timestamp, 1000);
        assertEq(receiptType, 2);
    }

    function test_AgentReceiptCount() public {
        vm.prank(alice);
        registry.anchor(bytes32("r0"), bytes32("s0"), 0, bytes32(0));
        vm.prank(alice);
        registry.anchor(bytes32("r1"), bytes32("s1"), 0, bytes32(0));
        vm.prank(bob);
        registry.anchor(bytes32("r2"), bytes32("s2"), 0, bytes32(0));

        assertEq(registry.agentReceiptCount(alice), 2);
        assertEq(registry.agentReceiptCount(bob), 1);
    }

    function test_RevertsOnEmptyReceiptRoot() public {
        vm.prank(alice);
        vm.expectRevert("ReceiptRegistry: empty receiptRoot");
        registry.anchor(bytes32(0), bytes32("s"), 0, bytes32(0));
    }

    function test_RevertsOnEmptyStorageRoot() public {
        vm.prank(alice);
        vm.expectRevert("ReceiptRegistry: empty storageRoot");
        registry.anchor(bytes32("r"), bytes32(0), 0, bytes32(0));
    }

    function test_RevertsOnInvalidType() public {
        // Cap raised to 9 (TYPE_SUBSCRIPTION_SKILL_EXEC) by PASS 76 B-1.
        // 10 is the next-invalid value.
        vm.prank(alice);
        vm.expectRevert("ReceiptRegistry: invalid type");
        registry.anchor(bytes32("r"), bytes32("s"), 10, bytes32(0));
    }

    function test_AcceptsSubscriptionSkillExecType() public {
        vm.prank(alice);
        uint256 id = registry.anchor(bytes32("r"), bytes32("s"), 9, bytes32(0));
        (,,,,, uint8 receiptType) = registry.receipts(id);
        assertEq(receiptType, 9, "type 9 = subscription_skill_exec accepted");
    }

    function test_PauseBlocksAnchor() public {
        vm.prank(owner);
        registry.pause();

        vm.prank(alice);
        vm.expectRevert();
        registry.anchor(bytes32("r"), bytes32("s"), 0, bytes32(0));
    }

    function test_UnpauseRestoresAnchor() public {
        vm.prank(owner);
        registry.pause();
        vm.prank(owner);
        registry.unpause();

        vm.prank(alice);
        uint256 id = registry.anchor(bytes32("r"), bytes32("s"), 0, bytes32(0));
        assertEq(id, 0);
    }

    function test_OnlyOwnerCanPause() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.pause();
    }

    function test_EmitsReceiptAnchored() public {
        vm.expectEmit(true, true, true, true);
        emit ReceiptAnchored(0, bytes32("r"), alice, 1, bytes32("s"), bytes32("a"));
        vm.prank(alice);
        registry.anchor(bytes32("r"), bytes32("s"), 1, bytes32("a"));
    }
}
