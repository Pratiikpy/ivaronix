// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @notice TEST FILE - hex-pattern private keys (0xA1A1_AAAA_..., etc.) below
 *         are deterministic placeholders with zero balance on every real
 *         chain. NEVER reuse them for any non-test purpose. If a secret
 *         scanner flags them: ignore. Closes WT 86 (planning-003 A.3.7).
 */

import {Test} from "forge-std/Test.sol";
import {AgentPassportINFTV2, IReceiptRegistryView} from "../src/AgentPassportINFTV2.sol";
import {Erc7857Verifier} from "../src/Erc7857Verifier.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";

contract AgentPassportINFTV2Test is Test {
    Erc7857Verifier public verifier;
    ReceiptRegistry public registry;
    AgentPassportINFTV2 public passport;

    uint256 attestorPrivateKey = 0xA77E5707_AAAA_BBBB_CCCC_DDDD_EEEE_FFFF;
    address attestor;
    address owner = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0B);
    address recorder = address(0xBEEF);
    address recipient = address(0xC0FFEE);

    function setUp() public {
        attestor = vm.addr(attestorPrivateKey);
        vm.startPrank(owner);
        verifier = new Erc7857Verifier(owner);
        verifier.addAttestor(attestor);
        registry = new ReceiptRegistry(owner);
        passport = new AgentPassportINFTV2(
            "Ivaronix Agent Passport V2",
            "IVAP2",
            owner,
            address(verifier),
            address(registry)
        );
        passport.addAuthorizedRecorder(recorder);
        vm.stopPrank();
    }

    /// @dev Helper: anchor a receipt by `agent` and return its id.
    function _anchorAs(address agent, bytes32 root, uint8 typ) internal returns (uint256 id) {
        vm.prank(agent);
        id = registry.anchor(root, bytes32(uint256(0xdeadbeef)), typ, bytes32(uint256(0xa771571)));
    }

    // ─── K-1 fix · only authorized recorders can write reputation ────────

    function test_K1_OwnerCannotForgeOwnTrustScore() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        // Owner-as-msg.sender is no longer accepted for recordReceipt.
        vm.prank(alice);
        vm.expectRevert("AgentPassportINFTV2: only authorized recorder");
        passport.recordReceipt(tokenId, 0, bytes32(0), 0, 50);
    }

    function test_K1_AuthorizedRecorderCanRecord_WithCrossCheck() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 receiptRoot = bytes32("receipt-root-A");
        uint256 receiptId = _anchorAs(alice, receiptRoot, 0);

        vm.prank(recorder);
        passport.recordReceipt(tokenId, receiptId, receiptRoot, 0, 10);

        (, , , uint64 receiptCount, , int128 trustScore, , ) = passport.agents(tokenId);
        assertEq(receiptCount, 1);
        assertEq(trustScore, int128(10));
    }

    function test_K1_RejectsRecord_WhenReceiptAgentIsNotPassportOwner() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        // Bob anchors a receipt; recorder tries to credit it to alice.
        bytes32 root = bytes32("bob-root");
        uint256 receiptId = _anchorAs(bob, root, 0);

        vm.prank(recorder);
        vm.expectRevert("AgentPassportINFTV2: receipt agent does not match passport owner");
        passport.recordReceipt(tokenId, receiptId, root, 0, 10);
    }

    function test_K1_RejectsRecord_OnReceiptRootMismatch() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 root = bytes32("real-root");
        uint256 receiptId = _anchorAs(alice, root, 0);

        vm.prank(recorder);
        vm.expectRevert("AgentPassportINFTV2: receiptRoot mismatch");
        passport.recordReceipt(tokenId, receiptId, bytes32("wrong-root"), 0, 10);
    }

    function test_K1_RejectsRecord_OnReceiptTypeMismatch() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 root = bytes32("doc-ask");
        uint256 receiptId = _anchorAs(alice, root, 0);

        vm.prank(recorder);
        vm.expectRevert("AgentPassportINFTV2: receiptType mismatch");
        passport.recordReceipt(tokenId, receiptId, root, 1, 10);
    }

    function test_K1_RejectsRecord_OnNonexistentReceiptId() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        vm.prank(recorder);
        vm.expectRevert("AgentPassportINFTV2: receipt id out of range");
        passport.recordReceipt(tokenId, 9999, bytes32("any"), 0, 10);
    }

    function test_K1_DeltaCapEnforced_PositiveOverflow() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 root = bytes32("delta-overflow");
        uint256 receiptId = _anchorAs(alice, root, 0);

        vm.prank(recorder);
        vm.expectRevert("AgentPassportINFTV2: trustScoreDelta out of range");
        passport.recordReceipt(tokenId, receiptId, root, 0, 101);
    }

    function test_K1_DeltaCapEnforced_NegativeOverflow() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 root = bytes32("delta-underflow");
        uint256 receiptId = _anchorAs(alice, root, 0);

        vm.prank(recorder);
        vm.expectRevert("AgentPassportINFTV2: trustScoreDelta out of range");
        passport.recordReceipt(tokenId, receiptId, root, 0, -101);
    }

    function test_K1_DeltaCapAcceptsBoundary() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        bytes32 root1 = bytes32("max-positive");
        uint256 r1 = _anchorAs(alice, root1, 0);
        vm.prank(recorder);
        passport.recordReceipt(tokenId, r1, root1, 0, 100);

        bytes32 root2 = bytes32("max-negative");
        uint256 r2 = _anchorAs(alice, root2, 0);
        vm.prank(recorder);
        passport.recordReceipt(tokenId, r2, root2, 0, -100);

        (, , , uint64 receiptCount, , int128 trustScore, , ) = passport.agents(tokenId);
        assertEq(receiptCount, 2);
        assertEq(trustScore, int128(0));
    }

    // ─── K-4 fix · executor authorizations clear on transfer ─────────────

    function _signAttestor(address to_, bytes32 root_, bytes32 nonce_) internal view returns (bytes memory) {
        bytes32 inner = keccak256(abi.encodePacked(to_, root_, nonce_, address(verifier), block.chainid));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorPrivateKey, ethSigned);
        return abi.encodePacked(r, s, v);
    }

    function test_K4_ExecutorClearedOnSafeTransfer() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        // Alice authorizes Bob as executor for 1 hour.
        vm.prank(alice);
        passport.authorizeExecutor(tokenId, bob, 3600);
        assertTrue(passport.isAuthorizedExecutor(tokenId, bob));

        // Alice transfers to recipient via standard ERC-721 path.
        vm.prank(alice);
        passport.transferFrom(alice, recipient, tokenId);

        // Bob's grant must no longer match — the version bumped.
        assertFalse(passport.isAuthorizedExecutor(tokenId, bob));
    }

    function test_K4_ExecutorClearedOnITransferFrom() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));

        vm.prank(alice);
        passport.authorizeExecutor(tokenId, bob, 3600);

        bytes32 newRoot = bytes32("new-meta");
        bytes32 nonce = bytes32(uint256(1));
        bytes memory sig = _signAttestor(recipient, newRoot, nonce);

        vm.prank(alice);
        passport.iTransferFrom(alice, recipient, tokenId, newRoot, nonce, sig);

        assertFalse(passport.isAuthorizedExecutor(tokenId, bob));
    }

    function test_K4_NewOwnerCanAuthorizeFresh() public {
        vm.prank(alice);
        uint256 tokenId = passport.mint(bytes32("meta-alice"));
        vm.prank(alice);
        passport.authorizeExecutor(tokenId, bob, 3600);
        vm.prank(alice);
        passport.transferFrom(alice, recipient, tokenId);

        // Recipient grants their own executor.
        vm.prank(recipient);
        passport.authorizeExecutor(tokenId, bob, 7200);
        assertTrue(passport.isAuthorizedExecutor(tokenId, bob));
    }

    // ─── K-6 fix · mint ordering prevents reentrancy double-mint ─────────

    function test_K6_PassportOfSetBeforeSafeMint() public {
        // Direct contract test: a malicious recipient with onERC721Received
        // can call back into mint() and we still expect only one passport.
        ReentrantMintAttacker bad = new ReentrantMintAttacker(passport);
        vm.expectRevert(); // ReentrancyGuard reverts the inner re-entry
        bad.attack(bytes32("attack-root"));
    }

    // ─── Bookkeeping baseline ────────────────────────────────────────────

    function test_RecorderManagement() public {
        assertTrue(passport.authorizedRecorders(recorder));
        vm.prank(owner);
        passport.removeAuthorizedRecorder(recorder);
        assertFalse(passport.authorizedRecorders(recorder));
    }

    function test_ReceiptRegistrySwap_OwnerOnly() public {
        ReceiptRegistry r2 = new ReceiptRegistry(owner);
        vm.prank(owner);
        passport.setReceiptRegistry(address(r2));
        assertEq(address(passport.receiptRegistry()), address(r2));
    }

    function test_ReceiptRegistrySwap_RejectsZero() public {
        vm.prank(owner);
        vm.expectRevert("AgentPassportINFTV2: zero registry");
        passport.setReceiptRegistry(address(0));
    }
}

/**
 * Helper: a contract that re-enters `mint` from `onERC721Received`. The
 * V2 mint guards via ReentrancyGuard + passportOf-before-_safeMint, so the
 * attack must revert.
 */
contract ReentrantMintAttacker {
    AgentPassportINFTV2 public passport;
    bool reentered;

    constructor(AgentPassportINFTV2 p) {
        passport = p;
    }

    function attack(bytes32 root) external {
        passport.mint(root);
    }

    function onERC721Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
    ) external returns (bytes4) {
        if (!reentered) {
            reentered = true;
            // Try to mint a SECOND passport for the same wallet via re-entry.
            passport.mint(bytes32("attack-second-mint"));
        }
        return this.onERC721Received.selector;
    }
}
