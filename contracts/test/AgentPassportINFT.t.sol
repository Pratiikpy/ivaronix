// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentPassportINFT} from "../src/AgentPassportINFT.sol";
import {Erc7857Verifier} from "../src/Erc7857Verifier.sol";

contract AgentPassportINFTTest is Test {
    Erc7857Verifier public verifier;
    AgentPassportINFT public passport;

    uint256 attestorPrivateKey = 0xA77E5707_AAAA_BBBB_CCCC_DDDD_EEEE_FFFF;
    address attestor;
    address owner = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address recipient = address(0xC0FFEE);

    function setUp() public {
        attestor = vm.addr(attestorPrivateKey);
        vm.startPrank(owner);
        verifier = new Erc7857Verifier(owner);
        verifier.addAttestor(attestor);
        passport = new AgentPassportINFT("Ivaronix Agent Passport", "IVAP", owner, address(verifier));
        vm.stopPrank();
    }

    // ─── Mint ────────────────────────────────────────────────────────────
    function test_MintAssignsTokenId() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));
        assertEq(tokenId, 1);
        assertEq(passport.passportOf(alice), 1);
        assertEq(passport.ownerOf(1), alice);
    }

    function test_MintRejectsSecondPassportPerWallet() public {
        vm.startPrank(alice);
        passport.mint(bytes32("meta-1"));
        vm.expectRevert("AgentPassportINFT: wallet already has a passport");
        passport.mint(bytes32("meta-2"));
        vm.stopPrank();
    }

    function test_MintRejectsEmptyMetadataRoot() public {
        vm.prank(alice);
        vm.expectRevert("AgentPassportINFT: empty metadataRoot");
        passport.mint(bytes32(0));
    }

    // ─── recordReceipt ───────────────────────────────────────────────────
    function test_OwnerCanRecordReceipt() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.prank(alice);
        passport.recordReceipt(tokenId, bytes32("rcpt-1"), 0, 1);

        (,,, uint64 receiptCount, uint64 violationCount, int128 trustScore,,) = passport.agents(tokenId);
        assertEq(receiptCount, 1);
        assertEq(violationCount, 0);
        assertEq(trustScore, 1);
    }

    function test_AuthorizedRecorderCanRecordReceipt() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.prank(owner);
        passport.addAuthorizedRecorder(bob);

        vm.prank(bob);
        passport.recordReceipt(tokenId, bytes32("rcpt-1"), 0, 5);

        (,,, uint64 receiptCount,, int128 trustScore,,) = passport.agents(tokenId);
        assertEq(receiptCount, 1);
        assertEq(trustScore, 5);
    }

    function test_UnauthorizedCannotRecord() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.prank(bob);
        vm.expectRevert("AgentPassportINFT: not owner or authorized recorder");
        passport.recordReceipt(tokenId, bytes32("rcpt-1"), 0, 1);
    }

    function test_TrustScoreCanGoNegative() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.startPrank(alice);
        passport.recordViolation(tokenId, -10, "policy-breach");
        passport.recordViolation(tokenId, -5, "another-breach");
        vm.stopPrank();

        (,,,, uint64 violationCount, int128 trustScore,,) = passport.agents(tokenId);
        assertEq(violationCount, 2);
        assertEq(trustScore, -15);
    }

    function test_RecordViolationRequiresNegativeDelta() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.prank(alice);
        vm.expectRevert("AgentPassportINFT: violations must be negative deltas");
        passport.recordViolation(tokenId, 1, "wrong-sign");
    }

    // ─── Memory / skill / metadata updates ───────────────────────────────
    function test_UpdateMemoryRootByOwner() public {
        vm.startPrank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));
        passport.updateMemoryRoot(tokenId, bytes32("memv1"));
        vm.stopPrank();

        (, bytes32 memoryRoot,,,,,,) = passport.agents(tokenId);
        assertEq(memoryRoot, bytes32("memv1"));
    }

    function test_UpdateMemoryRejectsNonOwner() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.prank(bob);
        vm.expectRevert("AgentPassportINFT: not owner");
        passport.updateMemoryRoot(tokenId, bytes32("hostile"));
    }

    function test_RotateMetadataRejectsEmpty() public {
        vm.startPrank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));
        vm.expectRevert("AgentPassportINFT: empty newRoot");
        passport.rotateMetadata(tokenId, bytes32(0));
        vm.stopPrank();
    }

    // ─── Authorized executors ────────────────────────────────────────────
    function test_AuthorizeExecutorWorksUntilExpiry() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.prank(alice);
        passport.authorizeExecutor(tokenId, bob, 3600);

        assertTrue(passport.isAuthorizedExecutor(tokenId, bob));

        vm.warp(block.timestamp + 3601);
        assertFalse(passport.isAuthorizedExecutor(tokenId, bob));
    }

    function test_RevokeExecutor() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta"));

        vm.prank(alice);
        passport.authorizeExecutor(tokenId, bob, 3600);
        assertTrue(passport.isAuthorizedExecutor(tokenId, bob));

        vm.prank(alice);
        passport.revokeExecutor(tokenId, bob);
        assertFalse(passport.isAuthorizedExecutor(tokenId, bob));
    }

    // ─── ERC-7857 secure transfer ────────────────────────────────────────
    function test_iTransferFromWithValidAttestation() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 newMeta = bytes32("meta-recipient");
        bytes32 nonce = bytes32(uint256(1));

        // Attestor signs (recipient, newMeta, nonce, verifier-address, chain-id)
        bytes32 message = keccak256(abi.encodePacked(
            recipient, newMeta, nonce, address(verifier), block.chainid
        ));
        bytes32 ethSigned = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", message
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorPrivateKey, ethSigned);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        passport.iTransferFrom(alice, recipient, tokenId, newMeta, nonce, sig);

        assertEq(passport.ownerOf(tokenId), recipient);
        assertEq(passport.passportOf(recipient), tokenId);
        assertEq(passport.passportOf(alice), 0);
        (bytes32 metadataRoot,,,,,,,) = passport.agents(tokenId);
        assertEq(metadataRoot, newMeta);
    }

    function test_iTransferFromRejectsBadAttestation() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 newMeta = bytes32("meta-recipient");
        bytes32 nonce = bytes32(uint256(2));

        // Sign with wrong key
        uint256 fakeKey = 0xDEADBEEF;
        bytes32 message = keccak256(abi.encodePacked(
            recipient, newMeta, nonce, address(verifier), block.chainid
        ));
        bytes32 ethSigned = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", message
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(fakeKey, ethSigned);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert("Erc7857Verifier: bad attestor");
        passport.iTransferFrom(alice, recipient, tokenId, newMeta, nonce, sig);
    }

    function test_PauseBlocksMint() public {
        vm.prank(owner);
        passport.pause();
        vm.prank(alice);
        vm.expectRevert();
        passport.mint(bytes32("meta"));
    }
}
