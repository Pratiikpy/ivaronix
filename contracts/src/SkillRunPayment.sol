// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SkillRunPayment
 * @notice Native-OG payment + per-skill fee-split for Ivaronix skill runs
 *         (FINAL_BUILD_PLAN.md §3 D-1 · Block A).
 *
 * @dev The user pays native OG to `paySkillRun(receiptRoot, creator,
 *      creatorBps, treasuryBps)` BEFORE the inference pipeline runs.
 *      The contract:
 *        1. Validates split rates: `creatorBps + treasuryBps == 10000`,
 *           creator share in [5000, 9500] basis points (50%-95%).
 *        2. Records the run keyed by `receiptRoot` (the canonical hash
 *           of the receipt body) so a verifier can replay the payment-
 *           to-receipt binding. See `packages/receipts/src/verify.ts`
 *           5-check binding rule.
 *        3. Accumulates per-creator + treasury balances for pull-pattern
 *           withdrawal.
 *        4. Tracks lifetime earnings (monotonic, never decremented on
 *           withdrawal) for the marketplace's creator dashboards.
 *
 *      The receipt's `billing.payment.txHash` field references the tx
 *      that called this contract. The verifier checks: (a) tx exists,
 *      (b) tx.to == this contract, (c) tx.from == receipt's claimed
 *      payer, (d) tx.value == receipt's paidOg, (e) the SkillRunPaid
 *      event's receiptRoot matches the receipt's canonical hash. All 5
 *      must pass for FULLY VERIFIED status.
 *
 *      Threat model:
 *      - Defends against: fake payment claims on the receipt.
 *        Verifier rejects any receipt whose payment.txHash doesn't
 *        bind on chain.
 *      - Defends against: creator/treasury fee underpayment. Split
 *        bps are validated AT PAY TIME on chain, not derived from
 *        off-chain manifest.
 *      - Defends against: re-paying the same receiptRoot twice. The
 *        `paidRuns[receiptRoot].payer != address(0)` invariant means
 *        each receiptRoot can only be paid once.
 *      - Defends against: reentrancy on withdrawal. Pull pattern with
 *        state-zero-before-transfer + nonReentrant modifier.
 *      - Defends against: griefing via failed recipient. Pull pattern
 *        means each recipient withdraws independently; one bad
 *        recipient cannot brick others.
 *      - Defends against: admin rugging fees instantly. v1 ships with
 *        Ownable2Step (two-step transfer) for owner rotation; the
 *        TREASURY_BPS_FLOOR + creator-share-floor invariants are
 *        immutable constants in the contract.
 *      - Does NOT defend against: operator colluding with creator
 *        (e.g., operator submits inference, creator rebates the
 *        operator off-chain). Trust model relies on on-chain
 *        reputation (AgentPassportINFTV2 trust scores) to surface
 *        repeat offenders.
 *      - Does NOT defend against: refund DoS by a malicious creator
 *        who drains their balance within the 24h refund window.
 *        After creator withdraws, refund is impossible — the value
 *        has left the contract. v1.1 may add a withdrawal timelock.
 *      - Does NOT defend against: operator key compromise. If the
 *        contract owner's private key leaks, the attacker can drain
 *        the treasury balance. Mitigation: owner rotation via
 *        Ownable2Step; future treasury → multisig migration (v1.1).
 *
 *      Migration: v1 ships single contract per network (Galileo +
 *      Aristotle). v1.1 may add per-skill custom bps ranges,
 *      ERC-20 token support, escrow flow, automated refund detection.
 *      Per-skill prices live in a separate `SkillPricing.sol` contract
 *      to keep this contract immutable.
 *
 *      AgentPay patterns borrowed (verified §15 audit):
 *      - `bytes32 receiptRoot` event-binding (their `bytes32 jobId`).
 *      - Basis-point split invariant `sum == 10000`.
 *      - SDK-side event-log parsing post-write.
 *      AgentPay patterns explicitly avoided:
 *      - Custodial relayer (we keep user-wallet signing).
 *      - Push-pattern fan-out (we use pull-pattern).
 *      - Mock-fallback SDK methods (this contract is the source of truth).
 */
