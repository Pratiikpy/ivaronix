// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IReceiptRegistryView
 * @notice Minimal view shape SubscriptionEscrowV2 needs for the cross-check.
 *         Compatible with both ReceiptRegistry V1 and V2 (both expose
 *         `receipts(uint256)` returning the same tuple).
 */
interface IReceiptRegistryView {
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
        );

    function nextId() external view returns (uint256);
}

/**
 * @title SubscriptionEscrowV2
 * @notice Recurring agent-billing escrow. V2 closes the AGENT_AUTO loose-
 *         accountability footgun (planning-003 §A.5.9 · WT 26) by requiring
 *         every check-in to bind to a real Action Receipt anchored on
 *         ReceiptRegistry.
 *
 * @dev V1 let an agent on AGENT_AUTO mode call `checkIn()` with no
 *      enforcement — they could miss 30 days, then fire 30 check-ins in a
 *      row, drain the budget, and never deliver real value. V2 requires
 *      every check-in to reference an `attestationReceiptId` from
 *      ReceiptRegistry. The receipt's `agentAddress` must match the
 *      subscription's `agent`, the receipt must exist on chain, and the
 *      receipt's timestamp must be recent.
 *
 *      Threat model:
 *      - Defends against: AGENT_AUTO drain without delivery. Every check-in
 *        binds to a verifiable receipt. No receipt → no payment.
 *      - Defends against: cross-agent spoofing. The receipt's signed agent
 *        address must equal the subscription's agent.
 *      - Defends against: receipt replay. `usedReceipts[id]` marks a
 *        receipt id as consumed after one successful check-in.
 *      - Does NOT defend against: an agent producing a receipt on chain
 *        without doing real work. The receipt anchor proves that *some*
 *        signed work happened, not that the work was high-quality. The
 *        Efficiency Game (planning-003 §A.4.4) layers quality conditioning
 *        on top.
 *      - Does NOT defend against: a compromised ReceiptRegistry. The
 *        registry address is pinned at construction; new registry → new
 *        SubscriptionEscrowV2 deploy.
 *
 *      Migration: V1 stays live for legacy subscriptions (chain history
 *      immutable). V2 ships as a new contract; clients create new
 *      subscriptions on V2 going forward.
 */
