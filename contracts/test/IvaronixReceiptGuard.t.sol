// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {IvaronixReceiptGuard} from "../src/IvaronixReceiptGuard.sol";

/// @notice Test harness exposing the library's revert-on-mismatch path
/// at a contract entry point so Foundry's vm.expectRevert can target it.
contract GuardCaller {
    ReceiptRegistry public registry;

    constructor(ReceiptRegistry r) {
        registry = r;
    }

    /// External entry — used by tests with vm.expectRevert.
    function gate(uint256 receiptId, address expectedAgent, uint8 expectedType) external view {
        IvaronixReceiptGuard.requireValidReceipt(registry, receiptId, expectedAgent, expectedType);
    }

    function gateOk(uint256 receiptId, address expectedAgent, uint8 expectedType) external view returns (bool) {
        return IvaronixReceiptGuard.isValidReceipt(registry, receiptId, expectedAgent, expectedType);
    }
}

contract IvaronixReceiptGuardTest is Test {
    ReceiptRegistry public registry;
    GuardCaller public caller;
    address public agent = address(0xAA95);
    address public stranger = address(0xB0B);

    function setUp() public {
        registry = new ReceiptRegistry(address(this));
        caller = new GuardCaller(registry);
    }

    function _anchor(address from, uint8 receiptType) internal returns (uint256 id) {
        bytes32 receiptRoot = keccak256(abi.encodePacked("root-", uint256(uint160(from)), receiptType));
        bytes32 storageRoot = keccak256(abi.encodePacked("storage-", uint256(uint160(from)), receiptType));
        bytes32 attestationHash = bytes32(0);
        vm.prank(from);
        id = registry.anchor(receiptRoot, storageRoot, receiptType, attestationHash);
    }

    // Type-code constants cached as test fields so the test calls do not
    // perform an extra external read between vm.expectRevert and the call
    // under test (the read would consume the expectRevert).
    uint8 internal docAsk;
    uint8 internal audit;

    function _cacheTypes() internal {
        docAsk = registry.TYPE_DOC_ASK();
        audit = registry.TYPE_AUDIT();
    }

    function test_validReceipt_passes() public {
        _cacheTypes();
        uint256 id = _anchor(agent, docAsk);
        // Should NOT revert.
        caller.gate(id, agent, docAsk);
        assertTrue(caller.gateOk(id, agent, docAsk));
    }

    function test_unanchoredReceipt_reverts() public {
        _cacheTypes();
        // Nothing anchored yet — id 0 has no receipt.
        vm.expectRevert("IvaronixReceiptGuard: receipt not anchored");
        caller.gate(0, agent, docAsk);
        assertFalse(caller.gateOk(0, agent, docAsk));
    }

    function test_agentMismatch_reverts() public {
        _cacheTypes();
        uint256 id = _anchor(agent, docAsk);
        vm.expectRevert("IvaronixReceiptGuard: agent mismatch");
        caller.gate(id, stranger, docAsk);
        assertFalse(caller.gateOk(id, stranger, docAsk));
    }

    function test_typeMismatch_reverts() public {
        _cacheTypes();
        uint256 id = _anchor(agent, docAsk);
        vm.expectRevert("IvaronixReceiptGuard: type mismatch");
        caller.gate(id, agent, audit);
        assertFalse(caller.gateOk(id, agent, audit));
    }

    function test_secondAnchor_independentValidity() public {
        _cacheTypes();
        uint256 id1 = _anchor(agent, docAsk);
        uint256 id2 = _anchor(stranger, audit);
        // Both receipts exist; the guard correctly distinguishes them.
        caller.gate(id1, agent, docAsk);
        caller.gate(id2, stranger, audit);
        // Cross-check fails.
        vm.expectRevert("IvaronixReceiptGuard: agent mismatch");
        caller.gate(id1, stranger, docAsk);
    }
}
