// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ReceiptRegistryV3} from "../src/ReceiptRegistryV3.sol";

/**
 * @title DeployReceiptRegistryV3
 * @notice Deploys ReceiptRegistryV3 — extends V2's 0-9 receipt-type range
 *         to admit slots 10/11/12 (doc_room_create · doc_room_read ·
 *         memory_consolidation). Closes audit B-V2-32.
 *
 *         Operator must set:
 *         - IVARONIX_SIGNER_KEY (or legacy OG_PRIVATE_KEY): deployer key
 *           with ≈0.001-0.005 OG on the target chain
 *
 *         Run with:
 *           forge script script/DeployReceiptRegistryV3.s.sol:DeployReceiptRegistryV3 \
 *             --rpc-url https://evmrpc-testnet.0g.ai --broadcast --legacy
 *
 *         After deploy:
 *         1. Operator copies the printed address into
 *            `contracts/deployments/testnet.json` (entry: `"ReceiptRegistryV3"`).
 *         2. Operator adds the address (lower-cased) to
 *            `KNOWN_RECEIPT_REGISTRIES` in `packages/core/src/types.ts`.
 *         3. Operator updates `apps/studio/src/lib/chain.ts` unifiedX
 *            helpers to consult V3 first, V2 fallback, V1 fallback.
 *         4. Operator removes `RECEIPT_TYPE_CODE = 4` coercion from
 *            `apps/cli/src/commands/room.ts:588` and
 *            `apps/cli/src/commands/passport-consolidate.ts:366` —
 *            both can now pass the canonical slot 11/12 directly.
 *         5. Operator records the deploy in `CHANGELOG.md` with a
 *            `Closes audit B-V2-32 · DEPLOYED 2026-XX-XX · 0x<addr>`
 *            commit trailer.
 *
 *         The contract is owned by the deployer (Ownable2Step). Pause /
 *         unpause are owner-only. No setter rituals required — V3 is
 *         self-contained per the V2 pattern.
 */
contract DeployReceiptRegistryV3 is Script {
    function run() external returns (ReceiptRegistryV3 registryV3) {
        uint256 deployerKey = vm.envOr("IVARONIX_SIGNER_KEY", vm.envUint("OG_PRIVATE_KEY"));
        address deployer = vm.addr(deployerKey);

        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);
        console2.log("(V3 extends V2 type-cap from 9 to 12 - closes B-V2-32)");

        vm.startBroadcast(deployerKey);
        registryV3 = new ReceiptRegistryV3(deployer);
        vm.stopBroadcast();

        console2.log("ReceiptRegistryV3 deployed at:", address(registryV3));
        console2.log("Next steps:");
        console2.log(" 1. Add to contracts/deployments/testnet.json");
        console2.log(" 2. Add to KNOWN_RECEIPT_REGISTRIES (packages/core/src/types.ts)");
        console2.log(" 3. Update apps/studio/src/lib/chain.ts unifiedX helpers");
        console2.log(" 4. Remove RECEIPT_TYPE_CODE = 4 coercion from room.ts + passport-consolidate.ts");
    }
}
