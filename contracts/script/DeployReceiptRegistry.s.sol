// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";

contract DeployReceiptRegistry is Script {
    function run() external returns (ReceiptRegistry registry) {
        uint256 deployerKey = vm.envUint("OG_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);
        registry = new ReceiptRegistry(deployer);
        vm.stopBroadcast();

        console2.log("ReceiptRegistry:", address(registry));
    }
}
