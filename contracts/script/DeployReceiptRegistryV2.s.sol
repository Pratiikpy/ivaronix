// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ReceiptRegistryV2} from "../src/ReceiptRegistryV2.sol";

/**
 * @title DeployReceiptRegistryV2
 * @notice Deploys the V2 ReceiptRegistry. Operator must set:
 *         - OG_PRIVATE_KEY : deployer key (~0.05 OG required)
 *
 * Run with:
 *   forge script script/DeployReceiptRegistryV2.s.sol:DeployReceiptRegistryV2 \
 *     --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
 *
 * After deploy: add the new address to `contracts/deployments/testnet.json`
 * under a `ReceiptRegistryV2` key (leave V1 entry untouched — the existing
 * 1,330+ anchored receipts stay readable on V1; V2 is a fresh anchor target
 * for new receipts going forward).
 *
 * Off-chain TS clients (`packages/og-chain/src/contracts/ReceiptRegistry.ts`,
 * `packages/runtime/src/pipeline.ts`) need a follow-up to sign the V2 EIP-712
 * typed data + call `anchor((root, storageRoot, type, attestationHash, agent,
 * deadline), signature)` instead of the V1 4-arg shape. Documented in
 * HALF_BAKED.md K-2.
 */
contract DeployReceiptRegistryV2 is Script {
    function run() external returns (ReceiptRegistryV2 registry) {
        uint256 deployerKey = vm.envUint("OG_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);
        registry = new ReceiptRegistryV2(deployer);
        console2.log("ReceiptRegistryV2:", address(registry));
        vm.stopBroadcast();
    }
}
