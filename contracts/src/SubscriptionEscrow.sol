// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SubscriptionEscrow
 * @notice Recurring agent-billing escrow on 0G Chain. Per PASS 76 B-1.
 * @dev Pattern lifted from zer0Gig's SubscriptionEscrow.sol (3 interval modes
 *      + grace-period auto-pause). Re-implemented under our brand with per-
 *      check-in / per-alert drain rates so each tick maps cleanly to a
 *      `subscription_skill_exec` receipt anchored on ReceiptRegistry.
 *
 *      Lifecycle: client creates + funds → agent checks in periodically (each
 *      check-in drains `perCheckIn`; alerts drain `perAlert`) → if balance
 *      drops below `perCheckIn`, contract auto-pauses, starting a grace
 *      window for the client to top up; if grace expires, status moves to
 *      EXPIRED and remaining funds are claimable by the client.
 *
 *      All amounts in native OG (msg.value semantics). The receipt anchor
 *      is intentionally NOT inlined here — the agent posts the
 *      subscription_skill_exec receipt on ReceiptRegistry from the same
 *      tx-context (or a follow-up tx) so the two contracts stay decoupled
 *      and either can be upgraded independently.
 */
contract SubscriptionEscrow is ReentrancyGuard {
    /// @notice Who decides the period between check-ins.
    enum IntervalMode {
        CLIENT_SET, // client pins intervalSeconds at create time
        AGENT_PROPOSED, // agent calls proposeInterval; client must accept
        AGENT_AUTO // agent free to skip-or-fire, no enforcement
    }

    /// @notice Subscription state machine.
    enum Status {
        ACTIVE,
        PAUSED, // low-balance grace period
        CANCELLED,
        EXPIRED // grace lapsed, terminal
    }

    struct Subscription {
        address client;
        address agent;
        uint128 budget; // total funded
        uint128 spent; // drained so far
        uint128 perCheckIn; // amount per check-in
        uint128 perAlert; // amount per alert (typically > perCheckIn)
        uint64 intervalSeconds;
        uint64 nextDueAt; // unix ts when next check-in expected
        uint64 graceSeconds; // grace window after low balance
        uint64 lowBalanceAt; // ts when balance went below perCheckIn (0 if never)
        IntervalMode mode;
        Status status;
        bytes32 skillId; // SkillRegistry id (informational)
    }

    /// @notice subscriptionId => Subscription
    mapping(uint256 => Subscription) public subscriptions;

    /// @notice Number of subscriptions ever created. Also the next id.
    uint256 public nextId;

    /// @notice Pending interval proposals from agent (mode = AGENT_PROPOSED).
    /// @dev id => proposed intervalSeconds (0 means no pending proposal).
    mapping(uint256 => uint64) public pendingInterval;

    event Created(
        uint256 indexed id,
        address indexed client,
        address indexed agent,
        bytes32 skillId,
        IntervalMode mode,
        uint128 perCheckIn,
        uint128 perAlert,
        uint64 intervalSeconds,
        uint64 graceSeconds
    );
    event Funded(uint256 indexed id, address indexed funder, uint128 amount, uint128 newBudget);
    event CheckedIn(uint256 indexed id, uint128 amount, uint128 newSpent, uint64 nextDueAt);
    event Alerted(uint256 indexed id, uint128 amount, uint128 newSpent);
    event Paused(uint256 indexed id, uint64 lowBalanceAt);
    event Resumed(uint256 indexed id);
    event Cancelled(uint256 indexed id, address indexed by);
    event Expired(uint256 indexed id);
    event IntervalProposed(uint256 indexed id, uint64 intervalSeconds);
    event IntervalAccepted(uint256 indexed id, uint64 intervalSeconds);
    event Withdrawn(uint256 indexed id, address indexed to, uint128 amount);

    /**
     * @notice Create + fund a new subscription in one tx.
     * @dev msg.value becomes the initial budget. Mode determines who can
     *      call proposeInterval / acceptInterval after creation.
     */
    function create(
        address agent,
        bytes32 skillId,
        IntervalMode mode,
        uint128 perCheckIn,
        uint128 perAlert,
        uint64 intervalSeconds,
        uint64 graceSeconds
    ) external payable returns (uint256 id) {
        require(agent != address(0), "SubscriptionEscrow: agent=0");
        require(agent != msg.sender, "SubscriptionEscrow: client==agent");
        require(perCheckIn > 0, "SubscriptionEscrow: perCheckIn=0");
        require(perAlert >= perCheckIn, "SubscriptionEscrow: perAlert<perCheckIn");
        require(graceSeconds > 0, "SubscriptionEscrow: graceSeconds=0");
        require(msg.value >= perCheckIn, "SubscriptionEscrow: budget<perCheckIn");

        // CLIENT_SET requires a non-zero interval. AGENT_PROPOSED leaves
        // it 0 until an interval is proposed + accepted. AGENT_AUTO doesn't
        // care — agent fires when it wants.
        if (mode == IntervalMode.CLIENT_SET) {
            require(intervalSeconds > 0, "SubscriptionEscrow: CLIENT_SET requires interval");
        }

        id = nextId++;
        uint64 firstDue = mode == IntervalMode.CLIENT_SET ? uint64(block.timestamp) + intervalSeconds : 0;

        subscriptions[id] = Subscription({
            client: msg.sender,
            agent: agent,
            budget: uint128(msg.value),
            spent: 0,
            perCheckIn: perCheckIn,
            perAlert: perAlert,
            intervalSeconds: mode == IntervalMode.CLIENT_SET ? intervalSeconds : 0,
            nextDueAt: firstDue,
            graceSeconds: graceSeconds,
            lowBalanceAt: 0,
            mode: mode,
            status: Status.ACTIVE,
            skillId: skillId
        });

        emit Created(id, msg.sender, agent, skillId, mode, perCheckIn, perAlert, intervalSeconds, graceSeconds);
        emit Funded(id, msg.sender, uint128(msg.value), uint128(msg.value));
    }

    /// @notice Add funds to an existing subscription. Anyone may fund.
    function fund(uint256 id) external payable {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrow: not found");
        require(s.status != Status.CANCELLED && s.status != Status.EXPIRED, "SubscriptionEscrow: terminal");
        require(msg.value > 0, "SubscriptionEscrow: zero fund");

        s.budget += uint128(msg.value);

        // If we were paused for low balance and the new balance covers a
        // check-in, wake up.
        if (s.status == Status.PAUSED && _available(s) >= s.perCheckIn) {
            s.status = Status.ACTIVE;
            s.lowBalanceAt = 0;
            emit Resumed(id);
        }

        emit Funded(id, msg.sender, uint128(msg.value), s.budget);
    }

    /**
     * @notice Agent calls each period to drain `perCheckIn`. Re-pauses if
     *         the next check-in would underflow.
     * @dev For CLIENT_SET / AGENT_PROPOSED, advances nextDueAt. For
     *      AGENT_AUTO, nextDueAt is left at 0 (agent self-paces).
     */
    function checkIn(uint256 id) external nonReentrant {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrow: not found");
        require(msg.sender == s.agent, "SubscriptionEscrow: only agent");

        // Auto-expire if grace lapsed.
        _maybeExpire(s, id);

        require(s.status == Status.ACTIVE, "SubscriptionEscrow: not active");
        require(_available(s) >= s.perCheckIn, "SubscriptionEscrow: insufficient");

        s.spent += s.perCheckIn;

        // Advance scheduling for the modes that enforce one.
        if (s.mode == IntervalMode.CLIENT_SET || s.mode == IntervalMode.AGENT_PROPOSED) {
            if (s.intervalSeconds > 0) {
                s.nextDueAt = uint64(block.timestamp) + s.intervalSeconds;
            }
        }

        emit CheckedIn(id, s.perCheckIn, s.spent, s.nextDueAt);

        // If next check-in would underflow, pause + start grace window.
        if (_available(s) < s.perCheckIn) {
            s.status = Status.PAUSED;
            s.lowBalanceAt = uint64(block.timestamp);
            emit Paused(id, s.lowBalanceAt);
        }

        // Pay agent — last to satisfy CEI.
        (bool ok,) = s.agent.call{value: s.perCheckIn}("");
        require(ok, "SubscriptionEscrow: agent transfer failed");
    }

    /**
     * @notice Agent calls for an out-of-band alert (drain `perAlert`).
     *         Independent of the check-in cadence.
     */
    function alert(uint256 id) external nonReentrant {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrow: not found");
        require(msg.sender == s.agent, "SubscriptionEscrow: only agent");

        _maybeExpire(s, id);

        require(s.status == Status.ACTIVE, "SubscriptionEscrow: not active");
        require(_available(s) >= s.perAlert, "SubscriptionEscrow: insufficient");

        s.spent += s.perAlert;

        emit Alerted(id, s.perAlert, s.spent);

        if (_available(s) < s.perCheckIn) {
            s.status = Status.PAUSED;
            s.lowBalanceAt = uint64(block.timestamp);
            emit Paused(id, s.lowBalanceAt);
        }

        (bool ok,) = s.agent.call{value: s.perAlert}("");
        require(ok, "SubscriptionEscrow: agent transfer failed");
    }

    /// @notice Either party may cancel. Remaining funds become claimable by client.
    function cancel(uint256 id) external {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrow: not found");
        require(msg.sender == s.client || msg.sender == s.agent, "SubscriptionEscrow: not party");
        require(s.status != Status.CANCELLED && s.status != Status.EXPIRED, "SubscriptionEscrow: terminal");

        s.status = Status.CANCELLED;
        emit Cancelled(id, msg.sender);
    }

    /// @notice Agent proposes a check-in interval (AGENT_PROPOSED mode only).
    function proposeInterval(uint256 id, uint64 intervalSeconds) external {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrow: not found");
        require(msg.sender == s.agent, "SubscriptionEscrow: only agent");
        require(s.mode == IntervalMode.AGENT_PROPOSED, "SubscriptionEscrow: wrong mode");
        require(intervalSeconds > 0, "SubscriptionEscrow: interval=0");

        pendingInterval[id] = intervalSeconds;
        emit IntervalProposed(id, intervalSeconds);
    }

    /// @notice Client accepts the agent's proposed interval.
    function acceptInterval(uint256 id) external {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrow: not found");
        require(msg.sender == s.client, "SubscriptionEscrow: only client");
        require(s.mode == IntervalMode.AGENT_PROPOSED, "SubscriptionEscrow: wrong mode");
        uint64 proposed = pendingInterval[id];
        require(proposed > 0, "SubscriptionEscrow: no pending");

        s.intervalSeconds = proposed;
        s.nextDueAt = uint64(block.timestamp) + proposed;
        delete pendingInterval[id];

        emit IntervalAccepted(id, proposed);
    }

    /**
     * @notice Withdraw remaining funds after CANCELLED or EXPIRED.
     * @dev Available = budget - spent. Drains the record by setting
     *      spent = budget (so a re-call is a no-op).
     */
    function withdrawRemaining(uint256 id) external nonReentrant {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrow: not found");
        require(msg.sender == s.client, "SubscriptionEscrow: only client");

        // Allow withdrawing if grace lapsed even if status hasn't been
        // moved yet — auto-expire here for the user's convenience.
        _maybeExpire(s, id);

        require(
            s.status == Status.CANCELLED || s.status == Status.EXPIRED,
            "SubscriptionEscrow: not terminal"
        );

        uint128 remaining = _available(s);
        require(remaining > 0, "SubscriptionEscrow: nothing to withdraw");

        s.spent = s.budget; // mark fully drained

        emit Withdrawn(id, s.client, remaining);

        (bool ok,) = s.client.call{value: remaining}("");
        require(ok, "SubscriptionEscrow: client transfer failed");
    }

    // ─── views ───────────────────────────────────────────────────────────────

    /// @notice Read a subscription as a memory struct.
    /// @dev The auto-generated `subscriptions(id)` getter returns a 13-tuple
    ///      that overflows EVM stack-depth when consumers destructure it
    ///      without via-IR. This wrapper returns the struct in memory so
    ///      callers (tests + external clients) get a single-slot reference.
    function getSubscription(uint256 id) external view returns (Subscription memory) {
        return subscriptions[id];
    }

    function available(uint256 id) external view returns (uint128) {
        return _available(subscriptions[id]);
    }

    function isExpired(uint256 id) external view returns (bool) {
        Subscription storage s = subscriptions[id];
        if (s.status == Status.EXPIRED) return true;
        if (s.status != Status.PAUSED) return false;
        return block.timestamp >= uint256(s.lowBalanceAt) + uint256(s.graceSeconds);
    }

    // ─── internals ───────────────────────────────────────────────────────────

    function _available(Subscription storage s) internal view returns (uint128) {
        return s.budget - s.spent;
    }

    /// @dev If we're in PAUSED and grace has lapsed, move to EXPIRED.
    function _maybeExpire(Subscription storage s, uint256 id) internal {
        if (s.status == Status.PAUSED && block.timestamp >= uint256(s.lowBalanceAt) + uint256(s.graceSeconds)) {
            s.status = Status.EXPIRED;
            emit Expired(id);
        }
    }

    /// @notice Receive funds for a subscription via plain transfer (id encoded in calldata).
    /// @dev Defensive: reject empty calls so accidental sends don't get stuck.
    receive() external payable {
        revert("SubscriptionEscrow: use fund(id)");
    }
}
