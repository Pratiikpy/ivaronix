// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

// Sample vulnerable contract for skill smoke testing.
// Contains: reentrancy, missing access control, unchecked external call, hardcoded
// admin, integer underflow risk in user balance accounting.

contract Vault {
    mapping(address => uint256) public balances;
    address public admin = 0x000000000000000000000000000000000000dEaD;

    // ANY caller can update the admin (no access control).
    function setAdmin(address newAdmin) external {
        admin = newAdmin;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // Classic reentrancy: external call BEFORE state update.
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        // state mutation happens AFTER external call
        balances[msg.sender] -= amount;
        require(ok, "transfer failed");
    }

    // Missing zero-address check; transfers to address(0) allowed.
    function transfer(address to, uint256 amount) external {
        balances[msg.sender] -= amount; // can underflow if not careful (0.8+ catches but logic still wrong)
        balances[to] += amount;
    }
}
