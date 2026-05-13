// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// TEST KEYS ONLY · planning-003 §A.3.7. Deterministic hex-pattern fills.
import {Test} from "forge-std/Test.sol";
import {SkillPricing} from "../src/SkillPricing.sol";
import {SkillRegistryV2} from "../src/SkillRegistryV2.sol";

contract SkillPricingTest is Test {
    SkillRegistryV2 public registry;
    SkillPricing public pricing;

    address constant OWNER = 0xA1A1AAA1A1A1A1a1a1a1A1A1a1A1A1A1A1A1a1a1;
    address constant CREATOR1 = 0xC0FfEe0000C0FFeE0000C0Ffee0000C0ffeE0000;
    address constant CREATOR2 = 0xC1C1c1c1C1C1C1c1c1C1C1C1c1C1C1C1c1C1c1c1;
    address constant RANDO = 0xDead000000dEAD000000DeaD000000dEAd000000;

    bytes32 constant SKILL1 = keccak256("skill:private-doc-review");
    bytes32 constant SKILL2 = keccak256("skill:content-pitch-review");
    bytes32 constant UNPUBLISHED = keccak256("skill:unpublished");

    function setUp() public {
        bytes32[] memory reservedIds = new bytes32[](0);
        address[] memory reservedOwners = new address[](0);
        vm.prank(OWNER);
        registry = new SkillRegistryV2(OWNER, reservedIds, reservedOwners);
        pricing = new SkillPricing(address(registry));

        // CREATOR1 publishes SKILL1
        vm.prank(CREATOR1);
        registry.publishVersion(SKILL1, bytes32("v1.0.0"), bytes32("manifest-1"));
        // CREATOR2 publishes SKILL2
        vm.prank(CREATOR2);
        registry.publishVersion(SKILL2, bytes32("v1.0.0"), bytes32("manifest-2"));
    }

    /* ============================================================== */
    /*                  TEST 1-3 · HAPPY PATH SET                      */
    /* ============================================================== */

    function test_P1_SetPrice_HappyPath() public {
        vm.prank(CREATOR1);
        pricing.setPrice(SKILL1, 0.001 ether, 9000, 1000);

        assertEq(pricing.priceWei(SKILL1), 0.001 ether);
        assertEq(uint256(pricing.creatorBps(SKILL1)), 9000);
        assertEq(uint256(pricing.treasuryBps(SKILL1)), 1000);
        assertTrue(pricing.isPriced(SKILL1));
    }

    function test_P2_SetPrice_FreeSkill() public {
        vm.prank(CREATOR1);
        pricing.setPrice(SKILL1, 0, 5000, 5000);
        assertEq(pricing.priceWei(SKILL1), 0);
        assertTrue(pricing.isPriced(SKILL1));
    }

    function test_P3_SetPrice_GetPricingBundle() public {
        vm.prank(CREATOR1);
        pricing.setPrice(SKILL1, 1 ether, 7500, 2500);

        (uint256 p, uint16 c, uint16 t, bool priced) = pricing.getPricing(SKILL1);
        assertEq(p, 1 ether);
        assertEq(uint256(c), 7500);
        assertEq(uint256(t), 2500);
        assertTrue(priced);
    }

    /* ============================================================== */
    /*                TEST 4-7 · AUTH + REGISTRY GATING                */
    /* ============================================================== */

    function test_P4_SetPrice_RejectsNonOwner() public {
        vm.prank(RANDO);
        vm.expectRevert(bytes("not skill owner"));
        pricing.setPrice(SKILL1, 0.001 ether, 9000, 1000);
    }

    function test_P5_SetPrice_RejectsUnpublishedSkill() public {
        vm.prank(CREATOR1);
        vm.expectRevert(bytes("skill not published"));
        pricing.setPrice(UNPUBLISHED, 0.001 ether, 9000, 1000);
    }

    function test_P6_SetPrice_RejectsOtherSkillOwner() public {
        // CREATOR2 owns SKILL2; CREATOR1 owns SKILL1
        vm.prank(CREATOR2);
        vm.expectRevert(bytes("not skill owner"));
        pricing.setPrice(SKILL1, 0.001 ether, 9000, 1000);
    }

    function test_P7_SetPrice_OwnershipTransferTransfersAuthority() public {
        // CREATOR1 sets initial price
        vm.prank(CREATOR1);
        pricing.setPrice(SKILL1, 0.001 ether, 9000, 1000);

        // CREATOR1 transfers ownership of SKILL1 to CREATOR2
        vm.prank(CREATOR1);
        registry.transferSkillOwnership(SKILL1, CREATOR2);

        // CREATOR1 can no longer change price
        vm.prank(CREATOR1);
        vm.expectRevert(bytes("not skill owner"));
        pricing.setPrice(SKILL1, 0.002 ether, 9000, 1000);

        // CREATOR2 now can
        vm.prank(CREATOR2);
        pricing.setPrice(SKILL1, 0.002 ether, 8000, 2000);
        assertEq(pricing.priceWei(SKILL1), 0.002 ether);
    }

    /* ============================================================== */
    /*                TEST 8-10 · BPS VALIDATION                       */
    /* ============================================================== */

    function test_P8_SetPrice_RejectsBpsSumMismatch() public {
        vm.prank(CREATOR1);
        vm.expectRevert(bytes("bps sum"));
        pricing.setPrice(SKILL1, 0.001 ether, 9000, 2000); // sum 11000
    }

    function test_P9_SetPrice_RejectsCreatorBpsBelowFloor() public {
        vm.prank(CREATOR1);
        vm.expectRevert(bytes("creator bps below floor"));
        pricing.setPrice(SKILL1, 0.001 ether, 4999, 5001);
    }

    function test_P10_SetPrice_RejectsCreatorBpsAboveCeiling() public {
        vm.prank(CREATOR1);
        vm.expectRevert(bytes("creator bps above ceiling"));
        pricing.setPrice(SKILL1, 0.001 ether, 9501, 499);
    }

    /* ============================================================== */
    /*                TEST 11-12 · UNSET PRICE                          */
    /* ============================================================== */

    function test_P11_UnsetPrice_HappyPath() public {
        vm.prank(CREATOR1);
        pricing.setPrice(SKILL1, 0.001 ether, 9000, 1000);
        assertTrue(pricing.isPriced(SKILL1));

        vm.prank(CREATOR1);
        pricing.unsetPrice(SKILL1);
        assertFalse(pricing.isPriced(SKILL1));
        assertEq(pricing.priceWei(SKILL1), 0);
        assertEq(uint256(pricing.creatorBps(SKILL1)), 0);
        assertEq(uint256(pricing.treasuryBps(SKILL1)), 0);
    }

    function test_P12_UnsetPrice_RejectsNonOwner() public {
        vm.prank(CREATOR1);
        pricing.setPrice(SKILL1, 0.001 ether, 9000, 1000);

        vm.prank(RANDO);
        vm.expectRevert(bytes("not skill owner"));
        pricing.unsetPrice(SKILL1);
    }

    function test_P13_UnsetPrice_RejectsIfNotPriced() public {
        vm.prank(CREATOR1);
        vm.expectRevert(bytes("not priced"));
        pricing.unsetPrice(SKILL1);
    }

    function test_P14_Constructor_RejectsZeroRegistry() public {
        vm.expectRevert(bytes("registry zero"));
        new SkillPricing(address(0));
    }
}
