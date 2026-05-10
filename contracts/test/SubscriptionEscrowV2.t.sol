// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @notice TEST FILE - hex-pattern private keys (0xA1A1_AAAA_..., etc.) below
 *         are deterministic placeholders with zero balance on every real
 *         chain. NEVER reuse them for any non-test purpose. If a secret
 *         scanner flags them: ignore. Closes WT 86 (planning-003 A.3.7).
 */

import {Test} from "forge-std/Test.sol";
import {SubscriptionEscrowV2} from "../src/SubscriptionEscrowV2.sol";

/**
 * Mock ReceiptRegistry for SubscriptionEscrowV2 cross-check tests. Same
 * `receipts(id)` + `nextId()` shape as the real V1 + V2 registries; we
 * just control what each id resolves to.
 */
contract MockReceiptRegistry {
    struct Row {
        bytes32 receiptRoot;
        bytes32 storageRoot;
        bytes32 attestationHash;
        address agentAddress;
        uint64 timestamp;
        uint8 receiptType;
    }

    mapping(uint256 => Row) public _rows;
    uint256 public _nextId;

    function setReceipt(uint256 id, address agent, uint64 ts) external {
        _rows[id] = Row({
            receiptRoot: bytes32(id),
            storageRoot: bytes32(uint256(id) + 1),
            attestationHash: bytes32(0),
            agentAddress: agent,
            timestamp: ts,
            receiptType: 9 // subscription_skill_exec
        });
        if (id >= _nextId) _nextId = id + 1;
    }

    function receipts(uint256 id)
        external
        view
        returns (
            bytes32 receiptRoot,
            bytes32 storageRoot,
            bytes32 attestationHash,
            address agentAddress,
            uint64 timestamp,
            uint8 receiptType
        )
    {
        Row memory r = _rows[id];
        return (r.receiptRoot, r.storageRoot, r.attestationHash, r.agentAddress, r.timestamp, r.receiptType);
    }

    function nextId() external view returns (uint256) {
        return _nextId;
    }
}

