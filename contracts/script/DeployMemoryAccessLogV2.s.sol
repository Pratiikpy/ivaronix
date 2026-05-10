// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MemoryAccessLogV2} from "../src/MemoryAccessLogV2.sol";

/**
 * @notice Deploys MemoryAccessLogV2. Closes WT 32 + planning-003 §A.5.12
 *         (log-spoofing fix · msg.sender enforcement + grant cross-check).
 *
 * @dev V2 needs the CapabilityRegistry address pinned at construction. Pass
 *      the V2 capability registry deployed via DeployCapabilityRegistryV2.s.sol
 *      (planning-003 §A.5.10), OR fall back to V1 if V2 isn't deployed yet.
 *
 * Run on Galileo testnet:
 *   cd contracts
 *   export IVARONIX_SIGNER_KEY=<deployer-key>   # or legacy OG_PRIVATE_KEY
 *   export CAPABILITY_REGISTRY_ADDR=0x...           # CapabilityRegistryV2 preferred, V1 acceptable
 *   forge script script/DeployMemoryAccessLogV2.s.sol:DeployMemoryAccessLogV2 \
 *     --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
 *
 * Run on Aristotle mainnet (requires USER_TODO §A-2 funding):
 *   forge script script/DeployMemoryAccessLogV2.s.sol:DeployMemoryAccessLogV2 \
 *     --rpc-url https://evmrpc.0g.ai --broadcast --legacy
 *
 * Post-deploy:
 *   1. Add the address to contracts/deployments/{testnet,mainnet}.json under
 *      "MemoryAccessLogV2". Leave V1 entry untouched (legacy events stay
 *      readable).
 *   2. Memory engine + Studio /memory page query V2 first via the V2-first
 *      read pattern (planning-003 §A.1.3). New writes target V2.
 */
contract DeployMemoryAccessLogV2 is Script {
    function run() external returns (MemoryAccessLogV2 mlog) {
        uint256 deployerKey = vm.envOr("IVARONIX_SIGNER_KEY", vm.envUint("OG_PRIVATE_KEY"));
        address deployer = vm.addr(deployerKey);
        address capabilityAddr = vm.envAddress("CAPABILITY_REGISTRY_ADDR");

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("CapabilityRegistry:", capabilityAddr);

        require(capabilityAddr != address(0), "CAPABILITY_REGISTRY_ADDR not set");

        vm.startBroadcast(deployerKey);
        mlog = new MemoryAccessLogV2(capabilityAddr);
        vm.stopBroadcast();

        console2.log("MemoryAccessLogV2 deployed at:", address(mlog));
    }
}
