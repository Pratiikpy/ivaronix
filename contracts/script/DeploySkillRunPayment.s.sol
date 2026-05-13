// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SkillRunPayment} from "../src/SkillRunPayment.sol";

/**
 * @notice Deploy `SkillRunPayment` per FINAL_BUILD_PLAN.md Block A.
 *         Reads IVARONIX_SIGNER_KEY for the deployer; the deployer
 *         becomes the initial owner (treasury withdrawal + refund admin).
 *
 *         Galileo: pace deploys via --legacy --skip-simulation.
 *         Mainnet: same, optionally with --verify if chainscan supports it.
 *
 *         Usage:
 *           forge script script/DeploySkillRunPayment.s.sol \
 *             --rpc-url $RPC --broadcast --legacy --skip-simulation
 *
 *         Record the deployed address in
 *         contracts/deployments/{testnet,mainnet}.json then run
 *         `pnpm numbers:refresh && pnpm docs:render`.
 */
contract DeploySkillRunPayment is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("IVARONIX_SIGNER_KEY");
        address deployer = vm.addr(deployerKey);
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);
        SkillRunPayment payment = new SkillRunPayment(deployer);
        vm.stopBroadcast();

        console2.log("SkillRunPayment deployed at:", address(payment));
        console2.log("Initial owner (treasury role):", payment.owner());
        console2.log("CREATOR_BPS_FLOOR:", payment.CREATOR_BPS_FLOOR());
        console2.log("CREATOR_BPS_CEILING:", payment.CREATOR_BPS_CEILING());
        console2.log("REFUND_TIMELOCK (seconds):", payment.REFUND_TIMELOCK());
    }
}
