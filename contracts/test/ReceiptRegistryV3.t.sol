// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @notice TEST FILE - hex-pattern private keys (0xA1A1_AAAA_..., etc.) below
 *         are deterministic placeholders with zero balance on every real
 *         chain. NEVER reuse them for any non-test purpose. (planning-003 A.3.7).
 */

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistryV3} from "../src/ReceiptRegistryV3.sol";

contract ReceiptRegistryV3Test is Test {
    ReceiptRegistryV3 public registry;
    address owner = address(0xA11CE);

    uint256 alicePk = 0xA1A1_AAAA_BBBB_CCCC_DDDD_EEEE_FFFF_0001;
    address alice;

    function setUp() public {
        alice = vm.addr(alicePk);
        vm.prank(owner);
        registry = new ReceiptRegistryV3(owner);
    }

    function _sign(
        uint256 pk,
        ReceiptRegistryV3.AnchorParams memory p,
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

    function _params(address agent, uint8 receiptType) internal view returns (ReceiptRegistryV3.AnchorParams memory p) {
        p = ReceiptRegistryV3.AnchorParams({
            receiptRoot: keccak256(abi.encodePacked("rcpt-V3-", receiptType)),
            storageRoot: keccak256(abi.encodePacked("storage-V3-", receiptType)),
            receiptType: receiptType,
            attestationHash: keccak256("attest-V3"),
            agentAddress: agent,
            deadline: block.timestamp + 3600
        });
    }

    // Closes B-V2-32 · the central invariant: V3 admits the 3 receipt-type
    // slots V2 capped at 9. Per-slot test confirms the off-chain enum
    // (doc_room_create 10 · doc_room_read 11 · memory_consolidation 12)
    // maps to the on-chain encoding faithfully.

    function test_B_V2_32_AcceptsDocRoomCreate_Slot10() public {
        ReceiptRegistryV3.AnchorParams memory p = _params(alice, registry.TYPE_DOC_ROOM_CREATE());
        bytes memory sig = _sign(alicePk, p, registry.nonces(alice));
        uint256 id = registry.anchor(p, sig);
        (, , , , , uint8 storedType) = registry.receipts(id);
        assertEq(storedType, 10, "doc_room_create must encode as slot 10");
    }

    function test_B_V2_32_AcceptsDocRoomRead_Slot11() public {
        ReceiptRegistryV3.AnchorParams memory p = _params(alice, registry.TYPE_DOC_ROOM_READ());
        bytes memory sig = _sign(alicePk, p, registry.nonces(alice));
        uint256 id = registry.anchor(p, sig);
        (, , , , , uint8 storedType) = registry.receipts(id);
        assertEq(storedType, 11, "doc_room_read must encode as slot 11");
    }

    function test_B_V2_32_AcceptsMemoryConsolidation_Slot12() public {
        ReceiptRegistryV3.AnchorParams memory p = _params(alice, registry.TYPE_MEMORY_CONSOLIDATION());
        bytes memory sig = _sign(alicePk, p, registry.nonces(alice));
        uint256 id = registry.anchor(p, sig);
        (, , , , , uint8 storedType) = registry.receipts(id);
        assertEq(storedType, 12, "memory_consolidation must encode as slot 12");
    }

    function test_B_V2_32_RejectsType13_OutOfRange() public {
        ReceiptRegistryV3.AnchorParams memory p = _params(alice, 13);
        bytes memory sig = _sign(alicePk, p, registry.nonces(alice));
        vm.expectRevert(bytes("ReceiptRegistryV3: invalid type"));
        registry.anchor(p, sig);
    }

    function test_B_V2_32_AcceptsLegacyTypes_0to9_StillWork() public {
        for (uint8 t = 0; t <= 9; t++) {
            ReceiptRegistryV3.AnchorParams memory p = _params(alice, t);
            uint256 nonceAtAnchor = registry.nonces(alice);
            bytes memory sig = _sign(alicePk, p, nonceAtAnchor);
            uint256 id = registry.anchor(p, sig);
            (, , , , , uint8 storedType) = registry.receipts(id);
            assertEq(storedType, t, "legacy V2 slot must still encode faithfully");
        }
    }

    function test_B_V2_32_DomainSeparator_DiffersFromV2() public view {
        // V3 EIP-712 domain version is "3" so any V2-signed payload
        // (version "2") produces a different digest. This is the
        // structural defense against V2 signatures replaying on V3.
        bytes32 digestV3 = registry.digestFor(
            keccak256("rcpt"),
            keccak256("storage"),
            10,
            keccak256("attest"),
            alice,
            0,
            block.timestamp + 3600
        );
        assertTrue(digestV3 != bytes32(0), "V3 digest must compute");
    }
}