contract SubscriptionEscrowV2Test is Test {
    SubscriptionEscrowV2 public escrow;
    MockReceiptRegistry public registry;

    address client = address(0xC11E47);
    address agent = address(0x09E2A702);
    address attacker = address(0xBADBAD);

    bytes32 constant SKILL_ID = keccak256("skill:private-doc-review");

    function setUp() public {
        // Warp to a realistic timestamp so MAX_RECEIPT_AGE arithmetic doesn't
        // underflow uint64 (Foundry's default block.timestamp is 1).
        vm.warp(2_000_000_000); // 2033-05-18

        registry = new MockReceiptRegistry();
        escrow = new SubscriptionEscrowV2(address(registry));
        vm.deal(client, 100 ether);
        vm.deal(agent, 1 ether);
        vm.deal(attacker, 1 ether);
    }

    function _createAutoSubscription() internal returns (uint256 id) {
        vm.prank(client);
        id = escrow.create{value: 10 ether}(
            agent,
            SKILL_ID,
            SubscriptionEscrowV2.IntervalMode.AGENT_AUTO,
            1 ether, // perCheckIn
            1 ether, // perAlert
            0, // intervalSeconds (AGENT_AUTO ignores)
            uint64(7 days)
        );
    }

    // ─── Receipt-binding happy path ──────────────────────────────────────────

    function test_K26_AgentCanCheckInWithValidReceipt() public {
        uint256 id = _createAutoSubscription();
        registry.setReceipt(1, agent, uint64(block.timestamp));

        vm.prank(agent);
        escrow.checkIn(id, 1);

        SubscriptionEscrowV2.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.spent, 1 ether);
        assertTrue(escrow.usedReceipts(1));
    }

    // ─── Receipt-binding rejection paths ──────────────────────────────────────

    function test_K26_RejectsNonexistentReceipt() public {
        uint256 id = _createAutoSubscription();
        // No receipt set, so id=42 is past nextId.
        vm.prank(agent);
        vm.expectRevert(bytes("SubscriptionEscrowV2: receipt does not exist"));
        escrow.checkIn(id, 42);
    }

    function test_K26_RejectsCrossAgentReceipt() public {
        uint256 id = _createAutoSubscription();
        // Receipt belongs to attacker, not the subscription's agent.
        registry.setReceipt(1, attacker, uint64(block.timestamp));

        vm.prank(agent);
        vm.expectRevert(bytes("SubscriptionEscrowV2: receipt agent mismatch"));
        escrow.checkIn(id, 1);
    }

    function test_K26_RejectsStaleReceipt() public {
        uint256 id = _createAutoSubscription();
        // Receipt timestamp is older than MAX_RECEIPT_AGE (24h default).
        uint64 stale = uint64(block.timestamp) - 100000; // 100k seconds = ~28h
        registry.setReceipt(1, agent, stale);

        vm.prank(agent);
        vm.expectRevert(bytes("SubscriptionEscrowV2: receipt too old"));
        escrow.checkIn(id, 1);
    }

    function test_K26_RejectsReceiptReplay() public {
        uint256 id = _createAutoSubscription();
        registry.setReceipt(1, agent, uint64(block.timestamp));

        vm.prank(agent);
        escrow.checkIn(id, 1);

        // Same receipt cannot be reused on a second check-in.
        vm.prank(agent);
        vm.expectRevert(bytes("SubscriptionEscrowV2: receipt already used"));
        escrow.checkIn(id, 1);
    }

    function test_K26_NonAgentCannotCheckIn() public {
        uint256 id = _createAutoSubscription();
        registry.setReceipt(1, agent, uint64(block.timestamp));

        // Even with a valid agent-owned receipt, the attacker can't drain.
        vm.prank(attacker);
        vm.expectRevert(bytes("SubscriptionEscrowV2: only agent"));
        escrow.checkIn(id, 1);
    }

    // ─── Cadence: agent must produce a fresh receipt for each check-in ────────

    function test_K26_AgentMustProduceFreshReceiptPerCheckIn() public {
        uint256 id = _createAutoSubscription();

        // First receipt + check-in.
        registry.setReceipt(1, agent, uint64(block.timestamp));
        vm.prank(agent);
        escrow.checkIn(id, 1);

        // Second check-in needs a new receipt.
        registry.setReceipt(2, agent, uint64(block.timestamp));
        vm.prank(agent);
        escrow.checkIn(id, 2);

        SubscriptionEscrowV2.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.spent, 2 ether);
    }

    // ─── Alert path also requires receipt cross-check ─────────────────────────

    function test_K26_AlertRequiresValidReceipt() public {
        uint256 id = _createAutoSubscription();

        // Alert with stale receipt is rejected.
        uint64 stale = uint64(block.timestamp) - 100000;
        registry.setReceipt(1, agent, stale);

        vm.prank(agent);
        vm.expectRevert(bytes("SubscriptionEscrowV2: receipt too old"));
        escrow.alert(id, 1);

        // Fresh receipt accepted.
        registry.setReceipt(2, agent, uint64(block.timestamp));
        vm.prank(agent);
        escrow.alert(id, 2);

        SubscriptionEscrowV2.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.spent, 1 ether); // perAlert == 1 ether in our setup
    }

    // ─── Constructor + lifecycle parity ───────────────────────────────────────

    function test_K26_ConstructorRejectsZeroRegistry() public {
        vm.expectRevert(bytes("SubscriptionEscrowV2: zero registry"));
        new SubscriptionEscrowV2(address(0));
    }

    function test_K26_ClientCanCancelAndWithdraw() public {
        uint256 id = _createAutoSubscription();

        vm.prank(client);
        escrow.cancel(id);

        vm.prank(client);
        escrow.withdrawRemaining(id);

        SubscriptionEscrowV2.Subscription memory s = escrow.getSubscription(id);
        assertEq(uint8(s.status), uint8(SubscriptionEscrowV2.Status.CANCELLED));
        assertEq(s.spent, s.budget); // all funds returned to client
    }
}
