// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AgentPassportINFT} from "../src/AgentPassportINFT.sol";
import {Erc7857Verifier} from "../src/Erc7857Verifier.sol";

contract DeployPassport is Script {
    function run() external returns (Erc7857Verifier verifier, AgentPassportINFT passport) {
        uint256 deployerKey = vm.envUint("OG_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);
        verifier = new Erc7857Verifier(deployer);
        console2.log("Erc7857Verifier:", address(verifier));

        passport = new AgentPassportINFT(
            "Ivaronix Agent Passport",
            "IVAP",
            deployer,
            address(verifier)
        );
        console2.log("AgentPassportINFT:", address(passport));
        vm.stopBroadcast();
    }
}
