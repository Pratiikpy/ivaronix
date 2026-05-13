// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {SkillRegistryV2} from "./SkillRegistryV2.sol";

/**
 * @title SkillPricing
 * @notice Per-skill price + creator/treasury split rates for paid skill runs
 *         (FINAL_BUILD_PLAN.md §3 D-2 · Block A.1).
 *
 * @dev `SkillRegistryV2` is immutable post-publish per
 *      `.claude/rules/contracts.md` ("V2 = new contract at new address,
 *      NOT upgrade"). Skill prices must be UPDATABLE so creators can
 *      adjust to market conditions, run discounts, sunset skills.
 *      This separate `SkillPricing` contract stores the mutable price
 *      mappings while keeping `SkillRegistryV2` immutable.
 *
 *      Authorization is bound to `SkillRegistryV2.ownerOf(skillId)` —
 *      only the skill's current owner can set its price. Ownership
 *      transfers in V2 transfer pricing authority too (consistent semantics).
 *
 *      Price storage shape:
 *      - `priceWei[skillId]`: cost per run in wei (0 = free skill)
 *      - `creatorBps[skillId]`: creator's share in basis points (5000-9500)
 *      - `treasuryBps[skillId]`: treasury share (sums to 10000 with creatorBps)
 *
 *      Studio's `/api/run` reads these three values at run-time to compute
 *      the 402-style payment ask. The user's wagmi call to
 *      `SkillRunPayment.paySkillRun(...)` passes these exact values, which
 *      the on-chain contract re-validates. Two layers of bps validation
 *      (off-chain manifest, on-chain pricing, on-chain payment) means a
 *      bug in any one layer fails closed.
 *
 *      Threat model:
 *      - Defends against: unauthorized price change. Only
 *        `SkillRegistryV2.ownerOf(skillId)` can update pricing.
 *      - Defends against: invalid bps (sum != 10000 or out-of-range).
 *        Two-layer validation: setPrice enforces; SkillRunPayment
 *        re-enforces at pay-time.
 *      - Defends against: pricing an unpublished skillId. The owner-check
 *        rejects calls where `ownerOf(skillId) == address(0)`.
 *      - Does NOT defend against: skill owner setting an unreasonable
 *        price (e.g., 1000 OG per run). Marketplace UI surfaces price
 *        boundaries; users self-select.
 *      - Does NOT defend against: front-running of `setPrice`. A user
 *        could see a pending price change and race to pay at the old
 *        price. Mitigation: change cadence is low, and the receipt
 *        records the actual bps paid (not the manifest's claim).
 *
 *      Migration: v1 ships a single contract per network. v1.1 may add
 *      time-locked price updates (24h delay before new price takes
 *      effect) to defeat front-running.
 *
 *      AgentPay audit §15 — patterns borrowed: bps sum invariant, no
 *      Ownable rugs (price authority follows registry ownership, not
 *      a separate admin).
 */
contract SkillPricing {
    /* ------------------------------------------------------------------ */
    /*                              CONSTANTS                              */
    /* ------------------------------------------------------------------ */

    uint16 public constant CREATOR_BPS_FLOOR = 5000;
    uint16 public constant CREATOR_BPS_CEILING = 9500;
    uint16 public constant BPS_TOTAL = 10000;

    /* ------------------------------------------------------------------ */
    /*                              IMMUTABLE                              */
    /* ------------------------------------------------------------------ */

    /// @notice Skill registry that authorizes pricing actions.
    SkillRegistryV2 public immutable skillRegistry;

    /* ------------------------------------------------------------------ */
    /*                               STORAGE                               */
    /* ------------------------------------------------------------------ */

    /// @notice Per-skill price in wei (0 = free skill, allowed).
    mapping(bytes32 => uint256) public priceWei;

    /// @notice Per-skill creator share in basis points.
    mapping(bytes32 => uint16) public creatorBps;

    /// @notice Per-skill treasury share in basis points.
    mapping(bytes32 => uint16) public treasuryBps;

    /// @notice True if a price was ever set for this skillId.
    mapping(bytes32 => bool) public isPriced;

    /* ------------------------------------------------------------------ */
    /*                                EVENTS                               */
    /* ------------------------------------------------------------------ */

    event PriceUpdated(
        bytes32 indexed skillId,
        address indexed by,
        uint256 priceWei,
        uint16 creatorBps,
        uint16 treasuryBps
    );

    event PriceUnset(bytes32 indexed skillId, address indexed by);

    /* ------------------------------------------------------------------ */
    /*                              CONSTRUCTOR                            */
    /* ------------------------------------------------------------------ */

    /// @param _skillRegistry The canonical SkillRegistryV2 contract.
    constructor(address _skillRegistry) {
        require(_skillRegistry != address(0), "registry zero");
        skillRegistry = SkillRegistryV2(_skillRegistry);
    }

    /* ------------------------------------------------------------------ */
    /*                            SET / UNSET PRICE                        */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Set the price + split rates for a skill.
     * @param skillId      keccak256 of the canonical skill ID.
     * @param _priceWei    Price per run in wei (0 = free, valid).
     * @param _creatorBps  Creator's share in basis points (5000-9500).
     * @param _treasuryBps Treasury share (must equal 10000 - creatorBps).
     */
    function setPrice(
        bytes32 skillId,
        uint256 _priceWei,
        uint16 _creatorBps,
        uint16 _treasuryBps
    ) external {
        address owner = skillRegistry.ownerOf(skillId);
        require(owner != address(0), "skill not published");
        require(msg.sender == owner, "not skill owner");
        require(uint32(_creatorBps) + uint32(_treasuryBps) == BPS_TOTAL, "bps sum");
        require(_creatorBps >= CREATOR_BPS_FLOOR, "creator bps below floor");
        require(_creatorBps <= CREATOR_BPS_CEILING, "creator bps above ceiling");

        priceWei[skillId] = _priceWei;
        creatorBps[skillId] = _creatorBps;
        treasuryBps[skillId] = _treasuryBps;
        isPriced[skillId] = true;

        emit PriceUpdated(skillId, msg.sender, _priceWei, _creatorBps, _treasuryBps);
    }

    /**
     * @notice Mark a skill as not-for-sale (un-prices it).
     *         Cheaper than setting price to MAX_UINT or 0 because the
     *         marketplace UI can filter by `isPriced == true`.
     */
    function unsetPrice(bytes32 skillId) external {
        address owner = skillRegistry.ownerOf(skillId);
        require(owner != address(0), "skill not published");
        require(msg.sender == owner, "not skill owner");
        require(isPriced[skillId], "not priced");

        delete priceWei[skillId];
        delete creatorBps[skillId];
        delete treasuryBps[skillId];
        isPriced[skillId] = false;

        emit PriceUnset(skillId, msg.sender);
    }

    /* ------------------------------------------------------------------ */
    /*                              VIEW HELPERS                           */
    /* ------------------------------------------------------------------ */

    /// @notice Return all pricing data for a skill in one call.
    function getPricing(bytes32 skillId)
        external
        view
        returns (uint256 price, uint16 cBps, uint16 tBps, bool priced)
    {
        return (priceWei[skillId], creatorBps[skillId], treasuryBps[skillId], isPriced[skillId]);
    }
}
