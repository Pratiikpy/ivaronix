// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {SubscriptionEscrow} from "../src/SubscriptionEscrow.sol";

contract SubscriptionEscrowTest is Test {
    SubscriptionEscrow public escrow;

    address public client = address(0xC11E47);
    address public agent = address(0xA63E47);
    address public outsider = address(0x074651);

    bytes32 public constant SKILL = keccak256("skill:private-doc-review:v0.1.0");

    uint128 public constant PER_CHECKIN = 0.01 ether;
    uint128 public constant PER_ALERT = 0.05 ether;
    uint64 public constant INTERVAL = 1 days;
    uint64 public constant GRACE = 12 hours;
    uint128 public constant INITIAL_BUDGET = 0.5 ether;

    function setUp() public {
        escrow = new SubscriptionEscrow();
        vm.deal(client, 10 ether);
        vm.deal(agent, 1 ether);
    }

    // ─── create ──────────────────────────────────────────────────────────────

    function test_create_clientSet_storesAllFields() public {
        vm.prank(client);
        uint256 id = escrow.create{value: INITIAL_BUDGET}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
        assertEq(id, 0);

        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.client, client);
        assertEq(s.agent, agent);
        assertEq(s.budget, INITIAL_BUDGET);
        assertEq(s.spent, 0);
        assertEq(s.perCheckIn, PER_CHECKIN);
        assertEq(s.perAlert, PER_ALERT);
        assertEq(s.intervalSeconds, INTERVAL);
        assertEq(s.nextDueAt, uint64(block.timestamp) + INTERVAL);
        assertEq(s.graceSeconds, GRACE);
        assertEq(s.lowBalanceAt, 0);
        assertTrue(s.mode == SubscriptionEscrow.IntervalMode.CLIENT_SET);
        assertTrue(s.status == SubscriptionEscrow.Status.ACTIVE);
        assertEq(s.skillId, SKILL);
    }

    function test_create_agentProposed_leavesIntervalZero() public {
        vm.prank(client);
        uint256 id = escrow.create{value: INITIAL_BUDGET}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.AGENT_PROPOSED,
            PER_CHECKIN, PER_ALERT, 0, GRACE
        );
        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.intervalSeconds, 0);
        assertEq(s.nextDueAt, 0);
        assertTrue(s.mode == SubscriptionEscrow.IntervalMode.AGENT_PROPOSED);
    }

    function test_create_agentAuto_leavesIntervalZero() public {
        vm.prank(client);
        uint256 id = escrow.create{value: INITIAL_BUDGET}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.AGENT_AUTO,
            PER_CHECKIN, PER_ALERT, 0, GRACE
        );
        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.intervalSeconds, 0);
        assertEq(s.nextDueAt, 0);
        assertTrue(s.mode == SubscriptionEscrow.IntervalMode.AGENT_AUTO);
    }

    function test_create_clientSet_zeroIntervalReverts() public {
        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: CLIENT_SET requires interval");
        escrow.create{value: INITIAL_BUDGET}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, 0, GRACE
        );
    }

    function test_create_zeroAgentReverts() public {
        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: agent=0");
        escrow.create{value: INITIAL_BUDGET}(
            address(0), SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
    }

    function test_create_clientEqAgentReverts() public {
        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: client==agent");
        escrow.create{value: INITIAL_BUDGET}(
            client, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
    }

    function test_create_perAlertLessThanCheckInReverts() public {
        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: perAlert<perCheckIn");
        escrow.create{value: INITIAL_BUDGET}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_CHECKIN - 1, INTERVAL, GRACE
        );
    }

    function test_create_budgetBelowPerCheckInReverts() public {
        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: budget<perCheckIn");
        escrow.create{value: PER_CHECKIN - 1}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
    }

    // ─── checkIn ─────────────────────────────────────────────────────────────

    function test_checkIn_drainsAndPaysAgent() public {
        uint256 id = _createDefault();
        uint256 agentBalanceBefore = agent.balance;

        vm.prank(agent);
        escrow.checkIn(id);

        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.spent, PER_CHECKIN);
        assertEq(s.budget, INITIAL_BUDGET);
        assertEq(agent.balance, agentBalanceBefore + PER_CHECKIN);
        assertEq(s.nextDueAt, uint64(block.timestamp) + INTERVAL);
    }

    function test_checkIn_onlyAgentCanCall() public {
        uint256 id = _createDefault();
        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: only agent");
        escrow.checkIn(id);
        vm.prank(outsider);
        vm.expectRevert("SubscriptionEscrow: only agent");
        escrow.checkIn(id);
    }

    function test_checkIn_pausesWhenBalanceTooLowForNextRun() public {
        uint128 tightBudget = 2 * PER_CHECKIN;
        vm.prank(client);
        uint256 id = escrow.create{value: tightBudget}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );

        vm.prank(agent); escrow.checkIn(id);
        vm.prank(agent); escrow.checkIn(id);

        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertTrue(s.status == SubscriptionEscrow.Status.PAUSED);
        assertEq(s.lowBalanceAt, uint64(block.timestamp));
    }

    function test_checkIn_revertsWhenInsufficient() public {
        vm.prank(client);
        uint256 id = escrow.create{value: PER_CHECKIN}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
        vm.prank(agent); escrow.checkIn(id); // drains all, pauses

        vm.prank(agent);
        vm.expectRevert("SubscriptionEscrow: not active");
        escrow.checkIn(id);
    }

    // ─── alert ───────────────────────────────────────────────────────────────

    function test_alert_drainsPerAlertAmount() public {
        uint256 id = _createDefault();
        uint256 agentBalanceBefore = agent.balance;

        vm.prank(agent);
        escrow.alert(id);

        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.spent, PER_ALERT);
        assertEq(agent.balance, agentBalanceBefore + PER_ALERT);
    }

    function test_alert_revertsWhenInsufficient() public {
        vm.prank(client);
        uint256 id = escrow.create{value: PER_CHECKIN}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
        vm.prank(agent);
        vm.expectRevert("SubscriptionEscrow: insufficient");
        escrow.alert(id);
    }

    // ─── fund ────────────────────────────────────────────────────────────────

    function test_fund_increasesBudgetAndResumesIfPaused() public {
        vm.prank(client);
        uint256 id = escrow.create{value: PER_CHECKIN}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
        vm.prank(agent); escrow.checkIn(id); // pause

        vm.prank(client);
        escrow.fund{value: PER_CHECKIN * 5}(id);

        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.budget, PER_CHECKIN + PER_CHECKIN * 5);
        assertEq(s.lowBalanceAt, 0);
        assertTrue(s.status == SubscriptionEscrow.Status.ACTIVE);
    }

    function test_fund_anyoneCanFund() public {
        uint256 id = _createDefault();
        vm.deal(outsider, 1 ether);
        vm.prank(outsider);
        escrow.fund{value: 0.1 ether}(id);
        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.budget, INITIAL_BUDGET + 0.1 ether);
    }

    // ─── grace expiry ────────────────────────────────────────────────────────

    function test_grace_expiresAfterGraceSeconds() public {
        vm.prank(client);
        uint256 id = escrow.create{value: PER_CHECKIN}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
        vm.prank(agent); escrow.checkIn(id); // pause

        vm.warp(block.timestamp + uint256(GRACE) - 1);
        assertFalse(escrow.isExpired(id));

        vm.warp(block.timestamp + 2);
        assertTrue(escrow.isExpired(id));
    }

    // ─── proposeInterval / acceptInterval ────────────────────────────────────

    function test_proposeAndAcceptInterval_setsScheduling() public {
        vm.prank(client);
        uint256 id = escrow.create{value: INITIAL_BUDGET}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.AGENT_PROPOSED,
            PER_CHECKIN, PER_ALERT, 0, GRACE
        );

        vm.prank(agent);
        escrow.proposeInterval(id, 1 hours);
        assertEq(escrow.pendingInterval(id), 1 hours);

        vm.prank(client);
        escrow.acceptInterval(id);

        SubscriptionEscrow.Subscription memory s = escrow.getSubscription(id);
        assertEq(s.intervalSeconds, 1 hours);
        assertEq(s.nextDueAt, uint64(block.timestamp) + 1 hours);
        assertEq(escrow.pendingInterval(id), 0);
    }

    function test_proposeInterval_wrongModeReverts() public {
        uint256 id = _createDefault();
        vm.prank(agent);
        vm.expectRevert("SubscriptionEscrow: wrong mode");
        escrow.proposeInterval(id, 1 hours);
    }

    // ─── cancel + withdraw ───────────────────────────────────────────────────

    function test_cancel_byEitherParty() public {
        uint256 idA = _createDefault();
        vm.prank(client);
        escrow.cancel(idA);
        SubscriptionEscrow.Subscription memory sA = escrow.getSubscription(idA);
        assertTrue(sA.status == SubscriptionEscrow.Status.CANCELLED);

        uint256 idB = _createDefault();
        vm.prank(agent);
        escrow.cancel(idB);
        SubscriptionEscrow.Subscription memory sB = escrow.getSubscription(idB);
        assertTrue(sB.status == SubscriptionEscrow.Status.CANCELLED);
    }

    function test_cancel_outsiderReverts() public {
        uint256 id = _createDefault();
        vm.prank(outsider);
        vm.expectRevert("SubscriptionEscrow: not party");
        escrow.cancel(id);
    }

    function test_withdrawRemaining_afterCancelReturnsToClient() public {
        uint256 id = _createDefault();
        vm.prank(agent); escrow.checkIn(id);

        uint256 balanceBefore = client.balance;
        vm.prank(client); escrow.cancel(id);
        vm.prank(client); escrow.withdrawRemaining(id);

        uint128 expected = INITIAL_BUDGET - PER_CHECKIN;
        assertEq(client.balance, balanceBefore + expected);

        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: nothing to withdraw");
        escrow.withdrawRemaining(id);
    }

    function test_withdrawRemaining_blocksWhileActive() public {
        uint256 id = _createDefault();
        vm.prank(client);
        vm.expectRevert("SubscriptionEscrow: not terminal");
        escrow.withdrawRemaining(id);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    function _createDefault() internal returns (uint256 id) {
        vm.prank(client);
        id = escrow.create{value: INITIAL_BUDGET}(
            agent, SKILL, SubscriptionEscrow.IntervalMode.CLIENT_SET,
            PER_CHECKIN, PER_ALERT, INTERVAL, GRACE
        );
    }

    receive() external payable {}
}
