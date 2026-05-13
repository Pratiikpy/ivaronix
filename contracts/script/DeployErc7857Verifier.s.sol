// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Erc7857Verifier} from "../src/Erc7857Verifier.sol";

/**
 * @notice Deploy `Erc7857Verifier` per FINAL_BUILD_PLAN.md Block K
 *         deploy order (slot 1 of 10). Reads IVARONIX_SIGNER_KEY for
 *         the deployer wallet (legacy alias EVM_PRIVATE_KEY also
 *         resolves via the runtime env loader).
 *
 *         Usage:
 *           IVARONIX_SIGNER_KEY=0x... \
 *           forge script script/DeployErc7857Verifier.s.sol \
 *             --rpc-url $RPC --broadcast --legacy --skip-simulation
 *
 *         Mainnet variant adds FOUNDRY_PROFILE=mainnet for via_ir=true.
 *         The deployer becomes initialOwner + the first attestor; the
 *         operator can rotate via addAttestor / Ownable2Step after.
 */
contract DeployErc7857Verifier is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("IVARONIX_SIGNER_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        Erc7857Verifier verifier = new Erc7857Verifier(deployer);
        vm.stopBroadcast();

        console2.log("Erc7857Verifier deployed at:", address(verifier));
        console2.log("Owner + first attestor:", deployer);
    }
}