contract SubscriptionEscrowV2 is ReentrancyGuard {
    /// @notice Who decides the period between check-ins.
    enum IntervalMode {
        CLIENT_SET,
        AGENT_PROPOSED,
        AGENT_AUTO
    }

    enum Status {
        ACTIVE,
        PAUSED,
        CANCELLED,
        EXPIRED
    }

    struct Subscription {
        address client;
        address agent;
        uint128 budget;
        uint128 spent;
        uint128 perCheckIn;
        uint128 perAlert;
        uint64 intervalSeconds;
        uint64 nextDueAt;
        uint64 graceSeconds;
        uint64 lowBalanceAt;
        IntervalMode mode;
        Status status;
        bytes32 skillId;
    }

    /// @notice ReceiptRegistry address pinned at construction. Cannot change.
    address public immutable receiptRegistry;

    /// @notice Maximum age (seconds) of an attestationReceiptId at check-in time.
    /// Receipts older than this are rejected. Default 24h.
    uint64 public constant MAX_RECEIPT_AGE = 86400;

    mapping(uint256 => Subscription) public subscriptions;
    uint256 public nextId;
    mapping(uint256 => uint64) public pendingInterval;

    /// @notice receipt id => true once consumed by a check-in. Prevents
    /// replay across multiple check-ins on the same subscription.
    mapping(uint256 => bool) public usedReceipts;

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
    event CheckedIn(
        uint256 indexed id,
        uint128 amount,
        uint128 newSpent,
        uint64 nextDueAt,
        uint256 indexed attestationReceiptId
    );
    event Alerted(uint256 indexed id, uint128 amount, uint128 newSpent, uint256 indexed attestationReceiptId);
    event Paused(uint256 indexed id, uint64 lowBalanceAt);
    event Resumed(uint256 indexed id);
    event Cancelled(uint256 indexed id, address indexed by);
    event Expired(uint256 indexed id);
    event IntervalProposed(uint256 indexed id, uint64 intervalSeconds);
    event IntervalAccepted(uint256 indexed id, uint64 intervalSeconds);
    event Withdrawn(uint256 indexed id, address indexed to, uint128 amount);

    constructor(address receiptRegistry_) {
        require(receiptRegistry_ != address(0), "SubscriptionEscrowV2: zero registry");
        receiptRegistry = receiptRegistry_;
    }

    function create(
        address agent,
        bytes32 skillId,
        IntervalMode mode,
        uint128 perCheckIn,
        uint128 perAlert,
        uint64 intervalSeconds,
        uint64 graceSeconds
    ) external payable returns (uint256 id) {
        require(agent != address(0), "SubscriptionEscrowV2: agent=0");
        require(agent != msg.sender, "SubscriptionEscrowV2: client==agent");
        require(perCheckIn > 0, "SubscriptionEscrowV2: perCheckIn=0");
        require(perAlert >= perCheckIn, "SubscriptionEscrowV2: perAlert<perCheckIn");
        require(graceSeconds > 0, "SubscriptionEscrowV2: graceSeconds=0");
        require(msg.value >= perCheckIn, "SubscriptionEscrowV2: budget<perCheckIn");

        if (mode == IntervalMode.CLIENT_SET) {
            require(intervalSeconds > 0, "SubscriptionEscrowV2: CLIENT_SET requires interval");
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

    function fund(uint256 id) external payable {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrowV2: not found");
        require(s.status != Status.CANCELLED && s.status != Status.EXPIRED, "SubscriptionEscrowV2: terminal");
        require(msg.value > 0, "SubscriptionEscrowV2: zero fund");

        s.budget += uint128(msg.value);
        if (s.status == Status.PAUSED && _available(s) >= s.perCheckIn) {
            s.status = Status.ACTIVE;
            s.lowBalanceAt = 0;
            emit Resumed(id);
        }
        emit Funded(id, msg.sender, uint128(msg.value), s.budget);
    }

    /**
     * @notice V2 check-in · requires attestationReceiptId binding to a real
     *         Action Receipt on ReceiptRegistry.
     *
     *         Cross-checks (all must pass):
     *         1. Receipt id is below ReceiptRegistry.nextId() (exists).
     *         2. Receipt's agentAddress == subscription's agent (no spoof).
     *         3. Receipt's timestamp is within MAX_RECEIPT_AGE of block.timestamp.
     *         4. Receipt id has not been used by a prior check-in (no replay).
     */
    function checkIn(uint256 id, uint256 attestationReceiptId) external nonReentrant {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrowV2: not found");
        require(msg.sender == s.agent, "SubscriptionEscrowV2: only agent");
        require(!usedReceipts[attestationReceiptId], "SubscriptionEscrowV2: receipt already used");

        _verifyReceipt(attestationReceiptId, s.agent);

        _maybeExpire(s, id);
        require(s.status == Status.ACTIVE, "SubscriptionEscrowV2: not active");
        require(_available(s) >= s.perCheckIn, "SubscriptionEscrowV2: insufficient");

        usedReceipts[attestationReceiptId] = true;
        s.spent += s.perCheckIn;

        if (s.mode == IntervalMode.CLIENT_SET || s.mode == IntervalMode.AGENT_PROPOSED) {
            if (s.intervalSeconds > 0) {
                s.nextDueAt = uint64(block.timestamp) + s.intervalSeconds;
            }
        }

        emit CheckedIn(id, s.perCheckIn, s.spent, s.nextDueAt, attestationReceiptId);

        if (_available(s) < s.perCheckIn) {
            s.status = Status.PAUSED;
            s.lowBalanceAt = uint64(block.timestamp);
            emit Paused(id, s.lowBalanceAt);
        }

        (bool ok,) = s.agent.call{value: s.perCheckIn}("");
        require(ok, "SubscriptionEscrowV2: agent transfer failed");
    }

    /**
     * @notice V2 alert · same receipt-cross-check requirement as check-in.
     */
    function alert(uint256 id, uint256 attestationReceiptId) external nonReentrant {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrowV2: not found");
        require(msg.sender == s.agent, "SubscriptionEscrowV2: only agent");
        require(!usedReceipts[attestationReceiptId], "SubscriptionEscrowV2: receipt already used");

        _verifyReceipt(attestationReceiptId, s.agent);

        _maybeExpire(s, id);
        require(s.status == Status.ACTIVE, "SubscriptionEscrowV2: not active");
        require(_available(s) >= s.perAlert, "SubscriptionEscrowV2: insufficient");

        usedReceipts[attestationReceiptId] = true;
        s.spent += s.perAlert;

        emit Alerted(id, s.perAlert, s.spent, attestationReceiptId);

        if (_available(s) < s.perCheckIn) {
            s.status = Status.PAUSED;
            s.lowBalanceAt = uint64(block.timestamp);
            emit Paused(id, s.lowBalanceAt);
        }

        (bool ok,) = s.agent.call{value: s.perAlert}("");
        require(ok, "SubscriptionEscrowV2: agent transfer failed");
    }

    function cancel(uint256 id) external {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrowV2: not found");
        require(msg.sender == s.client || msg.sender == s.agent, "SubscriptionEscrowV2: not party");
        require(s.status != Status.CANCELLED && s.status != Status.EXPIRED, "SubscriptionEscrowV2: terminal");
        s.status = Status.CANCELLED;
        emit Cancelled(id, msg.sender);
    }

    function withdrawRemaining(uint256 id) external nonReentrant {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrowV2: not found");
        require(msg.sender == s.client, "SubscriptionEscrowV2: only client");
        require(s.status == Status.CANCELLED || s.status == Status.EXPIRED, "SubscriptionEscrowV2: not terminal");

        uint128 remaining = _available(s);
        require(remaining > 0, "SubscriptionEscrowV2: nothing to withdraw");
        s.spent += remaining;

        emit Withdrawn(id, s.client, remaining);

        (bool ok,) = s.client.call{value: remaining}("");
        require(ok, "SubscriptionEscrowV2: client refund failed");
    }

    function proposeInterval(uint256 id, uint64 intervalSeconds) external {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrowV2: not found");
        require(msg.sender == s.agent, "SubscriptionEscrowV2: only agent");
        require(s.mode == IntervalMode.AGENT_PROPOSED, "SubscriptionEscrowV2: wrong mode");
        require(intervalSeconds > 0, "SubscriptionEscrowV2: zero interval");
        pendingInterval[id] = intervalSeconds;
        emit IntervalProposed(id, intervalSeconds);
    }

    function acceptInterval(uint256 id) external {
        Subscription storage s = subscriptions[id];
        require(s.client != address(0), "SubscriptionEscrowV2: not found");
        require(msg.sender == s.client, "SubscriptionEscrowV2: only client");
        require(s.mode == IntervalMode.AGENT_PROPOSED, "SubscriptionEscrowV2: wrong mode");
        uint64 proposed = pendingInterval[id];
        require(proposed > 0, "SubscriptionEscrowV2: nothing to accept");
        s.intervalSeconds = proposed;
        s.nextDueAt = uint64(block.timestamp) + proposed;
        pendingInterval[id] = 0;
        emit IntervalAccepted(id, proposed);
    }

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
        return s.lowBalanceAt > 0 && block.timestamp > s.lowBalanceAt + s.graceSeconds;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _verifyReceipt(uint256 receiptId, address expectedAgent) internal view {
        IReceiptRegistryView reg = IReceiptRegistryView(receiptRegistry);
        require(receiptId < reg.nextId(), "SubscriptionEscrowV2: receipt does not exist");
        (, , , address agentAddress, uint64 timestamp,) = reg.receipts(receiptId);
        require(agentAddress == expectedAgent, "SubscriptionEscrowV2: receipt agent mismatch");
        require(
            timestamp != 0 && block.timestamp <= uint256(timestamp) + uint256(MAX_RECEIPT_AGE),
            "SubscriptionEscrowV2: receipt too old"
        );
    }

    function _available(Subscription storage s) internal view returns (uint128) {
        return s.budget - s.spent;
    }

    function _maybeExpire(Subscription storage s, uint256 id) internal {
        if (s.status == Status.PAUSED && s.lowBalanceAt > 0
                && block.timestamp > s.lowBalanceAt + s.graceSeconds) {
            s.status = Status.EXPIRED;
            emit Expired(id);
        }
    }
}
