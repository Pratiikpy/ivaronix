// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SkillPricing} from "../src/SkillPricing.sol";

/**
 * @notice Deploy `SkillPricing` per FINAL_BUILD_PLAN.md Block A.1.
 *         Reads IVARONIX_SIGNER_KEY for the deployer and
 *         IVARONIX_SKILL_REGISTRY_V2 for the registry address to pin
 *         at construction (immutable post-deploy).
 *
 *         Usage:
 *           IVARONIX_SIGNER_KEY=0x...  \
 *           IVARONIX_SKILL_REGISTRY_V2=0xF05113E83146160024326ff30979c57f5adc2193 \
 *           forge script script/DeploySkillPricing.s.sol \
 *             --rpc-url $RPC --broadcast --legacy --skip-simulation
 */
contract DeploySkillPricing is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("IVARONIX_SIGNER_KEY");
        address registry = vm.envAddress("IVARONIX_SKILL_REGISTRY_V2");
        require(registry != address(0), "registry env zero");

        vm.startBroadcast(deployerKey);
        SkillPricing pricing = new SkillPricing(registry);
        vm.stopBroadcast();

        console2.log("SkillPricing deployed at:", address(pricing));
        console2.log("SkillRegistryV2 pinned:", address(pricing.skillRegistry()));
    }
}