contract SkillRunPayment is Ownable2Step, ReentrancyGuard {
    /* ------------------------------------------------------------------ */
    /*                              CONSTANTS                              */
    /* ------------------------------------------------------------------ */

    /// @notice Minimum creator share in basis points (50%).
    uint16 public constant CREATOR_BPS_FLOOR = 5000;
    /// @notice Maximum creator share in basis points (95%) —
    ///         ensures the protocol always retains 5% minimum.
    uint16 public constant CREATOR_BPS_CEILING = 9500;
    /// @notice Sum-invariant for split rates.
    uint16 public constant BPS_TOTAL = 10000;
    /// @notice Refund timelock: payer waits 24h before refund is
    ///         possible. Gives creator a delivery window.
    uint64 public constant REFUND_TIMELOCK = 24 hours;

    /* ------------------------------------------------------------------ */
    /*                                TYPES                                */
    /* ------------------------------------------------------------------ */

    struct PaidRun {
        address payer;            // who paid (msg.sender at pay time)
        address creator;          // who receives creator share
        uint128 amount;           // total paid (wei)
        uint128 creatorShare;     // creator's cut at pay time
        uint128 treasuryShare;    // treasury's cut at pay time
        uint64 paidAt;            // block timestamp at pay time
        bool refunded;            // true once refundFailedRun is called
    }

    /* ------------------------------------------------------------------ */
    /*                               STORAGE                               */
    /* ------------------------------------------------------------------ */

    /// @notice Per-receipt payment record (immutable post-pay except refund flag).
    mapping(bytes32 => PaidRun) public paidRuns;

    /// @notice Pending withdrawable balance per creator (pull pattern).
    mapping(address => uint256) public creatorBalance;

    /// @notice Pending withdrawable treasury balance.
    uint256 public treasuryBalance;

    /// @notice Monotonic lifetime earnings per creator (only increments).
    ///         Marketplace dashboards read this for "lifetime earned" display.
    mapping(address => uint256) public creatorLifetimeEarned;

    /// @notice Monotonic lifetime treasury earnings.
    uint256 public treasuryLifetimeEarned;

    /* ------------------------------------------------------------------ */
    /*                                EVENTS                               */
    /* ------------------------------------------------------------------ */

    /// @notice Emitted on every successful paySkillRun.
    /// @dev The verifier reads this event's receiptRoot to confirm the
    ///      receipt's `billing.payment` block binds correctly on chain.
    event SkillRunPaid(
        bytes32 indexed receiptRoot,
        address indexed payer,
        address indexed creator,
        uint256 amount,
        uint256 creatorShare,
        uint256 treasuryShare,
        uint16 creatorBps,
        uint16 treasuryBps,
        uint64 timestamp
    );

    /// @notice Emitted on creator or treasury withdrawal.
    event Withdrawn(address indexed by, uint256 amount, bool isTreasury);

    /// @notice Emitted on admin refund of a failed run.
    event Refunded(bytes32 indexed receiptRoot, address indexed payer, uint256 amount, uint64 timestamp);

    /* ------------------------------------------------------------------ */
    /*                              CONSTRUCTOR                            */
    /* ------------------------------------------------------------------ */

    /// @param admin Initial owner (treasury withdrawal + refund authority).
    constructor(address admin) Ownable(admin) {
        require(admin != address(0), "admin zero");
    }

    /* ------------------------------------------------------------------ */
    /*                            PAY SKILL RUN                            */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Pay native OG for a skill run, splitting between creator
     *         and treasury per the supplied bps.
     * @param receiptRoot Canonical hash of the receipt body (binds the
     *                    payment to a specific receipt; verifier replays
     *                    this binding).
     * @param creator     Creator wallet receiving creatorBps share.
     * @param creatorBps  Creator's share in basis points (5000 to 9500).
     * @param treasuryBps Treasury's share in basis points
     *                    (500 to 5000; must equal 10000 - creatorBps).
     */
    function paySkillRun(
        bytes32 receiptRoot,
        address creator,
        uint16 creatorBps,
        uint16 treasuryBps
    ) external payable {
        require(msg.value > 0, "no value");
        require(creator != address(0), "creator zero");
        require(receiptRoot != bytes32(0), "receiptRoot zero");
        require(uint32(creatorBps) + uint32(treasuryBps) == BPS_TOTAL, "bps sum");
        require(creatorBps >= CREATOR_BPS_FLOOR, "creator bps below floor");
        require(creatorBps <= CREATOR_BPS_CEILING, "creator bps above ceiling");
        require(paidRuns[receiptRoot].payer == address(0), "already paid");

        uint256 treasuryShare = (msg.value * uint256(treasuryBps)) / uint256(BPS_TOTAL);
        uint256 creatorShare = msg.value - treasuryShare;

        // Defensive: shouldn't be possible given the require above, but cheap to enforce.
        require(creatorShare + treasuryShare == msg.value, "split math");

        paidRuns[receiptRoot] = PaidRun({
            payer: msg.sender,
            creator: creator,
            amount: uint128(msg.value),
            creatorShare: uint128(creatorShare),
            treasuryShare: uint128(treasuryShare),
            paidAt: uint64(block.timestamp),
            refunded: false
        });

        creatorBalance[creator] += creatorShare;
        creatorLifetimeEarned[creator] += creatorShare;
        treasuryBalance += treasuryShare;
        treasuryLifetimeEarned += treasuryShare;

        emit SkillRunPaid(
            receiptRoot,
            msg.sender,
            creator,
            msg.value,
            creatorShare,
            treasuryShare,
            creatorBps,
            treasuryBps,
            uint64(block.timestamp)
        );
    }

    /* ------------------------------------------------------------------ */
    /*                          PULL WITHDRAWALS                           */
    /* ------------------------------------------------------------------ */

    /// @notice Creator withdraws their accumulated balance.
    /// @dev    Pull pattern: state-zero-before-transfer + nonReentrant.
    function withdrawCreator() external nonReentrant {
        uint256 amount = creatorBalance[msg.sender];
        require(amount > 0, "nothing to withdraw");
        creatorBalance[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer fail");
        emit Withdrawn(msg.sender, amount, false);
    }

    /// @notice Owner (treasury role) withdraws accumulated protocol fees.
    function withdrawTreasury() external onlyOwner nonReentrant {
        uint256 amount = treasuryBalance;
        require(amount > 0, "nothing to withdraw");
        treasuryBalance = 0;
        (bool ok, ) = payable(owner()).call{value: amount}("");
        require(ok, "transfer fail");
        emit Withdrawn(owner(), amount, true);
    }

    /* ------------------------------------------------------------------ */
    /*                              REFUND                                 */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Admin-only refund of a failed run. Only callable after
     *         REFUND_TIMELOCK has elapsed since payment. Refund is only
     *         possible if creator + treasury balances still cover the
     *         full amount (i.e., neither has withdrawn yet).
     * @dev    v1 is operator-triggered. v1.1 may add runtime-detected
     *         automated refund.
     * @param receiptRoot The receipt root of the failed run.
     */
    function refundFailedRun(bytes32 receiptRoot) external onlyOwner nonReentrant {
        PaidRun storage run = paidRuns[receiptRoot];
        require(run.payer != address(0), "no payment");
        require(!run.refunded, "already refunded");
        require(block.timestamp >= uint256(run.paidAt) + uint256(REFUND_TIMELOCK), "timelock not elapsed");
        require(creatorBalance[run.creator] >= run.creatorShare, "creator already withdrew");
        require(treasuryBalance >= run.treasuryShare, "treasury already withdrew");

        run.refunded = true;
        creatorBalance[run.creator] -= run.creatorShare;
        treasuryBalance -= run.treasuryShare;
        // Note: creatorLifetimeEarned and treasuryLifetimeEarned are NOT
        // decremented on refund — they're monotonic by design (a refunded
        // run still counts as "creator handled a payment that later failed";
        // the dashboard should surface refunded count separately if needed).

        (bool ok, ) = payable(run.payer).call{value: run.amount}("");
        require(ok, "refund fail");

        emit Refunded(receiptRoot, run.payer, run.amount, uint64(block.timestamp));
    }

    /* ------------------------------------------------------------------ */
    /*                            VIEW HELPERS                             */
    /* ------------------------------------------------------------------ */

    /// @notice Returns true if a paid run exists for this receiptRoot.
    function isPaid(bytes32 receiptRoot) external view returns (bool) {
        return paidRuns[receiptRoot].payer != address(0);
    }

    /// @notice Returns the timestamp after which a refund becomes possible.
    ///         Returns 0 if no payment exists for this receiptRoot.
    function refundUnlockAt(bytes32 receiptRoot) external view returns (uint64) {
        PaidRun memory run = paidRuns[receiptRoot];
        if (run.payer == address(0)) return 0;
        return run.paidAt + REFUND_TIMELOCK;
    }
}
