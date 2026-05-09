// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistryV2} from "../src/ReceiptRegistryV2.sol";

contract ReceiptRegistryV2Test is Test {
    ReceiptRegistryV2 public registry;
    address owner = address(0xA11CE);
    address relayer = address(0xBEEF);

    uint256 alicePk = 0xA1A1_AAAA_BBBB_CCCC_DDDD_EEEE_FFFF_0001;
    address alice;
    uint256 bobPk   = 0xB0B0_BBBB_CCCC_DDDD_EEEE_FFFF_AAAA_0002;
    address bob;

    function setUp() public {
        alice = vm.addr(alicePk);
        bob = vm.addr(bobPk);
        vm.prank(owner);
        registry = new ReceiptRegistryV2(owner);
    }

    /// @dev Build an EIP-712 signature for the given anchor params, signed
    ///      by the supplied key. Mirrors what an off-chain wallet would do.
    function _sign(
        uint256 pk,
        ReceiptRegistryV2.AnchorParams memory p,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 digest = registry.digestFor(
            p.receiptRoot,
            p.storageRoot,
            p.receiptType,
            p.attestationHash,
            p.agentAddress,
            nonce,
            p.deadline
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _params(address agent) internal view returns (ReceiptRegistryV2.AnchorParams memory p) {
        p = ReceiptRegistryV2.AnchorParams({
            receiptRoot: keccak256("rcpt-A"),
            storageRoot: keccak256("storage-A"),
            receiptType: 0,
            attestationHash: keccak256("attest-A"),
            agentAddress: agent,
            deadline: block.timestamp + 3600
        });
    }

    // ─── K-2 fix · agentAddress recovered from signature ─────────────────

    function test_K2_HappyPath_SignerIsAgent() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        bytes memory sig = _sign(alicePk, p, 0);

        // Relayer (bob, anyone) submits — but the recorded agent is alice.
        vm.prank(relayer);
        uint256 id = registry.anchor(p, sig);
        assertEq(id, 0);

        (
            bytes32 root,
            bytes32 storageRoot,
            bytes32 attestationHash,
            address agent,
            uint64 timestamp,
            uint8 receiptType
        ) = registry.receipts(id);
        assertEq(root, p.receiptRoot);
        assertEq(storageRoot, p.storageRoot);
        assertEq(attestationHash, p.attestationHash);
        assertEq(agent, alice, "recorded agent must be the signer, not the relayer");
        assertEq(receiptType, 0);
        assertGt(timestamp, 0);

        assertEq(registry.agentReceiptCount(alice), 1);
        assertEq(registry.agentReceiptCount(relayer), 0);
        assertEq(registry.nonces(alice), 1);
    }

    function test_K2_RejectsForgedAgentClaim() public {
        // Alice signs but her params claim BOB's address. ECDSA recovery
        // yields alice, mismatching the claimed bob — anchor reverts.
        ReceiptRegistryV2.AnchorParams memory p = _params(bob);
        bytes memory sig = _sign(alicePk, p, 0);

        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: signature does not match agent");
        registry.anchor(p, sig);
    }

    function test_K2_RejectsReplayOfSameSig() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        bytes memory sig = _sign(alicePk, p, 0);

        vm.prank(relayer);
        registry.anchor(p, sig);

        // Replay → second anchor uses nonce 1 internally, but the signature
        // was over nonce 0 — recovered signer no longer matches agent.
        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: signature does not match agent");
        registry.anchor(p, sig);
    }

    function test_K2_NextNonceMonotonic() public {
        for (uint256 i = 0; i < 3; i++) {
            ReceiptRegistryV2.AnchorParams memory p = _params(alice);
            // Vary the receiptRoot so each signature is unique.
            p.receiptRoot = keccak256(abi.encodePacked("rcpt", i));
            bytes memory sig = _sign(alicePk, p, i);
            vm.prank(relayer);
            registry.anchor(p, sig);
        }
        assertEq(registry.nonces(alice), 3);
        assertEq(registry.nextId(), 3);
        assertEq(registry.agentReceiptCount(alice), 3);
    }

    function test_K2_DeadlineEnforced() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        p.deadline = block.timestamp + 60;
        bytes memory sig = _sign(alicePk, p, 0);

        vm.warp(block.timestamp + 120);
        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: expired");
        registry.anchor(p, sig);
    }

    function test_K2_ZeroReceiptRootRejected() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        p.receiptRoot = bytes32(0);
        bytes memory sig = _sign(alicePk, p, 0);
        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: empty receiptRoot");
        registry.anchor(p, sig);
    }

    function test_K2_ZeroStorageRootRejected() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        p.storageRoot = bytes32(0);
        bytes memory sig = _sign(alicePk, p, 0);
        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: empty storageRoot");
        registry.anchor(p, sig);
    }

    function test_K2_ZeroAgentRejected() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(address(0));
        bytes memory sig = _sign(alicePk, p, 0);
        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: zero agent");
        registry.anchor(p, sig);
    }

    function test_K2_BadReceiptTypeRejected() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        p.receiptType = 99;
        bytes memory sig = _sign(alicePk, p, 0);
        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: invalid type");
        registry.anchor(p, sig);
    }

    function test_K2_TamperedFieldFailsRecovery() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        bytes memory sig = _sign(alicePk, p, 0);

        // Tamper with storageRoot AFTER signing — recovery should fail.
        p.storageRoot = keccak256("tampered");

        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: signature does not match agent");
        registry.anchor(p, sig);
    }

    function test_K2_TwoAgents_IndependentNonces() public {
        ReceiptRegistryV2.AnchorParams memory pA = _params(alice);
        bytes memory sigA = _sign(alicePk, pA, 0);

        ReceiptRegistryV2.AnchorParams memory pB = _params(bob);
        pB.receiptRoot = keccak256("rcpt-B");
        bytes memory sigB = _sign(bobPk, pB, 0);

        vm.prank(relayer);
        registry.anchor(pA, sigA);
        vm.prank(relayer);
        registry.anchor(pB, sigB);

        assertEq(registry.nonces(alice), 1);
        assertEq(registry.nonces(bob), 1);
        assertEq(registry.agentReceiptCount(alice), 1);
        assertEq(registry.agentReceiptCount(bob), 1);
    }

    function test_K2_RelayerCannotSpoofAgent() public {
        // Relayer (bob's key) signs, but params claim alice as agent.
        // bob's signature recovers to bob, mismatches alice → revert.
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        bytes memory sigFromBob = _sign(bobPk, p, 0);

        vm.prank(relayer);
        vm.expectRevert("ReceiptRegistryV2: signature does not match agent");
        registry.anchor(p, sigFromBob);
    }

    function test_K2_PauseStopsNewAnchors() public {
        ReceiptRegistryV2.AnchorParams memory p = _params(alice);
        bytes memory sig = _sign(alicePk, p, 0);

        vm.prank(owner);
        registry.pause();

        vm.prank(relayer);
        vm.expectRevert();
        registry.anchor(p, sig);

        vm.prank(owner);
        registry.unpause();
        vm.prank(relayer);
        registry.anchor(p, sig);
        assertEq(registry.agentReceiptCount(alice), 1);
    }

    function test_K2_NonOwnerCannotPause() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.pause();
    }

    function test_K2_DigestForView_DeterministicAcrossCalls() public view {
        bytes32 d1 = registry.digestFor(
            keccak256("r"), keccak256("s"), 0, keccak256("a"), alice, 0, 1
        );
        bytes32 d2 = registry.digestFor(
            keccak256("r"), keccak256("s"), 0, keccak256("a"), alice, 0, 1
        );
        assertEq(d1, d2);
    }
}
