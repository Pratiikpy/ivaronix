// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AgentPassportINFTV2} from "../src/AgentPassportINFTV2.sol";

/**
 * @title DeployPassportV2
 * @notice Deploys the V2 passport against an existing Erc7857Verifier and
 *         ReceiptRegistry. Operator must set:
 *         - OG_PRIVATE_KEY            : deployer key (~0.05 OG required)
 *         - PASSPORT_VERIFIER_ADDR    : the existing Erc7857Verifier address
 *         - RECEIPT_REGISTRY_ADDR     : the existing ReceiptRegistry address
 *
 * Run with:
 *   forge script script/DeployPassportV2.s.sol:DeployPassportV2 \
 *     --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
 *
 * After deploy, Studio + indexers should pick up the new address from
 * `deployments/<network>.json` (operator updates it post-broadcast).
 */
contract DeployPassportV2 is Script {
    function run() external returns (AgentPassportINFTV2 passportV2) {
        uint256 deployerKey = vm.envUint("OG_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address verifierAddr = vm.envAddress("PASSPORT_VERIFIER_ADDR");
        address registryAddr = vm.envAddress("RECEIPT_REGISTRY_ADDR");

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("Reusing Erc7857Verifier:", verifierAddr);
        console2.log("Reusing ReceiptRegistry:", registryAddr);

        vm.startBroadcast(deployerKey);
        passportV2 = new AgentPassportINFTV2(
            "Ivaronix Agent Passport V2",
            "IVAP2",
            deployer,
            verifierAddr,
            registryAddr
        );
        console2.log("AgentPassportINFTV2:", address(passportV2));
        vm.stopBroadcast();
    }
}
