// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SubscriptionEscrowV2} from "../src/SubscriptionEscrowV2.sol";

/**
 * @notice Deploys SubscriptionEscrowV2. Closes WT 26 + planning-003 §A.5.9
 *         (AGENT_AUTO loose-accountability fix · receipt cross-check on
 *         every check-in/alert).
 *
 * @dev V2 needs the ReceiptRegistry address pinned at construction. Pass
 *      the V2 receipt registry deployed via DeployReceiptRegistryV2.s.sol
 *      (planning-003 §A.1.2 K-2 fix), or fall back to V1 if V2 isn't
 *      deployed on the target network. Both V1 and V2 expose the same
 *      `receipts(uint256)` + `nextId()` shape used by the cross-check.
 *
 * Run on Galileo testnet:
 *   cd contracts
 *   export IVARONIX_SIGNER_KEY=<deployer-key>   # or legacy OG_PRIVATE_KEY
 *   export RECEIPT_REGISTRY_ADDR=0x...    # ReceiptRegistryV2 preferred, V1 acceptable
 *   forge script script/DeploySubscriptionEscrowV2.s.sol:DeploySubscriptionEscrowV2 \
 *     --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
 *
 * Run on Aristotle mainnet (requires USER_TODO §A-2 funding):
 *   forge script script/DeploySubscriptionEscrowV2.s.sol:DeploySubscriptionEscrowV2 \
 *     --rpc-url https://evmrpc.0g.ai --broadcast --legacy
 *
 * Post-deploy:
 *   1. Add address to contracts/deployments/{testnet,mainnet}.json under
 *      "SubscriptionEscrowV2".
 *   2. CLI `ivaronix subscription create / checkin / status` (planning-003
 *      §B-7 · queued) routes to V2 first via the V2-first read pattern.
 */
contract DeploySubscriptionEscrowV2 is Script {
    function run() external returns (SubscriptionEscrowV2 escrow) {
        uint256 deployerKey = vm.envOr("IVARONIX_SIGNER_KEY", vm.envUint("OG_PRIVATE_KEY"));
        address deployer = vm.addr(deployerKey);
        address receiptAddr = vm.envAddress("RECEIPT_REGISTRY_ADDR");

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("ReceiptRegistry:", receiptAddr);

        require(receiptAddr != address(0), "RECEIPT_REGISTRY_ADDR not set");

        vm.startBroadcast(deployerKey);
        escrow = new SubscriptionEscrowV2(receiptAddr);
        vm.stopBroadcast();

        console2.log("SubscriptionEscrowV2 deployed at:", address(escrow));
    }
}
