// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CapabilityRegistryV2} from "../src/CapabilityRegistryV2.sol";

/**
 * @notice Deploys CapabilityRegistryV2. Closes WT 12 + planning-003 §A.5.10
 *         (social-graph leak fix · private reverse indexes + authorized-reader
 *         pattern).
 *
 * Run on Galileo testnet:
 *   cd contracts
 *   export IVARONIX_SIGNER_KEY=<deployer-key>       # or legacy OG_PRIVATE_KEY
 *   forge script script/DeployCapabilityRegistryV2.s.sol:DeployCapabilityRegistryV2 \
 *     --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
 *
 * Run on Aristotle mainnet (requires USER_TODO §A-2 funding):
 *   forge script script/DeployCapabilityRegistryV2.s.sol:DeployCapabilityRegistryV2 \
 *     --rpc-url https://evmrpc.0g.ai --broadcast --legacy
 *
 * Post-deploy:
 *   1. Add the deployed address to contracts/deployments/{testnet,mainnet}.json
 *      under a new "CapabilityRegistryV2" key. Leave V1 entry untouched.
 *   2. (Optional) Authorize an indexer:
 *        cast send <V2-addr> "addAuthorizedReader(address)" <indexer-addr> \
 *          --rpc-url <rpc> --private-key $IVARONIX_SIGNER_KEY --legacy
 *   3. Studio + CLI grant-management surfaces query V2 first via the
 *      V2-first read pattern (planning-003 §A.1.3).
 */
contract DeployCapabilityRegistryV2 is Script {
    function run() external returns (CapabilityRegistryV2 reg) {
        // Prefer canonical name, fall back to legacy alias (planning-003 §A.3.4).
        uint256 deployerKey = vm.envOr("IVARONIX_SIGNER_KEY", vm.envUint("OG_PRIVATE_KEY"));
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);
        reg = new CapabilityRegistryV2(deployer);
        vm.stopBroadcast();

        console2.log("CapabilityRegistryV2 deployed at:", address(reg));
        console2.log("Owner:", reg.owner());
    }
}
